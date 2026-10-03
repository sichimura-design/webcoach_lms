const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireAdmin = require('../middleware/admin');
const { createErrorResponse } = require('../utils/errorHandler');
const apiServerAdapter = require('../adapters/ApiServerAdapter');

// 教材索引の作り直しは管理者だけ（以前は未ログインでも呼べた）
router.use(requireAuth, requireAdmin);

/**
 * AIコーチの教材検索用の索引を作り直す（管理画面「全教材を登録」）
 *
 * Moodleの各コースに登録された教材をコースIDつきで取り込み、既存の索引を置き換える。
 * 約670ページの取得に時間がかかりCloudFrontの60秒制限を超えうるので、開始だけしてすぐ返し、
 * 進み具合は GET /ingest/status で確認する。
 */
const startRebuild = (addedToday) => async (req, res) => {
  try {
    console.log(`[FAISS Ingest] ${addedToday ? 'Today' : 'All'} materials requested by ${req.user?.email}`);
    const result = await apiServerAdapter.startMoodleMaterialsRebuild({ addedToday });
    res.status(202).json(result);
  } catch (error) {
    if (error.response?.status === 409) {
      return res.status(409).json({ error: 'すでに登録処理が実行中です。完了までお待ちください' });
    }
    console.error('[FAISS Ingest] Error:', error.message);
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json({
      ...errorResponse,
      error: '教材の登録を開始できませんでした'
    });
  }
};

router.post('/ingest/all', startRebuild(false));

/**
 * 当日（日本時間）にMoodleのコースへ追加された教材だけを、コースIDつきで今の索引に書き足す
 * （管理画面「当日追加した教材を登録」）。進み具合は全教材と同じ GET /ingest/status で見る
 */
router.post('/ingest/today', startRebuild(true));

/**
 * 索引作り直しの進み具合（status: idle | running | succeeded | failed）
 */
router.get('/ingest/status', async (req, res) => {
  try {
    res.json(await apiServerAdapter.getMoodleMaterialsRebuildStatus());
  } catch (error) {
    console.error('[FAISS Ingest Status] Error:', error.message);
    const errorResponse = createErrorResponse(error, 'general', 500);
    res.status(500).json({
      ...errorResponse,
      error: '教材の登録状況を取得できませんでした'
    });
  }
});

module.exports = router;
