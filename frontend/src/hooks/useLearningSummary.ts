import { useMemo } from 'react';
import { Course } from '../types/mypage';

interface SummaryValue {
  total: number;
  weekDelta: number | null;
}

export interface LearningSummary {
  studyMinutes: SummaryValue;
  completedLessons: SummaryValue;
  thisWeekMinutes: number; // 今週分の学習時間（週間目標との対比に使う）
}

const SNAPSHOT_KEY = 'webcoach-learning-summary-snapshots';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface SnapshotValue {
  studyMinutes: number;
  completedLessons: number;
}

// 月曜始まりの週の月曜日をキーにする（YYYY-MM-DD）
function getWeekKey(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=日 1=月 ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function readSnapshots(): Record<string, SnapshotValue> {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeSnapshot(weekKey: string, value: SnapshotValue): void {
  try {
    const snapshots = readSnapshots();
    snapshots[weekKey] = value;
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));
  } catch {
    // localStorageが使えない環境では諦める（サマリー表示自体には影響しない）
  }
}

export function useLearningSummary(courses: Course[]): LearningSummary {
  return useMemo(() => {
    const studyMinutesTotal = courses.reduce((sum, c) => {
      const ratio = (c.progress ?? 0) / 100;
      return sum + (c.durationMinutes ?? 0) * ratio;
    }, 0);
    const completedLessonsTotal = courses.reduce((sum, c) => {
      const ratio = (c.progress ?? 0) / 100;
      return sum + (c.totalLessons ?? 0) * ratio;
    }, 0);

    const studyMinutes = Math.round(studyMinutesTotal);
    const completedLessons = Math.round(completedLessonsTotal);

    const now = new Date();
    const thisWeekKey = getWeekKey(now);
    const lastWeekKey = getWeekKey(new Date(now.getTime() - WEEK_MS));

    const snapshots = readSnapshots();
    const lastWeekSnapshot = snapshots[lastWeekKey];

    writeSnapshot(thisWeekKey, { studyMinutes, completedLessons });

    const weekDelta = lastWeekSnapshot ? studyMinutes - lastWeekSnapshot.studyMinutes : null;

    return {
      studyMinutes: {
        total: studyMinutes,
        weekDelta,
      },
      completedLessons: {
        total: completedLessons,
        weekDelta: lastWeekSnapshot ? completedLessons - lastWeekSnapshot.completedLessons : null,
      },
      // 前週スナップショットが無い最初の週は、今週分の目安として現在の合計をそのまま使う
      thisWeekMinutes: weekDelta ?? studyMinutes,
    };
  }, [courses]);
}
