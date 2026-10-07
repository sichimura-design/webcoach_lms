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

/**
 * 差分(分)を、この回の区間ごとの補正に割り振る。
 *
 * 区間ごとに0分未満は0に切り上げて集計されるため、最後の区間だけに大きなマイナスを
 * 入れても前の区間ぶんは減らない(一時停止をはさんだ30分+5分の回を20分に直すと30分のまま)。
 * 減らすときは最後の区間から順に、各区間の分数を上限に前の区間へ割り振る。
 *
 * 最後の区間への補正はendedLogIdを付けない(=直前の区間に加算される従来の形)。
 * 前の区間まで割り振るときだけ区間を名指しする。
 *
 * @param {Array<{ended_log_id:number, duration_minutes:number}>} segments - 終了が古い順
 * @param {number} deltaMinutes
 * @returns {Array<{endedLogId: number|undefined, delta: number}>}
 */
function planSegmentCorrections(segments, deltaMinutes) {
  if (deltaMinutes >= 0 || !segments || segments.length === 0) {
    return deltaMinutes === 0 ? [] : [{ endedLogId: undefined, delta: deltaMinutes }];
  }
  const plan = [];
  let remaining = -deltaMinutes;
  for (let i = segments.length - 1; i >= 0 && remaining > 0; i -= 1) {
    const take = Math.min(remaining, Math.max(0, segments[i].duration_minutes));
    if (take === 0) continue;
    plan.push({ endedLogId: i === segments.length - 1 ? undefined : segments[i].ended_log_id, delta: -take });
    remaining -= take;
  }
  return plan;
}

/**
 * 終了カードで選んだ教材と違う教材の区間に、教材だけを置き換える0分の補正を作る。
 *
 * Moodleのログ(started)のcourseidは書き換えられないので、補正イベントのcourseid列で
 * 上書きする(api-serverの集計が区間ごとに最新の補正のcourseidを優先する)。
 * 教材なしで始めて途中でレッスンを開いた回や、終了時に教材を選び直した回が対象。
 * 🔴 courseidが無い(「教材を指定しない」)ときは何もしない。補正のcourseid列は0/NULLを
 *    「置き換えなし」と区別できないため、教材を外す置き換えは表せない。
 *
 * @param {Array<{ended_log_id:number, courseid:number|null}>} segments
 * @param {number|undefined} courseid
 * @param {Set<number>} alreadyTouched - 時間の補正で既にcourseidを付けた区間
 * @returns {Array<{endedLogId:number, delta:number}>}
 */
function planCourseOverrides(segments, courseid, alreadyTouched = new Set()) {
  const target = parseInt(courseid, 10);
  if (!target || !segments) return [];
  return segments
    .filter((seg) => seg.courseid !== target && !alreadyTouched.has(seg.ended_log_id))
    .map((seg) => ({ endedLogId: seg.ended_log_id, delta: 0 }));
}

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
   * Correct the latest session so that it totals targetMinutes on the server.
   *
   * 🔴 差分はフロントの計測値ではなく、サーバーがいま集計している分数から作る。
   *    サーバーは区間ごとに分へ丸めて合計し、時刻もMoodleが受けた時刻で測るため、
   *    フロントの「全体の秒数を丸めた値」とは1分前後ずれる(15分に直したのに14分になった不具合)。
   * @param {number} sinceSeconds - この回の最初の開始から今までの秒数(一時停止も含む壁時計)
   */
  async correctSessionToTarget(userid, targetMinutes, sinceSeconds, courseid) {
    const recorded = await apiServerAdapter.getRecordedSessionMinutes(userid, sinceSeconds);
    const target = Math.max(0, Math.round(targetMinutes));
    const deltaMinutes = target - recorded.recorded_minutes;
    if (recorded.segment_count === 0) {
      return { success: true, deltaMinutes: 0, recordedMinutes: recorded.recorded_minutes };
    }
    const plan = planSegmentCorrections(recorded.segments, deltaMinutes);
    if (plan.length > 0) {
      console.log(`[StudySession] Correcting session for user ${userid} to ${target}min (recorded ${recorded.recorded_minutes}min, delta ${deltaMinutes})`);
    }
    // 時間の補正もcourseidを持つので、補正した区間はそれだけで教材も置き換わる
    const lastEndedLogId = recorded.segments[recorded.segments.length - 1]?.ended_log_id;
    const touched = new Set();
    for (const { endedLogId, delta } of plan) {
      await moodleAdapter.correctStudySession(userid, delta, courseid, endedLogId);
      touched.add(endedLogId ?? lastEndedLogId);
    }
    for (const { endedLogId, delta } of planCourseOverrides(recorded.segments, courseid, touched)) {
      await moodleAdapter.correctStudySession(userid, delta, courseid, endedLogId);
    }
    return { success: true, deltaMinutes, recordedMinutes: recorded.recorded_minutes };
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
   * Get completed study sessions for one specific local date (学習記録の日別詳細用)
   */
  async getSessionsByDate(userid, date) {
    return await apiServerAdapter.getStudySessionsByDate(userid, date);
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
   * Get the study-stats-dashboard summary (マイページ/学習記録ページ向けの集約API)
   */
  async getStatsSummary(userid, days) {
    return await apiServerAdapter.getStudyStatsSummary(userid, days);
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
module.exports.planSegmentCorrections = planSegmentCorrections;
module.exports.planCourseOverrides = planCourseOverrides;
