/**
 * frontend/src/mocks/materialSearch.ts
 * AI教材検索（POST /api/webcoach/material-search）の中身。
 *
 * 「配色が苦手」「バナーを作りたい」のような自由文から教材を選ぶ。
 * 本物のAIは無いので、ここでやるのは次の3つだけ：
 *
 *   1. 話題  … 語彙表と入力文の部分一致で「何について」を拾う（配色・バナー・SEO …）
 *   2. 意向  … 「苦手」なら基礎寄り、「作りたい」なら実践寄りに重みを付ける
 *   3. 空振り … 話題が拾えない相談（「次に学ぶべき教材は？」）は
 *               「次におすすめ」と同じ buildNextCourses に委ねる
 *
 * 理由文は必ず「何が一致したか」から組む。一致していない理由を書くと、
 * モックを見て仕様を決める人に嘘の根拠を渡すことになるため。
 */
import { buildNextCourses, RecommendCandidate } from '../utils/nextCourseRecommend';

/** 検索対象のコース。カタログ側の項目名（Moodle準拠）に合わせている */
export interface SearchableCourse extends RecommendCandidate {
  fullname: string;
  summary: string;
  purposes: string[];
  duration: string;
}

export interface MaterialSearchHit<T> {
  course: T;
  reason: string;
}

export interface MaterialSearchResponse<T> {
  summary: string;
  results: Array<MaterialSearchHit<T>>;
}

/**
 * 話題の語彙。キーは「入力文に出てきうる言い方」、値は「コースを探す語」。
 * コース名・説明文に無い言い方（色 → 配色 / 集客 → マーケティング）だけを書く。
 * コース名にそのまま入っている語（バナー・Figma・SEO …）は表に足さなくても
 * 下の部分一致で拾えるので書かない。
 */
const SYNONYMS: Record<string, string[]> = {
  '色': ['配色'],
  'カラー': ['配色'],
  '集客': ['マーケティング', 'SNS', '広告'],
  'アクセス': ['アクセス解析'],
  '数字': ['アクセス解析'],
  'コーディング': ['HTML', 'CSS'],
  'コード': ['HTML', 'CSS'],
  'マークアップ': ['HTML', 'CSS'],
  'JS': ['JavaScript'],
  'スマホ': ['レスポンシブ'],
  'レイアウト': ['Flexbox', 'ワイヤーフレーム', '余白'],
  '文章': ['ライティング', '広告文'],
  'コピー': ['広告文'],
  '営業': ['案件獲得', '提案'],
  '仕事': ['案件獲得', '副業'],
  'お金': ['見積もり', '副業'],
  '転職': ['キャリア'],
  '作品': ['ポートフォリオ', 'バナー'],
  'デザイン': ['Webデザイン'],
  'CMS': ['WordPress'],
  'バージョン管理': ['Git'],
};

/** つまずき側の言い方。基礎コースを上に持ち上げる */
const STRUGGLE_WORDS = ['苦手', 'わからない', '分からない', '不安', '自信がない', '難しい', 'むずかしい', '初めて', 'はじめて', '未経験', '基礎', '入門'];

/** 手を動かしたい側の言い方。実践課題のコースを上に持ち上げる */
const MAKE_WORDS = ['作りたい', 'つくりたい', '作れる', '実践', '手を動かし', '作品', 'ポートフォリオ', '課題', '練習'];

/** 相談そのもの。話題が無くても「次に何を」と聞いている合図 */
const ASK_NEXT_WORDS = ['次に', 'つぎに', 'おすすめ', 'オススメ', '何を', 'なにを', 'どれ', 'どこから'];

/**
 * 話題のうしろに付く言い方。落としてから照合する。
 * 「配色が苦手」→「配色」のように、話題そのものを取り出すため。
 */
const TAIL_PHRASES = [
  'について', 'のやり方', 'の仕方', 'がわからない', 'が分からない', 'がわかりません',
  'が苦手', 'は苦手', 'が不安', 'に自信がない', 'が難しい', 'がむずかしい',
  'を作りたい', 'をつくりたい', 'を学びたい', 'を知りたい', 'をやりたい',
  'を教えて', 'したい', 'を勉強したい', 'は？', 'って何', 'とは',
];

const includesAny = (text: string, words: string[]): boolean => words.some((w) => text.includes(w));

/** 入力文から話題そのものを取り出す。「配色が苦手」→「配色」 */
function stripTail(query: string): string {
  let s = query.trim();
  TAIL_PHRASES.forEach((tail) => {
    if (s.endsWith(tail)) s = s.slice(0, -tail.length);
  });
  return s.replace(/[?？。、]+$/, '').trim();
}

/**
 * 入力文から「話題の語」を拾う。
 * コース名・説明文・カテゴリ名・purposes に出てくる語のうち、
 * 入力文に含まれているものだけを候補にする（形態素解析はしない）。
 */
function collectTopics(query: string, catalog: SearchableCourse[]): string[] {
  const found = new Set<string>();

  Object.entries(SYNONYMS).forEach(([spoken, terms]) => {
    if (query.includes(spoken)) terms.forEach((term) => found.add(term));
  });

  // 「SEO」「Figma」のような短い単語そのものの検索。
  // 下のコース名からの照合は query.includes(コース名の断片) の向きなので、
  // 入力がコース名より短いと当たらない。話題だけを残した文をそのまま照合語に足す。
  const bare = stripTail(query);
  if (bare.length >= 2 && bare.length <= 12) found.add(bare);

  // コース名から取れる語。「はじめてのWebデザイン」→「Webデザイン」のように
  // 助詞や飾りを落として、2文字以上の断片を照合語にする。
  catalog.forEach((c) => {
    const pieces = c.fullname
      .split(/[のとでをがはへ・\s&/｜|()「」]+/)
      .concat(c.categoryname, ...c.purposes)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);
    pieces.forEach((piece) => {
      if (query.includes(piece)) found.add(piece);
    });
  });

  return Array.from(found);
}

const hasTag = (course: SearchableCourse, tag: string): boolean =>
  course.tags.some((t) => t.rawname === tag);

/**
 * 教材を探す。
 *
 * @param query       入力文
 * @param catalog     全コース。並び順はカリキュラム順として扱う
 * @param enrolledIds 受講中・受講済みのコースID（すでに触れたものは下げる）
 * @param resumeId    続きから学ぶコースのID。話題が拾えないときの推薦の起点になる
 * @param limit       返す件数
 */
export function searchMaterials<T extends SearchableCourse>(
  query: string,
  catalog: T[],
  enrolledIds: number[] = [],
  resumeId?: number,
  limit = 4
): MaterialSearchResponse<T> {
  const q = (query ?? '').trim();
  if (!q) {
    return { summary: '学びたいことやつまずいていることを入力すると、教材を選びます。', results: [] };
  }

  const topics = collectTopics(q, catalog);
  const wantsBasics = includesAny(q, STRUGGLE_WORDS);
  const wantsMaking = includesAny(q, MAKE_WORDS);

  const scored = catalog
    .map((course) => {
      const hitTopics = topics.filter(
        (term) =>
          course.fullname.includes(term) ||
          course.summary.includes(term) ||
          course.categoryname === term ||
          course.purposes.includes(term)
      );

      // 話題の一致がスコアの土台。当たった場所で重みを変える
      let score = hitTopics.reduce((sum, term) => {
        if (course.fullname.includes(term)) return sum + 5;
        if (course.categoryname === term) return sum + 3;
        if (course.purposes.includes(term)) return sum + 2;
        return sum + 2; // summary
      }, 0);
      if (score === 0) return null;

      const reasons = [`「${hitTopics[0]}」を扱うコースです`];

      if (wantsBasics) {
        if (course.difficulty === '基礎') {
          score += 4;
          reasons.push('つまずいたところから、基礎で組み直せます');
        } else {
          score -= 2;
        }
      }
      if (wantsMaking) {
        if (hasTag(course, '実践課題')) {
          score += 4;
          reasons.push('手を動かして、作れる状態まで進みます');
        } else {
          score -= 1;
        }
      }
      // まだ触れていないコースを優先する（復習したい人向けの並びにはしない）
      if (enrolledIds.includes(course.id)) score -= 3;

      return { course, score, reason: reasons.join('。') };
    })
    .filter((x): x is { course: T; score: number; reason: string } => x !== null && x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    const results = scored.slice(0, limit).map(({ course, reason }) => ({ course, reason }));
    const lead = wantsBasics
      ? `「${q}」から、基礎で組み直せるコースを${results.length}件選びました。`
      : wantsMaking
        ? `「${q}」から、手を動かして仕上げられるコースを${results.length}件選びました。`
        : `「${q}」に関係するコースを${results.length}件選びました。`;
    return { summary: lead, results };
  }

  // 話題が拾えなかった。「次に何を学ぶか」の相談なら、続きから学ぶコースを起点に推薦する。
  // 逆に、単に一致しなかっただけの入力（「料理」など）を推薦で埋めてはいけない。
  // 聞かれていないことに答えると、入力が無視されたようにしか見えないため。
  const base = catalog.find((c) => c.id === resumeId);
  if (base && includesAny(q, ASK_NEXT_WORDS)) {
    const next = buildNextCourses<T>(base, catalog, enrolledIds);
    if (next.length > 0) {
      return {
        summary: `「${base.fullname}」の続きとして${next.length}件選びました。`,
        results: next.map(({ label, course }) => ({
          course,
          reason: label === '実践'
            ? '学んだことを、手を動かして形にする番です'
            : label === '関連'
              ? `${base.fullname}と同じ段で、まだ触れていない範囲です`
              : `${base.fullname}より一歩先の内容です`,
        })),
      };
    }
  }

  return {
    summary: `「${q}」に近いコースは見つかりませんでした。「配色」「バナー」「案件獲得」のような言葉だと選びやすくなります。`,
    results: [],
  };
}

export default searchMaterials;
