/**
 * 取得済みHTML → LessonDoc JSON への変換。
 *
 * 出力は materials/lessons/<コース>/<page-slug>.json と、コースごとの index.json。
 * 取得物（materials/source/）は読み取りだけで、一切書き換えない。
 *
 * 書き込みは「内容が変わったときだけ」。同じ入力から何度変換しても結果が変わらないようにする。
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const { buildBlocks } = require('./blocks');
const { readGoals, readSummary, readMinutes, readNeighbors, readLead, readNextAction } = require('./meta');

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

function writeJsonIfChanged(file, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (fs.existsSync(file)) {
    try {
      if (fs.readFileSync(file, 'utf8') === text) return false;
    } catch (error) {
      /* 読めなければ書き直す */
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, file);
  return true;
}

/**
 * サイトテーマの装飾アイコン（矢印など）を落とす。
 * 元サイトは CSS で 8px 程度に縮めて表示していたので、そのまま持ち出すと
 * 教材本文の中に巨大な画像として出てしまう。教材の中身でもない。
 *
 * 保存後のファイル名からは判別できないので、manifest の取得元URLで判定する。
 */
function dropDecorativeImages($, page, config) {
  const pattern = config.blocks.decorativeImageSource;
  if (!pattern) return 0;
  const re = new RegExp(pattern);

  const decorative = new Set(
    (page.images || [])
      .filter((image) => image.path && re.test(decodeURIComponent(image.sourceUrl || '')))
      .map((image) => path.basename(image.path))
  );
  if (decorative.size === 0) return 0;

  let removed = 0;
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (!decorative.has(path.basename(src))) return;
    // リンクの中の飾りなら、リンクの文字は残して画像だけ消す
    $(el).remove();
    removed += 1;
  });
  return removed;
}

/** URL の末尾から page-slug を引くための索引。前後リンクの解決に使う。 */
function buildUrlIndex(manifest) {
  const index = new Map();
  for (const page of manifest.pages) {
    if (page.status !== 'ok') continue;
    index.set(page.url, page);
    try {
      index.set(decodeURIComponent(new URL(page.url).pathname), page);
    } catch (error) {
      /* URL でなければ索引に入れない */
    }
  }
  return index;
}

/** 相対リンク・絶対リンクの両方を、同じコース内のページへ解決する。 */
function resolveNeighbor(href, pageUrl, urlIndex) {
  if (!href) return null;
  let target;
  try {
    target = new URL(href, pageUrl);
  } catch (error) {
    return null;
  }
  return urlIndex.get(target.href) || urlIndex.get(decodeURIComponent(target.pathname)) || null;
}

function convertCourse({ course, sourceDir, outDir, config, log }) {
  const courseDir = path.join(sourceDir, course);
  const manifest = JSON.parse(fs.readFileSync(path.join(courseDir, 'manifest.json'), 'utf8'));
  const urlIndex = buildUrlIndex(manifest);

  // lessonId は URL 順で安定させる（再実行しても同じ番号になる）
  const ordered = manifest.pages.filter((p) => p.status === 'ok').sort((a, b) => a.url.localeCompare(b.url));
  const lessonIdBySlug = new Map(ordered.map((p, i) => [p.slug, i + 1]));

  const docs = [];
  const issues = [];
  let written = 0;

  for (const page of ordered) {
    const htmlFile = path.join(courseDir, page.htmlPath);
    if (!fs.existsSync(htmlFile)) {
      issues.push({ course, slug: page.slug, kind: 'missing-html', detail: page.htmlPath });
      continue;
    }

    const $ = cheerio.load(fs.readFileSync(htmlFile, 'utf8'));
    dropDecorativeImages($, page, config);
    const root = $('body').get(0);
    const wholePlain = norm($('body').text());

    const { blocks, quizIssues, splitBy } = buildBlocks($, root, { slug: page.slug, config });
    const goals = readGoals($, root, config);
    const summary = readSummary($, root, config);
    const minutes = readMinutes(wholePlain, config);
    const neighbors = readNeighbors($, root, config);

    const prevPage = resolveNeighbor(neighbors.prevUrl, page.url, urlIndex);
    const nextPage = resolveNeighbor(neighbors.nextUrl, page.url, urlIndex);
    const link = (p) => (p && lessonIdBySlug.has(p.slug) ? { lessonId: lessonIdBySlug.get(p.slug), title: p.title } : null);

    const doc = {
      courseSlug: course,
      courseName: course,
      lessonId: lessonIdBySlug.get(page.slug),
      slug: page.slug,
      title: page.title,
      lead: readLead(blocks),
      goals,
      estimatedMinutes: minutes,
      blocks: blocks.map(({ why, ...rest }) => rest),
      summary,
      nextAction: readNextAction(blocks),
      prev: link(prevPage),
      next: link(nextPage),
      source: 'structured',
      origin: {
        url: page.url,
        htmlPath: `${course}/${page.htmlPath}`,
        extractedBy: page.extractedBy,
        splitBy,
      },
    };

    if (writeJsonIfChanged(path.join(outDir, course, `${page.slug}.json`), doc)) written += 1;

    for (const q of quizIssues) issues.push({ course, slug: page.slug, kind: 'quiz-unresolved', ...q });
    docs.push({ doc, blocks, page });
  }

  // コースの目次
  const index = {
    courseSlug: course,
    courseName: course,
    lessonCount: docs.length,
    lessons: docs.map(({ doc }) => ({
      lessonId: doc.lessonId,
      slug: doc.slug,
      title: doc.title,
      minutes: doc.estimatedMinutes,
      blocks: doc.blocks.length,
    })),
  };
  if (writeJsonIfChanged(path.join(outDir, course, 'index.json'), index)) written += 1;

  log(
    `  ${course.padEnd(16)} ${String(docs.length).padStart(4)}レッスン / ` +
      `${String(docs.reduce((a, d) => a + d.doc.blocks.length, 0)).padStart(6)}ブロック / ` +
      `書き込み ${String(written).padStart(4)} / クイズ未確定 ${quizCount(issues, course)}`
  );

  return { docs, issues };
}

function quizCount(issues, course) {
  return issues.filter((i) => i.course === course && i.kind === 'quiz-unresolved').length;
}

function runConvert({ configPath, courseFilter, log }) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const configDir = path.dirname(configPath);
  const sourceDir = path.resolve(configDir, config.sourceDir);
  const outDir = path.resolve(configDir, config.outDir);

  const courses = fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(sourceDir, d.name, 'manifest.json')))
    .map((d) => d.name)
    .filter((c) => !courseFilter || c === courseFilter);

  if (courses.length === 0) throw new Error(`対象コースがありません（sourceDir: ${sourceDir}）`);

  log(`sourceDir: ${sourceDir}`);
  log(`outDir   : ${outDir}\n`);

  const allDocs = [];
  const allIssues = [];
  for (const course of courses) {
    const { docs, issues } = convertCourse({ course, sourceDir, outDir, config, log });
    allDocs.push(...docs);
    allIssues.push(...issues);
  }

  return { docs: allDocs, issues: allIssues, outDir, sourceDir, config };
}

module.exports = { runConvert, writeJsonIfChanged };
