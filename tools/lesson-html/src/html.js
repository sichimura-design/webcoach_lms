// 教材HTMLの読み書き。整形（prepare）とチェック（check）で同じ読み方をする
const fs = require('fs');
const cheerio = require('cheerio');
const { ASSET_BASE, SKIN_FILE, EMBED_FILE, isNavText } = require('./rules');

// 元の書き方をなるべく崩さない（実体参照と content="" のような空の値をそのまま残す）
function load(file) {
  const src = fs.readFileSync(file, 'utf8');
  return { src, $: cheerio.load(src, { xml: { xmlMode: false, decodeEntities: false, emptyAttrs: true } }) };
}

function hasSkin($) {
  return $('link[href]').filter((_, el) => $(el).attr('href').split(/[?#]/)[0].endsWith(SKIN_FILE)).length > 0;
}
function hasEmbed($) {
  return $('script[src]').filter((_, el) => $(el).attr('src').split(/[?#]/)[0].endsWith(EMBED_FILE)).length > 0;
}

// 本文中の「前の章へ」などのボタン（a / button）。HTML コメントの中のものは数えない
function navButtons($) {
  return $('a, button').filter((_, el) => isNavText($(el).text())).toArray();
}

// ボタンを消し、ボタンしか入っていなかった枠も消す（main・article・body の手前まで、3段まで）
function removeNav($, el) {
  let node = $(el);
  const parent = node.parent();
  node.remove();
  let p = parent;
  for (let i = 0; i < 3 && p.length; i++) {
    const tag = (p[0].tagName || '').toLowerCase();
    if (['body', 'html', 'main', 'article', 'head'].includes(tag)) break;
    if (p.text().trim() || p.find('img, video, iframe, input, textarea, select, svg').length) break;
    const up = p.parent();
    p.remove();
    p = up;
  }
}

function squash(s) {
  return String(s || '').replace(/\s+/g, '');
}

// <title> と同じ（またはどちらかがもう片方を含む）h1。LMS の上部バーにレッスン名が出るので二重になる
function titleH1s($) {
  const title = squash($('title').first().text()).replace(/[-|｜].*WEBCOACH.*$/i, '');
  return $('h1').filter((_, el) => {
    const t = squash($(el).text());
    return t && title && (t.includes(title) || title.includes(t));
  }).toArray();
}

function headTags() {
  return [
    `<link rel="stylesheet" href="${ASSET_BASE}${SKIN_FILE}" data-wc-lms>`,
    `<script src="${ASSET_BASE}${EMBED_FILE}" data-wc-lms defer></script>`,
  ];
}

module.exports = { load, hasSkin, hasEmbed, navButtons, removeNav, titleH1s, headTags };
