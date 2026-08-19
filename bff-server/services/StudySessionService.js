/**
 * Study Session Service (集中ブース)
 * Handles focus-booth study session start/pause/resume/finish business logic.
 *
 * mdl_logstore_standard_log(Moodle)そのものが学習時間の正データ。自前テーブルは持たない。
 * 開始/一時停止/再開/終了/補正はすべてMoodle webservice経由で直接記録する
 * (study_session_started/study_session_ended/study_session_corrected)。
 * 一時停止のたびにended、再開のたびに新しいstartedを発火するため、一時停止時間は
 * 集計から自然に除外される。api-serverはこのログの読み取り集計のみを担当する。
 *
 * 教材(page/url/resource)の閲覧記録は、Moodle標準のmod_*_view_*webserviceを呼ぶことで
 * course_module_viewedイベントを標準機能として発火させる(プラグイン開発不要)。
 */

const apiServerAdapter = require('../adapters/ApiServerAdapter');
const moodleAdapter = require('../adapters/MoodleAdapter');

class StudySessionService {
  /**
   * Start (or resume after a pause) a study session segment
   */
  async startSession(userid, courseid) {
    console.log(`[StudySession] Starting/resuming session segment for user ${userid}`);
    return await moodleAdapter.logStudySessionStarted(userid, courseid);
  }

  /**
   * Pause or finish the current study session segment
   */
  async endSession(userid, courseid) {
    console.log(`[StudySession] Pausing/ending session segment for user ${userid}`);
    return await moodleAdapter.logStudySessionEnded(userid, courseid);
  }

  /**
   * Manually correct the duration of the segment just ended (low frequency;
   * only called when the user edits the recorded time on the finish screen)
   */
  async correctSession(userid, deltaMinutes, courseid) {
    console.log(`[StudySession] Correcting last session segment for user ${userid} by ${deltaMinutes}min`);
    return await moodleAdapter.correctStudySession(userid, deltaMinutes, courseid);
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
   * Get the study time ranking for a period ('week' | 'month' | 'all')
   */
  async getRanking(period, limit) {
    return await apiServerAdapter.getStudyRanking(period, limit);
  }

  /**
   * Get per-course access counts
   */
  async getCourseAccess(userid) {
    return await apiServerAdapter.getCourseAccess(userid);
  }

  /**
   * Get per-material access counts within a course
   */
  async getCourseMaterialAccess(userid, courseid) {
    return await apiServerAdapter.getCourseMaterialAccess(userid, courseid);
  }

  /**
   * Log that a user opened a course material (page/url/resource) via our own plugin's
   * course_material_viewed event. courseid/cmid land as native, queryable log columns.
   * @param {number} userid
   * @param {number} courseid
   * @param {number} [cmid] - omit for course-level-only recording
   */
  async logModuleView(userid, courseid, cmid) {
    console.log(`[StudySession] Logging module view: user=${userid} course=${courseid} cmid=${cmid ?? '-'}`);
    return await moodleAdapter.logCourseMaterialViewed(userid, courseid, cmid);
  }
}

// Create singleton instance
const studySessionService = new StudySessionService();

module.exports = studySessionService;
