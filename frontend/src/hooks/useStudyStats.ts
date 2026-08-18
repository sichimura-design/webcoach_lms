import { useCallback, useEffect, useState } from 'react';
import { bffClient } from '../services/bffClient';
import { StudyCalendarDay, StudySession, StudyStats, StudyStreak } from '../types/studyActivity';

export interface StudyStatsBundle {
  stats: StudyStats | null;
  streak: StudyStreak | null;
  recent: StudySession[];
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
 * 今日/今週/累計・ストリーク・カレンダー・直近セッションをまとめて取得する。
 * 集計はすべてapi-server側(webcoach_study_activityテーブル)で計算済み。
 */
export function useStudyStats(userId: number | undefined): StudyStatsBundle {
  const now = new Date();
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [calendarMonth, setCalendarMonthState] = useState(now.getMonth());

  const [stats, setStats] = useState<StudyStats | null>(null);
  const [streak, setStreak] = useState<StudyStreak | null>(null);
  const [recent, setRecent] = useState<StudySession[]>([]);
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
      bffClient.getStudyStats(userId),
      bffClient.getStudyStreak(userId),
      bffClient.getRecentStudySessions(userId, 5),
    ])
      .then(([statsRes, streakRes, recentRes]) => {
        if (cancelled) return;
        setStats(statsRes);
        setStreak(streakRes);
        setRecent(recentRes);
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
    calendarDays,
    calendarYear,
    calendarMonth,
    loading,
    setCalendarMonth,
    refresh,
  };
}
