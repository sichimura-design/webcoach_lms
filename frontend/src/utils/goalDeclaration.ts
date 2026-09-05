/**
 * 目標宣言の純関数。副作用なし。
 * ============================================================
 * utils/studyStats.ts と同じ理由でここに集約する:
 *   MSWモックハンドラと画面の両方が同じ関数を呼ぶため
 *   （「モックでは通るのに画面では弾かれる」を構造的に防ぐ）。
 *
 * 🔴 「いま有効な宣言」の判定はここが唯一の実装。サーバのレスポンスに持たせない。
 *    日付から一意に決まる話を2箇所で持つと必ずズレる。
 * ============================================================
 */
import { StudyDayTotal } from '../types/studyActivity';
import {
  DECLARATION_REFLECTION_MAX,
  DECLARATION_TEXT_MAX,
  GoalDeclaration,
  GoalDeclarationInput,
  GoalDeclarationPatch,
} from '../types/goalDeclaration';
import { toLocalDateKey } from './studyStats';

/** 期間と今日の関係。status（本人の意思）とは別物 */
export type DeclarationPhase = 'upcoming' | 'current' | 'past';

export function declarationPhase(d: GoalDeclaration, todayKey: string): DeclarationPhase {
  if (todayKey < d.periodFrom) return 'upcoming';
  if (todayKey > d.periodTo) return 'past';
  return 'current';
}

/**
 * いま有効な宣言。期間中かつ本人がまだ進行中としているもののうち、開始日が最も新しい1件。
 *
 * 複数の宣言が同時に走ること自体は許す（月の宣言と週の宣言を併走させたい人がいる）。
 * ただしトップページに出すのは1件だけにして、「どれが今の目標か」の判断を
 * 画面ごとにばらけさせない。
 */
export function activeDeclaration(
  items: GoalDeclaration[],
  todayKey: string = toLocalDateKey(new Date())
): GoalDeclaration | null {
  const current = items.filter(
    (d) => d.status === 'active' && declarationPhase(d, todayKey) === 'current'
  );
  if (current.length === 0) return null;
  return current.reduce((best, d) => (d.periodFrom > best.periodFrom ? d : best));
}

/**
 * 期間が終わったのに振り返りがまだのもの（新しい順）。
 * 「書きっぱなしで放置」を画面から拾えるようにするための導出。
 */
export function awaitingReflection(
  items: GoalDeclaration[],
  todayKey: string = toLocalDateKey(new Date())
): GoalDeclaration[] {
  return sortDeclarations(
    items.filter((d) => d.status === 'active' && declarationPhase(d, todayKey) === 'past')
  );
}

/** 開始日の新しい順。同じ日なら作成の新しい順 */
export function sortDeclarations(items: GoalDeclaration[]): GoalDeclaration[] {
  return [...items].sort(
    (a, b) => b.periodFrom.localeCompare(a.periodFrom) || b.createdAt.localeCompare(a.createdAt)
  );
}

// ---- 検証 ------------------------------------------------------------------
// 文言はそのまま画面に出せる日本語を返す。null なら問題なし。

function isDateKey(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function periodError(from: string, to: string): string | null {
  if (!isDateKey(from) || !isDateKey(to)) return '期間の日付を選んでください';
  if (from > to) return '終わりの日は始まりの日より後にしてください';
  return null;
}

function textError(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return '目標を入力してください';
  if (trimmed.length > DECLARATION_TEXT_MAX) return `目標は${DECLARATION_TEXT_MAX}文字までにしてください`;
  return null;
}

export function validateDeclarationInput(v: GoalDeclarationInput): string | null {
  if (!v.id) return '宣言IDがありません';
  return textError(v.text) ?? periodError(v.periodFrom, v.periodTo);
}

export function validateDeclarationPatch(
  cur: GoalDeclaration,
  p: GoalDeclarationPatch
): string | null {
  if (p.text !== undefined) {
    const e = textError(p.text);
    if (e) return e;
  }
  if (p.periodFrom !== undefined || p.periodTo !== undefined) {
    const e = periodError(p.periodFrom ?? cur.periodFrom, p.periodTo ?? cur.periodTo);
    if (e) return e;
  }
  if (p.reflection != null && p.reflection.length > DECLARATION_REFLECTION_MAX) {
    return `振り返りは${DECLARATION_REFLECTION_MAX}文字までにしてください`;
  }
  return null;
}

/** 保存前に整える。長すぎるテキストは弾かずに切る（studyStats.clampText と同じ方針） */
export function clampDeclarationText(v: string): string {
  return v.trim().slice(0, DECLARATION_TEXT_MAX);
}

export function clampReflection(v: string | null | undefined): string | null {
  const trimmed = (v ?? '').trim();
  return trimmed ? trimmed.slice(0, DECLARATION_REFLECTION_MAX) : null;
}

let idCounter = 0;

/** `gd-<epochMs>-<base36>`。同一msで連続生成しても衝突しないようカウンタを混ぜる */
export function newDeclarationId(nowMs: number = Date.now()): string {
  idCounter = (idCounter + 1) % 1296; // 36^2
  return `gd-${nowMs}-${idCounter.toString(36).padStart(2, '0')}`;
}

// ---- 学習実績との突き合わせ -------------------------------------------------

/**
 * 宣言の期間中に学習した分数。
 *
 * 🔴 これは「達成率」ではない。宣言に目標分数を持たせていないので、割る相手が無い。
 *    「この期間にこれだけやった」という事実を1つ添えるためだけの値で、
 *    パーセントやゲージにしないこと。
 */
export function declarationMinutes(d: GoalDeclaration, daily: StudyDayTotal[]): number {
  let minutes = 0;
  for (const day of daily) {
    if (day.date < d.periodFrom || day.date > d.periodTo) continue;
    minutes += day.minutes;
  }
  return minutes;
}

/** 宣言の期間中に学習した日数（10分以上の日）。isStudyDay をそのまま使う */
export function declarationStudyDays(d: GoalDeclaration, daily: StudyDayTotal[]): number {
  return daily.filter((day) => day.date >= d.periodFrom && day.date <= d.periodTo && day.isStudyDay)
    .length;
}

/** 残り日数。期間が終わっていれば 0。「あと12日」の表示に使う */
export function daysLeft(d: GoalDeclaration, todayKey: string = toLocalDateKey(new Date())): number {
  if (todayKey > d.periodTo) return 0;
  const to = new Date(Number(d.periodTo.slice(0, 4)), Number(d.periodTo.slice(5, 7)) - 1, Number(d.periodTo.slice(8, 10)));
  const today = new Date(Number(todayKey.slice(0, 4)), Number(todayKey.slice(5, 7)) - 1, Number(todayKey.slice(8, 10)));
  return Math.max(0, Math.round((to.getTime() - today.getTime()) / 86_400_000));
}
