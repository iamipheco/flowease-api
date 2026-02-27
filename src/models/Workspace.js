/* ======================================================
   src/models/Workspace.js
   Enhanced Workspace Model with Advanced Features
====================================================== */
import mongoose from "mongoose";

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Workspace name is required"],
      trim: true,
      maxlength: [100, "Workspace name cannot exceed 100 characters"]
    },
    
    slug: {
      type: String,
      lowercase: true,
      trim: true,
      
    },
    
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"]
    },
    
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      
    },
    
    // ✅ ENHANCED: Better member structure
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true
        },
        role: {
          type: String,
          enum: ["owner", "admin", "member", "viewer", "guest"],
          default: "member"
        },
        joinedAt: {
          type: Date,
          default: Date.now
        },
        invitedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },
        // ✅ ADDED: Permissions override
        permissions: {
          canCreateProjects: { type: Boolean, default: true },
          canDeleteProjects: { type: Boolean, default: false },
          canInviteMembers: { type: Boolean, default: false },
          canManageMembers: { type: Boolean, default: false },
          canEditWorkspace: { type: Boolean, default: false },
          canViewReports: { type: Boolean, default: true },
          canExportData: { type: Boolean, default: false }
        },
        // ✅ ADDED: Activity tracking
        lastActiveAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    
    // ✅ ADDED: Workspace settings
    settings: {
      visibility: {
        type: String,
        enum: ["private", "public", "invite-only"],
        default: "private"
      },
      allowGuestAccess: {
        type: Boolean,
        default: false
      },
      requireApproval: {
        type: Boolean,
        default: true
      },
      defaultProjectVisibility: {
        type: String,
        enum: ["private", "team", "workspace"],
        default: "team"
      },
      timeTracking: {
        enabled: { type: Boolean, default: true },
        requireApproval: { type: Boolean, default: false },
        billableByDefault: { type: Boolean, default: true }
      },
      notifications: {
        emailDigest: { type: String, enum: ["none", "daily", "weekly"], default: "weekly" },
        slackIntegration: { type: Boolean, default: false },
        slackWebhookUrl: String
      }
    },
    
    // ✅ ADDED: Branding
    branding: {
      logo: {
        url: String,
        publicId: String
      },
      color: {
        type: String,
        default: "#4ecdc4"
      },
      icon: {
        type: String,
        default: "💼"
      }
    },
    
    // ✅ ADDED: Subscription/Billing
    subscription: {
      plan: {
        type: String,
        enum: ["free", "starter", "professional", "enterprise"],
        default: "free"
      },
      status: {
        type: String,
        enum: ["active", "trial", "expired", "cancelled"],
        default: "trial"
      },
      trialEndsAt: Date,
      billingCycle: {
        type: String,
        enum: ["monthly", "yearly"],
        default: "monthly"
      },
      nextBillingDate: Date,
      limits: {
        maxMembers: { type: Number, default: 5 },
        maxProjects: { type: Number, default: 10 },
        maxStorage: { type: Number, default: 1024 }, // MB
        maxTimeEntries: { type: Number, default: -1 } // -1 = unlimited
      }
    },
    
    // ✅ ADDED: Usage statistics
    stats: {
      totalProjects: { type: Number, default: 0, min: 0 },
      activeProjects: { type: Number, default: 0, min: 0 },
      totalTasks: { type: Number, default: 0, min: 0 },
      completedTasks: { type: Number, default: 0, min: 0 },
      totalTimeTracked: { type: Number, default: 0, min: 0 }, // hours
      storageUsed: { type: Number, default: 0, min: 0 } // MB
    },
    
    // ✅ ADDED: Integrations
    integrations: [{
      service: {
        type: String,
        enum: ["slack", "github", "jira", "google-calendar", "zapier"],
        required: true
      },
      enabled: {
        type: Boolean,
        default: false
      },
      config: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
      },
      connectedAt: Date,
      connectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    }],
    
    // ✅ ADDED: Custom fields
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: new Map()
    },
    
    isArchived: {
      type: Boolean,
      default: false,
      
    },
    
    archivedAt: {
      type: Date,
      default: null
    },
    
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    
    isActive: { 
      type: Boolean, 
      default: true,
      
    },
    
    // ✅ ADDED: Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
      
    },
    
    deletedAt: {
      type: Date,
      default: null
    },
    
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

/* =============================
   INDEXES
============================= */
workspaceSchema.index({ name: 1, owner: 1 });
workspaceSchema.index({ slug: 1 }, { unique: true });
workspaceSchema.index({ owner: 1 });
workspaceSchema.index({ "members.user": 1 });
workspaceSchema.index({ isArchived: 1, isDeleted: 1 });
workspaceSchema.index({ "subscription.status": 1 });
workspaceSchema.index({ createdAt: -1 });

/* =============================
   VIRTUALS
============================= */
workspaceSchema.virtual("memberCount").get(function () {
  return this.members ? this.members.length : 0;
});

workspaceSchema.virtual("activeMembers").get(function () {
  if (!this.members) return 0;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return this.members.filter(m => m.lastActiveAt > thirtyDaysAgo).length;
});

workspaceSchema.virtual("storagePercentage").get(function () {
  const limit = this.subscription.limits.maxStorage;
  if (limit === -1) return 0;
  return Math.round((this.stats.storageUsed / limit) * 100);
});

workspaceSchema.virtual("projectsPercentage").get(function () {
  const limit = this.subscription.limits.maxProjects;
  if (limit === -1) return 0;
  return Math.round((this.stats.totalProjects / limit) * 100);
});

workspaceSchema.virtual("isTrialExpired").get(function () {
  return this.subscription.status === "trial" && 
         this.subscription.trialEndsAt && 
         new Date() > this.subscription.trialEndsAt;
});

workspaceSchema.virtual("isAtMemberLimit").get(function () {
  const limit = this.subscription.limits.maxMembers;
  return limit !== -1 && this.memberCount >= limit;
});

workspaceSchema.virtual("isAtProjectLimit").get(function () {
  const limit = this.subscription.limits.maxProjects;
  return limit !== -1 && this.stats.totalProjects >= limit;
});

workspaceSchema.virtual("completionRate").get(function () {
  if (this.stats.totalTasks === 0) return 0;
  return Math.round((this.stats.completedTasks / this.stats.totalTasks) * 100);
});

/* =============================
   METHODS
============================= */
// ✅ Check user role
workspaceSchema.methods.getMemberRole = function (userId) {
  if (this.owner.toString() === userId.toString()) return "owner";
  const member = this.members.find(m => m.user.toString() === userId.toString());
  return member ? member.role : null;
};

// ✅ Check if user is member
workspaceSchema.methods.isMember = function (userId) {
  return this.getMemberRole(userId) !== null;
};

// ✅ Check if user has specific permission
workspaceSchema.methods.hasPermission = function (userId, permission) {
  const role = this.getMemberRole(userId);
  
  if (role === "owner") return true;
  
  const member = this.members.find(m => m.user.toString() === userId.toString());
  if (!member) return false;
  
  // Admin role default permissions
  if (role === "admin") {
    const adminPermissions = ["canCreateProjects", "canInviteMembers", "canViewReports"];
    if (adminPermissions.includes(permission)) return true;
  }
  
  // Check custom permission override
  return member.permissions[permission] || false;
};

// ✅ Add member
workspaceSchema.methods.addMember = async function (userId, role = "member", invitedBy = null, permissions = {}) {
  // Check if user already exists
  const exists = this.members.some(m => m.user.toString() === userId.toString());
  if (exists) {
    throw new Error("User is already a member of this workspace");
  }
  
  // Check member limit
  if (this.isAtMemberLimit) {
    throw new Error("Workspace member limit reached. Please upgrade your plan.");
  }
  
  const defaultPermissions = {
    canCreateProjects: role !== "viewer",
    canDeleteProjects: false,
    canInviteMembers: role === "admin",
    canManageMembers: role === "admin",
    canEditWorkspace: role === "admin",
    canViewReports: true,
    canExportData: false
  };
  
  this.members.push({
    user: userId,
    role,
    invitedBy,
    joinedAt: new Date(),
    permissions: { ...defaultPermissions, ...permissions }
  });
  
  return this.save();
};

// ✅ Remove member
workspaceSchema.methods.removeMember = async function (userId) {
  // Cannot remove owner
  if (this.owner.toString() === userId.toString()) {
    throw new Error("Cannot remove workspace owner");
  }
  
  this.members = this.members.filter(m => m.user.toString() !== userId.toString());
  return this.save();
};

// ✅ Update member role
workspaceSchema.methods.updateMemberRole = async function (userId, newRole) {
  const member = this.members.find(m => m.user.toString() === userId.toString());
  
  if (!member) {
    throw new Error("User is not a member of this workspace");
  }
  
  if (this.owner.toString() === userId.toString()) {
    throw new Error("Cannot change owner's role");
  }
  
  member.role = newRole;
  return this.save();
};

// ✅ Update member permissions
workspaceSchema.methods.updateMemberPermissions = async function (userId, permissions) {
  const member = this.members.find(m => m.user.toString() === userId.toString());
  
  if (!member) {
    throw new Error("User is not a member of this workspace");
  }
  
  member.permissions = { ...member.permissions, ...permissions };
  return this.save();
};

// ✅ Transfer ownership
workspaceSchema.methods.transferOwnership = async function (newOwnerId) {
  const newOwner = this.members.find(m => m.user.toString() === newOwnerId.toString());
  
  if (!newOwner) {
    throw new Error("New owner must be a member of the workspace");
  }
  
  // Update old owner to admin
  const oldOwner = this.members.find(m => m.user.toString() === this.owner.toString());
  if (oldOwner) {
    oldOwner.role = "admin";
  }
  
  // Update new owner
  newOwner.role = "owner";
  this.owner = newOwnerId;
  
  return this.save();
};

// ✅ Archive workspace
workspaceSchema.methods.archive = async function (userId) {
  this.isArchived = true;
  this.archivedAt = new Date();
  this.archivedBy = userId;
  return this.save();
};

// ✅ Unarchive workspace
workspaceSchema.methods.unarchive = async function () {
  this.isArchived = false;
  this.archivedAt = null;
  this.archivedBy = null;
  return this.save();
};

// ✅ Soft delete workspace
workspaceSchema.methods.softDelete = async function (userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.isActive = false;
  return this.save();
};

// ✅ Update member activity
workspaceSchema.methods.updateMemberActivity = async function (userId) {
  const member = this.members.find(m => m.user.toString() === userId.toString());
  if (member) {
    member.lastActiveAt = new Date();
    return this.save({ validateBeforeSave: false });
  }
};

// ✅ Check subscription limits
workspaceSchema.methods.canCreateProject = function () {
  const limit = this.subscription.limits.maxProjects;
  return limit === -1 || this.stats.totalProjects < limit;
};

workspaceSchema.methods.canAddMember = function () {
  const limit = this.subscription.limits.maxMembers;
  return limit === -1 || this.memberCount < limit;
};

workspaceSchema.methods.canUploadFile = function (fileSizeMB) {
  const limit = this.subscription.limits.maxStorage;
  if (limit === -1) return true;
  return (this.stats.storageUsed + fileSizeMB) <= limit;
};

/* =============================
   STATICS
============================= */
// ✅ Find workspaces by user
workspaceSchema.statics.findByUser = async function (userId) {
  return this.find({
    $or: [
      { owner: userId },
      { "members.user": userId }
    ],
    isDeleted: false
  }).sort({ updatedAt: -1 });
};

// ✅ Generate unique slug
workspaceSchema.statics.generateSlug = async function (name, attempt = 0) {
  let slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  
  if (attempt > 0) {
    slug = `${slug}-${attempt}`;
  }
  
  const existing = await this.findOne({ slug });
  
  if (existing) {
    return this.generateSlug(name, attempt + 1);
  }
  
  return slug;
};

/* =============================
   MIDDLEWARE
============================= */
// ✅ Generate slug before save
workspaceSchema.pre("save", async function (next) {
  if (this.isNew && !this.slug) {
    this.slug = await this.constructor.generateSlug(this.name);
  }
  next();
});

// ✅ Ensure owner is in members
workspaceSchema.pre("save", function (next) {
  const ownerIsMember = this.members.some(
    m => m.user.toString() === this.owner.toString()
  );
  
  if (!ownerIsMember) {
    this.members.unshift({
      user: this.owner,
      role: "owner",
      joinedAt: this.createdAt || new Date(),
      permissions: {
        canCreateProjects: true,
        canDeleteProjects: true,
        canInviteMembers: true,
        canManageMembers: true,
        canEditWorkspace: true,
        canViewReports: true,
        canExportData: true
      }
    });
  }
  
  next();
});

// ✅ Set trial period for new workspaces
workspaceSchema.pre("save", function (next) {
  if (this.isNew && this.subscription.status === "trial" && !this.subscription.trialEndsAt) {
    this.subscription.trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days
  }
  next();
});

// ✅ Cascade delete
workspaceSchema.pre("deleteOne", { document: true, query: false }, async function (next) {
  try {
    const Project = mongoose.model("Project");
    const Task = mongoose.model("Task");
    const TimeEntry = mongoose.model("TimeEntry");
    const Milestone = mongoose.model("Milestone");
    
    // Delete all related data
    await Promise.all([
      Project.deleteMany({ workspace: this._id }),
      Task.deleteMany({ workspace: this._id }),
      TimeEntry.deleteMany({ workspace: this._id }),
      Milestone.deleteMany({ workspace: this._id })
    ]);
    
    next();
  } catch (error) {
    next(error);
  }
});

const Workspace = mongoose.model("Workspace", workspaceSchema);
export default Workspace;