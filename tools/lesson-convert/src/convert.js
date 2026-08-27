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
const { buildScopedCss } = require('./css');

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

/**
 * URL から「章（セクション）」のパスを取り出す。
 * 例: /ai-designer/chapter-02/cfcse → ["chapter-02"]
 *     /knowledge/2eNJV             → []（章分けなし）
 * 教材の並び順と単元構成は Clipkit の URL 階層に現れているので、これを使う。
 */
function sectionPathOf(url, course) {
  try {
    const segments = decodeURIComponent(new URL(url).pathname).split('/').filter(Boolean);
    const start = segments.indexOf(course);
    const rest = start >= 0 ? segments.slice(start + 1) : segments;
    return rest.slice(0, -1); // 末尾は教材ID
  } catch (error) {
    return [];
  }
}

/** `chapter-2` と `chapter-10` を数値として比べる。 */
function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), 'ja', { numeric: true, sensitivity: 'base' });
}

/**
 * 学習順を決める。
 * 章ごとにまとめ、章の中は「前の章に戻る／次の章に進む」の鎖をたどる。
 * 鎖に載っていないものは URL 順で後ろに付ける（順序が決まらないものを捨てない）。
 */
function orderLessons(pages, course, resolveNeighborUrl) {
  const groups = new Map();
  for (const page of pages) {
    const key = sectionPathOf(page.url, course).join(' / ');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(page);
  }

  const sections = [];
  for (const key of [...groups.keys()].sort(naturalCompare)) {
    const members = groups.get(key).slice().sort((a, b) => naturalCompare(a.url, b.url));
    const byUrl = new Map(members.map((p) => [p.url, p]));

    // 章の中での前後関係（相手が同じ章にいるものだけ見る）
    const nextOf = new Map();
    const hasPrev = new Set();
    for (const page of members) {
      const nextUrl = resolveNeighborUrl(page, 'next');
      if (nextUrl && byUrl.has(nextUrl)) {
        nextOf.set(page.url, nextUrl);
        hasPrev.add(nextUrl);
      }
    }

    const ordered = [];
    const seen = new Set();
    for (const page of members) {
      if (hasPrev.has(page.url) || seen.has(page.url)) continue;
      let cursor = page;
      while (cursor && !seen.has(cursor.url)) {
        ordered.push(cursor);
        seen.add(cursor.url);
        const nextUrl = nextOf.get(cursor.url);
        cursor = nextUrl ? byUrl.get(nextUrl) : null;
      }
    }
    for (const page of members) if (!seen.has(page.url)) ordered.push(page);

    sections.push({ name: key, pages: ordered });
  }
  return sections;
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

  const okPages = manifest.pages.filter((p) => p.status === 'ok');

  // 前後リンクは HTML の中にしか無いので、並び順を決める前に先読みする。
  const neighborsBySlug = new Map();
  for (const page of okPages) {
    const htmlFile = path.join(courseDir, page.htmlPath);
    if (!fs.existsSync(htmlFile)) continue;
    const $head = cheerio.load(fs.readFileSync(htmlFile, 'utf8'));
    neighborsBySlug.set(page.slug, readNeighbors($head, $head('body').get(0), config));
  }
  const neighborUrl = (page, which) => {
    const raw = neighborsBySlug.get(page.slug)?.[which === 'next' ? 'nextUrl' : 'prevUrl'];
    const target = resolveNeighbor(raw, page.url, urlIndex);
    return target ? target.url : null;
  };

  // 学習順は URL の章構成と前後リンクの鎖から決める。
  // URL のアルファベット順に並べると、目次が学習順にならない。
  const sections = orderLessons(okPages, course, neighborUrl);
  const ordered = sections.flatMap((s) => s.pages);
  const lessonIdBySlug = new Map(ordered.map((p, i) => [p.slug, i + 1]));
  const sectionNameBySlug = new Map(
    sections.flatMap((s) => s.pages.map((p) => [p.slug, s.name]))
  );

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
    // 前後リンクはコース全体の学習順から作る。
    // Clipkit の「前の章に戻る／次の章に進む」は章の中で閉じているため、
    // そのまま使うと章の最後で行き止まりになり、受講生が次へ進めない。
    // （章内の並び順を決めるためには、上で既にそのリンクを使っている）
    const position = ordered.indexOf(page);
    const prevPage = position > 0 ? ordered[position - 1] : null;
    const nextPage = position >= 0 && position < ordered.length - 1 ? ordered[position + 1] : null;
    const link = (p) => (p && lessonIdBySlug.has(p.slug) ? { lessonId: lessonIdBySlug.get(p.slug), title: p.title } : null);

    // 教材が持っていた CSS を、教材枠だけに効く形にして持たせる。
    // 元サイトの見た目を再現するために使う（適用は画面側）。
    const cssSources = (page.stylePaths || [])
      .map((rel) => path.join(courseDir, rel))
      .filter((f) => fs.existsSync(f))
      .map((f) => fs.readFileSync(f, 'utf8'));
    const scopedCss = cssSources.length > 0 ? buildScopedCss(cssSources) : '';

    const doc = {
      courseSlug: course,
      courseName: course,
      lessonId: lessonIdBySlug.get(page.slug),
      slug: page.slug,
      // 単元名。Clipkit の URL 階層（chapter-02 など）に現れる区切り。
      section: sectionNameBySlug.get(page.slug) || '',
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
      css: scopedCss,
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
    sections: sections.map((s) => ({
      name: s.name,
      lessonIds: s.pages.map((p) => lessonIdBySlug.get(p.slug)).filter(Boolean),
    })),
    lessons: docs.map(({ doc }) => ({
      lessonId: doc.lessonId,
      slug: doc.slug,
      section: doc.section,
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
