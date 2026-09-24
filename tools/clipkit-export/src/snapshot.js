/**
 * 教材ページを「元ページのフルHTML」として保存する。
 *
 * `export` が本文だけを抽出するのに対し、こちらは `<!DOCTYPE>` から `</html>` まで、
 * テーマCSS込みで見た目が再現できる形を作る。エンジニアへの受け渡し用。
 *
 * 効率の要は **画像を取り直さないこと**。materials/source の各コースの images（700MB超）を
 * 資産ストアの種にするので、ページのHTMLとCSSだけを取りに行けばよい。
 *
 * 出力:
 *   materials/handoff/_assets/<hash>.<ext>   CSS・画像・フォント（コース横断で1本化）
 *   materials/handoff/assets.json            元URL → ファイル名
 *   materials/handoff/<course>/html/<slug>.html   フルHTML（資産はローカル相対パス）
 *   materials/handoff/<course>/raw/<slug>.html    JS実行前のサーバー出力そのまま
 *   materials/handoff/<course>/media/<file>       既存 materials/source からの流用
 *   materials/handoff/<course>/manifest.json
 */

const fs = require('fs');
const path = require('path');

const {
  NAVIGATION_TIMEOUT_MS,
  RETRY_DELAYS_MS,
  SCROLL_TIMEOUT_MS,
  EXTRACT_TIMEOUT_MS,
  AuthError,
  PageError,
  sleep,
  withTimeout,
  textLengthOf,
  stripTitleSuffix,
  detectLoginWall,
  isRetryable,
} = require('./browser');
const { autoScrollInPage } = require('./extract');
const {
  RESOURCE_PLACEHOLDER_PREFIX,
  RESOURCE_PLACEHOLDER_SUFFIX,
  neutralizeInPage,
} = require('./snapshot-dom');
const { AssetStore, normalizeUrl, kindOf, pickExtension } = require('./asset-store');
const { findCssReferences, rewriteCss } = require('./css-rewrite');
const { loadConfig, resolveStorageState } = require('./export');
const {
  MANIFEST_VERSION,
  ensureDir,
  indexPagesByUrl,
  mergePages,
  readManifest,
  writeFailures,
  writeFileAtomic,
  writeTextIfChanged,
  writeManifest,
} = require('./manifest');
const { buildPageSlug, identifierFromUrl, sanitizeSegment } = require('./slug');

/** 出現アニメーション待ちで透明になっている要素。JS を落とすので強制的に見せる。 */
const DEFAULT_FORCE_VISIBLE = [
  '[data-aos]', '.reveal', '.wow', '.fade-in', '.animate__animated', '.js-reveal',
];

/** CSS の @import をどこまで辿るか。循環と暴走を止める。 */
const MAX_CSS_DEPTH = 5;

/** 何ページごとに資産の索引を書き出すか。数千件あるので毎ページは重い。 */
const MANIFEST_FLUSH_EVERY = 25;

/** これより大きいレスポンスは読み取らない。CSS も画像もこの大きさにはならない。 */
const MAX_BODY_BYTES = 8 * 1024 * 1024;

/** レスポンス本体の読み取りを待つ上限。1件が詰まっても、ページ全体を道連れにしない。 */
const BODY_DRAIN_TIMEOUT_MS = 20000;

/**
 * 手元に落とさないホスト。埋め込みプレイヤーは資産を配っているわけではないので、
 * 絶対URLのまま残してオンラインで辿れるようにする。
 */
const EXTERNAL_EMBED_HOSTS = /(?:youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com|figma\.com|docs\.google\.com)/i;

// ---------------------------------------------------------------------------
// 1ページ分のブラウザ操作
// ---------------------------------------------------------------------------

/** 走り出しているレスポンス読み取りを待つ。上限を超えたら諦めて先へ進む。 */
async function drainPending(pending) {
  if (pending.size === 0) return;
  await Promise.race([
    Promise.allSettled([...pending]),
    new Promise((resolve) => { setTimeout(resolve, BODY_DRAIN_TIMEOUT_MS).unref?.(); }),
  ]);
}

/**
 * ページを開いて、整形済みHTMLと「そのページで実際に流れたレスポンス」を返す。
 *
 * レスポンス本体はハンドラの中で読み始め、**page を閉じる前に必ず待ち切る**。
 * 待たずに閉じると Target closed で握りつぶされ、資産が黙って欠ける。
 */
async function capturePage({ context, url, config, options }) {
  const page = await context.newPage();
  page.setDefaultTimeout(NAVIGATION_TIMEOUT_MS);

  /** 最終URL → { buffer, contentType } */
  const bodies = new Map();
  /** 要求URL → 最終URL（リダイレクトの吸収） */
  const finalUrls = new Map();
  const pending = new Set();

  const onResponse = (response) => {
    const finalUrl = normalizeUrl(response.url());

    // リダイレクト鎖の全URLを最終URLへ結びつける。
    // HTML が指すのは鎖の先頭で、3xx 自体の body は取れない。
    let hop = response.request().redirectedFrom();
    while (hop) {
      finalUrls.set(normalizeUrl(hop.url()), finalUrl);
      hop = hop.redirectedFrom();
    }

    const status = response.status();
    if (status >= 300 && status < 400) return;
    if (!response.ok()) return;
    if (bodies.has(finalUrl)) return;

    // 動画・音声と、極端に大きいものは読まない。
    // `response.body()` は本体を全部受け取るまで返らないので、20MB の mp4 を掴むと
    // ページ全体が待たされる（実際にこれで1ページ5分の上限を超えた）。
    // 動画は materials/source から流用するので、ここで持つ必要がない。
    const headers = response.headers();
    const contentType = headers['content-type'] || '';
    const contentLength = Number.parseInt(headers['content-length'] || '0', 10);
    if (/^(video|audio)\//i.test(contentType)) return;
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return;

    const task = response
      .body()
      .then((buffer) => {
        if (buffer && buffer.length > 0) {
          bodies.set(finalUrl, {
            buffer,
            contentType: response.headers()['content-type'] || null,
          });
        }
      })
      .catch(() => {
        /* キャッシュ由来・破棄済みなどで読めないことがある。後で individually 取り直す */
      })
      .finally(() => pending.delete(task));
    pending.add(task);
  };

  page.on('response', onResponse);

  try {
    // 一段で開く。export.js のような「networkidle 失敗 → 再 goto」はページを2回読み込み、
    // レスポンスが2周流れて body が取れないものが混ざるため、スナップショットでは使わない。
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT_MS,
    });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

    const status = response ? response.status() : 0;
    if (status === 401 || status === 403) throw new AuthError(`HTTP ${status}: 認証が切れています (${url})`);
    if (status >= 500) throw new PageError(`HTTP ${status}`, { retryable: true });
    if (status >= 400) throw new PageError(`HTTP ${status}`, { retryable: false });

    const loginWall = await detectLoginWall(page, config.auth.loginUrlPatterns, url);
    if (loginWall) throw new AuthError(loginWall);

    // 退行ガードの1段目。本文コンテナが無いページは、教材ではない何かを掴んでいる。
    if (config.content.include.length > 0) {
      await page.waitForSelector(config.content.include.join(', '), { timeout: 5000 }).catch(() => {});
      const found = await page.locator(config.content.include.join(', ')).count();
      if (found === 0) {
        throw new PageError('本文コンテナが見つかりません（教材ページではない可能性）');
      }
    }

    // 遅延読み込みを起こす。間に合わなくても本文は取れるので失敗にはしない。
    try {
      await withTimeout(page.evaluate(autoScrollInPage), SCROLL_TIMEOUT_MS, 'ページ末尾までのスクロール');
    } catch (error) {
      process.stderr.write(`[warn] ${url}: ${error.message}。スクロールを打ち切ります\n`);
    }

    // 整形より前に撮る。neutralize は参照をトークンに差し替えるので、
    // その後に撮るとCSSの外れた姿が残ってしまう（比較の基準にならない）。
    let screenshot = null;
    if (options.screenshot) {
      screenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    }

    const captured = await withTimeout(
      page.evaluate(neutralizeInPage, {
        placeholderPrefix: RESOURCE_PLACEHOLDER_PREFIX,
        placeholderSuffix: RESOURCE_PLACEHOLDER_SUFFIX,
        forceVisibleSelectors: config.content.forceVisibleSelectors || DEFAULT_FORCE_VISIBLE,
      }),
      EXTRACT_TIMEOUT_MS,
      'DOMの整形'
    );

    if (!captured.html || captured.html.trim().length === 0) {
      throw new PageError('HTML が空でした', { retryable: false });
    }

    // 閉じる前に、走り出しているレスポンス読み取りを待つ。待たずに閉じると
    // Target closed で握りつぶされ、資産が黙って欠ける。
    // ただし待ちは打ち切れるようにする。1件が詰まってページ全体を落とすほうが損。
    await drainPending(pending);

    return { ...captured, bodies, finalUrls, screenshot, pageUrl: page.url() };
  } finally {
    page.off('response', onResponse);
    await drainPending(pending);
    await page.close().catch(() => {});
  }
}

/** リトライ付き。5xx とタイムアウトだけ再試行する（export.js と同じ方針）。 */
async function captureWithRetry({ context, url, config, options, log }) {
  let lastError = null;
  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt += 1) {
    try {
      const captured = await capturePage({ context, url, config, options });
      return { captured, attempts: attempt };
    } catch (error) {
      if (error instanceof AuthError) throw error;
      lastError = error;
      if (!isRetryable(error) || attempt > RETRY_DELAYS_MS.length) break;
      const delay = RETRY_DELAYS_MS[attempt - 1];
      log(`  retry ${attempt}/${RETRY_DELAYS_MS.length} (${delay}ms 後): ${error.message}`);
      await sleep(delay);
    }
  }
  throw new PageError(lastError ? lastError.message : '不明なエラー');
}

// ---------------------------------------------------------------------------
// 資産の解決
// ---------------------------------------------------------------------------

/**
 * ページ1枚分の資産解決。ブラウザが実際に受け取った本体を第一候補にし、
 * 取れていなければ APIRequestContext で取り直す（ログイン Cookie は共有される）。
 */
function createResolver({ context, store, bodies, finalUrls, mediaByUrl, courseDir, log }) {
  const visitingCss = new Set();

  const lookupBody = async (url) => {
    const key = normalizeUrl(url);
    const finalKey = finalUrls.get(key) || key;
    const fromPage = bodies.get(finalKey) || bodies.get(key);
    if (fromPage) return { ...fromPage, finalUrl: finalKey };

    // キャッシュから出たなどでブラウザ経由では取れなかったもの。単体で取り直す。
    try {
      const response = await context.request.get(url, { timeout: 30000 });
      if (!response.ok()) return { error: `HTTP ${response.status()}` };
      const buffer = await response.body();
      if (!buffer || buffer.length === 0) return { error: 'empty response body' };
      return {
        buffer,
        contentType: response.headers()['content-type'] || null,
        finalUrl: normalizeUrl(response.url()),
      };
    } catch (error) {
      return { error: `request error: ${error.message}` };
    }
  };

  /** CSS は中の参照を先に確保してから書き換えて格納する。@import は再帰する。 */
  const ensureCss = async (url, buffer, contentType, finalUrl, depth) => {
    const text = buffer.toString('utf8');
    const baseUrl = finalUrl || url;

    if (depth < MAX_CSS_DEPTH) {
      for (const reference of findCssReferences(text)) {
        let absolute;
        try {
          absolute = new URL(reference.value.trim(), baseUrl).toString();
        } catch (error) {
          continue;
        }
        if (/^(data:|blob:|about:|javascript:|#)/i.test(reference.value.trim())) continue;
        if (visitingCss.has(normalizeUrl(absolute))) continue;
        /* eslint-disable no-await-in-loop -- 参照は直列に確保する。並列にしても相手が同じ */
        await ensureAsset(absolute, depth + 1);
        /* eslint-enable no-await-in-loop */
      }
    }

    const rewritten = rewriteCss(text, {
      baseUrl,
      // CSS は _assets 直下に置くので、同じ階層のファイル名をそのまま書けばよい。
      resolve: (absolute) => store.nameOf(absolute),
    });
    for (const missing of rewritten.unresolved) store.markUnresolved(missing, '未取得');

    return store.putText(url, buffer, rewritten.css, '.css');
  };

  /**
   * 資産を1件確保して、`_assets/` 内のファイル名を返す。落とせなければ null。
   */
  const ensureAsset = async (url, depth = 0) => {
    const key = normalizeUrl(url);
    const existing = store.nameOf(key);
    if (existing) return existing;
    if (store.unresolved.has(key)) return null;
    if (visitingCss.has(key)) return null;

    const body = await lookupBody(key);
    if (!body || body.error) {
      store.markUnresolved(key, (body && body.error) || '取得できませんでした');
      return null;
    }

    const ext = pickExtension(key, body.contentType);
    if (kindOf(ext, body.contentType) === 'css') {
      visitingCss.add(key);
      try {
        return await ensureCss(key, body.buffer, body.contentType, body.finalUrl, depth);
      } finally {
        visitingCss.delete(key);
      }
    }

    const name = await store.put(key, body.buffer, body.contentType);
    if (!name) store.markUnresolved(key, '空のレスポンス');
    return name;
  };

  /** 動画・音声は既存 materials/source から流用する。取り直さない。 */
  const ensureMedia = (url) => {
    const source = mediaByUrl.get(normalizeUrl(url));
    if (!source || !fs.existsSync(source)) return null;
    const mediaDir = path.join(courseDir, 'media');
    const dest = path.join(mediaDir, path.basename(source));
    if (!fs.existsSync(dest)) {
      ensureDir(mediaDir);
      fs.copyFileSync(source, dest);
    }
    return `../media/${path.basename(source)}`;
  };

  return { ensureAsset, ensureMedia, lookupBody };
}

// ---------------------------------------------------------------------------
// 1ページ分の組み立て
// ---------------------------------------------------------------------------

/** `<style>` ブロックの中身を css-rewrite に通す。ここは HTML エスケープされないので安全に扱える。 */
async function rewriteInlineStyleBlocks({ html, baseUrl, resolver, store }) {
  const blocks = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
  if (blocks.length === 0) return { html, unresolved: [] };

  // 先に参照を確保してから、同期的に書き換える。
  for (const block of blocks) {
    for (const reference of findCssReferences(block[1])) {
      const value = reference.value.trim();
      if (/^(data:|blob:|about:|javascript:|#)/i.test(value) || value.length === 0) continue;
      let absolute;
      try {
        absolute = new URL(value, baseUrl).toString();
      } catch (error) {
        continue;
      }
      /* eslint-disable no-await-in-loop -- 直列で確保する */
      await resolver.ensureAsset(absolute);
      /* eslint-enable no-await-in-loop */
    }
  }

  const unresolved = [];
  let out = '';
  let cursor = 0;
  for (const block of blocks) {
    const start = block.index + block[0].indexOf(block[1]);
    const end = start + block[1].length;
    const rewritten = rewriteCss(block[1], {
      baseUrl,
      resolve: (absolute) => {
        const name = store.nameOf(absolute);
        return name ? `../../_assets/${name}` : null;
      },
    });
    unresolved.push(...rewritten.unresolved);
    out += html.slice(cursor, start) + rewritten.css;
    cursor = end;
  }
  out += html.slice(cursor);
  return { html: out, unresolved };
}

/** トークンを最終的な参照先に差し替える。 */
async function resolveResources({ html, resources, resolver, store }) {
  const unresolved = [];
  let out = html;

  for (let index = 0; index < resources.length; index += 1) {
    const { url, hint } = resources[index];
    const placeholder = `${RESOURCE_PLACEHOLDER_PREFIX}${index}${RESOURCE_PLACEHOLDER_SUFFIX}`;

    let replacement = null;
    if (hint === 'media') {
      replacement = resolver.ensureMedia(url);
    } else if (!EXTERNAL_EMBED_HOSTS.test(url)) {
      /* eslint-disable no-await-in-loop -- 直列に確保する */
      const name = await resolver.ensureAsset(url);
      /* eslint-enable no-await-in-loop */
      if (name) replacement = `../../_assets/${name}`;
    }

    if (!replacement) {
      // 落とせなかったものは絶対URLに戻す。壊れた相対パスより、オンラインで見えるほうがよい。
      // ここでは store に印を付けない（外部埋め込みや動画は「失敗」ではないため。
      // 取得を試みて落とせなかったものは ensureAsset が既に記録している）。
      replacement = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      unresolved.push(url);
    }

    out = out.split(placeholder).join(replacement);
  }

  return { html: out, unresolved };
}

// ---------------------------------------------------------------------------
// コース単位
// ---------------------------------------------------------------------------

/** 既存の取得結果（materials/source）から、slug・本文量・動画の在りかを引く。 */
function readSourceIndex({ sourceDir, courseSlug }) {
  const manifest = readManifest(path.join(sourceDir, courseSlug));
  const byUrl = new Map();
  const mediaByUrl = new Map();
  if (!manifest) return { byUrl, mediaByUrl };

  for (const page of manifest.pages || []) {
    if (!page || !page.url) continue;
    byUrl.set(page.url, page);
    for (const media of page.mediaFiles || []) {
      if (media && media.status === 'ok' && media.path && media.sourceUrl) {
        mediaByUrl.set(normalizeUrl(media.sourceUrl), path.join(sourceDir, courseSlug, media.path));
      }
    }
  }
  return { byUrl, mediaByUrl };
}

async function snapshotCourse({
  context, config, course, options, sourceDir, outDir, store, runStartedAt, log,
}) {
  const courseDir = path.join(outDir, course.slug);
  const htmlDir = path.join(courseDir, 'html');
  const rawDir = path.join(courseDir, 'raw');
  ensureDir(htmlDir);
  ensureDir(rawDir);

  const { byUrl: sourceByUrl, mediaByUrl } = readSourceIndex({ sourceDir, courseSlug: course.slug });
  const existingManifest = readManifest(courseDir);
  const existingByUrl = indexPagesByUrl(existingManifest);

  let urls = course.urls;
  // 特定ページだけ試したいとき（最大ページ・動画つきページの確認や、失敗ページの取り直し）。
  if (options.urlFilter) urls = urls.filter((url) => url.includes(options.urlFilter));
  if (options.limit && options.limit > 0) urls = urls.slice(0, options.limit);

  log(`\n=== ${course.slug} (${urls.length} ページ) ===`);

  const stats = { ok: 0, skipped: 0, failed: 0 };
  const entries = new Array(urls.length);
  const state = { authError: null };
  const taken = new Set([...sourceByUrl.values()].map((page) => page.slug).filter(Boolean));

  async function handleUrl(url, index) {
    if (state.authError) return null;

    const label = `[${index + 1}/${urls.length}]`;
    const source = sourceByUrl.get(url) || null;
    const previous = existingByUrl.get(url) || null;

    // slug は既存の取得結果に合わせる。エンジニアが materials/source と突き合わせられるように。
    const slug =
      (source && source.slug) ||
      (previous && previous.slug) ||
      buildPageSlug({ url, index, taken }) ||
      sanitizeSegment(identifierFromUrl(url)) ||
      `page-${index + 1}`;

    const htmlFile = path.join(htmlDir, `${slug}.html`);
    if (!options.force && previous && previous.status === 'ok' && fs.existsSync(htmlFile)) {
      stats.skipped += 1;
      log(`${label} skipped   html/${slug}.html`);
      return previous;
    }

    const doPage = async () => {
      const { captured, attempts } = await captureWithRetry({ context, url, config, options, log });

      // 退行ガードの2段目。セッション切れで別の何かを掴んでいたら、既存ファイルを守る。
      const capturedLength = textLengthOf(captured.html);
      const sourceLength = (source && source.contentLength) || 0;
      if (sourceLength >= 500 && capturedLength < sourceLength * 0.5) {
        throw new PageError(
          `本文が既存の取得結果より大幅に少ない（${sourceLength} → ${capturedLength}字）。` +
            '既存ファイルを保護しました'
        );
      }

      const resolver = createResolver({
        context,
        store,
        bodies: captured.bodies,
        finalUrls: captured.finalUrls,
        mediaByUrl,
        courseDir,
        log,
      });

      const styled = await rewriteInlineStyleBlocks({
        html: captured.html,
        baseUrl: captured.pageUrl || url,
        resolver,
        store,
      });
      const resolved = await resolveResources({
        html: styled.html,
        resources: captured.resources,
        resolver,
        store,
      });

      const title = stripTitleSuffix(captured.title || url, config.content.titleStripPattern);
      const header =
        `<!-- clipkit-source-url: ${url} -->\n` +
        `<!-- clipkit-fetched-at: ${runStartedAt} -->\n`;
      writeTextIfChanged(htmlFile, resolved.html.replace(/^(<!DOCTYPE[^>]*>\n?)/i, `$1${header}`));

      // JS 実行前のサーバー出力。テンプレート構造を読むにはこちらのほうが早い。
      const rawBody = await resolver.lookupBody(captured.pageUrl || url);
      if (rawBody && rawBody.buffer && !rawBody.error) {
        writeTextIfChanged(path.join(rawDir, `${slug}.html`), rawBody.buffer.toString('utf8'));
      }

      if (captured.screenshot) {
        const shotDir = path.join(courseDir, 'screenshots');
        ensureDir(shotDir);
        writeFileAtomic(path.join(shotDir, `${slug}.live.png`), captured.screenshot);
      }

      const unresolved = [...new Set([...styled.unresolved, ...resolved.unresolved])];
      stats.ok += 1;
      log(
        `${label} saved     html/${slug}.html  ` +
          `(資産 ${captured.resources.length}, 未解決 ${unresolved.length}` +
          `, script ${captured.stats.scripts}除去${attempts > 1 ? `, ${attempts} attempts` : ''})`
      );

      return {
        url,
        title,
        slug,
        // 設定に書いてある URL の並び。一覧の並び順に使う（取り直しても崩れないように）。
        order: course.urls.indexOf(url),
        htmlPath: `html/${slug}.html`,
        rawPath: rawBody && !rawBody.error ? `raw/${slug}.html` : null,
        status: 'ok',
        bytes: Buffer.byteLength(resolved.html, 'utf8'),
        textLength: capturedLength,
        resourceCount: captured.resources.length,
        removedScripts: captured.stats.scripts,
        unresolved,
        fetchedAt: runStartedAt,
        error: null,
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
      return {
        ...(previous || {}),
        url,
        slug,
        status: 'failed',
        error: error.message,
      };
    }
  }

  const buildManifest = (pages) => ({
    version: MANIFEST_VERSION,
    courseSlug: course.slug,
    baseUrl: config.baseUrl,
    generatedAt: runStartedAt,
    kind: 'snapshot',
    pages: mergePages(existingManifest ? existingManifest.pages : [], pages),
    failures: pages.filter((page) => page.status === 'failed').map((page) => ({ url: page.url, error: page.error })),
  });

  // 1ページのコストが export より高いので、毎ページ書き出して進捗を失わないようにする。
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(options.concurrency, urls.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (!state.authError) {
      const index = cursor;
      cursor += 1;
      if (index >= urls.length) return;
      entries[index] = await handleUrl(urls[index], index);

      // 進捗の保存が失敗しても、取得そのものは続ける。
      // ここで例外を投げると Promise.all 経由で全ワーカーが道連れになり、
      // 処理中のページまで「ブラウザが閉じられた」で失われる。
      try {
        writeManifest(courseDir, buildManifest(entries.filter(Boolean)), existingManifest, runStartedAt);
        // 資産の索引は数千件あって書き出しが重いので、毎ページは書かない。
        if (index % MANIFEST_FLUSH_EVERY === 0) store.save();
      } catch (error) {
        log(`  [warn] 進捗の保存に失敗しました（続行します）: ${error.message}`);
      }

      if (cursor < urls.length) await sleep(options.delayMs);
    }
  });
  await Promise.all(workers);

  const freshPages = entries.filter(Boolean);
  const failures = freshPages
    .filter((page) => page.status === 'failed')
    .map((page) => ({ url: page.url, error: page.error }));

  try {
    writeManifest(courseDir, buildManifest(freshPages), existingManifest, runStartedAt);
    store.save();
  } catch (error) {
    log(`  [warn] コース末尾の保存に失敗しました: ${error.message}`);
  }

  if (state.authError) {
    log(`--- ${course.slug}: 認証切れで中断（saved ${stats.ok} / skipped ${stats.skipped}）`);
    throw state.authError;
  }

  const failureFiles = writeFailures(courseDir, failures);
  log(
    `--- ${course.slug}: saved ${stats.ok} / skipped ${stats.skipped} / failed ${stats.failed}`
  );

  return { course: course.slug, courseDir, stats, failures, failureFiles };
}

// ---------------------------------------------------------------------------
// エントリポイント
// ---------------------------------------------------------------------------

async function runSnapshot(options) {
  const configPath = path.resolve(options.config);
  const configDir = path.dirname(configPath);
  const config = loadConfig(configPath);

  const storageStatePath = resolveStorageState({
    config,
    configDir,
    toolDir: options.toolDir,
    override: options.storageState,
  });
  if (!fs.existsSync(storageStatePath)) {
    throw new Error(
      `認証状態が見つかりません: ${storageStatePath}\n` +
        '  先に手動ログインしてください:\n' +
        `    node src/cli.js login --base-url ${config.baseUrl}`
    );
  }

  const sourceDir = path.isAbsolute(config.outDir)
    ? config.outDir
    : path.resolve(configDir, config.outDir);
  const outDir = options.outDir
    ? path.resolve(options.outDir)
    : path.resolve(sourceDir, '..', 'handoff');

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
  log(`sourceDir   : ${sourceDir}`);
  log(`outDir      : ${outDir}`);
  log(`courses     : ${courses.map((course) => course.slug).join(', ')}`);

  ensureDir(outDir);
  const store = new AssetStore({
    assetsDir: path.join(outDir, '_assets'),
    indexFile: path.join(outDir, 'assets.json'),
    imageOptions: { maxWidth: options.maxWidth, quality: options.quality },
    log,
  });
  store.load();

  // --- Pass 1: 取得済み画像を種にする（ブラウザ不要） ------------------------
  if (!options.skipSeed) {
    log('\n--- 既存の取得結果から画像を取り込みます（再ダウンロードしない分の節約）');
    const before = Date.now();
    const seeded = await store.seedFromManifests({
      sourceDir,
      // 今回処理するコースの分だけ。資産は全コース共通なので、
      // 他コースの画像も回を重ねれば揃う（--course での部分実行を軽くするため）。
      courseSlugs: courses.map((course) => course.slug),
      onProgress: (count) => log(`    ${count} 枚…`),
    });
    store.save();
    const mb = (n) => (n / 1024 / 1024).toFixed(1);
    log(
      `    ${seeded} 枚を取り込みました（${mb(store.stats.srcBytes)}MB → ${mb(store.stats.outBytes)}MB` +
        ` / ${Math.round((Date.now() - before) / 1000)}秒）`
    );
  }

  // --- Pass 2: ページのスナップショット ------------------------------------
  const { chromium } = require('playwright');
  const runStartedAt = new Date().toISOString();
  const results = [];

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
      /* eslint-disable no-await-in-loop -- コースは直列に処理する */
      await closeBrowser();
      browser = await chromium.launch({ headless: !options.headed });
      context = await browser.newContext({
        storageState: storageStatePath,
        viewport: { width: 1440, height: 1000 },
      });

      results.push(
        await snapshotCourse({
          context, config, course, options, sourceDir, outDir, store, runStartedAt, log,
        })
      );
      /* eslint-enable no-await-in-loop */
    }
  } catch (error) {
    if (error instanceof AuthError) {
      throw new Error(
        `${error.message}\n` +
          '  認証が切れています。手動ログインをやり直してください:\n' +
          `    node src/cli.js login --base-url ${config.baseUrl}`
      );
    }
    throw error;
  } finally {
    await closeBrowser();
    store.save();
  }

  const allFailures = results.flatMap((result) =>
    result.failures.map((failure) => ({ course: result.course, ...failure }))
  );

  log('\n================ スナップショット結果 ================');
  for (const result of results) {
    log(
      `${result.course.padEnd(20)} saved ${String(result.stats.ok).padStart(4)}` +
        `  skipped ${String(result.stats.skipped).padStart(4)}` +
        `  failed ${String(result.stats.failed).padStart(4)}`
    );
  }
  log(
    `資産: ${store.index.size} 件 / 未解決 ${store.unresolved.size} 件` +
      `（${(store.stats.outBytes / 1024 / 1024).toFixed(1)}MB）`
  );

  if (allFailures.length > 0) {
    process.stderr.write(`\n---------------- 失敗 ${allFailures.length} 件 ----------------\n`);
    for (const failure of allFailures) {
      process.stderr.write(`${failure.course}\t${failure.url}\t${failure.error}\n`);
    }
  }

  return { results, store, outDir, config, failureCount: allFailures.length };
}

module.exports = { runSnapshot, DEFAULT_FORCE_VISIBLE };
