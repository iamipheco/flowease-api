/* ======================================================
   src/routes/userRoutes.js
   User Profile & Preferences Routes
====================================================== */
import express from 'express';
import {
  getMe,
  updateProfile,
  updatePreferences,
  updateNotificationSettings,
  uploadAvatar,
  completeOnboardingStep,
  getActivity,
  updateActivity,
  getWorkspaces,
  setDefaultWorkspace,
  searchUsers,
  getUserById,
} from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';
import { userValidation, idValidation } from '../middleware/validation.js';
import { uploadProfile, handleUploadError } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

/* =============================
   ALL ROUTES REQUIRE AUTHENTICATION
============================= */
router.use(protect);

/* =============================
   CURRENT USER ROUTES
============================= */

// Profile
router.get('/me', getMe);
router.put('/me', userValidation.updateProfile, updateProfile);

// Avatar Upload
router.post(
  '/me/avatar',
  uploadLimiter,
  uploadProfile,
  handleUploadError,
  uploadAvatar
);

// Preferences
router.put('/me/preferences', updatePreferences);

// Notification Settings
router.put('/me/notifications', updateNotificationSettings);

// Activity Tracking
router.get('/me/activity', getActivity);
router.post('/me/activity', updateActivity);

// Workspaces
router.get('/me/workspaces', getWorkspaces);
router.put('/me/workspaces/:workspaceId/default', setDefaultWorkspace);

// Onboarding
router.post('/me/onboarding/:step', completeOnboardingStep);

/* =============================
   USER DISCOVERY
============================= */

// Search Users
router.get('/search', searchUsers);

// Get User by ID
router.get('/:id', idValidation, getUserById);

export default router;