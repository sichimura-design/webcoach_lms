/**
 * WebCoach API Routes
 */

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireOwnership = require('../middleware/ownership');
const webCoachService = require('../services/WebCoachService');

// Get profile
router.get('/profile/:userid', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { userid } = req.params;
    const profile = await webCoachService.getProfile(userid);
    res.json(profile);
  } catch (error) {
    console.error('[WebCoach Profile] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to get profile',
      detail: error.message
    });
  }
});

// Update profile
router.post('/profile/:userid', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { userid } = req.params;
    const profileData = req.body;

    const result = await webCoachService.updateProfile(userid, profileData);
    res.json(result);
  } catch (error) {
    console.error('[WebCoach UpdateProfile] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to update profile',
      detail: error.message
    });
  }
});

// Update profile (alternative endpoint)
router.post('/updateprofile/:userid', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { userid } = req.params;
    const profileData = req.body;

    const result = await webCoachService.updateProfile(userid, profileData);
    res.json(result);
  } catch (error) {
    console.error('[WebCoach UpdateProfile] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to update profile',
      detail: error.message
    });
  }
});

// Get resume courses with progress
router.get('/resumecourse/:userid', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { userid } = req.params;
    const { limit } = req.query;

    const coursesWithProgress = await webCoachService.getResumeCoursesWithProgress(userid, limit);
    res.json(coursesWithProgress);
  } catch (error) {
    console.error('[WebCoach ResumeCourse] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to get resume courses',
      detail: error.message
    });
  }
});

// Update resume course
router.post('/resumecourse/:userid', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { userid } = req.params;
    const resumeCourseData = req.body;

    const result = await webCoachService.updateResumeCourse(userid, resumeCourseData);
    res.json(result);
  } catch (error) {
    console.error('[WebCoach UpdateResumeCourse] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to update resume course',
      detail: error.message
    });
  }
});

// Get recommended badges
router.get('/recomendbadge/:userid', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { userid } = req.params;
    const result = await webCoachService.getRecommendedBadges(userid);
    res.json(result);
  } catch (error) {
    console.error('[WebCoach RecommendBadge] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to get recommended badges',
      detail: error.message
    });
  }
});

// Get roadmaps
router.get('/roadmaps', requireAuth, async (req, res) => {
  try {
    const { category, difficulty, limit, offset } = req.query;

    const filters = {
      category,
      difficulty,
      limit: limit || 20,
      offset: offset || 0
    };

    const result = await webCoachService.getRoadmaps(filters);
    res.json(result);
  } catch (error) {
    console.error('[WebCoach Roadmaps] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to get roadmaps',
      detail: error.message
    });
  }
});

// Get roadmap detail
router.get('/roadmap/:roadmapid', requireAuth, async (req, res) => {
  try {
    const { roadmapid } = req.params;
    const result = await webCoachService.getRoadmapDetail(roadmapid);
    res.json(result);
  } catch (error) {
    console.error('[WebCoach Roadmap Detail] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to get roadmap detail',
      detail: error.message
    });
  }
});

// Get AI applications
router.get('/ai-applications', requireAuth, async (req, res) => {
  try {
    const { category, limit, offset } = req.query;

    const filters = {
      category,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : 0
    };

    const result = await webCoachService.getAIApplications(filters);
    res.json(result);
  } catch (error) {
    console.error('[WebCoach AI Applications] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to get AI applications',
      detail: error.message
    });
  }
});

// Send AI chat request
router.post('/ai', requireAuth, async (req, res) => {
  try {
    const chatRequest = req.body;

    // Automatically set user_id from authenticated user
    if (!chatRequest.user_id && req.user && req.user.moodleUserId) {
      chatRequest.user_id = req.user.moodleUserId;
    }

    const result = await webCoachService.sendAIChat(chatRequest);
    res.json(result);
  } catch (error) {
    console.error('[WebCoach AI] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to process AI request',
      detail: error.message
    });
  }
});

// Update database (bulk operation)
router.post('/updatedb', requireAuth, async (req, res) => {
  try {
    const { data_type, records } = req.body;

    if (!data_type || !records) {
      return res.status(400).json({
        error: 'Bad Request',
        detail: 'data_type and records are required'
      });
    }

    const result = await webCoachService.updateDatabase(data_type, records);
    res.json(result);
  } catch (error) {
    console.error('[WebCoach UpdateDB] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to update database',
      detail: error.message
    });
  }
});

// FAISS Ingestion - Ingest specific HTML files from S3 to FAISS
router.post('/faiss/ingest-html', requireAuth, async (req, res) => {
  try {
    const {
      s3_bucket,
      s3_keys,
      course_id,
      course_name,
      module_name,
      chunk_size,
      chunk_overlap
    } = req.body;

    if (!s3_bucket || !s3_keys || !Array.isArray(s3_keys) || s3_keys.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        detail: 's3_bucket and s3_keys (non-empty array) are required'
      });
    }

    const result = await webCoachService.ingestS3HTML({
      s3_bucket,
      s3_keys,
      course_id,
      course_name,
      module_name,
      chunk_size: chunk_size || 1000,
      chunk_overlap: chunk_overlap || 200
    });

    res.json(result);
  } catch (error) {
    console.error('[WebCoach FAISS IngestHTML] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to ingest HTML files',
      detail: error.message
    });
  }
});

// FAISS Ingestion - Ingest all HTML files from S3 prefix to FAISS
router.post('/faiss/ingest-prefix', requireAuth, async (req, res) => {
  try {
    const {
      s3_bucket,
      s3_prefix,
      course_id,
      course_name,
      module_name,
      chunk_size,
      chunk_overlap,
      recursive
    } = req.body;

    if (!s3_bucket || !s3_prefix) {
      return res.status(400).json({
        error: 'Bad Request',
        detail: 's3_bucket and s3_prefix are required'
      });
    }

    const result = await webCoachService.ingestS3Prefix({
      s3_bucket,
      s3_prefix,
      course_id,
      course_name,
      module_name,
      chunk_size: chunk_size || 1000,
      chunk_overlap: chunk_overlap || 200,
      recursive: recursive !== undefined ? recursive : true
    });

    res.json(result);
  } catch (error) {
    console.error('[WebCoach FAISS IngestPrefix] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to ingest HTML files from prefix',
      detail: error.message
    });
  }
});

// FAISS Ingestion - Ingest today's HTML files from S3 to FAISS
router.post('/faiss/ingest-today', requireAuth, async (req, res) => {
  try {
    const {
      s3_bucket,
      s3_prefix,
      course_id,
      course_name,
      module_name,
      chunk_size,
      chunk_overlap
    } = req.body;

    if (!s3_bucket || !s3_prefix) {
      return res.status(400).json({
        error: 'Bad Request',
        detail: 's3_bucket and s3_prefix are required'
      });
    }

    const result = await webCoachService.ingestTodayHTML({
      s3_bucket,
      s3_prefix,
      course_id,
      course_name,
      module_name,
      chunk_size: chunk_size || 1000,
      chunk_overlap: chunk_overlap || 200
    });

    res.json(result);
  } catch (error) {
    console.error('[WebCoach FAISS IngestToday] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to ingest today\'s HTML files',
      detail: error.message
    });
  }
});

// FAISS Stats - Get FAISS statistics
router.get('/faiss/stats', requireAuth, async (req, res) => {
  try {
    const result = await webCoachService.getFAISSStats();
    res.json(result);
  } catch (error) {
    console.error('[WebCoach FAISS Stats] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to get FAISS stats',
      detail: error.message
    });
  }
});

// FAISS Reload - Reload FAISS index from S3
router.post('/faiss/reload', requireAuth, async (req, res) => {
  try {
    const result = await webCoachService.reloadFAISSIndex();
    res.json(result);
  } catch (error) {
    console.error('[WebCoach FAISS Reload] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to reload FAISS index',
      detail: error.message
    });
  }
});

// Get tag-url mappings
router.get('/tag-url-mappings', requireAuth, async (req, res) => {
  try {
    const result = await webCoachService.getTagUrlMappings();
    res.json(result);
  } catch (error) {
    console.error('[WebCoach Tag-URL Mappings] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to get tag-url mappings',
      detail: error.message
    });
  }
});

// Upsert tag-url mapping
router.post('/tag-url-mapping', requireAuth, async (req, res) => {
  try {
    const { tag_id, url } = req.body;

    if (!tag_id || !url) {
      return res.status(400).json({
        error: 'Bad Request',
        detail: 'tag_id and url are required'
      });
    }

    const result = await webCoachService.upsertTagUrlMapping(tag_id, url);
    res.json(result);
  } catch (error) {
    console.error('[WebCoach Tag-URL Mapping Upsert] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to upsert tag-url mapping',
      detail: error.message
    });
  }
});

// Manage avatars (Create/Update/Delete)
router.post('/avatars', requireAuth, async (req, res) => {
  try {
    const { avatars } = req.body;

    if (!avatars || !Array.isArray(avatars)) {
      return res.status(400).json({
        error: 'Bad Request',
        detail: 'avatars array is required'
      });
    }

    console.log(`[WebCoach Avatars] Processing ${avatars.length} avatar records`);

    const result = await webCoachService.manageAvatars(avatars);
    res.json(result);
  } catch (error) {
    console.error('[WebCoach Avatars] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to manage avatars',
      detail: error.message
    });
  }
});

// Get all avatars
router.get('/avatars', requireAuth, async (req, res) => {
  try {
    const { limit, offset } = req.query;

    const result = await webCoachService.getAllAvatars(
      limit ? parseInt(limit) : 100,
      offset ? parseInt(offset) : 0
    );
    res.json(result);
  } catch (error) {
    console.error('[WebCoach Get Avatars] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to get avatars',
      detail: error.message
    });
  }
});

// Get avatar by ID
router.get('/avatar/:avatar_id', requireAuth, async (req, res) => {
  try {
    const { avatar_id } = req.params;
    const result = await webCoachService.getAvatar(avatar_id);
    res.json(result);
  } catch (error) {
    console.error('[WebCoach Get Avatar] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to get avatar',
      detail: error.message
    });
  }
});

// Create next coaching goal
router.post('/next-coaching-goal', requireAuth, async (req, res) => {
  try {
    const { mdl_user_id, no, description, is_completed } = req.body;

    if (!mdl_user_id || no === undefined || !description) {
      return res.status(400).json({
        error: 'Bad Request',
        detail: 'mdl_user_id, no, and description are required'
      });
    }

    const result = await webCoachService.createNextCoachingGoal(
      mdl_user_id,
      no,
      description,
      is_completed !== undefined ? is_completed : 0
    );
    res.status(201).json(result);
  } catch (error) {
    console.error('[WebCoach Create NextCoachingGoal] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to create next coaching goal',
      detail: error.message
    });
  }
});

// Get all next coaching goals (all users)
router.get('/next-coaching-goals', requireAuth, async (req, res) => {
  try {
    const result = await webCoachService.getAllNextCoachingGoals();
    res.json(result);
  } catch (error) {
    console.error('[WebCoach Get All NextCoachingGoals] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to get all next coaching goals',
      detail: error.message
    });
  }
});

// Get all next coaching goals for user
router.get('/next-coaching-goals/:userid', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { userid } = req.params;
    const result = await webCoachService.getNextCoachingGoals(userid);
    res.json(result);
  } catch (error) {
    console.error('[WebCoach Get NextCoachingGoals] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to get next coaching goals',
      detail: error.message
    });
  }
});

// Get next coaching goal
router.get('/next-coaching-goal/:userid/:no', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { userid, no } = req.params;
    const result = await webCoachService.getNextCoachingGoal(userid, parseInt(no));
    res.json(result);
  } catch (error) {
    console.error('[WebCoach Get NextCoachingGoal] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to get next coaching goal',
      detail: error.message
    });
  }
});

// Update next coaching goal
router.put('/next-coaching-goal/:userid/:no', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { userid, no } = req.params;
    const { description, is_completed } = req.body;

    const result = await webCoachService.updateNextCoachingGoal(
      userid,
      parseInt(no),
      description !== undefined ? description : null,
      is_completed !== undefined ? is_completed : null
    );
    res.json(result);
  } catch (error) {
    console.error('[WebCoach Update NextCoachingGoal] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to update next coaching goal',
      detail: error.message
    });
  }
});

// Delete next coaching goal
router.delete('/next-coaching-goal/:userid/:no', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { userid, no } = req.params;
    const result = await webCoachService.deleteNextCoachingGoal(userid, parseInt(no));
    res.json(result);
  } catch (error) {
    console.error('[WebCoach Delete NextCoachingGoal] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to delete next coaching goal',
      detail: error.message
    });
  }
});

// Bulk upsert next coaching goals (create, update, delete, and reorder)
router.put('/next-coaching-goals/:userid', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { userid } = req.params;
    const { goals } = req.body;

    if (!goals || !Array.isArray(goals)) {
      return res.status(400).json({
        error: 'Bad Request',
        detail: 'goals array is required'
      });
    }

    const result = await webCoachService.bulkUpsertNextCoachingGoals(userid, goals);
    res.json(result);
  } catch (error) {
    console.error('[WebCoach Bulk Upsert NextCoachingGoals] Error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      error: 'Failed to bulk upsert next coaching goals',
      detail: error.message
    });
  }
});

module.exports = router;
