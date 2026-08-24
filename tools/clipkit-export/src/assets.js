/**
 * 本文中の画像をダウンロードし、HTML のプレースホルダを相対パスに書き換える。
 *
 * 取得はブラウザコンテキストの APIRequestContext 経由なので、
 * ログイン済み Cookie が必要な画像もそのまま落とせる。
 */

const fs = require('fs');
const path = require('path');

const { imageFileName, mediaFileName } = require('./slug');
const { writeBufferIfChanged } = require('./manifest');

/**
 * 画像を1件取得して images/ に保存する。
 * 既存 manifest に成功記録があり、実ファイルも残っていれば取得しない（force 時を除く）。
 */
async function downloadImage({ request, imagesDir, sourceUrl, previous, force }) {
  if (!force && previous && previous.status === 'ok' && previous.path) {
    const absolute = path.join(imagesDir, path.basename(previous.path));
    if (fs.existsSync(absolute)) {
      return { sourceUrl, path: previous.path, status: 'cached', error: null };
    }
  }

  let response;
  try {
    response = await request.get(sourceUrl, { timeout: 30000 });
  } catch (error) {
    return { sourceUrl, path: null, status: 'failed', error: `request error: ${error.message}` };
  }

  if (!response.ok()) {
    return { sourceUrl, path: null, status: 'failed', error: `HTTP ${response.status()}` };
  }

  const body = await response.body();
  if (!body || body.length === 0) {
    return { sourceUrl, path: null, status: 'failed', error: 'empty response body' };
  }

  const fileName = imageFileName(sourceUrl, response.headers()['content-type']);
  writeBufferIfChanged(path.join(imagesDir, fileName), body);

  return { sourceUrl, path: `images/${fileName}`, status: 'ok', error: null };
}

/**
 * 本文が参照する画像をまとめて取得する。sourceUrls の順序と返り値の順序は一致する
 * （プレースホルダの添字と対応させるため）。
 */
async function downloadImages({ request, imagesDir, sourceUrls, previousImages, force }) {
  const previousByUrl = new Map(
    (previousImages || []).filter((image) => image && image.sourceUrl).map((image) => [image.sourceUrl, image])
  );

  const results = [];
  for (const sourceUrl of sourceUrls) {
    /* eslint-disable no-await-in-loop -- 1ページ内の画像は直列に取り、相手サーバーへの同時接続を抑える */
    results.push(
      await downloadImage({
        request,
        imagesDir,
        sourceUrl,
        previous: previousByUrl.get(sourceUrl),
        force,
      })
    );
    /* eslint-enable no-await-in-loop */
  }
  return results;
}

/**
 * `__CK_IMG_0__` 形式のプレースホルダを実ファイルの相対パスに置き換える。
 * HTML は html/ 配下にあるので `../images/...` になる。
 *
 * 取得に失敗した画像は元の絶対 URL に戻す。壊れた相対パスを残すより、
 * オンラインでは表示できる状態にしておくほうが確認しやすい。
 */
function rewriteImagePlaceholders({ html, images, prefix, suffix }) {
  // 属性値に直接埋めるので、元 URL に含まれ得る & と " はエスケープしておく。
  const escapeAttribute = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

  let output = html;
  images.forEach((image, index) => {
    const placeholder = `${prefix}${index}${suffix}`;
    const replacement =
      image.status === 'failed' || !image.path
        ? escapeAttribute(image.sourceUrl)
        : `../${image.path}`;
    output = output.split(placeholder).join(replacement);
  });
  return output;
}

/**
 * 動画・音声を1件取得して media/ に保存する。
 * 画像より桁違いに大きいのでタイムアウトを長く取る。
 */
async function downloadMediaFile({ request, mediaDir, sourceUrl, previous, force }) {
  if (!force && previous && previous.status === 'ok' && previous.path) {
    const absolute = path.join(mediaDir, path.basename(previous.path));
    if (fs.existsSync(absolute)) {
      return { sourceUrl, path: previous.path, status: 'cached', bytes: fs.statSync(absolute).size, error: null };
    }
  }

  let response;
  try {
    response = await request.get(sourceUrl, { timeout: 180000 });
  } catch (error) {
    return { sourceUrl, path: null, status: 'failed', bytes: 0, error: `request error: ${error.message}` };
  }
  if (!response.ok()) {
    return { sourceUrl, path: null, status: 'failed', bytes: 0, error: `HTTP ${response.status()}` };
  }

  const body = await response.body();
  if (!body || body.length === 0) {
    return { sourceUrl, path: null, status: 'failed', bytes: 0, error: 'empty response body' };
  }

  const fileName = mediaFileName(sourceUrl, response.headers()['content-type']);
  writeBufferIfChanged(path.join(mediaDir, fileName), body);
  return { sourceUrl, path: `media/${fileName}`, status: 'ok', bytes: body.length, error: null };
}

/** 本文が参照する動画・音声をまとめて取得する。順序はプレースホルダの添字と対応させる。 */
async function downloadMediaFiles({ request, mediaDir, sourceUrls, previousMediaFiles, force }) {
  if (!sourceUrls || sourceUrls.length === 0) return [];
  fs.mkdirSync(mediaDir, { recursive: true });

  const previousByUrl = new Map(
    (previousMediaFiles || []).filter((m) => m && m.sourceUrl).map((m) => [m.sourceUrl, m])
  );

  const results = [];
  for (const sourceUrl of sourceUrls) {
    /* eslint-disable no-await-in-loop -- 動画は大きいので直列に取り、帯域を占有しない */
    results.push(
      await downloadMediaFile({ request, mediaDir, sourceUrl, previous: previousByUrl.get(sourceUrl), force })
    );
    /* eslint-enable no-await-in-loop */
  }
  return results;
}

/** `__CK_MED_0__` を実ファイルの相対パスに置き換える。失敗したものは元 URL に戻す。 */
function rewriteMediaPlaceholders({ html, mediaFiles, prefix, suffix }) {
  const escapeAttribute = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  let output = html;
  mediaFiles.forEach((item, index) => {
    const placeholder = `${prefix}${index}${suffix}`;
    const replacement =
      item.status === 'failed' || !item.path ? escapeAttribute(item.sourceUrl) : `../${item.path}`;
    output = output.split(placeholder).join(replacement);
  });
  return output;
}

module.exports = {
  downloadImage,
  downloadImages,
  rewriteImagePlaceholders,
  downloadMediaFile,
  downloadMediaFiles,
  rewriteMediaPlaceholders,
};
