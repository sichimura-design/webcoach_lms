/**
 * manifest.json の読み書きと、ファイルのべき等な書き込み。
 *
 * 「同じ URL を再実行しても安全に更新できる」ための要点をここに集約している。
 *   - 書き込みは一時ファイル → rename の原子的置換。途中で落ちても既存ファイルが壊れない。
 *   - 内容が同一なら書き込まない（mtime を動かさない）。再実行が完全な no-op になる。
 *   - manifest は URL をキーにマージする。今回の入力に無い既存エントリは消さない。
 */

const fs = require('fs');
const path = require('path');

const MANIFEST_VERSION = 1;
const MANIFEST_FILE = 'manifest.json';
const FAILURES_JSON = 'failures.json';
const FAILURES_TXT = 'failures.txt';

function manifestPath(courseDir) {
  return path.join(courseDir, MANIFEST_FILE);
}

/** 既存 manifest を読む。無い／壊れている場合は null。 */
function readManifest(courseDir) {
  const file = manifestPath(courseDir);
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || !Array.isArray(parsed.pages)) return null;
    return parsed;
  } catch (error) {
    // 壊れた manifest で全ページを取り直させるのは無駄なので警告だけ出して null 扱いにする。
    process.stderr.write(
      `[warn] manifest の読み込みに失敗しました（無視して新規作成します）: ${file}: ${error.message}\n`
    );
    return null;
  }
}

/** 既存 manifest から url → ページエントリの索引を作る。 */
function indexPagesByUrl(manifest) {
  const index = new Map();
  if (!manifest) return index;
  for (const page of manifest.pages) {
    if (page && page.url) index.set(page.url, page);
  }
  return index;
}

/**
 * 既存ページと今回のページを URL キーでマージする。
 * 今回の入力に含まれない既存エントリは末尾に残す（コースを分割実行しても履歴が消えない）。
 */
function mergePages(existingPages, freshPages) {
  const freshByUrl = new Map(freshPages.map((page) => [page.url, page]));
  const merged = [];
  const emitted = new Set();

  for (const page of freshPages) {
    merged.push(page);
    emitted.add(page.url);
  }
  for (const page of existingPages || []) {
    if (!page || !page.url) continue;
    if (freshByUrl.has(page.url) || emitted.has(page.url)) continue;
    merged.push(page);
    emitted.add(page.url);
  }
  return merged;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** 一時ファイル → rename の原子的書き込み。Windows でも既存ファイルを置換できる。 */
function writeFileAtomic(filePath, data, options = {}) {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(tmp, data, options);
    fs.renameSync(tmp, filePath);
  } catch (error) {
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch (cleanupError) {
      /* 後片付けの失敗は本来のエラーを隠さないよう無視する */
    }
    throw error;
  }
}

/**
 * 内容が変わっていなければ書かない。書いたら true を返す。
 * テキスト用（HTML / failures.txt）。
 */
function writeTextIfChanged(filePath, text) {
  if (fs.existsSync(filePath)) {
    try {
      if (fs.readFileSync(filePath, 'utf8') === text) return false;
    } catch (error) {
      /* 読めなければ書き直す */
    }
  }
  writeFileAtomic(filePath, text, 'utf8');
  return true;
}

function writeBufferIfChanged(filePath, buffer) {
  if (fs.existsSync(filePath)) {
    try {
      if (fs.readFileSync(filePath).equals(buffer)) return false;
    } catch (error) {
      /* 読めなければ書き直す */
    }
  }
  writeFileAtomic(filePath, buffer);
  return true;
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * manifest を書く。generatedAt 以外に差分が無ければ既存の generatedAt を保ち、
 * 書き込み自体をスキップする（再実行を完全な no-op にするため）。
 */
function writeManifest(courseDir, manifest, existingManifest, now) {
  const file = manifestPath(courseDir);
  const carried = {
    ...manifest,
    generatedAt: (existingManifest && existingManifest.generatedAt) || now,
  };

  if (existingManifest && serialize(carried) === serialize(existingManifest)) {
    return { changed: false, path: file };
  }

  const updated = { ...manifest, generatedAt: now };
  writeFileAtomic(file, serialize(updated), 'utf8');
  return { changed: true, path: file };
}

/**
 * 失敗一覧を書き出す。失敗が 0 件なら古いファイルを消す
 * （前回の失敗リストが残っていると、成功したのに失敗が続いているように見えるため）。
 */
function writeFailures(courseDir, failures) {
  const jsonFile = path.join(courseDir, FAILURES_JSON);
  const txtFile = path.join(courseDir, FAILURES_TXT);

  if (!failures || failures.length === 0) {
    for (const file of [jsonFile, txtFile]) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    return { jsonFile: null, txtFile: null };
  }

  writeTextIfChanged(jsonFile, serialize(failures));
  writeTextIfChanged(txtFile, `${failures.map((failure) => failure.url).join('\n')}\n`);
  return { jsonFile, txtFile };
}

module.exports = {
  MANIFEST_VERSION,
  MANIFEST_FILE,
  FAILURES_JSON,
  FAILURES_TXT,
  manifestPath,
  readManifest,
  indexPagesByUrl,
  mergePages,
  ensureDir,
  writeFileAtomic,
  writeTextIfChanged,
  writeBufferIfChanged,
  writeManifest,
  writeFailures,
};
