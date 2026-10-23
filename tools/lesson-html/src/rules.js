// 教材HTMLの決まりごと（prepare・check・プレビューの3か所で同じものを使う）
//   プレビュー（preview/index.html）へは serve.js が /__rules.js として配る。正規表現は .source で渡すので、
//   ここではフラグを i 以外に使わないこと

// LMS 埋め込み用の共通ファイル。教材がどのフォルダにあっても効くよう、サイトの先頭からのパスで読む。
//   既存の Clipkit 由来の教材は ../../_assets/ の相対パスで読んでいる（どちらも同じ S3 の materials/_assets/）
const ASSET_BASE = '/materials/_assets/';
const SKIN_FILE = 'lms-skin.css';
const EMBED_FILE = 'lms-embed.js';

// 教材の中に書かれた「前の章へ」「次のレッスンに進む」などのボタン。LMS の「前のレッスンへ／次のレッスンへ」と重複する。
//   文字の前後の矢印・記号は外してから比べる（squash）。
//   「ロードマップに戻る」「一覧に戻る」は対象外（lesson-map.json で LMS の目次へ付け替えて使っているものがある）
const NAV_TEXT = new RegExp(
  '^(?:' +
    '(?:前|次)(?:の(?:章|レッスン|ページ|記事|講座|動画|チャプター|セクション))?(?:へ|に)?(?:戻る|進む|もどる|すすむ|移動する?)?' +
    '|(?:prev(?:ious)?|next)(?:(?:chapter|lesson|page))?' +
  ')$',
  'i'
);
// 矢印・記号・空白（比べる前に外す）
const NAV_STRIP = /[\s<>＜＞«»‹›←→⇐⇒◀▶◁▷◂▸〈〉《》«»・|｜\-–—_]+|[◀-◃▶-▹]|️/g;

function squashNav(s) {
  return String(s || '').replace(NAV_STRIP, '');
}
function isNavText(s) {
  const t = squashNav(s);
  return t.length >= 2 && t.length <= 20 && NAV_TEXT.test(t);
}

// 受講生向けの画面・教材では「LMS」と書かない（呼び名は「WEBCOACH学習システム」）
const LMS_WORD = /LMS/;

// 外から読み込むと切れる・遅い置き場所（画像・動画・PDF）
const FRAGILE_HOSTS = [
  { re: /cdn\.clipkit\.co/i, why: 'Clipkit の画像置き場（Clipkit を止めると消える）' },
  { re: /learn\.webcoach\.jp\/(?:theme|media)\//i, why: 'Clipkit の画像置き場（Clipkit を止めると消える）' },
  { re: /dropbox(?:usercontent)?\.com/i, why: 'Dropbox（大量アクセスで止められる）' },
  { re: /drive\.google\.com|docs\.google\.com/i, why: 'Google ドライブ（共有設定しだいで見えない）' },
  { re: /notion\.so|notion\.site|amazonaws\.com\/secure\.notion/i, why: 'Notion（期限つきURLで切れる）' },
];

module.exports = { ASSET_BASE, SKIN_FILE, EMBED_FILE, NAV_TEXT, NAV_STRIP, squashNav, isNavText, LMS_WORD, FRAGILE_HOSTS };
