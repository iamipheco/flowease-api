/* ======================================================
   src/controllers/workspaceController.js
   Complete Workspace Management Controller
====================================================== */
import mongoose from "mongoose";
import Workspace from "../models/Workspace.js";
import User from "../models/User.js";
import Project from "../models/Project.js";
import Invitation from "../models/Invitation.js";
import { ErrorResponse } from "../middleware/error.js";
import asyncHandler from "express-async-handler";

/* =============================
   HELPER FUNCTIONS
============================= */
// Validate ObjectId
const validateObjectId = (id, fieldName = "ID") => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ErrorResponse(`Invalid ${fieldName}`, 400);
  }
};

// Check workspace member access
const checkMemberAccess = (workspace, userId) => {
  const userRole = workspace.getMemberRole(userId);
  return {
    hasAccess: !!userRole,
    role: userRole,
    isOwner: userRole === "owner",
    isAdmin: userRole === "admin",
    canManage: ["owner", "admin"].includes(userRole),
  };
};

/* =============================
   @desc    Create workspace
   @route   POST /api/workspaces
   @access  Private
============================= */
export const createWorkspace = asyncHandler(async (req, res) => {
  const { name, description, branding, settings } = req.body;

  if (!name || name.trim().length === 0) {
    throw new ErrorResponse("Workspace name is required", 400);
  }

  // Generate slug
  const slug = await Workspace.generateSlug(name);

  // Create workspace with owner
  const workspace = await Workspace.create({
    name,
    description,
    slug,
    owner: req.user._id,
    branding,
    settings,
    members: [
      {
        user: req.user._id,
        role: "owner",
        joinedAt: new Date(),
        dailyGoal, // <== store daily goal
        weeklyGoal, // <== store weekly goal
        permissions: {
          canCreateProjects: true,
          canDeleteProjects: true,
          canInviteMembers: true,
          canManageMembers: true,
          canEditWorkspace: true,
          canViewReports: true,
          canExportData: true,
        },
      },
    ],
  });

  // Add workspace to user's workspace list
  await req.user.addWorkspace(workspace._id, "owner", true);

  res.status(201).json({
    success: true,
    message: "Workspace created successfully",
    data: workspace,
  });
});

/* =============================
   @desc    Get all workspaces for user
   @route   GET /api/workspaces
   @access  Private
============================= */
export const getWorkspaces = asyncHandler(async (req, res) => {
  const { includeArchived, search } = req.query;

  const query = {
    $or: [{ owner: req.user._id }, { "members.user": req.user._id }],
    isDeleted: false,
  };

  if (includeArchived !== "true") {
    query.isArchived = false;
  }

  if (search) {
    query.name = { $regex: search, $options: "i" };
  }

  const workspaces = await Workspace.find(query)
    .sort({ updatedAt: -1 })
    .populate("owner", "name email profile.image")
    .populate("members.user", "name profile.image")
    .lean();

  res.status(200).json({
    success: true,
    message: "Workspaces fetched successfully",
    count: workspaces.length,
    data: workspaces,
  });
});

/* =============================
   @desc    Get single workspace
   @route   GET /api/workspaces/:id
   @access  Private
============================= */
export const getWorkspace = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "workspace");

  const workspace = await Workspace.findById(req.params.id)
    .populate("owner", "name email profile.image")
    .populate("members.user", "name email profile.image profile.title")
    .populate("members.invitedBy", "name");

  if (!workspace) {
    throw new ErrorResponse("Workspace not found", 404);
  }

  if (workspace.isDeleted) {
    throw new ErrorResponse("Workspace has been deleted", 410);
  }

  const { hasAccess } = checkMemberAccess(workspace, req.user._id);
  if (!hasAccess) {
    throw new ErrorResponse("Not authorized to access this workspace", 403);
  }

  res.status(200).json({
    success: true,
    message: "Workspace fetched successfully",
    data: {
      ...workspace.toObject(),
      dailyGoal: workspace.dailyGoal ?? 8,
      weeklyGoal: workspace.weeklyGoal ?? 40,
    },
  });
});


/* =============================
   @desc    Update workspace goals
   @route   PUT /api/workspaces/:id/goals
   @access  Private (Admin/Owner)
============================= */
export const updateWorkspaceGoals = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, 'workspace');
  const { dailyGoal, weeklyGoal } = req.body;

  const workspace = await Workspace.findById(req.params.id);
  if (!workspace) throw new ErrorResponse('Workspace not found', 404);

  const { canManage } = checkMemberAccess(workspace, req.user._id);
  if (!canManage) throw new ErrorResponse('Not authorized to update goals', 403);

  if (dailyGoal !== undefined) workspace.dailyGoal = dailyGoal;
  if (weeklyGoal !== undefined) workspace.weeklyGoal = weeklyGoal;

  await workspace.save();

  res.status(200).json({
    success: true,
    message: 'Workspace goals updated successfully',
    data: workspace
  });
});


/* =============================
   @desc    Update workspace
   @route   PUT /api/workspaces/:id
   @access  Private (Admin/Owner)
============================= */
export const updateWorkspace = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "workspace");

  let workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    throw new ErrorResponse("Workspace not found", 404);
  }

  const { canManage } = checkMemberAccess(workspace, req.user._id);
  if (!canManage) {
    throw new ErrorResponse("Not authorized to update this workspace", 403);
  }

  const allowedFields = [
    "name",
    "description",
    "branding",
    "setting",
    "dailyGoal",
    "weeklyGoal",
  ];

  const updates = {};
  Object.keys(req.body).forEach((key) => {
    if (allowedFields.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  workspace = await Workspace.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true },
  )
    .populate("owner", "name email")
    .populate("members.user", "name profile.image");

  res.status(200).json({
    success: true,
    message: "Workspace updated successfully",
    data: workspace,
  });
});

/* =============================
   @desc    Delete workspace
   @route   DELETE /api/workspaces/:id
   @access  Private (Owner only)
============================= */
export const deleteWorkspace = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "workspace");

  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    throw new ErrorResponse("Workspace not found", 404);
  }

  const { isOwner } = checkMemberAccess(workspace, req.user._id);
  if (!isOwner) {
    throw new ErrorResponse("Only workspace owner can delete workspace", 403);
  }

  // Soft delete
  await workspace.softDelete(req.user._id);

  // Remove from all users' workspace lists
  await User.updateMany(
    { "workspaces.workspace": workspace._id },
    { $pull: { workspaces: { workspace: workspace._id } } },
  );

  res.status(200).json({
    success: true,
    message: "Workspace deleted successfully",
  });
});

/* =============================
   @desc    Archive workspace
   @route   PUT /api/workspaces/:id/archive
   @access  Private (Owner only)
============================= */
export const archiveWorkspace = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "workspace");

  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    throw new ErrorResponse("Workspace not found", 404);
  }

  const { isOwner } = checkMemberAccess(workspace, req.user._id);
  if (!isOwner) {
    throw new ErrorResponse("Only workspace owner can archive workspace", 403);
  }

  await workspace.archive(req.user._id);

  res.status(200).json({
    success: true,
    message: "Workspace archived successfully",
    data: workspace,
  });
});

/* =============================
   @desc    Unarchive workspace
   @route   PUT /api/workspaces/:id/unarchive
   @access  Private (Owner only)
============================= */
export const unarchiveWorkspace = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "workspace");

  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    throw new ErrorResponse("Workspace not found", 404);
  }

  const { isOwner } = checkMemberAccess(workspace, req.user._id);
  if (!isOwner) {
    throw new ErrorResponse(
      "Only workspace owner can unarchive workspace",
      403,
    );
  }

  await workspace.unarchive();

  res.status(200).json({
    success: true,
    message: "Workspace unarchived successfully",
    data: workspace,
  });
});

/* =============================
   @desc    Add member to workspace
   @route   POST /api/workspaces/:id/members
   @access  Private (Admin/Owner)
============================= */
export const addMember = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "workspace");
  const { userId, role = "member", permissions } = req.body;

  if (!userId) {
    throw new ErrorResponse("User ID is required", 400);
  }
  validateObjectId(userId, "user");

  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    throw new ErrorResponse("Workspace not found", 404);
  }

  const { canManage } = checkMemberAccess(workspace, req.user._id);
  if (!canManage) {
    throw new ErrorResponse("Not authorized to add members", 403);
  }

  // Check if user exists
  const user = await User.findById(userId);
  if (!user) {
    throw new ErrorResponse("User not found", 404);
  }

  // Add member to workspace
  await workspace.addMember(userId, role, req.user._id, permissions);

  // Add workspace to user's list
  await user.addWorkspace(workspace._id, role, false);

  await workspace.populate("members.user", "name email profile.image");

  res.status(200).json({
    success: true,
    message: "Member added successfully",
    data: workspace,
  });
});

/* =============================
   @desc    Remove member from workspace
   @route   DELETE /api/workspaces/:id/members/:userId
   @access  Private (Admin/Owner)
============================= */
export const removeMember = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "workspace");
  validateObjectId(req.params.userId, "user");

  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    throw new ErrorResponse("Workspace not found", 404);
  }

  const { canManage } = checkMemberAccess(workspace, req.user._id);
  if (!canManage) {
    throw new ErrorResponse("Not authorized to remove members", 403);
  }

  // Remove member from workspace
  await workspace.removeMember(req.params.userId);

  // Remove workspace from user's list
  const user = await User.findById(req.params.userId);
  if (user) {
    await user.removeWorkspace(workspace._id);
  }

  res.status(200).json({
    success: true,
    message: "Member removed successfully",
  });
});

/* =============================
   @desc    Update member role
   @route   PUT /api/workspaces/:id/members/:userId/role
   @access  Private (Owner only)
============================= */
export const updateMemberRole = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "workspace");
  validateObjectId(req.params.userId, "user");
  const { role } = req.body;

  if (!role) {
    throw new ErrorResponse("Role is required", 400);
  }

  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    throw new ErrorResponse("Workspace not found", 404);
  }

  const { isOwner } = checkMemberAccess(workspace, req.user._id);
  if (!isOwner) {
    throw new ErrorResponse(
      "Only workspace owner can change member roles",
      403,
    );
  }

  await workspace.updateMemberRole(req.params.userId, role);

  res.status(200).json({
    success: true,
    message: "Member role updated successfully",
    data: workspace,
  });
});

/* =============================
   @desc    Update member permissions
   @route   PUT /api/workspaces/:id/members/:userId/permissions
   @access  Private (Owner only)
============================= */
export const updateMemberPermissions = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "workspace");
  validateObjectId(req.params.userId, "user");
  const { permissions } = req.body;

  if (!permissions) {
    throw new ErrorResponse("Permissions are required", 400);
  }

  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    throw new ErrorResponse("Workspace not found", 404);
  }

  const { isOwner } = checkMemberAccess(workspace, req.user._id);
  if (!isOwner) {
    throw new ErrorResponse("Only workspace owner can update permissions", 403);
  }

  await workspace.updateMemberPermissions(req.params.userId, permissions);

  res.status(200).json({
    success: true,
    message: "Member permissions updated successfully",
    data: workspace,
  });
});

/* =============================
   @desc    Transfer ownership
   @route   PUT /api/workspaces/:id/transfer-ownership
   @access  Private (Owner only)
============================= */
export const transferOwnership = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "workspace");
  const { newOwnerId } = req.body;

  if (!newOwnerId) {
    throw new ErrorResponse("New owner ID is required", 400);
  }
  validateObjectId(newOwnerId, "new owner");

  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    throw new ErrorResponse("Workspace not found", 404);
  }

  const { isOwner } = checkMemberAccess(workspace, req.user._id);
  if (!isOwner) {
    throw new ErrorResponse("Only workspace owner can transfer ownership", 403);
  }

  await workspace.transferOwnership(newOwnerId);

  res.status(200).json({
    success: true,
    message: "Ownership transferred successfully",
    data: workspace,
  });
});

/* =============================
   @desc    Get workspace members
   @route   GET /api/workspaces/:id/members
   @access  Private
============================= */
export const getMembers = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "workspace");

  const workspace = await Workspace.findById(req.params.id)
    .populate(
      "members.user",
      "name email profile.image profile.title activity.lastActive",
    )
    .populate("members.invitedBy", "name");

  if (!workspace) {
    throw new ErrorResponse("Workspace not found", 404);
  }

  const { hasAccess } = checkMemberAccess(workspace, req.user._id);
  if (!hasAccess) {
    throw new ErrorResponse("Not authorized to view members", 403);
  }

  res.status(200).json({
    success: true,
    count: workspace.members.length,
    data: workspace.members,
  });
});

/* =============================
   @desc    Get workspace statistics
   @route   GET /api/workspaces/:id/stats
   @access  Private
============================= */
export const getWorkspaceStats = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "workspace");

  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    throw new ErrorResponse("Workspace not found", 404);
  }

  const { hasAccess } = checkMemberAccess(workspace, req.user._id);
  if (!hasAccess) {
    throw new ErrorResponse("Not authorized to view statistics", 403);
  }

  // Get project count
  const projectCount = await Project.countDocuments({
    workspace: req.params.id,
    isArchived: false,
  });

  res.status(200).json({
    success: true,
    data: {
      members: workspace.memberCount,
      activeMembers: workspace.activeMembers,
      projects: projectCount,
      stats: workspace.stats,
      subscription: workspace.subscription,
      storage: {
        used: workspace.stats.storageUsed,
        limit: workspace.subscription.limits.maxStorage,
        percentage: workspace.storagePercentage,
      },
      limits: {
        members: {
          used: workspace.memberCount,
          limit: workspace.subscription.limits.maxMembers,
          isAtLimit: workspace.isAtMemberLimit,
        },
        projects: {
          used: workspace.stats.totalProjects,
          limit: workspace.subscription.limits.maxProjects,
          isAtLimit: workspace.isAtProjectLimit,
        },
      },
    },
  });
});

/* =============================
   @desc    Leave workspace
   @route   POST /api/workspaces/:id/leave
   @access  Private
============================= */
export const leaveWorkspace = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "workspace");

  const workspace = await Workspace.findById(req.params.id);

  if (!workspace) {
    throw new ErrorResponse("Workspace not found", 404);
  }

  const { isOwner } = checkMemberAccess(workspace, req.user._id);
  if (isOwner) {
    throw new ErrorResponse(
      "Owner cannot leave workspace. Transfer ownership first.",
      400,
    );
  }

  await workspace.removeMember(req.user._id);
  await req.user.removeWorkspace(workspace._id);

  res.status(200).json({
    success: true,
    message: "Successfully left workspace",
  });
});
