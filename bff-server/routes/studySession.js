/**
 * Study Session API Routes (集中ブース)
 */

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const studySessionService = require('../services/StudySessionService');
const { createErrorResponse } = require('../utils/errorHandler');

function isAdminOrCoach(req) {
  const userGroups = req.user?.groups || [];
  return userGroups.includes('admin') || userGroups.includes('coach');
}

function isSelfOrAdminOrCoach(req, userid) {
  const moodleUserId = req.user?.moodleUserId;
  return isAdminOrCoach(req) || moodleUserId == userid;
}

function forbid(res, userEmail, action) {
  console.warn(`[SECURITY ALERT] Unauthorized user ${userEmail} attempted to ${action}`);
  return res.status(403).json({
    error: 'Forbidden',
    message: '管理者、コーチ、または本人のみアクセス可能です。'
  });
}

/**
 * POST /api/study/sessions/:userid/start
 * Start (or resume after a pause) a study session segment
 */
router.post('/sessions/:userid/start', requireAuth, async (req, res) => {
  try {
    const { userid } = req.params;

    if (!isSelfOrAdminOrCoach(req, userid)) {
      return forbid(res, req.user?.email, `start a study session for user ${userid}`);
    }

    const result = await studySessionService.startSession(parseInt(userid, 10), req.body?.courseid);
    res.status(201).json(result);
  } catch (error) {
    console.error('[StudySession] Start session error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/study/sessions/:userid/end
 * Pause or finish the current study session segment
 */
router.post('/sessions/:userid/end', requireAuth, async (req, res) => {
  try {
    const { userid } = req.params;

    if (!isSelfOrAdminOrCoach(req, userid)) {
      return forbid(res, req.user?.email, `end a study session for user ${userid}`);
    }

    const result = await studySessionService.endSession(parseInt(userid, 10), req.body?.courseid);
    res.json(result);
  } catch (error) {
    console.error('[StudySession] End session error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/study/sessions/:userid/correct
 * Manually correct the duration of the segment just ended (低頻度)
 */
router.post('/sessions/:userid/correct', requireAuth, async (req, res) => {
  try {
    const { userid } = req.params;
    const { deltaMinutes, courseid } = req.body || {};

    if (!isSelfOrAdminOrCoach(req, userid)) {
      return forbid(res, req.user?.email, `correct a study session for user ${userid}`);
    }
    if (typeof deltaMinutes !== 'number' || !Number.isFinite(deltaMinutes)) {
      return res.status(400).json({ error: 'Bad Request', detail: 'deltaMinutes must be a number' });
    }

    const result = await studySessionService.correctSession(parseInt(userid, 10), deltaMinutes, courseid);
    res.json(result);
  } catch (error) {
    console.error('[StudySession] Correct session error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/study/sessions/:userid/active
 * Get the currently in-progress session (if any) — used to restore the timer across navigation/reload
 */
router.get('/sessions/:userid/active', requireAuth, async (req, res) => {
  try {
    const { userid } = req.params;

    if (!isSelfOrAdminOrCoach(req, userid)) {
      return forbid(res, req.user?.email, `access active study session for user ${userid}`);
    }

    const session = await studySessionService.getActiveSession(parseInt(userid, 10));
    res.json(session);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'Not Found', detail: 'No active study session' });
    }
    console.error('[StudySession] Get active session error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/study/sessions/:userid/recent
 * Get recently completed study sessions
 */
router.get('/sessions/:userid/recent', requireAuth, async (req, res) => {
  try {
    const { userid } = req.params;
    const { limit } = req.query;

    if (!isSelfOrAdminOrCoach(req, userid)) {
      return forbid(res, req.user?.email, `access study sessions for user ${userid}`);
    }

    const sessions = await studySessionService.getRecentSessions(parseInt(userid, 10), limit ? parseInt(limit, 10) : undefined);
    res.json(sessions);
  } catch (error) {
    console.error('[StudySession] Get recent sessions error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/study/stats/:userid
 * Get today / this week / total study minutes
 */
router.get('/stats/:userid', requireAuth, async (req, res) => {
  try {
    const { userid } = req.params;

    if (!isSelfOrAdminOrCoach(req, userid)) {
      return forbid(res, req.user?.email, `access study stats for user ${userid}`);
    }

    const stats = await studySessionService.getStats(parseInt(userid, 10));
    res.json(stats);
  } catch (error) {
    console.error('[StudySession] Get stats error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/study/streak/:userid
 * Get the study streak
 */
router.get('/streak/:userid', requireAuth, async (req, res) => {
  try {
    const { userid } = req.params;

    if (!isSelfOrAdminOrCoach(req, userid)) {
      return forbid(res, req.user?.email, `access study streak for user ${userid}`);
    }

    const streak = await studySessionService.getStreak(parseInt(userid, 10));
    res.json(streak);
  } catch (error) {
    console.error('[StudySession] Get streak error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/study/calendar/:userid?year=&month=
 * Get the study calendar for a given year/month
 */
router.get('/calendar/:userid', requireAuth, async (req, res) => {
  try {
    const { userid } = req.params;
    const { year, month } = req.query;

    if (!isSelfOrAdminOrCoach(req, userid)) {
      return forbid(res, req.user?.email, `access study calendar for user ${userid}`);
    }

    if (!year || !month) {
      return res.status(400).json({ error: 'Bad Request', detail: 'year and month are required' });
    }

    const calendar = await studySessionService.getCalendar(parseInt(userid, 10), parseInt(year, 10), parseInt(month, 10));
    res.json(calendar);
  } catch (error) {
    console.error('[StudySession] Get calendar error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/study/ranking?period=week|month|all&limit=
 * Get the study time ranking
 */
router.get('/ranking', requireAuth, async (req, res) => {
  try {
    const { period, limit } = req.query;
    const ranking = await studySessionService.getRanking(period || 'week', limit ? parseInt(limit, 10) : undefined);
    res.json(ranking);
  } catch (error) {
    console.error('[StudySession] Get ranking error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/study/course-access/:userid
 * Get per-course access counts / last-accessed timestamps
 */
router.get('/course-access/:userid', requireAuth, async (req, res) => {
  try {
    const { userid } = req.params;

    if (!isSelfOrAdminOrCoach(req, userid)) {
      return forbid(res, req.user?.email, `access course access stats for user ${userid}`);
    }

    const access = await studySessionService.getCourseAccess(parseInt(userid, 10));
    res.json(access);
  } catch (error) {
    console.error('[StudySession] Get course access error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/study/course-access/:userid/:courseid/materials
 * Get per-material (course module) access counts within a course
 */
router.get('/course-access/:userid/:courseid/materials', requireAuth, async (req, res) => {
  try {
    const { userid, courseid } = req.params;

    if (!isSelfOrAdminOrCoach(req, userid)) {
      return forbid(res, req.user?.email, `access material access stats for user ${userid}`);
    }

    const access = await studySessionService.getCourseMaterialAccess(parseInt(userid, 10), parseInt(courseid, 10));
    res.json(access);
  } catch (error) {
    console.error('[StudySession] Get course material access error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/study/modules/:userid/viewed
 * Log that a user opened a course material (page/url/resource) via our own plugin's
 * course_material_viewed event. Body: { courseid: number, cmid?: number }
 */
router.post('/modules/:userid/viewed', requireAuth, async (req, res) => {
  try {
    const { userid } = req.params;
    const { courseid, cmid } = req.body || {};

    if (!isSelfOrAdminOrCoach(req, userid)) {
      return forbid(res, req.user?.email, `log module view for user ${userid}`);
    }
    if (!courseid) {
      return res.status(400).json({ error: 'Bad Request', detail: 'courseid is required' });
    }

    const result = await studySessionService.logModuleView(parseInt(userid, 10), parseInt(courseid, 10), cmid ? parseInt(cmid, 10) : undefined);
    res.json(result);
  } catch (error) {
    console.error('[StudySession] Log module view error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

module.exports = router;
