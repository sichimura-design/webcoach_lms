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
const { createErrorResponse } = require('../utils/errorHandler');

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
    const createdCount = result.recordsProcessed - (result.recordsDeleted || 0) - (result.recordsUpdated || 0);
    if (createdCount > 0) {
      messageParts.push(`${createdCount}件のユーザーを作成`);
    }
    if (result.recordsUpdated > 0) {
      messageParts.push(`${result.recordsUpdated}件のユーザーを更新`);
    }
    if (result.recordsDeleted > 0) {
      messageParts.push(`${result.recordsDeleted}件のユーザーを削除`);
    }
    if (result.recordsFailed > 0) {
      messageParts.push(`${result.recordsFailed}件失敗`);
    }

    res.json({
      success: result.success,
      recordsProcessed: result.recordsProcessed,
      recordsUpdated: result.recordsUpdated || 0,
      recordsDeleted: result.recordsDeleted || 0,
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

module.exports = router;
