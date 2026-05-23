const express = require('express');
const router = express.Router();
const { createErrorResponse } = require('../utils/errorHandler');
const apiServerAdapter = require('../adapters/ApiServerAdapter');

/**
 * FAISS Ingestion - Ingest today's HTML files
 *
 * パラメータなしで当日追加されたHTMLファイルをFAISSに取り込む
 */
router.post('/ingest/today', async (req, res) => {
  try {
    const s3Bucket = process.env.S3_BUCKET_NAME;
    const s3Prefix = process.env.S3_PREFIX || '';
    const chunkSize = 1000;
    const chunkOverlap = 200;

    if (!s3Bucket) {
      return res.status(500).json({
        error: 'Configuration Error',
        detail: 'S3_BUCKET_NAME environment variable is not set'
      });
    }

    console.log(`[FAISS Ingest] Ingesting today's HTML files from s3://${s3Bucket}/${s3Prefix}`);

    const result = await apiServerAdapter.ingestS3Today({
      s3_bucket: s3Bucket,
      s3_prefix: s3Prefix,
      chunk_size: chunkSize,
      chunk_overlap: chunkOverlap
    });

    res.json(result);
  } catch (error) {
    console.error('[FAISS Ingest Today] Error:', error.message);
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json({
      ...errorResponse,
      error: 'FAISS取り込み（当日分）に失敗しました'
    });
  }
});

/**
 * FAISS Ingestion - Ingest all HTML files
 *
 * パラメータなしで全HTMLファイルをFAISSに取り込む
 */
router.post('/ingest/all', async (req, res) => {
  try {
    const s3Bucket = process.env.S3_BUCKET_NAME;
    const s3Prefix = process.env.S3_PREFIX || '';
    const chunkSize = 1000;
    const chunkOverlap = 200;

    if (!s3Bucket) {
      return res.status(500).json({
        error: 'Configuration Error',
        detail: 'S3_BUCKET_NAME environment variable is not set'
      });
    }

    console.log(`[FAISS Ingest] Ingesting all HTML files from s3://${s3Bucket}/${s3Prefix}`);

    const result = await apiServerAdapter.ingestS3All({
      s3_bucket: s3Bucket,
      s3_prefix: s3Prefix,
      chunk_size: chunkSize,
      chunk_overlap: chunkOverlap
    });

    res.json(result);
  } catch (error) {
    console.error('[FAISS Ingest All] Error:', error.message);
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json({
      ...errorResponse,
      error: 'FAISS取り込み（全量）に失敗しました'
    });
  }
});

module.exports = router;
