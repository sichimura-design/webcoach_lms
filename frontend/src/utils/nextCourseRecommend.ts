/**
 * frontend/src/utils/nextCourseRecommend.ts
 * 学習コンテンツの「次におすすめ」3枠の組み立て。
 *
 * 一覧に全コースを並べるだけだと、続きを終えた人が次にどこへ行くか分からない。
 * かといって推薦を何枚も出すと、また選べなくなる。そこで意味の違う3枠だけを出す。
 *
 *   実践  … 手を動かす番（同じ領域の実践課題）
 *   関連  … 同じ領域で、まだ触れていない基礎コース
 *   1歩先 … 同じ領域のカリキュラム順で、すでに出したどれよりも先
 *
 * 枠のラベルがそのまま「なぜ勧めるか」になっているので、カード本文には
 * コースの説明文をそのまま出せばよく、別途の理由文を作らない。
 * 逆に、枠の意味が重なると理由が言えなくなるため、同じコースを2枠に出さない。
 *
 * 順序の根拠はカタログの並び（＝領域内のカリキュラム順）1つだけ。
 * 以前は難易度（基礎/応用/発展）の段を使っていたが、その3段は人が手で振った値で
 * 受講生に違いを説明できず、教材構成の刷新で廃止した。カリキュラム順は
 * カタログが実際に持っている順序なので、「1歩先」が嘘にならない。
 *
 * 判定は純粋関数にしてここへ寄せる（aiSkillRecommend.ts と同じ方針）。
 * 根拠にできるのは「続きから学ぶコースの領域」「カタログのタグと並び順」
 * 「受講中のコースID」だけ。ここに無いものを推薦理由にしないこと。
 *
 * 現状の呼び出し経路: mocks/materialSearch.ts のフォールバックのみ。
 * services/mypageApi.ts の fetchNextCourses は呼び出し元が無い（画面はまだ生えていない）。
 */

export type NextSlot = 'practice' | 'related' | 'ahead';

/** 推薦の材料になるコース。カタログ側の項目名（Moodle準拠）に合わせている */
export interface RecommendCandidate {
  id: number;
  categoryname: string;
  tags: { rawname: string }[];
}

/** 「続きから学ぶ」コース。ここが取れないと推薦の根拠が無い */
export interface RecommendBase {
  id: number;
  categoryname: string;
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
 * 1コースだけの領域もあるので、空枠は例外ではなく通常の状態。
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
  const orderOf = (course: { id: number }): number => catalog.findIndex((c) => c.id === course.id);

  // すでに提示した中でいちばん先の位置。「1歩先」はこれより後ろから選ぶ
  const baseOrder = orderOf(base);
  let topOrder = baseOrder;

  const pick = (test: (course: T) => boolean): T | undefined => {
    const hit = catalog.find(
      (c) => c.categoryname === base.categoryname && !used.has(c.id) && test(c)
    );
    if (hit) {
      used.add(hit.id);
      topOrder = Math.max(topOrder, orderOf(hit));
    }
    return hit;
  };

  // 順番に意味がある。実践 → 関連 の順に確定させてから、残りの後ろを「1歩先」に回す
  const slots: Array<{ slot: NextSlot; label: string; test: (course: T) => boolean }> = [
    { slot: 'practice', label: '実践', test: (c) => hasTag(c, '実践課題') },
    { slot: 'related', label: '関連', test: (c) => hasTag(c, '基礎知識') },
    {
      slot: 'ahead',
      label: '1歩先',
      // 続きから学ぶコースがカタログに無い（実BFFなど）ときは「先」が定義できない。
      // 枠ごと落とす。落とさないと findIndex の -1 で全件が「1歩先」に見え、
      // 「関連」と同じコースを別のラベルで2度出すことになる。
      test: (c) => baseOrder >= 0 && orderOf(c) > topOrder,
    },
  ];

  return slots.reduce<Array<NextRecommendation<T>>>((acc, { slot, label, test }) => {
    const course = pick(test);
    if (course) acc.push({ slot, label, course });
    return acc;
  }, []);
}

export default buildNextCourses;
