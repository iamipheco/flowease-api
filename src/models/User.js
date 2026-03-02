import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Please provide a name'], 
    trim: true, 
    maxlength: [50, 'Name cannot exceed 50 characters'] 
  },
  
  email: { 
    type: String, 
    required: [true, 'Please provide an email'], 
    unique: true, 
    lowercase: true, 
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'] 
  },
  
  password: { 
    type: String, 
    minlength: [8, 'Password must be at least 8 characters'], 
    select: false 
  },
  
  role: { 
    type: String, 
    enum: ['user', 'admin', 'manager'], 
    default: 'user' 
  },
  
  // ✅ ENHANCED: Profile information
  profile: {
    image: {
      url: { type: String, default: null },
      publicId: { type: String, default: null }
    },
    bio: { type: String, trim: true, default: "", maxlength: 500 },
    title: { type: String, trim: true, default: "", maxlength: 100 },
    department: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    timezone: { type: String, default: "UTC" },
    website: { 
      type: String, 
      trim: true, 
      default: "",
      validate: {
        validator: function(v) {
          if (!v) return true;
          return /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(v);
        },
        message: 'Please provide a valid URL'
      }
    },
    phone: { type: String, trim: true, default: "" },
    dateOfBirth: Date,
    // ✅ ADDED: Social links
    social: {
      linkedin: String,
      twitter: String,
      github: String,
      portfolio: String
    }
  },

  // ✅ ADDED: User preferences
  preferences: {
    language: { type: String, default: 'en' },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    emailNotifications: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: true },
    weeklyDigest: { type: Boolean, default: true },
    taskReminders: { type: Boolean, default: true },
    workingHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' },
      timezone: { type: String, default: 'UTC' }
    },
    // ✅ ADDED: Default views
    defaultTaskView: { 
      type: String, 
      enum: ['list', 'board', 'calendar', 'timeline'], 
      default: 'list' 
    },
    defaultProjectView: { 
      type: String, 
      enum: ['list', 'board', 'timeline'], 
      default: 'list' 
    }
  },

  // ✅ ADDED: Activity tracking
  activity: {
    lastLogin: { type: Date, default: null },
    lastActive: { type: Date, default: Date.now },
    loginCount: { type: Number, default: 0 },
    taskCreatedCount: { type: Number, default: 0 },
    taskCompletedCount: { type: Number, default: 0 },
    totalTimeTracked: { type: Number, default: 0 } // hours
  },

  // ✅ ADDED: Onboarding
  onboarding: {
    isCompleted: { type: Boolean, default: false },
    currentStep: { type: Number, default: 0 },
    completedAt: Date,
    steps: {
      profileSetup: { type: Boolean, default: false },
      firstProject: { type: Boolean, default: false },
      firstTask: { type: Boolean, default: false },
      inviteTeam: { type: Boolean, default: false },
      firstTimeEntry: { type: Boolean, default: false }
    }
  },

  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }, 
  deletedAt: { type: Date, default: null },
  
  // ✅ ADDED: Account suspension
  isSuspended: { type: Boolean, default: false },
  suspendedAt: Date,
  suspendedReason: String,

  pendingInvitation: { type: String, default: null },

  emailVerified: { type: Boolean, default: false },
  
  // ✅ ADDED: Phone verification
  phoneVerified: { type: Boolean, default: false },
  phoneVerificationToken: String,
  phoneVerificationExpire: Date,

  // ✅ ENHANCED: Token management with device info
  refreshTokens: [{
    token: String,
    device: {
      type: { type: String, default: 'web' }, // web, mobile, desktop
      name: String,
      os: String,
      browser: String
    },
    ipAddress: String,
    userAgent: String,
    createdAt: { type: Date, default: Date.now },
    lastUsed: { type: Date, default: Date.now }
  }],

  emailVerificationToken: String,
  emailVerificationExpire: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,

  // ✅ ENHANCED: Auth providers with more details
  authProviders: [{
    provider: { 
      type: String, 
      enum: ['local', 'google', 'linkedin', 'github', 'microsoft'], 
      required: true 
    },
    providerId: String,
    connectedAt: { type: Date, default: Date.now },
    email: String, // Email from OAuth provider
    profileUrl: String
  }],
  
  // ✅ ADDED: Two-factor authentication
  twoFactor: {
    enabled: { type: Boolean, default: false },
    secret: { type: String, select: false },
    backupCodes: [{ type: String, select: false }],
    enabledAt: Date
  },
  
  // ✅ ADDED: Security
  security: {
    passwordChangedAt: Date,
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: Date,
    lastPasswordReset: Date,
    securityQuestions: [{
      question: String,
      answer: { type: String, select: false }
    }]
  },
  
  // ✅ ADDED: Workspaces user belongs to
  workspaces: [{
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace'
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member', 'viewer'],
      default: 'member'
    },
    isDefault: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now }
  }],
  
  // ✅ ADDED: Notification settings per channel
  notificationSettings: {
    email: {
      taskAssigned: { type: Boolean, default: true },
      taskDue: { type: Boolean, default: true },
      taskCompleted: { type: Boolean, default: false },
      projectUpdates: { type: Boolean, default: true },
      mentions: { type: Boolean, default: true },
      comments: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: true }
    },
    inApp: {
      taskAssigned: { type: Boolean, default: true },
      taskDue: { type: Boolean, default: true },
      taskCompleted: { type: Boolean, default: true },
      projectUpdates: { type: Boolean, default: true },
      mentions: { type: Boolean, default: true },
      comments: { type: Boolean, default: true }
    },
    push: {
      enabled: { type: Boolean, default: false },
      taskAssigned: { type: Boolean, default: true },
      taskDue: { type: Boolean, default: true },
      mentions: { type: Boolean, default: true }
    }
  },
  
  // ✅ ADDED: API keys for integrations
  apiKeys: [{
    name: String,
    key: { type: String, select: false },
    lastUsed: Date,
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date,
    isActive: { type: Boolean, default: true }
  }],
  
  // ✅ ADDED: Custom fields
  customFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/* =============================
   INDEXES
============================= */

userSchema.index({ isDeleted: 1, email: 1 });
userSchema.index({ isActive: 1, email: 1 });
userSchema.index({ 'activity.lastActive': -1 });
userSchema.index({ 'workspaces.workspace': 1 });
userSchema.index({ role: 1 });
userSchema.index({ emailVerified: 1 });
userSchema.index({ createdAt: -1 });




/* =============================
   VIRTUALS
============================= */
// Ensure JSON includes virtuals
userSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.__v;
    return ret;
  },
});

userSchema.set('toObject', {
  virtuals: true,
});

// Safe virtual for workspaces count
userSchema.virtual('workspacesCount').get(function () {
  return Array.isArray(this.workspaces) ? this.workspaces.length : 0;
});

// Safe virtual for active projects count
userSchema.virtual('activeProjectsCount').get(function () {
  if (!Array.isArray(this.projects)) return 0;
  return this.projects.filter(p => p && p.status === 'active').length;
});

// Safe virtual for total tasks
userSchema.virtual('totalTasksCount').get(function () {
  if (!Array.isArray(this.tasks)) return 0;
  return this.tasks.length;
});

/* =============================
   PASSWORD HASHING
============================= */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  // Update password changed timestamp
  this.security.passwordChangedAt = Date.now() - 1000; // -1s to ensure JWT is valid
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/* =============================
   AUTO-EXCLUDE DELETED USERS
============================= */
userSchema.query.notDeleted = function () {
  return this.where({ isDeleted: false });
};

userSchema.query.active = function () {
  return this.where({ isActive: true, isDeleted: false, isSuspended: false });
};

/* =============================
   METHODS
============================= */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.getSignedJwtToken = function () {
  return jwt.sign(
    { id: this._id, email: this.email, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

userSchema.methods.getRefreshToken = function (deviceInfo = {}) {
  const refreshToken = jwt.sign(
    { id: this._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE }
  );
  
  return {
    token: refreshToken,
    device: deviceInfo,
    createdAt: new Date(),
    lastUsed: new Date()
  };
};

userSchema.methods.getEmailVerificationToken = function () {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000;
  return verificationToken;
};

userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

// ✅ Track login
userSchema.methods.trackLogin = async function(ipAddress = null, userAgent = null) {
  this.activity.lastLogin = new Date();
  this.activity.lastActive = new Date();
  this.activity.loginCount += 1;
  this.security.failedLoginAttempts = 0;
  return this.save({ validateBeforeSave: false });
};

// ✅ Track failed login
userSchema.methods.trackFailedLogin = async function() {
  this.security.failedLoginAttempts += 1;
  
  // Lock account after 5 failed attempts
  if (this.security.failedLoginAttempts >= 5) {
    this.security.lockUntil = Date.now() + 30 * 60 * 1000; // Lock for 30 minutes
  }
  
  return this.save({ validateBeforeSave: false });
};

// ✅ Update activity
userSchema.methods.updateActivity = async function() {
  this.activity.lastActive = new Date();
  return this.save({ validateBeforeSave: false });
};

// ✅ Complete onboarding step
userSchema.methods.completeOnboardingStep = async function(step) {
  if (this.onboarding.steps[step] !== undefined) {
    this.onboarding.steps[step] = true;
    
    // Check if all steps completed
    const allCompleted = Object.values(this.onboarding.steps).every(s => s === true);
    if (allCompleted && !this.onboarding.isCompleted) {
      this.onboarding.isCompleted = true;
      this.onboarding.completedAt = new Date();
    }
    
    return this.save({ validateBeforeSave: false });
  }
};

// ✅ Add workspace
userSchema.methods.addWorkspace = async function(workspaceId, role = 'member', isDefault = false) {
  // Set default if first workspace
  if (this.workspaces.length === 0) {
    isDefault = true;
  }
  
  // Remove default from others if this is default
  if (isDefault) {
    this.workspaces.forEach(w => w.isDefault = false);
  }
  
  const exists = this.workspaces.some(
    w => w.workspace.toString() === workspaceId.toString()
  );
  
  if (!exists) {
    this.workspaces.push({
      workspace: workspaceId,
      role,
      isDefault,
      joinedAt: new Date()
    });
  }
  
  return this.save({ validateBeforeSave: false });
};

// ✅ Remove workspace
userSchema.methods.removeWorkspace = async function(workspaceId) {
  this.workspaces = this.workspaces.filter(
    w => w.workspace.toString() !== workspaceId.toString()
  );
  
  // Set new default if removed workspace was default
  if (this.workspaces.length > 0 && !this.workspaces.some(w => w.isDefault)) {
    this.workspaces[0].isDefault = true;
  }
  
  return this.save({ validateBeforeSave: false });
};

// ✅ Set default workspace
userSchema.methods.setDefaultWorkspace = async function(workspaceId) {
  this.workspaces.forEach(w => {
    w.isDefault = w.workspace.toString() === workspaceId.toString();
  });
  
  return this.save({ validateBeforeSave: false });
};

// ✅ Soft delete
userSchema.methods.softDelete = async function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.isActive = false;
  this.refreshTokens = [];
  return this.save({ validateBeforeSave: false });
};

// ✅ Check if password was changed after JWT issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.security.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.security.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

/* =============================
   STATICS
============================= */
userSchema.statics.findByEmail = async function(email) {
  return this.findOne({ email: email.toLowerCase(), isDeleted: false });
};

userSchema.statics.findActiveUsers = async function() {
  return this.find({
    isActive: true,
    isDeleted: false,
    isSuspended: false
  }).select('-password -refreshTokens');
};

const User = mongoose.model('User', userSchema);

export default User;