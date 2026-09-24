/**
 * CSS の中の参照（`url()` / `@import` / `image-set()`）を見つけて書き換える。
 *
 * ブラウザに依存しない純粋な関数だけを置く。ここが最も壊れやすく、
 * 壊れても「見た目が少し変」程度にしか現れないので、単体で試せるようにしてある。
 *
 * 書き換えないもの:
 *   - `url(#gradient)` … SVG の filter / mask / clip-path 参照。触ると SVG が崩壊する。
 *   - `data:` / `blob:` / `about:` / `javascript:`
 *   - resolve() が null を返したもの（手元に落とせなかった資産）。
 *     壊れた相対パスを置くより、絶対URLのまま残してオンラインで見えるほうがよい。
 */

/**
 * `url( ... )`。引用符あり・なしの両方。
 * 引用符なしは仕様上 `)` を含められないので `[^)]` で止めてよい。
 * （`data:image/svg+xml,…(…)` を引用符なしで書いた不正な CSS は途中で切れるが、
 *   `data:` は書き換え対象外なので元の文字列が保たれる。）
 */
const URL_PATTERN = /url\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^)"'\s][^)]*?))\s*\)/g;

/** `@import "x.css"` のように url() を使わない形。`@import url(...)` は URL_PATTERN が拾う。 */
const IMPORT_PATTERN = /@import\s+(?!url\()(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;

/** `image-set("a.png" 1x, …)` の裸の文字列。中の `url()` は URL_PATTERN 側で拾う。 */
const IMAGE_SET_PATTERN = /(?:-webkit-)?image-set\(([^;{}]*)\)/g;
const QUOTED_PATTERN = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g;

const SKIP_SCHEMES = /^(?:data:|blob:|about:|javascript:|#)/i;

/** CSS の文字列リテラルに入れられる形にする。 */
function escapeCssString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** CSS のエスケープ（`\26` や `\)`）を戻す。実データではまず出ないが、出たときに壊れないように。 */
function unescapeCssValue(value) {
  return String(value).replace(/\\([0-9a-fA-F]{1,6})\s?|\\(.)/g, (whole, hex, char) =>
    (hex ? String.fromCodePoint(Number.parseInt(hex, 16)) : char));
}

function shouldSkip(value) {
  const trimmed = String(value).trim();
  return trimmed.length === 0 || SKIP_SCHEMES.test(trimmed);
}

/**
 * CSS 内の参照を位置つきで列挙する。範囲が重なるものは先に見つけたほうを優先する
 * （`image-set(url("a.png"))` の内側を二重に拾わないため）。
 */
function findCssReferences(css) {
  const found = [];
  const taken = [];
  const overlaps = (start, end) => taken.some((range) => start < range[1] && end > range[0]);
  // prefix は「置換範囲が @import キーワードごと含んでいるか」。
  // `@import url(x)` は url(...) だけが範囲なので、書き戻すときに @import を足すと二重になる。
  const push = (start, end, value, kind, prefix = '') => {
    if (overlaps(start, end)) return;
    taken.push([start, end]);
    found.push({ start, end, value: unescapeCssValue(value), kind, prefix });
  };

  for (const match of css.matchAll(URL_PATTERN)) {
    const value = match[1] !== undefined ? match[1] : match[2] !== undefined ? match[2] : match[3];
    // @import url(...) は取り込む CSS なので、種別を分けて呼び出し側が辿れるようにする。
    const before = css.slice(Math.max(0, match.index - 40), match.index);
    const kind = /@import\s*$/.test(before) ? 'import' : 'url';
    push(match.index, match.index + match[0].length, value || '', kind);
  }

  for (const match of css.matchAll(IMPORT_PATTERN)) {
    const value = match[1] !== undefined ? match[1] : match[2];
    push(match.index, match.index + match[0].length, value || '', 'import', '@import ');
  }

  for (const setMatch of css.matchAll(IMAGE_SET_PATTERN)) {
    const inner = setMatch[1] || '';
    const offset = setMatch.index + setMatch[0].indexOf(inner);
    for (const match of inner.matchAll(QUOTED_PATTERN)) {
      const value = match[1] !== undefined ? match[1] : match[2];
      push(offset + match.index, offset + match.index + match[0].length, value || '', 'url');
    }
  }

  return found.sort((a, b) => a.start - b.start);
}

/**
 * 参照を書き換えた CSS を返す。
 *
 * @param {string} css
 * @param {object} params
 * @param {string} params.baseUrl   この CSS の最終URL（リダイレクト後）。相対参照の解決基準。
 * @param {(absoluteUrl: string, kind: 'url'|'import') => string|null} params.resolve
 *        置換後の文字列を返す。null なら書き換えない。
 * @returns {{ css: string, refs: Array, unresolved: string[] }}
 */
function rewriteCss(css, { baseUrl, resolve }) {
  const references = findCssReferences(String(css));
  const refs = [];
  const unresolved = [];

  let out = '';
  let cursor = 0;

  for (const reference of references) {
    out += css.slice(cursor, reference.start);
    cursor = reference.end;

    if (shouldSkip(reference.value)) {
      out += css.slice(reference.start, reference.end);
      continue;
    }

    let absolute;
    try {
      absolute = new URL(reference.value.trim(), baseUrl).toString();
    } catch (error) {
      out += css.slice(reference.start, reference.end);
      continue;
    }

    const replacement = resolve(absolute, reference.kind);
    // 手元に無い資産は絶対URLへ。相対のままだとローカルで確実に 404 になる。
    const target = replacement || absolute;
    out += `${reference.prefix}url("${escapeCssString(target)}")`;

    if (!replacement) unresolved.push(absolute);
    refs.push({ url: absolute, kind: reference.kind, replaced: Boolean(replacement) });
  }

  out += css.slice(cursor);
  return { css: out, refs, unresolved };
}

module.exports = {
  URL_PATTERN,
  IMPORT_PATTERN,
  escapeCssString,
  unescapeCssValue,
  findCssReferences,
  rewriteCss,
};
