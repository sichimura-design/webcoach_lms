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
  'no' | 'description' | 'is_completed' | 'progress' | 'completed_at'
>;

/**
 * 初期値。コーチが前回のコーチングで設定した内容という想定。
 * completed_at はモック専用（実BFFは返さない）。達成した目標に「いつ終えたか」が付くと、
 * 積み上がっている感じが出るのでマイページの目標カードで出している。
 */
const SEED: StoredGoal[] = [
  { no: 1, description: '配色の基礎を修了する', is_completed: 1, progress: 100, completed_at: '2026-08-10T10:00:00+09:00' },
  { no: 2, description: 'バナーを1つ完成させる', is_completed: 1, progress: 100, completed_at: '2026-08-12T15:30:00+09:00' },
  { no: 3, description: 'レイアウト実践に着手する', is_completed: 0, progress: 0, completed_at: null },
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
  // 打刻の引き継ぎ用。no は振り直すので、文言で前の状態を引く
  const before = new Map(store.goals.map((g) => [g.description.trim(), g]));
  const now = new Date().toISOString();

  // no を1から振り直す。表示順＝no なので、削除で歯抜けになると並びが崩れる
  store.goals = goals.map((g, i) => {
    const completed = g.progress >= 100 ? 1 : g.is_completed;
    const prev = before.get(g.description.trim());
    return {
      no: i + 1,
      description: g.description,
      is_completed: completed as 0 | 1,
      progress: g.progress,
      // 未達→達成で打刻し、達成→未達で消す。達成のままなら最初の打刻を保つ
      completed_at: completed ? (prev?.completed_at ?? now) : null,
    };
  });
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
    added.push({ no, description: text, is_completed: 0, progress: 0, completed_at: null });
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
