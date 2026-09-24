/**
 * ページ内（ブラウザ側）で走らせる整形処理。`extract.js` と同じ流儀で、
 * この関数は自己完結していなければならない（外側のスコープを一切参照できない）。
 *
 * やること:
 *   1. ローカルで開いたときに事故を起こす要素を落とす（script / base / integrity / CSP）
 *   2. 資産の参照をすべて **絶対URL** にしてから、`__CK_RES_n__` というトークンに置き換える
 *      → Node 側でトークンをローカルの相対パスに差し替える。
 *        HTML のエスケープ（& → &amp;）を気にせず置換できるのが狙い。
 *   3. `<!DOCTYPE>` 付きで丸ごと文字列にする
 *
 * `<style>` ブロックの中身は Node 側で css-rewrite に通す（HTML エスケープされないので安全に扱える）。
 */

const RESOURCE_PLACEHOLDER_PREFIX = '__CK_RES_';
const RESOURCE_PLACEHOLDER_SUFFIX = '__';

/**
 * @param {object} options
 * @param {string} options.placeholderPrefix
 * @param {string} options.placeholderSuffix
 * @param {string[]} options.forceVisibleSelectors  出現アニメーション待ちで隠れている要素
 */
function neutralizeInPage(options) {
  const prefix = options.placeholderPrefix;
  const suffix = options.placeholderSuffix;
  const resources = [];
  const seen = new Map();
  const stats = { scripts: 0, sources: 0, srcsets: 0, inlineStyles: 0 };

  const skip = (value) =>
    !value ||
    /^\s*$/.test(value) ||
    /^(data:|blob:|about:|javascript:|mailto:|tel:|#)/i.test(value.trim());

  /** 絶対URLを1件登録してトークンを返す。同じURLは同じトークンになる。 */
  const token = (absoluteUrl, hint) => {
    const key = absoluteUrl;
    if (seen.has(key)) return seen.get(key);
    const placeholder = prefix + resources.length + suffix;
    resources.push({ url: absoluteUrl, hint: hint || 'asset' });
    seen.set(key, placeholder);
    return placeholder;
  };

  /** 相対URLを document の基準で絶対化する。失敗したら null。 */
  const absolutize = (value) => {
    if (skip(value)) return null;
    try {
      return new URL(value, document.baseURI).toString();
    } catch (error) {
      return null;
    }
  };

  // --- 1. 危ないものを落とす ------------------------------------------------

  // 出現アニメーションは JS を落とすと「透明なまま」になる。スクロール後の DOM 状態に
  // 頼らず、スタイルで強制的に見せる（autoScrollInPage は最後に先頭へ戻るため、
  // 「画面外に出たら class を外す」実装だと上部が再び隠れた状態で保存されてしまう）。
  if (options.forceVisibleSelectors && options.forceVisibleSelectors.length > 0) {
    const style = document.createElement('style');
    style.setAttribute('data-clipkit-snapshot', 'force-visible');
    style.textContent =
      `${options.forceVisibleSelectors.join(',')}{opacity:1!important;transform:none!important;` +
      'visibility:visible!important;animation:none!important;transition:none!important}';
    document.head.appendChild(style);
  }

  for (const element of Array.from(document.querySelectorAll('script'))) {
    element.remove();
    stats.scripts += 1;
  }
  // base が残っていると、ローカルの相対パスが元サイトへ解決されてしまう。
  for (const element of Array.from(document.querySelectorAll('base'))) element.remove();
  // SRI が残ると、差し替えた CSS が検証に落ちて読み込まれない（真っ白になる）。
  for (const element of Array.from(document.querySelectorAll('[integrity],[crossorigin]'))) {
    element.removeAttribute('integrity');
    element.removeAttribute('crossorigin');
  }
  for (const element of Array.from(
    document.querySelectorAll('meta[http-equiv="Content-Security-Policy" i]')
  )) {
    element.remove();
  }
  // JS で読み込む前提の先読み。ローカルでは 404 になるだけ。
  for (const element of Array.from(document.querySelectorAll('link[rel="preload" i][as="script" i]'))) {
    element.remove();
  }

  // --- 2. 画像（srcset は現在の1候補しか取れていない） ----------------------

  for (const img of Array.from(document.querySelectorAll('img'))) {
    if (img.hasAttribute('srcset') || img.hasAttribute('sizes')) stats.srcsets += 1;
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
    img.removeAttribute('loading');

    // src が空の `<img src="">` は、IDL プロパティで読むと**ページ自身のURL**になる。
    // そのまま資産として扱うと、教材ページのHTMLを画像として抱え込む（実際に513件拾った）。
    // 属性の生の値を見て、空なら何もしない。
    const raw = img.getAttribute('src');
    if (raw === null || raw.trim() === '') continue;

    const resolved = img.currentSrc || img.src;
    const absolute = absolutize(resolved);
    if (!absolute || absolute === document.URL || absolute === document.baseURI) continue;
    img.setAttribute('src', token(absolute, 'image'));
  }

  // <picture> の <source> は img.src より優先されるので、取り切れていない候補を残さない。
  for (const source of Array.from(document.querySelectorAll('picture > source'))) {
    source.remove();
    stats.sources += 1;
  }

  // --- 3. その他の参照 ------------------------------------------------------

  const simpleRefs = [
    ['link[href]', 'href', 'link'],
    ['video[src]', 'src', 'media'],
    ['video[poster]', 'poster', 'image'],
    ['audio[src]', 'src', 'media'],
    ['source[src]', 'src', 'media'],
    ['track[src]', 'src', 'asset'],
    ['object[data]', 'data', 'asset'],
    ['embed[src]', 'src', 'asset'],
    ['input[type="image" i][src]', 'src', 'image'],
    ['image[href]', 'href', 'image'],
    ['image[*|href]', 'xlink:href', 'image'],
    ['use[href]', 'href', 'asset'],
    ['use[*|href]', 'xlink:href', 'asset'],
  ];

  for (const [selector, attribute, hint] of simpleRefs) {
    let elements;
    try {
      elements = Array.from(document.querySelectorAll(selector));
    } catch (error) {
      continue;
    }
    for (const element of elements) {
      const raw = element.getAttribute(attribute);
      if (raw === null) continue;

      if (element.tagName.toLowerCase() === 'link') {
        const rel = (element.getAttribute('rel') || '').toLowerCase();
        const wanted = ['stylesheet', 'icon', 'shortcut icon', 'apple-touch-icon', 'manifest', 'preload'];
        if (!wanted.some((value) => rel.includes(value.split(' ').pop()))) {
          // canonical / alternate などは資産ではない。絶対URLにだけしておく。
          const absoluteHref = absolutize(raw);
          if (absoluteHref) element.setAttribute(attribute, absoluteHref);
          continue;
        }
      }

      const absolute = absolutize(raw);
      if (!absolute) continue;
      const kind = element.tagName.toLowerCase() === 'link'
        && (element.getAttribute('rel') || '').toLowerCase().includes('stylesheet')
        ? 'css'
        : hint;
      element.setAttribute(attribute, token(absolute, kind));
    }
  }

  // リンク・埋め込み・フォームは手元に落とさない。オンラインで辿れるよう絶対URLにする。
  for (const [selector, attribute] of [['a[href]', 'href'], ['area[href]', 'href'], ['iframe[src]', 'src'], ['form[action]', 'action']]) {
    for (const element of Array.from(document.querySelectorAll(selector))) {
      const absolute = absolutize(element.getAttribute(attribute));
      if (absolute) element.setAttribute(attribute, absolute);
    }
  }

  // --- 4. style="" の中の url() -------------------------------------------

  for (const element of Array.from(document.querySelectorAll('[style]'))) {
    const value = element.getAttribute('style');
    if (!value || value.indexOf('url(') === -1) continue;
    const replaced = value.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"]*))\s*\)/g, (whole, a, b, c) => {
      const raw = a !== undefined ? a : b !== undefined ? b : c;
      const absolute = absolutize(raw);
      if (!absolute) return whole;
      return `url("${token(absolute, 'image')}")`;
    });
    if (replaced !== value) {
      element.setAttribute('style', replaced);
      stats.inlineStyles += 1;
    }
  }

  // --- 5. 直列化 ------------------------------------------------------------

  let doctype = '<!DOCTYPE html>';
  if (document.doctype) {
    const node = document.doctype;
    doctype =
      `<!DOCTYPE ${node.name}` +
      (node.publicId ? ` PUBLIC "${node.publicId}"` : '') +
      (!node.publicId && node.systemId ? ' SYSTEM' : '') +
      (node.systemId ? ` "${node.systemId}"` : '') +
      '>';
  }

  return {
    html: `${doctype}\n${document.documentElement.outerHTML}`,
    resources,
    title: document.title || '',
    stats,
  };
}

module.exports = {
  RESOURCE_PLACEHOLDER_PREFIX,
  RESOURCE_PLACEHOLDER_SUFFIX,
  neutralizeInPage,
};
