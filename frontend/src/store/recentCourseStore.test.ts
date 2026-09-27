import { useRecentCourseStore } from './recentCourseStore';

const open = (courseId: number) =>
  useRecentCourseStore.getState().touch({ courseId, courseTitle: `c${courseId}`, lessonId: courseId * 10 });

describe('recentCourseStore.bindUser', () => {
  beforeEach(() => {
    useRecentCourseStore.setState({ ownerId: null, entries: [] });
  });

  it('同じユーザーならログインし直しても履歴を残す', () => {
    useRecentCourseStore.getState().bindUser(31);
    open(19);
    useRecentCourseStore.getState().bindUser(31);
    expect(useRecentCourseStore.getState().entries.map((e) => e.courseId)).toEqual([19]);
  });

  it('別のユーザーがログインしたら前のユーザーの履歴を捨てる', () => {
    useRecentCourseStore.getState().bindUser(11);
    open(20);
    useRecentCourseStore.getState().bindUser(31);
    expect(useRecentCourseStore.getState().entries).toEqual([]);
    expect(useRecentCourseStore.getState().ownerId).toBe(31);
  });

  it('持ち主不明（修正前に保存された）履歴も捨てる', () => {
    open(20);
    useRecentCourseStore.getState().bindUser(31);
    expect(useRecentCourseStore.getState().entries).toEqual([]);
  });

  it('ユーザーIDが取れなかった（0）ときは何もしない', () => {
    useRecentCourseStore.getState().bindUser(31);
    open(19);
    useRecentCourseStore.getState().bindUser(0);
    expect(useRecentCourseStore.getState().entries).toHaveLength(1);
  });
});
