/* ======================================================
   src/middleware/projectAuth.js
   Project-Level Authorization
====================================================== */
import mongoose from 'mongoose';
import Project from '../models/Project.js';
import Workspace from '../models/Workspace.js';
import { ErrorResponse } from './error.js';

/**
 * Middleware to check project access
 * @param {Array} requiredRoles - workspace roles required
 */
export const projectAuth = (requiredRoles = []) => {
  return async (req, res, next) => {
    try {
      const projectId = req.params.id || req.params.projectId || req.body.project;

      if (!projectId) {
        return next(new ErrorResponse('Project ID not found', 400));
      }

      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return next(new ErrorResponse('Invalid project ID', 400));
      }

      const project = await Project.findById(projectId);

      if (!project) {
        return next(new ErrorResponse('Project not found', 404));
      }

      if (project.isArchived) {
        return next(new ErrorResponse('Project is archived', 403));
      }

      // Check workspace access
      const workspace = await Workspace.findById(project.workspace);

      if (!workspace) {
        return next(new ErrorResponse('Workspace not found', 404));
      }

      const userRole = workspace.getMemberRole(req.user._id);

      if (!userRole) {
        return next(new ErrorResponse('Not authorized to access this project', 403));
      }

      if (requiredRoles.length && !requiredRoles.includes(userRole)) {
        return next(
          new ErrorResponse(
            `Insufficient permissions. Required role: ${requiredRoles.join(' or ')}`,
            403
          )
        );
      }

      // Attach to request
      req.project = project;
      req.workspace = workspace;
      req.workspaceRole = userRole;

      next();
    } catch (err) {
      next(err);
    }
  };
};