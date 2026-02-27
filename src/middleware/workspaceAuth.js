/* ======================================================
   src/middleware/workspaceAuth.js
   Enhanced Workspace Authorization
====================================================== */
import mongoose from 'mongoose';
import Workspace from '../models/Workspace.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import { ErrorResponse } from './error.js';

/**
 * Middleware to check if user belongs to a workspace
 * @param {Array} allowedRoles - roles allowed to access this route
 * @param {String} permission - specific permission to check
 * Usage: workspaceAuth(['owner', 'admin'], 'canCreateProjects')
 */
export const workspaceAuth = (allowedRoles = [], permission = null) => {
  return async (req, res, next) => {
    try {
      let workspaceId;

      // Extract workspaceId from various sources
      if (req.body.workspace) {
        workspaceId = req.body.workspace;
      } else if (req.params.workspaceId) {
        workspaceId = req.params.workspaceId;
      } else if (req.query.workspace) {
        workspaceId = req.query.workspace;
      } else if (req.params.id) {
        // Try to find workspace from project or task
        if (req.baseUrl.includes('/projects')) {
          const project = await Project.findById(req.params.id).select('workspace');
          if (project) workspaceId = project.workspace;
        } else if (req.baseUrl.includes('/tasks')) {
          const task = await Task.findById(req.params.id).populate('project', 'workspace');
          if (task?.project) workspaceId = task.project.workspace;
        }
      }

      if (!workspaceId) {
        return next(new ErrorResponse('Workspace ID not found', 400));
      }

      // Validate workspace ID
      if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
        return next(new ErrorResponse('Invalid workspace ID', 400));
      }

      const workspace = await Workspace.findById(workspaceId);

      if (!workspace) {
        return next(new ErrorResponse('Workspace not found', 404));
      }

      if (workspace.isDeleted) {
        return next(new ErrorResponse('Workspace has been deleted', 410));
      }

      if (workspace.isArchived) {
        return next(new ErrorResponse('Workspace is archived', 403));
      }

      if (!workspace.isActive) {
        return next(new ErrorResponse('Workspace is inactive', 403));
      }

      // Check membership
      const userRole = workspace.getMemberRole(req.user._id);

      if (!userRole) {
        return next(new ErrorResponse('You are not a member of this workspace', 403));
      }

      // Check role permissions
      if (allowedRoles.length && !allowedRoles.includes(userRole)) {
        return next(
          new ErrorResponse(
            `Insufficient workspace permissions. Required role: ${allowedRoles.join(' or ')}`,
            403
          )
        );
      }

      // Check specific permission if provided
      if (permission) {
        const hasPermission = workspace.hasPermission(req.user._id, permission);
        if (!hasPermission) {
          return next(
            new ErrorResponse(
              `You don't have permission to ${permission.replace('can', '').toLowerCase()}`,
              403
            )
          );
        }
      }

      // Attach workspace info to request
      req.workspace = workspace;
      req.workspaceRole = userRole;
      req.workspaceId = workspaceId;

      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Optional workspace auth - doesn't fail if no workspace found
 */
export const optionalWorkspaceAuth = async (req, res, next) => {
  try {
    let workspaceId = req.query.workspace || req.body.workspace;

    if (!workspaceId) {
      return next();
    }

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return next();
    }

    const workspace = await Workspace.findById(workspaceId);

    if (!workspace || workspace.isDeleted) {
      return next();
    }

    const userRole = workspace.getMemberRole(req.user._id);

    if (userRole) {
      req.workspace = workspace;
      req.workspaceRole = userRole;
      req.workspaceId = workspaceId;
    }

    next();
  } catch (err) {
    next();
  }
};