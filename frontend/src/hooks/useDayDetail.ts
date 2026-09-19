/**
 * カレンダーで選んだ1日の中身。日別詳細パネルが使う。
 * ============================================================
 * 🔴 なぜ useMonthActivities（StudyActivity系）を使わないのか:
 *    その仕組みは実BFFに対応するAPIが無いモックのみの実装で、実認証環境では
 *    常に空を返していた（day-detail-mock-only-bug）。学習時間・教材・区間は
 *    Moodiログ由来の実データ（StudySession, /api/study/sessions/:userid/by-date）を
 *    正とし、ここには持たない。ユーザーが書けるのはその日の振り返り
 *    （達成度・メモ、StudyReflection）だけ。
 *
 * 🔴 月単位でまとめて取らず、選んだ日だけを都度取る:
 *    セッションは編集も削除もできない読み取り専用データなので、月内の日送りで
 *    まとめて先読みしておく必要が薄い（クリックごとに1回GETが増えるだけ）。
 * ============================================================
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { bffClient } from '../services/bffClient';
import { StudyReflection, StudyReflectionPatch, StudySession } from '../types/studyActivity';

export interface UseDayDetailResult {
  /** 選んだ日に完了した学習セッション（新しい順）。未取得/未選択なら空配列 */
  sessions: StudySession[];
  /** 選んだ日の振り返り。未入力またはAPI未対応環境ではnull */
  reflection: StudyReflection | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveReflection: (patch: StudyReflectionPatch) => Promise<void>;
  deleteReflection: () => Promise<void>;
}

export function useDayDetail(userId: number | undefined, date: string | null): UseDayDetailResult {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [reflection, setReflection] = useState<StudyReflection | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 応答が前後しても最後に選んだ日の結果だけを採る（useMonthActivities と同じ作法）
  const reqRef = useRef(0);

  useEffect(() => {
    if (!userId || !date) {
      setSessions([]);
      setReflection(null);
      setLoading(false);
      return;
    }

    const seq = ++reqRef.current;
    setLoading(true);
    setError(null);
    Promise.all([
      bffClient.getStudySessionsByDate(userId, date),
      // 振り返りAPI未対応環境（本番未適用など）でもセッション一覧だけは出す
      bffClient.getStudyReflection(userId, date).catch(() => null),
    ])
      .then(([sessionList, reflectionResult]) => {
        if (seq !== reqRef.current) return;
        setSessions(sessionList);
        setReflection(reflectionResult);
      })
      .catch(() => {
        if (seq !== reqRef.current) return;
        setSessions([]);
        setReflection(null);
      })
      .finally(() => {
        if (seq === reqRef.current) setLoading(false);
      });
  }, [userId, date]);

  const saveReflection = useCallback(
    async (patch: StudyReflectionPatch) => {
      if (!userId || !date) return;
      setSaving(true);
      setError(null);
      try {
        const saved = await bffClient.updateStudyReflection(userId, date, patch);
        setReflection(saved);
      } catch {
        setError('振り返りを保存できませんでした');
        throw new Error('振り返りを保存できませんでした');
      } finally {
        setSaving(false);
      }
    },
    [userId, date]
  );

  const deleteReflection = useCallback(async () => {
    if (!userId || !date) return;
    setSaving(true);
    setError(null);
    try {
      await bffClient.deleteStudyReflection(userId, date);
      setReflection(null);
    } catch {
      setError('振り返りを削除できませんでした');
      throw new Error('振り返りを削除できませんでした');
    } finally {
      setSaving(false);
    }
  }, [userId, date]);

  return { sessions, reflection, loading, saving, error, saveReflection, deleteReflection };
}

export default useDayDetail;
