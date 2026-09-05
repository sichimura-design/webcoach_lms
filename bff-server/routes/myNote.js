/**
 * My Note API Routes
 * 教材に紐づかない自由記述のマイノート機能（フォルダは入れ子対応）
 */

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireOwnership = require('../middleware/ownership');
const myNoteService = require('../services/MyNoteService');

// ==================== FOLDERS ====================

// List folders
router.get('/folders/:userid', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { userid } = req.params;
    const result = await myNoteService.listFolders(userid);
    res.json(result);
  } catch (error) {
    console.error('[MyNote List Folders] Error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ error: 'Failed to list my note folders', detail: error.message });
  }
});

// Create folder
router.post('/folders/:userid', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { userid } = req.params;
    const result = await myNoteService.createFolder(userid, req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error('[MyNote Create Folder] Error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ error: 'Failed to create my note folder', detail: error.message });
  }
});

// Update (rename/move) folder
router.put('/folders/:userid/:folderId', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { userid, folderId } = req.params;
    const result = await myNoteService.updateFolder(userid, parseInt(folderId), req.body);
    res.json(result);
  } catch (error) {
    console.error('[MyNote Update Folder] Error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ error: 'Failed to update my note folder', detail: error.message });
  }
});

// Delete folder
router.delete('/folders/:userid/:folderId', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { userid, folderId } = req.params;
    await myNoteService.deleteFolder(userid, parseInt(folderId));
    res.status(204).send();
  } catch (error) {
    console.error('[MyNote Delete Folder] Error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ error: 'Failed to delete my note folder', detail: error.message });
  }
});

// ==================== NOTES ====================

// List notes (folder_id: 0 means root-level only. cmid filters by material)
router.get('/notes/:userid', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { userid } = req.params;
    const { folder_id: folderId, cmid } = req.query;
    const result = await myNoteService.listNotes(userid, {
      folderId: folderId !== undefined ? parseInt(folderId) : undefined,
      cmid: cmid !== undefined ? parseInt(cmid) : undefined,
    });
    res.json(result);
  } catch (error) {
    console.error('[MyNote List Notes] Error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ error: 'Failed to list my notes', detail: error.message });
  }
});

// Create note
router.post('/notes/:userid', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { userid } = req.params;
    const result = await myNoteService.createNote(userid, req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error('[MyNote Create Note] Error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ error: 'Failed to create my note', detail: error.message });
  }
});

// Get note
router.get('/notes/:userid/:noteId', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { userid, noteId } = req.params;
    const result = await myNoteService.getNote(userid, parseInt(noteId));
    res.json(result);
  } catch (error) {
    console.error('[MyNote Get Note] Error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ error: 'Failed to get my note', detail: error.message });
  }
});

// Update note
router.put('/notes/:userid/:noteId', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { userid, noteId } = req.params;
    const result = await myNoteService.updateNote(userid, parseInt(noteId), req.body);
    res.json(result);
  } catch (error) {
    console.error('[MyNote Update Note] Error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ error: 'Failed to update my note', detail: error.message });
  }
});

// Delete note
router.delete('/notes/:userid/:noteId', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { userid, noteId } = req.params;
    await myNoteService.deleteNote(userid, parseInt(noteId));
    res.status(204).send();
  } catch (error) {
    console.error('[MyNote Delete Note] Error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ error: 'Failed to delete my note', detail: error.message });
  }
});

module.exports = router;
