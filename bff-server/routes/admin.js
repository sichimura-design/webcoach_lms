/**
 * Admin API Routes
 * Cognito user management and S3 uploads
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const requireAuth = require('../middleware/auth');
const requireAdmin = require('../middleware/admin');
const cognitoAdapter = require('../adapters/CognitoAdapter');
const s3Adapter = require('../adapters/S3Adapter');
const moodleAdapter = require('../adapters/MoodleAdapter');
const apiServerAdapter = require('../adapters/ApiServerAdapter');
const { createErrorResponse } = require('../utils/errorHandler');
const { formatLastAccess } = require('../utils/timeCalculator');

// File upload configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// ==================== COGNITO USER MANAGEMENT ====================

/**
 * POST /api/admin/cognito-users
 * Create/Delete Cognito users in bulk (from CSV)
 */
router.post('/cognito-users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { records } = req.body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        detail: 'records array is required'
      });
    }

    console.log(`[Cognito Admin] Processing ${records.length} user records`);

    const result = await cognitoAdapter.createUsersBulk(records);

    // Build message
    const messageParts = [];
    const createdCount = result.recordsProcessed - (result.recordsDeleted || 0) - (result.recordsUpdated || 0) - (result.recordsSkipped || 0);
    if (createdCount > 0) {
      messageParts.push(`${createdCount}件のユーザーを作成`);
    }
    if (result.recordsUpdated > 0) {
      messageParts.push(`${result.recordsUpdated}件のユーザーを更新`);
    }
    if (result.recordsDeleted > 0) {
      messageParts.push(`${result.recordsDeleted}件のユーザーを削除`);
    }
    if (result.recordsSkipped > 0) {
      messageParts.push(`${result.recordsSkipped}件をスキップ`);
    }
    if (result.recordsFailed > 0) {
      messageParts.push(`${result.recordsFailed}件失敗`);
    }

    res.json({
      success: result.success,
      recordsProcessed: result.recordsProcessed,
      recordsUpdated: result.recordsUpdated || 0,
      recordsDeleted: result.recordsDeleted || 0,
      recordsSkipped: result.recordsSkipped || 0,
      recordsFailed: result.recordsFailed,
      message: messageParts.join('、') + 'しました',
      errors: result.results.filter(r => !r.success).map(r => ({
        row: r.row,
        message: r.message
      })),
    });
  } catch (error) {
    console.error('[Cognito Admin] Error:', error.message);
    console.error('[Cognito Admin] Error stack:', error.stack);
    const errorResponse = createErrorResponse(error, 'cognito', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/admin/cognito-users
 * List all Cognito users with groups (pagination supported)
 */
router.get('/cognito-users', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('[Cognito Admin] Fetching all users with groups...');

    // Get all users with group memberships efficiently
    const users = await cognitoAdapter.getUsersWithGroups();

    console.log(`[Cognito Admin] Fetched ${users.length} users with groups`);

    res.json({
      users,
      total: users.length
    });
  } catch (error) {
    console.error('[Cognito Admin] List users error:', error.message);
    console.error('[Cognito Admin] Error stack:', error.stack);
    const errorResponse = createErrorResponse(error, 'cognito', 500);
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/admin/users/by-role/:role
 * Get users by Cognito role/group with Moodle user IDs
 * Supported roles: admin, coach, student
 */
router.get('/users/by-role/:role', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { role } = req.params;
    const { include_moodle_info } = req.query;

    console.log(`[Admin] Fetching users with role: ${role}`);

    // Validate role
    const validRoles = ['admin', 'coach', 'student'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid role. Supported roles: ${validRoles.join(', ')}`
      });
    }

    // Get users in the specified Cognito group
    const users = await cognitoAdapter.listUsersInGroup(role);

    console.log(`[Admin] Found ${users.length} users with role: ${role}`);

    // Format response
    const formattedUsers = users.map(user => {
      const sub = user.Attributes?.find(a => a.Name === 'sub')?.Value || '';
      const email = user.Attributes?.find(a => a.Name === 'email')?.Value || '';
      return {
        userId: sub,
        username: user.Username,
        email: email,
        status: user.UserStatus,
        enabled: user.Enabled,
        createdAt: user.UserCreateDate,
        lastModified: user.UserLastModifiedDate
      };
    });

    // Always fetch Moodle user info (default behavior)
    console.log(`[Admin] Fetching Moodle user info for ${formattedUsers.length} users`);

    // Get Moodle user info for each user by email
    const emails = formattedUsers.map(u => u.email).filter(e => e);

    if (emails.length > 0) {
      try {
        const moodleUsers = await moodleAdapter.getUsersByField('email', emails);

        // Create email -> moodle user map
        const emailToMoodleUser = new Map();
        moodleUsers.forEach(mu => {
          emailToMoodleUser.set(mu.email, mu);
        });

        // Enrich formatted users with Moodle info
        formattedUsers.forEach(user => {
          const moodleUser = emailToMoodleUser.get(user.email);
          if (moodleUser) {
            user.moodleUserId = moodleUser.id;
            user.moodleUsername = moodleUser.username;
            user.moodleFirstname = moodleUser.firstname;
            user.moodleLastname = moodleUser.lastname;
            user.moodleFullname = moodleUser.fullname;
          }
        });

        console.log(`[Admin] Enriched ${formattedUsers.filter(u => u.moodleUserId).length} users with Moodle info`);
      } catch (moodleError) {
        console.error(`[Admin] Failed to fetch Moodle info:`, moodleError.message);
        // Continue without Moodle info
      }
    }

    res.json({
      role,
      count: formattedUsers.length,
      users: formattedUsers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[Admin] Failed to get users by role:`, error.message);
    console.error('[Admin] Error stack:', error.stack);

    // Handle GroupNotFoundException
    if (error.name === 'ResourceNotFoundException' || error.message.includes('Group not found')) {
      return res.status(404).json({
        error: 'Not Found',
        message: `グループ '${req.params.role}' が見つかりません。Cognitoでグループを作成してください。`
      });
    }

    const errorResponse = createErrorResponse(error, 'cognito', 500);
    res.status(500).json(errorResponse);
  }
});

// ==================== S3 FILE UPLOAD ====================

/**
 * POST /api/admin/s3-upload
 * Upload file to S3 and return CloudFront URL
 */
router.post('/s3-upload', requireAuth, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Bad Request',
        detail: 'ファイルが選択されていません'
      });
    }

    if (!s3Adapter.isBucketConfigured()) {
      return res.status(500).json({
        error: 'S3_BUCKET_NAME が設定されていません'
      });
    }

    const s3Key = req.body.s3Key;
    if (!s3Key) {
      return res.status(400).json({
        error: 'Bad Request',
        detail: 's3Key が指定されていません'
      });
    }

    const result = await s3Adapter.uploadFile(req.file, s3Key);
    res.json(result);
  } catch (error) {
    console.error('[S3 Upload] Error:', error.message);
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json({
      ...errorResponse,
      error: 'S3アップロードに失敗しました'
    });
  }
});

// ==================== STUDENT MANAGEMENT ====================

/**
 * GET /api/admin/students
 * List all students from Cognito 'student' group with last login information
 * Admin: returns all students in 'student' group
 * Coach: returns only assigned students from 'student' group
 */
router.get('/students', requireAuth, async (req, res) => {
  try {
    const userGroups = req.user?.groups || [];
    const isAdmin = userGroups.includes('admin');
    const isCoach = userGroups.includes('coach');

    // Check authorization - must be admin or coach
    if (!isAdmin && !isCoach) {
      console.warn(`[SECURITY ALERT] Unauthorized user ${req.user?.email} attempted to access /students`);
      return res.status(403).json({
        error: 'Forbidden',
        message: '管理者またはコーチ権限が必要です。'
      });
    }

    console.log(`[Admin/Coach] Fetching students (role: ${isAdmin ? 'admin' : 'coach'})...`);

    // Get users in the 'student' Cognito group
    const cognitoStudents = await cognitoAdapter.listUsersInGroup('student');
    console.log(`[Admin/Coach] Found ${cognitoStudents.length} students in Cognito`);

    // Extract emails from Cognito students
    const studentEmails = cognitoStudents
      .map(user => user.Attributes?.find(a => a.Name === 'email')?.Value)
      .filter(email => email);

    // Get Moodle user info for these students
    let moodleStudents = [];
    if (studentEmails.length > 0) {
      try {
        moodleStudents = await moodleAdapter.getUsersByField('email', studentEmails);
        console.log(`[Admin/Coach] Found ${moodleStudents.length} students in Moodle`);
      } catch (moodleError) {
        console.error('[Admin/Coach] Failed to fetch Moodle info:', moodleError.message);
      }
    }

    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    const ONE_MONTH_SECONDS = 30 * 24 * 60 * 60; // 30 days in seconds

    // Get assigned student IDs if user is a coach
    let assignedStudentIds = null;
    if (isCoach && !isAdmin) {
      const coachUserId = req.user?.moodleUserId;
      if (!coachUserId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Moodle user ID not found for coach'
        });
      }

      try {
        const coachStudentsResponse = await apiServerAdapter.getCoachStudents(coachUserId, false);
        assignedStudentIds = coachStudentsResponse.student_user_ids || [];
        console.log(`[Coach] Found ${assignedStudentIds.length} assigned students for coach ${coachUserId}`);
      } catch (error) {
        console.error('[Coach] Failed to fetch assigned students:', error.message);
        // If coach has no students assigned or API fails, return empty list
        assignedStudentIds = [];
      }
    }

    // Filter and format the response
    let students = moodleStudents
      .filter(user => {
        // If coach (not admin), only include assigned students
        if (isCoach && !isAdmin && assignedStudentIds !== null) {
          return assignedStudentIds.includes(user.id);
        }

        return true;
      })
      .map(user => {
        const lastaccess = user.lastaccess || 0;
        const firstaccess = user.firstaccess || 0;

        // Calculate flags
        // inactive_over_month: No login for over 1 month (or never logged in)
        const inactive_over_month = lastaccess === 0 || (now - lastaccess) > ONE_MONTH_SECONDS;

        // new_user: Account created within 1 month
        const new_user = firstaccess > 0 && (now - firstaccess) <= ONE_MONTH_SECONDS;

        return {
          id: user.id,
          username: user.username,
          email: user.email,
          firstname: user.firstname,
          lastname: user.lastname,
          fullname: user.fullname,
          lastaccess: lastaccess,
          lastaccess_formatted: formatLastAccess(lastaccess),
          firstaccess: firstaccess,
          suspended: user.suspended || false,
          auth: user.auth,
          inactive_over_month: inactive_over_month,
          new_user: new_user
        };
      })
      .sort((a, b) => {
        // Sort by last access (most recent first)
        // Users who never logged in (lastaccess=0) will be at the bottom
        if (a.lastaccess === 0 && b.lastaccess === 0) return 0;
        if (a.lastaccess === 0) return 1;
        if (b.lastaccess === 0) return -1;
        return b.lastaccess - a.lastaccess;
      });

    console.log(`[Admin/Coach] Returning ${students.length} students`);

    // Calculate statistics
    const stats = {
      total: students.length,
      inactive_over_month: students.filter(s => s.inactive_over_month).length,
      new_users: students.filter(s => s.new_user).length,
      never_logged_in: students.filter(s => s.lastaccess === 0).length
    };

    res.json({
      students,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin/Coach] Fetch students error:', error.message);
    console.error('[Admin/Coach] Error stack:', error.stack);
    const errorResponse = createErrorResponse(error, 'moodle', 500);
    res.status(500).json(errorResponse);
  }
});

module.exports = router;
