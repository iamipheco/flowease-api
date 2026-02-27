/* ======================================================
   src/controllers/sectionController.js
   Kanban Board Section Management
====================================================== */
import Section from '../models/Section.js';
import Project from '../models/Project.js';
import { ErrorResponse } from '../middleware/error.js';
import asyncHandler from 'express-async-handler';

/* =============================
   @desc    Get project sections
   @route   GET /api/projects/:projectId/sections
   @access  Private
============================= */
export const getSections = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { includeArchived } = req.query;
  
  const sections = await Section.getProjectSections(
    projectId,
    includeArchived === 'true'
  );
  
  res.status(200).json({
    success: true,
    count: sections.length,
    data: sections
  });
});

/* =============================
   @desc    Get single section with stats
   @route   GET /api/sections/:id
   @access  Private
============================= */
export const getSection = asyncHandler(async (req, res) => {
  const section = await Section.getSectionWithStats(req.params.id);
  
  if (!section) {
    throw new ErrorResponse('Section not found', 404);
  }
  
  res.status(200).json({
    success: true,
    data: section
  });
});

/* =============================
   @desc    Create section
   @route   POST /api/projects/:projectId/sections
   @access  Private
============================= */
export const createSection = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  
  // Verify project exists
  const project = await Project.findById(projectId);
  if (!project) {
    throw new ErrorResponse('Project not found', 404);
  }
  
  const section = await Section.create({
    ...req.body,
    project: projectId,
    workspace: project.workspace,
    createdBy: req.user._id
  });
  
  res.status(201).json({
    success: true,
    data: section
  });
});

/* =============================
   @desc    Update section
   @route   PUT /api/sections/:id
   @access  Private
============================= */
export const updateSection = asyncHandler(async (req, res) => {
  let section = await Section.findById(req.params.id);
  
  if (!section) {
    throw new ErrorResponse('Section not found', 404);
  }
  
  const allowedFields = [
    'name',
    'description',
    'color',
    'icon',
    'type',
    'wipLimit',
    'settings'
  ];
  
  const updates = {};
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      updates[key] = req.body[key];
    }
  });
  
  updates.lastModifiedBy = req.user._id;
  
  section = await Section.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true }
  );
  
  res.status(200).json({
    success: true,
    data: section
  });
});

/* =============================
   @desc    Reorder sections
   @route   PUT /api/projects/:projectId/sections/reorder
   @access  Private
============================= */
export const reorderSections = asyncHandler(async (req, res) => {
  const { sectionIds } = req.body;
  
  if (!Array.isArray(sectionIds)) {
    throw new ErrorResponse('sectionIds must be an array', 400);
  }
  
  await Section.reorder(sectionIds);
  
  res.status(200).json({
    success: true,
    message: 'Sections reordered successfully'
  });
});

/* =============================
   @desc    Move section to position
   @route   PUT /api/sections/:id/move
   @access  Private
============================= */
export const moveSection = asyncHandler(async (req, res) => {
  const { position } = req.body;
  
  if (typeof position !== 'number') {
    throw new ErrorResponse('Position must be a number', 400);
  }
  
  const section = await Section.findById(req.params.id);
  
  if (!section) {
    throw new ErrorResponse('Section not found', 404);
  }
  
  await section.moveTo(position);
  
  res.status(200).json({
    success: true,
    data: section
  });
});

/* =============================
   @desc    Duplicate section
   @route   POST /api/sections/:id/duplicate
   @access  Private
============================= */
export const duplicateSection = asyncHandler(async (req, res) => {
  const section = await Section.findById(req.params.id);
  
  if (!section) {
    throw new ErrorResponse('Section not found', 404);
  }
  
  const { name } = req.body;
  const duplicate = await section.duplicate(req.user._id, name);
  
  res.status(201).json({
    success: true,
    data: duplicate
  });
});

/* =============================
   @desc    Archive section
   @route   PUT /api/sections/:id/archive
   @access  Private
============================= */
export const archiveSection = asyncHandler(async (req, res) => {
  const section = await Section.findById(req.params.id);
  
  if (!section) {
    throw new ErrorResponse('Section not found', 404);
  }
  
  await section.archive(req.user._id);
  
  res.status(200).json({
    success: true,
    message: 'Section archived successfully'
  });
});

/* =============================
   @desc    Unarchive section
   @route   PUT /api/sections/:id/unarchive
   @access  Private
============================= */
export const unarchiveSection = asyncHandler(async (req, res) => {
  const section = await Section.findById(req.params.id);
  
  if (!section) {
    throw new ErrorResponse('Section not found', 404);
  }
  
  await section.unarchive();
  
  res.status(200).json({
    success: true,
    message: 'Section unarchived successfully'
  });
});

/* =============================
   @desc    Delete section
   @route   DELETE /api/sections/:id
   @access  Private
============================= */
export const deleteSection = asyncHandler(async (req, res) => {
  const section = await Section.findById(req.params.id);
  
  if (!section) {
    throw new ErrorResponse('Section not found', 404);
  }
  
  await section.deleteOne();
  
  res.status(200).json({
    success: true,
    message: 'Section deleted successfully'
  });
});

/* =============================
   @desc    Add automation to section
   @route   POST /api/sections/:id/automations
   @access  Private
============================= */
export const addAutomation = asyncHandler(async (req, res) => {
  const section = await Section.findById(req.params.id);
  
  if (!section) {
    throw new ErrorResponse('Section not found', 404);
  }
  
  await section.addAutomation(req.body);
  
  res.status(201).json({
    success: true,
    data: section
  });
});

/* =============================
   @desc    Toggle automation
   @route   PUT /api/sections/:id/automations/:automationId/toggle
   @access  Private
============================= */
export const toggleAutomation = asyncHandler(async (req, res) => {
  const { id, automationId } = req.params;
  
  const section = await Section.findById(id);
  
  if (!section) {
    throw new ErrorResponse('Section not found', 404);
  }
  
  await section.toggleAutomation(automationId);
  
  res.status(200).json({
    success: true,
    data: section
  });
});

/* =============================
   @desc    Remove automation
   @route   DELETE /api/sections/:id/automations/:automationId
   @access  Private
============================= */
export const removeAutomation = asyncHandler(async (req, res) => {
  const { id, automationId } = req.params;
  
  const section = await Section.findById(id);
  
  if (!section) {
    throw new ErrorResponse('Section not found', 404);
  }
  
  await section.removeAutomation(automationId);
  
  res.status(200).json({
    success: true,
    message: 'Automation removed successfully'
  });
});

/* =============================
   @desc    Move tasks between sections
   @route   POST /api/sections/move-tasks
   @access  Private
============================= */
export const moveTasks = asyncHandler(async (req, res) => {
  const { fromSectionId, toSectionId, taskIds } = req.body;
  
  if (!fromSectionId || !toSectionId) {
    throw new ErrorResponse('Both fromSectionId and toSectionId are required', 400);
  }
  
  const result = await Section.moveTasks(fromSectionId, toSectionId, taskIds);
  
  res.status(200).json({
    success: true,
    message: 'Tasks moved successfully',
    data: result
  });
});

/* =============================
   @desc    Create default sections for project
   @route   POST /api/projects/:projectId/sections/defaults
   @access  Private
============================= */
export const createDefaultSections = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  
  const project = await Project.findById(projectId);
  if (!project) {
    throw new ErrorResponse('Project not found', 404);
  }
  
  const sections = await Section.createDefaultSections(
    projectId,
    project.workspace,
    req.user._id
  );
  
  res.status(201).json({
    success: true,
    count: sections.length,
    data: sections
  });
});