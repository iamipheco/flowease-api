/* ======================================================
   src/routes/projectRoutes.js
   Project Management Routes
====================================================== */
import express from 'express';
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  archiveProject,
  unarchiveProject,
  addTeamMember,
  removeTeamMember,
  completeProject,
  updateProgress,
  getProjectStats,
  getProjectTasks,
} from '../controllers/projectController.js';
import { protect } from '../middleware/auth.js';
import { workspaceAuth } from '../middleware/workspaceAuth.js';
import { projectAuth } from '../middleware/projectAuth.js';
import { projectValidation, idValidation, workspaceIdValidation } from '../middleware/validation.js';

// Import nested routes
import sectionRoutes from './sectionRoutes.js';
import milestoneRoutes from './milestoneRoutes.js';

const router = express.Router({ mergeParams: true }); // mergeParams to access :workspaceId

/* =============================
   ALL ROUTES REQUIRE AUTHENTICATION
============================= */
router.use(protect);

/* =============================
   PROJECT CRUD
============================= */

// List & Create Projects
router
  .route('/')
  .get(getProjects)
  .post(
    workspaceAuth(['owner', 'admin'], 'canCreateProjects'),
    projectValidation.create,
    createProject
  );

// Get, Update, Delete Project
router
  .route('/:id')
  .get(idValidation, projectAuth(), getProject)
  .put(
    idValidation,
    projectAuth(['owner', 'admin']),
    projectValidation.update,
    updateProject
  )
  .delete(
    idValidation,
    projectAuth(['owner', 'admin']),
    deleteProject
  );

/* =============================
   PROJECT ACTIONS
============================= */

// Archive/Unarchive
router.put('/:id/archive', idValidation, projectAuth(['owner', 'admin']), archiveProject);
router.put('/:id/unarchive', idValidation, projectAuth(['owner', 'admin']), unarchiveProject);

// Complete Project
router.put('/:id/complete', idValidation, projectAuth(['owner', 'admin']), completeProject);

// Update Progress
router.put('/:id/progress', idValidation, projectAuth(), updateProgress);

// Statistics
router.get('/:id/stats', idValidation, projectAuth(), getProjectStats);

// Get Project Tasks
router.get('/:id/tasks', idValidation, projectAuth(), getProjectTasks);

/* =============================
   TEAM MANAGEMENT
============================= */

// Add Team Member
router.post(
  '/:id/team',
  idValidation,
  projectAuth(['owner', 'admin']),
  projectValidation.addTeamMember,
  addTeamMember
);

// Remove Team Member
router.delete(
  '/:id/team/:userId',
  idValidation,
  projectAuth(['owner', 'admin']),
  removeTeamMember
);

/* =============================
   NESTED ROUTES
============================= */

// Sections under project
router.use('/:projectId/sections', sectionRoutes);

// Milestones under project
router.use('/:projectId/milestones', milestoneRoutes);

export default router;