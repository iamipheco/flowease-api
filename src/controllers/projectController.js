/* ======================================================
   src/controllers/projectController.js
   Complete Project Management Controller
====================================================== */
import mongoose from 'mongoose';
import Project from '../models/Project.js';
import Workspace from '../models/Workspace.js';
import Task from '../models/Task.js';
import Section from '../models/Section.js';
import Milestone from '../models/Milestone.js';
import { ErrorResponse } from '../middleware/error.js';
import asyncHandler from 'express-async-handler';

/* =============================
   HELPER FUNCTIONS
============================= */
const MAX_LIMIT = 100;

// Validate ObjectId
const validateObjectId = (id, fieldName = 'ID') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ErrorResponse(`Invalid ${fieldName}`, 400);
  }
};

// Parse pagination
const parsePagination = (page = 1, limit = 20) => {
  page = Math.max(1, parseInt(page) || 1);
  limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit) || 20));
  return { page, limit };
};

// Check workspace access and permissions
const checkWorkspaceAccess = async (workspaceId, userId) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) {
    throw new ErrorResponse('Workspace not found', 404);
  }
  
  const userRole = workspace.getMemberRole(userId);
  if (!userRole) {
    throw new ErrorResponse('Not authorized to access this workspace', 403);
  }
  
  return {
    workspace,
    role: userRole,
    isOwner: userRole === 'owner',
    isAdmin: userRole === 'admin',
    canManage: ['owner', 'admin'].includes(userRole)
  };
};

/* =============================
   @desc    Get all projects
   @route   GET /api/projects
   @route   GET /api/workspaces/:workspaceId/projects
   @access  Private
============================= */
export const getProjects = asyncHandler(async (req, res) => {
  const {
    workspace: queryWorkspace,
    status,
    priority,
    search,
    archived,
    sortBy = '-updatedAt'
  } = req.query;
  
  // Support both query param and route param for workspace
  const workspaceId = req.params.workspaceId || queryWorkspace;
  
  const query = {};
  
  // Workspace filter (required if provided)
  if (workspaceId) {
    validateObjectId(workspaceId, 'workspace');
    await checkWorkspaceAccess(workspaceId, req.user._id);
    query.workspace = workspaceId;
  }
  
  // Other filters
  if (status) query.status = status;
  if (priority) query.priority = priority;
  
  // Archived filter
  if (archived !== undefined) {
    query.isArchived = archived === 'true';
  } else {
    query.isArchived = false;
  }
  
  // Search filter
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }
  
  // Pagination
  const { page, limit } = parsePagination(req.query.page, req.query.limit);
  const skip = (page - 1) * limit;
  
  // Fetch projects
  const [projects, total] = await Promise.all([
    Project.find(query)
      .sort(sortBy)
      .skip(skip)
      .limit(limit)
      .populate('workspace', 'name slug branding')
      .populate('owner', 'name email profile.image')
      .populate('team.user', 'name profile.image')
      .lean(),
    Project.countDocuments(query)
  ]);
  
  res.status(200).json({
    success: true,
    message: 'Projects fetched successfully',
    count: projects.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: projects
  });
});

/* =============================
   @desc    Get single project
   @route   GET /api/projects/:id
   @access  Private
============================= */
export const getProject = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'project');
  
  const project = await Project.findById(req.params.id)
    .populate('workspace', 'name slug branding')
    .populate('owner', 'name email profile.image')
    .populate('team.user', 'name email profile.image profile.title');
  
  if (!project) {
    throw new ErrorResponse('Project not found', 404);
  }
  
  // Check workspace access
  await checkWorkspaceAccess(project.workspace._id, req.user._id);
  
  res.status(200).json({
    success: true,
    message: 'Project fetched successfully',
    data: project
  });
});

/* =============================
   @desc    Create project
   @route   POST /api/projects
   @route   POST /api/workspaces/:workspaceId/projects
   @access  Private
============================= */
export const createProject = asyncHandler(async (req, res) => {
  // Support both body and route param for workspace
  const workspaceId = req.params.workspaceId || req.body.workspace;
  
  if (!workspaceId) {
    throw new ErrorResponse('Workspace ID is required', 400);
  }
  
  validateObjectId(workspaceId, 'workspace');
  
  // Check workspace access and permissions
  const { workspace, canManage } = await checkWorkspaceAccess(workspaceId, req.user._id);
  
  if (!canManage) {
    throw new ErrorResponse('Not authorized to create projects in this workspace', 403);
  }
  
  // Check subscription limits
  if (!workspace.canCreateProject()) {
    throw new ErrorResponse('Project limit reached. Please upgrade your plan.', 403);
  }
  
  // Create project
  const { createDefaultSections = true, ...projectData } = req.body;
  
  const project = await Project.create({
    ...projectData,
    workspace: workspaceId,
    owner: req.user._id,
    team: [{
      user: req.user._id,
      role: 'Project Manager',
      addedBy: req.user._id,
      addedAt: new Date()
    }]
  });
  
  // Create default sections if requested
  if (createDefaultSections) {
    await Section.createDefaultSections(project._id, workspaceId, req.user._id);
  }
  
  // Update workspace stats
  workspace.stats.totalProjects += 1;
  if (project.status === 'active') {
    workspace.stats.activeProjects += 1;
  }
  await workspace.save({ validateBeforeSave: false });
  
  // Populate and return
  await project.populate([
    { path: 'workspace', select: 'name slug branding' },
    { path: 'owner', select: 'name email profile.image' },
    { path: 'team.user', select: 'name profile.image' }
  ]);
  
  res.status(201).json({
    success: true,
    message: 'Project created successfully',
    data: project
  });
});

/* =============================
   @desc    Update project
   @route   PUT /api/projects/:id
   @access  Private
============================= */
export const updateProject = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'project');
  
  let project = await Project.findById(req.params.id);
  
  if (!project) {
    throw new ErrorResponse('Project not found', 404);
  }
  
  // Check workspace access
  const { canManage } = await checkWorkspaceAccess(project.workspace, req.user._id);
  
  if (!canManage) {
    throw new ErrorResponse('Not authorized to update this project', 403);
  }
  
  // Allowed fields for update
  const allowedFields = [
    'name',
    'description',
    'status',
    'startDate',
    'endDate',
    'deadline',
    'priority',
    'progress',
    'tags',
    'settings',
    'icon',
    'color',
    'budget',
    'timeTracking',
    'isArchived'
  ];
  
  const updates = {};
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      updates[key] = req.body[key];
    }
  });
  
  // Track status change for workspace stats
  const oldStatus = project.status;
  const newStatus = updates.status;
  
  // Update project
  project = await Project.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true }
  ).populate('workspace', 'name slug')
   .populate('owner', 'name profile.image')
   .populate('team.user', 'name profile.image');
  
  // Update workspace stats if status changed
  if (oldStatus !== newStatus) {
    const workspace = await Workspace.findById(project.workspace._id);
    if (workspace) {
      if (oldStatus === 'active') workspace.stats.activeProjects -= 1;
      if (newStatus === 'active') workspace.stats.activeProjects += 1;
      await workspace.save({ validateBeforeSave: false });
    }
  }
  
  res.status(200).json({
    success: true,
    message: 'Project updated successfully',
    data: project
  });
});

/* =============================
   @desc    Delete project
   @route   DELETE /api/projects/:id
   @access  Private
============================= */
export const deleteProject = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'project');
  
  const project = await Project.findById(req.params.id);
  
  if (!project) {
    throw new ErrorResponse('Project not found', 404);
  }
  
  // Check workspace access
  const { canManage } = await checkWorkspaceAccess(project.workspace, req.user._id);
  
  if (!canManage) {
    throw new ErrorResponse('Not authorized to delete this project', 403);
  }
  
  // Update workspace stats before deletion
  const workspace = await Workspace.findById(project.workspace);
  if (workspace) {
    workspace.stats.totalProjects -= 1;
    if (project.status === 'active') {
      workspace.stats.activeProjects -= 1;
    }
    await workspace.save({ validateBeforeSave: false });
  }
  
  // Delete project (cascade deletes tasks, sections, etc.)
  await project.deleteOne();
  
  res.status(200).json({
    success: true,
    message: 'Project and related data deleted successfully'
  });
});

/* =============================
   @desc    Archive project
   @route   PUT /api/projects/:id/archive
   @access  Private
============================= */
export const archiveProject = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'project');
  
  const project = await Project.findById(req.params.id);
  
  if (!project) {
    throw new ErrorResponse('Project not found', 404);
  }
  
  // Check workspace access
  const { canManage } = await checkWorkspaceAccess(project.workspace, req.user._id);
  
  if (!canManage) {
    throw new ErrorResponse('Not authorized to archive this project', 403);
  }
  
  project.isArchived = true;
  await project.save();
  
  res.status(200).json({
    success: true,
    message: 'Project archived successfully',
    data: project
  });
});

/* =============================
   @desc    Unarchive project
   @route   PUT /api/projects/:id/unarchive
   @access  Private
============================= */
export const unarchiveProject = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'project');
  
  const project = await Project.findById(req.params.id);
  
  if (!project) {
    throw new ErrorResponse('Project not found', 404);
  }
  
  // Check workspace access
  const { canManage } = await checkWorkspaceAccess(project.workspace, req.user._id);
  
  if (!canManage) {
    throw new ErrorResponse('Not authorized to unarchive this project', 403);
  }
  
  project.isArchived = false;
  await project.save();
  
  res.status(200).json({
    success: true,
    message: 'Project unarchived successfully',
    data: project
  });
});

/* =============================
   @desc    Add team member
   @route   POST /api/projects/:id/team
   @access  Private
============================= */
export const addTeamMember = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'project');
  const { userId, role = 'Member' } = req.body;
  
  if (!userId) {
    throw new ErrorResponse('User ID is required', 400);
  }
  validateObjectId(userId, 'user');
  
  const project = await Project.findById(req.params.id);
  
  if (!project) {
    throw new ErrorResponse('Project not found', 404);
  }
  
  // Check workspace access
  const { canManage } = await checkWorkspaceAccess(project.workspace, req.user._id);
  
  if (!canManage) {
    throw new ErrorResponse('Not authorized to manage team members', 403);
  }
  
  await project.addTeamMember(userId, role, req.user._id);
  
  await project.populate('team.user', 'name email profile.image');
  
  res.status(200).json({
    success: true,
    message: 'Team member added successfully',
    data: project
  });
});

/* =============================
   @desc    Remove team member
   @route   DELETE /api/projects/:id/team/:userId
   @access  Private
============================= */
export const removeTeamMember = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'project');
  validateObjectId(req.params.userId, 'user');
  
  const project = await Project.findById(req.params.id);
  
  if (!project) {
    throw new ErrorResponse('Project not found', 404);
  }
  
  // Check workspace access
  const { canManage } = await checkWorkspaceAccess(project.workspace, req.user._id);
  
  if (!canManage) {
    throw new ErrorResponse('Not authorized to manage team members', 403);
  }
  
  await project.removeTeamMember(req.params.userId);
  
  res.status(200).json({
    success: true,
    message: 'Team member removed successfully'
  });
});

/* =============================
   @desc    Mark project complete
   @route   PUT /api/projects/:id/complete
   @access  Private
============================= */
export const completeProject = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'project');
  
  const project = await Project.findById(req.params.id);
  
  if (!project) {
    throw new ErrorResponse('Project not found', 404);
  }
  
  // Check workspace access
  const { canManage } = await checkWorkspaceAccess(project.workspace, req.user._id);
  
  if (!canManage) {
    throw new ErrorResponse('Not authorized to complete this project', 403);
  }
  
  await project.markComplete(req.user._id);
  
  res.status(200).json({
    success: true,
    message: 'Project marked as complete',
    data: project
  });
});

/* =============================
   @desc    Update project progress
   @route   PUT /api/projects/:id/progress
   @access  Private
============================= */
export const updateProgress = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'project');
  
  const project = await Project.findById(req.params.id);
  
  if (!project) {
    throw new ErrorResponse('Project not found', 404);
  }
  
  await project.updateProgress();
  
  res.status(200).json({
    success: true,
    message: 'Project progress updated',
    data: project
  });
});

/* =============================
   @desc    Get project statistics
   @route   GET /api/projects/:id/stats
   @access  Private
============================= */
export const getProjectStats = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'project');
  
  const project = await Project.findById(req.params.id);
  
  if (!project) {
    throw new ErrorResponse('Project not found', 404);
  }
  
  // Check workspace access
  await checkWorkspaceAccess(project.workspace, req.user._id);
  
  // Fetch related data
  const [tasks, sections, milestones] = await Promise.all([
    Task.find({ project: req.params.id, isArchived: false }),
    Section.find({ project: req.params.id, isArchived: false }),
    Milestone.find({ project: req.params.id, isArchived: false })
  ]);
  
  // Calculate task stats
  const taskStats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    todo: tasks.filter(t => t.status === 'todo').length,
    review: tasks.filter(t => t.status === 'review').length,
    overdue: tasks.filter(t => t.isOverdue).length
  };
  
  // Calculate milestone stats
  const milestoneStats = {
    total: milestones.length,
    completed: milestones.filter(m => m.status === 'completed').length,
    inProgress: milestones.filter(m => m.status === 'in-progress').length,
    overdue: milestones.filter(m => m.isOverdue).length
  };
  
  const stats = {
    tasks: taskStats,
    sections: {
      total: sections.length,
      withWipLimit: sections.filter(s => s.wipLimit.enabled).length
    },
    milestones: milestoneStats,
    team: {
      members: project.team.length
    },
    progress: {
      overall: project.progress,
      tasks: taskStats.total > 0 
        ? Math.round((taskStats.completed / taskStats.total) * 100) 
        : 0,
      milestones: milestoneStats.total > 0
        ? Math.round((milestoneStats.completed / milestoneStats.total) * 100)
        : 0
    },
    timeline: {
      daysRemaining: project.daysRemaining,
      duration: project.duration,
      isOverdue: project.isOverdue
    }
  };
  
  res.status(200).json({
    success: true,
    message: 'Project statistics fetched successfully',
    data: stats
  });
});

/* =============================
   @desc    Get project tasks
   @route   GET /api/projects/:id/tasks
   @access  Private
============================= */
export const getProjectTasks = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'project');
  
  const project = await Project.findById(req.params.id);
  
  if (!project) {
    throw new ErrorResponse('Project not found', 404);
  }
  
  // Check workspace access
  await checkWorkspaceAccess(project.workspace, req.user._id);
  
  const tasks = await Task.find({ 
    project: req.params.id,
    isArchived: false
  })
    .populate('createdBy', 'name email profile.image')
    .populate('assignedTo.user', 'name email profile.image')
    .populate('section', 'name color')
    .sort({ createdAt: -1 })
    .lean();
  
  res.status(200).json({
    success: true,
    message: 'Project tasks fetched successfully',
    count: tasks.length,
    data: tasks
  });
});