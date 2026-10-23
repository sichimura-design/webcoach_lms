// LMS の枠を真似たプレビュー。教材を LMS と同じ iframe（高さ追従・sandbox）で開き、崩れの原因を一覧にする
//   /                    … プレビュー画面（preview/index.html）。?src=<教材のパス> で開く教材を選ぶ
//   /materials/...       … assets/materials/...（本番の S3 の materials/ と同じ並び。_assets の2ファイルもここ）
//   /local/<パス>        … リポジトリの中の、それ以外の場所にある HTML（作りかけの教材など）
//   /__rules.js          … src/rules.js の決まりごと（プレビュー画面のチェックで使う）
const http = require('http');
const fs = require('fs');
const path = require('path');
const rules = require('./rules');

const REPO = path.resolve(__dirname, '../../..');
const ROOT = path.join(REPO, 'assets');
const PREVIEW = path.resolve(__dirname, '../preview/index.html');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.pdf': 'application/pdf',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

function rulesScript() {
  const plain = {
    NAV_TEXT: rules.NAV_TEXT.source, NAV_STRIP: rules.NAV_STRIP.source, LMS_WORD: rules.LMS_WORD.source,
    SKIN_FILE: rules.SKIN_FILE, EMBED_FILE: rules.EMBED_FILE,
  };
  return `window.WC_RULES = ${JSON.stringify(plain)};`;
}

// /materials/_assets/lesson-map.json は Git に無い（本番は lesson-map.prod.json を改名して置いている）
function resolveFile(urlPath) {
  if (urlPath === '/materials/_assets/lesson-map.json') return path.join(ROOT, 'materials/_assets/lesson-map.prod.json');
  if (urlPath.startsWith('/materials/')) return path.join(ROOT, urlPath);
  if (urlPath.startsWith('/local/')) return path.join(REPO, urlPath.slice('/local/'.length));
  return null;
}

function serve(port) {
  const server = http.createServer((req, res) => {
    let urlPath;
    try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { urlPath = '/'; }
    if (urlPath === '/' || urlPath === '/index.html') return send(res, PREVIEW);
    if (urlPath === '/__rules.js') {
      res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' });
      return res.end(rulesScript());
    }
    const file = resolveFile(urlPath);
    // リポジトリの外は出さない
    if (!file || !path.resolve(file).startsWith(REPO)) return notFound(res, urlPath);
    send(res, file);
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`プレビュー: http://localhost:${port}/`);
    console.log('止めるときは Ctrl+C');
  });
  return server;
}

function send(res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return notFound(res, file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
}

function notFound(res, what) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(`見つかりません: ${what}`);
}

// 手元のファイルを、プレビューで開くときの URL に直す
function previewUrl(port, file) {
  const abs = path.resolve(file);
  const rel = path.relative(REPO, abs).split(path.sep).join('/');
  if (rel.startsWith('..')) return null;
  const src = rel.startsWith('assets/materials/') ? '/' + rel.slice('assets/'.length) : '/local/' + rel;
  return `http://localhost:${port}/?src=${encodeURIComponent(src)}`;
}

module.exports = { serve, previewUrl };
