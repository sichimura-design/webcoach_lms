/**
 * Moodle API Routes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const requireAuth = require('../middleware/auth');
const requireOwnership = require('../middleware/ownership');
const requireAdmin = require('../middleware/admin');
const courseService = require('../services/CourseService');
const moodleAdapter = require('../adapters/MoodleAdapter');
const { validateArray, validateRequiredFields } = require('../utils/validators');
const { isFlagTrue } = require('../utils/flagValidation');

// File upload configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Get all courses
router.get('/courses', requireAuth, async (req, res) => {
  try {
    const courses = await courseService.getAllCourses();
    res.json(courses);
  } catch (error) {
    console.error('Get all courses error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get enrolled courses by user ID (with progress)
router.get('/courses/:userid', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { userid } = req.params;
    const coursesWithProgress = await courseService.getEnrolledCoursesWithProgress(userid);
    res.json(coursesWithProgress);
  } catch (error) {
    console.error('Get enrolled courses error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Search courses
router.get('/courses/search', requireAuth, async (req, res) => {
  try {
    const { q } = req.query;
    const courses = await courseService.searchCourses(q);
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get course contents
router.get('/courses/:courseid/contents', requireAuth, async (req, res) => {
  try {
    const { courseid } = req.params;
    const userid = req.user?.moodleUserId || null;
    const contents = await courseService.getCourseContentsEnriched(courseid, userid);

    // Log completion values for debugging
    console.log(`[DEBUG] Course ${courseid} final response - modules completion:`);
    contents.forEach(section => {
      section.modules?.forEach(module => {
        console.log(`  cmid=${module.id}, modname=${module.modname}, completion=${module.completion}`);
      });
    });

    res.json(contents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get categories
router.get('/categories', requireAuth, async (req, res) => {
  try {
    const categories = await courseService.getCategories();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create/Update/Delete categories (bulk) - Admin only
router.post('/create-category', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { categories } = req.body;

    const validation = validateArray(categories, 'categories');
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: validation.error
      });
    }

    console.log(`[Manage Categories] Admin ${req.user.email} processing ${categories.length} categories`);

    // Separate categories by operation type
    // Strict validation: only true, 1, or "1" are considered as flags
    const toDelete = categories.filter(c => isFlagTrue(c.deleteFlag));
    const toUpdate = categories.filter(c => isFlagTrue(c.updateFlag) && !isFlagTrue(c.deleteFlag));
    const toCreate = categories.filter(c => !isFlagTrue(c.updateFlag) && !isFlagTrue(c.deleteFlag));

    const results = {
      success: true,
      created: 0,
      updated: 0,
      deleted: 0,
      categories: [],
      errors: []
    };

    // Delete categories
    if (toDelete.length > 0) {
      try {
        const deleteIds = toDelete.map(c => c.id).filter(id => id);
        if (deleteIds.length > 0) {
          console.log(`[Delete Categories] Deleting ${deleteIds.length} categories`);
          await moodleAdapter.deleteCategories(deleteIds);
          results.deleted = deleteIds.length;
          toDelete.forEach(c => results.categories.push({ ...c, status: 'deleted' }));
        }
      } catch (error) {
        console.error('[Delete Categories] Error:', error.message);
        results.errors.push({ operation: 'delete', message: error.message });
      }
    }

    // Update categories
    if (toUpdate.length > 0) {
      try {
        console.log(`[Update Categories] Updating ${toUpdate.length} categories`);
        const updated = await courseService.updateCategories(toUpdate);
        results.updated = toUpdate.length;
        toUpdate.forEach((c, idx) => results.categories.push({ ...c, status: 'updated' }));
      } catch (error) {
        console.error('[Update Categories] Error:', error.message);
        results.errors.push({ operation: 'update', message: error.message });
      }
    }

    // Create categories
    if (toCreate.length > 0) {
      try {
        console.log(`[Create Categories] Creating ${toCreate.length} categories`);
        const created = await courseService.createCategories(toCreate);
        results.created = created.length;
        created.forEach(c => results.categories.push({ ...c, status: 'created' }));
      } catch (error) {
        console.error('[Create Categories] Error:', error.message);
        results.errors.push({ operation: 'create', message: error.message });
      }
    }

    console.log(`[Manage Categories] Summary - Created: ${results.created}, Updated: ${results.updated}, Deleted: ${results.deleted}`);

    res.json(results);
  } catch (error) {
    console.error('[Manage Categories] Error:', error.message);
    res.status(500).json({
      error: 'Failed to manage categories',
      message: error.message
    });
  }
});

// Create/Update/Delete courses (bulk) - Admin only
router.post('/create-course', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { courses } = req.body;

    const validation = validateArray(courses, 'courses');
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: validation.error
      });
    }

    console.log(`[Manage Courses] Admin ${req.user.email} processing ${courses.length} courses`);
    console.log(`[Manage Courses] Request body:`, JSON.stringify(courses, null, 2));

    // Separate courses by operation type
    // Strict validation: only true, 1, or "1" are considered as flags
    const toDelete = courses.filter(c => isFlagTrue(c.deleteFlag));
    const toUpdate = courses.filter(c => isFlagTrue(c.updateFlag) && !isFlagTrue(c.deleteFlag));
    const toCreate = courses.filter(c => !isFlagTrue(c.updateFlag) && !isFlagTrue(c.deleteFlag));

    const results = {
      success: true,
      created: 0,
      updated: 0,
      deleted: 0,
      courses: [],
      errors: []
    };

    // Delete courses
    if (toDelete.length > 0) {
      try {
        const deleteIds = toDelete.map(c => c.id).filter(id => id);
        if (deleteIds.length > 0) {
          console.log(`[Delete Courses] Deleting ${deleteIds.length} courses`);
          await moodleAdapter.deleteCourses(deleteIds);
          results.deleted = deleteIds.length;
          toDelete.forEach(c => results.courses.push({ ...c, status: 'deleted' }));
        }
      } catch (error) {
        console.error('[Delete Courses] Error:', error.message);
        results.errors.push({ operation: 'delete', message: error.message });
      }
    }

    // Update courses
    if (toUpdate.length > 0) {
      try {
        console.log(`[Update Courses] Updating ${toUpdate.length} courses`);
        const updated = await courseService.updateCourses(toUpdate);
        results.updated = toUpdate.length;
        toUpdate.forEach((c, idx) => results.courses.push({ ...c, status: 'updated' }));
      } catch (error) {
        console.error('[Update Courses] Error:', error.message);
        results.errors.push({ operation: 'update', message: error.message });
      }
    }

    // Create courses
    if (toCreate.length > 0) {
      try {
        console.log(`[Create Courses] Creating ${toCreate.length} courses`);
        const created = await courseService.createCourses(toCreate);
        results.created = created.length;
        created.forEach(c => results.courses.push({ ...c, status: 'created' }));
      } catch (error) {
        console.error('[Create Courses] Error:', error.message);
        results.errors.push({ operation: 'create', message: error.message });
      }
    }

    console.log(`[Manage Courses] Summary - Created: ${results.created}, Updated: ${results.updated}, Deleted: ${results.deleted}`);

    res.json(results);
  } catch (error) {
    console.error('[Manage Courses] Error:', error.message);
    res.status(500).json({
      error: 'Failed to manage courses',
      message: error.message
    });
  }
});

// Enroll user in course
router.post('/enroll-course/:courseid', requireAuth, async (req, res) => {
  try {
    const { courseid } = req.params;
    const moodleUserId = req.user?.moodleUserId;

    if (!moodleUserId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Moodleユーザーとの紐付けが必要です'
      });
    }

    const result = await courseService.enrollUser(moodleUserId, courseid);

    res.json({
      success: true,
      courseid: parseInt(courseid, 10),
      userid: moodleUserId,
      message: 'コースに登録されました',
      result
    });
  } catch (error) {
    console.error('[Enroll Course] Error:', error.message);

    // Check if error has a statusCode property (e.g., 409 for already enrolled)
    const statusCode = error.statusCode || 500;

    res.status(statusCode).json({
      error: statusCode === 409 ? 'Already enrolled' : 'Failed to enroll in course',
      message: error.message
    });
  }
});

// New content notifications
router.get('/notifications/new-content', requireAuth, async (req, res) => {
  try {
    const since = req.query.since;
    const result = await courseService.getNewContentNotifications(since);
    res.json(result);
  } catch (error) {
    console.error('[Notifications] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get courses by field
router.get('/getcoursebyfield', requireAuth, async (req, res) => {
  try {
    const { field, value } = req.query;

    if (!field || !value) {
      return res.status(400).json({
        error: 'Bad Request',
        detail: 'field and value query parameters are required'
      });
    }

    const result = await courseService.getCoursesByField(field, value);
    res.json(result);
  } catch (error) {
    console.error('[Moodle GetCourseByField] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get badges
router.get('/badges', requireAuth, async (req, res) => {
  try {
    const result = await courseService.getBadges();
    res.json(result);
  } catch (error) {
    console.error('[Moodle GetBadges] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get user badges
router.get('/user-badges/:userid', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { userid } = req.params;
    const result = await courseService.getUserBadges(userid);
    res.json(result);
  } catch (error) {
    console.error('[Moodle GetUserBadges] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Upload file
router.post('/files/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const { courseid } = req.body;

    const result = await moodleAdapter.uploadFile(file);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generic Moodle API call
router.post('/api', requireAuth, async (req, res) => {
  try {
    const { wsfunction, params } = req.body;
    const result = await moodleAdapter.callAPI(wsfunction, params);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create activity
router.post('/courses/:courseid/activities', requireAuth, async (req, res) => {
  try {
    const { courseid } = req.params;
    const { modulename, ...activityData } = req.body;

    const params = {
      courseid,
      'activities[0][modulename]': modulename,
      'activities[0][name]': activityData.name,
      'activities[0][section]': activityData.section || 0
    };

    if (activityData.intro) params['activities[0][intro]'] = activityData.intro;

    const result = await moodleAdapter.callAPI('core_course_create_activities', params);
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tags
router.get('/tags', requireAuth, async (req, res) => {
  try {
    const { tagcollid } = req.query;

    const result = await moodleAdapter.callAPI('core_tag_get_tags', {
      tagcollid: tagcollid ? parseInt(tagcollid) : 0
    });

    res.json(result);
  } catch (error) {
    console.error('[Moodle GetTags] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get courses by tag
router.get('/courses/by-tag/:tagid', requireAuth, async (req, res) => {
  try {
    const { tagid } = req.params;
    const { page = 0 } = req.query;

    const result = await moodleAdapter.callAPI('core_tag_get_tagindex', {
      tagindex: {
        id: parseInt(tagid),
        tag: '',
        tc: 1,
        ta: 0,
        excl: 0,
        from: 0,
        ctx: 0,
        rec: 1,
        page: parseInt(page)
      }
    });

    res.json(result);
  } catch (error) {
    console.error('[Moodle GetCoursesByTag] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get activity completion status for a course
router.get('/courses/:courseid/activities/completion', requireAuth, async (req, res) => {
  try {
    const { courseid } = req.params;

    // Ensure Moodle user ID is available
    if (!req.user.moodleUserId) {
      console.error('[Moodle GetActivityCompletion] Moodle user ID not found for user:', req.user.email);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Moodleユーザーとの紐付けが必要です'
      });
    }

    console.log(`[Moodle GetActivityCompletion] User ${req.user.email} (moodleUserId: ${req.user.moodleUserId}) getting completion status for course ${courseid}`);

    const result = await moodleAdapter.getActivityCompletionStatus(
      parseInt(courseid),
      req.user.moodleUserId
    );

    res.json(result);
  } catch (error) {
    console.error('[Moodle GetActivityCompletion] Error:', error.message);
    res.status(500).json({
      error: 'Failed to get activity completion status',
      message: error.message
    });
  }
});

// Get completion status for a specific activity
router.get('/activities/:cmid/completion', requireAuth, async (req, res) => {
  console.log('[DEBUG] Route matched: /activities/:cmid/completion');
  console.log('[DEBUG] Params:', req.params);
  console.log('[DEBUG] Query:', req.query);
  try {
    const { cmid } = req.params;
    const { courseid } = req.query;

    // Ensure Moodle user ID is available
    if (!req.user.moodleUserId) {
      console.error('[Moodle GetActivityCompletion] Moodle user ID not found for user:', req.user.email);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Moodleユーザーとの紐付けが必要です'
      });
    }

    // courseid is required for fetching completion status
    if (!courseid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'courseid query parameter is required'
      });
    }

    console.log(`[Moodle GetActivityCompletion] User ${req.user.email} (moodleUserId: ${req.user.moodleUserId}) getting completion status for cmid ${cmid}`);

    const result = await moodleAdapter.getActivityCompletionStatus(
      parseInt(courseid),
      req.user.moodleUserId
    );

    console.log(`[DEBUG] Completion result for course ${courseid}:`, JSON.stringify(result, null, 2));
    console.log(`[DEBUG] Looking for cmid ${cmid} (parsed: ${parseInt(cmid)})`);
    console.log(`[DEBUG] Available cmids:`, result.statuses?.map(s => s.cmid));

    // Filter for specific activity
    const activity = result.statuses?.find(status => status.cmid === parseInt(cmid));

    if (!activity) {
      console.error(`[Moodle GetActivityCompletion] Activity ${cmid} not found in course ${courseid}. Completion tracking may not be enabled for this activity.`);
      console.log(`[Moodle GetActivityCompletion] Available activities:`, result.statuses?.map(s => ({ cmid: s.cmid, modname: s.modname })));

      // Return 500 error when activity is not found in completion status
      // This happens when completion tracking is not enabled for the activity
      return res.status(500).json({
        error: 'Activity completion status not found',
        message: `Activity ${cmid} does not have completion tracking enabled in course ${courseid}`,
        details: {
          cmid: parseInt(cmid),
          courseid: parseInt(courseid),
          reason: 'Completion tracking is not enabled for this activity'
        }
      });
    }

    res.json(activity);
  } catch (error) {
    console.error('[Moodle GetActivityCompletion] Error:', error.message);
    res.status(500).json({
      error: 'Failed to get activity completion status',
      message: error.message
    });
  }
});

// Update activity completion status manually
router.post('/activities/:cmid/completion', requireAuth, async (req, res) => {
  try {
    const { cmid } = req.params;
    const { completed } = req.body;

    if (typeof completed !== 'boolean') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'completed must be a boolean value'
      });
    }

    // Ensure Moodle user ID is available
    if (!req.user.moodleUserId) {
      console.error('[Moodle UpdateActivityCompletion] Moodle user ID not found for user:', req.user.email);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Moodleユーザーとの紐付けが必要です'
      });
    }

    console.log(`[Moodle UpdateActivityCompletion] User ${req.user.email} (moodleUserId: ${req.user.moodleUserId}) updating cmid ${cmid} to ${completed ? 'complete' : 'incomplete'}`);

    // Use admin override API to update completion for the authenticated user
    const result = await moodleAdapter.overrideActivityCompletionStatus(
      req.user.moodleUserId,
      parseInt(cmid),
      completed ? 1 : 0
    );

    res.json(result);
  } catch (error) {
    console.error('[Moodle UpdateActivityCompletion] Error:', error.message);
    res.status(500).json({
      error: 'Failed to update activity completion',
      message: error.message
    });
  }
});

// Mark course as self-completed
router.post('/courses/:courseid/complete', requireAuth, async (req, res) => {
  try {
    const { courseid } = req.params;

    const result = await moodleAdapter.markCourseSelfCompleted(parseInt(courseid));

    res.json(result);
  } catch (error) {
    console.error('[Moodle MarkCourseSelfCompleted] Error:', error.message);
    res.status(500).json({
      error: 'Failed to mark course as completed',
      message: error.message
    });
  }
});

// Get course tags
router.get('/courses/:courseid/tags', requireAuth, async (req, res) => {
  try {
    const { courseid } = req.params;

    console.log(`[Get Course Tags] Getting tags for course ${courseid}`);

    const result = await moodleAdapter.getCourseTags(courseid);

    res.json({
      success: true,
      courseid: parseInt(courseid, 10),
      tags: result.tags || []
    });
  } catch (error) {
    console.error('[Get Course Tags] Error:', error.message);
    res.status(500).json({
      error: 'Failed to get course tags',
      message: error.message
    });
  }
});

// Set course tag (Admin only)
router.post('/courses/:courseid/tags', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { courseid } = req.params;
    const { tag } = req.body;

    if (!tag || typeof tag !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'tag must be a string'
      });
    }

    console.log(`[Set Course Tag] Admin ${req.user.email} setting tag for course ${courseid}: ${tag}`);

    // Convert single tag to array for Moodle API
    await moodleAdapter.setCourseTag(courseid, [tag]);

    res.json({
      success: true,
      courseid: parseInt(courseid, 10),
      tag: tag,
      message: 'Tag successfully set'
    });
  } catch (error) {
    console.error('[Set Course Tag] Error:', error.message);
    res.status(500).json({
      error: 'Failed to set course tag',
      message: error.message
    });
  }
});

// Debug: Log all registered routes
console.log('[Moodle Routes] Registered routes:');
router.stack.forEach((r) => {
  if (r.route && r.route.path) {
    const methods = Object.keys(r.route.methods).join(', ').toUpperCase();
    console.log(`  ${methods} /api/moodle${r.route.path}`);
  }
});

module.exports = router;
