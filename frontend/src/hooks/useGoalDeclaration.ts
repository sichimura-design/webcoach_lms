/**
 * 「あなたの目標」の取得と書き換え。/study-log（編集の主戦場）と /mypage（表示のみ）が使う。
 * ============================================================
 * 🔴 画面表記は「あなたの目標」。GoalDeclaration / goal-declarations は
 *    型・API・ファイル名だけの呼称で、UI に「宣言」の語を出さない。
 *
 * 作法は useNoteList / useNoteFolders に揃える:
 *   ・reqRef のシーケンス番号で、応答が前後しても最後のリクエストの結果だけを採る
 *   ・エラーは日本語の固定文言（例外の中身は画面に出さない）
 *   ・update だけ楽観更新。振り返りを保存するたびに一覧を取り直すとちらつくため。
 *     create / remove は並びが変わるので取り直す。
 *   ・🔴 error は保存・削除の失敗だけを表す。reload の成功で消さないこと
 *     （update の失敗直後に取り直すと、出したばかりの文言が消えていた）。
 *     消すのは次の保存を始めたときと、呼び出し側の clearError（モーダルを閉じたとき）。
 *
 * 🔴 unavailable は「モックOFF（本番）でこのAPIが無い」。エラー表示ではなくフラグで返すのは、
 *    本番で赤いエラーを出し続けないため（useStudyStats と同じ縮退のしかた）。
 *    呼び出し側は「カードごと出さない」に畳む。
 * ============================================================
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { bffClient } from '../services/bffClient';
import {
  GoalDeclaration,
  GoalDeclarationInput,
  GoalDeclarationPatch,
} from '../types/goalDeclaration';
import {
  activeDeclaration,
  awaitingReflection,
  newDeclarationId,
  sortDeclarations,
  validateDeclarationInput,
  validateDeclarationPatch,
} from '../utils/goalDeclaration';
import { toLocalDateKey } from '../utils/studyStats';

export interface UseGoalDeclarationResult {
  /** 新しい順 */
  items: GoalDeclaration[];
  /** いま有効な目標（activeDeclaration の結果）。無ければ null */
  active: GoalDeclaration | null;
  /** 期間が終わったのに振り返りがまだのもの（新しい順） */
  pendingReflection: GoalDeclaration[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  /** 取得できなかった = モックOFF。カードごと出さないための縮退フラグ */
  unavailable: boolean;
  reload: () => Promise<void>;
  /** 保存エラーの文言を消す。モーダルを閉じたとき・開くときに呼ぶ */
  clearError: () => void;
  create: (input: Omit<GoalDeclarationInput, 'id'>) => Promise<GoalDeclaration>;
  update: (id: string, patch: GoalDeclarationPatch) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function messageOf(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
  return typeof detail === 'string' && detail ? detail : fallback;
}

export function useGoalDeclaration(userId: number | undefined): UseGoalDeclarationResult {
  const [items, setItems] = useState<GoalDeclaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  // 応答が前後しても最後のリクエストの結果だけを採る（useNoteList と同じ）
  const reqRef = useRef(0);

  const reload = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const seq = ++reqRef.current;
    setLoading(true);
    try {
      const list = await bffClient.getGoalDeclarations(userId);
      if (seq !== reqRef.current) return;
      setItems(sortDeclarations(list));
      setUnavailable(false);
    } catch {
      if (seq !== reqRef.current) return;
      setItems([]);
      // 一覧が取れない = このAPIが無い環境。エラー文言ではなくフラグで畳む
      setUnavailable(true);
    } finally {
      if (seq === reqRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(
    async (input: Omit<GoalDeclarationInput, 'id'>) => {
      if (!userId) throw new Error('userId がありません');
      const full: GoalDeclarationInput = { ...input, id: newDeclarationId() };

      // 送る前に検証する。サーバ役（MSW）も同じ関数を使うので文言が2種類にならない
      const invalid = validateDeclarationInput(full);
      if (invalid) {
        setError(invalid);
        throw new Error(invalid);
      }

      setSaving(true);
      setError(null);
      try {
        const created = await bffClient.createGoalDeclaration(userId, full);
        // 並びが変わるので取り直す（楽観更新で差し込むと periodFrom 順が崩れる）
        await reload();
        return created;
      } catch (e) {
        setError(messageOf(e, '目標を保存できませんでした'));
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [userId, reload]
  );

  const update = useCallback(
    async (id: string, patch: GoalDeclarationPatch) => {
      if (!userId) return;
      const cur = items.find((d) => d.id === id);
      if (cur) {
        const invalid = validateDeclarationPatch(cur, patch);
        if (invalid) {
          setError(invalid);
          throw new Error(invalid);
        }
      }

      setSaving(true);
      setError(null);
      // 楽観更新。振り返りの保存でカードが一瞬空にならないように
      const before = cur;
      setItems((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } as GoalDeclaration : d)));
      try {
        const saved = await bffClient.updateGoalDeclaration(userId, id, patch);
        setItems((prev) => sortDeclarations(prev.map((d) => (d.id === id ? saved : d))));
      } catch (e) {
        // 楽観更新した1件だけを元に戻す。取り直しはしない（通信できない状況で
        // 取り直しても失敗するだけで、入力中のモーダルの対象も揺れる）
        if (before) setItems((prev) => prev.map((d) => (d.id === id ? before : d)));
        setError(messageOf(e, '目標を保存できませんでした'));
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [userId, items]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!userId) return;
      setSaving(true);
      setError(null);
      try {
        await bffClient.deleteGoalDeclaration(userId, id);
        await reload();
      } catch (e) {
        setError(messageOf(e, '目標を削除できませんでした'));
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [userId, reload]
  );

  const clearError = useCallback(() => setError(null), []);

  const todayKey = toLocalDateKey(new Date());

  return {
    items,
    active: activeDeclaration(items, todayKey),
    pendingReflection: awaitingReflection(items, todayKey),
    loading,
    saving,
    error,
    unavailable,
    reload,
    clearError,
    create,
    update,
    remove,
  };
}

export default useGoalDeclaration;
