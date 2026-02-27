/* ======================================================
   src/routes/invitationRoutes.js
   Complete Workspace Invitation Routes
====================================================== */
import express from 'express';
import {
  createInvitation,
  getInvitations,
  getInvitationByToken,
  acceptInvitation,
  declineInvitation,
  revokeInvitation,
  resendInvitation,
  getInvitationStats,
  getPendingInvitations,
  bulkInvite,
} from '../controllers/invitationController.js';
import { protect } from '../middleware/auth.js';
import { invitationValidation, idValidation, workspaceIdValidation } from '../middleware/validation.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

/* =============================
   PUBLIC ROUTES
============================= */

// Get Invitation by Token (public - for accepting invites)
router.get('/token/:token', getInvitationByToken);

/* =============================
   PROTECTED ROUTES
============================= */
router.use(protect);

/* =============================
   USER'S PENDING INVITATIONS
============================= */

// Get user's pending invitations
router.get('/pending', getPendingInvitations);

/* =============================
   INVITATION MANAGEMENT
============================= */

// List & Create Invitations
router
  .route('/')
  .get(getInvitations)
  .post(
    authLimiter,
    invitationValidation.create,
    createInvitation
  );

// Bulk Send Invitations
router.post(
  '/bulk',
  authLimiter,
  bulkInvite
);

/* =============================
   WORKSPACE INVITATION STATS
============================= */

// Get invitation statistics for workspace
router.get('/stats/:workspaceId', workspaceIdValidation, getInvitationStats);

/* =============================
   INVITATION ACTIONS
============================= */

// Accept Invitation
router.put('/:id/accept', idValidation, acceptInvitation);

// Decline Invitation
router.put('/:id/decline', idValidation, declineInvitation);

// Revoke Invitation (Admin/Owner only)
router.delete('/:id/revoke', idValidation, revokeInvitation);

// Resend Invitation (Admin/Owner only)
router.post('/:id/resend', idValidation, authLimiter, resendInvitation);

export default router;