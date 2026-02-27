/* ======================================================
   src/models/Invitation.js
   Enhanced Invitation Model for Workspace & Project Invites
====================================================== */
import mongoose from "mongoose";
import crypto from "crypto";

const invitationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    
    // ✅ ADDED: Support for both workspace and project invites
    inviteType: {
      type: String,
      enum: ['workspace', 'project', 'task'],
      default: 'workspace',
      required: true
    },
    
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: [true, "Workspace reference is required"]
    },
    
    // ✅ ADDED: Optional project reference
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null
    },
    
    // ✅ ADDED: Optional task reference
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null
    },
    
    role: {
      type: String,
      enum: ["owner", "admin", "member", "viewer", "guest"],
      default: "member",
    },
    
    // ✅ ADDED: Custom permissions (overrides role defaults)
    permissions: {
      canCreateProjects: { type: Boolean, default: null },
      canDeleteProjects: { type: Boolean, default: null },
      canInviteMembers: { type: Boolean, default: null },
      canManageMembers: { type: Boolean, default: null },
      canEditWorkspace: { type: Boolean, default: null },
      canViewReports: { type: Boolean, default: null },
      canExportData: { type: Boolean, default: null }
    },
    
    token: {
      type: String,
      required: true
    },
    
    // ✅ ADDED: Invitation metadata
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    
    inviteeName: {
      type: String,
      trim: true,
      default: null
    },
    
    // ✅ ADDED: Personal message
    message: {
      type: String,
      maxlength: 500,
      default: null
    },
    
    // ✅ ADDED: Status tracking
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired', 'revoked'],
      default: 'pending'
    },
    
    expiresAt: {
      type: Date,
      required: true
    },
    
    // ✅ ADDED: Response tracking
    acceptedAt: {
      type: Date,
      default: null
    },
    
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    
    declinedAt: {
      type: Date,
      default: null
    },
    
    declineReason: {
      type: String,
      maxlength: 200,
      default: null
    },
    
    revokedAt: {
      type: Date,
      default: null
    },
    
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    
    // ✅ ADDED: Reminder tracking
    reminderSentAt: {
      type: Date,
      default: null
    },
    
    reminderCount: {
      type: Number,
      default: 0,
      min: 0,
      max: 3 // Limit reminders
    },
    
    // ✅ ADDED: Usage tracking
    viewedAt: {
      type: Date,
      default: null
    },
    
    viewCount: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // ✅ ADDED: Metadata
    metadata: {
      ipAddress: String,
      userAgent: String,
      referrer: String,
      source: {
        type: String,
        enum: ['email', 'link', 'api', 'bulk'],
        default: 'email'
      }
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
// Prevent duplicate invites for same email in same workspace
invitationSchema.index({ email: 1, workspace: 1, status: 1 }, { 
  unique: true,
  partialFilterExpression: { status: 'pending' }
});

// Auto-delete expired invitations via TTL index
invitationSchema.index({ expiresAt: 1 }, { 
  expireAfterSeconds: 0,
  partialFilterExpression: { status: { $in: ['expired', 'declined'] } }
});

invitationSchema.index({ token: 1 }, { unique: true });
invitationSchema.index({ invitedBy: 1 });
invitationSchema.index({ status: 1, expiresAt: 1 });
invitationSchema.index({ workspace: 1, status: 1 });
invitationSchema.index({ project: 1, status: 1 });
invitationSchema.index({ createdAt: -1 });

/* =============================
   VIRTUALS
============================= */
invitationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt;
});

invitationSchema.virtual('isPending').get(function() {
  return this.status === 'pending' && !this.isExpired;
});

invitationSchema.virtual('isAccepted').get(function() {
  return this.status === 'accepted';
});

invitationSchema.virtual('isDeclined').get(function() {
  return this.status === 'declined';
});

invitationSchema.virtual('isRevoked').get(function() {
  return this.status === 'revoked';
});

invitationSchema.virtual('daysUntilExpiry').get(function() {
  if (!this.expiresAt) return 0;
  const now = new Date();
  const expiry = new Date(this.expiresAt);
  const diff = expiry - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

invitationSchema.virtual('hoursUntilExpiry').get(function() {
  if (!this.expiresAt) return 0;
  const now = new Date();
  const expiry = new Date(this.expiresAt);
  const diff = expiry - now;
  return Math.ceil(diff / (1000 * 60 * 60));
});

invitationSchema.virtual('canSendReminder').get(function() {
  return this.isPending && 
         this.reminderCount < 3 && 
         (!this.reminderSentAt || 
          (new Date() - this.reminderSentAt) > 24 * 60 * 60 * 1000); // 24 hours
});

invitationSchema.virtual('inviteUrl').get(function() {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `${frontendUrl}/invite/${this.token}`;
});

/* =============================
   METHODS
============================= */
// ✅ Accept invitation
invitationSchema.methods.accept = async function(userId) {
  if (!this.isPending) {
    throw new Error(`Cannot accept invitation with status: ${this.status}`);
  }
  
  this.status = 'accepted';
  this.acceptedAt = new Date();
  this.acceptedBy = userId;
  
  return this.save();
};

// ✅ Decline invitation
invitationSchema.methods.decline = async function(reason = null) {
  if (!this.isPending) {
    throw new Error(`Cannot decline invitation with status: ${this.status}`);
  }
  
  this.status = 'declined';
  this.declinedAt = new Date();
  if (reason) {
    this.declineReason = reason;
  }
  
  return this.save();
};

// ✅ Revoke invitation
invitationSchema.methods.revoke = async function(userId) {
  if (this.status === 'accepted') {
    throw new Error('Cannot revoke an accepted invitation');
  }
  
  this.status = 'revoked';
  this.revokedAt = new Date();
  this.revokedBy = userId;
  
  return this.save();
};

// ✅ Track view
invitationSchema.methods.trackView = async function(ipAddress = null, userAgent = null) {
  this.viewedAt = new Date();
  this.viewCount += 1;
  
  if (ipAddress) this.metadata.ipAddress = ipAddress;
  if (userAgent) this.metadata.userAgent = userAgent;
  
  return this.save({ validateBeforeSave: false });
};

// ✅ Send reminder
invitationSchema.methods.sendReminder = async function() {
  if (!this.canSendReminder) {
    throw new Error('Cannot send reminder at this time');
  }
  
  this.reminderSentAt = new Date();
  this.reminderCount += 1;
  
  return this.save({ validateBeforeSave: false });
};

// ✅ Extend expiration
invitationSchema.methods.extend = async function(hours = 24) {
  const newExpiry = new Date(this.expiresAt.getTime() + hours * 60 * 60 * 1000);
  this.expiresAt = newExpiry;
  
  // Reset status if expired
  if (this.status === 'expired') {
    this.status = 'pending';
  }
  
  return this.save();
};

// ✅ Check if user can accept (email match)
invitationSchema.methods.canAccept = function(email) {
  return this.email.toLowerCase() === email.toLowerCase() && this.isPending;
};

/* =============================
   STATICS
============================= */
// ✅ Generate secure token
invitationSchema.statics.generateToken = function() {
  return crypto.randomBytes(32).toString('hex');
};

// ✅ Create invitation
invitationSchema.statics.createInvitation = async function(data) {
  const {
    email,
    workspace,
    invitedBy,
    role = 'member',
    inviteType = 'workspace',
    project = null,
    task = null,
    message = null,
    inviteeName = null,
    permissions = {},
    expiresIn = 168 // hours (7 days)
  } = data;
  
  // Check for existing pending invitation
  const existing = await this.findOne({
    email: email.toLowerCase(),
    workspace,
    status: 'pending'
  });
  
  if (existing) {
    throw new Error('A pending invitation already exists for this email');
  }
  
  const token = this.generateToken();
  const expiresAt = new Date(Date.now() + expiresIn * 60 * 60 * 1000);
  
  return this.create({
    email: email.toLowerCase(),
    workspace,
    project,
    task,
    inviteType,
    role,
    permissions,
    invitedBy,
    message,
    inviteeName,
    token,
    expiresAt,
    metadata: {
      source: data.source || 'email'
    }
  });
};

// ✅ Find pending invitations for email
invitationSchema.statics.findPendingForEmail = async function(email) {
  return this.find({
    email: email.toLowerCase(),
    status: 'pending',
    expiresAt: { $gt: new Date() }
  })
    .populate('workspace', 'name slug branding')
    .populate('invitedBy', 'name email profile.image')
    .populate('project', 'name icon')
    .sort({ createdAt: -1 });
};

// ✅ Find by token
invitationSchema.statics.findByToken = async function(token) {
  const invitation = await this.findOne({ token })
    .populate('workspace', 'name slug branding')
    .populate('invitedBy', 'name email profile.image')
    .populate('project', 'name icon');
  
  if (!invitation) return null;
  
  // Auto-expire if needed
  if (invitation.isExpired && invitation.status === 'pending') {
    invitation.status = 'expired';
    await invitation.save({ validateBeforeSave: false });
  }
  
  return invitation;
};

// ✅ Bulk create invitations
invitationSchema.statics.bulkInvite = async function(emails, data) {
  const {
    workspace,
    invitedBy,
    role = 'member',
    message = null,
    expiresIn = 168
  } = data;
  
  const invitations = emails.map(email => ({
    email: email.toLowerCase(),
    workspace,
    invitedBy,
    role,
    message,
    token: this.generateToken(),
    expiresAt: new Date(Date.now() + expiresIn * 60 * 60 * 1000),
    metadata: {
      source: 'bulk'
    }
  }));
  
  return this.insertMany(invitations, { ordered: false });
};

// ✅ Clean expired invitations
invitationSchema.statics.cleanExpired = async function() {
  return this.updateMany(
    {
      status: 'pending',
      expiresAt: { $lt: new Date() }
    },
    {
      $set: { status: 'expired' }
    }
  );
};

// ✅ Get workspace invitation stats
invitationSchema.statics.getWorkspaceStats = async function(workspaceId) {
  const stats = await this.aggregate([
    { $match: { workspace: workspaceId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    total: 0,
    pending: 0,
    accepted: 0,
    declined: 0,
    expired: 0,
    revoked: 0
  };
  
  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });
  
  return result;
};

/* =============================
   MIDDLEWARE
============================= */
// ✅ Auto-generate token if not provided
invitationSchema.pre('save', function(next) {
  if (this.isNew && !this.token) {
    this.token = this.constructor.generateToken();
  }
  next();
});

// ✅ Auto-set expiration if not provided
invitationSchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  }
  next();
});

// ✅ Normalize email
invitationSchema.pre('save', function(next) {
  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }
  next();
});

const Invitation = mongoose.model("Invitation", invitationSchema);

export default Invitation;