/* ======================================================
   src/controllers/timeEntryController.js
   Time Tracking Management - FIXED VERSION
====================================================== */
import TimeEntry from '../models/TimeEntry.js';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import { ErrorResponse } from '../middleware/error.js';
import asyncHandler from 'express-async-handler';

/* =============================
   @desc    Get time entries
   @route   GET /api/time-entries
   @access  Private
============================= */
export const getTimeEntries = asyncHandler(async (req, res) => {
  const {
    workspace,
    project,
    task,
    startDate,
    endDate,
    status,
    isBillable,
    page = 1,
    limit = 50
  } = req.query;
  
  const query = {
    user: req.user._id,
    isDeleted: false
  };
  
  if (workspace) query.workspace = workspace;
  if (project) query.project = project;
  if (task) query.task = task;
  if (status) query['approval.status'] = status;
  if (isBillable !== undefined) query['billing.isBillable'] = isBillable === 'true';
  
  if (startDate || endDate) {
    query.startTime = {};
    if (startDate) query.startTime.$gte = new Date(startDate);
    if (endDate) query.startTime.$lte = new Date(endDate);
  }
  
  const skip = (page - 1) * limit;
  
  const [entries, total] = await Promise.all([
    TimeEntry.find(query)
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('project', 'name icon color')
      .populate('task', 'title status')
      .populate({
        path: 'task',
        populate: {
          path: 'project',
          select: 'name color'
        }
      }),
    TimeEntry.countDocuments(query)
  ]);
  
  res.status(200).json({
    success: true,
    count: entries.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: entries
  });
});

/* =============================
   @desc    Start timer
   @route   POST /api/time-entries/start
   @access  Private
============================= */
export const startTimer = asyncHandler(async (req, res) => {
  // 🔍 LOG REQUEST
  console.log('========================================');
  console.log('[START TIMER] Request received');
  console.log('User:', req.user?.email || req.user?._id);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('========================================');
  
  // ✅ Check for existing running timer (no endTime)
  const existingTimer = await TimeEntry.findOne({
    user: req.user._id,
    endTime: null
  });
  
  if (existingTimer) {
    console.log('[START TIMER] ❌ Timer already running:', existingTimer._id);
    throw new ErrorResponse('A timer is already running. Please stop it first.', 400);
  }
  
  const { project, task, description, workspace } = req.body;
  
  // 🔍 LOG EXTRACTED FIELDS
  console.log('[START TIMER] Extracted fields:');
  console.log('  - task:', task, typeof task);
  console.log('  - workspace:', workspace, typeof workspace);
  console.log('  - description:', description, typeof description);
  console.log('  - project:', project, typeof project);
  
  // Validate required fields
  if (!task) {
    console.log('[START TIMER] ❌ Validation failed: Task is required');
    throw new ErrorResponse('Task is required', 400);
  }
  
  if (!workspace) {
    console.log('[START TIMER] ❌ Validation failed: Workspace is required');
    throw new ErrorResponse('Workspace is required', 400);
  }
  
  // Verify task exists
  console.log('[START TIMER] Checking if task exists:', task);
  const taskExists = await Task.findById(task);
  if (!taskExists) {
    console.log('[START TIMER] ❌ Task not found:', task);
    throw new ErrorResponse('Task not found', 404);
  }
  console.log('[START TIMER] ✅ Task found:', taskExists.title);
  
  // ✅ Create with startTime, no endTime (running timer)
  console.log('[START TIMER] Creating time entry...');
  const timeEntry = await TimeEntry.create({
    user: req.user._id,
    workspace,
    project: taskExists.project || project,
    task,
    description: description || taskExists.title,
    startTime: new Date(),
    endTime: null, // Running timer has no endTime
    duration: 0
  });
  
  console.log('[START TIMER] ✅ Time entry created:', timeEntry._id);
  
  // Populate for response - use await and check result
  const populatedEntry = await TimeEntry.findById(timeEntry._id)
    .populate('project', 'name icon color')
    .populate({
      path: 'task',
      select: 'title status',
      populate: {
        path: 'project',
        select: 'name color'
      }
    })
    .lean();
  
  console.log('[START TIMER] Populated entry:', {
    id: populatedEntry._id,
    task: populatedEntry.task?.title || 'NULL',
    startTime: populatedEntry.startTime,
    hasTask: !!populatedEntry.task
  });
  
  if (!populatedEntry.task) {
    console.error('[START TIMER] ⚠️ WARNING: Task not populated!');
  }
  
  console.log('[START TIMER] ✅ Success! Sending response');
  res.status(201).json({
    success: true,
    data: populatedEntry
  });
});

/* =============================
   @desc    Stop timer
   @route   POST /api/time-entries/:id/stop
   @access  Private
============================= */
export const stopTimer = asyncHandler(async (req, res) => {
  const timeEntry = await TimeEntry.findOne({
    _id: req.params.id,
    user: req.user._id,
    endTime: null // Only stop running timers
  });
  
  if (!timeEntry) {
    throw new ErrorResponse('Running time entry not found', 404);
  }
  
  // ✅ Set endTime and calculate duration
  const now = new Date();
  const startTime = new Date(timeEntry.startTime);
  const durationInSeconds = Math.floor((now - startTime) / 1000);
  
  timeEntry.endTime = now;
  timeEntry.duration = durationInSeconds;
  
  await timeEntry.save();
  
  // Populate for response
  await timeEntry.populate('project', 'name icon color');
  await timeEntry.populate({
    path: 'task',
    select: 'title status',
    populate: {
      path: 'project',
      select: 'name color'
    }
  });
  
  res.status(200).json({
    success: true,
    data: timeEntry
  });
});

/* =============================
   @desc    Create manual time entry
   @route   POST /api/time-entries
   @access  Private
============================= */
export const createTimeEntry = asyncHandler(async (req, res) => {
  const {
    workspace,
    project,
    task,
    startTime,
    endTime,
    duration,
    description,
    isBillable,
    hourlyRate
  } = req.body;
  
  // ✅ Validate required fields
  if (!task) {
    throw new ErrorResponse('Task is required', 400);
  }
  
  if (!workspace) {
    throw new ErrorResponse('Workspace is required', 400);
  }
  
  if (!startTime || !endTime) {
    throw new ErrorResponse('Start time and end time are required', 400);
  }
  
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  // ✅ Validate times
  if (end <= start) {
    throw new ErrorResponse('End time must be after start time', 400);
  }
  
  // ✅ Calculate duration if not provided
  const calculatedDuration = duration || Math.floor((end - start) / 1000);
  
  // Verify task exists
  const taskExists = await Task.findById(task);
  if (!taskExists) {
    throw new ErrorResponse('Task not found', 404);
  }
  
  // ✅ Create manual entry with all fields
  const timeEntry = await TimeEntry.create({
    user: req.user._id,
    workspace,
    project: taskExists.project || project,
    task,
    startTime: start,
    endTime: end,
    duration: calculatedDuration,
    description: description || taskExists.title,
    isBillable: isBillable || false,
    hourlyRate: hourlyRate || 0
  });
  
  // Populate for response
  await timeEntry.populate('project', 'name icon color');
  await timeEntry.populate({
    path: 'task',
    select: 'title status',
    populate: {
      path: 'project',
      select: 'name color'
    }
  });
  
  res.status(201).json({
    success: true,
    data: timeEntry
  });
});

/* =============================
   @desc    Update time entry
   @route   PATCH /api/time-entries/:id
   @access  Private
============================= */
export const updateTimeEntry = asyncHandler(async (req, res) => {
  let timeEntry = await TimeEntry.findOne({
    _id: req.params.id,
    user: req.user._id
  });
  
  if (!timeEntry) {
    throw new ErrorResponse('Time entry not found', 404);
  }
  
  const {
    task,
    description,
    startTime,
    endTime,
    duration,
    isBillable,
    hourlyRate
  } = req.body;
  
  // ✅ Update fields
  if (task) timeEntry.task = task;
  if (description !== undefined) timeEntry.description = description;
  if (startTime) timeEntry.startTime = new Date(startTime);
  if (endTime) timeEntry.endTime = new Date(endTime);
  if (duration !== undefined) timeEntry.duration = duration;
  if (isBillable !== undefined) timeEntry.isBillable = isBillable;
  if (hourlyRate !== undefined) timeEntry.hourlyRate = hourlyRate;
  
  // ✅ Recalculate duration if times changed
  if (startTime || endTime) {
    const start = new Date(timeEntry.startTime);
    const end = new Date(timeEntry.endTime);
    
    if (end <= start) {
      throw new ErrorResponse('End time must be after start time', 400);
    }
    
    timeEntry.duration = Math.floor((end - start) / 1000);
  }
  
  await timeEntry.save();
  
  // Populate for response
  await timeEntry.populate('project', 'name icon color');
  await timeEntry.populate({
    path: 'task',
    select: 'title status',
    populate: {
      path: 'project',
      select: 'name color'
    }
  });
  
  res.status(200).json({
    success: true,
    data: timeEntry
  });
});

/* =============================
   @desc    Delete time entry
   @route   DELETE /api/time-entries/:id
   @access  Private
============================= */
export const deleteTimeEntry = asyncHandler(async (req, res) => {
  const timeEntry = await TimeEntry.findOne({
    _id: req.params.id,
    user: req.user._id
  });
  
  if (!timeEntry) {
    throw new ErrorResponse('Time entry not found', 404);
  }
  
  await timeEntry.deleteOne();
  
  res.status(200).json({
    success: true,
    message: 'Time entry deleted successfully'
  });
});


/* =============================
   @desc    Stop all running timers (cleanup)
   @route   POST /api/time-entries/cleanup
   @access  Private
============================= */
export const stopAllTimers = asyncHandler(async (req, res) => {
  const runningTimers = await TimeEntry.find({
    user: req.user._id,
    endTime: null
  });
  
  const now = new Date();
  
  for (const timer of runningTimers) {
    const startTime = new Date(timer.startTime);
    const duration = Math.floor((now - startTime) / 1000);
    
    timer.endTime = now;
    timer.duration = duration;
    await timer.save();
  }
  
  res.status(200).json({
    success: true,
    message: `Stopped ${runningTimers.length} running timer(s)`,
    count: runningTimers.length
  });
});

/* =============================
   @desc    Get time entries for range (aggregated)
   @route   GET /api/time-entries/range
   @access  Private
============================= */
export const getEntriesForRange = asyncHandler(async (req, res) => {
  const { startDate, endDate, workspace, groupBy = 'daily' } = req.query;

  if (!startDate || !endDate) {
    throw new ErrorResponse('Start date and end date are required', 400);
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  const matchStage = {
    $match: {
      user: req.user._id,
      endTime: { $ne: null },
      startTime: { $gte: start, $lte: end }
    }
  };

  if (workspace) {
    matchStage.$match.workspace = workspace;
  }

  // Grouping formats
  let groupId;
  let dateLabelFormat;

  switch (groupBy) {
    case 'daily':
      groupId = {
        year: { $year: '$startTime' },
        month: { $month: '$startTime' },
        day: { $dayOfMonth: '$startTime' },
      };
      dateLabelFormat = { $dateToString: { format: "%Y-%m-%d", date: "$startTime" } };
      break;
    case 'weekly':
      groupId = {
        year: { $isoWeekYear: '$startTime' },
        week: { $isoWeek: '$startTime' },
      };
      dateLabelFormat = { $concat: [ "W", { $toString: { $isoWeek: "$startTime" } } ] };
      break;
    case 'monthly':
      groupId = {
        year: { $year: '$startTime' },
        month: { $month: '$startTime' },
      };
      dateLabelFormat = { $dateToString: { format: "%Y-%m", date: "$startTime" } };
      break;
    default:
      throw new ErrorResponse('Invalid groupBy value. Must be daily, weekly, or monthly.', 400);
  }

  const aggregationPipeline = [
    matchStage,
    {
      $group: {
        _id: groupId,
        label: { $first: dateLabelFormat },
        totalSeconds: { $sum: "$duration" },
        billableSeconds: { $sum: { $cond: ["$isBillable", "$duration", 0] } },
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.week": 1, "_id.day": 1 } }
  ];

  const entries = await TimeEntry.aggregate(aggregationPipeline);

  // Convert seconds to hours/minutes as needed
  const data = entries.map(e => ({
    label: e.label,
    totalHours: Math.round((e.totalSeconds / 3600) * 10) / 10,
    billableHours: Math.round((e.billableSeconds / 3600) * 10) / 10,
  }));

  res.status(200).json({
    success: true,
    count: data.length,
    data
  });
});

/* =============================
   @desc    Get time stats (aggregated)
   @route   GET /api/time-entries/stats
   @access  Private
============================= */
export const getTimeStats = asyncHandler(async (req, res) => {
  const { workspace, startDate, endDate } = req.query;

  const match = {
    user: req.user._id,
    endTime: { $ne: null },
  };
  if (workspace) match.workspace = workspace;
  if (startDate || endDate) {
    match.startTime = {};
    if (startDate) match.startTime.$gte = new Date(startDate);
    if (endDate) match.startTime.$lte = new Date(endDate);
  }

  const aggregationPipeline = [
    { $match: match },
    {
      $group: {
        _id: null,
        totalSeconds: { $sum: "$duration" },
        billableSeconds: { $sum: { $cond: ["$isBillable", "$duration", 0] } },
        totalEntries: { $sum: 1 },
        totalEarnings: { 
          $sum: { 
            $cond: ["$isBillable", { $multiply: [{ $divide: ["$duration", 3600] }, { $ifNull: ["$hourlyRate", 0] }] }, 0] 
          }
        }
      }
    }
  ];

  const [stats] = await TimeEntry.aggregate(aggregationPipeline);

  const start = startDate ? new Date(startDate) : new Date();
  const end = endDate ? new Date(endDate) : new Date();
  const diffDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));

  res.status(200).json({
    success: true,
    data: {
      totalHours: Math.round((stats?.totalSeconds || 0) / 3600 * 10) / 10,
      billableHours: Math.round((stats?.billableSeconds || 0) / 3600 * 10) / 10,
      nonBillableHours: Math.round(((stats?.totalSeconds || 0) - (stats?.billableSeconds || 0)) / 3600 * 10) / 10,
      totalEntries: stats?.totalEntries || 0,
      totalEarnings: Math.round((stats?.totalEarnings || 0) * 100) / 100,
      averageHoursPerDay: Math.round(((stats?.totalSeconds || 0) / 3600 / diffDays) * 10) / 10
    }
  });
});