/**
 * 学習アクティビティの初期シード（モック専用）
 * ============================================================
 * 何もしていない状態でも「今日／今週／今月・ストリーク・カレンダー・グラフ・教材別」の
 * すべてが検証できる過去データを、**今日を起点に相対的に**組み立てる。
 * 固定日付を書くと日が変わった瞬間に「先月のデータしか無い画面」になって検証できなくなる。
 *
 * 🔴 Math.random() は使わない。
 *    リロードごとに数字が変わると「表示がおかしいのは仕様かバグか」を判別できなくなる。
 *    日数インデックスからの決定的な擬似乱数にしてある。
 *
 * 意図的に仕込んである条件（画面で確認するためのもの）:
 *   - 今日を含む直近5日が連続      → 現在ストリークが 5 になる
 *   - 過去に、それより長い連続の帯がある
 *                                  → 「現在」と「過去最長」が別の数字として見える
 *                                     （どちらも休みの日の置き方から決まるので、実際の値は
 *                                       describeSeed() と utils/studyStats.ts の
 *                                       computeStreak() で測る。ここに数字は書かない）
 *   - 3日ぶんは合計10分未満        → 学習日として成立しない（閾値ロジックの確認）
 *   - 6日は完全な休み              → カレンダーに未学習日が出る
 *   - 教材は 101/102/201/203 と null（指定なし）を混ぜる → 教材別集計の確認
 *   - pomodoro / freeform 両方、1件は adjusted: true（時間を修正した記録）
 *   - カテゴリ配分を5パターン混ぜる       → カテゴリ別内訳（トップ・終了カード）の確認
 *                                          「教材だけの日」も混ぜて、内訳1行のときに
 *                                          表示を畳む挙動も見られるようにしてある
 * ============================================================
 */
import { format, subDays } from 'date-fns';
import {
  StudyActivity,
  StudyActivityCourseRef,
  StudyCategory,
  StudySegmentTotal,
} from '../types/studyActivity';
import { STUDY_DAY_MIN_MINUTES, toLocalDateKey } from '../utils/studyStats';

const SEED_DAYS = 42;

/** シード行の id の接頭辞。日付が変わったときにシードだけ作り直すために使う */
export const SEED_ID_PREFIX = 'seed-';

/** 完全な休み（学習セッションが1件も無い日）。今日からの日数 */
const REST_DAYS = new Set([5, 9, 14, 20, 25, 38]);

/** 合計10分未満にする日（学習日として成立しない） */
const SHORT_DAYS = new Set([6, 15, 39]);

/** 教材の候補。handlers.ts の userCourses / catalog と同じ id・名前にする */
const COURSES: (StudyActivityCourseRef | null)[] = [
  { courseId: 101, courseTitle: 'はじめてのWebデザイン', lessonId: 4, lessonTitle: 'バナー制作の基礎' },
  { courseId: 102, courseTitle: 'HTML/CSS基礎', lessonId: 2, lessonTitle: 'ボックスモデル' },
  { courseId: 201, courseTitle: 'デザインの4大原則', lessonId: 1, lessonTitle: '近接と整列' },
  { courseId: 203, courseTitle: 'バナーを作ってみよう', lessonId: 3, lessonTitle: '配色を決める' },
  null, // 教材を指定しない
];

const GOALS = [
  'バナー制作の基礎を1章進める',
  'Photoshopの操作を練習する',
  '模擬案件の修正を終わらせる',
  'ボックスモデルを手を動かして確認する',
  '配色パターンを3つ作る',
];

const CONTENT_NOTES = [
  'flexbox の主軸と交差軸を整理した。あとで自分の言葉で書き直す。',
  'バナーのレイアウト案を3つ作って、1つに絞った。',
  '余白の取り方だけで印象が変わるのを実際に試せた。',
];

/**
 * カテゴリ配分のパターン。
 * 「教材だけの日」「教材＋AI相談」「コーチングの日」「ノートで復習した日」を混ぜて、
 * トップと終了カードの内訳表示が空にならないようにする。
 * 数字は比率で、合計を durationMinutes に配分する（rescaleSegments と同じ考え方）。
 */
const CATEGORY_MIXES: { category: StudyCategory; weight: number }[][] = [
  [{ category: 'material', weight: 1 }],
  [
    { category: 'material', weight: 3 },
    { category: 'ai', weight: 1 },
  ],
  [
    { category: 'material', weight: 5 },
    { category: 'ai', weight: 2 },
    { category: 'review', weight: 1 },
  ],
  [
    { category: 'coaching', weight: 4 },
    { category: 'material', weight: 1 },
  ],
  [
    { category: 'review', weight: 2 },
    { category: 'material', weight: 3 },
  ],
];

/** 日数インデックスからの決定的な擬似乱数（0..1） */
function pseudoRandom(dayIndex: number, salt: number): number {
  const x = Math.sin(dayIndex * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** その日のセッション件数 */
function sessionCountOf(dayIndex: number): number {
  if (REST_DAYS.has(dayIndex)) return 0;
  if (SHORT_DAYS.has(dayIndex)) return 1;
  // 「9日連続」の帯（26〜34日前）は必ず1件以上入れて連続を切らさない
  if (dayIndex >= 26 && dayIndex <= 34) return pseudoRandom(dayIndex, 1) > 0.6 ? 2 : 1;
  if (dayIndex <= 4) return pseudoRandom(dayIndex, 2) > 0.5 ? 2 : 1;
  return pseudoRandom(dayIndex, 3) > 0.75 ? 2 : 1;
}

/** その記録のカテゴリ別内訳。合計は必ず minutes*60 に一致させる（余りは最大の区間へ） */
function segmentsOf(dayIndex: number, slot: number, minutes: number): StudySegmentTotal[] {
  const mix = CATEGORY_MIXES[(dayIndex + slot * 2) % CATEGORY_MIXES.length];
  const totalWeight = mix.reduce((sum, m) => sum + m.weight, 0);
  const totalSeconds = minutes * 60;
  const out = mix.map((m) => ({
    category: m.category,
    seconds: Math.round((m.weight / totalWeight) * totalSeconds),
  }));
  const diff = totalSeconds - out.reduce((sum, s) => sum + s.seconds, 0);
  if (diff !== 0) out[0] = { ...out[0], seconds: out[0].seconds + diff };
  return out.filter((s) => s.seconds > 0);
}

function minutesOf(dayIndex: number, slot: number): number {
  // 学習日として成立させない日は 10分未満（4〜8分）
  if (SHORT_DAYS.has(dayIndex)) return 4 + Math.floor(pseudoRandom(dayIndex, 10) * 5);
  const base = 20 + Math.floor(pseudoRandom(dayIndex, 20 + slot) * 45); // 20〜64分
  return base;
}

export function buildSeedActivities(userId: number, today: Date = new Date()): StudyActivity[] {
  const out: StudyActivity[] = [];
  const timezoneOffsetMinutes = -today.getTimezoneOffset();
  let serial = 0;

  // 古い日から作る（id と occurredAt の並びを素直にするため）
  for (let dayIndex = SEED_DAYS - 1; dayIndex >= 0; dayIndex -= 1) {
    const count = sessionCountOf(dayIndex);
    const day = subDays(today, dayIndex);

    for (let slot = 0; slot < count; slot += 1) {
      const minutes = minutesOf(dayIndex, slot);
      // 開始時刻: 1件目は夜（20〜21時台）、2件目は昼（13〜14時台）
      const hour = slot === 0 ? 20 + Math.floor(pseudoRandom(dayIndex, 30) * 2) : 13;
      const minute = Math.floor(pseudoRandom(dayIndex, 40 + slot) * 50);
      const startedAt = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        hour,
        minute,
        0,
        0
      );
      const endedAt = new Date(startedAt.getTime() + minutes * 60_000);

      const course = COURSES[(dayIndex + slot) % COURSES.length];
      const isPomodoro = pseudoRandom(dayIndex, 50 + slot) > 0.45;
      const targetMinutes = isPomodoro ? (pseudoRandom(dayIndex, 60) > 0.5 ? 25 : 50) : undefined;
      // 1件だけ「時間を修正した記録」にする（adjusted の表示を確認するため）
      const adjusted = dayIndex === 2 && slot === 0;
      const measuredSeconds = adjusted ? (minutes + 12) * 60 : minutes * 60;
      const withDetail = pseudoRandom(dayIndex, 70) > 0.65;

      serial += 1;
      out.push({
        id: `${SEED_ID_PREFIX}${format(today, 'yyyyMMdd')}-${serial}`,
        userId,
        kind: 'study_session',
        occurredAt: endedAt.toISOString(),
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        localDate: toLocalDateKey(startedAt),
        endLocalDate: toLocalDateKey(endedAt),
        timezoneOffsetMinutes,
        course: course
          ? {
              ...course,
              progressPercentAtStart: 30 + ((dayIndex * 3) % 50),
              progressPercentAtEnd: 30 + ((dayIndex * 3) % 50) + 5,
            }
          : null,
        session: {
          mode: isPomodoro ? 'pomodoro' : 'freeform',
          targetMinutes,
          durationMinutes: minutes,
          measuredSeconds,
          adjusted,
          pausedCount: pseudoRandom(dayIndex, 80 + slot) > 0.7 ? 1 : 0,
          pausedSeconds: pseudoRandom(dayIndex, 80 + slot) > 0.7 ? 180 : 0,
          completedTarget: isPomodoro && !!targetMinutes && minutes >= targetMinutes,
          goalText: GOALS[(dayIndex + slot) % GOALS.length],
          contentNote: withDetail ? CONTENT_NOTES[dayIndex % CONTENT_NOTES.length] : null,
          memo: withDetail ? '明日は演習から始める' : null,
          achievement: withDetail ? (pseudoRandom(dayIndex, 90) > 0.5 ? 'high' : 'mid') : null,
          weeklyTotalMinutesAtEnd: undefined,
          segments: segmentsOf(dayIndex, slot, minutes),
        },
        social: {
          visibility: 'private',
          reactionCounts: {},
          myReactions: [],
          commentCount: 0,
        },
        createdAt: endedAt.toISOString(),
        updatedAt: endedAt.toISOString(),
        schemaVersion: 1,
      });
    }
  }

  return out;
}

/**
 * シードが意図どおりの条件を満たしているかを開発中に確認するための補助。
 * DevTools から呼べるように handlers 側で公開する。
 */
export function describeSeed(activities: StudyActivity[]): string {
  const byDay = new Map<string, number>();
  activities.forEach((a) => {
    byDay.set(a.localDate, (byDay.get(a.localDate) ?? 0) + a.session.durationMinutes);
  });
  const studyDays = Array.from(byDay.values()).filter((m) => m >= STUDY_DAY_MIN_MINUTES).length;
  return `${activities.length}件 / 記録のある日 ${byDay.size}日 / 学習日(${STUDY_DAY_MIN_MINUTES}分以上) ${studyDays}日`;
}
