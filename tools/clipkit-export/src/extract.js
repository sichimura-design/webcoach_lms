/**
 * 教材ページから「受講生に表示される本文」だけを抜き出す。
 *
 * extractInPage は page.evaluate でブラウザ内で実行されるため、
 * モジュールスコープの変数を一切参照してはいけない（関数がソースとして転送される）。
 * 必要な設定はすべて引数 options で渡す。
 */

/** 残すタグ。範囲外のタグは unwrap（子要素を残して自身だけ削除）する。 */
const DEFAULT_ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'strong', 'em', 'b', 'i', 'u', 's', 'small', 'mark',
  'code', 'pre', 'kbd', 'samp', 'var',
  'blockquote', 'q', 'cite',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  'a', 'img', 'figure', 'figcaption',
  'span', 'div', 'sup', 'sub',
  // 教材が章立てに使う。id が付いていることが多く、unwrap すると
  // ページ内目次（<a href="#s1">）の飛び先が消える。
  'section', 'article',
  // 教材の解説動画。ダウンロードはせず元 URL のまま残す。
  'video', 'audio', 'source', 'track',
  // アコーディオン。JS 無しで動く素の HTML なので構造ごと残す。
  'details', 'summary',
  // 確認クイズの選択肢は <button class="quiz-opt" data-correct="true"> で表される。
  // unwrap すると正解がどれかという情報ごと消えるため、タグとして残す。
  'button',
  'iframe',
];

/** 残す属性。style / data-* / on* は常に落とす。 */
const DEFAULT_ALLOWED_ATTRIBUTES = [
  'href',
  'src',
  'alt',
  'title',
  'colspan',
  'rowspan',
  // ページ内目次のジャンプ先。消すと <a href="#s1"> の飛び先が無くなる。
  'id',
  // 動画を再生可能なまま残すために必要
  'controls',
  'poster',
  'type',
  // details を開いた状態で保存するために必要
  'open',
];

const IMAGE_PLACEHOLDER_PREFIX = '__CK_IMG_';
const IMAGE_PLACEHOLDER_SUFFIX = '__';
const MEDIA_PLACEHOLDER_PREFIX = '__CK_MED_';
const MEDIA_PLACEHOLDER_SUFFIX = '__';

function imagePlaceholder(index) {
  return `${IMAGE_PLACEHOLDER_PREFIX}${index}${IMAGE_PLACEHOLDER_SUFFIX}`;
}

/**
 * ブラウザ内で走る本文抽出。
 *
 * 手順:
 *   1. include セレクタで本文ルートを決める（全滅ならテキスト量スコアでフォールバック）
 *   2. exclude セレクタはルート内側にだけ適用する
 *      （ヘッダー・サイドバー・ナビはルートを取った時点で自動的に外れる。
 *        本文中の <header> をうっかり消さないため、グローバルには適用しない）
 *   3. タグ・属性をホワイトリストで削る
 *   4. img はプレースホルダに、iframe は許可ホストのみ、a は絶対URLに
 */
function extractInPage(options) {
  const includeSelectors = options.include || [];
  const excludeSelectors = options.exclude || [];
  const allowedTags = new Set((options.allowedTags || []).map((tag) => tag.toLowerCase()));
  const allowedAttributes = new Set(
    (options.allowedAttributes || []).map((attr) => attr.toLowerCase())
  );
  const allowedEmbedHosts = new Set(
    (options.allowedEmbedHosts || []).map((host) => host.toLowerCase())
  );
  const placeholderPrefix = options.placeholderPrefix;
  const placeholderSuffix = options.placeholderSuffix;
  const titleSelectors = options.titleSelectors || [];
  const dropClasses = new Set((options.dropClasses || []).map((name) => name.toLowerCase()));
  const dropQueryParams = options.dropQueryParams || [];

  let baseHost = '';
  try {
    baseHost = new URL(options.baseUrl).host.toLowerCase();
  } catch (error) {
    baseHost = '';
  }

  const debug = { includeCandidates: [], fallbackCandidates: [], removedByExclude: 0, unwrapped: 0 };

  // タイトルは DOM を触る前に控える。教材によっては本文中にインライン SVG スプライトがあり、
  // その <title> を unwrap した拍子に document.title が空になることがある。
  const documentTitle = (document.title || '').replace(/\s+/g, ' ').trim();

  function textLength(element) {
    return (element.textContent || '').replace(/\s+/g, ' ').trim().length;
  }

  function linkTextLength(element) {
    let total = 0;
    for (const anchor of element.querySelectorAll('a')) {
      total += (anchor.textContent || '').replace(/\s+/g, ' ').trim().length;
    }
    return total;
  }

  function describe(element) {
    if (!element) return '(none)';
    const tag = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const cls =
      element.classList && element.classList.length
        ? `.${Array.from(element.classList).slice(0, 3).join('.')}`
        : '';
    return `${tag}${id}${cls}`;
  }

  // --- 1. 本文ルートの決定 ---------------------------------------------------
  let root = null;
  let extractedBy = '';

  for (const selector of includeSelectors) {
    let matched = null;
    try {
      matched = document.querySelector(selector);
    } catch (error) {
      debug.includeCandidates.push({ selector, matched: false, error: 'invalid selector' });
      continue;
    }
    debug.includeCandidates.push({
      selector,
      matched: Boolean(matched),
      textLength: matched ? textLength(matched) : 0,
      element: describe(matched),
    });
    if (matched && !root) {
      root = matched;
      extractedBy = `selector:${selector}`;
    }
  }

  if (!root) {
    // フォールバック: 「テキスト量 − リンクテキスト量 * 3」が最大のブロックを本文とみなす。
    // リンクだらけの目次・ナビは自然にスコアが下がる。
    const noiseWords = /(nav|header|footer|sidebar|menu|breadcrumb|global|share|comment|banner|advert)/i;
    const candidates = [];
    for (const element of document.body ? document.body.querySelectorAll('article, main, section, div') : []) {
      const text = textLength(element);
      if (text < 50) continue;
      const identifier = `${element.id || ''} ${element.className || ''}`;
      const penalty = noiseWords.test(identifier) ? text : 0;
      candidates.push({
        element,
        score: text - linkTextLength(element) * 3 - penalty,
        textLength: text,
      });
    }
    candidates.sort((a, b) => b.score - a.score);
    debug.fallbackCandidates = candidates.slice(0, 5).map((candidate) => ({
      element: describe(candidate.element),
      score: candidate.score,
      textLength: candidate.textLength,
    }));

    if (candidates.length > 0) {
      root = candidates[0].element;
      extractedBy = `fallback:${describe(root)}`;
    } else {
      root = document.body;
      extractedBy = 'fallback:body';
    }
  }

  // タイトルは「設定で指定されたセレクタ → h1 → <title>」の順に決める。
  // <title> はサイト名が付いた「レッスン名 - サイト名」になりがちなので最後の手段にする。
  const selectedTitle = (() => {
    for (const selector of titleSelectors) {
      let element = null;
      try {
        element = root.querySelector(selector) || document.querySelector(selector);
      } catch (error) {
        continue;
      }
      const text = element ? (element.textContent || '').replace(/\s+/g, ' ').trim() : '';
      if (text) return text;
    }
    return '';
  })();

  const headingTitle = (() => {
    const heading = root.querySelector('h1') || document.querySelector('h1');
    return heading ? (heading.textContent || '').replace(/\s+/g, ' ').trim() : '';
  })();

  // --- 2. 除外セレクタ（ルート内側のみ） ------------------------------------
  for (const selector of excludeSelectors) {
    let matches = [];
    try {
      matches = Array.from(root.querySelectorAll(selector));
    } catch (error) {
      continue;
    }
    for (const element of matches) {
      if (element === root) continue;
      element.remove();
      debug.removedByExclude += 1;
    }
  }

  // コメントノードは計測タグの残骸が混ざることがあるので落とす。
  const commentWalker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  const comments = [];
  while (commentWalker.nextNode()) comments.push(commentWalker.currentNode);
  for (const comment of comments) comment.remove();

  // --- 3. img / iframe / a の処理 -------------------------------------------
  const images = [];
  const imageIndexByUrl = new Map();
  const embeds = [];
  const media = [];
  const internalLinks = [];

  function absolute(raw) {
    if (!raw) return null;
    const trimmed = String(raw).trim();
    if (!trimmed) return null;
    try {
      return new URL(trimmed, document.baseURI);
    } catch (error) {
      return null;
    }
  }

  function firstFromSrcset(value) {
    if (!value) return null;
    const first = String(value).split(',')[0];
    return first ? first.trim().split(/\s+/)[0] : null;
  }

  for (const image of Array.from(root.querySelectorAll('img'))) {
    const raw =
      image.getAttribute('src') ||
      image.getAttribute('data-src') ||
      image.getAttribute('data-original') ||
      image.getAttribute('data-lazy-src') ||
      firstFromSrcset(image.getAttribute('srcset')) ||
      firstFromSrcset(image.getAttribute('data-srcset'));

    if (!raw) {
      image.remove();
      continue;
    }

    // data: URI は既に自己完結しているのでそのまま残す。
    if (/^data:/i.test(raw.trim())) {
      image.setAttribute('src', raw.trim());
      continue;
    }

    const url = absolute(raw);
    if (!url || !/^https?:$/.test(url.protocol)) {
      image.remove();
      continue;
    }

    let index = imageIndexByUrl.get(url.href);
    if (index === undefined) {
      index = images.length;
      imageIndexByUrl.set(url.href, index);
      images.push(url.href);
    }
    image.setAttribute('src', `${placeholderPrefix}${index}${placeholderSuffix}`);
  }

  for (const frame of Array.from(root.querySelectorAll('iframe'))) {
    const url = absolute(frame.getAttribute('src'));
    if (!url || !allowedEmbedHosts.has(url.host.toLowerCase())) {
      frame.remove();
      continue;
    }
    // 埋め込みウィジェットは読み込みごとに変わる値（Twitter の sessionId など）を
    // src に載せてくる。落とさないと取得結果が実行ごとに変わってしまう。
    for (const param of dropQueryParams) url.searchParams.delete(param);
    frame.setAttribute('src', url.href);
    embeds.push(url.href);
  }

  // 動画・音声は原則ダウンロードせず元 URL のまま残すが、
  // downloadMediaHosts に挙げたホスト（配信終了が見えているもの）だけは手元に取り込む。
  const downloadHosts = new Set((options.downloadMediaHosts || []).map((host) => host.toLowerCase()));
  const mediaDownloads = [];
  const mediaIndexByUrl = new Map();

  for (const element of Array.from(root.querySelectorAll('video, audio, source, track'))) {
    for (const attribute of ['src', 'poster']) {
      const raw = element.getAttribute(attribute);
      if (!raw) continue;
      const url = absolute(raw);
      if (!url) {
        element.removeAttribute(attribute);
        continue;
      }

      if (downloadHosts.has(url.host.toLowerCase())) {
        let index = mediaIndexByUrl.get(url.href);
        if (index === undefined) {
          index = mediaDownloads.length;
          mediaIndexByUrl.set(url.href, index);
          mediaDownloads.push(url.href);
        }
        element.setAttribute(attribute, `${options.mediaPlaceholderPrefix}${index}${options.mediaPlaceholderSuffix}`);
        continue;
      }

      element.setAttribute(attribute, url.href);
      if (attribute === 'src' && media.indexOf(url.href) === -1) media.push(url.href);
    }
    // src も source 子要素も無い <video> は再生できないので残す意味がない。
    const tag = element.tagName.toLowerCase();
    if ((tag === 'video' || tag === 'audio') && !element.getAttribute('src') && !element.querySelector('source')) {
      element.remove();
    }
  }

  // アコーディオンは開いた状態で保存する。閉じたままだと中身が見えず、
  // 「本文が欠けている」と誤解される（内容自体は HTML に入っている）。
  for (const element of Array.from(root.querySelectorAll('details'))) {
    element.setAttribute('open', '');
  }

  for (const anchor of Array.from(root.querySelectorAll('a'))) {
    const raw = anchor.getAttribute('href');
    if (!raw) continue;

    // ページ内アンカー（目次）は相対のまま残す。絶対 URL にすると
    // 保存した HTML 内で飛べなくなり、元サイトへ遷移してしまう。
    if (raw.trim().startsWith('#')) continue;

    const url = absolute(raw);
    if (!url) {
      anchor.removeAttribute('href');
      continue;
    }
    anchor.setAttribute('href', url.href);
    if (baseHost && url.host.toLowerCase() === baseHost && internalLinks.indexOf(url.href) === -1) {
      internalLinks.push(url.href);
    }
  }

  // --- 4. 属性のホワイトリスト ---------------------------------------------
  for (const element of Array.from(root.querySelectorAll('*'))) {
    const tag = element.tagName.toLowerCase();
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();

      if (name === 'class') {
        // class を許可した場合は丸ごと残す。quiz-opt / goal-box / summary-box のような
        // 意味のあるクラス名が、次工程（構造化データへの変換）で唯一の手がかりになる。
        if (allowedAttributes.has('class')) {
          // ただしスクロール連動アニメーションの状態クラス（`visible` など）は
          // 画面のどこまでスクロールしたかで付き外れするため、取得結果が実行ごとに
          // 変わってしまう。意味を持たない状態クラスは落として決定的にする。
          if (dropClasses.size > 0) {
            const kept = attribute.value.split(/\s+/).filter((token) => token && !dropClasses.has(token.toLowerCase()));
            if (kept.length === 0) element.removeAttribute(attribute.name);
            else if (kept.length !== attribute.value.split(/\s+/).filter(Boolean).length) {
              element.setAttribute('class', kept.join(' '));
            }
          }
          continue;
        }

        // 許可していない場合でも、コードブロックの言語情報だけは残す。
        if (tag === 'pre' || tag === 'code') {
          const languages = attribute.value
            .split(/\s+/)
            .filter((token) => /^(language-|lang-)[a-z0-9+#-]+$/i.test(token));
          if (languages.length > 0) {
            element.setAttribute('class', languages.join(' '));
            continue;
          }
        }
        element.removeAttribute(attribute.name);
        continue;
      }

      if (!allowedAttributes.has(name)) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  // --- 5. タグのホワイトリスト（範囲外は unwrap） ---------------------------
  // 逆ドキュメント順に見ることで子孫を先に処理でき、入れ子の unwrap が1パスで済む。
  for (const element of Array.from(root.querySelectorAll('*')).reverse()) {
    if (element === root) continue;
    if (allowedTags.has(element.tagName.toLowerCase())) continue;
    element.replaceWith(...Array.from(element.childNodes));
    debug.unwrapped += 1;
  }

  // --- 6. 中身が無くなった入れ物を掃除 ------------------------------------
  const prunable = new Set(['div', 'span', 'p', 'figure', 'figcaption']);
  for (const element of Array.from(root.querySelectorAll('*')).reverse()) {
    if (element === root) continue;
    if (!prunable.has(element.tagName.toLowerCase())) continue;
    // id はページ内リンクの飛び先。`<a id="style"></a>` のような空のアンカー印を
    // 「中身が無い入れ物」として消すと、目次から飛べなくなる。
    if (element.hasAttribute('id')) continue;
    const hasContent =
      (element.textContent || '').trim().length > 0 ||
      element.querySelector('img, iframe, video, audio, br, hr, table, [id]') !== null;
    if (!hasContent) element.remove();
  }

  return {
    html: root.innerHTML,
    documentTitle,
    selectedTitle,
    headingTitle,
    extractedBy,
    images,
    embeds,
    media,
    mediaDownloads,
    internalLinks,
    debug,
  };
}

/**
 * 遅延読み込み画像を実体化させるため、ページ末尾までスクロールしてから先頭に戻る。
 * こちらも page.evaluate で走るので自己完結させている。
 */
function autoScrollInPage() {
  return new Promise((resolve) => {
    let steps = 0;
    const maxSteps = 40;
    // 長大なページを1画面ずつ送るとレイアウト計算だけで数十秒かかる。
    // 全体を maxSteps 回で通過できる歩幅にして、高さに関わらず時間を一定に保つ。
    const total = Math.max(document.body ? document.body.scrollHeight : 0, window.innerHeight);
    const stride = Math.max(window.innerHeight, Math.ceil(total / maxSteps));

    const step = () => {
      window.scrollBy(0, stride);
      steps += 1;
      const reachedBottom =
        window.scrollY + window.innerHeight >= document.body.scrollHeight - 1;
      if (reachedBottom || steps >= maxSteps) {
        window.scrollTo(0, 0);
        setTimeout(resolve, 150);
        return;
      }
      setTimeout(step, 80);
    };
    step();
  });
}

/** 抽出した本文を、body だけ再利用できる最小の HTML ファイルに包む。 */
function wrapDocument({ title, sourceUrl, fetchedAt, bodyHtml }) {
  const escape = (value) =>
    String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  return [
    '<!DOCTYPE html>',
    '<html lang="ja">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escape(title)}</title>`,
    `<meta name="clipkit-source-url" content="${escape(sourceUrl)}">`,
    `<meta name="clipkit-fetched-at" content="${escape(fetchedAt)}">`,
    '</head>',
    '<body>',
    bodyHtml,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

module.exports = {
  DEFAULT_ALLOWED_TAGS,
  DEFAULT_ALLOWED_ATTRIBUTES,
  IMAGE_PLACEHOLDER_PREFIX,
  IMAGE_PLACEHOLDER_SUFFIX,
  MEDIA_PLACEHOLDER_PREFIX,
  MEDIA_PLACEHOLDER_SUFFIX,
  imagePlaceholder,
  extractInPage,
  autoScrollInPage,
  wrapDocument,
};
