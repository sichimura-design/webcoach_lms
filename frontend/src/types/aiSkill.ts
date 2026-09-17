/**
 * frontend/src/types/aiSkill.ts
 * AIコーチの「専門モード」のドメイン型。
 *
 * 設計の中心:
 *   AIコーチは相談相手。従来「AIアプリ」として別タブで開いていたものは、
 *   AIコーチの中のモードとして扱う（別タブへ飛ばさない・資格情報もフロントは持たない）。
 *   🔴 ただし**名前は実在のアプリ名をそのまま出す**。動詞へ言い換えていた時期があるが、
 *      コーチや教材が「デザインフィードバックメンタープロを使って」と案内したときに
 *      画面のどれのことか通じなくなるため戻した。
 *      UIに出さないのは "Dify" と、裏のアプリ識別子（internalApp）。
 *
 * これらのAPIは実BFF（FastAPI）に存在しない。バックエンドは変更禁止のため、
 * すべて MSW（frontend/src/mocks/aiSkillHandlers.ts）で提供する。
 * 型はモックとクライアント（bffClient）の双方から import して、
 * 片方だけがズレることを防ぐ（types/lesson.ts と同じ方針）。
 */

// lesson.ts とは型だけを相互に参照する（import type なので実行時の循環参照は起きない）
import type { LessonAiHistoryItem, LessonAiSource } from './lesson';

/**
 * 専門モードの識別子。
 * 'auto' は「まだ判定していない／おまかせ」を表す擬似スキルで、
 * 実行API（POST /webcoach/ai-skill）には渡らない。
 *
 * 🔴 顔ぶれは実在のAIアプリ（Dify側）と1対1で揃えている。
 *    ここにあってあちらに無いものを勝手に足さないこと。
 *    案件抽出メーカーは媒体ごとに別アプリなので、IDも媒体ごとに分けてある。
 */
export type AiSkillId =
  | 'auto'
  | 'learning'
  | 'glossary'
  | 'daily-design-sprint'
  | 'design-review'
  | 'video-review'
  | 'copy'
  | 'application'
  | 'interview'
  | 'job-search-crowdworks'
  | 'job-search-coconala'
  | 'job-search-lancers';

/** 実行APIに渡せる実スキル（'auto' を除いたもの） */
export type ConcreteAiSkillId = Exclude<AiSkillId, 'auto'>;

export const isConcreteSkill = (id: AiSkillId): id is ConcreteAiSkillId => id !== 'auto';

/**
 * 一覧の分類（要件「すべてのAI機能」）。
 * 全部を同じ大きさで並べると結局どれを使うか迷うので、目的で束ねる。
 */
export type AiSkillCategory = 'learn' | 'create' | 'career' | 'other';

export const AI_SKILL_CATEGORY_LABEL: Record<AiSkillCategory, string> = {
  learn: '学習サポート',
  create: '制作サポート',
  // 🔴 キャリアは「キャリアサポート」にしない。指示どおりの据え置き。
  career: 'キャリア',
  other: 'そのほか',
};

export const AI_SKILL_CATEGORY_ORDER: AiSkillCategory[] = ['learn', 'create', 'career', 'other'];

/** カードのアイコン。types を lucide-react に依存させないため、キーだけを持つ */
export type AiSkillIconKey =
  | 'book'
  | 'glossary'
  | 'image'
  | 'video'
  | 'lightbulb'
  | 'document'
  | 'mic'
  | 'briefcase'
  | 'sparkles';

/**
 * スキル1件のユーザー向け情報。**ここに書いたことしかUIに出さない**。
 *
 * 🔴 名前は実在のAIアプリ名をそのまま使う（表記もアプリ側と1文字ずらさない。
 *    「AI面接シュミレーター」もこの綴りのまま）。
 *    かつてここは「用語・文章をわかりやすくする」のように動詞へ言い換えていたが、
 *    コーチや教材が案内するときの呼び名（＝アプリ名）と画面の表示が食い違い、
 *    どれの話なのか通じなくなるため戻した。何ができるかは description が受け持つ。
 */
export interface AiSkillMeta {
  /** 一覧・セレクタに出す表示名（動詞） */
  label: string;
  /** そのモードに入っているときのヘッダー表示。「制作物を添削モード」を避けるため別に持つ */
  modeLabel: string;
  /** 提案カードの見出しに使う短い名前 */
  shortLabel: string;
  /**
   * 提案カードのボタン文言。
   * 意図的に「アプリを起動」ではなくユーザーの目的語にしている。
   */
  cta: string;
  category: AiSkillCategory;
  icon: AiSkillIconKey;
  /**
   * 一覧カードのサムネイル画像。public/ 起点の相対パス（例 'images/ai-apps/design-review.png'）。
   * 🔴 参照するときは必ず process.env.PUBLIC_URL を前置する。dev プレビューは
   *    /branches/<slug>/ のサブパス配信なので、先頭 / から書くと 404 になる。
   * 未設定なら icon のフォールバックを出すので、画像が揃うまで空のままでよい。
   */
  thumbnail?: string;
  /** カードの説明＝何ができるか（1〜2文） */
  description: string;
  /** カードの補助＝何を入力するか */
  inputHint: string;
  /** カードの補助＝どんな場面で使うか */
  useCase: string;
  /** モードに入った直後にヘッダー下へ出す1行 */
  modeLead: string;
  /** モード中のクイックアクション。押すとそのまま送信する */
  quickActions: string[];
  /** モード中の入力欄プレースホルダ */
  placeholder: string;
  /** 画像が無いと成立しないか（未添付なら実行ボタンではなく添付を促す） */
  needsImage: boolean;
  /**
   * 一覧（/ai-coach の「AIコーチでできること」・教材ページの ＋ メニュー）に出すか。
   * 既定は true で、false は 'learning' だけ。あれはカードから始めるアプリではなく、
   * 教材ページ右パネルのAIコーチが既定で入っているモードそのものなので、
   * 一覧に並べると「アプリが1つ多い」ことになる（消すと教材ページのAIが動かない）。
   */
  listed?: boolean;
  /**
   * 右パネルでは手狭になりやすく、AI専用ページへの拡大を勧めたいか（仕様§6）。
   * 「修正して再添削を繰り返す」「長い文章を作る」類の作業がこれに当たる。
   */
  preferWide: boolean;
}

export const AI_SKILL_META: Record<ConcreteAiSkillId, AiSkillMeta> = {
  learning: {
    label: '教材について質問する',
    modeLabel: '学習相談モード',
    shortLabel: '学習相談',
    cta: '教材に沿って詳しく調べる',
    category: 'learn',
    icon: 'book',
    description: '教材のどこに書いてあるかを示しながら、いま学んでいる内容の疑問に答えます。',
    inputHint: '質問したいこと・引用したい教材の文',
    useCase: '読んでいて分からない箇所が出てきたとき',
    modeLead: '教材の該当箇所を根拠に、質問へ回答します。',
    quickActions: ['簡単に説明して', '具体例を出して', 'なぜそうするの？', '制作物に当てはめると？'],
    placeholder: '教材について質問する…',
    needsImage: false,
    // 一覧に出さない唯一のモード。理由は listed の注記
    listed: false,
    preferWide: false,
  },

  glossary: {
    label: '専門用語AIアシスタント',
    modeLabel: '専門用語AIアシスタント',
    shortLabel: '専門用語',
    cta: 'やさしい言葉に置き換える',
    category: 'learn',
    icon: 'glossary',
    description: '専門用語や回りくどい文章を、身近な言葉とたとえに置き換えて説明します。',
    inputHint: '分からない用語・そのままコピーした文章',
    useCase: '教材や案件の募集文に知らない言葉が出てきたとき',
    modeLead: '難しい言葉を、はじめての人にも通じる説明に置き換えます。',
    quickActions: ['この用語を説明して', 'たとえで教えて', '似た言葉との違いは？'],
    placeholder: '分からない用語や文章を貼り付けてください…',
    needsImage: false,
    preferWide: false,
  },

  /*
   * 🔴 カテゴリは「学習サポート」。デザインの課題を出すアプリだが、
   *    やっていることは毎日の練習なので、制作サポート（＝作ったものを見てもらう）
   *    ではなくこちらに置く。
   */
  'daily-design-sprint': {
    label: 'デイリーデザインスプリントチャレンジャー',
    modeLabel: 'デイリーデザインスプリントチャレンジャー',
    shortLabel: 'デイリースプリント',
    cta: '今日の課題を出す',
    category: 'learn',
    icon: 'sparkles',
    description: '使える時間と分野を答えると、その日のデザイン課題を出します。仕上げて出すとフィードバックが返ります。',
    inputHint: '今日使える時間・挑戦したい分野',
    useCase: '何を作るか決まらない日に、とにかく手を動かし始めたいとき',
    modeLead: '今日のデザイン課題を、使える時間と分野から決めます。',
    quickActions: ['今日の課題を出して', '3時間で終わる課題がいい', 'バナーの課題にして'],
    placeholder: '使える時間と、挑戦したい分野を書いてください…',
    needsImage: false,
    preferWide: true,
  },

  'design-review': {
    label: 'デザインフィードバックメンタープロ',
    modeLabel: 'デザインフィードバックメンタープロ',
    shortLabel: 'デザインフィードバック',
    cta: '項目別に添削する',
    category: 'create',
    icon: 'image',
    description: '画像をアップロードすると、教材と課題の基準に沿って改善点を項目別に確認できます。',
    inputHint: '制作物の画像（PNG・JPG）',
    useCase: '課題を提出する前に見てもらいたいとき',
    modeLead: '制作物を、教材と課題の評価基準に沿って添削します。',
    quickActions: ['全体を添削して', '配色を確認して', '優先順位を教えて', '提出できる状態か見て'],
    placeholder: '添削してほしい観点があれば書いてください…',
    needsImage: true,
    preferWide: true,
  },

  'video-review': {
    label: '動画編集フィードバックPro',
    modeLabel: '動画編集フィードバックPro',
    shortLabel: '動画フィードバック',
    cta: '編集を見てもらう',
    category: 'create',
    icon: 'video',
    description: '編集した動画のテンポ・テロップ・音まわりを、見る人の目線で確認します。',
    inputHint: '動画のURL、または書き出した画面の画像',
    useCase: '動画を提出する前に、冒頭やテロップを見てほしいとき',
    modeLead: '動画編集を、見る人の目線で確認します。',
    // 🔴 needsImage は false。動画そのものはURLで渡すので、画像が無くても成立する
    quickActions: ['全体を見てほしい', 'テロップを確認して', '冒頭3秒を見て'],
    placeholder: '見てほしい点と、動画のURLを書いてください…',
    needsImage: false,
    preferWide: true,
  },

  copy: {
    label: 'キャッチコピーアイデアメーカー',
    modeLabel: 'キャッチコピーアイデアメーカー',
    shortLabel: 'キャッチコピー',
    cta: 'コピー案を出す',
    category: 'create',
    icon: 'lightbulb',
    description: '誰に何を伝えたいかを渡すと、狙いの違うコピー案を並べて比べられます。',
    inputHint: '伝えたい相手・商品やサービスの内容',
    useCase: 'バナーやLPの見出しが決まらないとき',
    modeLead: '狙いの違う案を並べて、選べる形にします。',
    quickActions: ['案を出して', 'もっと短くして', '別の切り口で'],
    placeholder: '誰に何を伝えたいかを書いてください…',
    needsImage: false,
    preferWide: true,
  },

  application: {
    label: '案件応募文 生成・添削メーカー',
    modeLabel: '案件応募文 生成・添削メーカー',
    shortLabel: '応募文',
    cta: '応募文を組み立てる',
    category: 'career',
    icon: 'document',
    description: '募集内容と自分の実績から、相手が判断できる応募文を組み立てます。',
    inputHint: '募集内容・これまでの制作物や経験',
    useCase: 'クラウドソーシングや求人に応募するとき',
    modeLead: '募集内容に合わせて、応募文の骨組みから作ります。',
    quickActions: ['応募文を作って', '実績の書き方を教えて', '単価の伝え方を知りたい'],
    placeholder: '募集内容と、書けそうな実績を貼り付けてください…',
    needsImage: false,
    preferWide: true,
  },

  /* 🔴 「シュミレーター」はアプリ側の綴りに合わせている。直さないこと */
  interview: {
    label: 'AI面接シュミレーター',
    modeLabel: 'AI面接シュミレーター',
    shortLabel: '面接練習',
    cta: '面接の練習を始める',
    category: 'career',
    icon: 'mic',
    description: 'AIが面接官役になって質問し、答えたその場で伝わり方を振り返ります。',
    inputHint: '受ける職種・想定している働き方',
    useCase: '面談や商談の前に、話す練習をしておきたいとき',
    modeLead: 'AIが面接官役として質問します。答えると講評します。',
    quickActions: ['質問を出して', '答え方を直して', '想定質問を教えて'],
    placeholder: '受ける職種や、答えたい内容を書いてください…',
    needsImage: false,
    preferWide: true,
  },

  /*
   * 案件抽出メーカー。
   * 🔴 媒体ごとに別のアプリ（別のDifyアプリ）なので、1つにまとめて中で媒体を
   *    選ばせる形にはしない。探し方も単価の相場も媒体ごとに違う。
   *    3件の違いは媒体名だけなので、文言は揃えて媒体名だけ差し替える。
   */
  'job-search-crowdworks': {
    label: '案件抽出メーカー（クラウドワークス）',
    modeLabel: '案件抽出メーカー（クラウドワークス）',
    shortLabel: '案件抽出（CW）',
    cta: 'クラウドワークスで探す',
    category: 'career',
    icon: 'briefcase',
    description: 'できることと使える時間を整理して、クラウドワークスで受けられる案件の条件まで絞ります。',
    inputHint: '得意な作業・週に使える時間・希望単価',
    useCase: 'クラウドワークスで受けられる案件を探したいとき',
    modeLead: 'クラウドワークスで受けられる条件を整理して、探し方まで決めます。',
    quickActions: ['条件を整理して', 'はじめやすい案件は？', '単価の目安を知りたい'],
    placeholder: '得意な作業と、週に使える時間を書いてください…',
    needsImage: false,
    preferWide: false,
  },

  'job-search-coconala': {
    label: '案件抽出メーカー（ココナラ）',
    modeLabel: '案件抽出メーカー（ココナラ）',
    shortLabel: '案件抽出（ココナラ）',
    cta: 'ココナラで探す',
    category: 'career',
    icon: 'briefcase',
    description: 'できることと使える時間を整理して、ココナラで受けられる案件の条件まで絞ります。',
    inputHint: '得意な作業・週に使える時間・希望単価',
    useCase: 'ココナラで受けられる案件を探したいとき',
    modeLead: 'ココナラで受けられる条件を整理して、探し方まで決めます。',
    quickActions: ['条件を整理して', 'はじめやすい案件は？', '単価の目安を知りたい'],
    placeholder: '得意な作業と、週に使える時間を書いてください…',
    needsImage: false,
    preferWide: false,
  },

  'job-search-lancers': {
    label: '案件抽出メーカー（ランサーズ）',
    modeLabel: '案件抽出メーカー（ランサーズ）',
    shortLabel: '案件抽出（ランサーズ）',
    cta: 'ランサーズで探す',
    category: 'career',
    icon: 'briefcase',
    description: 'できることと使える時間を整理して、ランサーズで受けられる案件の条件まで絞ります。',
    inputHint: '得意な作業・週に使える時間・希望単価',
    useCase: 'ランサーズで受けられる案件を探したいとき',
    modeLead: 'ランサーズで受けられる条件を整理して、探し方まで決めます。',
    quickActions: ['条件を整理して', 'はじめやすい案件は？', '単価の目安を知りたい'],
    placeholder: '得意な作業と、週に使える時間を書いてください…',
    needsImage: false,
    preferWide: false,
  },
};

/** 実スキルの一覧（AI_SKILL_META の宣言順） */
export const CONCRETE_AI_SKILLS = Object.keys(AI_SKILL_META) as ConcreteAiSkillId[];

/** 一覧に出すスキル（listed が false でないもの） */
export const LISTED_AI_SKILLS: ConcreteAiSkillId[] = CONCRETE_AI_SKILLS.filter(
  (id) => AI_SKILL_META[id].listed !== false
);

/**
 * カテゴリ別のスキル一覧（「AIコーチでできること」の並び）。
 * 宣言順をそのまま使うので、並べ替えは AI_SKILL_META の順序を変えるだけで済む。
 * 🔴 listed が false のものは含めない。カテゴリが空になることがあるので、
 *    呼び出し側は「0件なら見出しごと出さない」こと。
 */
export const skillsInCategory = (category: AiSkillCategory): ConcreteAiSkillId[] =>
  LISTED_AI_SKILLS.filter((id) => AI_SKILL_META[id].category === category);

/**
 * 「よく使うAI」に出すスキル。
 * ここを増やすと結局全件一覧と同じになるので、6件までに留める。
 */
export const FEATURED_AI_SKILLS: ConcreteAiSkillId[] = [
  'design-review',
  'daily-design-sprint',
  'copy',
  'glossary',
  'interview',
  'job-search-crowdworks',
];

/** AI_SKILL_META から1項目だけ抜き出した対応表を作る（表示名などの後方互換マップ用） */
const pick = <K extends keyof AiSkillMeta>(key: K): Record<ConcreteAiSkillId, AiSkillMeta[K]> =>
  Object.fromEntries(CONCRETE_AI_SKILLS.map((id) => [id, AI_SKILL_META[id][key]])) as Record<
    ConcreteAiSkillId,
    AiSkillMeta[K]
  >;

/** モードセレクタに出す表示名。ユーザーにはこの語彙しか見せない（仕様§7） */
export const AI_SKILL_LABEL: Record<AiSkillId, string> = { auto: 'おまかせ', ...pick('label') };

/** 専門モードに入っているときのヘッダー表示名 */
export const AI_SKILL_MODE_LABEL: Record<AiSkillId, string> = {
  auto: 'おまかせ',
  ...pick('modeLabel'),
};

/** 提案カードの見出しに使う短い名前。「✦ 制作物添削 が適しています」の形で使う */
export const AI_SKILL_SHORT_LABEL: Record<AiSkillId, string> = {
  auto: 'おまかせ',
  ...pick('shortLabel'),
};

/** 提案カードのボタン文言 */
export const AI_SKILL_CTA: Record<AiSkillId, string> = { auto: '続ける', ...pick('cta') };

/**
 * 制作物の画像が無いと成立しないスキル。
 * 画像未添付で提案するときは、実行ボタンではなく画像添付を促す（仕様§8の導線）。
 */
export const AI_SKILL_NEEDS_IMAGE: Record<AiSkillId, boolean> = {
  auto: false,
  ...pick('needsImage'),
};

/** AI専用ページへの拡大を勧めたいスキル（仕様§6） */
export const AI_SKILL_PREFER_WIDE: Record<AiSkillId, boolean> = {
  auto: false,
  ...pick('preferWide'),
};

/**
 * 専門モードの実行API（POST /webcoach/ai-skill）に回すスキル。
 * 'learning' を含めないのは意図的。「教材について質問」は右パネルのAIコーチが
 * 従来から POST /webcoach/lesson-ai でやっていることそのもので、
 * 別のエンドポイントに回すと同じ処理が二重になる。
 */
export const SPECIALIST_SKILLS: ConcreteAiSkillId[] = CONCRETE_AI_SKILLS.filter(
  (id) => id !== 'learning'
);

export const isSpecialistSkill = (id: AiSkillId): id is ConcreteAiSkillId =>
  (SPECIALIST_SKILLS as AiSkillId[]).includes(id);

// ---- 意図判定の結果 --------------------------------------------------------

/**
 * 判定の強さ。仕様§4「自動で切り替えず、提案にする」の3段階に対応する。
 *
 * none     … 軽い質問。AIコーチがそのまま回答するだけ
 * suggest  … 専門処理が有効かもしれない。まず通常回答し、その下で提案する
 * explicit … 明確に専門処理を求めている。回答の前に確認カードを出す
 */
export type SkillSuggestionStrength = 'none' | 'suggest' | 'explicit';

export interface SkillSuggestion {
  skillId: AiSkillId;
  strength: SkillSuggestionStrength;
  /** 「画像添付 ＋ 『添削』」のような判定根拠。提案カードに小さく出す */
  reason: string;
  /** 提案カードの「参照予定」に並べるラベル（教材見出し／課題の評価基準／添付画像） */
  references: string[];
}

// ---- 専門スキルの実行 ------------------------------------------------------

/**
 * 専門モードの実行リクエスト。
 * 本番ではBFFが skillId を Difyアプリの資格情報へ解決して代理呼び出しする。
 * フロントは skillId までしか知らない（アプリIDやURLを持たない）。
 */
export interface AiSkillRequest {
  skillId: ConcreteAiSkillId;
  question: string;
  /** 添付画像（dataURL） */
  image?: string;
  /** 引用していた教材本文 */
  quote: string | null;
  courseId: number | null;
  lessonId: number | null;
  /** 参照する教材ブロック。空なら教材横断で探す */
  blockIds: string[];
  history: LessonAiHistoryItem[];
}

/** 項目別添削の1項目。verdict で色分けする */
export type AiSkillVerdict = 'good' | 'improve' | 'critical';

export const AI_SKILL_VERDICT_LABEL: Record<AiSkillVerdict, string> = {
  good: '良い',
  improve: '改善できる',
  critical: '直したい',
};

export interface AiSkillFinding {
  /** 「配色」「余白」「文字組」など観点の名前 */
  label: string;
  verdict: AiSkillVerdict;
  comment: string;
  /** 教材の根拠。null なら教材に裏付けが無い項目 */
  basis: string | null;
  /** 根拠にした教材ブロック。UIから教材へジャンプさせる */
  blockId: string | null;
}

/**
 * 専門モードの回答。
 * LessonAiResponse（結論／根拠／当てはめ／…）と違い、こちらは
 * 「項目別に並べて、直して、再度見る」作業のための形にしている。
 */
export interface AiSkillResponse {
  skillId: ConcreteAiSkillId;
  /** 全体講評。1〜2文 */
  summary: string;
  findings: AiSkillFinding[];
  /** 文章改善モードの修正案。添削モードでは null */
  revision: string | null;
  next: string;
  sources: LessonAiSource[];
  /**
   * 教材に根拠を持てたか。false のときはUI側で
   * 「教材だけでは判断できません」を明示する（LessonAiResponse と同じ扱い）。
   */
  groundedInMaterial: boolean;
}
