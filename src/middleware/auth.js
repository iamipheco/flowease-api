/* ======================================================
   src/middleware/auth.js
   Enhanced Authentication & Authorization
====================================================== */
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { ErrorResponse } from './error.js';
import asyncHandler from 'express-async-handler';

/**
 * Protect routes - verify JWT token
 */
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check for token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    throw new ErrorResponse('Not authorized to access this route', 401);
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if password was changed after token issued
    const user = await User.findById(decoded.id).select('-password -refreshTokens');

    if (!user) {
      throw new ErrorResponse('User not found', 401);
    }

    if (user.isDeleted) {
      throw new ErrorResponse('User account has been deleted', 401);
    }

    if (user.isSuspended) {
      throw new ErrorResponse('User account is suspended', 401);
    }

    if (!user.isActive) {
      throw new ErrorResponse('User account is deactivated', 401);
    }

    // Check if password changed after token issued
    if (user.changedPasswordAfter && user.changedPasswordAfter(decoded.iat)) {
      throw new ErrorResponse('Password recently changed. Please login again.', 401);
    }

    // Update last active
    await user.updateActivity();

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new ErrorResponse('Invalid token', 401);
    }
    if (error.name === 'TokenExpiredError') {
      throw new ErrorResponse('Token expired', 401);
    }
    throw error;
  }
});

/**
 * Grant access to specific roles
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new ErrorResponse(
        `User role '${req.user.role}' is not authorized to access this route`,
        403
      );
    }
    next();
  };
};

/**
 * Optional authentication (doesn't fail if no token)
 */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password -refreshTokens');
    } catch (error) {
      req.user = null;
    }
  }

  next();
});
