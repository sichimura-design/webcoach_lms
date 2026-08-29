import { useCallback, useEffect, useState } from 'react';
import { bffClient } from '../services/bffClient';
import { StudyCalendarDay, StudyRanking, StudySession, StudyStats, StudyStatsSummary, StudyStreakInfo } from '../types/studyActivity';
import { useStudyTimerStore } from '../store/studyTimerStore';

export interface StudyStatsBundle {
  stats: StudyStats | null;
  streak: StudyStreakInfo | null;
  recent: StudySession[];
  ranking: StudyRanking | null;
  calendarDays: StudyCalendarDay[];
  calendarYear: number;
  /** 0-indexed(0=1月)。StudyCalendarのmonth propと揃える */
  calendarMonth: number;
  loading: boolean;
  setCalendarMonth: (year: number, month: number) => void;
  /** セッション終了後などに呼んで再取得する */
  refresh: () => void;
}

/**
 * dev/kanegae統合メモ: このファイルには同名 `useStudyStats` の2実装が競合していたため、
 * 実バックエンド(api-server/routers/study.py)接続版を `useStudyStatsBundle` に改名した
 * （呼び出し元は現状 FocusBoothPage.tsx のみ）。下の `useStudyStats`（dev/miyabe）は
 * モック専用のまま残す。
 *
 * 今日/今週/累計・ストリーク・カレンダー・直近セッション・ランキングをまとめて取得する。
 * 集計はすべてapi-server側(mdl_logstore_standard_log)で計算済み。
 */
export function useStudyStatsBundle(userId: number | undefined): StudyStatsBundle {
  const now = new Date();
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [calendarMonth, setCalendarMonthState] = useState(now.getMonth());

  const [stats, setStats] = useState<StudyStats | null>(null);
  const [streak, setStreak] = useState<StudyStreakInfo | null>(null);
  const [recent, setRecent] = useState<StudySession[]>([]);
  const [ranking, setRanking] = useState<StudyRanking | null>(null);
  const [calendarDays, setCalendarDays] = useState<StudyCalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  const setCalendarMonth = useCallback((year: number, month: number) => {
    setCalendarYear(year);
    setCalendarMonthState(month);
  }, []);

  const refresh = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      bffClient.getStudyStatsBundle(userId),
      bffClient.getStudyStreak(userId),
      bffClient.getRecentStudySessions(userId, 5),
      bffClient.getStudyRanking('week', 20),
    ])
      .then(([statsRes, streakRes, recentRes, rankingRes]) => {
        if (cancelled) return;
        setStats(statsRes);
        setStreak(streakRes);
        setRecent(recentRes);
        setRanking(rankingRes);
      })
      .catch(() => {
        // 未取得のまま(null/空配列)にしておけばUI側がローディング/ダッシュ表示にフォールバックする
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, revision]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    bffClient
      .getStudyCalendar(userId, calendarYear, calendarMonth + 1)
      .then((data) => {
        if (!cancelled) setCalendarDays(data.days);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [userId, calendarYear, calendarMonth, revision]);

  return {
    stats,
    streak,
    recent,
    ranking,
    calendarDays,
    calendarYear,
    calendarMonth,
    loading,
    setCalendarMonth,
    refresh,
  };
}

/**
 * 今日/今週/今月の学習時間・セッション数・最長集中・ストリーク・日別・教材別・最近の履歴。
 *
 * react-query / SWR がこのリポジトリに無いため、useLearningPlan.ts と同じ
 * 手書きの useState + useEffect 形に揃える。
 *
 * TODO(backend未実装): このモック集計API(GET /webcoach/study-stats/{userId})は
 *   実BFFに存在しない。unavailable フラグで縮退させる設計はそのまま活かす。
 */
export interface UseStudyStatsResult {
  stats: StudyStatsSummary | null;
  loading: boolean;
  /**
   * 取得できなかった = モックOFF（本番）で実BFFにこのAPIが無い、または通信失敗。
   * 🔴 エラー文言ではなくこのフラグを返すのは、本番で赤いエラーが出続けるのを避けるため。
   *    呼び出し側は「統計セクションを出さない」に縮退させる（タイマー自体は動く）。
   */
  unavailable: boolean;
  reload: () => void;
}

export function useStudyStats(userId: number | undefined, days = 35): UseStudyStatsResult {
  const [stats, setStats] = useState<StudyStatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [trigger, setTrigger] = useState(0);
  // 記録が保存されるたびに全画面を同期させる
  const activityRevision = useStudyTimerStore((s) => s.activityRevision);

  const reload = useCallback(() => setTrigger((t) => t + 1), []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    bffClient
      .getStudyStatsSummary(userId, days)
      .then((s) => {
        if (cancelled) return;
        setStats(s);
        setUnavailable(false);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setStats(null);
        setUnavailable(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, days, trigger, activityRevision]);

  return { stats, loading, unavailable, reload };
}

export default useStudyStats;
