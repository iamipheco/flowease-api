/* ======================================================
   src/controllers/taskController.js
   Complete Task Management Controller
====================================================== */
import mongoose from 'mongoose';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import Section from '../models/Section.js';
import Workspace from '../models/Workspace.js';
import Notification from '../models/Notification.js';
import { ErrorResponse } from '../middleware/error.js';
import asyncHandler from 'express-async-handler';

/* =============================
   HELPER FUNCTIONS
============================= */
// Validate ObjectId
const validateObjectId = (id, fieldName = 'ID') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ErrorResponse(`Invalid ${fieldName}`, 400);
  }
};

// Check workspace access
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
   @desc    Get tasks with filters & pagination
   @route   GET /api/tasks
   @access  Private
============================= */
export const getTasks = asyncHandler(async (req, res) => {
  const {
    workspace,
    project,
    section,
    status,
    priority,
    assignedTo,
    createdBy,
    dueDate,
    search,
    archived,
    page = 1,
    limit = 50,
    sortBy = '-createdAt'
  } = req.query;
  
  const query = {};
  
  // Filter by archived status
  if (archived !== undefined) {
    query.isArchived = archived === 'true';
  } else {
    query.isArchived = false;
  }
  
  // Filter by workspace (verify access)
  if (workspace) {
    validateObjectId(workspace, 'workspace');
    await checkWorkspaceAccess(workspace, req.user._id);
    
    // Get all projects in workspace
    const projects = await Project.find({ workspace }).select('_id');
    query.project = { $in: projects.map(p => p._id) };
  }
  
  // Filter by project (verify access)
  if (project) {
    validateObjectId(project, 'project');
    const projectDoc = await Project.findById(project);
    if (!projectDoc) {
      throw new ErrorResponse('Project not found', 404);
    }
    await checkWorkspaceAccess(projectDoc.workspace, req.user._id);
    query.project = project;
  }
  
  // Other filters
  if (section) {
    validateObjectId(section, 'section');
    query.section = section;
  }
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (assignedTo) {
    validateObjectId(assignedTo, 'assignedTo');
    query['assignedTo.user'] = assignedTo;
  }
  if (createdBy) {
    validateObjectId(createdBy, 'createdBy');
    query.createdBy = createdBy;
  }
  
  // Date filter
  if (dueDate) {
    const date = new Date(dueDate);
    if (isNaN(date.getTime())) {
      throw new ErrorResponse('Invalid date format', 400);
    }
    query.dueDate = {
      $gte: new Date(date.setHours(0, 0, 0, 0)),
      $lt: new Date(date.setHours(23, 59, 59, 999))
    };
  }
  
  // Search
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }
  
  // Pagination
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;
  
  // Fetch tasks
  const [tasks, total] = await Promise.all([
    Task.find(query)
      .sort(sortBy)
      .skip(skip)
      .limit(limitNum)
      .populate('project', 'name icon color')
      .populate('section', 'name color')
      .populate('assignedTo.user', 'name email profile.image')
      .populate('createdBy', 'name email profile.image')
      .lean(),
    Task.countDocuments(query)
  ]);
  
  res.status(200).json({
    success: true,
    count: tasks.length,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum),
    data: tasks
  });
});

/* =============================
   @desc    Get single task
   @route   GET /api/tasks/:id
   @access  Private
============================= */
export const getTask = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'task');
  
  const task = await Task.findById(req.params.id)
    .populate('project', 'name icon color workspace')
    .populate('section', 'name color type')
    .populate('assignedTo.user', 'name email profile.image profile.title')
    .populate('createdBy', 'name email profile.image')
    .populate('parentTask', 'title status')
    .populate('subtasks', 'title status progress')
    .populate('dependencies.task', 'title status')
    .populate('comments.user', 'name profile.image')
    .populate('attachments.uploadedBy', 'name');
  
  if (!task) {
    throw new ErrorResponse('Task not found', 404);
  }
  
  // Check workspace access
  if (task.project) {
    const project = await Project.findById(task.project._id);
    await checkWorkspaceAccess(project.workspace, req.user._id);
  }
  
  res.status(200).json({
    success: true,
    data: task
  });
});

/* =============================
   @desc    Create task
   @route   POST /api/tasks
   @access  Private
============================= */
export const createTask = asyncHandler(async (req, res) => {
  const { project: projectId, section: sectionId } = req.body;
  
  // Verify project and workspace access
  if (projectId) {
    validateObjectId(projectId, 'project');
    const project = await Project.findById(projectId);
    if (!project) {
      throw new ErrorResponse('Project not found', 404);
    }
    
    const { canManage } = await checkWorkspaceAccess(project.workspace, req.user._id);
    if (!canManage) {
      throw new ErrorResponse('Not authorized to create tasks in this project', 403);
    }
  }
  
  // Check section WIP limit
  if (sectionId) {
    validateObjectId(sectionId, 'section');
    const section = await Section.findById(sectionId);
    if (section) {
      const wipCheck = section.checkWipLimit();
      if (!wipCheck.allowed) {
        throw new ErrorResponse(wipCheck.message, 400);
      }
    }
  }
  
  // Create task
  const task = await Task.create({
    ...req.body,
    createdBy: req.user._id
  });
  
  // Update section counters
  if (sectionId) {
    const section = await Section.findById(sectionId);
    if (section) {
      await section.updateCounters();
    }
  }
  
  // Update project counters
  if (projectId) {
    const project = await Project.findById(projectId);
    if (project) {
      project.counters.subtasks += 1;
      await project.save({ validateBeforeSave: false });
    }
  }
  
  // Update user activity
  req.user.activity.taskCreatedCount += 1;
  await req.user.save({ validateBeforeSave: false });
  
  // Populate and return
  await task.populate([
    { path: 'project', select: 'name icon color' },
    { path: 'section', select: 'name color' },
    { path: 'createdBy', select: 'name email profile.image' }
  ]);
  
  res.status(201).json({
    success: true,
    message: 'Task created successfully',
    data: task
  });
});

/* =============================
   @desc    Update task
   @route   PUT /api/tasks/:id
   @access  Private
============================= */
export const updateTask = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'task');
  
  let task = await Task.findById(req.params.id);
  
  if (!task) {
    throw new ErrorResponse('Task not found', 404);
  }
  
  // Check workspace access
  if (task.project) {
    const project = await Project.findById(task.project);
    const { canManage } = await checkWorkspaceAccess(project.workspace, req.user._id);
    if (!canManage) {
      throw new ErrorResponse('Not authorized to update this task', 403);
    }
  }
  
  // Allowed fields
  const allowedFields = [
    'title',
    'description',
    'status',
    'priority',
    'category',
    'tags',
    'dueDate',
    'startDate',
    'reminderDate',
    'timeTracking',
    'section',
    'progress',
    'isArchived'
  ];
  
  const updates = {};
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      updates[key] = req.body[key];
    }
  });
  
  // Track section change
  const oldSection = task.section;
  const newSection = updates.section;
  
  // Update task
  task = await Task.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true }
  ).populate('project', 'name icon')
   .populate('section', 'name color')
   .populate('assignedTo.user', 'name profile.image');
  
  // Update section counters if changed
  if (oldSection && newSection && oldSection.toString() !== newSection.toString()) {
    const [oldSec, newSec] = await Promise.all([
      Section.findById(oldSection),
      Section.findById(newSection)
    ]);
    
    if (oldSec) await oldSec.updateCounters();
    if (newSec) await newSec.updateCounters();
  }
  
  res.status(200).json({
    success: true,
    message: 'Task updated successfully',
    data: task
  });
});

/* =============================
   @desc    Delete task
   @route   DELETE /api/tasks/:id
   @access  Private
============================= */
export const deleteTask = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'task');
  
  const task = await Task.findById(req.params.id);
  
  if (!task) {
    throw new ErrorResponse('Task not found', 404);
  }
  
  // Check workspace access
  if (task.project) {
    const project = await Project.findById(task.project);
    const { canManage } = await checkWorkspaceAccess(project.workspace, req.user._id);
    if (!canManage) {
      throw new ErrorResponse('Not authorized to delete this task', 403);
    }
  }
  
  await task.deleteOne();
  
  res.status(200).json({
    success: true,
    message: 'Task deleted successfully'
  });
});

/* =============================
   @desc    Assign user to task
   @route   POST /api/tasks/:id/assign
   @access  Private
============================= */
export const assignUser = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'task');
  const { userId } = req.body;
  
  if (!userId) {
    throw new ErrorResponse('User ID is required', 400);
  }
  validateObjectId(userId, 'user');
  
  const task = await Task.findById(req.params.id);
  
  if (!task) {
    throw new ErrorResponse('Task not found', 404);
  }
  
  // Check workspace access
  if (task.project) {
    const project = await Project.findById(task.project);
    await checkWorkspaceAccess(project.workspace, req.user._id);
  }
  
  await task.assignUser(userId, req.user._id);
  
  // Send notification
  await Notification.createNotification({
    userId,
    type: 'task_assigned',
    title: 'New Task Assigned',
    message: `You have been assigned to "${task.title}"`,
    actor: req.user._id,
    relatedTask: task._id,
    relatedProject: task.project,
    priority: task.priority === 'urgent' ? 'high' : 'medium'
  });
  
  await task.populate('assignedTo.user', 'name email profile.image');
  
  res.status(200).json({
    success: true,
    message: 'User assigned successfully',
    data: task
  });
});

/* =============================
   @desc    Assign multiple users (legacy support)
   @route   POST /api/tasks/:id/assign-bulk
   @access  Private
============================= */
export const assignTask = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'task');
  const { assignedTo } = req.body;
  
  if (!Array.isArray(assignedTo)) {
    throw new ErrorResponse('assignedTo must be an array of user IDs', 400);
  }
  
  const task = await Task.findById(req.params.id);
  
  if (!task) {
    throw new ErrorResponse('Task not found', 404);
  }
  
  // Check workspace access
  if (task.project) {
    const project = await Project.findById(task.project);
    await checkWorkspaceAccess(project.workspace, req.user._id);
  }
  
  // Assign each user
  for (const userId of assignedTo) {
    validateObjectId(userId, 'user');
    const existing = task.assignedTo.find(a => a.user.toString() === userId);
    if (!existing) {
      await task.assignUser(userId, req.user._id);
    }
  }
  
  await task.populate('assignedTo.user', 'name email profile.image');
  
  res.status(200).json({
    success: true,
    message: 'Task assigned successfully',
    data: task
  });
});

/* =============================
   @desc    Unassign user from task
   @route   DELETE /api/tasks/:id/assign/:userId
   @access  Private
============================= */
export const unassignUser = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'task');
  validateObjectId(req.params.userId, 'user');
  
  const task = await Task.findById(req.params.id);
  
  if (!task) {
    throw new ErrorResponse('Task not found', 404);
  }
  
  await task.unassignUser(req.params.userId);
  
  res.status(200).json({
    success: true,
    message: 'User unassigned successfully'
  });
});

/* =============================
   @desc    Accept task assignment
   @route   PUT /api/tasks/:id/accept
   @access  Private
============================= */
export const acceptAssignment = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'task');
  
  const task = await Task.findById(req.params.id);
  
  if (!task) {
    throw new ErrorResponse('Task not found', 404);
  }
  
  await task.acceptAssignment(req.user._id);
  
  res.status(200).json({
    success: true,
    message: 'Assignment accepted',
    data: task
  });
});

/* =============================
   @desc    Decline task assignment
   @route   PUT /api/tasks/:id/decline
   @access  Private
============================= */
export const declineAssignment = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'task');
  
  const task = await Task.findById(req.params.id);
  
  if (!task) {
    throw new ErrorResponse('Task not found', 404);
  }
  
  await task.declineAssignment(req.user._id);
  
  res.status(200).json({
    success: true,
    message: 'Assignment declined',
    data: task
  });
});

/* =============================
   @desc    Add comment to task
   @route   POST /api/tasks/:id/comments
   @access  Private
============================= */
export const addComment = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'task');
  const { text } = req.body;
  
  if (!text || text.trim().length === 0) {
    throw new ErrorResponse('Comment text is required', 400);
  }
  
  const task = await Task.findById(req.params.id);
  
  if (!task) {
    throw new ErrorResponse('Task not found', 404);
  }
  
  // Check workspace access
  if (task.project) {
    const project = await Project.findById(task.project);
    await checkWorkspaceAccess(project.workspace, req.user._id);
  }
  
  await task.addComment(req.user._id, text);
  await task.populate('comments.user', 'name profile.image');
  
  res.status(201).json({
    success: true,
    message: 'Comment added successfully',
    data: task
  });
});

/* =============================
   @desc    Add attachment to task
   @route   POST /api/tasks/:id/attachments
   @access  Private
============================= */
export const addAttachment = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'task');
  
  if (!req.file) {
    throw new ErrorResponse('Please upload a file', 400);
  }
  
  const task = await Task.findById(req.params.id);
  
  if (!task) {
    throw new ErrorResponse('Task not found', 404);
  }
  
  const attachment = {
    filename: req.file.originalname,
    url: req.file.path,
    fileSize: req.file.size,
    mimeType: req.file.mimetype,
    uploadedBy: req.user._id
  };
  
  await task.addAttachment(attachment);
  
  res.status(201).json({
    success: true,
    message: 'Attachment added successfully',
    data: task
  });
});

/* =============================
   @desc    Mark task as complete
   @route   PUT /api/tasks/:id/complete
   @access  Private
============================= */
export const completeTask = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'task');
  
  const task = await Task.findById(req.params.id);
  
  if (!task) {
    throw new ErrorResponse('Task not found', 404);
  }
  
  await task.markComplete(req.user._id);
  
  // Update user activity
  req.user.activity.taskCompletedCount += 1;
  await req.user.save({ validateBeforeSave: false });
  
  res.status(200).json({
    success: true,
    message: 'Task marked as complete',
    data: task
  });
});

/* =============================
   @desc    Get my tasks
   @route   GET /api/tasks/my-tasks
   @access  Private
============================= */
export const getMyTasks = asyncHandler(async (req, res) => {
  const { status, priority, dueDate } = req.query;
  
  const query = {
    'assignedTo.user': req.user._id,
    'assignedTo.status': 'accepted',
    isArchived: false
  };
  
  if (status) query.status = status;
  if (priority) query.priority = priority;
  
  if (dueDate === 'today') {
    const today = new Date();
    query.dueDate = {
      $gte: new Date(today.setHours(0, 0, 0, 0)),
      $lt: new Date(today.setHours(23, 59, 59, 999))
    };
  } else if (dueDate === 'week') {
    const today = new Date();
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    query.dueDate = {
      $gte: today,
      $lte: weekFromNow
    };
  }
  
  const tasks = await Task.find(query)
    .sort({ dueDate: 1, priority: -1 })
    .populate('project', 'name icon color')
    .populate('section', 'name color');
  
  res.status(200).json({
    success: true,
    count: tasks.length,
    data: tasks
  });
});

/* =============================
   @desc    Get task statistics
   @route   GET /api/tasks/stats
   @access  Private
============================= */
export const getTaskStats = asyncHandler(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user._id);
  
  const stats = await Task.aggregate([
    {
      $match: {
        $or: [
          { createdBy: userId },
          { 'assignedTo.user': userId }
        ]
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    total: 0,
    todo: 0,
    'in-progress': 0,
    review: 0,
    completed: 0,
    cancelled: 0
  };
  
  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });
  
  res.status(200).json({
    success: true,
    message: 'Task statistics fetched successfully',
    data: result
  });
});