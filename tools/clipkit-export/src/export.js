/**
 * 教材ページの取得メインループ。
 *
 * 設計上の約束:
 *   - 同じ URL を再実行しても結果が変わらない（内容が同じならファイルを書き換えない）。
 *   - 1ページの失敗は他ページの成功結果を壊さない。
 *   - 未ログインを検知したら即座に全体を中断する（ログイン画面のHTMLを量産しないため）。
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  DEFAULT_ALLOWED_TAGS,
  DEFAULT_ALLOWED_ATTRIBUTES,
  IMAGE_PLACEHOLDER_PREFIX,
  IMAGE_PLACEHOLDER_SUFFIX,
  MEDIA_PLACEHOLDER_PREFIX,
  MEDIA_PLACEHOLDER_SUFFIX,
  extractInPage,
  autoScrollInPage,
  wrapDocument,
} = require('./extract');
const {
  downloadImages, rewriteImagePlaceholders,
  downloadMediaFiles, rewriteMediaPlaceholders,
} = require('./assets');
const {
  MANIFEST_VERSION,
  ensureDir,
  indexPagesByUrl,
  mergePages,
  readManifest,
  writeFailures,
  writeFileAtomic,
  writeManifest,
} = require('./manifest');
const { buildPageSlug, identifierFromUrl, normalizeCourseSlug, sanitizeSegment } = require('./slug');
const { createZip } = require('./zip');

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
/** 何ページごとに manifest を書き出すか。長いコースの途中で落ちても進捗を失わないため。 */
const MANIFEST_FLUSH_EVERY = 25;

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

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * 教材が持っていた CSS を styles/<hash>.css に保存し、ファイル名を返す。
 * 内容が同じなら同じファイルになるので、コース内で自然に重複が畳まれる。
 * 見た目の再現（移行先で教材の枠に閉じ込めて適用する）に使う。
 */
function saveStyles(courseDir, styles) {
  if (!styles || styles.length === 0) return [];
  const dir = path.join(courseDir, 'styles');
  ensureDir(dir);
  return styles.map((css) => {
    const name = `css-${sha256(css).slice(0, 10)}.css`;
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) writeFileAtomic(file, css, 'utf8');
    return `styles/${name}`;
  });
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

// ---------------------------------------------------------------------------
// 設定
// ---------------------------------------------------------------------------

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `設定ファイルが見つかりません: ${configPath}\n` +
        '  clipkit.config.example.json をコピーして作成してください。'
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`設定ファイルの JSON が壊れています: ${configPath}: ${error.message}`);
  }

  if (!parsed.baseUrl) throw new Error('設定に baseUrl がありません。');
  new URL(parsed.baseUrl);
  if (!Array.isArray(parsed.courses) || parsed.courses.length === 0) {
    throw new Error('設定に courses が 1 件もありません。');
  }

  const content = parsed.content || {};
  return {
    baseUrl: parsed.baseUrl.replace(/\/+$/, ''),
    storageState: parsed.storageState || null,
    outDir: parsed.outDir || '../../materials/source',
    content: {
      include: content.include || [],
      exclude: content.exclude || [],
      allowedEmbedHosts: content.allowedEmbedHosts || [],
      // 配信終了が見えているホストの動画・音声は手元に取り込む。
      downloadMediaHosts: content.downloadMediaHosts || [],
      allowedTags: content.allowedTags || DEFAULT_ALLOWED_TAGS,
      attributes: content.attributes || DEFAULT_ALLOWED_ATTRIBUTES,
      titleSelectors: content.titleSelectors || [],
      // 実行ごとに付き外れする状態クラス。落とさないと取得結果が安定しない。
      dropClasses: content.dropClasses || [],
      // 埋め込みURLから落とすクエリ。読み込みごとに変わる値を除いて決定的にする。
      dropQueryParams: content.dropQueryParams || [],
      // タイトル末尾のサイト名（「… - WEBCOACH」など）を落とすための正規表現。
      titleStripPattern: content.titleStripPattern || null,
    },
    auth: {
      loginUrlPatterns: (parsed.auth && parsed.auth.loginUrlPatterns) || DEFAULT_LOGIN_URL_PATTERNS,
    },
    courses: parsed.courses.map((course) => {
      if (!course || !course.slug) throw new Error('courses の各要素には slug が必要です。');
      if (!Array.isArray(course.urls)) throw new Error(`courses[${course.slug}].urls が配列ではありません。`);
      const { slug, changed } = normalizeCourseSlug(course.slug);
      if (changed) {
        process.stderr.write(
          `[warn] コース slug を正規化しました: ${JSON.stringify(course.slug)} -> ${slug}\n`
        );
      }
      // 重複 URL は入力順を保ったまま 1 件に畳む。
      const urls = Array.from(new Set(course.urls.map((url) => String(url).trim()).filter(Boolean)));
      return { slug, urls };
    }),
  };
}

/** storageState の場所を決める。環境変数はパスの上書きだけに使う（値は秘密情報ではない）。 */
function resolveStorageState({ config, configDir, toolDir, override }) {
  const candidate =
    override || process.env.CLIPKIT_STORAGE_STATE || config.storageState || null;
  if (!candidate) {
    let host = 'clipkit';
    try {
      host = new URL(config.baseUrl).host;
    } catch (error) {
      /* baseUrl は loadConfig で検証済み */
    }
    return path.join(toolDir, '.auth', `${host}.json`);
  }
  return path.isAbsolute(candidate) ? candidate : path.resolve(configDir, candidate);
}

// ---------------------------------------------------------------------------
// 1ページの取得
// ---------------------------------------------------------------------------

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

/** 1回分のナビゲーション＋抽出。リトライは呼び出し側が担当する。 */
async function loadAndExtract({ context, url, config, debug }) {
  const page = await context.newPage();
  page.setDefaultTimeout(NAVIGATION_TIMEOUT_MS);

  try {
    let response;
    try {
      response = await page.goto(url, { waitUntil: 'networkidle', timeout: NAVIGATION_TIMEOUT_MS });
    } catch (error) {
      // networkidle は計測タグ等で成立しないことがある。domcontentloaded で再挑戦する。
      response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: NAVIGATION_TIMEOUT_MS,
      });
    }

    const status = response ? response.status() : 0;
    if (status === 401 || status === 403) {
      throw new AuthError(`HTTP ${status}: 認証が切れています (${url})`);
    }
    if (status >= 500) {
      throw new PageError(`HTTP ${status}`, { retryable: true });
    }
    if (status >= 400) {
      throw new PageError(`HTTP ${status}`, { retryable: false });
    }

    const loginWall = await detectLoginWall(page, config.auth.loginUrlPatterns, url);
    if (loginWall) throw new AuthError(loginWall);

    // 本文セレクタが出るまで少し待つ。出なくてもフォールバック抽出があるので致命的ではない。
    if (config.content.include.length > 0) {
      try {
        await page.waitForSelector(config.content.include.join(', '), { timeout: 5000 });
      } catch (error) {
        /* フォールバック抽出に任せる */
      }
    }

    // page.evaluate は Playwright の既定タイムアウトの対象外で、ページ内スクリプトが
    // 固まると永久に待ち続ける。実際に1ページで全体が数時間停止したので、必ず上限を掛ける。
    //
    // スクロールは遅延読み込みを起こすための手段にすぎない。間に合わなくても本文は取れるので、
    // ここで失敗させずに警告だけ出して抽出へ進む（画像が数枚欠ける可能性は検査で拾える）。
    try {
      await withTimeout(page.evaluate(autoScrollInPage), SCROLL_TIMEOUT_MS, 'ページ末尾までのスクロール');
    } catch (error) {
      process.stderr.write(`[warn] ${url}: ${error.message}。スクロールを打ち切って抽出に進みます\n`);
    }

    const extracted = await withTimeout(page.evaluate(extractInPage, {
      include: config.content.include,
      exclude: config.content.exclude,
      allowedTags: config.content.allowedTags,
      titleSelectors: config.content.titleSelectors,
      dropClasses: config.content.dropClasses,
      dropQueryParams: config.content.dropQueryParams,
      allowedAttributes: config.content.attributes,
      allowedEmbedHosts: config.content.allowedEmbedHosts,
      downloadMediaHosts: config.content.downloadMediaHosts,
      mediaPlaceholderPrefix: MEDIA_PLACEHOLDER_PREFIX,
      mediaPlaceholderSuffix: MEDIA_PLACEHOLDER_SUFFIX,
      baseUrl: config.baseUrl,
      placeholderPrefix: IMAGE_PLACEHOLDER_PREFIX,
      placeholderSuffix: IMAGE_PLACEHOLDER_SUFFIX,
      debug,
    }), EXTRACT_TIMEOUT_MS, '本文抽出');

    if (!extracted.html || extracted.html.trim().length === 0) {
      throw new PageError('本文を抽出できませんでした（HTML が空）', { retryable: false });
    }

    return extracted;
  } finally {
    await page.close().catch(() => {});
  }
}

/** リトライ付きの取得。5xx とタイムアウトのみ再試行し、4xx は即諦める。 */
async function loadWithRetry({ context, url, config, debug, log }) {
  let lastError = null;

  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt += 1) {
    try {
      const extracted = await loadAndExtract({ context, url, config, debug });
      return { extracted, attempts: attempt };
    } catch (error) {
      if (error instanceof AuthError) throw error;

      const retryable =
        error instanceof PageError ? error.retryable : /timeout|net::|ERR_/i.test(error.message);
      lastError = error;

      if (!retryable || attempt > RETRY_DELAYS_MS.length) break;

      const delay = RETRY_DELAYS_MS[attempt - 1];
      log(`  retry ${attempt}/${RETRY_DELAYS_MS.length} (${delay}ms 後): ${error.message}`);
      await sleep(delay);
    }
  }

  throw new PageError(lastError ? lastError.message : '不明なエラー');
}

// ---------------------------------------------------------------------------
// コース単位の処理
// ---------------------------------------------------------------------------

function printExtractionDebug(url, extracted) {
  const lines = [`[debug] ${url}`, `  extractedBy: ${extracted.extractedBy}`];
  for (const candidate of extracted.debug.includeCandidates) {
    lines.push(
      `  include ${candidate.matched ? 'HIT ' : 'miss'} ${candidate.selector}` +
        (candidate.matched ? ` (${candidate.element}, text=${candidate.textLength})` : '') +
        (candidate.error ? ` [${candidate.error}]` : '')
    );
  }
  for (const candidate of extracted.debug.fallbackCandidates) {
    lines.push(`  fallback ${candidate.element} score=${candidate.score} text=${candidate.textLength}`);
  }
  lines.push(
    `  removedByExclude=${extracted.debug.removedByExclude} unwrapped=${extracted.debug.unwrapped} ` +
      `images=${extracted.images.length} embeds=${extracted.embeds.length} ` +
      `media=${extracted.media.length} title="${extracted.selectedTitle || extracted.headingTitle || extracted.documentTitle}"`
  );
  process.stderr.write(`${lines.join('\n')}\n`);
}

/** 入力順に slug を決める。既存 manifest の割り当てを常に優先し、再実行で名前が変わらないようにする。 */
function assignSlugs({ urls, existingByUrl, slugSource }) {
  const taken = new Set();
  for (const page of existingByUrl.values()) {
    if (page && page.slug) taken.add(page.slug);
  }

  const assignments = new Map();
  urls.forEach((url, index) => {
    const existing = existingByUrl.get(url);
    if (existing && existing.slug) {
      assignments.set(url, existing.slug);
      return;
    }
    // slugSource='title' のときは取得後にタイトルから決めるので、ここでは予約しない。
    if (slugSource === 'title') return;
    assignments.set(url, buildPageSlug({ url, index, taken }));
  });

  return { assignments, taken };
}

async function processCourse({ context, config, course, options, toolDir, outDir, runStartedAt, log }) {
  const courseDir = path.join(outDir, course.slug);
  const htmlDir = path.join(courseDir, 'html');
  const imagesDir = path.join(courseDir, 'images');
  const mediaDir = path.join(courseDir, 'media');
  ensureDir(htmlDir);
  ensureDir(imagesDir);

  const existingManifest = readManifest(courseDir);
  const existingByUrl = indexPagesByUrl(existingManifest);

  let urls = course.urls;
  if (options.limit && options.limit > 0) urls = urls.slice(0, options.limit);

  const { assignments, taken } = assignSlugs({
    urls,
    existingByUrl,
    slugSource: options.slugSource,
  });

  log(`\n=== ${course.slug} (${urls.length} ページ) ===`);

  const stats = {
    ok: 0, unchanged: 0, failed: 0,
    imagesDownloaded: 0, imagesFailed: 0,
    mediaDownloaded: 0, mediaFailed: 0,
  };
  const entries = new Array(urls.length);
  const state = { authError: null };

  async function handleUrl(url, index) {
    if (state.authError) return null;

    const previous = existingByUrl.get(url) || null;
    const label = `[${index + 1}/${urls.length}]`;

    // 1ページに掛ける総時間の上限。何かが固まっても、全体を止めずに次のページへ進む。
    const doPage = async () => {
      const { extracted, attempts } = await loadWithRetry({
        context,
        url,
        config,
        debug: options.debug,
        log,
      });

      if (options.debug) printExtractionDebug(url, extracted);

      const title = stripTitleSuffix(
        extracted.selectedTitle || extracted.headingTitle || extracted.documentTitle || url,
        config.content.titleStripPattern
      );
      const slug =
        assignments.get(url) ||
        buildPageSlug({ title, url, index, taken });
      assignments.set(url, slug);

      const imageResults = await downloadImages({
        request: context.request,
        imagesDir,
        sourceUrls: extracted.images,
        previousImages: previous ? previous.images : [],
        force: options.force,
      });
      stats.imagesDownloaded += imageResults.filter((image) => image.status === 'ok').length;
      stats.imagesFailed += imageResults.filter((image) => image.status === 'failed').length;

      const mediaResults = await downloadMediaFiles({
        request: context.request,
        mediaDir,
        sourceUrls: extracted.mediaDownloads || [],
        previousMediaFiles: previous ? previous.mediaFiles : [],
        force: options.force,
      });
      stats.mediaDownloaded += mediaResults.filter((m) => m.status === 'ok').length;
      stats.mediaFailed += mediaResults.filter((m) => m.status === 'failed').length;

      const withImages = rewriteImagePlaceholders({
        html: extracted.html,
        images: imageResults,
        prefix: IMAGE_PLACEHOLDER_PREFIX,
        suffix: IMAGE_PLACEHOLDER_SUFFIX,
      });
      const bodyHtml = rewriteMediaPlaceholders({
        html: withImages,
        mediaFiles: mediaResults,
        prefix: MEDIA_PLACEHOLDER_PREFIX,
        suffix: MEDIA_PLACEHOLDER_SUFFIX,
      });

      const contentHash = `sha256:${sha256(bodyHtml)}`;
      const contentLength = textLengthOf(bodyHtml);

      // 退行ガード。セッション切れでサイトのフッターだけを掴んでしまうような場合、
      // 「取得は成功したが中身が激減した」状態になる。ログイン画面の検知だけでは
      // すり抜けるので、前回の結果と比べて明らかに劣化していたら失敗として扱い、
      // 既存ファイルを上書きしない。
      if (previous && previous.status === 'ok' && !options.allowShrink) {
        const previousLength = previous.contentLength || 0;
        if (previousLength >= 500 && contentLength < previousLength * 0.5) {
          throw new PageError(
            `本文が前回より大幅に減少（${previousLength} → ${contentLength}字）。既存ファイルを保護しました` +
              '（意図した削減なら --allow-shrink を付けて再実行）'
          );
        }
        if (/^fallback/.test(extracted.extractedBy) && /^selector:/.test(previous.extractedBy || '')) {
          throw new PageError(
            `本文コンテナを見つけられずフォールバック抽出になりました（前回: ${previous.extractedBy}）。` +
              '既存ファイルを保護しました'
          );
        }
      }

      const htmlPath = `html/${slug}.html`;
      const htmlFile = path.join(courseDir, 'html', `${slug}.html`);
      const unchanged =
        !options.force &&
        previous &&
        previous.contentHash === contentHash &&
        previous.htmlPath === htmlPath &&
        // タイトルは本文ではなく <title> とmetaに入るため、本文が同じでも
        // タイトルだけ変わることがある。その場合もファイルを書き直す。
        previous.title === title &&
        fs.existsSync(htmlFile);

      const fetchedAt = unchanged ? previous.fetchedAt || runStartedAt : runStartedAt;

      if (!unchanged) {
        writeFileAtomic(
          htmlFile,
          wrapDocument({ title, sourceUrl: url, fetchedAt, bodyHtml }),
          'utf8'
        );
      }

      if (unchanged) stats.unchanged += 1;
      else stats.ok += 1;

      log(
        `${label} ${unchanged ? 'unchanged' : 'saved    '} ${htmlPath}  ` +
          `(images ${imageResults.length}, ${extracted.extractedBy}${attempts > 1 ? `, ${attempts} attempts` : ''})`
      );

      return {
        url,
        title,
        slug,
        htmlPath,
        status: 'ok',
        extractedBy: extracted.extractedBy,
        // 教材が持っていた CSS の保存先。移行先で見た目を再現するために使う。
        stylePaths: saveStyles(courseDir, extracted.styles),
        contentHash,
        contentLength,
        fetchedAt,
        error: null,
        // manifest には 'cached' を残さない。値が揺れると再実行で差分が出てしまう。
        images: imageResults.map((image) => ({
          sourceUrl: image.sourceUrl,
          path: image.path,
          status: image.status === 'failed' ? 'failed' : 'ok',
          error: image.error || null,
        })),
        embeds: extracted.embeds,
        // 元URLのまま残した動画・音声。
        media: extracted.media,
        // ダウンロードして手元に取り込んだ動画・音声。
        mediaFiles: mediaResults.map((m) => ({
          sourceUrl: m.sourceUrl,
          path: m.path,
          status: m.status === 'failed' ? 'failed' : 'ok',
          bytes: m.bytes || 0,
          error: m.error || null,
        })),
        internalLinks: extracted.internalLinks,
      };
    };

    try {
      return await withTimeout(doPage(), options.pageDeadlineMs, `ページ処理 ${url}`);
    } catch (error) {
      if (error instanceof AuthError) {
        state.authError = error;
        return null;
      }

      stats.failed += 1;
      log(`${label} FAILED    ${url}  (${error.message})`);

      // 失敗しても前回の成功結果は残す。status と error だけ更新する。
      const fallbackSlug =
        assignments.get(url) ||
        (previous && previous.slug) ||
        sanitizeSegment(identifierFromUrl(url)) ||
        `page-${index + 1}`;

      return {
        ...(previous || {}),
        url,
        title: (previous && previous.title) || null,
        slug: fallbackSlug,
        htmlPath: (previous && previous.htmlPath) || null,
        status: 'failed',
        contentHash: (previous && previous.contentHash) || null,
        contentLength: (previous && previous.contentLength) || null,
        fetchedAt: (previous && previous.fetchedAt) || null,
        error: error.message,
        images: (previous && previous.images) || [],
        embeds: (previous && previous.embeds) || [],
        media: (previous && previous.media) || [],
        mediaFiles: (previous && previous.mediaFiles) || [],
        stylePaths: (previous && previous.stylePaths) || [],
        internalLinks: (previous && previous.internalLinks) || [],
      };
    }
  }

  /** 途中経過の manifest を書く。長いコースの途中で落ちても、進捗を失わないため。 */
  const buildManifest = (pages) => ({
    version: MANIFEST_VERSION,
    courseSlug: course.slug,
    baseUrl: config.baseUrl,
    generatedAt: runStartedAt,
    pages: mergePages(existingManifest ? existingManifest.pages : [], pages),
    failures: pages.filter((p) => p.status === 'failed').map((p) => ({ url: p.url, error: p.error })),
  });

  // 並列数を絞り、ページごとに間隔を空けて相手サーバーへの負荷を抑える。
  let cursor = 0;
  let completed = 0;
  const workerCount = Math.max(1, Math.min(options.concurrency, urls.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (!state.authError) {
      const index = cursor;
      cursor += 1;
      if (index >= urls.length) return;
      entries[index] = await handleUrl(urls[index], index);

      completed += 1;
      if (completed % MANIFEST_FLUSH_EVERY === 0) {
        const soFar = entries.filter(Boolean);
        writeManifest(courseDir, buildManifest(soFar), existingManifest, runStartedAt);
        log(`  … 中間保存: ${soFar.length}/${urls.length} ページ分を manifest に記録`);
      }

      if (cursor < urls.length) await sleep(options.delayMs);
    }
  });
  await Promise.all(workers);

  const freshPages = entries.filter(Boolean);
  const failures = freshPages
    .filter((page) => page.status === 'failed')
    .map((page) => ({ url: page.url, error: page.error }));

  const manifest = {
    version: MANIFEST_VERSION,
    courseSlug: course.slug,
    baseUrl: config.baseUrl,
    generatedAt: runStartedAt,
    pages: mergePages(existingManifest ? existingManifest.pages : [], freshPages),
    failures,
  };

  const written = writeManifest(courseDir, manifest, existingManifest, runStartedAt);

  // 認証切れで中断した場合も、ここまでに書いた HTML と manifest は整合させてから止める。
  // 失敗一覧は「全URLを試した結果」ではないので上書きしない（前回の一覧を残す）。
  if (state.authError) {
    log(
      `--- ${course.slug}: 認証切れで中断（saved ${stats.ok} / unchanged ${stats.unchanged}）` +
        ` / manifest ${written.changed ? 'updated' : 'no change'}`
    );
    throw state.authError;
  }

  const failureFiles = writeFailures(courseDir, failures);

  log(
    `--- ${course.slug}: saved ${stats.ok} / unchanged ${stats.unchanged} / failed ${stats.failed}` +
      ` / images ${stats.imagesDownloaded}${stats.imagesFailed ? ` (失敗 ${stats.imagesFailed})` : ''}` +
      (stats.mediaDownloaded || stats.mediaFailed
        ? ` / media ${stats.mediaDownloaded}${stats.mediaFailed ? ` (失敗 ${stats.mediaFailed})` : ''}`
        : '') +
      ` / manifest ${written.changed ? 'updated' : 'no change'}`
  );

  let zipPath = null;
  if (options.zip) {
    zipPath = await createZip({ courseDir, outPath: options.zipOut || null });
    log(`--- ${course.slug}: zip -> ${zipPath}`);
  }

  return { course: course.slug, courseDir, stats, failures, failureFiles, zipPath };
}

// ---------------------------------------------------------------------------
// エントリポイント
// ---------------------------------------------------------------------------

async function runExport(options) {
  const toolDir = options.toolDir;
  const configPath = path.resolve(options.config);
  const configDir = path.dirname(configPath);
  const config = loadConfig(configPath);

  const storageStatePath = resolveStorageState({
    config,
    configDir,
    toolDir,
    override: options.storageState,
  });

  if (!fs.existsSync(storageStatePath)) {
    throw new Error(
      `認証状態が見つかりません: ${storageStatePath}\n` +
        '  先に手動ログインしてください:\n' +
        `    node src/cli.js login --base-url ${config.baseUrl}`
    );
  }

  const outDir = path.isAbsolute(config.outDir)
    ? config.outDir
    : path.resolve(configDir, config.outDir);

  const courses = options.courseFilter
    ? config.courses.filter((course) => course.slug === options.courseFilter)
    : config.courses;

  if (courses.length === 0) {
    throw new Error(
      `--course ${options.courseFilter} に一致するコースが設定にありません。` +
        `（設定にあるのは: ${config.courses.map((course) => course.slug).join(', ')}）`
    );
  }

  const log = (message) => process.stdout.write(`${message}\n`);
  log(`config      : ${configPath}`);
  log(`storageState: ${storageStatePath}`);
  log(`outDir      : ${outDir}`);
  log(`courses     : ${courses.map((course) => course.slug).join(', ')}`);

  const { chromium } = require('playwright');
  const runStartedAt = new Date().toISOString();

  const results = [];
  // ブラウザはコースごとに作り直す。数百ページを1つのブラウザで処理し続けると
  // メモリが膨らみ、ページが応答しなくなることがあった。
  let browser = null;
  let context = null;
  const closeBrowser = async () => {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    context = null;
    browser = null;
  };

  try {
    for (const course of courses) {
      /* eslint-disable no-await-in-loop -- コースは直列に処理して進捗を読みやすくする */
      await closeBrowser();
      browser = await chromium.launch({ headless: !options.headed });
      context = await browser.newContext({
        storageState: storageStatePath,
        viewport: { width: 1440, height: 1000 },
      });

      results.push(
        await processCourse({
          context,
          config,
          course,
          options,
          toolDir,
          outDir,
          runStartedAt,
          log,
        })
      );
      /* eslint-enable no-await-in-loop */
    }
  } catch (error) {
    if (error instanceof AuthError) {
      throw new Error(
        `${error.message}\n` +
          '  認証が切れています。手動ログインをやり直してください:\n' +
          `    node src/cli.js login --base-url ${config.baseUrl}\n` +
          '  （ログイン画面のHTMLを保存してしまわないよう、途中で全体を中断しました）'
      );
    }
    throw error;
  } finally {
    await closeBrowser();
  }

  // --- 失敗一覧 -------------------------------------------------------------
  const allFailures = results.flatMap((result) =>
    result.failures.map((failure) => ({ course: result.course, ...failure }))
  );

  log('\n================ 取得結果 ================');
  for (const result of results) {
    log(
      `${result.course.padEnd(28)} saved ${String(result.stats.ok).padStart(4)}` +
        `  unchanged ${String(result.stats.unchanged).padStart(4)}` +
        `  failed ${String(result.stats.failed).padStart(4)}`
    );
  }

  if (allFailures.length > 0) {
    process.stderr.write(`\n---------------- 失敗 ${allFailures.length} 件 ----------------\n`);
    for (const failure of allFailures) {
      process.stderr.write(`${failure.course}\t${failure.url}\t${failure.error}\n`);
    }
    for (const result of results) {
      if (result.failureFiles.txtFile) {
        process.stderr.write(`再実行用の URL 一覧: ${result.failureFiles.txtFile}\n`);
      }
    }
  }

  return { results, failureCount: allFailures.length };
}

module.exports = { runExport, loadConfig, resolveStorageState, AuthError, PageError };
