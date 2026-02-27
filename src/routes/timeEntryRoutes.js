/* ======================================================
   src/routes/timeEntryRoutes.js
   Time Tracking Routes - MINIMAL VERSION
====================================================== */
import express from 'express';
import {
  getTimeEntries,
  startTimer,
  stopTimer,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  getEntriesForRange,
  getTimeStats,
  stopAllTimers,
} from '../controllers/timeEntryController.js';
import { protect } from '../middleware/auth.js';
import { workspaceAuth, optionalWorkspaceAuth } from '../middleware/workspaceAuth.js';

const router = express.Router();

/* =============================
   ALL ROUTES REQUIRE AUTHENTICATION
============================= */
router.use(protect);

/* =============================
   TIME ENTRY LISTS & SUMMARIES
============================= */

// Get Time Entries (with filters)
router.get('/', optionalWorkspaceAuth, getTimeEntries);

// Date Range Entries
router.get('/range', getEntriesForRange);

// Statistics
router.get('/stats', getTimeStats);

/* =============================
   TIMER OPERATIONS
============================= */

// Start Timer
router.post('/start', workspaceAuth(), startTimer);

// Stop All Running Timers (cleanup)
router.post('/cleanup', stopAllTimers);

/* =============================
   MANUAL TIME ENTRY
============================= */

// Create Manual Time Entry
router.post('/', workspaceAuth(), createTimeEntry);

/* =============================
   TIME ENTRY OPERATIONS
============================= */

// Stop Timer - FIXED to POST
router.post('/:id/stop', stopTimer);

// Update Time Entry
router.patch('/:id', updateTimeEntry);

// Delete Time Entry
router.delete('/:id', deleteTimeEntry);

export default router;