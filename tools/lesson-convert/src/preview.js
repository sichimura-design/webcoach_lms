/**
 * 変換結果（LessonDoc JSON）を人が確認するための静的プレビューを作る。
 *
 * サーバー不要でダブルクリックして開ける形にする。
 * 画像・動画は取得物（materials/source/）を相対パスで参照する。
 */

const fs = require('fs');
const path = require('path');

const KIND_LABEL = {
  text: '本文',
  figure: '図解',
  video: '補足動画',
  example: '具体例',
  callout: '注意点',
  quiz: '確認問題',
  task: '課題',
  summary: 'まとめ',
};

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * ブロックのHTMLは取得物からの相対パス（../images/…）を持つ。
 * プレビューは materials/lessons/<course>/preview/ に置くので、参照先を付け替える。
 */
function rewriteAssetPaths(html, course) {
  return html
    .replace(/(["'(])\.\.\/images\//g, `$1../../../source/${course}/images/`)
    .replace(/(["'(])\.\.\/media\//g, `$1../../../source/${course}/media/`);
}

const STYLE = `
  :root { color-scheme: light dark; }
  body { font-family: "Hiragino Kaku Gothic ProN","Yu Gothic UI",Meiryo,system-ui,sans-serif;
         margin:0; padding:2rem 1.5rem 5rem; line-height:1.75; max-width:1000px; }
  a { color:#c00; text-decoration:none; } a:hover { text-decoration:underline; }
  h1 { font-size:1.5rem; margin:0 0 .3rem; }
  .sub { color:#777; font-size:.85rem; margin:0 0 1.2rem; }
  .meta { display:flex; flex-wrap:wrap; gap:.4rem 1.4rem; padding:.9rem 1.1rem; margin-bottom:1.5rem;
          border:1px solid #ddd; border-radius:8px; background:rgba(127,127,127,.06); font-size:.85rem; }
  .goals { margin:0 0 1.5rem; padding:1rem 1.2rem; border-left:3px solid #d33;
           background:rgba(127,127,127,.06); }
  .goals h2 { font-size:.8rem; margin:0 0 .5rem; color:#c00; letter-spacing:.06em; }
  .goals ul { margin:0; padding-left:1.2rem; }
  .block { border:1px solid #e2e2e2; border-radius:8px; margin:0 0 1rem; overflow:hidden; }
  .block > header { display:flex; flex-wrap:wrap; gap:.6rem; align-items:baseline;
                    padding:.4rem .8rem; background:rgba(127,127,127,.08); font-size:.72rem; color:#777; }
  .kind { font-weight:700; padding:.05rem .5rem; border-radius:999px; background:#c00; color:#fff; }
  .kind.figure{background:#0a7} .kind.video{background:#06c} .kind.quiz{background:#c60}
  .kind.task{background:#84c} .kind.callout{background:#c93} .kind.summary{background:#666}
  .kind.example{background:#399} .kind.text{background:#999}
  .bid { font-family:ui-monospace,monospace; }
  .body { padding:.9rem 1.1rem; }
  .body img { max-width:100%; height:auto; }
  .body table { border-collapse:collapse; width:100%; font-size:.9rem; }
  .body th,.body td { border:1px solid #ddd; padding:.3rem .5rem; }
  .body pre { background:rgba(127,127,127,.1); padding:.7rem; overflow-x:auto; font-size:.85rem; }
  .body video { max-width:100%; }
  .quizcard { margin:.8rem 0 0; padding:.8rem 1rem; border:1px dashed #c60; border-radius:8px;
              background:rgba(204,102,0,.06); }
  .quizcard h3 { font-size:.78rem; margin:0 0 .5rem; color:#c60; }
  .quizcard ol { margin:.3rem 0; padding-left:1.3rem; }
  .quizcard li.ok { font-weight:700; }
  .quizcard li.ok::after { content:" ✅ 正解"; color:#0a7; font-weight:400; font-size:.8rem; }
  .quizcard .ex { color:#666; font-size:.82rem; display:block; }
  .nav { display:flex; justify-content:space-between; gap:1rem; margin-top:2rem;
         padding-top:1rem; border-top:1px solid #ddd; font-size:.9rem; }
  .note { margin-top:2rem; padding:.9rem 1.1rem; border-left:3px solid #999;
          background:rgba(127,127,127,.06); font-size:.82rem; color:#555; }
  table.idx { width:100%; border-collapse:collapse; font-size:.88rem; }
  table.idx th,table.idx td { text-align:left; padding:.35rem .5rem; border-bottom:1px solid #e8e8e8; }
  table.idx th { font-size:.72rem; color:#888; }
  table.idx td.n { text-align:right; color:#666; font-variant-numeric:tabular-nums; }
  h2.course { font-size:1.1rem; margin:2.2rem 0 .5rem; padding-bottom:.3rem; border-bottom:2px solid #d33; }
  .count { font-weight:normal; font-size:.78rem; color:#888; margin-left:.5rem; }
`;

function renderQuiz(quiz) {
  if (!quiz) return '';
  const items = quiz.choices.map((c) =>
    `<li class="${c.correct ? 'ok' : ''}">${esc(c.text)}` +
    (c.explain ? `<span class="ex">${esc(c.explain)}</span>` : '') + '</li>'
  ).join('');
  return `
    <div class="quizcard">
      <h3>構造化されたクイズ（変換結果）</h3>
      <p><strong>${esc(quiz.question)}</strong></p>
      <ol type="A">${items}</ol>
    </div>`;
}

function renderLesson(doc, course) {
  const blocks = doc.blocks.map((b) => {
    let heading = '';
    return `
      <section class="block">
        <header>
          <span class="kind ${b.kind}">${KIND_LABEL[b.kind] || b.kind}</span>
          <span class="bid">${esc(b.id)}</span>
          ${b.heading ? `<span>見出し: ${esc(b.heading)}</span>` : ''}
          <span>${b.plain.length}字</span>
        </header>
        <div class="body">${rewriteAssetPaths(b.html, course)}${renderQuiz(b.quiz)}</div>
      </section>`;
  }).join('');

  const link = (l, label) => (l ? `<a href="${esc(String(l.lessonId).padStart(4, '0'))}-${esc(l.title.slice(0, 0))}${''}">${label}</a>` : '<span></span>');

  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.title)} — 変換結果</title><style>${STYLE}</style></head>
<body>
<p class="sub"><a href="../../index.html">← 全コースの一覧</a> ／ ${esc(course)} ／ レッスン ${doc.lessonId}</p>
<h1>${esc(doc.title)}</h1>
<p class="sub"><a href="${esc(doc.origin.url)}" target="_blank" rel="noreferrer">元ページを開く</a></p>

<div class="meta">
  <span>ブロック <b>${doc.blocks.length}</b></span>
  <span>所要時間 <b>${doc.estimatedMinutes || '—'}</b> 分</span>
  <span>ゴール <b>${doc.goals.length}</b></span>
  <span>まとめ <b>${doc.summary ? 'あり' : 'なし'}</b></span>
  <span>分割方法 <b>${esc(doc.origin.splitBy)}</b></span>
</div>

${doc.lead ? `<p>${esc(doc.lead)}</p>` : ''}
${doc.goals.length ? `<div class="goals"><h2>このレッスンのゴール</h2><ul>${doc.goals.map((g) => `<li>${esc(g)}</li>`).join('')}</ul></div>` : ''}

${blocks}

${doc.summary ? `<div class="goals"><h2>まとめ</h2><div>${doc.summary.split('\n').map((s) => `<p>${esc(s)}</p>`).join('')}</div></div>` : ''}
${doc.nextAction ? `<div class="goals"><h2>次にやること</h2><p>${esc(doc.nextAction)}</p></div>` : ''}

<div class="nav">
  <span>${doc.prev ? `← 前: ${esc(doc.prev.title)}` : ''}</span>
  <span>${doc.next ? `次: ${esc(doc.next.title)} →` : ''}</span>
</div>

<div class="note">
  この画面は<strong>変換結果の確認用</strong>です。ブロックの枠と種別バッジは変換で付けた区切りを見せるためのもので、
  実際の教材画面では表示されません。装飾（元サイトのCSS）は意図的に外してあります。
</div>
</body></html>`;
}

function renderIndex(courses) {
  const sections = courses.map(({ course, lessons, stats }) => `
    <h2 class="course">${esc(course)}<span class="count">${lessons.length}レッスン ／ ${stats.blocks}ブロック ／ クイズ${stats.quizzes}問</span></h2>
    <table class="idx">
      <thead><tr><th>#</th><th>レッスン</th><th>ブロック</th><th>本文</th><th>ゴール</th><th>クイズ</th><th>分</th></tr></thead>
      <tbody>${lessons.map((l) => `
        <tr>
          <td class="n">${l.lessonId}</td>
          <td><a href="${esc(course)}/preview/${esc(l.slug)}.html">${esc(l.title)}</a></td>
          <td class="n">${l.blocks}</td>
          <td class="n">${l.chars.toLocaleString()}</td>
          <td class="n">${l.goals || ''}</td>
          <td class="n">${l.quizzes || ''}</td>
          <td class="n">${l.minutes || ''}</td>
        </tr>`).join('')}</tbody>
    </table>`).join('');

  const total = courses.reduce((a, c) => ({
    lessons: a.lessons + c.lessons.length,
    blocks: a.blocks + c.stats.blocks,
    quizzes: a.quizzes + c.stats.quizzes,
    chars: a.chars + c.stats.chars,
  }), { lessons: 0, blocks: 0, quizzes: 0, chars: 0 });

  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>変換結果 — 全コース</title><style>${STYLE}</style></head>
<body>
<h1>変換結果（LessonDoc）— 全${courses.length}コース</h1>
<p class="sub">取得済みHTMLを構造化JSONへ変換した結果の確認用。LMSへは未投入。</p>
<div class="meta">
  <span><b>${total.lessons}</b> レッスン</span>
  <span><b>${total.blocks.toLocaleString()}</b> ブロック</span>
  <span><b>${total.chars.toLocaleString()}</b> 字</span>
  <span>選択式クイズ <b>${total.quizzes}</b> 問</span>
</div>
${sections}
<div class="note">
  レッスン名をクリックすると、ブロックの区切りと種別、構造化されたクイズ（設問・選択肢・正解・解説）が確認できます。
</div>
</body></html>`;
}

function runPreview({ configPath, log }) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const configDir = path.dirname(configPath);
  const outDir = path.resolve(configDir, config.outDir);

  const courses = [];
  for (const course of fs.readdirSync(outDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
    const dir = path.join(outDir, course);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json');
    const previewDir = path.join(dir, 'preview');
    fs.mkdirSync(previewDir, { recursive: true });

    const lessons = [];
    const stats = { blocks: 0, quizzes: 0, chars: 0 };
    for (const file of files) {
      const doc = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      fs.writeFileSync(path.join(previewDir, `${doc.slug}.html`), renderLesson(doc, course), 'utf8');
      const chars = doc.blocks.reduce((a, b) => a + b.plain.length, 0);
      const quizzes = doc.blocks.filter((b) => b.quiz).length;
      stats.blocks += doc.blocks.length;
      stats.quizzes += quizzes;
      stats.chars += chars;
      lessons.push({
        lessonId: doc.lessonId, slug: doc.slug, title: doc.title,
        blocks: doc.blocks.length, chars, goals: doc.goals.length,
        quizzes, minutes: doc.estimatedMinutes,
      });
    }
    lessons.sort((a, b) => a.lessonId - b.lessonId);
    courses.push({ course, lessons, stats });
    log(`  ${course.padEnd(16)} ${String(lessons.length).padStart(4)}ページ生成`);
  }

  courses.sort((a, b) => b.lessons.length - a.lessons.length);
  const indexFile = path.join(outDir, 'index.html');
  fs.writeFileSync(indexFile, renderIndex(courses), 'utf8');
  return { indexFile, courses };
}

module.exports = { runPreview };
