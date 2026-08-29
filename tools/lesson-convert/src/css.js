/**
 * 教材が持っていた CSS を、移行先の教材枠だけに効くよう書き換える。
 *
 * そのまま入れると LMS 全体が壊れる。教材の CSS には
 *   *, *::before, *::after { margin: 0; padding: 0 }
 *   body { font-family: ...; background: #fff }
 *   h2 { font-size: 24px }
 * のようにページ全体へ効く指定が入っているため。
 *
 * やること:
 *   1. すべてのセレクタに教材枠（.wc-lesson-scope）を前置する
 *   2. body / html は枠そのものに読み替える
 *   3. .lesson-wrapper も枠そのものに読み替える（変換でこの入れ物は無くなっている）
 *   4. スクロール連動で出現する要素を、最初から見える状態にする
 *      （出現させる JavaScript は取得時に落としているため、放っておくと本文が消える）
 *   5. 差し色のオレンジを LMS の赤へ寄せる（下の retoneCss を見よ）
 */

const SCOPE = '.wc-lesson-scope';

/** @media や @supports のように、中にルールを持つ塊 */
const NESTED_AT_RULE = /^@(media|supports|container|layer)\b/i;
/** セレクタを書き換えてはいけない塊 */
const OPAQUE_AT_RULE = /^@(keyframes|font-face|import|charset|namespace|page|counter-style|property)\b/i;

/* ───────────────────────── 差し色をLMSのトンマナへ寄せる ───────────────────────── */

/**
 * LMS の差し色は #D60934（色相347）。教材のオレンジはここへ寄せる。
 * 色相を1点に潰すとグラデーションが単色になってしまうので、
 * 「元がどれだけオレンジ寄りだったか」を明るさの差として残す。
 */
const ACCENT_HUE = 350;

/**
 * 寄せる対象の見分け方。教材には系統の違う暖色が2つある。
 *   差し色   … 彩度が高い（見出し下線・表ヘッダ・ヒーロー・バッジ）→ 赤へ寄せる
 *   紙・金具 … 彩度が低いベージュ／ブロンズ（.brief-box などの書類モチーフ）→ 触らない
 * さらに、ごく薄いクリーム地（Point ボックスの背景）も触らない。
 * ここまで赤くすると囲みの種類が見分けられなくなるため。
 */
const RETONE_MIN_SATURATION = 55;
const RETONE_MIN_LIGHTNESS = 35;
const RETONE_MAX_LIGHTNESS = 72;

/** 暖色の弧。赤（350付近）から黄みのオレンジ（55）まで。 */
const WARM_ARC = 70;

function toHsl(r, g, b) {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === R) h = (G - B) / d + (G < B ? 6 : 0);
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return { h: h * 60, s, l };
}

function toRgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const t = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][Math.floor((((h % 360) + 360) % 360) / 60)];
  return t.map((v) => Math.round((v + m) * 255));
}

/**
 * 1色を赤へ寄せる。対象外ならそのまま返す。
 * 明るさは元の値を土台にして、少し深くしたうえで
 * 「オレンジ寄りだった分」を足す。こうするとグラデーションの濃淡が残り、
 * 白抜き文字のコントラストも元より悪くならない。
 */
function retoneColor(r, g, b) {
  const { h, s, l } = toHsl(r, g, b);
  const sPct = s * 100;
  const lPct = l * 100;
  const warm = h >= 330 || h <= 55;
  if (!warm || sPct < RETONE_MIN_SATURATION) return null;
  if (lPct < RETONE_MIN_LIGHTNESS || lPct > RETONE_MAX_LIGHTNESS) return null;

  // 元の色相がどれだけオレンジ寄りだったか（0＝赤, 1＝黄みのオレンジ）
  const distance = Math.min(((h - ACCENT_HUE + 360) % 360) / WARM_ARC, 1);
  // LMS の #D60934 は明度44。教材の赤は明度62前後と浅いので、明るい色ほど深くする。
  // 元から暗い色まで一律に深くすると潰れるため、深める量は明るさに比例させる。
  const deepen = 14 * Math.max(0, Math.min(1, (lPct - RETONE_MIN_LIGHTNESS) / 30));
  const lightness = Math.max(30, Math.min(76, lPct + distance * 16 - deepen));
  return toRgb(ACCENT_HUE, Math.min(sPct, 92) / 100, lightness / 100);
}

const HEX = /#([0-9a-fA-F]{3,8})\b/g;
const RGB_FUNC = /rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*([,/][^)]*)?\)/gi;

function hex2(n) {
  return n.toString(16).padStart(2, '0');
}

/** 宣言の値だけを対象に、色を書き換える。 */
function retoneValue(value) {
  return value
    .replace(HEX, (whole, digits) => {
      let d = digits;
      if (d.length === 3 || d.length === 4) d = d.split('').map((c) => c + c).join('');
      if (d.length !== 6 && d.length !== 8) return whole;
      const rgb = [0, 2, 4].map((i) => parseInt(d.slice(i, i + 2), 16));
      const next = retoneColor(...rgb);
      return next ? `#${next.map(hex2).join('')}${d.slice(6)}` : whole;
    })
    .replace(RGB_FUNC, (whole, r, g, b, tail) => {
      const next = retoneColor(Number(r), Number(g), Number(b));
      return next ? `rgba(${next.join(', ')}${tail || ''})`.replace('rgba(', tail ? 'rgba(' : 'rgb(') : whole;
    });
}

/**
 * CSS を舐めて、宣言の値に出てくる色だけ書き換える。
 * セレクタの `#id` や `@media (max-width: …)` を色と取り違えないよう、
 * 波括弧の内側で `:` の後ろにいるあいだだけ書き換える。
 */
function retoneCss(css) {
  const source = String(css);
  let out = '';
  let depth = 0;
  let value = null; // 値の途中なら、そこまでの文字列

  const flush = () => {
    if (value !== null) {
      out += retoneValue(value);
      value = null;
    }
  };

  for (const ch of source) {
    if (ch === '{') {
      flush();
      depth += 1;
      out += ch;
    } else if (ch === '}') {
      flush();
      depth -= 1;
      out += ch;
    } else if (ch === ';') {
      flush();
      out += ch;
    } else if (ch === ':' && depth > 0 && value === null) {
      out += ch;
      value = '';
    } else if (value !== null) {
      value += ch;
    } else {
      out += ch;
    }
  }
  flush();
  return out;
}

/**
 * 1つのセレクタに枠を前置する。
 * body / html / :root と、変換で消えた .lesson-wrapper は枠そのものを指すようにする。
 */
function scopeSelector(selector) {
  const s = selector.trim();
  if (!s) return null;
  // すでに枠が付いているものは触らない
  if (s.startsWith(SCOPE)) return s;

  // ページ全体を指すもの → 枠そのもの
  if (/^(html|body|:root)$/i.test(s)) return SCOPE;
  if (/^(html|body|:root)\b/i.test(s)) return s.replace(/^(html|body|:root)\b/i, SCOPE);

  // 本文の入れ物。変換でこの要素は無くなり、枠がその役割を担う
  if (s === '.lesson-wrapper') return SCOPE;
  if (s.startsWith('.lesson-wrapper')) return SCOPE + s.slice('.lesson-wrapper'.length);

  // 全称セレクタ。枠の内側だけに効かせる
  if (s === '*') return `${SCOPE} *`;
  if (/^\*(::?[a-z-]+)/i.test(s)) return `${SCOPE} ${s}`;

  return `${SCOPE} ${s}`;
}

function scopeSelectorList(list) {
  return list
    .split(',')
    .map(scopeSelector)
    .filter(Boolean)
    .join(', ');
}

/**
 * CSS を舐めて、ルールのセレクタだけ書き換える。
 * 波括弧の対応を数えるだけの簡易パーサだが、教材のCSSは素直な書き方なので足りる。
 * （文字列やコメントの中に波括弧が出ると崩れるため、先にコメントを落とす）
 */
function scopeCss(css) {
  const source = String(css).replace(/\/\*[\s\S]*?\*\//g, '');
  let out = '';
  let buffer = '';
  let index = 0;

  const readBlock = (start) => {
    let depth = 0;
    for (let i = start; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return source.length - 1;
  };

  while (index < source.length) {
    const brace = source.indexOf('{', index);
    if (brace < 0) break;

    const prelude = source.slice(index, brace).trim();
    const end = readBlock(brace);
    const body = source.slice(brace + 1, end);

    if (OPAQUE_AT_RULE.test(prelude)) {
      out += `${prelude}{${body}}\n`;
    } else if (NESTED_AT_RULE.test(prelude)) {
      out += `${prelude}{\n${scopeCss(body)}\n}\n`;
    } else if (prelude.startsWith('@')) {
      out += `${prelude}{${body}}\n`;
    } else {
      // 枠そのものを指すことになったセレクタ（body / html / .lesson-wrapper 由来）と、
      // それ以外を分けて書き出す。前者からはページの体裁だけ落とす。
      const scoped = prelude
        .split(',')
        .map((s) => scopeSelector(s))
        .filter(Boolean);
      const frame = scoped.filter((s) => s === SCOPE);
      const rest = scoped.filter((s) => s !== SCOPE);
      if (frame.length > 0) {
        const kept = stripFrameDeclarations(body);
        if (kept.trim()) out += `${SCOPE} {${kept}}\n`;
      }
      if (rest.length > 0) out += `${rest.join(', ')} {${body}}\n`;
    }
    index = end + 1;
    buffer = '';
  }
  out += buffer;
  return out.trim();
}

/**
 * スクロールで出現する演出を打ち消す。
 * 元サイトは IntersectionObserver で .visible を付けていたが、
 * その JavaScript は取得時に落としている。打ち消さないと本文が透明のまま残る。
 */
const REVEAL_RESET = `
${SCOPE} .reveal,
${SCOPE} [class*="reveal"] {
  opacity: 1 !important;
  transform: none !important;
  visibility: visible !important;
  animation: none !important;
}
`;

/**
 * 「ページの体裁」を決めるプロパティ。
 * body / .lesson-wrapper から枠へ読み替えた指定のうち、これらは捨てる。
 * 幅・余白・地の色は移行先のレイアウトが持っているので、二重に効かせない。
 *
 * これらを !important で打ち消す手も試したが、LMS 側が持つ読み幅（インライン指定）
 * まで潰してしまい本文が画面端まで伸びた。効かせない指定は最初から出さない。
 * 文字色・フォント・行間は残す（教材の見た目そのものなので）。
 */
const FRAME_PROPERTY =
  /^(width|height|(min|max)-(width|height)|margin|padding|(margin|padding)-(top|right|bottom|left|inline|block)(-(start|end))?|background|background-(color|image|attachment|position|repeat|size|clip|origin)|position|top|right|bottom|left|inset(-\w+)*|overflow|overflow-(x|y)|float|display)$/i;

/**
 * 宣言を `;` で切る。`url(...)` や `data:image/png;base64,...` の中の `;` で
 * 切ってしまわないよう、括弧と引用符の中は数えない。
 */
function splitDeclarations(body) {
  const out = [];
  let buf = '';
  let depth = 0;
  let quote = '';
  for (const ch of String(body)) {
    if (quote) {
      buf += ch;
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === ';' && depth === 0) {
      out.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

/** ページの体裁を決める宣言を落とす。 */
function stripFrameDeclarations(body) {
  return splitDeclarations(body)
    .filter((decl) => {
      const name = decl.slice(0, decl.indexOf(':')).trim();
      return name && !FRAME_PROPERTY.test(name);
    })
    .join(';');
}

/**
 * 教材の枠に閉じ込めた CSS を作る。
 * 先頭に注記を入れて、生成物であることが分かるようにする。
 */
function buildScopedCss(cssList) {
  const scoped = cssList
    .map((css) => scopeCss(retoneCss(css)))
    .filter(Boolean)
    .join('\n');
  if (!scoped) return '';
  return `/* Clipkit の教材CSSを ${SCOPE} の内側だけに効くよう書き換えたもの。手で編集しない。 */\n${scoped}\n${REVEAL_RESET}`;
}

module.exports = { SCOPE, scopeCss, scopeSelector, retoneCss, buildScopedCss };
