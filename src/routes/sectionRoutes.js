/* ======================================================
   src/routes/sectionRoutes.js
   Kanban Section Management Routes
====================================================== */
import express from 'express';
import {
  getSections,
  getSection,
  createSection,
  updateSection,
  reorderSections,
  moveSection,
  duplicateSection,
  archiveSection,
  unarchiveSection,
  deleteSection,
  addAutomation,
  toggleAutomation,
  removeAutomation,
  moveTasks,
  createDefaultSections,
} from '../controllers/sectionController.js';
import { protect } from '../middleware/auth.js';
import { projectAuth } from '../middleware/projectAuth.js';
import { sectionValidation, idValidation, projectIdValidation } from '../middleware/validation.js';

const router = express.Router({ mergeParams: true }); // Access :projectId from parent

/* =============================
   ALL ROUTES REQUIRE AUTHENTICATION
============================= */
router.use(protect);

/* =============================
   SECTION CRUD (Project-scoped)
============================= */

// List & Create Sections
router
  .route('/')
  .get(projectIdValidation, projectAuth(), getSections)
  .post(
    projectIdValidation,
    projectAuth(['owner', 'admin', 'member']),
    sectionValidation.create,
    createSection
  );

/* =============================
   BULK OPERATIONS
============================= */

// Create Default Sections
router.post(
  '/defaults',
  projectIdValidation,
  projectAuth(['owner', 'admin']),
  createDefaultSections
);

// Reorder Sections
router.put(
  '/reorder',
  projectIdValidation,
  projectAuth(['owner', 'admin', 'member']),
  reorderSections
);

// Move Tasks Between Sections
router.post(
  '/move-tasks',
  protect,
  moveTasks
);

/* =============================
   SINGLE SECTION OPERATIONS
============================= */

// Get, Update, Delete Section
router
  .route('/:id')
  .get(idValidation, getSection)
  .put(idValidation, sectionValidation.update, updateSection)
  .delete(idValidation, deleteSection);

/* =============================
   SECTION ACTIONS
============================= */

// Move Section to Position
router.put('/:id/move', idValidation, moveSection);

// Duplicate Section
router.post('/:id/duplicate', idValidation, duplicateSection);

// Archive/Unarchive
router.put('/:id/archive', idValidation, archiveSection);
router.put('/:id/unarchive', idValidation, unarchiveSection);

/* =============================
   AUTOMATION MANAGEMENT
============================= */

// Add Automation
router.post('/:id/automations', idValidation, addAutomation);

// Toggle Automation
router.put('/:id/automations/:automationId/toggle', idValidation, toggleAutomation);

// Remove Automation
router.delete('/:id/automations/:automationId', idValidation, removeAutomation);

export default router;