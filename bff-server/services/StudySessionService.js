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
 * 区間ごとの「置き換え先の教材」を決める関数を作る。
 *
 * 1回の記録で複数の教材を学習できる(計測中に別の教材を開くと区間が切り替わる)ので、
 * 終了カードでの選び直しは「元の教材 → 選んだ教材」の対応表(courseMap)で受け取る。
 *   - courseMapに元の教材(教材なしはnull)があれば、その行き先
 *   - 無ければcourseid(旧形式・教材が1つだけの回)。それも無ければ置き換えない(undefined)
 * 🔴 行き先が0/NULL(「教材を指定しない」)の置き換えは表せない。補正のcourseid列は0/NULLを
 *    「置き換えなし」と区別できないため。
 *
 * @param {Array<{from:number|null, to:number}>|undefined} courseMap
 * @param {number|undefined} courseid
 * @returns {(segCourseid:number|null) => number|undefined}
 */
function courseTargetOf(courseMap, courseid) {
  const map = new Map();
  for (const entry of Array.isArray(courseMap) ? courseMap : []) {
    const from = entry?.from === null || entry?.from === undefined ? null : parseInt(entry.from, 10);
    const to = parseInt(entry?.to, 10);
    if (Number.isNaN(from) || !to) continue;
    map.set(from, to);
  }
  const fallback = parseInt(courseid, 10) || undefined;
  return (segCourseid) => {
    const key = segCourseid === null || segCourseid === undefined ? null : segCourseid;
    return map.has(key) ? map.get(key) : fallback;
  };
}

/**
 * 終了カードで選んだ教材と違う教材の区間に、教材だけを置き換える0分の補正を作る。
 *
 * Moodleのログ(started)のcourseidは書き換えられないので、補正イベントのcourseid列で
 * 上書きする(api-serverの集計が区間ごとに最新の補正のcourseidを優先する)。
 * 教材なしで始めて途中でレッスンを開いた回や、終了時に教材を選び直した回が対象。
 *
 * @param {Array<{ended_log_id:number, courseid:number|null}>} segments
 * @param {(segCourseid:number|null) => number|undefined} targetOf - courseTargetOf の返り値
 * @param {Set<number>} alreadyTouched - 時間の補正で既にcourseidを付けた区間
 * @returns {Array<{endedLogId:number, delta:number, courseid:number}>}
 */
function planCourseOverrides(segments, targetOf, alreadyTouched = new Set()) {
  if (!segments) return [];
  return segments
    .filter((seg) => !alreadyTouched.has(seg.ended_log_id))
    .map((seg) => ({ seg, target: targetOf(seg.courseid) }))
    .filter(({ seg, target }) => target && seg.courseid !== target)
    .map(({ seg, target }) => ({ endedLogId: seg.ended_log_id, delta: 0, courseid: target }));
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
   * @param {number|undefined} courseid - 教材が1つだけの回の置き換え先(旧形式)
   * @param {Array<{from:number|null, to:number}>|undefined} courseMap - 区間の教材ごとの置き換え先
   */
  async correctSessionToTarget(userid, targetMinutes, sinceSeconds, courseid, courseMap) {
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
    // 時間の補正もcourseidを持つので、補正した区間はそれだけで教材も置き換わる。
    // 🔴 courseidは区間ごとにその区間の行き先を付ける。回全体の教材を付けると、
    //    別の教材の区間を削った補正でその区間の教材まで書き換わってしまう。
    const targetOf = courseTargetOf(courseMap, courseid);
    const byLogId = new Map(recorded.segments.map((seg) => [seg.ended_log_id, seg]));
    const lastSegment = recorded.segments[recorded.segments.length - 1];
    const touched = new Set();
    for (const { endedLogId, delta } of plan) {
      const seg = endedLogId === undefined ? lastSegment : byLogId.get(endedLogId);
      await moodleAdapter.correctStudySession(userid, delta, targetOf(seg?.courseid ?? null), endedLogId);
      touched.add(endedLogId ?? lastSegment?.ended_log_id);
    }
    for (const { endedLogId, delta, courseid: target } of planCourseOverrides(recorded.segments, targetOf, touched)) {
      await moodleAdapter.correctStudySession(userid, delta, target, endedLogId);
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
module.exports.courseTargetOf = courseTargetOf;
