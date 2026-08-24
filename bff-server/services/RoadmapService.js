/**
 * Roadmap Service
 * Handles career roadmap (フェーズ制・スキル別テンプレート) business logic
 */

const apiServerAdapter = require('../adapters/ApiServerAdapter');

class RoadmapService {
  /**
   * Get roadmap skill master list
   */
  async getSkills() {
    console.log('[Roadmap] Getting skill master list');
    return await apiServerAdapter.getRoadmapSkills();
  }

  /**
   * Get phase templates for a skill
   */
  async getPhases(skillId) {
    console.log(`[Roadmap] Getting phases for skill ${skillId}`);
    return await apiServerAdapter.getRoadmapPhases(skillId);
  }

  /**
   * Start a new roadmap for a user
   */
  async startUserRoadmap(userid, skillId) {
    console.log(`[Roadmap] Starting roadmap for user ${userid}, skill ${skillId}`);
    return await apiServerAdapter.startUserRoadmap(userid, skillId);
  }

  /**
   * Get a user's current (active) roadmap
   */
  async getUserRoadmap(userid) {
    console.log(`[Roadmap] Getting current roadmap for user ${userid}`);
    return await apiServerAdapter.getUserRoadmap(userid);
  }

  /**
   * Update a phase progress entry (status / dates)
   */
  async updateProgress(progressId, data) {
    console.log(`[Roadmap] Updating progress ${progressId}`);
    return await apiServerAdapter.updateRoadmapProgress(progressId, data);
  }

  /**
   * Get fixed review questions for a review cycle
   */
  async getQuestions(reviewNo) {
    console.log(`[Roadmap] Getting review questions for review_no=${reviewNo}`);
    return await apiServerAdapter.getRoadmapQuestions(reviewNo);
  }

  /**
   * Submit answers for a review cycle
   */
  async submitAnswers(userid, reviewNo, answers) {
    console.log(`[Roadmap] Submitting ${answers.length} answers for user ${userid}, review_no=${reviewNo}`);
    return await apiServerAdapter.submitRoadmapAnswers(userid, reviewNo, answers);
  }
}

// Create singleton instance
const roadmapService = new RoadmapService();

module.exports = roadmapService;
