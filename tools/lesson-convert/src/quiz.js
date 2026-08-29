/**
 * クイズの設問・選択肢・正解・解説を取り出す。
 *
 * 実物のマークアップ:
 *   <div class="quiz-box">
 *     <div class="quiz-q">設問</div>
 *     <div class="quiz-options">
 *       <div class="quiz-letter">A</div><div class="quiz-opt-text">選択肢A</div>  ← 平坦に並ぶ
 *       ...
 *     </div>
 *     <div class="quiz-feedback ok"><div class="quiz-feedback-text">正解時の解説</div></div>
 *     <div class="quiz-feedback ng"><div class="quiz-feedback-text">正解は<strong>◯◯</strong>です。…</div></div>
 *   </div>
 *
 * どの選択肢が正解かは選択肢側に印が無い。不正解フィードバックの
 * 「正解は<strong>◯◯</strong>です」を選択肢の文言と突き合わせて確定する。
 * 突き合わせに失敗したものは推測で埋めず、未確定として呼び出し側に返す。
 */

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

/** 突き合わせ用にゆるく正規化する（約物・空白・全角半角の揺れを吸収）。 */
function loose(s) {
  return norm(s)
    .normalize('NFKC')
    .replace(/[「」『』（）()［］\[\]｛｝{}、。，．,.・:：;；!！?？'"'"\s]/g, '')
    .toLowerCase();
}

/**
 * 選択肢を読む。教材は `<button class="quiz-opt" data-q="q1" data-correct="true">` で
 * 正解を持っているので、それがあれば正解の判定はここで確定する。
 */
function readOptionButtons($, $box) {
  const buttons = $box.find('button.quiz-opt, .quiz-opt[data-correct]').toArray();
  if (buttons.length === 0) return null;
  return buttons.map((el) => {
    const $b = $(el);
    const letter = norm($b.find('.quiz-letter').first().text());
    const text = norm($b.find('.quiz-opt-text').first().text()) || norm($b.text());
    return { letter, text, correct: $b.attr('data-correct') === 'true' };
  });
}

/** quiz-letter と quiz-opt-text は兄弟として交互に並ぶので、順番に組にする。 */
function readChoices($, $box) {
  const letters = $box.find('.quiz-letter').toArray().map((el) => norm($(el).text()));
  const texts = $box.find('.quiz-opt-text').toArray().map((el) => norm($(el).text()));

  // 別実装（.quiz-opt に文言ごと入っている）にも対応する
  if (texts.length === 0) {
    const opts = $box.find('.quiz-opt').toArray().map((el) => norm($(el).text()));
    return opts.map((text, i) => ({ letter: letters[i] || '', text }));
  }
  return texts.map((text, i) => ({ letter: letters[i] || '', text }));
}

/** フィードバックの「正解は◯◯です」から正解の文言を取り出す。 */
function readAnswerText($, $box) {
  const ng = $box.find('.quiz-feedback.ng .quiz-feedback-text').first();
  const ok = $box.find('.quiz-feedback.ok .quiz-feedback-text').first();

  for (const $fb of [ng, ok]) {
    if ($fb.length === 0) continue;
    // <strong> で強調されているものが最も確度が高い
    const strong = $fb.find('strong, b').first();
    if (strong.length > 0) {
      const text = norm(strong.text());
      if (text) return text;
    }
    const m = norm($fb.text()).match(/正解は\s*([^。！!]+?)\s*(?:です|でした)/);
    if (m) return m[1];
  }
  return '';
}

/**
 * 1つの quiz-box を構造化する。
 * 返り値の resolved が false のときは正解を確定できていない（推測はしない）。
 */
function parseQuizBox($, box) {
  const $box = $(box);
  const question = norm($box.find('.quiz-q').first().text());
  const okExplain = norm($box.find('.quiz-feedback.ok .quiz-feedback-text').first().text());
  const ngExplain = norm($box.find('.quiz-feedback.ng .quiz-feedback-text').first().text());

  // 1. data-correct があれば、それが唯一確実な正解。推測は不要。
  const marked = readOptionButtons($, $box);
  if (marked && marked.some((c) => c.correct)) {
    return {
      resolved: true,
      reason: null,
      via: 'data-correct',
      quiz: {
        question,
        choices: marked.map((c) => ({
          text: c.letter ? `${c.letter}. ${c.text}` : c.text,
          correct: c.correct,
          explain: c.correct ? okExplain : ngExplain,
        })),
      },
    };
  }

  // 2. data-correct が無い教材向け。フィードバック文と選択肢を突き合わせる。
  const rawChoices = marked || readChoices($, $box);
  const answerText = readAnswerText($, $box);

  if (!question || rawChoices.length === 0) {
    return { resolved: false, reason: rawChoices.length === 0 ? '選択肢が見つからない' : '設問が見つからない' };
  }

  // 正解の突き合わせ: 完全一致 → 一方が他方を含む、の順に緩める
  const answer = loose(answerText);
  let correctIndex = -1;
  if (answer) {
    correctIndex = rawChoices.findIndex((c) => loose(c.text) === answer);
    if (correctIndex < 0) {
      correctIndex = rawChoices.findIndex((c) => {
        const t = loose(c.text);
        return t.length > 2 && (answer.includes(t) || t.includes(answer));
      });
    }
    // 「正解はB」のように記号だけで示している場合
    if (correctIndex < 0 && /^[a-dA-Dａ-ｄＡ-Ｄ]$/.test(answerText.trim())) {
      const letter = answerText.trim().normalize('NFKC').toUpperCase();
      correctIndex = rawChoices.findIndex((c) => c.letter.toUpperCase() === letter);
    }
  }

  const choices = rawChoices.map((c, i) => ({
    text: c.letter ? `${c.letter}. ${c.text}` : c.text,
    correct: i === correctIndex,
    explain: i === correctIndex ? okExplain : ngExplain,
  }));

  return {
    resolved: correctIndex >= 0,
    reason: correctIndex >= 0 ? null : answerText ? `正解「${answerText}」が選択肢と一致しない` : '正解の記述が見つからない',
    quiz: { question, choices },
    answerText,
  };
}

/**
 * クラスが無いページ向けの補完。本文から「A. 〜」の選択肢と「正解はB」を拾う。
 * 精度は落ちるので、確定できたものだけ返す。
 */
function parseQuizFromText(plainText) {
  const text = norm(plainText);
  const question = (text.match(/([^。！？]{6,60}[？?])/) || [])[1];
  const options = [...text.matchAll(/([ABCD])[.．、）)]\s*([^ABCD\n]{2,40}?)(?=\s*[ABCD][.．、）)]|\s*正解|$)/g)]
    .map((m) => ({ letter: m[1], text: norm(m[2]) }))
    .filter((o) => o.text.length >= 2);
  const answerLetter = (text.match(/正解は\s*([ABCD])/) || [])[1];
  const explain = norm((text.match(/正解は[ABCD][^。]*。\s*(.{10,200}?)(?:。|$)/) || [])[1] || '');

  if (!question || options.length < 2 || !answerLetter) {
    return { resolved: false, reason: '本文からも設問・選択肢・正解を揃えられない' };
  }
  return {
    resolved: true,
    reason: null,
    quiz: {
      question,
      choices: options.map((o) => ({
        text: `${o.letter}. ${o.text}`,
        correct: o.letter === answerLetter,
        explain: o.letter === answerLetter ? explain : '',
      })),
    },
    answerText: answerLetter,
  };
}

module.exports = { parseQuizBox, parseQuizFromText, loose };
