/**
 * My Note Service
 * Handles my note (folders + notes) business logic
 */

const apiServerAdapter = require('../adapters/ApiServerAdapter');

class MyNoteService {
  /**
   * List folders (flat list)
   */
  async listFolders(userid) {
    console.log(`[MyNote] Listing folders for user ${userid}`);
    return await apiServerAdapter.listMyNoteFolders(userid);
  }

  /**
   * Create a folder
   */
  async createFolder(userid, data) {
    console.log(`[MyNote] Creating folder for user ${userid}`);
    return await apiServerAdapter.createMyNoteFolder(userid, data);
  }

  /**
   * Update (rename/move) a folder
   */
  async updateFolder(userid, folderId, data) {
    console.log(`[MyNote] Updating folder ${folderId} for user ${userid}`);
    return await apiServerAdapter.updateMyNoteFolder(userid, folderId, data);
  }

  /**
   * Delete a folder
   */
  async deleteFolder(userid, folderId) {
    console.log(`[MyNote] Deleting folder ${folderId} for user ${userid}`);
    return await apiServerAdapter.deleteMyNoteFolder(userid, folderId);
  }

  /**
   * List notes
   * folderId: 0 means root-level only. cmid filters by material (lesson).
   */
  async listNotes(userid, filters = {}) {
    console.log(`[MyNote] Listing notes for user ${userid}`);
    return await apiServerAdapter.listMyNotes(userid, filters);
  }

  /**
   * Create a note
   */
  async createNote(userid, data) {
    console.log(`[MyNote] Creating note for user ${userid}`);
    return await apiServerAdapter.createMyNote(userid, data);
  }

  /**
   * Get a note
   */
  async getNote(userid, noteId) {
    console.log(`[MyNote] Getting note ${noteId} for user ${userid}`);
    return await apiServerAdapter.getMyNote(userid, noteId);
  }

  /**
   * Update a note
   */
  async updateNote(userid, noteId, data) {
    console.log(`[MyNote] Updating note ${noteId} for user ${userid}`);
    return await apiServerAdapter.updateMyNote(userid, noteId, data);
  }

  /**
   * Delete a note
   */
  async deleteNote(userid, noteId) {
    console.log(`[MyNote] Deleting note ${noteId} for user ${userid}`);
    return await apiServerAdapter.deleteMyNote(userid, noteId);
  }
}

// Create singleton instance
const myNoteService = new MyNoteService();

module.exports = myNoteService;
