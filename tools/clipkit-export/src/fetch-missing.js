/**
 * snapshot が手元に落とせず、絶対URLのまま残した参照を回収する。
 *
 * 落とせなかった理由はいろいろある（動画はページ描画の邪魔になるので読まない、
 * 外部CDNはブラウザが取りに行かない、など）。ここでは HTML を作り直さず、
 * **足りない実体だけを取ってきて、参照を差し替える**。
 *
 * 動画・音声は `<course>/media/` に置く（納品時に別ZIPへ分けられるようにするため）。
 * それ以外は `_assets/` に入れ、画像なら 1600px/WebP まで済ませる。
 */

const fs = require('fs');
const path = require('path');

const { AssetStore, normalizeUrl } = require('./asset-store');
const { ensureDir, readManifest, writeFileAtomic, writeTextIfChanged } = require('./manifest');
const { mediaFileName } = require('./slug');
const { loadConfig, resolveStorageState } = require('./export');

/** 動画・音声とみなす条件。拡張子と Content-Type の両方を見る。 */
const MEDIA_EXTENSIONS = /\.(mp4|webm|mov|m4v|ogv|mp3|m4a|wav|ogg)(\?|$)/i;

const DOWNLOAD_TIMEOUT_MS = 600000;

/** HTML に埋まっている形（属性値はエスケープされている）も含めて置換する。 */
function replaceUrl(html, url, replacement) {
  const escaped = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  let out = html.split(escaped).join(replacement);
  if (escaped !== url) out = out.split(url).join(replacement);
  return out;
}

/** 各コースの manifest から「未解決の参照 → それを載せているページ」を集める。 */
function collectMissing(outDir) {
  const byUrl = new Map();
  for (const entry of fs.readdirSync(outDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const manifest = readManifest(path.join(outDir, entry.name));
    if (!manifest) continue;

    for (const page of manifest.pages || []) {
      for (const url of page.unresolved || []) {
        const key = normalizeUrl(url);
        if (!byUrl.has(key)) byUrl.set(key, { url, refs: [] });
        byUrl.get(key).refs.push({ course: entry.name, slug: page.slug, htmlPath: page.htmlPath });
      }
    }
  }
  return byUrl;
}

async function runFetchMissing(options) {
  const configPath = path.resolve(options.config);
  const configDir = path.dirname(configPath);
  const config = loadConfig(configPath);

  const storageStatePath = resolveStorageState({
    config,
    configDir,
    toolDir: options.toolDir,
    override: options.storageState,
  });

  const sourceDir = path.isAbsolute(config.outDir) ? config.outDir : path.resolve(configDir, config.outDir);
  const outDir = options.outDir ? path.resolve(options.outDir) : path.resolve(sourceDir, '..', 'handoff');

  const log = options.log || ((message) => process.stdout.write(`${message}\n`));
  const missing = collectMissing(outDir);
  if (missing.size === 0) {
    log('未解決の参照はありません。');
    return { fetched: 0, failed: 0, bytes: 0 };
  }

  log(`未解決の参照: ${missing.size} 件（延べ ${[...missing.values()].reduce((n, m) => n + m.refs.length, 0)} 箇所）`);

  const store = new AssetStore({
    assetsDir: path.join(outDir, '_assets'),
    indexFile: path.join(outDir, 'assets.json'),
    imageOptions: { maxWidth: options.maxWidth, quality: options.quality },
    log,
  });
  store.load();

  const { request } = require('playwright');
  const context = await request.newContext({
    storageState: fs.existsSync(storageStatePath) ? storageStatePath : undefined,
    timeout: DOWNLOAD_TIMEOUT_MS,
  });

  const results = { fetched: 0, failed: 0, bytes: 0, failures: [] };
  /** url → 置換先（ページからの相対パス）。ページごとに階層が同じなので course 単位で持つ。 */
  const replacements = new Map();

  try {
    // まず大きさを測る。動画が何百MBにもなるので、取り込み前に総量を出す。
    if (options.probe) {
      let total = 0;
      let unknown = 0;
      for (const [key, item] of missing) {
        /* eslint-disable no-await-in-loop -- 直列で十分 */
        const head = await context.head(item.url, { timeout: 30000 }).catch(() => null);
        /* eslint-enable no-await-in-loop */
        const size = head && head.ok() ? Number.parseInt(head.headers()['content-length'] || '0', 10) : 0;
        if (size > 0) total += size;
        else unknown += 1;
        log(`  ${(size ? `${(size / 1024 / 1024).toFixed(1)}MB` : '不明').padStart(9)}  ${key.slice(0, 100)}`);
      }
      log(`\n合計 ${(total / 1024 / 1024).toFixed(1)}MB${unknown ? `（${unknown}件はサイズ不明）` : ''}`);
      return { ...results, probeOnly: true, totalBytes: total };
    }

    let index = 0;
    for (const [key, item] of missing) {
      index += 1;
      const label = `[${index}/${missing.size}]`;

      /* eslint-disable no-await-in-loop -- 動画が大きいので直列で取る */
      const response = await context.get(item.url, { timeout: DOWNLOAD_TIMEOUT_MS }).catch((error) => ({
        ok: () => false,
        status: () => 0,
        _error: error.message,
      }));

      if (!response.ok()) {
        const reason = response._error || `HTTP ${response.status()}`;
        log(`${label} 失敗 ${reason}  ${key.slice(0, 90)}`);
        store.markUnresolved(key, reason);
        results.failed += 1;
        results.failures.push({ url: item.url, reason });
        continue;
      }

      const buffer = await response.body();
      /* eslint-enable no-await-in-loop */
      if (!buffer || buffer.length === 0) {
        log(`${label} 失敗 空のレスポンス  ${key.slice(0, 90)}`);
        store.markUnresolved(key, '空のレスポンス');
        results.failed += 1;
        results.failures.push({ url: item.url, reason: '空のレスポンス' });
        continue;
      }

      const contentType = response.headers()['content-type'] || '';
      const isMedia = MEDIA_EXTENSIONS.test(key) || /^(video|audio)\//i.test(contentType);

      if (isMedia) {
        // 動画はコースごとの media/ へ。参照している全コースに置く（普通は1コース）。
        const name = mediaFileName(key, contentType);
        for (const ref of item.refs) {
          const mediaDir = path.join(outDir, ref.course, 'media');
          ensureDir(mediaDir);
          const file = path.join(mediaDir, name);
          if (!fs.existsSync(file)) writeFileAtomic(file, buffer);
        }
        replacements.set(key, `../media/${name}`);
      } else {
        /* eslint-disable no-await-in-loop -- 画像1枚ずつ */
        const name = await store.put(key, buffer, contentType);
        /* eslint-enable no-await-in-loop */
        if (!name) {
          store.markUnresolved(key, '保存できませんでした');
          results.failed += 1;
          continue;
        }
        replacements.set(key, `../../_assets/${name}`);
      }

      results.fetched += 1;
      results.bytes += buffer.length;
      log(
        `${label} 取得 ${(buffer.length / 1024 / 1024).toFixed(1)}MB  ` +
          `${isMedia ? 'media' : '_assets'}  ${key.slice(0, 80)}`
      );
    }
  } finally {
    await context.dispose().catch(() => {});
    store.save();
  }

  // --- HTML と manifest の差し替え -------------------------------------------
  let rewrittenFiles = 0;
  const byCourse = new Map();
  for (const [key, item] of missing) {
    if (!replacements.has(key)) continue;
    for (const ref of item.refs) {
      if (!byCourse.has(ref.course)) byCourse.set(ref.course, new Map());
      const pages = byCourse.get(ref.course);
      if (!pages.has(ref.htmlPath)) pages.set(ref.htmlPath, []);
      pages.get(ref.htmlPath).push(key);
    }
  }

  for (const [course, pages] of byCourse) {
    for (const [htmlPath, urls] of pages) {
      const file = path.join(outDir, course, htmlPath);
      if (!fs.existsSync(file)) continue;
      const before = fs.readFileSync(file, 'utf8');
      let after = before;
      for (const url of urls) {
        const original = missing.get(url).url;
        after = replaceUrl(after, original, replacements.get(url));
        if (original !== url) after = replaceUrl(after, url, replacements.get(url));
      }
      if (after !== before) {
        writeTextIfChanged(file, after);
        rewrittenFiles += 1;
      }
    }

    // manifest の unresolved からも消す。残しておくと「まだ足りない」ように見える。
    const courseDir = path.join(outDir, course);
    const manifest = readManifest(courseDir);
    if (!manifest) continue;
    for (const page of manifest.pages || []) {
      if (!page.unresolved || page.unresolved.length === 0) continue;
      page.unresolved = page.unresolved.filter((url) => !replacements.has(normalizeUrl(url)));
    }
    writeFileAtomic(path.join(courseDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }

  log(
    `\n取得 ${results.fetched} 件（${(results.bytes / 1024 / 1024).toFixed(1)}MB） / ` +
      `失敗 ${results.failed} 件 / HTML書き換え ${rewrittenFiles} ファイル`
  );
  for (const failure of results.failures) {
    log(`  取得できず: ${failure.reason}  ${failure.url.slice(0, 110)}`);
  }

  return results;
}

module.exports = { runFetchMissing, collectMissing, replaceUrl };
