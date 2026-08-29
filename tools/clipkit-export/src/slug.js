/**
 * ファイル名・ディレクトリ名を「半角英数字・ハイフン・アンダースコア」だけに正規化する。
 *
 * 日本語タイトルは英数字が残らず空になるため、URL 末尾の ID → 連番 の順にフォールバックする。
 * 同じ URL が再実行で別名にならないことが最重要なので、呼び出し側（manifest）が持つ
 * url → slug のマッピングを常に優先すること。
 */

const crypto = require('crypto');

const MAX_SLUG_LENGTH = 80;

/** 画像として素直に扱える拡張子。URL 末尾から拡張子を決めるときの許可リスト。 */
const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.avif',
  '.bmp',
  '.ico',
  '.tif',
  '.tiff',
]);

const CONTENT_TYPE_EXTENSIONS = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/avif': '.avif',
  'image/bmp': '.bmp',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
  'image/tiff': '.tiff',
};

/**
 * 任意の文字列を 1 セグメントの slug に落とす。返り値は `[a-z0-9_-]*`。
 * 空文字になり得る（呼び出し側でフォールバックすること）。
 */
function sanitizeSegment(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/[-_]{2,}/g, '-')
    .replace(/^[-_]+/, '')
    .replace(/[-_]+$/, '')
    .toLowerCase()
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/[-_]+$/, '');
}

/**
 * URL のパスから識別子を作る。`/items/123` → `items-123`、`/lesson/intro` → `intro`。
 * 末尾が数値のときだけ 1 つ前のセグメントを前置する（`123` 単独では意味が読めないため）。
 */
function identifierFromUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (error) {
    return '';
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return sanitizeSegment(parsed.hostname);
  }

  const last = decodeURIComponent(segments[segments.length - 1]);
  const previous = segments.length > 1 ? decodeURIComponent(segments[segments.length - 2]) : '';

  if (/^\d+$/.test(last) && previous) {
    return sanitizeSegment(`${previous}-${last}`);
  }
  return sanitizeSegment(last);
}

/** URL のハッシュ。他のどの候補も空になったときの最終手段。 */
function hashOfUrl(url, length = 10) {
  return crypto.createHash('sha256').update(String(url)).digest('hex').slice(0, length);
}

/**
 * ファイル名として意味が読めるか。日本語タイトルから残った数字だけ（例: 「第1回 …」→ `1`）は
 * ファイル名にすると何のページか分からないので採用しない。
 */
function isReadableSlug(candidate) {
  return candidate.length >= 3 && /[a-z]/.test(candidate);
}

/**
 * Windows の予約デバイス名は拡張子を付けてもファイルにできない（`con.html` は作成に失敗する）。
 * 該当したら接頭辞を付けて避ける。
 */
const RESERVED_DEVICE_NAMES = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/;

function avoidReservedName(candidate) {
  return RESERVED_DEVICE_NAMES.test(candidate) ? `page-${candidate}` : candidate;
}

/**
 * ページ用の slug を決める。`taken` に既出の slug を渡すと衝突を回避して `-2`, `-3` を付ける。
 * `taken` は破壊的に更新される。
 */
function buildPageSlug({ title, url, index, taken }) {
  const used = taken instanceof Set ? taken : new Set();

  const fromTitle = sanitizeSegment(title);
  const base = avoidReservedName(
    (isReadableSlug(fromTitle) ? fromTitle : '') ||
      identifierFromUrl(url) ||
      sanitizeSegment(`page-${(index || 0) + 1}`) ||
      `page-${hashOfUrl(url)}`
  );

  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base.slice(0, MAX_SLUG_LENGTH - 5)}-${suffix}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }

  const fallback = `${base.slice(0, MAX_SLUG_LENGTH - 11)}-${hashOfUrl(url)}`;
  used.add(fallback);
  return fallback;
}

/** URL とレスポンスの Content-Type から画像の拡張子を決める。 */
function imageExtension(sourceUrl, contentType) {
  const normalizedType = String(contentType || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (CONTENT_TYPE_EXTENSIONS[normalizedType]) {
    return CONTENT_TYPE_EXTENSIONS[normalizedType];
  }

  try {
    const pathname = new URL(sourceUrl).pathname;
    const match = pathname.match(/(\.[a-zA-Z0-9]{1,5})$/);
    if (match && IMAGE_EXTENSIONS.has(match[1].toLowerCase())) {
      return match[1].toLowerCase();
    }
  } catch (error) {
    /* URL として解釈できなければ拡張子は諦める */
  }

  return '.bin';
}

/**
 * 画像のファイル名。URL のハッシュ由来なので決定的で、
 * 再実行しても同じ画像が二重に保存されない。
 */
function imageFileName(sourceUrl, contentType) {
  return `img-${hashOfUrl(sourceUrl)}${imageExtension(sourceUrl, contentType)}`;
}

/** 動画・音声として素直に扱える拡張子。 */
const MEDIA_EXTENSIONS = new Set(['.mp4', '.webm', '.ogv', '.mov', '.m4v', '.mp3', '.m4a', '.wav', '.ogg']);

const MEDIA_CONTENT_TYPES = {
  'video/mp4': '.mp4',
  'application/mp4': '.mp4',
  'video/webm': '.webm',
  'video/ogg': '.ogv',
  'video/quicktime': '.mov',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
};

function mediaExtension(sourceUrl, contentType) {
  const normalized = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (MEDIA_CONTENT_TYPES[normalized]) return MEDIA_CONTENT_TYPES[normalized];
  try {
    const match = new URL(sourceUrl).pathname.match(/(\.[a-zA-Z0-9]{1,5})$/);
    if (match && MEDIA_EXTENSIONS.has(match[1].toLowerCase())) return match[1].toLowerCase();
  } catch (error) {
    /* URL として解釈できなければ拡張子は諦める */
  }
  return '.bin';
}

/** 動画・音声のファイル名。画像と同じく URL のハッシュ由来で決定的。 */
function mediaFileName(sourceUrl, contentType) {
  return `med-${hashOfUrl(sourceUrl)}${mediaExtension(sourceUrl, contentType)}`;
}

/** コース slug の検証。使えない文字が含まれていたら呼び出し側に知らせる。 */
function normalizeCourseSlug(raw) {
  const normalized = avoidReservedName(sanitizeSegment(raw));
  if (!normalized) {
    throw new Error(`コース slug が半角英数字を含んでいません: ${JSON.stringify(raw)}`);
  }
  return { slug: normalized, changed: normalized !== String(raw) };
}

module.exports = {
  MAX_SLUG_LENGTH,
  sanitizeSegment,
  identifierFromUrl,
  hashOfUrl,
  isReadableSlug,
  buildPageSlug,
  imageExtension,
  imageFileName,
  mediaExtension,
  mediaFileName,
  normalizeCourseSlug,
};
