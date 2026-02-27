/* ======================================================
   src/routes/workspaceRoutes.js
   Workspace Management Routes
====================================================== */
import express from 'express';
import {
  createWorkspace,
  getWorkspaces,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  archiveWorkspace,
  unarchiveWorkspace,
  addMember,
  removeMember,
  updateMemberRole,
  updateMemberPermissions,
  transferOwnership,
  getMembers,
  getWorkspaceStats,
  leaveWorkspace,
} from '../controllers/workspaceController.js';
import { protect } from '../middleware/auth.js';
import { workspaceAuth } from '../middleware/workspaceAuth.js';
import { workspaceValidation, idValidation } from '../middleware/validation.js';

// Import nested routes
import projectRoutes from './projectRoutes.js';
import milestoneRoutes from './milestoneRoutes.js';

const router = express.Router();

/* =============================
   ALL ROUTES REQUIRE AUTHENTICATION
============================= */
router.use(protect);

/* =============================
   WORKSPACE CRUD
============================= */

// List & Create
router
  .route('/')
  .get(getWorkspaces)
  .post(workspaceValidation.create, createWorkspace);

// Get, Update, Delete
router
  .route('/:id')
  .get(idValidation, workspaceAuth(), getWorkspace)
  .put(idValidation, workspaceAuth(['owner', 'admin']), workspaceValidation.update, updateWorkspace)
  .delete(idValidation, workspaceAuth(['owner']), deleteWorkspace);

/* =============================
   WORKSPACE ACTIONS
============================= */

// Archive/Unarchive
router.put('/:id/archive', idValidation, workspaceAuth(['owner']), archiveWorkspace);
router.put('/:id/unarchive', idValidation, workspaceAuth(['owner']), unarchiveWorkspace);

// Leave Workspace
router.post('/:id/leave', idValidation, workspaceAuth(), leaveWorkspace);

// Statistics
router.get('/:id/stats', idValidation, workspaceAuth(), getWorkspaceStats);

/* =============================
   MEMBER MANAGEMENT
============================= */

// Get Members
router.get('/:id/members', idValidation, workspaceAuth(), getMembers);

// Add Member
router.post(
  '/:id/members',
  idValidation,
  workspaceAuth(['owner', 'admin'], 'canInviteMembers'),
  workspaceValidation.addMember,
  addMember
);

// Remove Member
router.delete(
  '/:id/members/:userId',
  idValidation,
  workspaceAuth(['owner', 'admin'], 'canManageMembers'),
  removeMember
);

// Update Member Role
router.put(
  '/:id/members/:userId/role',
  idValidation,
  workspaceAuth(['owner']),
  updateMemberRole
);

// Update Member Permissions
router.put(
  '/:id/members/:userId/permissions',
  idValidation,
  workspaceAuth(['owner']),
  updateMemberPermissions
);

// Transfer Ownership
router.put(
  '/:id/transfer-ownership',
  idValidation,
  workspaceAuth(['owner']),
  transferOwnership
);

/* =============================
   NESTED ROUTES
============================= */

// Projects under workspace
router.use('/:workspaceId/projects', projectRoutes);

// Milestones under workspace
router.use('/:workspaceId/milestones', milestoneRoutes);

export default router;