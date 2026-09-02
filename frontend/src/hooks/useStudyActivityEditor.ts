/**
 * 学習記録の書き換え（編集・削除・手動追加）。
 * ============================================================
 * タイマーの止め忘れ（長すぎる記録）と付け忘れ（記録が無い日）の両方を、
 * 受講生が自分で直せるようにするためのフック。
 *
 * 🔴 読み取り（useMonthActivities）と分けている理由:
 *    あちらは「見ている月のぶんを取ってくる」専用で、書き換えの状態（保存中・
 *    エラー文言）を持たせると、月を送るたびにそれが消える。
 *    書き換えの入口はカレンダーの日別パネルだけなので、こちらは画面を持たない。
 *
 * 🔴 楽観更新をしない理由:
 *    学習時間を1つ直すと segments の再按分 → 日別合計 → ストリーク → ランキングまで
 *    波及する。手元で作った暫定値と summarize() の結果は必ずどこかで食い違うので、
 *    「一瞬それっぽく見えて、直後に別の数字に飛ぶ」ほうが混乱する。
 *    保存中は呼び出し側が行を disabled にして待たせる（モックの遅延は 200〜300ms）。
 *
 * 🔴 成功したら必ず bumpActivityRevision() を呼ぶ。
 *    useStudyStats / useMonthActivities が両方これを購読しているので、
 *    KPI・カレンダーの濃淡・推移グラフ・日別パネルが一斉に追随する。
 *    「パネルでは消えたのにストリークが減らない」を構造的に起きなくするのがこの1行。
 * ============================================================
 */
import { useCallback, useState } from 'react';
import { bffClient } from '../services/bffClient';
import {
  ManualStudyEntryInput,
  StudyActivity,
  StudyActivityPatch,
} from '../types/studyActivity';
import { useStudyTimerStore } from '../store/studyTimerStore';
import {
  buildManualActivityInput,
  newManualActivityId,
  validateActivityPatch,
  validateManualEntry,
} from '../utils/studyStats';

export interface UseStudyActivityEditorResult {
  saving: boolean;
  /** 直前の操作が失敗した理由（日本語）。次の操作を始めた時点で消える */
  error: string | null;
  clearError: () => void;
  /** 記録し忘れた分を足す。id は内部で採番する */
  addManual: (input: Omit<ManualStudyEntryInput, 'id'>) => Promise<StudyActivity>;
  /** 対象の記録そのものを受け取る（検証に元の値が要るため。remove と揃えてある） */
  update: (activity: StudyActivity, patch: StudyActivityPatch) => Promise<StudyActivity>;
  remove: (activity: StudyActivity) => Promise<void>;
}

/** 通信エラーの既定文言。サーバ役が返した検証エラーはそちらを優先する */
function messageOf(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
  return typeof detail === 'string' && detail ? detail : fallback;
}

export function useStudyActivityEditor(userId: number | undefined): UseStudyActivityEditorResult {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bump = useStudyTimerStore((s) => s.bumpActivityRevision);

  const clearError = useCallback(() => setError(null), []);

  const addManual = useCallback(
    async (input: Omit<ManualStudyEntryInput, 'id'>) => {
      if (!userId) throw new Error('userId がありません');
      const full: ManualStudyEntryInput = { ...input, id: newManualActivityId() };

      // 送る前に検証する。サーバ役（MSW）も同じ関数を使うので文言が2種類にならない
      const invalid = validateManualEntry(full);
      if (invalid) {
        setError(invalid);
        throw new Error(invalid);
      }

      setSaving(true);
      setError(null);
      try {
        const saved = await bffClient.recordStudyActivity(userId, buildManualActivityInput(full));
        bump();
        return saved;
      } catch (e) {
        setError(messageOf(e, '記録を追加できませんでした'));
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [userId, bump]
  );

  const update = useCallback(
    async (activity: StudyActivity, patch: StudyActivityPatch) => {
      if (!userId) throw new Error('userId がありません');

      // 送る前に検証する。サーバ役（MSW）も同じ関数を使うので文言が2種類にならない
      const invalid = validateActivityPatch(activity, patch);
      if (invalid) {
        setError(invalid);
        throw new Error(invalid);
      }

      setSaving(true);
      setError(null);
      try {
        const saved = await bffClient.updateStudyActivity(userId, activity.id, patch);
        bump();
        return saved;
      } catch (e) {
        setError(messageOf(e, '記録を保存できませんでした'));
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [userId, bump]
  );

  const remove = useCallback(
    async (activity: StudyActivity) => {
      if (!userId) return;
      setSaving(true);
      setError(null);
      try {
        await bffClient.deleteStudyActivity(userId, activity.id);
        bump();
      } catch (e) {
        setError(messageOf(e, '記録を削除できませんでした'));
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [userId, bump]
  );

  return { saving, error, clearError, addManual, update, remove };
}

export default useStudyActivityEditor;

// validateActivityPatch は画面側（編集モーダル）が送信前の検証に使う。
// フック経由でも呼べるよう re-export しておく（import 元が studyStats と hooks に割れないように）。
export { validateActivityPatch };
