/* ======================================================
   src/controllers/timeEntryController.js
   Time Tracking Management - FULL UPDATED
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

  const parsedLimit = parseInt(limit);
  const parsedPage = parseInt(page);

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

  const skip = (parsedPage - 1) * parsedLimit;

  const [entries, total] = await Promise.all([
    TimeEntry.find(query)
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .populate('project', 'name icon color')
      .populate({
        path: 'task',
        select: 'title status',
        populate: { path: 'project', select: 'name color' }
      }),
    TimeEntry.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    count: entries.length,
    total,
    page: parsedPage,
    pages: Math.ceil(total / parsedLimit),
    data: entries
  });
});

/* =============================
   @desc    Start timer
   @route   POST /api/time-entries/start
   @access  Private
============================= */
export const startTimer = asyncHandler(async (req, res) => {
  const { project, task, description, workspace } = req.body;

  if (!task) throw new ErrorResponse('Task is required', 400);
  if (!workspace) throw new ErrorResponse('Workspace is required', 400);

  // Check for existing running timer (1 per user globally)
  const existingTimer = await TimeEntry.findOne({
    user: req.user._id,
    endTime: null
  });

  if (existingTimer) throw new ErrorResponse('A timer is already running. Please stop it first.', 400);

  // Verify task exists and belongs to workspace
  const taskExists = await Task.findOne({ _id: task, workspace });
  if (!taskExists) throw new ErrorResponse('Task not found in this workspace', 404);

  const timeEntry = await TimeEntry.create({
    user: req.user._id,
    workspace,
    project: taskExists.project || project,
    task,
    description: description || taskExists.title,
    startTime: new Date(),
    endTime: null,
    duration: 0
  });

  const populatedEntry = await TimeEntry.findById(timeEntry._id)
    .populate('project', 'name icon color')
    .populate({
      path: 'task',
      select: 'title status',
      populate: { path: 'project', select: 'name color' }
    })
    .lean();

  res.status(201).json({ success: true, data: populatedEntry });
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
    endTime: null
  });

  if (!timeEntry) throw new ErrorResponse('Running time entry not found', 404);

  const now = new Date();
  timeEntry.endTime = now;
  timeEntry.duration = Math.floor((now - new Date(timeEntry.startTime)) / 1000);

  await timeEntry.save();

  await timeEntry.populate('project', 'name icon color');
  await timeEntry.populate({
    path: 'task',
    select: 'title status',
    populate: { path: 'project', select: 'name color' }
  });

  res.status(200).json({ success: true, data: timeEntry });
});

/* =============================
   @desc    Stop all running timers
   @route   POST /api/time-entries/cleanup
   @access  Private
============================= */
export const stopAllTimers = asyncHandler(async (req, res) => {
  const runningTimers = await TimeEntry.find({
    user: req.user._id,
    endTime: null
  });

  const now = new Date();

  await Promise.all(
    runningTimers.map(timer => {
      timer.endTime = now;
      timer.duration = Math.floor((now - new Date(timer.startTime)) / 1000);
      return timer.save();
    })
  );

  res.status(200).json({
    success: true,
    message: `Stopped ${runningTimers.length} running timer(s)`,
    count: runningTimers.length
  });
});

/* =============================
   @desc    Create manual time entry
   @route   POST /api/time-entries
   @access  Private
============================= */
export const createTimeEntry = asyncHandler(async (req, res) => {
  const { workspace, project, task, startTime, endTime, duration, description, isBillable, hourlyRate } = req.body;

  if (!task) throw new ErrorResponse('Task is required', 400);
  if (!workspace) throw new ErrorResponse('Workspace is required', 400);
  if (!startTime || !endTime) throw new ErrorResponse('Start time and end time are required', 400);

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (end <= start) throw new ErrorResponse('End time must be after start time', 400);

  const taskExists = await Task.findOne({ _id: task, workspace });
  if (!taskExists) throw new ErrorResponse('Task not found in this workspace', 404);

  const timeEntry = await TimeEntry.create({
    user: req.user._id,
    workspace,
    project: taskExists.project || project,
    task,
    startTime: start,
    endTime: end,
    duration: duration || Math.floor((end - start) / 1000),
    description: description || taskExists.title,
    isBillable: isBillable || false,
    hourlyRate: hourlyRate || 0
  });

  await timeEntry.populate('project', 'name icon color');
  await timeEntry.populate({
    path: 'task',
    select: 'title status',
    populate: { path: 'project', select: 'name color' }
  });

  res.status(201).json({ success: true, data: timeEntry });
});

/* =============================
   @desc    Update time entry
   @route   PATCH /api/time-entries/:id
   @access  Private
============================= */
export const updateTimeEntry = asyncHandler(async (req, res) => {
  const timeEntry = await TimeEntry.findOne({ _id: req.params.id, user: req.user._id });
  if (!timeEntry) throw new ErrorResponse('Time entry not found', 404);

  const { task, description, startTime, endTime, duration, isBillable, hourlyRate } = req.body;

  if (task) {
    const taskExists = await Task.findOne({ _id: task, workspace: timeEntry.workspace });
    if (!taskExists) throw new ErrorResponse('Task not found in this workspace', 404);
    timeEntry.task = task;
  }

  if (description !== undefined) timeEntry.description = description;
  if (startTime) timeEntry.startTime = new Date(startTime);
  if (endTime) timeEntry.endTime = new Date(endTime);
  if (duration !== undefined) timeEntry.duration = duration;
  if (isBillable !== undefined) timeEntry.isBillable = isBillable;
  if (hourlyRate !== undefined) timeEntry.hourlyRate = hourlyRate;

  if (startTime || endTime) {
    const start = new Date(timeEntry.startTime);
    const end = new Date(timeEntry.endTime);
    if (end <= start) throw new ErrorResponse('End time must be after start time', 400);
    timeEntry.duration = Math.floor((end - start) / 1000);
  }

  await timeEntry.save();

  await timeEntry.populate('project', 'name icon color');
  await timeEntry.populate({
    path: 'task',
    select: 'title status',
    populate: { path: 'project', select: 'name color' }
  });

  res.status(200).json({ success: true, data: timeEntry });
});

/* =============================
   @desc    Delete time entry
   @route   DELETE /api/time-entries/:id
   @access  Private
============================= */
export const deleteTimeEntry = asyncHandler(async (req, res) => {
  const timeEntry = await TimeEntry.findOne({ _id: req.params.id, user: req.user._id });
  if (!timeEntry) throw new ErrorResponse('Time entry not found', 404);

  await timeEntry.deleteOne();

  res.status(200).json({ success: true, message: 'Time entry deleted successfully' });
});

/* =============================
   @desc    Get time entries for range (aggregated)
   @route   GET /api/time-entries/range
   @access  Private
============================= */
export const getEntriesForRange = asyncHandler(async (req, res) => {
  const { startDate, endDate, workspace, groupBy = 'daily' } = req.query;
  if (!startDate || !endDate) throw new ErrorResponse('Start date and end date are required', 400);

  const start = new Date(startDate);
  const end = new Date(endDate);


  const matchStage = {
    $match: {
      user: req.user._id,
      endTime: { $ne: null },
      startTime: { $gte: start, $lte: end }
    }
  };
  if (workspace) matchStage.$match.workspace = workspace;

  let groupId, dateLabelFormat;
  switch (groupBy) {
    case 'daily':
      groupId = { year: { $year: '$startTime' }, month: { $month: '$startTime' }, day: { $dayOfMonth: '$startTime' } };
      dateLabelFormat = { $dateToString: { format: "%Y-%m-%d", date: "$startTime" } };
      break;
    case 'weekly':
      groupId = { year: { $isoWeekYear: '$startTime' }, week: { $isoWeek: '$startTime' } };
      dateLabelFormat = { $concat: [ "W", { $toString: { $isoWeek: "$startTime" } } ] };
      break;
    case 'monthly':
      groupId = { year: { $year: '$startTime' }, month: { $month: '$startTime' } };
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

  const data = entries.map(e => ({
    label: e.label,
    totalHours: Math.round((e.totalSeconds / 3600) * 10) / 10,
    billableHours: Math.round((e.billableSeconds / 3600) * 10) / 10
  }));

  res.status(200).json({ success: true, count: data.length, data });
});

/* =============================
   @desc    Get time stats (aggregated)
   @route   GET /api/time-entries/stats
   @access  Private
============================= */
export const getTimeStats = asyncHandler(async (req, res) => {
  const { workspace, startDate, endDate } = req.query;

  const match = { user: req.user._id, endTime: { $ne: null } };
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
        totalEarnings: { $sum: { $cond: ["$isBillable", { $multiply: [{ $divide: ["$duration", 3600] }, { $ifNull: ["$hourlyRate", 0] }] }, 0] } }
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