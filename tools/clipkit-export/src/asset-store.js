/**
 * スナップショットが参照する資産（CSS・画像・フォント）の置き場。
 *
 * 設計の要点:
 *   - ファイル名は **内容のハッシュ**。URL 由来にすると「同じ URL で内容が違う」ときに
 *     先勝ちで壊れる。内容ハッシュなら重複排除とレース回避が同時に成立する。
 *   - 画像は put した時点で最適化して**最終ファイル名を確定させる**。
 *     後から一括変換すると HTML と CSS を全部もう一度置換し直すことになり、取りこぼす。
 *   - 既に materials/source の各コースの images/ にある 700MB 超を種として流用する。
 *     ここが今回の効率化の本体で、再ダウンロードを丸ごと省ける。
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { optimizeBuffer, writeFileAtomic } = require('../../shared/optimize-image');
const { imageExtension } = require('./slug');

const INDEX_VERSION = 1;

/** 拡張子を決めるための Content-Type 表（画像は imageExtension が持っている）。 */
const CONTENT_TYPE_EXTENSIONS = {
  'text/css': '.css',
  'font/woff2': '.woff2',
  'font/woff': '.woff',
  'font/ttf': '.ttf',
  'font/otf': '.otf',
  'font/collection': '.ttc',
  'application/font-woff': '.woff',
  'application/font-woff2': '.woff2',
  'application/x-font-woff': '.woff',
  'application/x-font-ttf': '.ttf',
  'application/x-font-truetype': '.ttf',
  'application/x-font-opentype': '.otf',
  'application/vnd.ms-fontobject': '.eot',
  'application/json': '.json',
  'text/plain': '.txt',
};

const FONT_EXTENSIONS = new Set(['.woff', '.woff2', '.ttf', '.otf', '.eot', '.ttc']);
const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.bmp', '.ico', '.tif', '.tiff',
]);

/** 比較・索引のキー。フラグメントだけが違う URL を別物にしない。 */
function normalizeUrl(url) {
  try {
    const parsed = new URL(String(url));
    parsed.hash = '';
    return parsed.toString();
  } catch (error) {
    return String(url);
  }
}

function extensionFromUrl(url) {
  try {
    const match = new URL(url).pathname.match(/(\.[a-zA-Z0-9]{1,6})$/);
    return match ? match[1].toLowerCase() : '';
  } catch (error) {
    return '';
  }
}

/** 拡張子を決める。Content-Type を優先し、無ければ URL の末尾を見る。 */
function pickExtension(url, contentType) {
  const normalized = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (CONTENT_TYPE_EXTENSIONS[normalized]) return CONTENT_TYPE_EXTENSIONS[normalized];
  if (normalized.startsWith('image/')) return imageExtension(url, contentType);
  const fromUrl = extensionFromUrl(url);
  if (fromUrl) return fromUrl;
  return '.bin';
}

function kindOf(ext, contentType) {
  const normalized = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (ext === '.css' || normalized === 'text/css') return 'css';
  if (FONT_EXTENSIONS.has(ext) || normalized.startsWith('font/')) return 'font';
  if (IMAGE_EXTENSIONS.has(ext) || normalized.startsWith('image/')) return 'image';
  return 'other';
}

class AssetStore {
  /**
   * @param {object} params
   * @param {string} params.assetsDir  実ファイルの置き場（handoff/_assets）
   * @param {string} params.indexFile  url → ファイル名の対応表（handoff/assets.json）
   * @param {object} params.imageOptions  optimizeBuffer に渡す設定
   */
  constructor({ assetsDir, indexFile, imageOptions = {}, log = () => {} }) {
    this.assetsDir = assetsDir;
    this.indexFile = indexFile;
    this.imageOptions = imageOptions;
    this.log = log;
    /** url → ファイル名 */
    this.index = new Map();
    /** url → 失敗理由。絶対URLのまま残したものの記録。 */
    this.unresolved = new Map();
    this.stats = { stored: 0, reused: 0, seeded: 0, srcBytes: 0, outBytes: 0 };
    fs.mkdirSync(this.assetsDir, { recursive: true });
  }

  /** 前回の実行結果を読み直す（再実行を安くするため）。 */
  load() {
    if (!fs.existsSync(this.indexFile)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.indexFile, 'utf8'));
      for (const [url, name] of Object.entries(parsed.assets || {})) {
        // 実ファイルが消えていたら索引からも外す。
        if (fs.existsSync(path.join(this.assetsDir, name))) this.index.set(url, name);
      }
      for (const [url, reason] of Object.entries(parsed.unresolved || {})) {
        this.unresolved.set(url, reason);
      }
    } catch (error) {
      this.log(`[warn] 資産索引を読めませんでした（作り直します）: ${error.message}`);
    }
  }

  save() {
    const assets = {};
    for (const url of [...this.index.keys()].sort()) assets[url] = this.index.get(url);
    const unresolved = {};
    for (const url of [...this.unresolved.keys()].sort()) unresolved[url] = this.unresolved.get(url);

    writeFileAtomic(
      this.indexFile,
      Buffer.from(
        `${JSON.stringify(
          {
            version: INDEX_VERSION,
            generatedAt: new Date().toISOString(),
            assetCount: this.index.size,
            assets,
            unresolved,
          },
          null,
          2
        )}\n`,
        'utf8'
      )
    );
  }

  has(url) {
    return this.index.has(normalizeUrl(url));
  }

  nameOf(url) {
    return this.index.get(normalizeUrl(url)) || null;
  }

  /** リダイレクト元など、同じ実体を指す別 URL を同じファイルに結びつける。 */
  alias(fromUrl, toUrl) {
    const name = this.nameOf(toUrl);
    if (name) this.index.set(normalizeUrl(fromUrl), name);
    return name;
  }

  markUnresolved(url, reason) {
    this.unresolved.set(normalizeUrl(url), String(reason));
  }

  /**
   * 資産を1件格納して、確定したファイル名を返す。
   * 画像はここで横幅1600px・WebP 化まで済ませる。
   */
  async put(url, buffer, contentType, { extOverride = null } = {}) {
    const key = normalizeUrl(url);
    const existing = this.index.get(key);
    if (existing) {
      this.stats.reused += 1;
      return existing;
    }
    if (!buffer || buffer.length === 0) return null;

    // 既存ファイルから種まきするときは、そのファイルの拡張子が正
    // （取得時に Content-Type から決めたもので、URL からは復元できない）。
    const ext = extOverride || pickExtension(key, contentType);
    const kind = kindOf(ext, contentType);

    let body = buffer;
    let finalExt = ext;
    if (kind === 'image') {
      const optimized = await optimizeBuffer(buffer, ext, this.imageOptions);
      body = optimized.buffer;
      finalExt = optimized.ext;
    }

    // 名前は「元の内容」のハッシュ。最適化の設定を変えても同じ元ファイルは同じ名前になる。
    const name = `${crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 10)}${finalExt}`;
    const file = path.join(this.assetsDir, name);
    if (!fs.existsSync(file)) writeFileAtomic(file, body);

    this.index.set(key, name);
    this.unresolved.delete(key);
    this.stats.stored += 1;
    this.stats.srcBytes += buffer.length;
    this.stats.outBytes += body.length;
    return name;
  }

  /** CSS は書き換えてから入れるので、内容と名前を呼び出し側が決める。 */
  putText(url, originalBuffer, text, ext) {
    const key = normalizeUrl(url);
    const name = `${crypto.createHash('sha256').update(originalBuffer).digest('hex').slice(0, 10)}${ext}`;
    const file = path.join(this.assetsDir, name);
    const body = Buffer.from(text, 'utf8');
    if (!fs.existsSync(file)) writeFileAtomic(file, body);
    this.index.set(key, name);
    this.unresolved.delete(key);
    this.stats.stored += 1;
    this.stats.srcBytes += originalBuffer.length;
    this.stats.outBytes += body.length;
    return name;
  }

  /**
   * 既に取得済みの画像（materials/source/<course>/images/）を種として取り込む。
   * manifest の `images[].sourceUrl → path` が正。imageFileName() を再計算しないこと
   * （拡張子が Content-Type 依存で決まっているので、URL からは復元できない）。
   */
  async seedFromManifests({ sourceDir, courseSlugs, onProgress = () => {} }) {
    let scanned = 0;
    for (const slug of courseSlugs) {
      const manifestFile = path.join(sourceDir, slug, 'manifest.json');
      if (!fs.existsSync(manifestFile)) continue;

      let manifest;
      try {
        manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      } catch (error) {
        this.log(`[warn] ${slug}: manifest を読めません: ${error.message}`);
        continue;
      }

      for (const page of manifest.pages || []) {
        for (const image of page.images || []) {
          if (!image || image.status !== 'ok' || !image.path || !image.sourceUrl) continue;
          const key = normalizeUrl(image.sourceUrl);
          if (this.index.has(key)) continue;

          const srcFile = path.join(sourceDir, slug, image.path);
          if (!fs.existsSync(srcFile)) continue;

          /* eslint-disable no-await-in-loop -- 直列で十分。sharp にメモリを使わせすぎない */
          await this.put(image.sourceUrl, fs.readFileSync(srcFile), null, {
            extOverride: path.extname(srcFile).toLowerCase() || null,
          });
          /* eslint-enable no-await-in-loop */
          this.stats.seeded += 1;
          scanned += 1;
          if (scanned % 250 === 0) onProgress(scanned);
        }
      }
    }
    return scanned;
  }
}

module.exports = {
  AssetStore,
  normalizeUrl,
  pickExtension,
  kindOf,
  extensionFromUrl,
  CONTENT_TYPE_EXTENSIONS,
};
