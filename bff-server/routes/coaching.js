/**
 * Coaching API Routes
 * Coach-Student mapping management
 */

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireAdmin = require('../middleware/admin');
const coachingService = require('../services/CoachingService');
const { createErrorResponse } = require('../utils/errorHandler');

// ==================== COACH-STUDENT MAPPING ====================

/**
 * POST /api/coaching/manage-mappings
 * Bulk manage coach-student mappings (Create/Update/Delete with flags) (Admin only)
 */
router.post('/manage-mappings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { mappings } = req.body;

    if (!mappings || !Array.isArray(mappings)) {
      return res.status(400).json({
        error: 'Bad Request',
        detail: 'mappings array is required'
      });
    }

    console.log(`[Coaching] Processing ${mappings.length} mapping records`);

    const result = await coachingService.manageMappings(mappings);
    res.json(result);
  } catch (error) {
    console.error('[Coaching] Manage mappings error:', error.message);
    console.error('[Coaching] Error stack:', error.stack);
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/coaching/mappings
 * Create coach-student mapping (Admin only)
 */
router.post('/mappings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { coach_user_id, student_user_id } = req.body;

    if (!coach_user_id || !student_user_id) {
      return res.status(400).json({
        error: 'Bad Request',
        detail: 'coach_user_id and student_user_id are required'
      });
    }

    console.log(`[Coaching] Creating mapping: coach=${coach_user_id}, student=${student_user_id}`);

    const mapping = await coachingService.createMapping(
      coach_user_id,
      student_user_id
    );

    res.status(201).json(mapping);
  } catch (error) {
    console.error('[Coaching] Create mapping error:', error.message);
    console.error('[Coaching] Error stack:', error.stack);

    // Handle 409 Conflict (mapping already exists)
    if (error.response && error.response.status === 409) {
      return res.status(409).json({
        error: 'Conflict',
        detail: error.response.data.detail || 'Mapping already exists'
      });
    }

    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/coaching/mappings
 * Get all coach-student mappings (Admin only)
 */
router.get('/mappings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { include_deleted } = req.query;

    console.log(`[Coaching] Fetching all coach-student mappings`);

    const mappings = await coachingService.getAllMappings(
      include_deleted === 'true'
    );

    res.json(mappings);
  } catch (error) {
    console.error('[Coaching] Get all mappings error:', error.message);
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/coaching/mappings/:coach_user_id/:student_user_id
 * Get specific coach-student mapping (Admin or Coach themselves)
 */
router.get('/mappings/:coach_user_id/:student_user_id', requireAuth, async (req, res) => {
  try {
    const { coach_user_id, student_user_id } = req.params;
    const { include_deleted } = req.query;

    const userGroups = req.user?.groups || [];
    const isAdmin = userGroups.includes('admin');
    const isCoach = userGroups.includes('coach');
    const moodleUserId = req.user?.moodleUserId;

    // Authorization: Admin or the coach themselves
    if (!isAdmin && (!isCoach || moodleUserId != coach_user_id)) {
      console.warn(`[SECURITY ALERT] Unauthorized user ${req.user?.email} attempted to access mapping`);
      return res.status(403).json({
        error: 'Forbidden',
        message: '管理者またはコーチ本人のみアクセス可能です。'
      });
    }

    const mapping = await coachingService.getMapping(
      parseInt(coach_user_id),
      parseInt(student_user_id),
      include_deleted === 'true'
    );

    res.json(mapping);
  } catch (error) {
    console.error('[Coaching] Get mapping error:', error.message);

    // Handle 404 Not Found
    if (error.response && error.response.status === 404) {
      return res.status(404).json({
        error: 'Not Found',
        detail: error.response.data.detail || 'Mapping not found'
      });
    }

    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/coaching/coaches/:coach_user_id/students
 * Get students assigned to a coach (Admin or Coach themselves)
 */
router.get('/coaches/:coach_user_id/students', requireAuth, async (req, res) => {
  try {
    const { coach_user_id } = req.params;
    const { include_deleted } = req.query;

    const userGroups = req.user?.groups || [];
    const isAdmin = userGroups.includes('admin');
    const isCoach = userGroups.includes('coach');
    const moodleUserId = req.user?.moodleUserId;

    // Authorization: Admin or the coach themselves
    if (!isAdmin && (!isCoach || moodleUserId != coach_user_id)) {
      console.warn(`[SECURITY ALERT] Unauthorized user ${req.user?.email} attempted to access coach students`);
      return res.status(403).json({
        error: 'Forbidden',
        message: '管理者またはコーチ本人のみアクセス可能です。'
      });
    }

    console.log(`[Coaching] Fetching students for coach ${coach_user_id}`);

    const students = await coachingService.getCoachStudents(
      parseInt(coach_user_id),
      include_deleted === 'true'
    );

    res.json(students);
  } catch (error) {
    console.error('[Coaching] Get coach students error:', error.message);
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/coaching/students/:student_user_id/coach
 * Get coach assigned to a student (Admin, Coach, or Student themselves)
 */
router.get('/students/:student_user_id/coach', requireAuth, async (req, res) => {
  try {
    const { student_user_id } = req.params;
    const { include_deleted } = req.query;

    const userGroups = req.user?.groups || [];
    const isAdmin = userGroups.includes('admin');
    const isCoach = userGroups.includes('coach');
    const moodleUserId = req.user?.moodleUserId;

    // Authorization: Admin, Coach, or the student themselves
    if (!isAdmin && !isCoach && moodleUserId != student_user_id) {
      console.warn(`[SECURITY ALERT] Unauthorized user ${req.user?.email} attempted to access student coach`);
      return res.status(403).json({
        error: 'Forbidden',
        message: '管理者、コーチ、または学生本人のみアクセス可能です。'
      });
    }

    console.log(`[Coaching] Fetching coach for student ${student_user_id}`);

    const coach = await coachingService.getStudentCoach(
      parseInt(student_user_id),
      include_deleted === 'true'
    );

    res.json(coach);
  } catch (error) {
    console.error('[Coaching] Get student coach error:', error.message);
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * DELETE /api/coaching/mappings/:coach_user_id/:student_user_id
 * Delete coach-student mapping (Admin only)
 */
router.delete('/mappings/:coach_user_id/:student_user_id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { coach_user_id, student_user_id } = req.params;

    console.log(`[Coaching] Deleting mapping: coach=${coach_user_id}, student=${student_user_id}`);

    await coachingService.deleteMapping(
      parseInt(coach_user_id),
      parseInt(student_user_id)
    );

    res.status(204).send();
  } catch (error) {
    console.error('[Coaching] Delete mapping error:', error.message);

    // Handle 404 Not Found
    if (error.response && error.response.status === 404) {
      return res.status(404).json({
        error: 'Not Found',
        detail: error.response.data.detail || 'Active mapping not found'
      });
    }

    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/coaching/mappings/:coach_user_id/:student_user_id/restore
 * Restore deleted coach-student mapping (Admin only)
 */
router.post('/mappings/:coach_user_id/:student_user_id/restore', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { coach_user_id, student_user_id } = req.params;

    console.log(`[Coaching] Restoring mapping: coach=${coach_user_id}, student=${student_user_id}`);

    const mapping = await coachingService.restoreMapping(
      parseInt(coach_user_id),
      parseInt(student_user_id)
    );

    res.json(mapping);
  } catch (error) {
    console.error('[Coaching] Restore mapping error:', error.message);

    // Handle 409 Conflict (mapping already exists)
    if (error.response && error.response.status === 409) {
      return res.status(409).json({
        error: 'Conflict',
        detail: error.response.data.detail || 'Active mapping already exists'
      });
    }

    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json(errorResponse);
  }
});

module.exports = router;
