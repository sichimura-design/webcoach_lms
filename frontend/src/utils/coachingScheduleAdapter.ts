/**
 * 実バックエンドのコーチング予約（webcoach_coaching_schedule）を、dev/miyabe由来の
 * コーチング記録UI（CoachingSessionSummary / CoachingSessionDetail）の形へ詰め替える。
 *
 * 型は変えず値だけ合わせる。/coaching（MyCoachingPage）と /study-log の両方が使う。
 */
import type { CoachingNote, CoachingSchedule } from '../types/api';
import type { CoachingSessionDetail, CoachingSessionSummary } from '../types/coaching';

/** LastSessionCardが期待する形へschedule+noteを詰め替える（型は変えず、値だけ合わせる） */
export function toSessionSummary(schedule: CoachingSchedule): CoachingSessionSummary {
  return {
    id: schedule.id,
    date: schedule.coaching_date,
    title: `第${schedule.coaching_no}回`,
    coach: '',
    summary: '',
    status: 'published',
    source: null,
    importedFrom: null,
    tasksCreated: false,
  };
}

export function toSessionDetail(schedule: CoachingSchedule, note: CoachingNote | null): CoachingSessionDetail | null {
  if (!note) return null;
  return {
    id: schedule.id,
    date: schedule.coaching_date,
    title: `第${schedule.coaching_no}回`,
    coach: '',
    coachId: schedule.coach_user_id,
    meetingLink: null,
    source: null,
    importedFrom: null,
    status: 'published',
    step: '',
    progress: 100,
    error: null,
    audioRetention: 'delete_after_summary',
    visibility: 'shared_with_coach',
    hasAudio: false,
    segments: [],
    summary: {
      sessionSummary: note.session_summary || '',
      progressSinceLast: [],
      coachFeedback: note.coach_feedback ? [{ title: note.coach_feedback, sourceSegmentIds: [] }] : [],
      decisions: note.decisions ? [{ title: note.decisions, sourceSegmentIds: [] }] : [],
      goals: [],
      tasks: [],
      nextSessionAgenda: note.next_session_check ? [note.next_session_check] : [],
      referencedContext: [],
    },
    studentMemo: '',
    reflectedGoalIds: [],
    reflectedAt: null,
  };
}
