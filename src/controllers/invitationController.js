/* ======================================================
   src/controllers/invitationController.js
   Complete Workspace Invitation Management
====================================================== */
import mongoose from 'mongoose';
import Invitation from '../models/Invitation.js';
import Workspace from '../models/Workspace.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { ErrorResponse } from '../middleware/error.js';
import asyncHandler from 'express-async-handler';
import { sendInvitationEmail } from '../services/emailService.js';

/* =============================
   HELPER: Validate ObjectId
============================= */
const validateObjectId = (id, fieldName = 'ID') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ErrorResponse(`Invalid ${fieldName}`, 400);
  }
};

/* =============================
   @desc    Create/Send invitation
   @route   POST /api/invitations
   @access  Private (Workspace Admin/Owner)
============================= */
export const createInvitation = asyncHandler(async (req, res) => {
  const { email, workspace, role = 'member', message } = req.body;

  if (!email || !workspace) {
    throw new ErrorResponse('Email and workspace are required', 400);
  }

  validateObjectId(workspace, 'workspace');

  // Verify workspace exists
  const workspaceDoc = await Workspace.findById(workspace);
  if (!workspaceDoc) {
    throw new ErrorResponse('Workspace not found', 404);
  }

  // Check if user has permission to invite
  const userRole = workspaceDoc.getMemberRole(req.user._id);
  if (!['owner', 'admin'].includes(userRole)) {
    throw new ErrorResponse('Not authorized to send invitations', 403);
  }

  // Check workspace member limit
  if (!workspaceDoc.canAddMember()) {
    throw new ErrorResponse('Member limit reached. Please upgrade your plan.', 403);
  }

  // Check if user already exists and is already a member
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const isMember = workspaceDoc.isMember(existingUser._id);
    if (isMember) {
      throw new ErrorResponse('User is already a member of this workspace', 400);
    }
  }

  // Check for existing pending invitation
  const existingInvitation = await Invitation.findOne({
    email,
    workspace,
    status: 'pending'
  });

  if (existingInvitation) {
    throw new ErrorResponse('An invitation has already been sent to this email', 400);
  }

  // Create invitation using static method
  const invitation = await Invitation.createInvitation({
    email,
    workspace,
    invitedBy: req.user._id,
    role,
    message
  });

  // Send invitation email
  const inviteUrl = `${process.env.FRONTEND_URL}/invitations/${invitation.token}`;

  try {
    await sendInvitationEmail({
      email,
      name: email.split('@')[0], // Use email username as fallback
      workspace: workspaceDoc.name,
      inviteUrl
    });
  } catch (emailError) {
    console.error('Failed to send invitation email:', emailError);
    // Don't fail the request if email fails
  }

  await invitation.populate([
    { path: 'workspace', select: 'name slug branding' },
    { path: 'invitedBy', select: 'name email profile.image' }
  ]);

  res.status(201).json({
    success: true,
    message: 'Invitation sent successfully',
    data: invitation
  });
});

/* =============================
   @desc    Get all invitations
   @route   GET /api/invitations
   @access  Private
============================= */
export const getInvitations = asyncHandler(async (req, res) => {
  const { workspace, status, email } = req.query;

  const query = {};

  // Filter by workspace (if user is admin/owner)
  if (workspace) {
    validateObjectId(workspace, 'workspace');
    
    const workspaceDoc = await Workspace.findById(workspace);
    if (!workspaceDoc) {
      throw new ErrorResponse('Workspace not found', 404);
    }

    const userRole = workspaceDoc.getMemberRole(req.user._id);
    if (!['owner', 'admin'].includes(userRole)) {
      throw new ErrorResponse('Not authorized to view workspace invitations', 403);
    }

    query.workspace = workspace;
  } else {
    // Show user's own pending invitations
    query.email = req.user.email;
  }

  // Filter by status
  if (status) {
    query.status = status;
  } else if (!workspace) {
    // Only show pending for user's own invitations
    query.status = 'pending';
  }

  const invitations = await Invitation.find(query)
    .sort({ createdAt: -1 })
    .populate('workspace', 'name slug description branding')
    .populate('invitedBy', 'name email profile.image')
    .lean();

  res.status(200).json({
    success: true,
    count: invitations.length,
    data: invitations
  });
});

/* =============================
   @desc    Get invitation by token (public)
   @route   GET /api/invitations/token/:token
   @access  Public
============================= */
export const getInvitationByToken = asyncHandler(async (req, res) => {
  const { token } = req.params;

  if (!token) {
    throw new ErrorResponse('Invitation token is required', 400);
  }

  const invitation = await Invitation.findByToken(token);

  if (!invitation) {
    throw new ErrorResponse('Invalid or expired invitation', 404);
  }

  await invitation.populate([
    { path: 'workspace', select: 'name slug description branding' },
    { path: 'invitedBy', select: 'name email profile.image' }
  ]);

  res.status(200).json({
    success: true,
    data: invitation
  });
});

/* =============================
   @desc    Accept invitation
   @route   PUT /api/invitations/:id/accept
   @access  Private
============================= */
export const acceptInvitation = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'invitation');

  const invitation = await Invitation.findById(req.params.id)
    .populate('workspace');

  if (!invitation) {
    throw new ErrorResponse('Invitation not found', 404);
  }

  // Verify the invitation is for the current user
  if (!invitation.canAccept(req.user.email)) {
    throw new ErrorResponse('This invitation is not for your email address', 403);
  }

  // Check if workspace still exists
  if (!invitation.workspace) {
    throw new ErrorResponse('Workspace no longer exists', 404);
  }

  // Check if user is already a member
  if (invitation.workspace.isMember(req.user._id)) {
    throw new ErrorResponse('You are already a member of this workspace', 400);
  }

  // Accept invitation
  await invitation.accept(req.user._id);

  // Add user to workspace
  await invitation.workspace.addMember(
    req.user._id,
    invitation.role,
    invitation.invitedBy,
    invitation.permissions
  );

  // Add workspace to user's workspace list
  await req.user.addWorkspace(invitation.workspace._id, invitation.role, false);

  // Send notification to inviter
  await Notification.createNotification({
    userId: invitation.invitedBy,
    type: 'invitation_accepted',
    title: 'Invitation Accepted',
    message: `${req.user.name} has accepted your invitation to join ${invitation.workspace.name}`,
    actor: req.user._id,
    relatedWorkspace: invitation.workspace._id,
    category: 'workspace',
    priority: 'medium'
  });

  res.status(200).json({
    success: true,
    message: `Successfully joined ${invitation.workspace.name}`,
    data: {
      workspace: invitation.workspace,
      role: invitation.role
    }
  });
});

/* =============================
   @desc    Decline invitation
   @route   PUT /api/invitations/:id/decline
   @access  Private
============================= */
export const declineInvitation = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'invitation');
  const { reason } = req.body;

  const invitation = await Invitation.findById(req.params.id)
    .populate('workspace', 'name')
    .populate('invitedBy', 'name email');

  if (!invitation) {
    throw new ErrorResponse('Invitation not found', 404);
  }

  // Verify the invitation is for the current user
  if (!invitation.canAccept(req.user.email)) {
    throw new ErrorResponse('This invitation is not for your email address', 403);
  }

  // Decline invitation
  await invitation.decline(reason);

  // Send notification to inviter
  if (invitation.invitedBy) {
    await Notification.createNotification({
      userId: invitation.invitedBy._id,
      type: 'invitation_declined',
      title: 'Invitation Declined',
      message: `${req.user.name} has declined your invitation to join ${invitation.workspace.name}`,
      actor: req.user._id,
      relatedWorkspace: invitation.workspace._id,
      category: 'workspace',
      priority: 'low'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Invitation declined successfully'
  });
});

/* =============================
   @desc    Revoke invitation
   @route   DELETE /api/invitations/:id/revoke
   @access  Private (Workspace Admin/Owner)
============================= */
export const revokeInvitation = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'invitation');

  const invitation = await Invitation.findById(req.params.id)
    .populate('workspace');

  if (!invitation) {
    throw new ErrorResponse('Invitation not found', 404);
  }

  // Check if user has permission to revoke
  const userRole = invitation.workspace.getMemberRole(req.user._id);
  if (!['owner', 'admin'].includes(userRole)) {
    throw new ErrorResponse('Not authorized to revoke invitations', 403);
  }

  // Revoke invitation
  await invitation.revoke(req.user._id);

  res.status(200).json({
    success: true,
    message: 'Invitation revoked successfully'
  });
});

/* =============================
   @desc    Resend invitation
   @route   POST /api/invitations/:id/resend
   @access  Private (Workspace Admin/Owner)
============================= */
export const resendInvitation = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'invitation');

  const invitation = await Invitation.findById(req.params.id)
    .populate('workspace', 'name')
    .populate('invitedBy', 'name');

  if (!invitation) {
    throw new ErrorResponse('Invitation not found', 404);
  }

  // Check if user has permission to resend
  const workspace = await Workspace.findById(invitation.workspace._id);
  const userRole = workspace.getMemberRole(req.user._id);
  if (!['owner', 'admin'].includes(userRole)) {
    throw new ErrorResponse('Not authorized to resend invitations', 403);
  }

  // Send reminder
  await invitation.sendReminder();

  // Resend invitation email
  const inviteUrl = `${process.env.FRONTEND_URL}/invitations/${invitation.token}`;

  try {
    await sendInvitationEmail({
      email: invitation.email,
      name: invitation.email.split('@')[0],
      workspace: invitation.workspace.name,
      inviteUrl
    });
  } catch (emailError) {
    console.error('Failed to resend invitation email:', emailError);
    throw new ErrorResponse('Failed to send invitation email', 500);
  }

  res.status(200).json({
    success: true,
    message: 'Invitation resent successfully',
    data: invitation
  });
});

/* =============================
   @desc    Get workspace invitation stats
   @route   GET /api/invitations/stats/:workspaceId
   @access  Private (Workspace Admin/Owner)
============================= */
export const getInvitationStats = asyncHandler(async (req, res) => {
  validateObjectId(req.params.workspaceId, 'workspace');

  const workspace = await Workspace.findById(req.params.workspaceId);
  if (!workspace) {
    throw new ErrorResponse('Workspace not found', 404);
  }

  // Check permissions
  const userRole = workspace.getMemberRole(req.user._id);
  if (!['owner', 'admin'].includes(userRole)) {
    throw new ErrorResponse('Not authorized to view invitation statistics', 403);
  }

  const stats = await Invitation.getWorkspaceStats(req.params.workspaceId);

  res.status(200).json({
    success: true,
    data: stats
  });
});

/* =============================
   @desc    Get pending invitations for current user
   @route   GET /api/invitations/pending
   @access  Private
============================= */
export const getPendingInvitations = asyncHandler(async (req, res) => {
  const invitations = await Invitation.findPendingForEmail(req.user.email);

  res.status(200).json({
    success: true,
    count: invitations.length,
    data: invitations
  });
});

/* =============================
   @desc    Bulk send invitations
   @route   POST /api/invitations/bulk
   @access  Private (Workspace Admin/Owner)
============================= */
export const bulkInvite = asyncHandler(async (req, res) => {
  const { emails, workspace, role = 'member', message } = req.body;

  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    throw new ErrorResponse('Emails array is required', 400);
  }

  if (emails.length > 50) {
    throw new ErrorResponse('Maximum 50 invitations at once', 400);
  }

  validateObjectId(workspace, 'workspace');

  // Verify workspace and permissions
  const workspaceDoc = await Workspace.findById(workspace);
  if (!workspaceDoc) {
    throw new ErrorResponse('Workspace not found', 404);
  }

  const userRole = workspaceDoc.getMemberRole(req.user._id);
  if (!['owner', 'admin'].includes(userRole)) {
    throw new ErrorResponse('Not authorized to send invitations', 403);
  }

  // Bulk create invitations
  const invitations = await Invitation.bulkInvite(emails, {
    workspace,
    invitedBy: req.user._id,
    role,
    message
  });

  // Send emails (don't await to avoid timeout)
  Promise.all(
    invitations.map(invitation => {
      const inviteUrl = `${process.env.FRONTEND_URL}/invitations/${invitation.token}`;
      return sendInvitationEmail({
        email: invitation.email,
        name: invitation.email.split('@')[0],
        workspace: workspaceDoc.name,
        inviteUrl
      }).catch(err => console.error(`Failed to send email to ${invitation.email}:`, err));
    })
  );

  res.status(201).json({
    success: true,
    message: `${invitations.length} invitation(s) sent successfully`,
    count: invitations.length,
    data: invitations
  });
});