// 教材HTMLのチェック。NG は載せると崩れるもの、注意は確認してほしいもの
const fs = require('fs');
const path = require('path');
const { load, hasSkin, hasEmbed, navButtons, titleH1s } = require('./html');
const { findTraps } = require('./css');
const { LMS_WORD, FRAGILE_HOSTS } = require('./rules');

const REPO = path.resolve(__dirname, '../../..');

// 教材の中の相対パス・/materials/ のパスを、手元のファイルに直す（無ければ null）
function localPath(file, ref) {
  const clean = ref.split(/[?#]/)[0];
  if (/^(https?:|data:|blob:|mailto:|tel:|javascript:|#)/i.test(ref) || !clean) return null;
  try {
    if (clean.startsWith('/materials/')) return path.join(REPO, 'assets', decodeURI(clean));
    if (clean.startsWith('/')) return null; // LMS の画面へのパス（/study-log など）
    return path.resolve(path.dirname(file), decodeURI(clean));
  } catch (e) {
    return null;
  }
}

function check(file) {
  const { $ } = load(file);
  const out = [];
  const ng = (msg) => out.push({ level: 'NG', msg });
  const warn = (msg) => out.push({ level: '注意', msg });

  if (!hasSkin($)) ng('lms-skin.css が読み込まれていない → 見た目が LMS に合わない（prepare で入る）');
  if (!hasEmbed($)) ng('lms-embed.js が読み込まれていない → 高さが LMS に伝わらず、教材だけがスクロールする。前後ボタンも隠れない（prepare で入る）');

  const navs = navButtons($);
  if (navs.length) {
    const labels = [...new Set(navs.map((el) => $(el).text().replace(/\s+/g, ' ').trim()))];
    ng(`前後のボタンが ${navs.length} 個ある（${labels.join('／')}）→ LMS の「前のレッスンへ／次のレッスンへ」と二重になる（prepare で消える）`);
  }

  const traps = [];
  $('style').each((_, el) => traps.push(...findTraps($(el).html() || '')));
  $('[style]').each((_, el) => traps.push(...findTraps(`${el.tagName.toLowerCase()}{${$(el).attr('style')}}`)));
  traps.forEach((why) => ng(`LMS の中で崩れる CSS: ${why}（prepare で直る）`));

  const css = $('style').text() + ' ' + $('[style]').map((_, el) => $(el).attr('style')).get().join(';');
  if (/position\s*:\s*(fixed|sticky)/i.test(css)) warn('position: fixed / sticky がある → LMS の中では画面に貼りつかず、思った位置に出ないことがある。プレビューで確認');
  const wide = css.match(/(?:^|[;{\s])(?:min-)?width\s*:\s*(\d{3,})px/gi) || [];
  const tooWide = wide.map((w) => parseInt(w.replace(/\D+/g, ' ').trim().split(' ').pop(), 10)).filter((n) => n > 760);
  if (tooWide.length) warn(`幅 ${Math.max(...tooWide)}px の指定がある → 本文の幅は 760px まで。スマホ（390px）ではみ出さないかプレビューで確認`);

  const h1s = titleH1s($);
  if (h1s.length) warn('レッスン名と同じ h1 がある → LMS の上部バーと見出しが二重になる（prepare で消える。残すなら --keep-h1）');
  if (!$('title').text().trim()) warn('<title> が無い → 「AIに聞く」に教材名が届かない');
  if (!$('meta[name="viewport"]').length) warn('<meta name="viewport"> が無い → スマホで文字が小さくなる');

  const refs = [];
  $('img[src], video[src], video[poster], source[src], iframe[src], audio[src], a[href], link[href]').each((_, el) => {
    const $el = $(el);
    ['src', 'poster', 'href'].forEach((a) => { if ($el.attr(a)) refs.push({ tag: el.tagName.toLowerCase(), attr: a, ref: $el.attr(a).trim() }); });
  });
  const insecure = refs.filter((r) => r.attr !== 'href' && /^http:\/\//i.test(r.ref));
  if (insecure.length) ng(`http:// の画像・動画が ${insecure.length} 件ある → LMS（https）では表示されない（例: ${insecure[0].ref}）`);
  const media = refs.filter((r) => r.attr !== 'href' || /\.(pdf|png|jpe?g|gif|webp|mp4|mov)(\?|$)/i.test(r.ref));
  FRAGILE_HOSTS.forEach((h) => {
    const hit = media.filter((r) => h.re.test(r.ref));
    if (hit.length) warn(`${hit.length} 件が ${h.why} を指している（例: ${hit[0].ref}）→ S3（/materials/）か media.webcoach.jp に置き換える`);
  });
  const missing = refs
    // _assets/・_clipkit/ は全教材共通の置き場所で、実体は S3 にだけある（Git には入っていない）
    .filter((r) => !/(^|\/)_(assets|clipkit)\//.test(r.ref) && !(r.tag === 'a' && !/\.\w{2,4}$/.test(r.ref.split(/[?#]/)[0])))
    .map((r) => ({ ...r, file: localPath(file, r.ref) }))
    .filter((r) => r.file && !fs.existsSync(r.file));
  if (missing.length) ng(`手元に無いファイルを ${missing.length} 件参照している（例: ${missing[0].ref}）→ 画像を同じ場所に置くか、パスを直す`);
  const local = refs.filter((r) => /^(file:|[a-z]:\\|\/Users\/|\/home\/|https?:\/\/(localhost|127\.0\.0\.1))/i.test(r.ref));
  if (local.length) ng(`自分のパソコンのパスを参照している（例: ${local[0].ref}）→ 受講生には見えない`);

  const body = ($('main').length ? $('main') : $('body')).clone();
  body.find('script, style, code, pre').remove();
  if (LMS_WORD.test(body.text())) warn('本文に「LMS」と書いてある → 受講生向けは「WEBCOACH学習システム」と書く');

  return out;
}

module.exports = { check };
