/**
 * アートボードと実画面のズレを数字で出すツール。
 *
 * 目視だと「なんか違う」で止まってしまうので、同じ文字を持つ要素どうしを突き合わせて
 * 位置・大きさ・文字サイズ・色の差を並べる。preview.cjs が描いたアートボードと、
 * capture.cjs が撮った実画面の styles.json を比較する。
 *
 * 使い方:
 *   node compare.cjs Courses.dc.html STU-03 1520 --offset 0
 *
 * 第3引数はキャプチャ側の幅。--offset はアートボードとキャプチャの x 原点の差
 * （キャプチャはビューポート全体、アートボードは画面ぴったりなので、ずれることがある）。
 */
const fs = require('fs');
const path = require('path');

const { chromium } = require(path.resolve(__dirname, '../../../tools/clipkit-export/node_modules/playwright'));

const SCREENS_DIR = path.resolve(__dirname, '../screens');
const CAPTURE_DIR = path.resolve(__dirname, '../_capture');

/** capture.cjs と同じ採取をアートボード側にも適用する（同じものさしで測るため） */
function collect() {
  const out = [];
  function ownText(el) {
    let t = '';
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue;
    return t.trim();
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let node = document.body;
  while (node) {
    const cs = getComputedStyle(node);
    const text = ownText(node);
    if (text && cs.display !== 'none' && cs.visibility !== 'hidden') {
      const r = node.getBoundingClientRect();
      out.push({
        text: text.slice(0, 60),
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        color: cs.color,
      });
    }
    node = walker.nextNode();
  }
  return out;
}

function toPlainHtml(source) {
  const helmet = /<helmet>([\s\S]*?)<\/helmet>/i.exec(source);
  const body = /<x-dc>([\s\S]*?)<\/x-dc>/i.exec(source);
  const inner = body[1].replace(/<helmet>[\s\S]*?<\/helmet>/i, '');
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">${helmet ? helmet[1] : ''}</head><body style="margin:0">${inner}</body></html>`;
}

async function main() {
  const [file, screenId, widthArg] = process.argv.slice(2);
  const offIdx = process.argv.indexOf('--offset');
  const offset = offIdx >= 0 ? Number(process.argv[offIdx + 1]) : 0;
  if (!file || !screenId) {
    console.error('使い方: node compare.cjs <Artboard.dc.html> <画面ID> [幅] [--offset n]');
    process.exit(1);
  }
  const width = Number(widthArg) || 1440;

  const capPath = path.join(CAPTURE_DIR, screenId, `${width}.styles.json`);
  if (!fs.existsSync(capPath)) {
    console.error(`キャプチャが無い: ${capPath}`);
    process.exit(1);
  }
  const cap = JSON.parse(fs.readFileSync(capPath, 'utf8')).elements.filter((e) => e.text);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width, height: 900 });
  await page.setContent(toPlainHtml(fs.readFileSync(path.join(SCREENS_DIR, file), 'utf8')), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const mine = await page.evaluate(collect);
  await browser.close();

  // 同じ文字を持つものどうしを突き合わせる。同じ文字が複数あるときは出てきた順に対応させる
  const byText = new Map();
  for (const m of mine) {
    const k = m.text;
    if (!byText.has(k)) byText.set(k, []);
    byText.get(k).push(m);
  }

  const diffs = [];
  const missing = [];
  for (const c of cap) {
    const bucket = byText.get(c.text);
    if (!bucket || !bucket.length) {
      missing.push(c);
      continue;
    }
    const m = bucket.shift();
    const dx = m.rect.x - (c.rect.x + offset);
    const dy = m.rect.y - c.rect.y;
    const dw = m.rect.w - c.rect.w;
    const notes = [];
    if (Math.abs(dx) > 6) notes.push(`x ${dx > 0 ? '+' : ''}${dx}`);
    if (Math.abs(dy) > 6) notes.push(`y ${dy > 0 ? '+' : ''}${dy}`);
    if (Math.abs(dw) > 10) notes.push(`幅 ${dw > 0 ? '+' : ''}${dw}`);
    if (m.fontSize !== c.style.fontSize) notes.push(`字 ${c.style.fontSize}→${m.fontSize}`);
    if (m.fontWeight !== c.style.fontWeight) notes.push(`太さ ${c.style.fontWeight}→${m.fontWeight}`);
    if (m.color !== c.style.color) notes.push(`色 ${c.style.color}→${m.color}`);
    if (notes.length) diffs.push({ text: c.text, notes });
  }
  const extra = [...byText.values()].flat();

  console.log(`比較: ${file} ↔ _capture/${screenId}/${width}  （実画面の文字要素 ${cap.length} 件）\n`);
  if (missing.length) {
    console.log(`--- アートボードに無い文字 (${missing.length}) ---`);
    for (const m of missing) console.log(`  ${m.text}`);
    console.log('');
  }
  if (extra.length) {
    console.log(`--- 実画面に無い文字 (${extra.length}) ---`);
    for (const m of extra) console.log(`  ${m.text}`);
    console.log('');
  }
  if (diffs.length) {
    console.log(`--- ズレ (${diffs.length}) ---`);
    for (const d of diffs) console.log(`  ${d.text}  ::  ${d.notes.join(' / ')}`);
  } else {
    console.log('位置・文字サイズ・色のズレは無し');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
