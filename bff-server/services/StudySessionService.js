/**
 * Study Session Service (集中ブース)
 * Handles focus-booth study session start/finish business logic.
 *
 * 実データ(学習時間の集計元)はapi-server側のwebcoach_study_activityテーブル。
 * 開始/終了それぞれ、Moodle側にも \local_webcoach_utils\event\study_session_started /
 * study_session_ended を監査ログとして記録する(mdl_logstore_standard_log)。
 * Moodle側の記録に失敗してもDB側の記録は既に確定しているため、ユーザーへは成功として返す
 * (監査ログはベストエフォート。取りこぼしはmeasured_seconds等でDB側から復元可能)。
 */

const apiServerAdapter = require('../adapters/ApiServerAdapter');
const moodleAdapter = require('../adapters/MoodleAdapter');

class StudySessionService {
  /**
   * Start a new study session
   */
  async startSession(userid, data) {
    console.log(`[StudySession] Starting session for user ${userid}`);
    const session = await apiServerAdapter.startStudySession(userid, data);

    try {
      await moodleAdapter.logStudySessionStarted(userid, session.id, data.courseid);
    } catch (error) {
      console.error(`[StudySession] Failed to log study_session_started event (session ${session.id}):`, error.message);
    }

    return session;
  }

  /**
   * Finish an in-progress study session
   */
  async finishSession(userid, sessionId, data) {
    console.log(`[StudySession] Finishing session ${sessionId} for user ${userid}`);
    const session = await apiServerAdapter.finishStudySession(userid, sessionId, data);

    try {
      await moodleAdapter.logStudySessionEnded(userid, sessionId, session.duration_minutes, session.courseid);
    } catch (error) {
      console.error(`[StudySession] Failed to log study_session_ended event (session ${sessionId}):`, error.message);
    }

    return session;
  }

  /**
   * Get the currently in-progress session, if any
   */
  async getActiveSession(userid) {
    return await apiServerAdapter.getActiveStudySession(userid);
  }

  /**
   * Get recently completed sessions
   */
  async getRecentSessions(userid, limit) {
    return await apiServerAdapter.getRecentStudySessions(userid, limit);
  }

  /**
   * Get today / this week / total study minutes
   */
  async getStats(userid) {
    return await apiServerAdapter.getStudyStats(userid);
  }

  /**
   * Get the study streak
   */
  async getStreak(userid) {
    return await apiServerAdapter.getStudyStreak(userid);
  }

  /**
   * Get the study calendar for a given year/month
   */
  async getCalendar(userid, year, month) {
    return await apiServerAdapter.getStudyCalendar(userid, year, month);
  }

  /**
   * Log that a user started studying a course (independent of the focus-booth timer)
   */
  async logCourseStudyStarted(userid, courseid) {
    console.log(`[StudySession] Logging course study started: user ${userid}, course ${courseid}`);
    return await moodleAdapter.logCourseStudyStarted(userid, courseid);
  }
}

// Create singleton instance
const studySessionService = new StudySessionService();

module.exports = studySessionService;
