// 教材の CSS のうち、LMS の中で「教材だけがスクロールする」原因になるものを探す・直す。
//   LMS は教材の高さ（lms-embed.js が送る wc-lesson:height）に合わせて iframe を伸ばし、スクロールは LMS 側でさせる。
//   教材の中に「画面の高さ（100vh など）で止めて、はみ出しを中でスクロールさせる箱」があると、
//   高さが画面ぶんしか伝わらず、その箱の中だけがスクロールする
//
//   対象は1段のルール（selector { ... }）。@media の中のルールも、いちばん内側の { } として拾える

// 宣言の値（!important は外して比べる）
function declValue(decls, prop) {
  const re = new RegExp('(?:^|[;{\\s])' + prop + '\\s*:\\s*([^;}]+)', 'i');
  const m = re.exec(decls);
  return m ? m[1].replace(/!important/i, '').trim() : null;
}

const SCROLLS = /^(auto|scroll|overlay|hidden)$/i;
// 画面いっぱいの高さ。calc(100vh - 400px) のように引いてあるものは、中身が足りれば伸び続けないので対象外
//   （Clipkit 由来の全教材に min-height: calc(100vh - 400px) があり、本番で伸び続けていないことを確認済み）
const SCREEN_HEIGHT = /^(?:(?:100|[89]\d)[dsl]?vh|100%|calc\(\s*100[dsl]?vh\s*\))$/i;
const IS_ROOT = /(^|,)\s*(html|body|:root)\s*(?=,|$)/i;

// 1つのルールを見て、理由（文字列）か null を返す
function scrollTrap(selector, decls) {
  const ov = declValue(decls, 'overflow-y') || declValue(decls, 'overflow');
  const h = declValue(decls, 'height') || declValue(decls, 'max-height');
  const pos = declValue(decls, 'position');
  // html / body：中スクロール自体は困らない（lms-embed.js は body.scrollHeight＝中身の全高を測る）。
  //   困るのは高さを画面に合わせる指定。lms-skin.css の下余白 96px が足されて高さを送るたびに伸び、止まらなくなる
  if (IS_ROOT.test(selector)) {
    const rh = declValue(decls, 'height') || declValue(decls, 'min-height');
    return rh && SCREEN_HEIGHT.test(rh) ? `${selector.trim()} が height: ${rh}（LMS の中で高さが伸び続ける）` : null;
  }
  const mh = declValue(decls, 'min-height');
  if (mh && SCREEN_HEIGHT.test(mh)) return `${selector.trim()} が min-height: ${mh}（LMS の中で高さが伸び続ける）`;
  if (ov && SCROLLS.test(ov.split(/\s+/)[0]) && !/^hidden$/i.test(ov) && h && SCREEN_HEIGHT.test(h)) {
    return `${selector.trim()} が height: ${h} ＋ overflow: ${ov}（中だけスクロールする箱）`;
  }
  if (pos && /^fixed$/i.test(pos) && h && SCREEN_HEIGHT.test(h)) {
    return `${selector.trim()} が position: fixed ＋ height: ${h}（画面に貼りつく箱）`;
  }
  return null;
}

// CSS 文字列の中の、スクロールの罠になっているルールを列挙する
function findTraps(css) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const sel = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!sel || sel.startsWith('@')) continue;
    const why = scrollTrap(sel, m[2]);
    if (why) out.push(why);
  }
  return out;
}

// 罠を外した CSS を返す。高さの指定は auto（min-height は 0）、中スクロールは visible にする
//   （横の overflow-x と、html / body の overflow は触らない）
function fixTraps(css) {
  const fixed = [];
  const next = css.replace(/([^{}]+)\{([^{}]*)\}/g, (all, rawSel, decls) => {
    const sel = rawSel.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!sel || sel.startsWith('@')) return all;
    const why = scrollTrap(sel, decls);
    if (!why) return all;
    fixed.push(why);
    let d = decls;
    if (why.includes('中だけスクロール')) d = d.replace(/(^|[;\s])(overflow-y|overflow)\s*:\s*[^;}]+/gi, '$1$2: visible');
    d = d
      .replace(/(^|[;\s])(max-height|height)\s*:\s*[^;}]*(?:v[hw]|%)[^;}]*/gi, '$1$2: auto')
      .replace(/(^|[;\s])(min-height)\s*:\s*[^;}]*(?:v[hw]|%)[^;}]*/gi, '$1$2: 0');
    if (/position\s*:\s*fixed/i.test(d)) d = d.replace(/position\s*:\s*fixed/gi, 'position: static');
    return rawSel + '{' + d + '}';
  });
  return { css: next, fixed };
}

module.exports = { findTraps, fixTraps, scrollTrap };
