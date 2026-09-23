/**
 * Coach/Student Ownership Authorization Helpers
 *
 * Shared by roadmap.js / coaching.js / studySession.js. Replaces the old
 * per-file `isAdminOrCoach`/`isSelfOrAdminOrCoach` helpers, which only
 * checked "is this user a coach" and not "is this user the coach assigned
 * to this specific student" — letting any coach account read/write any
 * student's data. See coaching.js's `/mappings` routes and `/notes/:id`
 * route for the pre-existing correct pattern this generalizes.
 */

const coachingService = require('../services/CoachingService');

function isAdmin(req) {
  const userGroups = req.user?.groups || [];
  return userGroups.includes('admin');
}

function isCoach(req) {
  const userGroups = req.user?.groups || [];
  return userGroups.includes('coach');
}

function isAdminOrCoach(req) {
  return isAdmin(req) || isCoach(req);
}

/**
 * Admin, the student themselves, or the coach assigned to that student.
 * Any other coach (not assigned to this student) is denied.
 */
async function isSelfOrAdminOrAssignedCoach(req, studentUserId) {
  if (isAdmin(req)) {
    return true;
  }

  const moodleUserId = req.user?.moodleUserId;
  if (moodleUserId != studentUserId) {
    if (!isCoach(req)) {
      return false;
    }
    const mapping = await coachingService.getStudentCoach(parseInt(studentUserId));
    return !!mapping && mapping.coach_user_id != null && mapping.coach_user_id == moodleUserId;
  }

  return true;
}

/**
 * Admin or the coach assigned to that student — deliberately NOT the
 * student themselves. For coach-driven write actions (e.g. setting a
 * coaching schedule or roadmap progress for a student) that a student
 * was never allowed to perform on their own record.
 */
async function isAdminOrAssignedCoach(req, studentUserId) {
  if (isAdmin(req)) {
    return true;
  }
  if (!isCoach(req)) {
    return false;
  }
  const mapping = await coachingService.getStudentCoach(parseInt(studentUserId));
  const moodleUserId = req.user?.moodleUserId;
  return !!mapping && mapping.coach_user_id != null && mapping.coach_user_id == moodleUserId;
}

module.exports = {
  isAdmin,
  isCoach,
  isAdminOrCoach,
  isSelfOrAdminOrAssignedCoach,
  isAdminOrAssignedCoach
};
