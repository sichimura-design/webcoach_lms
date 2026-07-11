/**
 * WebCoach Service
 * Handles WebCoach-related business logic (API Server integration)
 */

const apiServerAdapter = require('../adapters/ApiServerAdapter');
const courseService = require('./CourseService');
const { isFlagTrue } = require('../utils/flagValidation');

class WebCoachService {
  /**
   * Get user profile
   */
  async getProfile(userid) {
    return await apiServerAdapter.getProfile(userid);
  }

  /**
   * Update user profile
   */
  async updateProfile(userid, profileData) {
    return await apiServerAdapter.updateProfile(userid, profileData);
  }

  /**
   * Get resume courses with progress
   */
  async getResumeCoursesWithProgress(userid, limit = 5) {
    const userIdInt = parseInt(userid, 10);
    const resumeCourses = await apiServerAdapter.getResumeCourses(userid, limit);

    // Add progress calculation for each course
    // Note: api-server already returns image_url from webcoach database
    if (Array.isArray(resumeCourses) && resumeCourses.length > 0) {
      const coursesWithProgress = await Promise.all(
        resumeCourses.map(async (course) => {
          const progress = await courseService.calculateCourseProgress(course.courseid, userIdInt);
          return {
            ...course,
            progress
          };
        })
      );

      return coursesWithProgress;
    }

    return resumeCourses;
  }

  /**
   * Update resume course
   */
  async updateResumeCourse(userid, resumeCourseData) {
    return await apiServerAdapter.updateResumeCourse(userid, resumeCourseData);
  }

  /**
   * Get recommended badges
   */
  async getRecommendedBadges(userid) {
    return await apiServerAdapter.getRecommendedBadges(userid);
  }

  /**
   * Get roadmaps
   */
  async getRoadmaps(filters = {}) {
    return await apiServerAdapter.getRoadmaps(filters);
  }

  /**
   * Get roadmap detail
   */
  async getRoadmapDetail(roadmapid) {
    return await apiServerAdapter.getRoadmapDetail(roadmapid);
  }

  /**
   * Get AI applications
   */
  async getAIApplications(filters = {}) {
    console.log(`[WebCoach AI Applications] Getting AI applications`, filters);
    return await apiServerAdapter.getAIApplications(filters);
  }

  /**
   * Send AI chat request
   */
  async sendAIChat(chatRequest) {
    return await apiServerAdapter.sendAIChat(chatRequest);
  }

  /**
   * Update database (bulk operation)
   */
  async updateDatabase(dataType, records) {
    if (!Array.isArray(records)) {
      throw new Error('records must be an array');
    }

    if (records.length === 0) {
      throw new Error('records array cannot be empty');
    }

    console.log(`[WebCoach UpdateDB] Type: ${dataType}, Records: ${records.length}`);

    const result = await apiServerAdapter.updateDatabase(dataType, records);

    console.log(`[WebCoach UpdateDB] Success: ${result.recordsProcessed} processed`);

    return result;
  }

  /**
   * Ingest specific HTML files from S3 to FAISS
   */
  async ingestS3HTML(params) {
    console.log(`[WebCoach FAISS] Ingesting ${params.s3_keys.length} HTML files from s3://${params.s3_bucket}`);
    return await apiServerAdapter.ingestS3HTML(params);
  }

  /**
   * Ingest all HTML files from S3 prefix to FAISS
   */
  async ingestS3Prefix(params) {
    console.log(`[WebCoach FAISS] Ingesting HTML files from s3://${params.s3_bucket}/${params.s3_prefix}`);
    return await apiServerAdapter.ingestS3Prefix(params);
  }

  /**
   * Ingest today's HTML files from S3 to FAISS
   */
  async ingestTodayHTML(params) {
    console.log(`[WebCoach FAISS] Ingesting today's HTML files from s3://${params.s3_bucket}/${params.s3_prefix}`);
    return await apiServerAdapter.ingestTodayHTML(params);
  }

  /**
   * Get FAISS statistics
   */
  async getFAISSStats() {
    console.log(`[WebCoach FAISS] Getting FAISS statistics`);
    return await apiServerAdapter.getFAISSStats();
  }

  /**
   * Reload FAISS index from S3
   */
  async reloadFAISSIndex() {
    console.log(`[WebCoach FAISS] Reloading FAISS index from S3`);
    return await apiServerAdapter.reloadFAISSIndex();
  }

  /**
   * Get tag-url mappings
   */
  async getTagUrlMappings() {
    console.log(`[WebCoach Tag-URL] Getting tag-url mappings`);
    return await apiServerAdapter.getTagUrlMappings();
  }

  /**
   * Upsert tag-url mapping
   */
  async upsertTagUrlMapping(tagId, url) {
    console.log(`[WebCoach Tag-URL] Upserting mapping for tag ${tagId}`);
    return await apiServerAdapter.upsertTagUrlMapping(tagId, url);
  }

  /**
   * Manage avatars (Create/Update/Delete in bulk)
   */
  async manageAvatars(avatars) {
    if (!Array.isArray(avatars)) {
      throw new Error('avatars must be an array');
    }

    if (avatars.length === 0) {
      throw new Error('avatars array cannot be empty');
    }

    console.log(`[WebCoach Avatar] Managing ${avatars.length} avatar records`);

    // Strict validation: only true, 1, or "1" are considered as flags
    const toDelete = avatars.filter(a => isFlagTrue(a.deleteFlag));
    const toUpdate = avatars.filter(a => isFlagTrue(a.updateFlag) && !isFlagTrue(a.deleteFlag));
    const toCreate = avatars.filter(a => !isFlagTrue(a.updateFlag) && !isFlagTrue(a.deleteFlag));

    const results = {
      success: true,
      created: 0,
      updated: 0,
      deleted: 0,
      avatars: [],
      errors: []
    };

    // Process deletions
    for (const avatar of toDelete) {
      try {
        if (!avatar.avatar_id) {
          throw new Error('avatar_id is required for deletion');
        }
        await apiServerAdapter.deleteAvatar(avatar.avatar_id);
        results.deleted++;
        results.avatars.push({
          avatar_id: avatar.avatar_id,
          status: 'deleted'
        });
        console.log(`[WebCoach Avatar] Deleted avatar ${avatar.avatar_id}`);
      } catch (error) {
        results.success = false;
        results.errors.push({
          operation: 'delete',
          avatar_id: avatar.avatar_id,
          message: error.message
        });
      }
    }

    // Process updates
    for (const avatar of toUpdate) {
      try {
        if (!avatar.avatar_id) {
          throw new Error('avatar_id is required for update');
        }
        if (!avatar.url) {
          throw new Error('url is required for update');
        }
        const result = await apiServerAdapter.updateAvatar(avatar.avatar_id, avatar.url);
        results.updated++;
        results.avatars.push({
          avatar_id: result.avatar_id,
          url: result.url,
          status: 'updated'
        });
        console.log(`[WebCoach Avatar] Updated avatar ${avatar.avatar_id}`);
      } catch (error) {
        results.success = false;
        results.errors.push({
          operation: 'update',
          avatar_id: avatar.avatar_id,
          message: error.message
        });
      }
    }

    // Process creations
    for (const avatar of toCreate) {
      try {
        if (!avatar.url) {
          throw new Error('url is required for creation');
        }
        const result = await apiServerAdapter.createAvatar(avatar.url);
        results.created++;
        results.avatars.push({
          avatar_id: result.avatar_id,
          url: result.url,
          status: 'created'
        });
        console.log(`[WebCoach Avatar] Created avatar ${result.avatar_id}`);
      } catch (error) {
        results.success = false;
        results.errors.push({
          operation: 'create',
          url: avatar.url,
          message: error.message
        });
      }
    }

    return results;
  }

  /**
   * Get avatar by ID
   */
  async getAvatar(avatarId) {
    console.log(`[WebCoach Avatar] Getting avatar ${avatarId}`);
    return await apiServerAdapter.getAvatar(avatarId);
  }

  /**
   * Get all avatars
   */
  async getAllAvatars(limit = 100, offset = 0) {
    console.log(`[WebCoach Avatar] Getting avatars (limit: ${limit}, offset: ${offset})`);
    return await apiServerAdapter.getAllAvatars(limit, offset);
  }

  /**
   * Create next coaching goal
   */
  async createNextCoachingGoal(mdlUserId, no, description, isCompleted = 0) {
    console.log(`[WebCoach NextCoachingGoal] Creating goal for user ${mdlUserId}, no ${no}`);
    return await apiServerAdapter.createNextCoachingGoal(mdlUserId, no, description, isCompleted);
  }

  /**
   * Get next coaching goal
   */
  async getNextCoachingGoal(userid, no) {
    console.log(`[WebCoach NextCoachingGoal] Getting goal for user ${userid}, no ${no}`);
    return await apiServerAdapter.getNextCoachingGoal(userid, no);
  }

  /**
   * Get all next coaching goals (all users)
   */
  async getAllNextCoachingGoals() {
    console.log(`[WebCoach NextCoachingGoal] Getting all coaching goals for all users`);
    return await apiServerAdapter.getAllNextCoachingGoals();
  }

  /**
   * Get all next coaching goals for user
   */
  async getNextCoachingGoals(userid) {
    console.log(`[WebCoach NextCoachingGoal] Getting all goals for user ${userid}`);
    return await apiServerAdapter.getNextCoachingGoals(userid);
  }

  /**
   * Update next coaching goal
   */
  async updateNextCoachingGoal(userid, no, description = null, isCompleted = null) {
    console.log(`[WebCoach NextCoachingGoal] Updating goal for user ${userid}, no ${no}`);
    return await apiServerAdapter.updateNextCoachingGoal(userid, no, description, isCompleted);
  }

  /**
   * Delete next coaching goal
   */
  async deleteNextCoachingGoal(userid, no) {
    console.log(`[WebCoach NextCoachingGoal] Deleting goal for user ${userid}, no ${no}`);
    return await apiServerAdapter.deleteNextCoachingGoal(userid, no);
  }

  /**
   * Bulk upsert next coaching goals (create, update, delete, and reorder)
   */
  async bulkUpsertNextCoachingGoals(userid, goals) {
    console.log(`[WebCoach NextCoachingGoal] Bulk upserting ${goals.length} goals for user ${userid}`);
    return await apiServerAdapter.bulkUpsertNextCoachingGoals(userid, goals);
  }
}

// Create singleton instance
const webCoachService = new WebCoachService();

module.exports = webCoachService;
