/**
 * frontend/src/utils/nextCourseRecommend.ts
 * 学習コンテンツの「次におすすめ」3枠の組み立て。
 *
 * 一覧に全コースを並べるだけだと、続きを終えた人が次にどこへ行くか分からない。
 * かといって推薦を何枚も出すと、また選べなくなる。そこで意味の違う3枠だけを出す。
 *
 *   実践  … 手を動かす番（実践課題タグ）
 *   関連  … いま学んでいるのと同じ段の、まだ触れていない範囲
 *   1歩先 … すでに出したどのコースよりも上の段
 *
 * 枠のラベルがそのまま「なぜ勧めるか」になっているので、カード本文には
 * コースの説明文をそのまま出せばよく、別途の理由文を作らない。
 * 逆に、枠の意味が重なると理由が言えなくなるため、同じコースを2枠に出さない。
 *
 * 判定は純粋関数にしてここへ寄せる（aiSkillRecommend.ts と同じ方針）。
 * 根拠にできるのは「続きから学ぶコースのカテゴリと難易度」「カタログのタグ・難易度」
 * 「受講中のコースID」だけ。ここに無いものを推薦理由にしないこと。
 */

/** 難易度の段。カタログの difficulty 文字列と1:1で対応する */
const LEVELS = ['基礎', '応用', '発展'];

/** 難易度を段番号に。未設定・未知の値は最下段(0)として扱う */
const levelOf = (difficulty?: string | null): number => {
  const i = LEVELS.indexOf(difficulty ?? '');
  return i < 0 ? 0 : i;
};

export type NextSlot = 'practice' | 'related' | 'ahead';

/** 推薦の材料になるコース。カタログ側の項目名（Moodle準拠）に合わせている */
export interface RecommendCandidate {
  id: number;
  categoryname: string;
  tags: { rawname: string }[];
  difficulty?: string;
}

/** 「続きから学ぶ」コース。ここが取れないと推薦の根拠が無い */
export interface RecommendBase {
  id: number;
  categoryname: string;
  difficulty?: string;
}

export interface NextRecommendation<T = RecommendCandidate> {
  slot: NextSlot;
  /** カードのバッジ。これが「おすすめの理由」そのもの */
  label: string;
  course: T;
}

const hasTag = (course: RecommendCandidate, tag: string): boolean =>
  course.tags.some((t) => t.rawname === tag);

/**
 * 「次におすすめ」を最大3件返す。埋まらない枠は詰めずに落とす
 * （3枚に揃えるために枠の意味を曲げると、バッジのラベルが嘘になるため）。
 *
 * @param base       続きから学ぶコース。null なら推薦しない（＝セクションごと非表示）
 * @param catalog    全コース。並び順はカリキュラム順として扱い、各枠その先頭を採る
 * @param enrolledIds 受講中・受講済みのコースID。推薦から除外する
 */
export function buildNextCourses<T extends RecommendCandidate>(
  base: RecommendBase | null | undefined,
  catalog: T[],
  enrolledIds: number[] = []
): Array<NextRecommendation<T>> {
  if (!base?.categoryname) return [];

  const used = new Set<number>([base.id, ...enrolledIds]);
  // すでに提示した中でいちばん上の段。「1歩先」はこれより上から選ぶ
  let topLevel = levelOf(base.difficulty);

  const pick = (test: (course: T) => boolean): T | undefined => {
    const hit = catalog.find(
      (c) => c.categoryname === base.categoryname && !used.has(c.id) && test(c)
    );
    if (hit) {
      used.add(hit.id);
      topLevel = Math.max(topLevel, levelOf(hit.difficulty));
    }
    return hit;
  };

  // 順番に意味がある。実践 → 関連 の順に確定させてから、残りの上の段を「1歩先」に回す
  const slots: Array<{ slot: NextSlot; label: string; test: (course: T) => boolean }> = [
    { slot: 'practice', label: '実践', test: (c) => hasTag(c, '実践課題') },
    {
      slot: 'related',
      label: '関連',
      test: (c) => hasTag(c, '基礎知識') && levelOf(c.difficulty) === levelOf(base.difficulty),
    },
    { slot: 'ahead', label: '1歩先', test: (c) => levelOf(c.difficulty) > topLevel },
  ];

  return slots.reduce<Array<NextRecommendation<T>>>((acc, { slot, label, test }) => {
    const course = pick(test);
    if (course) acc.push({ slot, label, course });
    return acc;
  }, []);
}

export default buildNextCourses;
