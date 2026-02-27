/* ======================================================
   src/routes/milestoneRoutes.js
   Milestone & Goal Tracking Routes
====================================================== */
import express from 'express';
import {
  getMilestones,
  getMilestone,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  completeMilestone,
  updateProgress,
  addTeamMember,
  removeTeamMember,
  addChecklistItem,
  completeChecklistItem,
  addSuccessCriterion,
  markCriterionMet,
  addUpdate,
  archiveMilestone,
  getProjectMilestones,
  getUpcomingMilestones,
  getOverdueMilestones,
  getMilestoneStats,
} from '../controllers/milestoneController.js';
import { protect } from '../middleware/auth.js';
import { workspaceAuth } from '../middleware/workspaceAuth.js';
import { projectAuth } from '../middleware/projectAuth.js';
import { milestoneValidation, idValidation, workspaceIdValidation, projectIdValidation } from '../middleware/validation.js';

const router = express.Router({ mergeParams: true }); // Access parent params

/* =============================
   ALL ROUTES REQUIRE AUTHENTICATION
============================= */
router.use(protect);

/* =============================
   WORKSPACE-SPECIFIC MILESTONE ROUTES
   These routes are accessed via /api/workspaces/:workspaceId/milestones
============================= */

// Upcoming Milestones (workspace-scoped)
router.get(
  '/upcoming',
  workspaceIdValidation,
  workspaceAuth(),
  getUpcomingMilestones
);

// Overdue Milestones (workspace-scoped)
router.get(
  '/overdue',
  workspaceIdValidation,
  workspaceAuth(),
  getOverdueMilestones
);

// Workspace Statistics (workspace-scoped)
router.get(
  '/stats',
  workspaceIdValidation,
  workspaceAuth(),
  getMilestoneStats
);

/* =============================
   MILESTONE CRUD
============================= */

// List & Create Milestones
router
  .route('/')
  .get(getMilestones)
  .post(
    workspaceAuth(['owner', 'admin', 'member']),
    milestoneValidation.create,
    createMilestone
  );

// Get, Update, Delete Milestone
router
  .route('/:id')
  .get(idValidation, getMilestone)
  .put(idValidation, milestoneValidation.update, updateMilestone)
  .delete(idValidation, deleteMilestone);

/* =============================
   MILESTONE ACTIONS
============================= */

// Complete Milestone
router.put('/:id/complete', idValidation, completeMilestone);

// Update Progress
router.put('/:id/progress', idValidation, updateProgress);

// Archive Milestone
router.put('/:id/archive', idValidation, archiveMilestone);

/* =============================
   TEAM MANAGEMENT
============================= */

// Add Team Member
router.post('/:id/team', idValidation, addTeamMember);

// Remove Team Member
router.delete('/:id/team/:userId', idValidation, removeTeamMember);

/* =============================
   CHECKLIST MANAGEMENT
============================= */

// Add Checklist Item
router.post('/:id/checklist', idValidation, addChecklistItem);

// Complete Checklist Item
router.put('/:id/checklist/:itemId/complete', idValidation, completeChecklistItem);

/* =============================
   SUCCESS CRITERIA MANAGEMENT
============================= */

// Add Success Criterion
router.post('/:id/criteria', idValidation, addSuccessCriterion);

// Mark Criterion as Met
router.put('/:id/criteria/:criterionId/met', idValidation, markCriterionMet);

/* =============================
   UPDATES/NOTES
============================= */

// Add Update/Note
router.post('/:id/updates', idValidation, addUpdate);

export default router;