/**
 * 変換結果の機械検査。
 *
 * いちばん大事なのは「取得HTMLの本文が、ブロックに切る過程で落ちていないか」。
 * 文字数の突き合わせで取りこぼしを検出し、抽出できなかったものは隠さず一覧に出す。
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const { isNavigationOnly, isInPageToc } = require('./blocks');

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
const compact = (s) => norm(s).replace(/\s/g, '');

function runVerify({ configPath, log }) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const configDir = path.dirname(configPath);
  const sourceDir = path.resolve(configDir, config.sourceDir);
  const outDir = path.resolve(configDir, config.outDir);

  const courses = fs.readdirSync(outDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const rows = [];
  const kindTotals = {};

  for (const course of courses) {
    const files = fs.readdirSync(path.join(outDir, course)).filter((f) => f.endsWith('.json') && f !== 'index.json');
    for (const file of files) {
      const doc = JSON.parse(fs.readFileSync(path.join(outDir, course, file), 'utf8'));
      const problems = [];

      // 取得HTML側の本文（ページ全体のテキスト）
      const htmlFile = path.join(sourceDir, doc.origin.htmlPath);
      let sourceChars = 0;
      if (fs.existsSync(htmlFile)) {
        const $ = cheerio.load(fs.readFileSync(htmlFile, 'utf8'));
        // 変換で意図的に落とす部分（レッスン見出し・ゴール枠・自動生成の目次・章送り）は
        // 比較対象からも外す。これらは LessonDoc 側の別の項目になっている。
        $(['.lesson-hero', '.goal-box', '.toc', '.toc-head', '.index', 'nav',
          '.back-to-roadmap', '.pagenation-buttons'].join(', ')).remove();
        // クラスの無い章送り・ページ内目次も、変換で落としているので比較対象から外す
        $('div, p, ul, ol').each((_, el) => {
          const $el = $(el);
          if (isNavigationOnly($, $el, config) || isInPageToc($, $el)) $el.remove();
        });
        sourceChars = compact($('body').text()).length;
      } else {
        problems.push('取得HTMLが見つからない');
      }

      // 見出しはブロックの plain ではなく heading に入るので、カバー率の計算に含める。
      const headings = [...new Set(doc.blocks.map((b) => b.heading).filter(Boolean))];
      const blockChars = compact(doc.blocks.map((b) => b.plain).join('') + headings.join('')).length;
      const coverage = sourceChars > 0 ? blockChars / sourceChars : 0;

      for (const b of doc.blocks) kindTotals[b.kind] = (kindTotals[b.kind] || 0) + 1;

      if (doc.blocks.length === 0) problems.push('ブロックが0件');
      if (sourceChars > 0 && coverage < 0.9) {
        problems.push(`本文の取りこぼし: ブロック合計が取得HTMLの${(coverage * 100).toFixed(0)}%`);
      }
      if (!doc.title) problems.push('タイトルが空');
      if (new Set(doc.blocks.map((b) => b.id)).size !== doc.blocks.length) problems.push('ブロックIDが重複');
      // 選択式クイズ（quiz-box）だけが構造化の対象。
      // 理解度チェック（check-box）は自己採点用の一問一答で、選択肢が無いのが正しい。
      const quizBlocks = doc.blocks.filter((b) => b.kind === 'quiz');
      const choiceQuizzes = quizBlocks.filter((b) => /class="[^"]*\bquiz-box\b/.test(b.html));
      const structured = choiceQuizzes.filter((b) => b.quiz);
      if (choiceQuizzes.length > structured.length) {
        problems.push(`選択式クイズが構造化できていない: ${choiceQuizzes.length - structured.length}件`);
      }

      rows.push({
        course, slug: doc.slug, title: doc.title,
        blocks: doc.blocks.length,
        sourceChars, blockChars, coverage,
        goals: doc.goals.length,
        minutes: doc.estimatedMinutes,
        summary: doc.summary ? 1 : 0,
        prev: doc.prev ? 1 : 0,
        next: doc.next ? 1 : 0,
        quizBlocks: choiceQuizzes.length,
        quizStructured: structured.length,
        selfChecks: quizBlocks.length - choiceQuizzes.length,
        problems,
      });
    }
  }

  return { rows, kindTotals, outDir, sourceDir };
}

module.exports = { runVerify };
