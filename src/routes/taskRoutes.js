/* ======================================================
   src/routes/taskRoutes.js
   Task Management Routes
====================================================== */
import express from 'express';
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  assignUser,
  unassignUser,
  acceptAssignment,
  declineAssignment,
  addComment,
  addAttachment,
  completeTask,
  getMyTasks,
  getTaskStats,
} from '../controllers/taskController.js';
import { protect } from '../middleware/auth.js';
import { workspaceAuth, optionalWorkspaceAuth } from '../middleware/workspaceAuth.js';
import { taskValidation, idValidation } from '../middleware/validation.js';
import { uploadAttachment, handleUploadError } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

/* =============================
   ALL ROUTES REQUIRE AUTHENTICATION
============================= */
router.use(protect);

/* =============================
   TASK LISTS & STATS
============================= */

// My Tasks (user's assigned tasks)
router.get('/my-tasks', getMyTasks);

// Task Statistics
router.get('/stats', getTaskStats);

/* =============================
   TASK CRUD
============================= */

// List & Create Tasks
router
  .route('/')
  .get(optionalWorkspaceAuth, getTasks)
  .post(
    workspaceAuth(['owner', 'admin', 'member']),
    taskValidation.create,
    createTask
  );

// Get, Update, Delete Task
router
  .route('/:id')
  .get(idValidation, getTask)
  .put(idValidation, taskValidation.update, updateTask)
  .delete(idValidation, deleteTask);

/* =============================
   TASK ACTIONS
============================= */

// Complete Task
router.put('/:id/complete', idValidation, completeTask);

/* =============================
   TASK ASSIGNMENT
============================= */

// Assign User
router.post(
  '/:id/assign',
  idValidation,
  taskValidation.assignUser,
  assignUser
);

// Unassign User
router.delete('/:id/assign/:userId', idValidation, unassignUser);

// Accept Assignment
router.put('/:id/accept', idValidation, acceptAssignment);

// Decline Assignment
router.put('/:id/decline', idValidation, declineAssignment);

/* =============================
   TASK INTERACTIONS
============================= */

// Add Comment
router.post(
  '/:id/comments',
  idValidation,
  taskValidation.addComment,
  addComment
);

// Add Attachment
router.post(
  '/:id/attachments',
  idValidation,
  uploadLimiter,
  uploadAttachment,
  handleUploadError,
  addAttachment
);

export default router;