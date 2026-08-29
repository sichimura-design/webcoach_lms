/**
 * 初回だけ手動でログインし、その結果（Cookie / localStorage）を storageState として保存する。
 *
 * ID・パスワードはソース・引数・環境変数のいずれにも保存しない。
 * 実際の入力は人間がブラウザで行い、このスクリプトは結果の状態だけを書き出す。
 *
 * 完了の合図は2通り:
 *   - 対話ターミナルから実行した場合: Enter を押す
 *   - それ以外（Claude Code 等が起動した場合）: ログイン成功を自動検知する
 *     （--verify-url を渡すと、その教材ページが実際に開けるかで確実に判定する）
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const { ensureDir } = require('./manifest');

const LOGIN_URL_PATTERNS = ['/login', '/signin', '/sign_in', '/users/sign_in', '/session/new'];
const POLL_INTERVAL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** storageState の既定の保存先。ホストごとに分ける。 */
function defaultStatePath(toolDir, baseUrl) {
  let host = 'clipkit';
  try {
    host = new URL(baseUrl).host;
  } catch (error) {
    /* baseUrl が不正なら呼び出し側で弾かれる */
  }
  return path.join(toolDir, '.auth', `${host}.json`);
}

function waitForEnter(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

function isLoginUrl(url) {
  const lowered = String(url).toLowerCase();
  return LOGIN_URL_PATTERNS.some((pattern) => lowered.includes(pattern));
}

/** 認証情報なので、他ユーザーから読めないパーミッションで書き出す。 */
function saveState(target, state) {
  ensureDir(path.dirname(target));
  const handle = fs.openSync(target, 'w', 0o600);
  try {
    fs.writeFileSync(handle, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  } finally {
    fs.closeSync(handle);
  }
}

/**
 * ログイン済みかどうかを、実際の教材ページを開いて確かめる。
 * 「トップページは未ログインでも見える」サイトでも誤検知しない。
 */
async function verifyWithTargetPage(context, verifyUrl) {
  const page = await context.newPage();
  try {
    const response = await page
      .goto(verifyUrl, { waitUntil: 'networkidle', timeout: 45000 })
      .catch(() => page.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }));

    const status = response ? response.status() : 0;
    if (status === 401 || status === 403 || status >= 500) return false;

    // JavaScript によるログイン画面へのリダイレクトは domcontentloaded の後に起きる。
    // 落ち着くまで待ってから最終 URL を見ないと、ログイン画面を「教材ページ」と誤判定する。
    await page.waitForTimeout(2500);
    await page.waitForLoadState('domcontentloaded').catch(() => {});

    if (isLoginUrl(page.url())) return false;
    if ((await page.locator('input[type="password"]').count()) > 0) return false;

    const check = await page.evaluate(() => ({
      textLength: document.body ? (document.body.innerText || '').trim().length : 0,
      title: document.title || '',
    }));
    if (/ログイン|log ?in|sign ?in/i.test(check.title)) return false;
    return check.textLength > 400;
  } catch (error) {
    return false;
  } finally {
    await page.close().catch(() => {});
  }
}

/** ログイン完了を自動検知するモード。ターミナルへの入力を必要としない。 */
async function waitForLoginAutomatically({ browser, context, page, verifyUrl, timeoutMs, log }) {
  const deadline = Date.now() + timeoutMs;
  let lastSnapshot = null;
  let lastReportedUrl = '';
  let lastVerifyAt = 0;
  const VERIFY_INTERVAL_MS = 10000;

  log('');
  log('▼ ここからの操作 ------------------------------------------------------');
  log('  1. 別ウィンドウで Chromium ブラウザが開きます（見当たらなければタスクバーを確認）');
  log('  2. そのブラウザで、いつもどおり Clipkit にログインしてください');
  log('  3. ログインが終わったら、そのまま放置で構いません');
  log('     → ログイン成功を自動で検知し、ブラウザは自動で閉じます');
  log('----------------------------------------------------------------------');
  log('');
  log('ログイン待機中... （最大 15 分）');

  while (Date.now() < deadline) {
    if (!browser.isConnected()) {
      log('[info] ブラウザが閉じられました。');
      break;
    }

    let currentUrl = '';
    let passwordFields = 0;
    try {
      currentUrl = page.url();
      passwordFields = await page.locator('input[type="password"]').count();
    } catch (error) {
      // ページが閉じられた等。次のループで browser.isConnected() が拾う。
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    if (currentUrl !== lastReportedUrl) {
      log(`  現在のページ: ${currentUrl}`);
      lastReportedUrl = currentUrl;
    }

    let state = null;
    try {
      state = await context.storageState();
    } catch (error) {
      state = null;
    }
    if (state && (state.cookies || []).length > 0) {
      lastSnapshot = state;
    }

    const looksLoggedIn = state && (state.cookies || []).length > 0 && !isLoginUrl(currentUrl) && passwordFields === 0;

    if (looksLoggedIn) {
      if (verifyUrl) {
        // 教材ページを開く確認は重いので間隔を空ける。
        if (Date.now() - lastVerifyAt < VERIFY_INTERVAL_MS) {
          await sleep(POLL_INTERVAL_MS);
          continue;
        }
        lastVerifyAt = Date.now();

        const verified = await verifyWithTargetPage(context, verifyUrl);
        if (!verified) {
          log('  まだ教材ページを開けません（未ログイン）。ログインを続けてください...');
          continue;
        }
        log('  → 教材ページを開けました。ログイン成功と判断します。');
      }
      return { state: await context.storageState(), verified: Boolean(verifyUrl) };
    }

    await sleep(POLL_INTERVAL_MS);
  }

  if (lastSnapshot) {
    return { state: lastSnapshot, verified: false, partial: true };
  }
  throw new Error(
    'ログインを検知できませんでした（タイムアウト、またはブラウザが閉じられました）。もう一度やり直してください。'
  );
}

async function runLogin({ toolDir, baseUrl, statePath, keepOpen, verifyUrl, timeoutMs }) {
  if (!baseUrl) {
    throw new Error('--base-url が必要です（例: --base-url https://example.clipkit.co）');
  }
  // URL として解釈できるか先に確認する。
  new URL(baseUrl);
  if (verifyUrl) new URL(verifyUrl);

  const { chromium } = require('playwright');
  const target = statePath || defaultStatePath(toolDir, baseUrl);
  const log = (message) => process.stdout.write(`${message}\n`);

  log('ブラウザを開きます。表示された画面で手動ログインしてください。');

  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (error) {
    process.stderr.write(`[warn] ${baseUrl} を開けませんでした: ${error.message}\n`);
    process.stderr.write('       ブラウザは開いたままなので、手動で URL を入力しても構いません。\n');
  }

  let result;
  if (process.stdin.isTTY) {
    await waitForEnter('\nログインが完了したら、このターミナルで Enter を押してください > ');
    result = { state: await context.storageState(), verified: false };
  } else {
    // 非対話で起動された場合はターミナル入力を待てないので、自動検知に切り替える。
    result = await waitForLoginAutomatically({
      browser,
      context,
      page,
      verifyUrl,
      timeoutMs: timeoutMs || DEFAULT_TIMEOUT_MS,
      log,
    });
  }

  saveState(target, result.state);

  const cookieCount = (result.state.cookies || []).length;
  log(`\n認証状態を保存しました: ${target}（Cookie ${cookieCount} 件）`);
  if (cookieCount === 0) {
    process.stderr.write(
      '[warn] Cookie が 0 件です。ログインが完了していない可能性があります。やり直してください。\n'
    );
  } else if (result.partial) {
    process.stderr.write(
      '[warn] ログイン成功の確認は取れていません。取得に失敗する場合は login をやり直してください。\n'
    );
  }
  log('このファイルは .gitignore 済みです。共有・コミットしないでください。');

  if (!keepOpen && browser.isConnected()) {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

module.exports = { runLogin, defaultStatePath };
