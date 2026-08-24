/**
 * LessonDoc のメタ情報（ゴール・所要時間・まとめ・リード文・前後リンク）を取り出す。
 * 見つからない項目は空のままにする。推測で埋めない。
 */

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

/** goal-box の各項目。`goal-box__text` があればそれ、無ければ li のテキスト。 */
function readGoals($, root, config) {
  const goals = [];
  for (const name of config.blocks.goalClass) {
    const $box = $(root).find(`.${name}`).first();
    if ($box.length === 0) continue;
    const texts = $box.find('.goal-box__text').toArray().map((el) => norm($(el).text()));
    const items = texts.length > 0 ? texts : $box.find('li').toArray().map((el) => norm($(el).text()));
    for (const t of items) {
      // 見出し部分（GOAL / このレッスンのゴール）は拾わない
      if (!t || /^(GOAL|このレッスンのゴール|この章で到達できるゴール)$/i.test(t)) continue;
      goals.push(t.replace(/^✓\s*/, ''));
    }
    if (goals.length > 0) break;
  }
  return goals;
}

/** summary-box の本文。箇条書きは1項目1行にして返す。 */
function readSummary($, root, config) {
  for (const name of config.blocks.summaryClass) {
    const $box = $(root).find(`.${name}`).first();
    if ($box.length === 0) continue;
    const items = $box.find('li').toArray().map((el) => norm($(el).text())).filter(Boolean);
    if (items.length > 0) return items.join('\n');
    const text = norm($box.text()).replace(/^SUMMARY\s*/i, '');
    if (text) return text;
  }
  return '';
}

/** 「所要時間：約85分」「目安の学習時間: 2時間」などから分に直す。 */
function readMinutes(plainText, config) {
  const m = norm(plainText).match(new RegExp(config.meta.minutesPattern));
  if (!m) return 0;
  const value = Number(m[1]);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return /時間|h|時/.test(m[2]) ? value * 60 : value;
}

/**
 * 前後の章。HTML内のリンク文言から拾い、manifest の internalLinks で補う。
 * 相手のページIDは、この時点では URL しか分からないので URL を持たせておく
 * （LessonDoc の lessonId 採番は emit 側でコース全体を見てから振る）。
 */
function readNeighbors($, root, config) {
  const result = { prevUrl: null, nextUrl: null };
  const prevRe = new RegExp(config.meta.prevText);
  const nextRe = new RegExp(config.meta.nextText);
  for (const el of $(root).find('a[href]').toArray()) {
    const text = norm($(el).text());
    const href = $(el).attr('href');
    if (!href || href.startsWith('#')) continue;
    if (!result.prevUrl && prevRe.test(text)) result.prevUrl = href;
    if (!result.nextUrl && nextRe.test(text)) result.nextUrl = href;
  }
  return result;
}

/** リード文。最初の本文ブロックの先頭1〜2文を使う。 */
function readLead(blocks) {
  const first = blocks.find((b) => b.kind === 'text' && b.plain.length > 40);
  if (!first) return '';
  const sentences = first.plain.split(/(?<=[。！？])/).filter(Boolean);
  return norm(sentences.slice(0, 2).join('')).slice(0, 200);
}

/** 次にやること。課題ブロックがあればその冒頭、無ければ空。 */
function readNextAction(blocks) {
  const task = blocks.find((b) => b.kind === 'task');
  if (!task) return '';
  return norm(task.plain).slice(0, 160);
}

module.exports = { readGoals, readSummary, readMinutes, readNeighbors, readLead, readNextAction };
