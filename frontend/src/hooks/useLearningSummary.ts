import { useEffect, useMemo } from 'react';
import { Course } from '../types/mypage';
import { StudyStatsSummary } from '../types/studyActivity';

interface SummaryValue {
  total: number;
  weekDelta: number | null;
}

export interface LearningSummary {
  studyMinutes: SummaryValue;
  completedLessons: SummaryValue;
  thisWeekMinutes: number; // 今週分の学習時間（週間目標との対比に使う）
  /** 学習時間が実測（集中ブースの記録）由来か。推定のときは false */
  measured: boolean;
}

const SNAPSHOT_KEY = 'webcoach-learning-summary-snapshots';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface SnapshotValue {
  studyMinutes: number;
  completedLessons: number;
}

// 月曜始まりの週の月曜日をキーにする（YYYY-MM-DD）
// 注: ここは完了レッスン数のスナップショット用。学習時間の日付集計は
//     utils/studyStats.ts の toLocalDateKey を使う（toISOString はUTC日付になるため）。
function getWeekKey(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=日 1=月 ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
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

/**
 * マイページの学習サマリー。
 *
 * 🔴 学習時間は「集中ブースの実測（measured）」を正とし、取得できないときだけ
 *    コースの進捗率からの推定に落とす。
 *    同じ「今週の学習時間」が2つ存在すると必ず食い違うため、実測があるならそれ1つにする。
 *    （推定のみだった頃は、前週スナップショットが無い最初の週に累計を今週として
 *      表示してしまう問題があった。実測があればその問題自体が消える。）
 *    完了レッスン数は時間ではなくレッスン数なので、進捗率からの導出を維持する。
 *
 * @param measured useStudyStats の結果。null なら推定にフォールバックする（本番=モックOFF）
 */
export function useLearningSummary(
  courses: Course[],
  measured: StudyStatsSummary | null = null
): LearningSummary {
  const estimated = useMemo(() => {
    const studyMinutesTotal = courses.reduce((sum, c) => {
      const ratio = (c.progress ?? 0) / 100;
      return sum + (c.durationMinutes ?? 0) * ratio;
    }, 0);
    const completedLessonsTotal = courses.reduce((sum, c) => {
      const ratio = (c.progress ?? 0) / 100;
      return sum + (c.totalLessons ?? 0) * ratio;
    }, 0);
    return {
      studyMinutes: Math.round(studyMinutesTotal),
      completedLessons: Math.round(completedLessonsTotal),
    };
  }, [courses]);

  // スナップショットの書き込みは副作用なので useMemo の中では行わない
  useEffect(() => {
    writeSnapshot(getWeekKey(new Date()), {
      studyMinutes: estimated.studyMinutes,
      completedLessons: estimated.completedLessons,
    });
  }, [estimated.studyMinutes, estimated.completedLessons]);

  return useMemo(() => {
    const now = new Date();
    const snapshots = readSnapshots();
    const lastWeekSnapshot = snapshots[getWeekKey(new Date(now.getTime() - WEEK_MS))];
    const lessonDelta = lastWeekSnapshot
      ? estimated.completedLessons - lastWeekSnapshot.completedLessons
      : null;

    if (measured) {
      return {
        studyMinutes: {
          total: measured.allTime.minutes,
          weekDelta: measured.week.minutes - measured.lastWeek.minutes,
        },
        completedLessons: { total: estimated.completedLessons, weekDelta: lessonDelta },
        thisWeekMinutes: measured.week.minutes,
        measured: true,
      };
    }

    // 実測が取れない（モックOFF・通信失敗）ときは従来の推定に落とす
    const estimatedWeekDelta = lastWeekSnapshot
      ? estimated.studyMinutes - lastWeekSnapshot.studyMinutes
      : null;
    return {
      studyMinutes: { total: estimated.studyMinutes, weekDelta: estimatedWeekDelta },
      completedLessons: { total: estimated.completedLessons, weekDelta: lessonDelta },
      thisWeekMinutes: estimatedWeekDelta ?? estimated.studyMinutes,
      measured: false,
    };
  }, [estimated, measured]);
}
