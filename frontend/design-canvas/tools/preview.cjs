/**
 * .dc.html アートボードをローカルで描画して PNG にするツール。
 *
 * 目的は「書いたアートボードが実画面と合っているか」を _capture/ の PNG と
 * 並べて確かめること。Claude Design に上げてから目視するより速く、上げる前に直せる。
 *
 * 変換はごく単純に、<helmet> の中身を <head> へ、<x-dc> の残りを <body> へ移すだけ。
 * Design Components ランタイム（support.js）は使わないので、状態は自分で指定する:
 * <sc-if> は --on で挙げたものだけ中身を残し、挙げなかったものは丸ごと落とす。
 * これで「サイドバーを開いた状態」なども上げる前に確かめられる。
 *
 * 使い方:
 *   node preview.cjs Courses.dc.html                  # 既定幅
 *   node preview.cjs Main.dc.html --on sidebarOpen    # サイドバーを開いた状態
 *   node preview.cjs Main.dc.html --on aiOpen,accountOpen
 *   node preview.cjs                                  # screens/ の .dc.html を全部
 */
const fs = require('fs');
const path = require('path');

const { chromium } = require(path.resolve(__dirname, '../../../tools/clipkit-export/node_modules/playwright'));

const SCREENS_DIR = path.resolve(__dirname, '../screens');
const OUT_DIR = path.resolve(__dirname, '../_preview');

/** アートボードごとの既定の描画幅。canvas.json の w に合わせる */
const WIDTHS = {
  'Main.dc.html': 1440,
  'Courses.dc.html': 1512,
  'Notes.dc.html': 1440,
  'Coaching.dc.html': 1440,
  'NotesImproved.dc.html': 1440,
};
const FALLBACK_WIDTH = 1440;

/** <helmet> を head へ、残りを body へ。support.js は読まない */
function toPlainHtml(source, on, vals) {
  const helmet = /<helmet>([\s\S]*?)<\/helmet>/i.exec(source);
  const body = /<x-dc>([\s\S]*?)<\/x-dc>/i.exec(source);
  if (!body) throw new Error('<x-dc> が見つからない。Design Component の形になっていない');

  const head = helmet ? helmet[1] : '';
  let inner = body[1].replace(/<helmet>[\s\S]*?<\/helmet>/i, '');

  // <sc-if value="{{ name }}"> は --on に挙げたものだけ中身を残す（入れ子は想定しない）
  const seen = [];
  inner = inner.replace(/<sc-if\s+value="\{\{\s*([\w.]+)\s*\}\}"[^>]*>([\s\S]*?)<\/sc-if>/gi, (_m, name, kids) => {
    seen.push(name);
    return on.includes(name) ? kids : '';
  });

  // onClick="{{ handler }}" のような残りの hole は描画の邪魔なので落とす
  inner = inner.replace(/\son[A-Z]\w*="\{\{[^"]*\}\}"/g, '');

  // style の中などに残る {{ name }} は --vals で渡された値に置き換える。
  // 渡されなかったものは空にする（CSS なら無効値として無視されるので描画は続く）
  const unresolved = [];
  inner = inner.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, name) => {
    if (Object.prototype.hasOwnProperty.call(vals, name)) return vals[name];
    unresolved.push(name);
    return '';
  });
  const leftover = unresolved.length ? [...new Set(unresolved)] : null;

  return {
    leftover,
    conditions: seen,
    html: `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
${head}
</head>
<body style="margin:0">
${inner}
</body>
</html>`,
  };
}

async function shootOne(browser, file, width, on, vals) {
  const source = fs.readFileSync(path.join(SCREENS_DIR, file), 'utf8');
  const { html, leftover, conditions } = toPlainHtml(source, on, vals);

  const page = await browser.newPage();
  await page.setViewportSize({ width, height: 900 });
  await page.setContent(html, { waitUntil: 'load' });
  // Web フォントが載る前に撮ると字幅が変わって比較にならない
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const suffix = on.length ? `.${on.join('+')}` : '';
  const out = path.join(OUT_DIR, `${file.replace(/\.dc\.html$/, '')}${suffix}.${width}.png`);
  await page.screenshot({ path: out, fullPage: true });

  const size = await page.evaluate(() => ({
    w: document.documentElement.scrollWidth,
    h: document.documentElement.scrollHeight,
  }));
  await page.close();
  return { file, width, out, size, leftover, conditions };
}

async function main() {
  const args = process.argv.slice(2);
  const widthArg = args.indexOf('--width');
  const onArg = args.indexOf('--on');
  const valsArg = args.indexOf('--vals');
  const width = widthArg >= 0 ? Number(args[widthArg + 1]) : null;
  const on = onArg >= 0 ? String(args[onArg + 1] || '').split(',').filter(Boolean) : [];
  // --vals accountLeft=222px,other=12px の形で {{hole}} に流す値を渡す
  const vals = {};
  if (valsArg >= 0) {
    for (const pair of String(args[valsArg + 1] || '').split(',').filter(Boolean)) {
      const eq = pair.indexOf('=');
      if (eq > 0) vals[pair.slice(0, eq)] = pair.slice(eq + 1);
    }
  }
  // フラグの値そのものをファイル名と間違えないよう飛ばす。
  // フラグが無いときは -1 なので、そのまま +1 すると 0 番目（＝最初のファイル）を消してしまう
  const skip = new Set();
  if (widthArg >= 0) skip.add(widthArg + 1);
  if (onArg >= 0) skip.add(onArg + 1);
  if (valsArg >= 0) skip.add(valsArg + 1);
  const files = args.filter((a, i) => !a.startsWith('--') && !skip.has(i));
  const targets = files.length ? files : fs.readdirSync(SCREENS_DIR).filter((f) => f.endsWith('.dc.html'));

  const browser = await chromium.launch();
  for (const file of targets) {
    try {
      const r = await shootOne(browser, file, width || WIDTHS[file] || FALLBACK_WIDTH, on, vals);
      const states = r.conditions.length ? `  状態[${r.conditions.map((c) => (on.includes(c) ? c + '=ON' : c)).join(' ')}]` : '';
      const warn = r.leftover ? `  ⚠ 値の無い {{hole}}: ${r.leftover.join(', ')}（--vals で渡せる）` : '';
      console.log(`✓ ${r.file} @${r.width}  実サイズ ${r.size.w}x${r.size.h}${states}  → ${path.basename(r.out)}${warn}`);
    } catch (e) {
      console.log(`✗ ${file}  ${e.message}`);
      process.exitCode = 1;
    }
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
