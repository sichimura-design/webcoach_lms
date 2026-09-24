/**
 * 取得系で共通に使う道具。`export`（本文抽出）と `snapshot`（フルHTML）の両方が使う。
 *
 * ここにあるのは export.js から移してきたものがほとんどで、振る舞いは変えていない。
 * export.js は後方互換のために同じ名前で re-export している。
 */

const crypto = require('crypto');

const DEFAULT_LOGIN_URL_PATTERNS = ['/login', '/signin', '/sign_in', '/users/sign_in', '/session/new'];
const NAVIGATION_TIMEOUT_MS = 60000;
const RETRY_DELAYS_MS = [1000, 3000, 9000];
/** page.evaluate 用の上限。Playwright の既定タイムアウトは evaluate に効かない。 */
const EVALUATE_TIMEOUT_MS = 30000;
/** スクロールの上限。長大なページはレイアウト計算に時間が掛かるので少し長く取る。 */
const SCROLL_TIMEOUT_MS = 45000;
const EXTRACT_TIMEOUT_MS = 60000;
/** 1ページに費やす総時間の上限。リトライを含めてもこれを超えたら諦めて次へ進む。 */
const DEFAULT_PAGE_DEADLINE_MS = 300000;

/** ログイン切れ。部分リトライではなく全体中断に使う。 */
class AuthError extends Error {}

/** ページ単位の取得失敗。リトライ済みで諦めた状態。 */
class PageError extends Error {
  constructor(message, { retryable = false } = {}) {
    super(message);
    this.retryable = retryable;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 約束が期限内に終わらなければ PageError にする。ハングを1ページの失敗に閉じ込める。 */
function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new PageError(`${label}が ${ms}ms を超えました`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

/** HTML からタグを除いた本文の文字数。取得結果の劣化を検知するために使う。 */
function textLengthOf(html) {
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

/** タイトル末尾に付くサイト名を落とす。落とした結果が空になるなら元のまま返す。 */
function stripTitleSuffix(title, pattern) {
  if (!pattern) return title;
  try {
    const stripped = title.replace(new RegExp(pattern), '').trim();
    return stripped || title;
  } catch (error) {
    process.stderr.write(`[warn] titleStripPattern が不正です: ${pattern}\n`);
    return title;
  }
}

/** 比較用にパスだけを取り出す。日本語URLの %エンコード差と末尾スラッシュを吸収する。 */
function pathOf(url) {
  try {
    return decodeURIComponent(new URL(url).pathname).replace(/\/+$/, '');
  } catch (error) {
    return String(url);
  }
}

async function detectLoginWall(page, loginUrlPatterns, requestedUrl) {
  const currentUrl = page.url().toLowerCase();
  if (loginUrlPatterns.some((pattern) => currentUrl.includes(pattern.toLowerCase()))) {
    return `ログイン画面にリダイレクトされました: ${page.url()}`;
  }
  const passwordFields = await page.locator('input[type="password"]').count();
  if (passwordFields > 0) {
    return `パスワード入力欄が検出されました: ${page.url()}`;
  }
  // セッションが切れると、ログイン画面ではなくマイページ等へ飛ばされることがある。
  // 教材ページは本来リダイレクトしないので、別パスに移動していたら認証切れと見なす。
  if (pathOf(page.url()) !== pathOf(requestedUrl)) {
    return `別のページへリダイレクトされました: ${requestedUrl} -> ${page.url()}`;
  }
  return null;
}

/** 5xx とネットワーク系のタイムアウトだけ再試行する。4xx は何度やっても同じ。 */
function isRetryable(error) {
  if (error instanceof PageError) return error.retryable;
  return /timeout|net::|ERR_/i.test(error.message);
}

module.exports = {
  DEFAULT_LOGIN_URL_PATTERNS,
  NAVIGATION_TIMEOUT_MS,
  RETRY_DELAYS_MS,
  EVALUATE_TIMEOUT_MS,
  SCROLL_TIMEOUT_MS,
  EXTRACT_TIMEOUT_MS,
  DEFAULT_PAGE_DEADLINE_MS,
  AuthError,
  PageError,
  sleep,
  withTimeout,
  sha256,
  textLengthOf,
  stripTitleSuffix,
  pathOf,
  detectLoginWall,
  isRetryable,
};
