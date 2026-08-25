/**
 * 教材HTMLをブロック列に切り、それぞれの種別を判定する。
 *
 * 切り方は2通り:
 *   A. Clipkit のブロック（data-item-type）がある → その境界をそのまま使う
 *   B. 無い（自前HTMLで書かれた教材） → トップレベルの子要素を1ブロックとする
 * どちらも「見出し（h2/h3）を見つけたら、以降のブロックの heading を切り替える」点は同じ。
 */

const { parseQuizBox, parseQuizFromText } = require('./quiz');

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

function hasClass($el, names) {
  const cls = ($el.attr('class') || '').split(/\s+/);
  return names.some((n) => cls.includes(n));
}

/** テキストからタグを除いた plain。検索とAIの根拠付けに使う。 */
function plainOf($, el) {
  return norm($(el).text());
}

/**
 * ブロックの種別を決める。上から順に評価し、最初に当たったものを採用する。
 * 判定の根拠（why）も返して、あとから分類を見直せるようにする。
 */
function classify($, el, config, heading) {
  const $el = $(el);
  const b = config.blocks;
  const itemType = $el.attr('data-item-type') || '';
  const text = plainOf($, el);
  const headText = norm(heading);

  if (hasClass($el, b.quizClass) || $el.find(`.${b.quizClass[0]}`).length > 0) {
    return { kind: 'quiz', why: 'quiz-box' };
  }
  if (hasClass($el, b.selfCheckClass) || $el.find(`.${b.selfCheckClass[0]}`).length > 0) {
    return { kind: 'quiz', why: 'check-box（理解度チェック）' };
  }
  if (hasClass($el, b.summaryClass) || $el.find(`.${b.summaryClass[0]}`).length > 0) {
    return { kind: 'summary', why: 'summary-box' };
  }
  if (itemType && config.itemTypeKind[itemType]) {
    return { kind: config.itemTypeKind[itemType], why: `data-item-type=${itemType}` };
  }
  if ($el.find('video').length > 0 || $el.find('iframe').length > 0) {
    return { kind: 'video', why: 'video/iframe を含む' };
  }
  if (new RegExp(b.taskText).test(headText) || new RegExp(b.taskText).test(text.slice(0, 40))) {
    return { kind: 'task', why: '課題・演習の語' };
  }
  if (new RegExp(b.calloutText).test(text.slice(0, 30))) {
    return { kind: 'callout', why: 'TIPS・注意の語' };
  }
  if (new RegExp(b.exampleText).test(headText) || new RegExp(b.exampleText).test(text.slice(0, 30))) {
    return { kind: 'example', why: '具体例・比較の語' };
  }
  // 画像だけで文章がほとんど無いブロック
  if ($el.find('img').length > 0 && text.length < 80) {
    return { kind: 'figure', why: '画像中心' };
  }
  return { kind: 'text', why: '既定' };
}

/**
 * ブロックの代表画像を返す。
 *
 * 画面側は media を `<img>` として描く。動画や iframe の URL を入れると
 * 画像として読み込もうとして壊れるので、**画像だけ**を対象にする。
 * 動画・埋め込みは html の中の <video>／<iframe> のまま描かせる。
 */
function mediaOf($, el) {
  const $el = $(el);
  const img = $el.find('img[src]').first();
  if (img.length > 0) {
    const caption = norm($el.find('figcaption, h4').first().text());
    return {
      src: img.attr('src'),
      alt: img.attr('alt') || undefined,
      caption: caption || undefined,
    };
  }
  return undefined;
}

/**
 * ブロックに切る単位の親を選ぶ。
 * 教材HTMLは body > div.lesson-wrapper のように包まれていることがあり、
 * そのまま body の子を見ると「1ページ＝1ブロック」になってしまう。
 * 子が1つしかない入れ物は中身へ降りる。
 */
function pickSplitRoot($, root) {
  let current = root;
  for (let depth = 0; depth < 5; depth += 1) {
    const children = $(current).children().toArray();
    if (children.length !== 1) break;
    const only = children[0];
    // 中身そのもの（表・リスト・段落など）まで降りてしまわないようにする
    if (/^(table|ul|ol|dl|pre|figure|p|h[1-6]|img|video|iframe)$/i.test(only.tagName || '')) break;
    current = only;
  }
  return current;
}

/**
 * 章立ての入れ物（section など）は、そのままだと数千字の巨大な1ブロックになる。
 * 意味のある単位（quiz-box などの定型ブロック）はそのまま残しつつ、
 * ただの入れ物は子要素へ展開する。
 */
function expandContainers($, nodes, config, depth) {
  if (depth >= 3) return nodes;
  const b = config.blocks;
  const keepWhole = [...b.quizClass, ...b.selfCheckClass, ...b.summaryClass, ...b.goalClass];
  const out = [];

  for (const el of nodes) {
    const $el = $(el);
    const tag = (el.tagName || '').toLowerCase();
    const text = norm($el.text());
    const children = $el.children().toArray();

    // 子要素だけで中身をほぼ説明できるときに限って展開する。
    // 本文が入れ物の直下のテキストノードに書かれていることがあり、
    // そのまま子要素へ降りると本文ごと落ちてしまう。
    const childrenText = children.reduce((sum, c) => sum + norm($(c).text()).length, 0);
    const isPlainContainer =
      /^(section|article|div)$/.test(tag) &&
      !hasClass($el, keepWhole) &&
      children.length >= 2 &&
      text.length > 400 &&
      childrenText >= text.length * 0.9;

    if (isPlainContainer) out.push(...expandContainers($, children, config, depth + 1));
    else out.push(el);
  }
  return out;
}

/**
 * 「前の章に戻る／次の章に進む」だけの塊か。
 * 教材によってはクラスが付いていないので、中身で判定するしかない。
 * 前後リンクは LessonDoc の prev/next に入るので、本文からは外す。
 */
function isNavigationOnly($, $el, config) {
  const text = norm($el.text());
  if (!text || text.length > 60) return false;
  const stripped = text
    .replace(new RegExp(config.meta.prevText, 'g'), '')
    .replace(new RegExp(config.meta.nextText, 'g'), '')
    .replace(/[›»‹«<>←→・|/\s]/g, '');
  return stripped.length === 0;
}

/**
 * ページ内目次か。リンクがすべて同一ページ内アンカー（`#…`）で、
 * リンク以外のテキストがほとんど無いものを目次とみなす。
 * 見出し一覧は LessonDoc の blocks の heading から再構成できるので本文には要らない。
 */
function isInPageToc($, $el) {
  const links = $el.find('a[href]').toArray();
  if (links.length < 2) return false;
  if (!links.every((a) => ($(a).attr('href') || '').startsWith('#'))) return false;
  const linkText = links.reduce((n, a) => n + norm($(a).text()).length, 0);
  const total = norm($el.text()).length;
  return total > 0 && linkText >= total * 0.8;
}

/** 見出し要素なら、その文言を返す（ブロックにはせず heading の切り替えに使う）。 */
function headingTextOf($, el) {
  const $el = $(el);
  if (/^h[1-4]$/i.test(el.tagName || '')) return norm($el.text());
  if (($el.attr('data-item-type') || '') === 'ItemHeading') return norm($el.text());
  const own = $el.children('h2, h3').first();
  if (own.length > 0 && norm($el.text()) === norm(own.text())) return norm(own.text());
  return null;
}

/**
 * ページ本文を LessonBlock 相当の配列にする。
 * 返り値には変換の診断情報（quizIssues）も含める。
 */
function buildBlocks($, root, { slug, config }) {
  const b = config.blocks;
  const blocks = [];
  const quizIssues = [];
  let heading = '';
  let counter = 0;

  // Clipkit のブロックは入れ子になっていることがある（ItemHtml の中に別のブロック）。
  // 親と子の両方をブロックにすると本文が二重に入るので、最も外側だけを採る。
  const items = $(root)
    .find('[data-item-type]')
    .toArray()
    .filter((el) => $(el).parents('[data-item-type]').length === 0);
  const useItems = items.length > 0;
  const nodes = useItems
    ? items
    : expandContainers($, $(pickSplitRoot($, root)).children().toArray(), config, 0);

  for (const el of nodes) {
    const $el = $(el);

    // ページ内ナビ・目次は本文ではないので落とす
    if (hasClass($el, b.chapterNavClass) || $el.find(`.${b.chapterNavClass[0]}`).length > 0) continue;
    if (hasClass($el, b.tocClass) || (el.tagName === 'nav')) continue;
    // クラスが付いていない章送り・ページ内目次は中身で判定して落とす
    if (isNavigationOnly($, $el, config)) continue;
    if (isInPageToc($, $el)) continue;
    if (hasClass($el, b.heroClass)) continue;
    if (hasClass($el, b.goalClass)) continue; // goals は meta 側で拾う

    const headingText = headingTextOf($, el);
    if (headingText) {
      heading = headingText;
      continue;
    }

    const html = $.html($el).trim();
    const plain = plainOf($, el);
    // 「3」のようなステップ番号だけの断片はブロックにしない。
    // ブロックはクリップの保存位置とAIが参照する教材箇所の単位なので、
    // それ自体で意味を持たないものを単位にしても使えない。
    const hasVisual = $el.find('img, video, iframe, table').length > 0;
    if (plain.length < 3 && !hasVisual) continue;

    const { kind, why } = classify($, el, config, heading);
    const itemId = $el.attr('data-item-id');
    counter += 1;
    const id = itemId ? `ck-${itemId}` : `${slug}-${String(counter).padStart(3, '0')}`;

    const block = { id, heading, kind, html, plain, why };

    if (kind === 'quiz') {
      const $quiz = hasClass($el, b.quizClass) ? $el : $el.find(`.${b.quizClass[0]}`).first();
      if ($quiz.length > 0) {
        const parsed = parseQuizBox($, $quiz.get(0));
        if (parsed.resolved) {
          block.quiz = parsed.quiz;
          // 構造化できたクイズは、画面側が専用UIで出題する。
          // 元のHTMLには正解・不正解のフィードバックが両方入っており
          // （表示の出し分けは落とした JS がやっていた）、そのまま描くと
          // 答えが最初から見えてしまううえ、クイズが二重に表示される。
          if ($quiz.get(0) === el) {
            // ブロックそのものがクイズ。本文として描くものは残らない。
            block.html = '';
            block.plain = '';
          } else {
            // クイズが本文の一部に入っている。その部分だけ取り除く。
            $quiz.remove();
            block.html = $.html($el).trim();
            block.plain = plainOf($, el);
          }
        } else quizIssues.push({ blockId: id, heading, reason: parsed.reason, source: 'quiz-box' });
      } else if (/正解は/.test(plain)) {
        const parsed = parseQuizFromText(plain);
        if (parsed.resolved) block.quiz = parsed.quiz;
        else quizIssues.push({ blockId: id, heading, reason: parsed.reason, source: '本文' });
      }
    }

    if (kind === 'figure' || kind === 'video') {
      const media = mediaOf($, el);
      if (media) {
        block.media = media;
        // 画面側は media を <figure> として描いたうえで html も描く。
        // 同じ画像・動画が html にも入ったままだと二重に表示されるので、
        // media にした要素は html から取り除く。
        // 説明文やキャプションなど、画像以外の中身は html に残す。
        const $used = $el.find(`img[src="${media.src}"]`).first();
        if ($used.length > 0) {
          // 画像だけを包んでいる入れ物（lightbox のリンクなど）ごと落とす。
          // 「親の中身がその画像だけ」のときに限って登る。テキストが空同士でも
          // 一致してしまうため、子の数と親自身のテキストの有無で判断する。
          let $target = $used;
          for (let depth = 0; depth < 4; depth += 1) {
            const $parent = $target.parent();
            if ($parent.length === 0 || $parent.get(0) === el) break;
            const onlyChild = $parent.children().length === 1;
            const ownText = norm($parent.text()) === norm($target.text());
            if (!onlyChild || !ownText) break;
            $target = $parent;
          }
          $target.remove();
          block.html = norm($el.text()) || $el.find('img, video, iframe, table').length > 0
            ? $.html($el).trim()
            : '';
          block.plain = plainOf($, el);
        }
      }
    }

    blocks.push(block);
  }

  return { blocks, quizIssues, splitBy: useItems ? 'data-item-type' : 'トップレベル要素' };
}

module.exports = { buildBlocks, plainOf, norm, hasClass, isNavigationOnly, isInPageToc };
