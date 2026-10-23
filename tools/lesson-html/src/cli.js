#!/usr/bin/env node
// 教材HTMLを WEBCOACH 学習システム（LMS）に載せる前の道具。使い方は README.md
//   node src/cli.js prepare <html...> [--out <フォルダ>] [--keep-h1]   LMS 用に整える
//   node src/cli.js check   <html...>                                    載せる前のチェック（NG があれば終了コード 1）
//   node src/cli.js preview [<html>] [--port 4800]                       LMS の枠でブラウザ表示
//   node src/cli.js verify  <html...> [--port 4801]                      プレビューを自動で開いて PC・スマホ幅で診断（Playwright）
const fs = require('fs');
const path = require('path');

function parse(argv) {
  const files = [], opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') opts.out = argv[++i];
    else if (a === '--port') opts.port = parseInt(argv[++i], 10);
    else if (a === '--keep-h1') opts.keepH1 = true;
    else files.push(a);
  }
  return { files: expand(files), opts };
}

// フォルダを渡されたら中の .html を全部
function expand(list) {
  return list.flatMap((p) => {
    if (!fs.existsSync(p)) { console.error(`見つかりません: ${p}`); process.exitCode = 1; return []; }
    if (fs.statSync(p).isDirectory()) return fs.readdirSync(p).filter((f) => /\.html?$/i.test(f)).sort().map((f) => path.join(p, f));
    return [p];
  });
}

function cmdPrepare(files, opts) {
  if (opts.out) fs.mkdirSync(opts.out, { recursive: true });
  const { prepare } = require('./prepare');
  for (const f of files) {
    const out = opts.out ? path.join(opts.out, path.basename(f)) : f;
    const changes = prepare(f, { out, keepH1: opts.keepH1 });
    console.log(`\n■ ${f}${out !== f ? ` → ${out}` : ''}`);
    console.log(changes.length ? changes.map((c) => `  ✔ ${c}`).join('\n') : '  直すところはありませんでした');
  }
}

function cmdCheck(files) {
  const { check } = require('./check');
  let ngFiles = 0;
  for (const f of files) {
    const items = check(f);
    const ng = items.filter((i) => i.level === 'NG').length;
    if (ng) ngFiles++;
    console.log(`\n■ ${f}  ${ng ? `NG ${ng} 件` : 'OK'}`);
    items.forEach((i) => console.log(`  [${i.level}] ${i.msg}`));
  }
  console.log(`\n${files.length} ファイル中 ${ngFiles} ファイルに NG`);
  if (ngFiles) process.exitCode = 1;
}

function cmdPreview(files, opts) {
  const { serve, previewUrl } = require('./serve');
  const port = opts.port || 4800;
  serve(port);
  files.forEach((f) => {
    const url = previewUrl(port, f);
    console.log(url ? `  ${f}\n    → ${url}` : `  ${f} はリポジトリの外にあります。リポジトリの中（例: assets/materials/）へ置いてから開いてください`);
  });
}

// Playwright はこのフォルダか、tools/clipkit-export（または PLAYWRIGHT_DIR）に入っているものを使う
function loadPlaywright() {
  const bases = [__dirname, path.resolve(__dirname, '../../clipkit-export'), process.env.PLAYWRIGHT_DIR].filter(Boolean);
  for (const base of bases) {
    try { return require(require.resolve('playwright', { paths: [base] })); } catch (e) { /* 次へ */ }
  }
  return null;
}

async function cmdVerify(files, opts) {
  const pw = loadPlaywright();
  if (!pw) {
    console.error('Playwright が見つかりません。tools/lesson-html で `npm i -D playwright && npx playwright install chromium` を実行するか、preview でブラウザから確認してください');
    process.exitCode = 1;
    return;
  }
  const { serve, previewUrl } = require('./serve');
  const port = opts.port || 4801;
  const server = serve(port);
  const browser = await pw.chromium.launch();
  let ngFiles = 0;
  try {
    for (const f of files) {
      const base = previewUrl(port, f);
      if (!base) { console.log(`\n■ ${f}: リポジトリの外なので開けません`); ngFiles++; continue; }
      console.log(`\n■ ${f}`);
      let fileNg = false;
      for (const [name, vw, q] of [['PC', 1280, ''], ['スマホ', 430, '&w=390']]) {
        const page = await browser.newPage({ viewport: { width: vw, height: 900 } });
        await page.goto(base + q);
        // 診断は高さの通知が落ち着いてから出る。届かないときは読み込み後 1.5 秒で出る
        await page.waitForFunction(() => window.__wcReport, null, { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1500);
        const r = await page.evaluate(() => window.__wcReport);
        await page.close();
        if (!r) { console.log(`  ${name}: 診断が終わりませんでした`); fileNg = true; continue; }
        console.log(`  ${name}（教材の幅 ${r.width}px）: ${r.ok ? 'OK' : 'NG'}　高さ ${r.gotHeight ? r.height + 'px' : '届いていない'}`);
        r.items.forEach((i) => console.log(`    [${i.level}] ${i.msg}`));
        if (!r.ok) fileNg = true;
      }
      if (fileNg) ngFiles++;
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`\n${files.length} ファイル中 ${ngFiles} ファイルに NG`);
  if (ngFiles) process.exitCode = 1;
}

const [cmd, ...rest] = process.argv.slice(2);
const { files, opts } = parse(rest);
const usage = '使い方: node src/cli.js <prepare|check|preview|verify> <html またはフォルダ...>（詳しくは README.md）';
if (cmd === 'prepare' && files.length) cmdPrepare(files, opts);
else if (cmd === 'check' && files.length) cmdCheck(files);
else if (cmd === 'preview') cmdPreview(files, opts);
else if (cmd === 'verify' && files.length) cmdVerify(files, opts).catch((e) => { console.error(e); process.exitCode = 1; });
else { console.error(usage); process.exitCode = 1; }
