import { courseMinutes, sessionCourseTimeline } from './studyStats';
import { useStudyTimerStore } from '../store/studyTimerStore';
import { ActiveStudySession } from '../types/studyActivity';

describe('courseMinutes', () => {
  const A = { courseId: 1, courseTitle: 'A' };
  const B = { courseId: 2, courseTitle: 'B' };

  it('教材ごとに分を出す（出てきた順・合計は学習時間と一致）', () => {
    expect(courseMinutes([{ ...A, seconds: 20 * 60 }, { ...B, seconds: 10 * 60 }], 30)).toEqual([
      { courseId: 1, courseTitle: 'A', minutes: 20 },
      { courseId: 2, courseTitle: 'B', minutes: 10 },
    ]);
  });

  it('A→B→A は A を1行にまとめる', () => {
    const rows = courseMinutes(
      [{ ...A, seconds: 600 }, { ...B, seconds: 600 }, { ...A, seconds: 600 }],
      30
    );
    expect(rows.map((r) => [r.courseId, r.minutes])).toEqual([[1, 20], [2, 10]]);
  });

  it('教材なしの区間は最初の教材に寄せる', () => {
    expect(courseMinutes([{ courseId: null, courseTitle: '', seconds: 300 }, { ...B, seconds: 600 }], 15)).toEqual([
      { courseId: 2, courseTitle: 'B', minutes: 15 },
    ]);
  });

  it('教材が1つも無ければ教材なしの1行', () => {
    expect(courseMinutes([{ courseId: null, courseTitle: '', seconds: 600 }], 10)).toEqual([
      { courseId: null, courseTitle: '', minutes: 10 },
    ]);
  });

  it('学習時間を減らすと最後の教材から削る（サーバーの補正と同じ順）', () => {
    expect(courseMinutes([{ ...A, seconds: 20 * 60 }, { ...B, seconds: 10 * 60 }], 15).map((r) => r.minutes)).toEqual([
      15, 0,
    ]);
  });

  it('学習時間を増やすと最後の教材に足す', () => {
    expect(courseMinutes([{ ...A, seconds: 20 * 60 }, { ...B, seconds: 10 * 60 }], 40).map((r) => r.minutes)).toEqual([
      20, 20,
    ]);
  });
});

describe('studyTimerStore.switchCourse', () => {
  const base = (): ActiveStudySession => ({
    mode: 'freeform',
    courseId: 1,
    courseTitle: 'A',
    startedAt: 0,
    pausedAt: null,
    pausedCount: 0,
    pausedTotalMs: 0,
    activityId: 'sa-0-00',
    targetReachedAt: null,
    segments: [{ category: 'material', startedAt: 0, endedAt: null, courseId: 1, courseTitle: 'A' }],
    lastActiveAt: 0,
  });

  afterEach(() => {
    jest.restoreAllMocks();
    useStudyTimerStore.setState({ session: null });
  });

  it('計測中に別の教材を開くと区間を分け、教材ごとの時間が残る', () => {
    jest.spyOn(Date, 'now').mockReturnValue(20 * 60 * 1000);
    useStudyTimerStore.setState({ session: base() });
    useStudyTimerStore.getState().switchCourse({ courseId: 2, courseTitle: 'B', lessonTitle: 'L1' });

    const s = useStudyTimerStore.getState().session as ActiveStudySession;
    expect(s.courseId).toBe(2);
    expect(s.lessonTitle).toBe('L1');
    expect(sessionCourseTimeline(s, 30 * 60 * 1000)).toEqual([
      { courseId: 1, courseTitle: 'A', seconds: 20 * 60 },
      { courseId: 2, courseTitle: 'B', seconds: 10 * 60 },
    ]);
  });

  it('同じ教材なら何もしない', () => {
    useStudyTimerStore.setState({ session: base() });
    useStudyTimerStore.getState().switchCourse({ courseId: 1, courseTitle: 'A' });
    expect(useStudyTimerStore.getState().session?.segments).toHaveLength(1);
  });

  it('カテゴリが変わっても教材は引き継ぐ', () => {
    useStudyTimerStore.setState({ session: base() });
    useStudyTimerStore.getState().switchCategory('ai');
    const segs = useStudyTimerStore.getState().session?.segments ?? [];
    expect(segs[segs.length - 1]).toMatchObject({ category: 'ai', courseId: 1 });
  });
});
