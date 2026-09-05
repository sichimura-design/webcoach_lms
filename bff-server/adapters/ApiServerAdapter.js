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
   * Get the currently in-progress study session (if any)
   *
   * 開始/一時停止/再開/終了/補正の書き込みはbff-server(MoodleAdapter)がMoodle webservice経由で
   * 直接行う。api-serverはmdl_logstore_standard_logからの読み取り集計のみを担当する。
   */
  async getActiveStudySession(userid) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/study/sessions/${userid}/active`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get recently completed study sessions
   */
  async getRecentStudySessions(userid, limit = 10) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/study/sessions/${userid}/recent`,
      {
        params: { limit },
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get today / this week / total study minutes
   */
  async getStudyStats(userid) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/study/stats/${userid}`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get the study streak (consecutive days with a completed study session)
   */
  async getStudyStreak(userid) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/study/streak/${userid}`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get the study calendar for a given year/month
   */
  async getStudyCalendar(userid, year, month) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/study/calendar/${userid}`,
      {
        params: { year, month },
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get the study time ranking for a given period ('week' | 'month' | 'all')
   */
  async getStudyRanking(period = 'week', limit = 20) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/study/ranking`,
      {
        params: { period, limit },
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get per-course access counts / last-accessed timestamps
   */
  async getCourseAccess(userid) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/study/course-access/${userid}`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get per-material (course module) access counts within a course
   */
  async getCourseMaterialAccess(userid, courseid) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/study/course-access/${userid}/${courseid}/materials`,
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
   * Get study note
   */
  async getStudyNote(userid, courseid, cmid) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/study-note/${userid}/${courseid}/${cmid}`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Update study note
   */
  async updateStudyNote(userid, courseid, cmid, content) {
    const response = await axios.put(
      `${this.apiServerUrl}/api/study-note/${userid}/${courseid}/${cmid}`,
      { content },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get roadmap skill master list
   */
  async getRoadmapSkills() {
    const response = await axios.get(
      `${this.apiServerUrl}/api/roadmap/skills`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get phase templates for a skill
   */
  async getRoadmapPhases(skillId) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/roadmap/phases`,
      {
        params: { skill_id: skillId },
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Start a new roadmap for a user
   */
  async startUserRoadmap(userid, skillId) {
    const response = await axios.post(
      `${this.apiServerUrl}/api/roadmap/users/${userid}`,
      { skill_id: skillId },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get a user's current (active) roadmap
   */
  async getUserRoadmap(userid) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/roadmap/users/${userid}`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Update a phase progress entry (status / dates)
   */
  async updateRoadmapProgress(progressId, data) {
    const response = await axios.put(
      `${this.apiServerUrl}/api/roadmap/progress/${progressId}`,
      data,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get fixed review questions for a review cycle
   */
  async getRoadmapQuestions(reviewNo) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/roadmap/questions/${reviewNo}`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Submit answers for a review cycle
   */
  async submitRoadmapAnswers(userid, reviewNo, answers) {
    const response = await axios.post(
      `${this.apiServerUrl}/api/roadmap/users/${userid}/answers`,
      { review_no: reviewNo, answers },
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
   * Get coaching schedules for a student
   */
  async getCoachingSchedules(userid) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/coaching/schedule/${userid}`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Create coaching schedule
   */
  async createCoachingSchedule(userid, data) {
    const response = await axios.post(
      `${this.apiServerUrl}/api/coaching/schedule/${userid}`,
      data,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Update coaching schedule
   */
  async updateCoachingSchedule(userid, id, data) {
    const response = await axios.put(
      `${this.apiServerUrl}/api/coaching/schedule/${userid}/${id}`,
      data,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Delete coaching schedule
   */
  async deleteCoachingSchedule(userid, id) {
    const response = await axios.delete(
      `${this.apiServerUrl}/api/coaching/schedule/${userid}/${id}`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get AI coaching note for a coaching schedule
   */
  async getCoachingNote(coachingScheduleId) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/coaching/notes/${coachingScheduleId}`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Update (edit/confirm/publish) AI coaching note
   */
  async updateCoachingNote(coachingScheduleId, data) {
    const response = await axios.put(
      `${this.apiServerUrl}/api/coaching/notes/${coachingScheduleId}`,
      data,
      {
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

  /**
   * Save (upsert) a coach's meeting integration tokens (already encrypted)
   */
  async upsertCoachMeetingIntegration(coachUserId, payload) {
    const response = await axios.put(
      `${this.apiServerUrl}/api/coaching/integrations/${coachUserId}`,
      payload,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get a coach's meeting integration status (no tokens included)
   */
  async getCoachMeetingIntegrationStatus(coachUserId) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/coaching/integrations/${coachUserId}`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  // ==================== MY NOTE ====================

  /**
   * List my note folders (flat list, tree built client-side)
   */
  async listMyNoteFolders(userid) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/my-note/folders/${userid}`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Create a my note folder
   */
  async createMyNoteFolder(userid, data) {
    const response = await axios.post(
      `${this.apiServerUrl}/api/my-note/folders/${userid}`,
      data,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Update (rename/move) a my note folder
   */
  async updateMyNoteFolder(userid, folderId, data) {
    const response = await axios.put(
      `${this.apiServerUrl}/api/my-note/folders/${userid}/${folderId}`,
      data,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Delete a my note folder
   */
  async deleteMyNoteFolder(userid, folderId) {
    await axios.delete(
      `${this.apiServerUrl}/api/my-note/folders/${userid}/${folderId}`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
  }

  /**
   * List my notes
   * folderId: 0 means root-level only. cmid filters by material (lesson).
   */
  async listMyNotes(userid, { folderId, cmid } = {}) {
    const params = {};
    if (folderId !== undefined) params.folder_id = folderId;
    if (cmid !== undefined) params.cmid = cmid;

    const response = await axios.get(
      `${this.apiServerUrl}/api/my-note/notes/${userid}`,
      {
        headers: { 'Content-Type': 'application/json' },
        params: Object.keys(params).length > 0 ? params : undefined,
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Create a my note
   */
  async createMyNote(userid, data) {
    const response = await axios.post(
      `${this.apiServerUrl}/api/my-note/notes/${userid}`,
      data,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Get a my note
   */
  async getMyNote(userid, noteId) {
    const response = await axios.get(
      `${this.apiServerUrl}/api/my-note/notes/${userid}/${noteId}`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Update a my note
   */
  async updateMyNote(userid, noteId, data) {
    const response = await axios.put(
      `${this.apiServerUrl}/api/my-note/notes/${userid}/${noteId}`,
      data,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  }

  /**
   * Delete a my note
   */
  async deleteMyNote(userid, noteId) {
    await axios.delete(
      `${this.apiServerUrl}/api/my-note/notes/${userid}/${noteId}`,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
  }
}

// Create singleton instance
const apiServerAdapter = new ApiServerAdapter();

module.exports = apiServerAdapter;
