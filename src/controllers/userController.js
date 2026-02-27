/* ======================================================
   src/controllers/userController.js
   User Profile & Preferences Management
====================================================== */
import User from '../models/User.js';
import { ErrorResponse } from '../middleware/error.js';
import asyncHandler from 'express-async-handler';

/* =============================
   @desc    Get current user profile
   @route   GET /api/users/me
   @access  Private
============================= */
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('workspaces.workspace', 'name slug branding')
    .select('-password -refreshTokens');
  
  res.status(200).json({
    success: true,
    data: user
  });
});

/* =============================
   @desc    Update user profile
   @route   PUT /api/users/me
   @access  Private
============================= */
export const updateProfile = asyncHandler(async (req, res) => {
  const allowedFields = [
    'name',
    'profile.bio',
    'profile.title',
    'profile.department',
    'profile.location',
    'profile.timezone',
    'profile.website',
    'profile.phone',
    'profile.social'
  ];
  
  const updates = {};
  
  // Build nested update object
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      if (key.includes('.')) {
        const [parent, child] = key.split('.');
        if (!updates[parent]) updates[parent] = {};
        updates[parent][child] = req.body[key];
      } else {
        updates[key] = req.body[key];
      }
    }
  });
  
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true, runValidators: true }
  ).select('-password -refreshTokens');
  
  res.status(200).json({
    success: true,
    data: user
  });
});

/* =============================
   @desc    Update user preferences
   @route   PUT /api/users/me/preferences
   @access  Private
============================= */
export const updatePreferences = asyncHandler(async (req, res) => {
  const { preferences } = req.body;
  
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { preferences } },
    { new: true, runValidators: true }
  ).select('preferences');
  
  res.status(200).json({
    success: true,
    data: user.preferences
  });
});

/* =============================
   @desc    Update notification settings
   @route   PUT /api/users/me/notifications
   @access  Private
============================= */
export const updateNotificationSettings = asyncHandler(async (req, res) => {
  const { notificationSettings } = req.body;
  
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { notificationSettings } },
    { new: true, runValidators: true }
  ).select('notificationSettings');
  
  res.status(200).json({
    success: true,
    data: user.notificationSettings
  });
});

/* =============================
   @desc    Upload profile image
   @route   POST /api/users/me/avatar
   @access  Private
============================= */
export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ErrorResponse('Please upload an image', 400);
  }
  
  // Assuming cloudinary upload handled by multer middleware
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        'profile.image': {
          url: req.file.path,
          publicId: req.file.filename
        }
      }
    },
    { new: true }
  ).select('profile.image');
  
  res.status(200).json({
    success: true,
    data: user.profile.image
  });
});

/* =============================
   @desc    Complete onboarding step
   @route   POST /api/users/me/onboarding/:step
   @access  Private
============================= */
export const completeOnboardingStep = asyncHandler(async (req, res) => {
  const { step } = req.params;
  
  const user = await User.findById(req.user._id);
  await user.completeOnboardingStep(step);
  
  res.status(200).json({
    success: true,
    data: user.onboarding
  });
});

/* =============================
   @desc    Get user activity
   @route   GET /api/users/me/activity
   @access  Private
============================= */
export const getActivity = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('activity');
  
  res.status(200).json({
    success: true,
    data: user.activity
  });
});

/* =============================
   @desc    Update activity (track last active)
   @route   POST /api/users/me/activity
   @access  Private
============================= */
export const updateActivity = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  await user.updateActivity();
  
  res.status(200).json({
    success: true,
    message: 'Activity updated'
  });
});

/* =============================
   @desc    Get user's workspaces
   @route   GET /api/users/me/workspaces
   @access  Private
============================= */
export const getWorkspaces = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate({
      path: 'workspaces.workspace',
      select: 'name slug description branding stats subscription'
    });
  
  res.status(200).json({
    success: true,
    data: user.workspaces
  });
});

/* =============================
   @desc    Set default workspace
   @route   PUT /api/users/me/workspaces/:workspaceId/default
   @access  Private
============================= */
export const setDefaultWorkspace = asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  
  const user = await User.findById(req.user._id);
  await user.setDefaultWorkspace(workspaceId);
  
  res.status(200).json({
    success: true,
    message: 'Default workspace updated'
  });
});

/* =============================
   @desc    Search users
   @route   GET /api/users/search
   @access  Private
============================= */
export const searchUsers = asyncHandler(async (req, res) => {
  const { q, workspace } = req.query;
  
  if (!q || q.length < 2) {
    throw new ErrorResponse('Search query must be at least 2 characters', 400);
  }
  
  const searchRegex = new RegExp(q, 'i');
  
  const query = {
    $or: [
      { name: searchRegex },
      { email: searchRegex }
    ],
    isActive: true,
    isDeleted: false
  };
  
  // If workspace filter provided, only show workspace members
  if (workspace) {
    query['workspaces.workspace'] = workspace;
  }
  
  const users = await User.find(query)
    .select('name email profile.image profile.title')
    .limit(20);
  
  res.status(200).json({
    success: true,
    count: users.length,
    data: users
  });
});

/* =============================
   @desc    Get user by ID
   @route   GET /api/users/:id
   @access  Private
============================= */
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('name email profile activity createdAt');
  
  if (!user) {
    throw new ErrorResponse('User not found', 404);
  }
  
  res.status(200).json({
    success: true,
    data: user
  });
});

/* =============================
   @desc    Delete account (soft delete)
   @route   DELETE /api/users/me
   @access  Private
============================= */
export const deleteAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  await user.softDelete();
  
  res.status(200).json({
    success: true,
    message: 'Account deleted successfully'
  });
});