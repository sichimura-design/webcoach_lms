/**
 * API Server Adapter
 * Abstracts API Server (FastAPI) calls
 */

const axios = require('axios');
const { config } = require('../config/environment');

class ApiServerAdapter {
  constructor() {
    this.apiServerUrl = config.apiServerUrl;
  }

  /**
   * Get profile
   */
  async getProfile(userid) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/profile/${userid}`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Update profile
   */
  async updateProfile(userid, profileData) {
    const response = await axios.post(
      `${this.apiServerUrl}/api/updateprofile/${userid}`,
      profileData,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get resume courses
   */
  async getResumeCourses(userid, limit = 5) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/resumecourse/${userid}`,
      {
        params: { limit },
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Update resume course
   */
  async updateResumeCourse(userid, resumeCourseData) {
    const response = await axios.post(
      `${this.apiServerUrl}/api/resumecourse/${userid}`,
      resumeCourseData,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get recommended badges
   */
  async getRecommendedBadges(userid) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/recomendbadge/${userid}`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get roadmaps
   */
  async getRoadmaps(filters = {}) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/rodmaps`,
      {
        params: {
          category: filters.category,
          difficulty: filters.difficulty,
          limit: filters.limit || 20,
          offset: filters.offset || 0
        },
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get roadmap detail
   */
  async getRoadmapDetail(roadmapid) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/rodmaps/${roadmapid}`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get AI applications
   */
  async getAIApplications(filters = {}) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/ai-applications`,
      {
        params: {
          category: filters.category,
          limit: filters.limit,
          offset: filters.offset || 0
        },
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Send AI chat request (LangGraph version)
   */
  async sendAIChat(chatRequest) {
    const response = await axios.post(
      `${this.apiServerUrl}/api/ai/chat`,
      chatRequest,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000 // AI responses may take longer
      }
    );
    return response.data;
  }

  /**
   * Update database (bulk operation)
   */
  async updateDatabase(dataType, records) {
    const response = await axios.post(
      `${this.apiServerUrl}/api/updatedb`,
      {
        data_type: dataType,
        records: records
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000 // 60 seconds for bulk operations
      }
    );
    return response.data;
  }

  /**
   * Health check
   */
  async healthCheck() {
    const response = await axios.get(
      `${this.apiServerUrl}/health`,
      { timeout: 3000 }
    );
    return response.data;
  }

  /**
   * Ingest specific HTML files from S3 to FAISS
   */
  async ingestS3HTML(params) {
    const response = await axios.post(
      `${this.apiServerUrl}/api/faiss/ingest/s3-html`,
      params,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 300000 // 5 minutes for ingestion operations
      }
    );
    return response.data;
  }

  /**
   * Ingest all HTML files from S3 prefix to FAISS
   */
  async ingestS3Prefix(params) {
    const response = await axios.post(
      `${this.apiServerUrl}/api/faiss/ingest/s3-prefix`,
      params,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 300000 // 5 minutes for ingestion operations
      }
    );
    return response.data;
  }

  /**
   * Ingest today's HTML files from S3 to FAISS
   */
  async ingestTodayHTML(params) {
    const response = await axios.post(
      `${this.apiServerUrl}/api/faiss/ingest/s3-today`,
      params,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 300000 // 5 minutes for ingestion operations
      }
    );
    return response.data;
  }

  /**
   * Ingest today's HTML files from S3 to FAISS (simplified)
   */
  async ingestS3Today(params) {
    const response = await axios.post(
      `${this.apiServerUrl}/api/faiss/ingest/s3-today`,
      params,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 300000 // 5 minutes for ingestion operations
      }
    );
    return response.data;
  }

  /**
   * Ingest all HTML files from S3 to FAISS
   */
  async ingestS3All(params) {
    const response = await axios.post(
      `${this.apiServerUrl}/api/faiss/ingest/s3-all`,
      params,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 600000 // 10 minutes for full ingestion operations
      }
    );
    return response.data;
  }

  /**
   * Get FAISS statistics
   */
  async getFAISSStats() {
    const response = await axios.get(
      `${this.apiServerUrl}/api/faiss/stats`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Reload FAISS index from S3
   */
  async reloadFAISSIndex() {
    const response = await axios.post(
      `${this.apiServerUrl}/api/faiss/reload`,
      {},
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000 // 30 seconds for reload operation
      }
    );
    return response.data;
  }

  /**
   * Get tag-url mappings
   */
  async getTagUrlMappings() {
    const response = await axios.get(
      `${this.apiServerUrl}/api/tag-url-mappings`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Upsert tag-url mapping
   */
  async upsertTagUrlMapping(tagId, url) {
    const response = await axios.post(
      `${this.apiServerUrl}/api/tag-url-mapping`,
      {
        tag_id: tagId,
        url: url
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Create avatar
   */
  async createAvatar(url) {
    const response = await axios.post(
      `${this.apiServerUrl}/api/avatar`,
      { url },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get avatar by ID
   */
  async getAvatar(avatarId) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/avatar/${avatarId}`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get all avatars
   */
  async getAllAvatars(limit = 100, offset = 0) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/avatars`,
      {
        params: { limit, offset },
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Update avatar
   */
  async updateAvatar(avatarId, url) {
    const response = await axios.put(
      `${this.apiServerUrl}/api/avatar/${avatarId}`,
      { url },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Delete avatar
   */
  async deleteAvatar(avatarId) {
    const response = await axios.delete(
      `${this.apiServerUrl}/api/avatar/${avatarId}`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Create next coaching goal
   */
  async createNextCoachingGoal(mdlUserId, no, description, isCompleted = 0) {
    const response = await axios.post(
      `${this.apiServerUrl}/api/next-coaching-goal`,
      {
        mdl_user_id: mdlUserId,
        no,
        description,
        is_completed: isCompleted
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get next coaching goal
   */
  async getNextCoachingGoal(userid, no) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/next-coaching-goal/${userid}/${no}`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get all next coaching goals (all users)
   */
  async getAllNextCoachingGoals() {
    const response = await axios.get(
      `${this.apiServerUrl}/api/next-coaching-goals`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get all next coaching goals for user
   */
  async getNextCoachingGoals(userid) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/next-coaching-goals/${userid}`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Update next coaching goal
   */
  async updateNextCoachingGoal(userid, no, description = null, isCompleted = null) {
    const updateData = {};
    if (description !== null) {
      updateData.description = description;
    }
    if (isCompleted !== null) {
      updateData.is_completed = isCompleted;
    }

    const response = await axios.put(
      `${this.apiServerUrl}/api/next-coaching-goal/${userid}/${no}`,
      updateData,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Delete next coaching goal
   */
  async deleteNextCoachingGoal(userid, no) {
    const response = await axios.delete(
      `${this.apiServerUrl}/api/next-coaching-goal/${userid}/${no}`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Bulk upsert next coaching goals (create, update, delete, and reorder)
   */
  async bulkUpsertNextCoachingGoals(userid, goals) {
    const response = await axios.put(
      `${this.apiServerUrl}/api/next-coaching-goals/${userid}`,
      { goals },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get all coach-student mappings
   */
  async getAllCoachStudentMappings(includeDeleted = false) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/coaching/mappings`,
      {
        params: { include_deleted: includeDeleted },
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get students assigned to a coach
   */
  async getCoachStudents(coachUserId, includeDeleted = false) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/coaching/coaches/${coachUserId}/students`,
      {
        params: { include_deleted: includeDeleted },
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get coach assigned to a student
   */
  async getStudentCoach(studentUserId, includeDeleted = false) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/coaching/students/${studentUserId}/coach`,
      {
        params: { include_deleted: includeDeleted },
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Create coach-student mapping
   */
  async createCoachStudentMapping(coachUserId, studentUserId) {
    const response = await axios.post(
      `${this.apiServerUrl}/api/coaching/mappings`,
      {
        coach_user_id: coachUserId,
        student_user_id: studentUserId
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get specific coach-student mapping
   */
  async getCoachStudentMapping(coachUserId, studentUserId, includeDeleted = false) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/coaching/mappings/${coachUserId}/${studentUserId}`,
      {
        params: { include_deleted: includeDeleted },
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Delete coach-student mapping (logical delete)
   */
  async deleteCoachStudentMapping(coachUserId, studentUserId) {
    const response = await axios.delete(
      `${this.apiServerUrl}/api/coaching/mappings/${coachUserId}/${studentUserId}`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Restore deleted coach-student mapping
   */
  async restoreCoachStudentMapping(coachUserId, studentUserId) {
    const response = await axios.post(
      `${this.apiServerUrl}/api/coaching/mappings/${coachUserId}/${studentUserId}/restore`,
      {},
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }
}

// Create singleton instance
const apiServerAdapter = new ApiServerAdapter();

module.exports = apiServerAdapter;
