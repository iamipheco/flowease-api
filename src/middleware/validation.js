/* ======================================================
   src/middleware/validation.js
   Enhanced Validation with Better Error Handling
====================================================== */
import { body, param, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';

/*
|--------------------------------------------------------------------------
| VALIDATION RESULT HANDLER
|--------------------------------------------------------------------------
*/
export const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = {};

    errors.array().forEach((err) => {
      if (!formattedErrors[err.path]) {
        formattedErrors[err.path] = err.msg;
      }
    });

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors,
    });
  }

  next();
};

/*
|--------------------------------------------------------------------------
| USER VALIDATIONS
|--------------------------------------------------------------------------
*/
export const userValidation = {
  register: [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters')
      .matches(/^[a-zA-Z\s'-]+$/)
      .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),

    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),

    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number')
      .matches(/[!@#$%^&*(),.?":{}|<>]/)
      .withMessage('Password must contain at least one special character'),

    body('invitationToken')
      .optional()
      .isString()
      .withMessage('Invalid invitation token'),

    validate,
  ],

  login: [
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),

    body('password')
      .notEmpty()
      .withMessage('Password is required'),

    validate,
  ],

  updatePassword: [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),

    body('newPassword')
      .notEmpty()
      .withMessage('New password is required')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number'),

    validate,
  ],

  forgotPassword: [
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),

    validate,
  ],

  resetPassword: [
    body('newPassword')
      .notEmpty()
      .withMessage('New password is required')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),

    validate,
  ],

  deleteAccount: [
    body('password')
      .notEmpty()
      .withMessage('Password is required'),

    validate,
  ],

  hardDeleteAccount: [
    body('password')
      .notEmpty()
      .withMessage('Password is required'),

    body('confirmText')
      .notEmpty()
      .withMessage('Confirmation text is required')
      .equals('DELETE MY ACCOUNT')
      .withMessage('Please type "DELETE MY ACCOUNT" to confirm'),

    validate,
  ],

  updateProfile: [
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Name cannot be empty')
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters'),

    body('profile.bio')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Bio cannot exceed 500 characters'),

    body('profile.title')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Title cannot exceed 100 characters'),

    body('profile.website')
      .optional()
      .trim()
      .isURL()
      .withMessage('Please provide a valid URL'),

    validate,
  ],
};

/*
|--------------------------------------------------------------------------
| WORKSPACE VALIDATIONS
|--------------------------------------------------------------------------
*/
export const workspaceValidation = {
  create: [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Workspace name is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),

    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description cannot exceed 500 characters'),

    validate,
  ],

  update: [
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Name cannot be empty')
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),

    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description cannot exceed 500 characters'),

    validate,
  ],

  addMember: [
    body('userId')
      .notEmpty()
      .withMessage('User ID is required')
      .isMongoId()
      .withMessage('Invalid user ID'),

    body('role')
      .optional()
      .isIn(['owner', 'admin', 'member', 'viewer', 'guest'])
      .withMessage('Invalid role'),

    validate,
  ],
};

/*
|--------------------------------------------------------------------------
| PROJECT VALIDATIONS
|--------------------------------------------------------------------------
*/
export const projectValidation = {
  create: [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Project name is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),

    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description cannot exceed 1000 characters'),

    body('workspace')
      .optional()
      .isMongoId()
      .withMessage('Invalid workspace ID'),

    body('startDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid start date format'),

    body('endDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid end date format')
      .custom((value, { req }) => {
        if (req.body.startDate && new Date(value) < new Date(req.body.startDate)) {
          throw new Error('End date must be after start date');
        }
        return true;
      }),

    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Invalid priority'),

    validate,
  ],

  update: [
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Name cannot be empty')
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),

    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description cannot exceed 1000 characters'),

    body('status')
      .optional()
      .isIn(['planning', 'active', 'on-hold', 'completed', 'cancelled'])
      .withMessage('Invalid status'),

    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Invalid priority'),

    validate,
  ],

  addTeamMember: [
    body('userId')
      .notEmpty()
      .withMessage('User ID is required')
      .isMongoId()
      .withMessage('Invalid user ID'),

    body('role')
      .optional()
      .isString()
      .withMessage('Role must be a string'),

    validate,
  ],
};

/*
|--------------------------------------------------------------------------
| TASK VALIDATIONS
|--------------------------------------------------------------------------
*/
export const taskValidation = {
  create: [
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Task title is required')
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3 and 200 characters'),

    body('description')
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Description cannot exceed 2000 characters'),

    body('project')
      .optional()
      .isMongoId()
      .withMessage('Invalid project ID'),

    body('section')
      .optional()
      .isMongoId()
      .withMessage('Invalid section ID'),

    body('status')
      .optional()
      .isIn(['todo', 'in-progress', 'review', 'completed', 'cancelled'])
      .withMessage('Invalid status'),

    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Invalid priority'),

    body('dueDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid due date format'),

    body('reminderDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid reminder date format')
      .custom((value, { req }) => {
        if (req.body.dueDate && new Date(value) > new Date(req.body.dueDate)) {
          throw new Error('Reminder date must be before due date');
        }
        return true;
      }),

    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),

    validate,
  ],

  update: [
    body('title')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Title cannot be empty')
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3 and 200 characters'),

    body('description')
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Description cannot exceed 2000 characters'),

    body('status')
      .optional()
      .isIn(['todo', 'in-progress', 'review', 'completed', 'cancelled'])
      .withMessage('Invalid status'),

    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Invalid priority'),

    body('progress')
      .optional()
      .isInt({ min: 0, max: 100 })
      .withMessage('Progress must be between 0 and 100'),

    validate,
  ],

  assignUser: [
    body('userId')
      .notEmpty()
      .withMessage('User ID is required')
      .isMongoId()
      .withMessage('Invalid user ID'),

    validate,
  ],

  addComment: [
    body('text')
      .trim()
      .notEmpty()
      .withMessage('Comment text is required')
      .isLength({ min: 1, max: 1000 })
      .withMessage('Comment must be between 1 and 1000 characters'),

    validate,
  ],
};

/*
|--------------------------------------------------------------------------
| SECTION VALIDATIONS
|--------------------------------------------------------------------------
*/
export const sectionValidation = {
  create: [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Section name is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),

    body('project')
      .optional()
      .isMongoId()
      .withMessage('Invalid project ID'),

    validate,
  ],

  update: [
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Name cannot be empty')
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),

    validate,
  ],
};

/*
|--------------------------------------------------------------------------
| TIME ENTRY VALIDATIONS
|--------------------------------------------------------------------------
*/
export const timeEntryValidation = {
  create: [
    body('clockIn')
      .notEmpty()
      .withMessage('Clock in time is required')
      .isISO8601()
      .withMessage('Invalid clock in time format'),

    body('clockOut')
      .notEmpty()
      .withMessage('Clock out time is required')
      .isISO8601()
      .withMessage('Invalid clock out time format')
      .custom((value, { req }) => {
        if (new Date(value) <= new Date(req.body.clockIn)) {
          throw new Error('Clock out must be after clock in');
        }
        return true;
      }),

    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description cannot exceed 500 characters'),

    validate,
  ],

  startTimer: [
    body('workspace')
      .notEmpty()
      .withMessage('Workspace ID is required')
      .isMongoId()
      .withMessage('Invalid workspace ID'),

    body('project')
      .optional()
      .isMongoId()
      .withMessage('Invalid project ID'),

    body('task')
      .optional()
      .isMongoId()
      .withMessage('Invalid task ID'),

    validate,
  ],
};

/*
|--------------------------------------------------------------------------
| MILESTONE VALIDATIONS
|--------------------------------------------------------------------------
*/
export const milestoneValidation = {
  create: [
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Milestone title is required')
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3 and 200 characters'),

    body('project')
      .notEmpty()
      .withMessage('Project ID is required')
      .isMongoId()
      .withMessage('Invalid project ID'),

    body('dueDate')
      .notEmpty()
      .withMessage('Due date is required')
      .isISO8601()
      .withMessage('Invalid due date format'),

    validate,
  ],

  update: [
    body('title')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Title cannot be empty')
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3 and 200 characters'),

    body('status')
      .optional()
      .isIn(['not-started', 'in-progress', 'on-hold', 'at-risk', 'completed', 'cancelled'])
      .withMessage('Invalid status'),

    validate,
  ],
};

/*
|--------------------------------------------------------------------------
| INVITATION VALIDATIONS
|--------------------------------------------------------------------------
*/
export const invitationValidation = {
  create: [
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),

    body('workspace')
      .notEmpty()
      .withMessage('Workspace ID is required')
      .isMongoId()
      .withMessage('Invalid workspace ID'),

    body('role')
      .optional()
      .isIn(['owner', 'admin', 'member', 'viewer', 'guest'])
      .withMessage('Invalid role'),

    validate,
  ],
};

/*
|--------------------------------------------------------------------------
| PARAM ID VALIDATION
|--------------------------------------------------------------------------
*/
export const idValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),

  validate,
];

export const workspaceIdValidation = [
  param('workspaceId')
    .isMongoId()
    .withMessage('Invalid workspace ID format'),

  validate,
];

export const projectIdValidation = [
  param('projectId')
    .isMongoId()
    .withMessage('Invalid project ID format'),

  validate,
];