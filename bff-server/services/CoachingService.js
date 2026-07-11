/**
 * Coaching Service
 * Handles coach-student mapping business logic
 */

const apiServerAdapter = require('../adapters/ApiServerAdapter');
const { isFlagTrue } = require('../utils/flagValidation');

class CoachingService {
  /**
   * Get all coach-student mappings
   */
  async getAllMappings(includeDeleted = false) {
    console.log(`[Coaching] Getting all coach-student mappings`);
    return await apiServerAdapter.getAllCoachStudentMappings(includeDeleted);
  }

  /**
   * Get students assigned to a coach
   */
  async getCoachStudents(coachUserId, includeDeleted = false) {
    console.log(`[Coaching] Getting students for coach ${coachUserId}`);
    return await apiServerAdapter.getCoachStudents(coachUserId, includeDeleted);
  }

  /**
   * Get coach assigned to a student
   */
  async getStudentCoach(studentUserId, includeDeleted = false) {
    console.log(`[Coaching] Getting coach for student ${studentUserId}`);
    return await apiServerAdapter.getStudentCoach(studentUserId, includeDeleted);
  }

  /**
   * Create coach-student mapping
   */
  async createMapping(coachUserId, studentUserId) {
    console.log(`[Coaching] Creating mapping: coach=${coachUserId}, student=${studentUserId}`);
    return await apiServerAdapter.createCoachStudentMapping(coachUserId, studentUserId);
  }

  /**
   * Get specific coach-student mapping
   */
  async getMapping(coachUserId, studentUserId, includeDeleted = false) {
    console.log(`[Coaching] Getting mapping: coach=${coachUserId}, student=${studentUserId}`);
    return await apiServerAdapter.getCoachStudentMapping(coachUserId, studentUserId, includeDeleted);
  }

  /**
   * Delete coach-student mapping
   */
  async deleteMapping(coachUserId, studentUserId) {
    console.log(`[Coaching] Deleting mapping: coach=${coachUserId}, student=${studentUserId}`);
    return await apiServerAdapter.deleteCoachStudentMapping(coachUserId, studentUserId);
  }

  /**
   * Restore deleted coach-student mapping
   */
  async restoreMapping(coachUserId, studentUserId) {
    console.log(`[Coaching] Restoring mapping: coach=${coachUserId}, student=${studentUserId}`);
    return await apiServerAdapter.restoreCoachStudentMapping(coachUserId, studentUserId);
  }

  /**
   * Manage mappings in bulk (Create/Update/Delete)
   * Similar to WebCoach avatars management
   */
  async manageMappings(mappings) {
    if (!Array.isArray(mappings)) {
      throw new Error('mappings must be an array');
    }

    if (mappings.length === 0) {
      throw new Error('mappings array cannot be empty');
    }

    console.log(`[Coaching] Managing ${mappings.length} mapping records`);

    // Strict validation: only true, 1, or "1" are considered as flags
    const toDelete = mappings.filter(m => isFlagTrue(m.deleteFlag));
    const toUpdate = mappings.filter(m => isFlagTrue(m.updateFlag) && !isFlagTrue(m.deleteFlag));
    const toCreate = mappings.filter(m => !isFlagTrue(m.updateFlag) && !isFlagTrue(m.deleteFlag));

    const results = {
      success: true,
      created: 0,
      updated: 0,
      deleted: 0,
      mappings: [],
      errors: []
    };

    // Process deletions
    for (const mapping of toDelete) {
      try {
        if (!mapping.coach_user_id || !mapping.student_user_id) {
          throw new Error('coach_user_id and student_user_id are required for deletion');
        }
        await apiServerAdapter.deleteCoachStudentMapping(mapping.coach_user_id, mapping.student_user_id);
        results.deleted++;
        results.mappings.push({
          coach_user_id: mapping.coach_user_id,
          student_user_id: mapping.student_user_id,
          status: 'deleted'
        });
        console.log(`[Coaching] Deleted mapping: coach=${mapping.coach_user_id}, student=${mapping.student_user_id}`);
      } catch (error) {
        results.success = false;
        results.errors.push({
          operation: 'delete',
          coach_user_id: mapping.coach_user_id,
          student_user_id: mapping.student_user_id,
          message: error.response?.data?.detail || error.message
        });
      }
    }

    // Process updates (restore if deleted)
    for (const mapping of toUpdate) {
      try {
        if (!mapping.coach_user_id || !mapping.student_user_id) {
          throw new Error('coach_user_id and student_user_id are required for update');
        }

        // For mappings, update means restore if deleted
        const result = await apiServerAdapter.restoreCoachStudentMapping(
          mapping.coach_user_id,
          mapping.student_user_id
        );
        results.updated++;
        results.mappings.push({
          coach_user_id: result.coach_user_id,
          student_user_id: result.student_user_id,
          status: 'updated'
        });
        console.log(`[Coaching] Updated mapping: coach=${mapping.coach_user_id}, student=${mapping.student_user_id}`);
      } catch (error) {
        results.success = false;
        results.errors.push({
          operation: 'update',
          coach_user_id: mapping.coach_user_id,
          student_user_id: mapping.student_user_id,
          message: error.response?.data?.detail || error.message
        });
      }
    }

    // Process creations
    for (const mapping of toCreate) {
      try {
        if (!mapping.coach_user_id || !mapping.student_user_id) {
          throw new Error('coach_user_id and student_user_id are required for creation');
        }
        const result = await apiServerAdapter.createCoachStudentMapping(
          mapping.coach_user_id,
          mapping.student_user_id
        );
        results.created++;
        results.mappings.push({
          coach_user_id: result.coach_user_id,
          student_user_id: result.student_user_id,
          status: 'created'
        });
        console.log(`[Coaching] Created mapping: coach=${mapping.coach_user_id}, student=${mapping.student_user_id}`);
      } catch (error) {
        results.success = false;
        results.errors.push({
          operation: 'create',
          coach_user_id: mapping.coach_user_id,
          student_user_id: mapping.student_user_id,
          message: error.response?.data?.detail || error.message
        });
      }
    }

    return results;
  }
}

// Create singleton instance
const coachingService = new CoachingService();

module.exports = coachingService;
