/**
 * Career Roadmap API Routes
 * フェーズ制・スキル別テンプレートの学習ロードマップ
 */

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const roadmapService = require('../services/RoadmapService');
const { createErrorResponse } = require('../utils/errorHandler');

function isAdminOrCoach(req) {
  const userGroups = req.user?.groups || [];
  return userGroups.includes('admin') || userGroups.includes('coach');
}

function isSelfOrAdminOrCoach(req, userid) {
  const moodleUserId = req.user?.moodleUserId;
  return isAdminOrCoach(req) || moodleUserId == userid;
}

// ==================== SKILL / PHASE TEMPLATES ====================

/**
 * GET /api/roadmap/skills
 * Get roadmap skill master list
 */
router.get('/skills', requireAuth, async (req, res) => {
  try {
    const skills = await roadmapService.getSkills();
    res.json(skills);
  } catch (error) {
    console.error('[Roadmap] Get skills error:', error.message);
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/roadmap/phases?skill_id=
 * Get phase templates for a skill
 */
router.get('/phases', requireAuth, async (req, res) => {
  try {
    const { skill_id } = req.query;

    if (!skill_id) {
      return res.status(400).json({
        error: 'Bad Request',
        detail: 'skill_id is required'
      });
    }

    const phases = await roadmapService.getPhases(parseInt(skill_id));
    res.json(phases);
  } catch (error) {
    console.error('[Roadmap] Get phases error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

// ==================== USER ROADMAP ====================

/**
 * POST /api/roadmap/users/:userid
 * Start a new roadmap for a user (Admin, Coach, or the student themselves)
 */
router.post('/users/:userid', requireAuth, async (req, res) => {
  try {
    const { userid } = req.params;
    const { skill_id } = req.body;

    if (!isSelfOrAdminOrCoach(req, userid)) {
      console.warn(`[SECURITY ALERT] Unauthorized user ${req.user?.email} attempted to start roadmap for user ${userid}`);
      return res.status(403).json({
        error: 'Forbidden',
        message: '管理者、コーチ、または本人のみ開始できます。'
      });
    }

    if (!skill_id) {
      return res.status(400).json({
        error: 'Bad Request',
        detail: 'skill_id is required'
      });
    }

    const roadmap = await roadmapService.startUserRoadmap(parseInt(userid), skill_id);
    res.status(201).json(roadmap);
  } catch (error) {
    console.error('[Roadmap] Start user roadmap error:', error.message);

    if (error.response && error.response.status === 409) {
      return res.status(409).json({
        error: 'Conflict',
        detail: error.response.data.detail || 'Active roadmap already exists'
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
 * GET /api/roadmap/users/:userid
 * Get a user's current (active) roadmap (Admin, Coach, or the student themselves)
 */
router.get('/users/:userid', requireAuth, async (req, res) => {
  try {
    const { userid } = req.params;

    if (!isSelfOrAdminOrCoach(req, userid)) {
      console.warn(`[SECURITY ALERT] Unauthorized user ${req.user?.email} attempted to access roadmap for user ${userid}`);
      return res.status(403).json({
        error: 'Forbidden',
        message: '管理者、コーチ、または本人のみアクセス可能です。'
      });
    }

    const roadmap = await roadmapService.getUserRoadmap(parseInt(userid));
    res.json(roadmap);
  } catch (error) {
    console.error('[Roadmap] Get user roadmap error:', error.message);

    if (error.response && error.response.status === 404) {
      return res.status(404).json({
        error: 'Not Found',
        detail: error.response.data.detail || 'Active roadmap not found'
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
 * PUT /api/roadmap/progress/:id
 * Update a phase progress entry - status/dates (Admin or Coach only)
 */
router.put('/progress/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!isAdminOrCoach(req)) {
      console.warn(`[SECURITY ALERT] Unauthorized user ${req.user?.email} attempted to update roadmap progress ${id}`);
      return res.status(403).json({
        error: 'Forbidden',
        message: '管理者またはコーチのみ更新できます。'
      });
    }

    const data = { ...req.body, updated_by: req.user?.moodleUserId };
    const progress = await roadmapService.updateProgress(parseInt(id), data);
    res.json(progress);
  } catch (error) {
    console.error('[Roadmap] Update progress error:', error.message);

    if (error.response && error.response.status === 404) {
      return res.status(404).json({
        error: 'Not Found',
        detail: error.response.data.detail || 'Roadmap progress not found'
      });
    }
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

// ==================== REVIEW QUESTIONS / ANSWERS ====================

/**
 * GET /api/roadmap/questions/:reviewNo
 * Get fixed review questions for a review cycle
 */
router.get('/questions/:reviewNo', requireAuth, async (req, res) => {
  try {
    const { reviewNo } = req.params;
    const questions = await roadmapService.getQuestions(parseInt(reviewNo));
    res.json(questions);
  } catch (error) {
    console.error('[Roadmap] Get questions error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/roadmap/users/:userid/answers
 * Submit answers for a review cycle (Admin, Coach, or the student themselves)
 */
router.post('/users/:userid/answers', requireAuth, async (req, res) => {
  try {
    const { userid } = req.params;
    const { review_no, answers } = req.body;

    if (!isSelfOrAdminOrCoach(req, userid)) {
      console.warn(`[SECURITY ALERT] Unauthorized user ${req.user?.email} attempted to submit answers for user ${userid}`);
      return res.status(403).json({
        error: 'Forbidden',
        message: '管理者、コーチ、または本人のみ回答できます。'
      });
    }

    if (!review_no || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        detail: 'review_no and a non-empty answers array are required'
      });
    }

    const result = await roadmapService.submitAnswers(parseInt(userid), review_no, answers);
    res.status(201).json(result);
  } catch (error) {
    console.error('[Roadmap] Submit answers error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

module.exports = router;
