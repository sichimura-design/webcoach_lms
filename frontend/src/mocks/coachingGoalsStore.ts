/**
 * MSW: 「次回コーチングまでの目標」のストア。
 * ============================================================
 * 🔴 handlers.ts と coachingHandlers.ts の両方から読み書きするため、独立したモジュールに置く。
 *    handlers.ts に置くと coachingHandlers.ts → handlers.ts の循環 import になる。
 *
 * この分離が必要になった理由:
 *   コーチングノートで「目標を確定」しても、マイページの目標リストは別データだったため
 *   反映されなかった。確定した目標がそのままマイページに載るように、
 *   confirm-goals（coachingHandlers.ts）からここへ追記する。
 *
 * localStorage に永続化する。マイページで編集した内容がリロードで消えると、
 * 「編集できる」という体験そのものが確認できないため。
 * ============================================================
 */
import { CoachingGoalApi } from '../types/mypage';

const STORE_KEY = 'webcoach-coaching-goals';

export type StoredGoal = Pick<
  CoachingGoalApi,
  'no' | 'description' | 'is_completed' | 'progress'
>;

/** 初期値。コーチが前回のコーチングで設定した内容という想定 */
const SEED: StoredGoal[] = [
  { no: 1, description: '配色の基礎を修了する', is_completed: 1, progress: 100 },
  { no: 2, description: 'バナーを1つ完成させる', is_completed: 0, progress: 40 },
  { no: 3, description: 'レイアウト実践に着手する', is_completed: 0, progress: 0 },
];

interface GoalsStore {
  version: 1;
  goals: StoredGoal[];
  /** 反映済みの GoalCandidate.id。同じ目標を二重に取り込まないための鍵 */
  reflectedCandidateIds: string[];
}

function normalize(v: unknown): GoalsStore {
  const parsed = (v ?? {}) as Partial<GoalsStore>;
  return {
    version: 1,
    goals: Array.isArray(parsed.goals) ? parsed.goals : SEED.map((g) => ({ ...g })),
    reflectedCandidateIds: Array.isArray(parsed.reflectedCandidateIds)
      ? parsed.reflectedCandidateIds
      : [],
  };
}

function read(): GoalsStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return normalize(null);
    return normalize(JSON.parse(raw));
  } catch {
    return normalize(null);
  }
}

function write(store: GoalsStore): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* 容量超過などは黙って諦める（モックのため） */
  }
}

export function listGoals(): StoredGoal[] {
  return read().goals;
}

/** マイページからの編集を丸ごと反映する（PUT） */
export function replaceGoals(goals: StoredGoal[]): StoredGoal[] {
  const store = read();
  // no を1から振り直す。表示順＝no なので、削除で歯抜けになると並びが崩れる
  store.goals = goals.map((g, i) => ({
    no: i + 1,
    description: g.description,
    is_completed: g.progress >= 100 ? 1 : g.is_completed,
    progress: g.progress,
  }));
  write(store);
  return store.goals;
}

/**
 * コーチング記録で確定した目標を取り込む。
 * 同じ候補（GoalCandidate.id）は二度追加しない。
 * @returns 実際に追加された件数
 */
export function reflectCandidates(
  candidates: { id: string; title: string }[]
): { added: number; goals: StoredGoal[] } {
  const store = read();
  const fresh = candidates.filter((c) => !store.reflectedCandidateIds.includes(c.id));
  if (fresh.length === 0) return { added: 0, goals: store.goals };

  // 既に同じ文言があるなら追加しない（コーチが同じ内容を再確定した場合の重複を防ぐ）
  const existing = new Set(store.goals.map((g) => g.description.trim()));
  let no = store.goals.reduce((max, g) => Math.max(max, g.no), 0);
  const added: StoredGoal[] = [];
  fresh.forEach((c) => {
    const text = c.title.trim();
    if (!text || existing.has(text)) return;
    existing.add(text);
    no += 1;
    added.push({ no, description: text, is_completed: 0, progress: 0 });
  });

  store.goals = [...store.goals, ...added];
  store.reflectedCandidateIds = Array.from(
    new Set([...store.reflectedCandidateIds, ...fresh.map((c) => c.id)])
  );
  write(store);
  return { added: added.length, goals: store.goals };
}

/** 【モック確認用】初期状態に戻す */
export function resetGoals(): StoredGoal[] {
  const store: GoalsStore = { version: 1, goals: SEED.map((g) => ({ ...g })), reflectedCandidateIds: [] };
  write(store);
  return store.goals;
}
