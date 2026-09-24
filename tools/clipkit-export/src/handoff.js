/**
 * 納品物の組み立てと点検。
 *
 *   build … README.md と index.html を作り、ZIP にまとめる
 *   check … 出力した HTML を file:// で開いて、ローカル参照の 404 を数える
 *
 * check がこの一式でいちばん効く検査。相対パスの取り違えも、資産の取りこぼしも、
 * 「ローカルで開いて 404 が出るか」に全部現れる。
 */

const fs = require('fs');
const path = require('path');

const { createArchive } = require('./zip');
const { ensureDir, writeTextIfChanged } = require('./manifest');

const STYLE = `
:root { color-scheme: light dark; }
body { font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic UI", Meiryo, system-ui, sans-serif;
       margin: 0; padding: 2rem 1.5rem 5rem; line-height: 1.7; max-width: 1150px; }
h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
h2.course { font-size: 1.1rem; margin: 2rem 0 .5rem; border-bottom: 2px solid currentColor; padding-bottom: .25rem; }
h2.course .count { font-weight: normal; font-size: .8rem; color: #777; margin-left: .75rem; }
.sub { color: #777; margin: 0 0 1.5rem; font-size: .875rem; }
.meta { display: flex; flex-wrap: wrap; gap: .4rem 1.5rem; padding: 1rem 1.25rem; margin-bottom: 1.5rem;
        border: 1px solid #ddd; border-radius: 8px; }
table.idx { border-collapse: collapse; width: 100%; font-size: .875rem; }
table.idx th, table.idx td { border-bottom: 1px solid #ddd; padding: .35rem .5rem; text-align: left; }
table.idx th { font-size: .75rem; color: #777; }
td.n { text-align: right; font-variant-numeric: tabular-nums; color: #666; }
td.warn { color: #b45309; }
.note { margin-top: 2.5rem; padding: 1rem 1.25rem; border: 1px solid #ddd; border-radius: 8px; font-size: .875rem; }
a { color: inherit; }
`;

const esc = (value) =>
  String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** handoff 配下のコースを読む。manifest が無いディレクトリは無視する。 */
function readCourses(outDir) {
  const courses = [];
  for (const entry of fs.readdirSync(outDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const manifestFile = path.join(outDir, entry.name, 'manifest.json');
    if (!fs.existsSync(manifestFile)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      courses.push({ course: entry.name, manifest, pages: manifest.pages || [] });
    } catch (error) {
      process.stderr.write(`[warn] ${entry.name}: manifest を読めません: ${error.message}\n`);
    }
  }
  courses.sort((a, b) => b.pages.length - a.pages.length);
  return courses;
}

function directorySize(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? directorySize(full) : fs.statSync(full).size;
  }
  return total;
}

function renderIndex({ courses, generatedAt }) {
  const totalPages = courses.reduce((sum, item) => sum + item.pages.length, 0);
  const totalFailed = courses.reduce(
    (sum, item) => sum + item.pages.filter((page) => page.status === 'failed').length,
    0
  );
  const totalUnresolved = courses.reduce(
    (sum, item) => sum + item.pages.reduce((n, page) => n + ((page.unresolved || []).length), 0),
    0
  );

  const sections = courses
    .map(({ course, pages }) => {
      // 設定の URL 順（order）があればそれに従う。無い（取り直しで前に出た）ものは
      // タイトル順にして、一覧の並びが実行のたびに変わらないようにする。
      const rows = pages
        .filter((page) => page.status === 'ok')
        .sort((a, b) => {
          const byOrder = (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
          if (byOrder !== 0) return byOrder;
          return String(a.title || a.slug).localeCompare(String(b.title || b.slug), 'ja', { numeric: true });
        })
        .map(
          (page) => `
        <tr>
          <td><a href="${esc(course)}/${esc(page.htmlPath)}">${esc(page.title || page.slug)}</a></td>
          <td>${page.rawPath ? `<a href="${esc(course)}/${esc(page.rawPath)}">raw</a>` : ''}</td>
          <td class="n">${Math.round((page.bytes || 0) / 1024).toLocaleString()} KB</td>
          <td class="n">${(page.textLength || 0).toLocaleString()}</td>
          <td class="n">${page.resourceCount || 0}</td>
          <td class="n${(page.unresolved || []).length ? ' warn' : ''}">${(page.unresolved || []).length || ''}</td>
          <td><a href="${esc(page.url)}">元ページ</a></td>
        </tr>`
        )
        .join('');

      return `
    <h2 class="course">${esc(course)}<span class="count">${pages.filter((p) => p.status === 'ok').length}ページ</span></h2>
    <table class="idx">
      <thead><tr><th>ページ</th><th>生HTML</th><th>サイズ</th><th>本文字数</th><th>資産</th><th>未解決</th><th>元</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Clipkit 教材HTML — 全コース</title><style>${STYLE}</style></head>
<body>
<h1>Clipkit 教材HTML — 全${courses.length}コース</h1>
<p class="sub">元ページをそのまま保存したもの（${esc(generatedAt)}時点）。ページ名をクリックすると開きます。</p>
<div class="meta">
  <span><b>${totalPages}</b> ページ</span>
  <span>未解決の参照 <b>${totalUnresolved}</b> 件</span>
  ${totalFailed ? `<span>取得失敗 <b>${totalFailed}</b> 件</span>` : ''}
</div>
${sections}
<div class="note">
  「未解決」は、手元に落とせずに元サイトの絶対URLのまま残した参照の数です（埋め込み動画・外部CDN・
  未使用のフォントなど）。オンラインなら表示されます。詳しくは各コースの <code>manifest.json</code> を見てください。
</div>
</body></html>`;
}

function renderReadme({ courses, assetCount, assetBytes, htmlBytes, mediaBytes, generatedAt, includeMedia = true, deadLinks = [] }) {
  const mb = (n) => `${(n / 1024 / 1024).toFixed(1)}MB`;
  const totalPages = courses.reduce((sum, item) => sum + item.pages.filter((p) => p.status === 'ok').length, 0);
  const unresolvedTotal = courses.reduce(
    (sum, item) => sum + item.pages.reduce((n, page) => n + ((page.unresolved || []).length), 0),
    0
  );

  const table = courses
    .map(({ course, pages }) => {
      const ok = pages.filter((page) => page.status === 'ok').length;
      const failed = pages.filter((page) => page.status === 'failed').length;
      return `| \`${course}\` | ${ok} | ${failed || ''} |`;
    })
    .join('\n');

  return `# Clipkit 教材HTML

学習サイト（Clipkit）の教材ページを、**表示された状態のHTMLとして丸ごと**保存したものです。
${generatedAt} 時点。全 ${courses.length} コース ${totalPages} ページ。

## 中身

\`\`\`
index.html                 全ページの一覧（ここから開くのがはやい）
assets.json                元URL → _assets/ のファイル名 の対応表
_assets/<hash>.<ext>       CSS・画像・フォント（全コース共通で1本化）
<コース>/
  html/<slug>.html         ブラウザで表示された最終形のHTML
  raw/<slug>.html          サーバーが返した生のHTML（JS実行前）
  media/<file>             動画・音声
  manifest.json            ページごとの元URL・タイトル・未解決の参照
\`\`\`

| コース | ページ数 | 取得失敗 |
| --- | ---: | ---: |
${table}

## 見るときの注意

- **ZIPは丸ごと展開してください。** HTMLは \`../../_assets/…\` を参照しているので、
  1ファイルだけ取り出すと画像もCSSも当たりません。
- \`html/\` は**JavaScriptを除去済み**です。ローカルで開いたときにスクリプトが再実行されて
  本文が消える事故を防ぐためで、遅延読み込みや出現アニメーションは「表示された後」の状態で固定してあります。
  素のテンプレート構造が見たいときは \`raw/\` を見てください。
- **埋め込み（YouTube・Vimeo・Google ドキュメント等）はオンライン前提**です。オフラインでは表示されません。
  \`iframe\` の \`src\` は元のURLのまま残してあります。
- 画像は**横幅1600px・WebP**に変換済みです（そのままだと合計700MB超のため）。
  SVGとGIFは変換していません。原寸が必要なら言ってください。
${
  includeMedia || mediaBytes === 0
    ? ''
    : '- **動画・音声は別ZIP**（`handoff-media.zip`）です。本体のZIPと同じ場所に展開すると、\n  ページから再生できるようになります。\n'
}${
  unresolvedTotal === 0
    ? '- 参照はすべてローカルに揃っています（外部の埋め込みを除く）。\n'
    : `- ローカルに置けなかった参照が${unresolvedTotal}件あります（下の「リンク切れ」参照）。\n` +
      '  元サイトの絶対URLのまま残してあります。一覧は各コースの `manifest.json` の `unresolved`。\n'
}${
  deadLinks.length === 0
    ? ''
    : `\n## リンク切れ\n\n次の${deadLinks.length}件は**配信元が返さないファイル**です。元サイトで開いても表示されない\n` +
      '（画像が削除された・共有リンクが失効した）ことを確認済みで、取得漏れではありません。\n\n' +
      `${deadLinks.map((item) => `- \`${item.reason}\` ${item.url}`).join('\n')}\n`
}

## 容量

| | |
| --- | ---: |
| HTML（${totalPages}ページ） | ${mb(htmlBytes)} |
| \`_assets/\`（${assetCount}件） | ${mb(assetBytes)} |
| 動画・音声 | ${mb(mediaBytes)} |

## 元ページとの対応

各コースの \`manifest.json\` の \`pages[]\` に、\`url\`（元ページ）・\`title\`・\`slug\`・
\`htmlPath\` が入っています。ファイル名（slug）は元の取得ツールと同じものを使っているので、
既存の抽出結果とも突き合わせられます。
`;
}

/**
 * どの HTML からも参照されていない資産を消す。
 *
 * Pass 1 の種まきは「取得済みの画像を全部」入れるので、スナップショットしていない
 * ページの画像も混ざる。全コースを取り切ったあとに1回かけると納品物が素直に縮む。
 * **部分実行のあとに掛けてはいけない**（まだ作っていないページの資産を消してしまう）。
 */
function pruneAssets({ outDir, courses, log = () => {} }) {
  const assetsDir = path.join(outDir, '_assets');
  if (!fs.existsSync(assetsDir)) return { removed: 0, freed: 0 };

  const referenced = new Set();
  const cssToScan = [];

  for (const { course, pages } of courses) {
    for (const page of pages) {
      if (page.status !== 'ok' || !page.htmlPath) continue;
      const file = path.join(outDir, course, page.htmlPath);
      if (!fs.existsSync(file)) continue;
      for (const match of fs.readFileSync(file, 'utf8').matchAll(/_assets\/([A-Za-z0-9._-]+)/g)) {
        referenced.add(match[1]);
        if (match[1].endsWith('.css')) cssToScan.push(match[1]);
      }
    }
  }

  // CSS は同じ階層のファイル名をそのまま書いているので、中身も辿る（@import と背景画像）。
  const scanned = new Set();
  while (cssToScan.length > 0) {
    const name = cssToScan.pop();
    if (scanned.has(name)) continue;
    scanned.add(name);
    const file = path.join(assetsDir, name);
    if (!fs.existsSync(file)) continue;
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/url\("([A-Za-z0-9._-]+)"\)/g)) {
      referenced.add(match[1]);
      if (match[1].endsWith('.css')) cssToScan.push(match[1]);
    }
  }

  let removed = 0;
  let freed = 0;
  for (const name of fs.readdirSync(assetsDir)) {
    if (referenced.has(name)) continue;
    const file = path.join(assetsDir, name);
    freed += fs.statSync(file).size;
    fs.unlinkSync(file);
    removed += 1;
  }

  // 索引からも消えたファイルを外す。
  const indexFile = path.join(outDir, 'assets.json');
  if (fs.existsSync(indexFile) && removed > 0) {
    try {
      const parsed = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
      const assets = {};
      for (const [url, name] of Object.entries(parsed.assets || {})) {
        if (referenced.has(name)) assets[url] = name;
      }
      parsed.assets = assets;
      parsed.assetCount = Object.keys(assets).length;
      fs.writeFileSync(indexFile, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
    } catch (error) {
      log(`[warn] 資産索引を更新できませんでした: ${error.message}`);
    }
  }

  log(`不要な資産を削除: ${removed}件 / ${(freed / 1024 / 1024).toFixed(1)}MB`);
  return { removed, freed };
}

/** README と index.html を作り、ZIP にまとめる。 */
async function runBuild({ outDir, includeMedia = true, zip = true, prune = false, log = () => {} }) {
  const courses = readCourses(outDir);
  if (courses.length === 0) throw new Error(`納品物が空です: ${outDir}（先に snapshot を実行してください）`);

  if (prune) pruneAssets({ outDir, courses, log });

  const generatedAt = new Date().toISOString().slice(0, 10);
  const assetsDir = path.join(outDir, '_assets');
  const assetBytes = directorySize(assetsDir);
  const assetCount = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir).length : 0;
  const htmlBytes = courses.reduce(
    (sum, { course }) => sum + directorySize(path.join(outDir, course, 'html')) + directorySize(path.join(outDir, course, 'raw')),
    0
  );
  const mediaBytes = courses.reduce(
    (sum, { course }) => sum + directorySize(path.join(outDir, course, 'media')),
    0
  );

  // 取りに行って配信元に断られたもの。取得漏れと区別できるよう README に理由つきで載せる。
  const deadLinks = [];
  const indexFile = path.join(outDir, 'assets.json');
  if (fs.existsSync(indexFile)) {
    try {
      const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
      for (const [url, reason] of Object.entries(index.unresolved || {})) deadLinks.push({ url, reason });
    } catch (error) {
      log(`[warn] 資産索引を読めませんでした: ${error.message}`);
    }
  }

  ensureDir(outDir);
  writeTextIfChanged(path.join(outDir, 'index.html'), renderIndex({ courses, generatedAt }));
  writeTextIfChanged(
    path.join(outDir, 'README.md'),
    renderReadme({ courses, assetCount, assetBytes, htmlBytes, mediaBytes, generatedAt, includeMedia, deadLinks })
  );
  log(`一覧   : ${path.join(outDir, 'index.html')}`);
  log(`README : ${path.join(outDir, 'README.md')}`);

  if (!zip) return { outDir, courses, zips: [] };

  const parent = path.dirname(outDir);
  const base = path.basename(outDir);
  const zips = [];

  // 本体。画像は WebP 済み・フォントも圧縮済みなので、最大圧縮にはしない。
  // screenshots は取得時の確認用（ライブとローカルの比較）で、納品物ではない。
  const main = await createArchive({
    sourceDir: outDir,
    outPath: path.join(parent, `${base}.zip`),
    prefix: base,
    ignore: ['*/screenshots/**', ...(includeMedia ? [] : ['*/media/**'])],
    level: 6,
  });
  zips.push(main);
  log(`ZIP    : ${main.path}  ${(main.bytes / 1024 / 1024).toFixed(1)}MB / ${main.entries} エントリ`);

  if (!includeMedia && mediaBytes > 0) {
    const media = await createArchive({
      sourceDir: outDir,
      outPath: path.join(parent, `${base}-media.zip`),
      prefix: base,
      ignore: ['_assets/**', '*/html/**', '*/raw/**', '*/screenshots/**', '*.html', '*.md', '*.json', '*/manifest.json'],
      level: 1,
    });
    zips.push(media);
    log(`ZIP    : ${media.path}  ${(media.bytes / 1024 / 1024).toFixed(1)}MB / ${media.entries} エントリ`);
  }

  return { outDir, courses, zips };
}

/**
 * 出力した HTML を file:// で開いて、ローカル参照の 404 を数える。
 * 相対パスの取り違えも資産の取りこぼしも、ここに全部出る。
 */
async function runCheck({ outDir, courseFilter = null, limit = 0, log = () => {} }) {
  const courses = readCourses(outDir).filter((item) => !courseFilter || item.course === courseFilter);
  if (courses.length === 0) throw new Error(`点検対象がありません: ${outDir}`);

  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });

  const report = [];
  try {
    for (const { course, pages } of courses) {
      let targets = pages.filter((page) => page.status === 'ok' && page.htmlPath);
      if (limit > 0) targets = targets.slice(0, limit);

      for (const target of targets) {
        const file = path.join(outDir, course, target.htmlPath);
        if (!fs.existsSync(file)) continue;

        const failures = [];
        const page = await context.newPage();
        // 外へは出さない。ローカル参照だけを見たいので、http(s) は全部止める。
        await page.route('**/*', (route) => {
          const url = route.request().url();
          if (url.startsWith('file:')) return route.continue();
          return route.abort();
        });
        page.on('requestfailed', (request) => {
          if (request.url().startsWith('file:')) failures.push(request.url());
        });
        page.on('response', (response) => {
          if (response.status() >= 400 && response.url().startsWith('file:')) failures.push(response.url());
        });

        await page.goto(`file://${file.replace(/\\/g, '/')}`, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(400);

        // ライブのスクリーンショットがあれば、同じ条件でローカル側も撮って並べられるようにする。
        const liveShot = path.join(outDir, course, 'screenshots', `${target.slug}.live.png`);
        if (fs.existsSync(liveShot)) {
          await page
            .screenshot({ path: liveShot.replace(/\.live\.png$/, '.local.png'), fullPage: true })
            .catch(() => {});
        }

        // コメントアウトされた <script> を数えないよう、先に HTML コメントを落とす。
        const html = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
        const counts = {
          base: (html.match(/<base\b/gi) || []).length,
          integrity: (html.match(/\sintegrity=/gi) || []).length,
          srcset: (html.match(/\ssrcset=/gi) || []).length,
          blob: (html.match(/blob:/gi) || []).length,
          script: (html.match(/<script\b/gi) || []).length,
        };

        // 実ファイルがあるのに requestfailed になることがある（動画はブラウザが
        // 途中でリクエストを打ち切る）。ディスクを見て、本当に無いものだけを数える。
        const localMissing = [...new Set(failures)].filter((url) => {
          const decoded = decodeURIComponent(url.replace(/^file:\/+/, '')).replace(/\//g, path.sep);
          return !fs.existsSync(decoded);
        });

        report.push({
          course,
          slug: target.slug,
          localMissing,
          unresolved: (target.unresolved || []).length,
          ...counts,
        });
        await page.close();
      }
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  const broken = report.filter((row) => row.localMissing.length > 0);
  const suspicious = report.filter((row) => row.base || row.integrity || row.srcset || row.blob || row.script);

  log(`\n================ ローカル点検 ${report.length} ページ ================`);
  log(`ローカル参照の 404 : ${broken.length} ページ`);
  log(`残っている危険な属性: ${suspicious.length} ページ（base / integrity / srcset / blob / script）`);

  for (const row of broken.slice(0, 20)) {
    log(`  ${row.course}/${row.slug}  欠け ${row.localMissing.length}件`);
    for (const missing of row.localMissing.slice(0, 3)) log(`      ${path.basename(missing)}`);
  }
  for (const row of suspicious.slice(0, 20)) {
    log(
      `  ${row.course}/${row.slug}  base=${row.base} integrity=${row.integrity} ` +
        `srcset=${row.srcset} blob=${row.blob} script=${row.script}`
    );
  }

  return { report, broken, suspicious };
}

module.exports = { runBuild, runCheck, pruneAssets, readCourses, renderIndex, renderReadme };
