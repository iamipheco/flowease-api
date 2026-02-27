/* ======================================================
   src/routes/authRoutes.js
   Authentication & Authorization Routes
====================================================== */
import express from 'express';
import passport from 'passport';
import {
  register,
  login,
  logout,
  logoutAll,
  refreshToken,
  verifyEmail,
  resendVerificationEmail,
  updatePassword,
  forgotPassword,
  resetPassword,
  googleCallback,
  linkedinCallback,
  getAuthProviders,
  disconnectProvider,
  deleteAccount,
  hardDeleteAccount,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { userValidation } from '../middleware/validation.js';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

/* =============================
   PUBLIC ROUTES
============================= */

// Registration & Login
router.post('/register', authLimiter, userValidation.register, register);
router.post('/login', authLimiter, userValidation.login, login);

// Token Management
router.post('/refresh', refreshToken);

// Email Verification
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', authLimiter, userValidation.forgotPassword, resendVerificationEmail);

// Password Reset
router.post('/forgot-password', passwordResetLimiter, userValidation.forgotPassword, forgotPassword);
router.put('/reset-password/:token', userValidation.resetPassword, resetPassword);

/* =============================
   OAUTH ROUTES
============================= */

// Google OAuth
router.get(
  '/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false 
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_auth_failed`
  }),
  googleCallback
);

// LinkedIn OAuth
router.get(
  '/linkedin',
  passport.authenticate('linkedin', { 
    scope: ['r_emailaddress', 'r_liteprofile'],
    session: false 
  })
);

router.get(
  '/linkedin/callback',
  passport.authenticate('linkedin', { 
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=linkedin_auth_failed`
  }),
  linkedinCallback
);

/* =============================
   PROTECTED ROUTES (Require Authentication)
============================= */

// Apply protect middleware to all routes below
router.use(protect);

// Logout
router.post('/logout', logout);
router.post('/logout-all', logoutAll);

// Password Management
router.put('/update-password', userValidation.updatePassword, updatePassword);

// Provider Management
router.get('/providers', getAuthProviders);
router.delete('/providers/:provider', disconnectProvider);

// Account Deletion
router.delete('/delete-account', userValidation.deleteAccount, deleteAccount);
router.delete('/hard-delete-account', userValidation.hardDeleteAccount, hardDeleteAccount);

export default router;