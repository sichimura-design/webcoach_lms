/**
 * frontend/src/utils/aiSkillRouting.ts
 * ユーザーの入力から「どの専門モードが適しているか」を判定する。
 *
 * ここに判定ロジックを純粋関数として置き、UI（hooks/useLessonAi.ts）とモック
 * （mocks/lessonHandlers.ts）の双方から import する。utils/learningPlanTemplate.ts と
 * 同じ方針で、ハンドラ側に判断を書かない。UIが出す確認カードとサーバが返す提案が
 * 食い違うと「AIが言っていることと画面が違う」状態になるため。
 *
 * 設計上の判断:
 *  1. 判定しても自動では切り替えない（仕様§4）。この関数は strength を返すだけで、
 *     モードを変えるかどうかは呼び出し側とユーザーが決める。
 *     「このデザインどう思う？」に対してユーザーは軽い意見だけを求めている可能性があり、
 *     毎回専門モードへ飛ばすのは体験を壊す。
 *  2. 追従（stickiness）を持たせる。すでに専門モードに入っているなら、別スキルの
 *     明確なシグナルが出るまで提案し直さない。これが無いと発話ごとにモードが揺れる。
 *  3. 本番ではこの判定はBFF側で行うべき。フロント側の判定は「確認カードを先に出す」
 *     ための先読みであり、サーバが返す suggestion を最終的な正とする。
 */

import { AiSkillId, SkillSuggestion } from '../types/aiSkill';

export interface DetectSkillInput {
  /** ユーザーの質問文 */
  question: string;
  /** 画像を添付しているか */
  hasImage: boolean;
  /** 引用している教材本文 */
  quote: string | null;
  /** 現在のモード。'auto' 以外なら追従を優先する */
  currentSkillId: AiSkillId;
  /** いま読んでいる教材の見出し（参照予定に出す） */
  contextHeading: string | null;
  /** この教材の課題ブロックの見出し（参照予定に出す） */
  taskHeading: string | null;
}

/** 添削・講評を明確に依頼している語 */
const REVIEW_WORDS = [
  '添削',
  'レビュー',
  '講評',
  '評価して',
  'チェックして',
  '見てほしい',
  '見てください',
  'どこを直',
  '直すべき',
  '改善点',
  'フィードバック',
  'アドバイスして',
];

/** 制作物・見た目の話題であることを示す語 */
const DESIGN_WORDS = [
  'デザイン',
  'バナー',
  'サムネ',
  'LP',
  'ランディング',
  '配色',
  '色',
  'レイアウト',
  '文字組',
  '余白',
  '見た目',
  '構図',
  '視線誘導',
  'フォント',
  '作った',
  '制作物',
  '成果物',
  '提出',
];

/** 動画の編集そのものが対象であることを示す語（静止画の制作物とは別のアプリへ送る） */
const VIDEO_WORDS = ['動画', 'テロップ', 'カット編集', 'BGM', 'Premiere', 'CapCut', 'ショート'];

/** コピー・見出しを作りたいことを示す語 */
const COPY_WORDS = ['キャッチコピー', 'キャッチ', 'コピー', '見出し', 'タイトル', '惹句', 'キャッチフレーズ'];

/** コピーを「作ってほしい」という動作の語 */
const COPY_ACTION_WORDS = ['考えて', '作って', 'つくって', '案を', 'アイデア', '出して', '提案して'];

/** 面接・面談の練習を示す語 */
const INTERVIEW_WORDS = ['面接', '面談', '商談', '顧客との打ち合わせ', '自己紹介の練習'];

/** 応募・提案の文書を作りたいことを示す語 */
const APPLICATION_WORDS = ['応募', '提案文', '営業文', 'エントリー', '職務経歴', '履歴書'];

/** 案件そのものを探していることを示す語 */
const JOB_WORDS = [
  '案件',
  '仕事を探',
  '受注',
  'クラウドソーシング',
  'ランサーズ',
  'クラウドワークス',
  'ココナラ',
  '副業',
  '単価',
];

/** 言葉の意味が分からないことを示す語 */
const GLOSSARY_WORDS = [
  '用語',
  'どういう意味',
  'どんな意味',
  '意味がわから',
  '意味を教えて',
  'かみ砕いて',
  'わかりやすく',
  '噛み砕いて',
  '初心者向けに',
  '言い換え',
  '専門用語',
];

/**
 * 案件抽出メーカーは媒体ごとに別アプリなので、名指しされた媒体へ送る。
 * 🔴 名指しが無いときの既定はクラウドワークス（アプリ一覧の並びの先頭）。
 *    どれを勧めても恣意的になるが、提案カードなので押さなければ何も起きない。
 */
const JOB_SITE_SKILLS: Array<{ words: string[]; skillId: AiSkillId }> = [
  { words: ['ココナラ', 'coconala'], skillId: 'job-search-coconala' },
  { words: ['ランサーズ', 'Lancers', 'lancers'], skillId: 'job-search-lancers' },
  { words: ['クラウドワークス', 'CrowdWorks', 'crowdworks'], skillId: 'job-search-crowdworks' },
];

/** 「文章を貼り付けた」と判断する長さ。これ未満は普通の質問文として扱う */
const PASTED_TEXT_MIN = 200;

const hit = (text: string, words: string[]): string | null =>
  words.find((word) => text.includes(word)) ?? null;

/** 参照予定リストを組み立てる。存在しないものは並べない（空欄を見せない） */
function buildReferences(
  skillId: AiSkillId,
  input: DetectSkillInput
): string[] {
  const refs: string[] = [];
  if (input.contextHeading) refs.push(input.contextHeading);

  if (skillId === 'design-review' || skillId === 'video-review') {
    if (input.taskHeading) refs.push(`${input.taskHeading}の評価基準`);
    if (input.hasImage) refs.push('添付画像');
  }
  if (skillId === 'glossary') {
    refs.push(input.quote ? '選択した教材本文' : '入力した文章');
  }
  if (skillId === 'copy' || skillId === 'application') {
    refs.push('入力した内容');
  }
  return refs;
}

const none = (currentSkillId: AiSkillId): SkillSuggestion => ({
  skillId: currentSkillId === 'auto' ? 'auto' : currentSkillId,
  strength: 'none',
  reason: '',
  references: [],
});

/**
 * 入力から専門モードを判定する。
 * strength が 'none' のときは呼び出し側は何も出さず、通常のAIコーチとして回答する。
 */
export function detectSkill(input: DetectSkillInput): SkillSuggestion {
  const text = `${input.question} ${input.quote ?? ''}`;
  const raw = detectRaw(input, text);

  // ── 追従（仕様§4）──
  // すでに専門モードにいるなら、同じスキルの再提案はしない。
  // 別スキルへ移すのは explicit なシグナルが出たときだけに限る。
  if (input.currentSkillId !== 'auto') {
    if (raw.skillId === input.currentSkillId) return none(input.currentSkillId);
    if (raw.strength !== 'explicit') return none(input.currentSkillId);
  }
  return raw;
}

function detectRaw(input: DetectSkillInput, text: string): SkillSuggestion {
  const reviewWord = hit(text, REVIEW_WORDS);
  const designWord = hit(text, DESIGN_WORDS);

  // ── 動画編集フィードバック ──
  // 静止画の制作物とは別のアプリなので、デザイン添削より先に見る。
  // 動画は画像として添付できないので、語だけで判断する（suggest どまり）。
  const videoWord = hit(text, VIDEO_WORDS);
  if (!input.hasImage && videoWord && reviewWord) {
    return {
      skillId: 'video-review',
      strength: 'suggest',
      reason: `「${videoWord}」＋「${reviewWord}」`,
      references: buildReferences('video-review', input),
    };
  }

  // ── 制作物添削 ──
  // 画像が添付されているかどうかで強さを分ける。仕様§4の例がそのままここに対応する。
  //   画像 ＋「添削して」   → explicit（確認カードを先に出す）
  //   画像 のみ            → suggest（まず通常回答し、その下で提案する）
  if (input.hasImage) {
    const strength = reviewWord ? 'explicit' : 'suggest';
    return {
      skillId: 'design-review',
      strength,
      reason: reviewWord
        ? `画像の添付 ＋「${reviewWord}」`
        : '制作物の画像が添付されています',
      references: buildReferences('design-review', input),
    };
  }

  // 画像は無いが明確に制作物の添削を求めている場合。
  // 実行はできないので、画像添付を促すために suggest で返す（仕様§8の導線）。
  if (reviewWord && designWord) {
    return {
      skillId: 'design-review',
      strength: 'suggest',
      reason: `「${designWord}」＋「${reviewWord}」`,
      references: buildReferences('design-review', input),
    };
  }

  // ── コピー作成 ──
  // 文章改善より先に見る。「キャッチコピーを短くして」は文章の推敲ではなく
  // 案を作り直す作業で、出す形（案を並べる）が違うため。
  const copyWord = hit(text, COPY_WORDS);
  if (copyWord) {
    const copyAction = hit(text, COPY_ACTION_WORDS);
    return {
      skillId: 'copy',
      strength: copyAction ? 'explicit' : 'suggest',
      reason: copyAction ? `「${copyWord}」＋「${copyAction}」` : `「${copyWord}」`,
      references: buildReferences('copy', input),
    };
  }

  /*
   * 🔴 「文章改善」への振り分けはここにあったが、対応するアプリが無くなったので
   *    消した（長い文章の貼り付け・「読みやすくして」を拾っていた）。
   *    いまは素のAIコーチがそのまま答える。アプリを増やすときに戻すこと。
   */
  const pasted = input.question.length >= PASTED_TEXT_MIN;

  // ── キャリア（面接練習・応募文・案件抽出）──
  // 貼り付けの長さで判断するものより先に見る。募集要項を貼っただけの相談に
  // 見当違いの提案を返さないため。
  const interviewWord = hit(text, INTERVIEW_WORDS);
  if (interviewWord) {
    const practice = hit(text, ['練習', 'シミュレーション', '模擬', '想定質問']);
    return {
      skillId: 'interview',
      strength: practice ? 'explicit' : 'suggest',
      reason: practice ? `「${interviewWord}」＋「${practice}」` : `「${interviewWord}」`,
      references: buildReferences('interview', input),
    };
  }

  const applicationWord = hit(text, APPLICATION_WORDS);
  if (applicationWord) {
    return {
      skillId: 'application',
      strength: pasted ? 'explicit' : 'suggest',
      reason: pasted ? `募集内容の貼り付け ＋「${applicationWord}」` : `「${applicationWord}」`,
      references: buildReferences('application', input),
    };
  }

  const jobWord = hit(text, JOB_WORDS);
  if (jobWord) {
    // 媒体が名指しされていればその媒体のアプリへ。無ければ既定（クラウドワークス）
    const site =
      JOB_SITE_SKILLS.find((row) => hit(text, row.words) !== null)?.skillId ??
      'job-search-crowdworks';
    return {
      skillId: site,
      strength: 'suggest',
      reason: `「${jobWord}」`,
      references: buildReferences(site, input),
    };
  }

  // ── 専門用語 ──
  // 「わかりやすく」だけでは普通の言い換え依頼とも読めるので、
  // 対象が言葉であることを示す語を必要とする。
  const glossaryWord = hit(text, GLOSSARY_WORDS);
  if (glossaryWord) {
    return {
      skillId: 'glossary',
      strength: 'suggest',
      reason: `「${glossaryWord}」`,
      references: buildReferences('glossary', input),
    };
  }

  /*
   * 🔴 ここにあった「理解度チェック」「トラブル相談」「アイデア整理」、および
   *    長文の貼り付けを文章改善へ送る分岐は、対応するアプリが無くなったので消した。
   *    どれも素のAIコーチが答えられる相談なので、提案を出さずに素通しする。
   */

  // 教材についての普通の質問。専門モードは要らない。
  return none(input.currentSkillId);
}

export default detectSkill;
