/* ======================================================
   src/controllers/milestoneController.js
   Enhanced Milestone & Goal Tracking Management
====================================================== */
import mongoose from 'mongoose';
import Milestone from '../models/Milestone.js';
import Project from '../models/Project.js';
import Workspace from '../models/Workspace.js';
import Notification from '../models/Notification.js';
import { ErrorResponse } from '../middleware/error.js';
import asyncHandler from 'express-async-handler';

/* =============================
   HELPER: Validate ObjectId
============================= */
const validateObjectId = (id, fieldName = 'ID') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ErrorResponse(`Invalid ${fieldName}`, 400);
  }
};

/* =============================
   @desc    Get milestones
   @route   GET /api/milestones
   @access  Private
============================= */
export const getMilestones = asyncHandler(async (req, res) => {
  const {
    workspace,
    project,
    status,
    priority,
    type,
    includeArchived,
    page = 1,
    limit = 50
  } = req.query;
  
  const query = {};
  
  // Handle archived filter
  if (includeArchived === 'true') {
    // Include both archived and non-archived
  } else {
    query.isArchived = false;
  }
  
  if (workspace) {
    validateObjectId(workspace, 'workspace');
    query.workspace = workspace;
  }
  
  if (project) {
    validateObjectId(project, 'project');
    query.project = project;
  }
  
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (type) query.type = type;
  
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;
  
  const [milestones, total] = await Promise.all([
    Milestone.find(query)
      .sort({ dueDate: 1 })
      .skip(skip)
      .limit(limitNum)
      .populate('project', 'name icon color')
      .populate('owner', 'name email profile.image')
      .populate('team.user', 'name profile.image')
      .populate('createdBy', 'name')
      .lean(),
    Milestone.countDocuments(query)
  ]);
  
  res.status(200).json({
    success: true,
    count: milestones.length,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
    data: milestones
  });
});

/* =============================
   @desc    Get single milestone
   @route   GET /api/milestones/:id
   @access  Private
============================= */
export const getMilestone = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'milestone');
  
  const milestone = await Milestone.findById(req.params.id)
    .populate('project', 'name icon color workspace')
    .populate('owner', 'name email profile.image')
    .populate('team.user', 'name email profile.image')
    .populate('tasks', 'title status priority progress')
    .populate('dependencies.milestone', 'title status progress dueDate')
    .populate('createdBy', 'name email')
    .populate('updates.user', 'name profile.image');
  
  if (!milestone) {
    throw new ErrorResponse('Milestone not found', 404);
  }
  
  res.status(200).json({
    success: true,
    data: milestone
  });
});

/* =============================
   @desc    Create milestone
   @route   POST /api/milestones
   @access  Private
============================= */
export const createMilestone = asyncHandler(async (req, res) => {
  const { project: projectId } = req.body;
  
  if (!projectId) {
    throw new ErrorResponse('Project ID is required', 400);
  }
  
  validateObjectId(projectId, 'project');
  
  // Verify project exists
  const project = await Project.findById(projectId);
  if (!project) {
    throw new ErrorResponse('Project not found', 404);
  }
  
  // Check workspace access
  const workspace = await Workspace.findById(project.workspace);
  if (!workspace) {
    throw new ErrorResponse('Workspace not found', 404);
  }
  
  const userRole = workspace.getMemberRole(req.user._id);
  if (!userRole) {
    throw new ErrorResponse('Not authorized to create milestones in this workspace', 403);
  }
  
  const milestone = await Milestone.create({
    ...req.body,
    workspace: project.workspace,
    createdBy: req.user._id,
    owner: req.body.owner || req.user._id
  });
  
  await milestone.populate([
    { path: 'project', select: 'name icon color' },
    { path: 'owner', select: 'name email profile.image' }
  ]);
  
  res.status(201).json({
    success: true,
    message: 'Milestone created successfully',
    data: milestone
  });
});

/* =============================
   @desc    Update milestone
   @route   PUT /api/milestones/:id
   @access  Private
============================= */
export const updateMilestone = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'milestone');
  
  let milestone = await Milestone.findById(req.params.id);
  
  if (!milestone) {
    throw new ErrorResponse('Milestone not found', 404);
  }
  
  const allowedFields = [
    'title',
    'description',
    'startDate',
    'dueDate',
    'type',
    'priority',
    'status',
    'progress',
    'color',
    'icon',
    'tags',
    'budget',
    'timeTracking',
    'recurrence'
  ];
  
  const updates = {};
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      updates[key] = req.body[key];
    }
  });
  
  updates.lastModifiedBy = req.user._id;
  
  milestone = await Milestone.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true }
  ).populate('project', 'name icon color')
   .populate('owner', 'name profile.image');
  
  res.status(200).json({
    success: true,
    message: 'Milestone updated successfully',
    data: milestone
  });
});

/* =============================
   @desc    Delete milestone
   @route   DELETE /api/milestones/:id
   @access  Private
============================= */
export const deleteMilestone = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'milestone');
  
  const milestone = await Milestone.findById(req.params.id);
  
  if (!milestone) {
    throw new ErrorResponse('Milestone not found', 404);
  }
  
  await milestone.deleteOne();
  
  res.status(200).json({
    success: true,
    message: 'Milestone deleted successfully'
  });
});

/* =============================
   @desc    Complete milestone
   @route   PUT /api/milestones/:id/complete
   @access  Private
============================= */
export const completeMilestone = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'milestone');
  
  const milestone = await Milestone.findById(req.params.id);
  
  if (!milestone) {
    throw new ErrorResponse('Milestone not found', 404);
  }
  
  if (!milestone.canComplete) {
    throw new ErrorResponse('All success criteria must be met before completing', 400);
  }
  
  await milestone.complete(req.user._id);
  
  res.status(200).json({
    success: true,
    message: 'Milestone completed successfully',
    data: milestone
  });
});

/* =============================
   @desc    Update milestone progress
   @route   PUT /api/milestones/:id/progress
   @access  Private
============================= */
export const updateProgress = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'milestone');
  
  const milestone = await Milestone.findById(req.params.id);
  
  if (!milestone) {
    throw new ErrorResponse('Milestone not found', 404);
  }
  
  await milestone.updateProgress();
  
  res.status(200).json({
    success: true,
    message: 'Progress updated successfully',
    data: milestone
  });
});

/* =============================
   @desc    Add team member
   @route   POST /api/milestones/:id/team
   @access  Private
============================= */
export const addTeamMember = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'milestone');
  const { userId, role } = req.body;
  
  if (!userId) {
    throw new ErrorResponse('User ID is required', 400);
  }
  
  validateObjectId(userId, 'user');
  
  const milestone = await Milestone.findById(req.params.id);
  
  if (!milestone) {
    throw new ErrorResponse('Milestone not found', 404);
  }
  
  await milestone.addTeamMember(userId, role);
  
  await milestone.populate('team.user', 'name email profile.image');
  
  res.status(200).json({
    success: true,
    message: 'Team member added successfully',
    data: milestone
  });
});

/* =============================
   @desc    Remove team member
   @route   DELETE /api/milestones/:id/team/:userId
   @access  Private
============================= */
export const removeTeamMember = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'milestone');
  validateObjectId(req.params.userId, 'user');
  
  const milestone = await Milestone.findById(req.params.id);
  
  if (!milestone) {
    throw new ErrorResponse('Milestone not found', 404);
  }
  
  await milestone.removeTeamMember(req.params.userId);
  
  res.status(200).json({
    success: true,
    message: 'Team member removed successfully'
  });
});

/* =============================
   @desc    Add checklist item
   @route   POST /api/milestones/:id/checklist
   @access  Private
============================= */
export const addChecklistItem = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'milestone');
  const { title } = req.body;
  
  if (!title || title.trim().length === 0) {
    throw new ErrorResponse('Checklist item title is required', 400);
  }
  
  const milestone = await Milestone.findById(req.params.id);
  
  if (!milestone) {
    throw new ErrorResponse('Milestone not found', 404);
  }
  
  await milestone.addChecklistItem(title);
  
  res.status(201).json({
    success: true,
    message: 'Checklist item added successfully',
    data: milestone
  });
});

/* =============================
   @desc    Complete checklist item
   @route   PUT /api/milestones/:id/checklist/:itemId/complete
   @access  Private
============================= */
export const completeChecklistItem = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'milestone');
  const { itemId } = req.params;
  
  const milestone = await Milestone.findById(req.params.id);
  
  if (!milestone) {
    throw new ErrorResponse('Milestone not found', 404);
  }
  
  await milestone.completeChecklistItem(itemId, req.user._id);
  
  res.status(200).json({
    success: true,
    message: 'Checklist item completed',
    data: milestone
  });
});

/* =============================
   @desc    Add success criterion
   @route   POST /api/milestones/:id/criteria
   @access  Private
============================= */
export const addSuccessCriterion = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'milestone');
  const { criterion } = req.body;
  
  if (!criterion || criterion.trim().length === 0) {
    throw new ErrorResponse('Success criterion is required', 400);
  }
  
  const milestone = await Milestone.findById(req.params.id);
  
  if (!milestone) {
    throw new ErrorResponse('Milestone not found', 404);
  }
  
  milestone.successCriteria.push({ criterion, isMet: false });
  await milestone.save();
  
  res.status(201).json({
    success: true,
    message: 'Success criterion added',
    data: milestone
  });
});

/* =============================
   @desc    Mark success criterion as met
   @route   PUT /api/milestones/:id/criteria/:criterionId/met
   @access  Private
============================= */
export const markCriterionMet = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'milestone');
  const { criterionId } = req.params;
  
  const milestone = await Milestone.findById(req.params.id);
  
  if (!milestone) {
    throw new ErrorResponse('Milestone not found', 404);
  }
  
  await milestone.markCriterionMet(criterionId, req.user._id);
  
  res.status(200).json({
    success: true,
    message: 'Success criterion marked as met',
    data: milestone
  });
});

/* =============================
   @desc    Add update/note
   @route   POST /api/milestones/:id/updates
   @access  Private
============================= */
export const addUpdate = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'milestone');
  const { message } = req.body;
  
  if (!message || message.trim().length === 0) {
    throw new ErrorResponse('Update message is required', 400);
  }
  
  const milestone = await Milestone.findById(req.params.id);
  
  if (!milestone) {
    throw new ErrorResponse('Milestone not found', 404);
  }
  
  await milestone.addUpdate(req.user._id, message);
  
  await milestone.populate('updates.user', 'name profile.image');
  
  res.status(201).json({
    success: true,
    message: 'Update added successfully',
    data: milestone
  });
});

/* =============================
   @desc    Archive milestone
   @route   PUT /api/milestones/:id/archive
   @access  Private
============================= */
export const archiveMilestone = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'milestone');
  
  const milestone = await Milestone.findById(req.params.id);
  
  if (!milestone) {
    throw new ErrorResponse('Milestone not found', 404);
  }
  
  await milestone.archive(req.user._id);
  
  res.status(200).json({
    success: true,
    message: 'Milestone archived successfully'
  });
});

/* =============================
   @desc    Get project milestones
   @route   GET /api/projects/:projectId/milestones
   @access  Private
============================= */
export const getProjectMilestones = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { includeArchived } = req.query;
  
  validateObjectId(projectId, 'project');
  
  const milestones = await Milestone.getProjectMilestones(
    projectId,
    includeArchived === 'true'
  );
  
  res.status(200).json({
    success: true,
    count: milestones.length,
    data: milestones
  });
});

/* =============================
   @desc    Get upcoming milestones
   @route   GET /api/workspaces/:workspaceId/milestones/upcoming
   @access  Private
============================= */
export const getUpcomingMilestones = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { days = 30 } = req.query;
  
  validateObjectId(workspaceId, 'workspace');
  
  const milestones = await Milestone.getUpcoming(workspaceId, parseInt(days));
  
  res.status(200).json({
    success: true,
    count: milestones.length,
    data: milestones
  });
});

/* =============================
   @desc    Get overdue milestones
   @route   GET /api/workspaces/:workspaceId/milestones/overdue
   @access  Private
============================= */
export const getOverdueMilestones = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  
  validateObjectId(workspaceId, 'workspace');
  
  const milestones = await Milestone.getOverdue(workspaceId);
  
  res.status(200).json({
    success: true,
    count: milestones.length,
    data: milestones
  });
});

/* =============================
   @desc    Get workspace milestone statistics
   @route   GET /api/workspaces/:workspaceId/milestones/stats
   @access  Private
============================= */
export const getMilestoneStats = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  
  validateObjectId(workspaceId, 'workspace');
  
  const stats = await Milestone.getWorkspaceStats(workspaceId);
  
  res.status(200).json({
    success: true,
    data: stats
  });
});
