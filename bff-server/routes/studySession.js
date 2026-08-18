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
 * POST /api/study/sessions/:userid
 * Start a new focus-booth study session
 */
router.post('/sessions/:userid', requireAuth, async (req, res) => {
  try {
    const { userid } = req.params;

    if (!isSelfOrAdminOrCoach(req, userid)) {
      return forbid(res, req.user?.email, `start a study session for user ${userid}`);
    }

    const session = await studySessionService.startSession(parseInt(userid, 10), req.body);
    res.status(201).json(session);
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
 * POST /api/study/sessions/:userid/:sessionId/finish
 * Finish an in-progress study session
 */
router.post('/sessions/:userid/:sessionId/finish', requireAuth, async (req, res) => {
  try {
    const { userid, sessionId } = req.params;

    if (!isSelfOrAdminOrCoach(req, userid)) {
      return forbid(res, req.user?.email, `finish a study session for user ${userid}`);
    }

    const session = await studySessionService.finishSession(parseInt(userid, 10), parseInt(sessionId, 10), req.body);
    res.json(session);
  } catch (error) {
    console.error('[StudySession] Finish session error:', error.message);
    if (error.response && error.response.status === 404) {
      return res.status(404).json({
        error: 'Not Found',
        detail: error.response.data.detail || 'In-progress study session not found'
      });
    }
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
 * POST /api/study/courses/:userid/:courseid/started
 * Log that a user started studying a course (independent of the focus-booth timer;
 * fired e.g. when CourseContentPage mounts). Throttled server-side to once/user/course/day.
 */
router.post('/courses/:userid/:courseid/started', requireAuth, async (req, res) => {
  try {
    const { userid, courseid } = req.params;

    if (!isSelfOrAdminOrCoach(req, userid)) {
      return forbid(res, req.user?.email, `log course study start for user ${userid}`);
    }

    const result = await studySessionService.logCourseStudyStarted(parseInt(userid, 10), parseInt(courseid, 10));
    res.json(result);
  } catch (error) {
    console.error('[StudySession] Log course study started error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

module.exports = router;
