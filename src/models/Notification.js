import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    
  },
  
  // ✅ EXPANDED: More notification types
  type: {
    type: String,
    enum: [
      // Task notifications
      'task_assigned',
      'task_unassigned',
      'task_due_soon',
      'task_overdue',
      'task_reminder',
      'task_completed',
      'task_status_changed',
      'task_priority_changed',
      'task_commented',
      'task_mentioned',
      
      // Project notifications
      'project_created',
      'project_updated',
      'project_completed',
      'project_member_added',
      'project_member_removed',
      'project_deadline_approaching',
      
      // Time tracking
      'time_entry_approved',
      'time_entry_rejected',
      'timesheet_reminder',
      
      // Workspace
      'workspace_invitation',
      'workspace_role_changed',
      
      // Milestone
      'milestone_completed',
      'milestone_due_soon',
      
      // System
      'system_announcement',
      'account_security',
      
      // Generic
      'mention',
      'file_uploaded',
      'comment_reply'
    ],
    required: true
  },
  
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  
  // ✅ ADDED: Rich content support
  content: {
    html: String,           // HTML formatted content
    preview: String,        // Short preview text
    emoji: String,          // Icon/emoji for notification
  },
  
  // ✅ EXPANDED: Related entities
  relatedTask: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    default: null,
    
  },
  
  relatedProject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null,
    
  },
  
  // ✅ ADDED: More related entities
  relatedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  relatedWorkspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    default: null
  },
  
  relatedMilestone: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Milestone',
    default: null
  },
  
  relatedComment: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  
  // ✅ ADDED: Action information
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // ✅ ADDED: Action buttons
  actions: [{
    label: {
      type: String,
      required: true
    },
    action: {
      type: String,
      enum: ['view', 'accept', 'decline', 'approve', 'reject', 'dismiss', 'link'],
      required: true
    },
    url: String,
    primary: {
      type: Boolean,
      default: false
    }
  }],
  
  // ✅ ADDED: Read status
  isRead: {
    type: Boolean,
    default: false,
    
  },
  
  readAt: {
    type: Date,
    default: null
  },
  
  // ✅ ADDED: Delivery channels
  channels: {
    inApp: {
      type: Boolean,
      default: true
    },
    email: {
      type: Boolean,
      default: false
    },
    push: {
      type: Boolean,
      default: false
    },
    emailSentAt: Date,
    pushSentAt: Date
  },
  
  // ✅ ADDED: Priority and category
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  category: {
    type: String,
    enum: ['task', 'project', 'workspace', 'system', 'social', 'time_tracking'],
    default: 'task'
  },
  
  // ✅ ADDED: Metadata for custom data
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },
  
  // ✅ ADDED: Grouping for bundled notifications
  groupKey: {
    type: String,
    default: null,
    
  },
  
  // ✅ ADDED: Expiration
  expiresAt: {
    type: Date,
    default: null,
    
  },
  
  // ✅ ADDED: Soft delete
  isDeleted: {
    type: Boolean,
    default: false,
    
  },
  
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

/* =============================
   INDEXES
============================= */
notificationSchema.index({ user: 1, isRead: 1 });
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isDeleted: 1 });
notificationSchema.index({ user: 1, type: 1 });
notificationSchema.index({ user: 1, category: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { 
  expireAfterSeconds: 0,
  partialFilterExpression: { expiresAt: { $exists: true } }
});

// Compound indexes for common queries
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ user: 1, category: 1, isRead: 1 });

/* =============================
   VIRTUALS
============================= */
notificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt;
});

notificationSchema.virtual('age').get(function() {
  const now = new Date();
  const created = new Date(this.createdAt);
  const diff = now - created;
  
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
});

notificationSchema.virtual('hasActions').get(function() {
  return this.actions && this.actions.length > 0;
});

/* =============================
   METHODS
============================= */
// ✅ Mark as read
notificationSchema.methods.markAsRead = async function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
  }
  return this;
};

// ✅ Mark as unread
notificationSchema.methods.markAsUnread = async function() {
  if (this.isRead) {
    this.isRead = false;
    this.readAt = null;
    return this.save();
  }
  return this;
};

// ✅ Soft delete
notificationSchema.methods.softDelete = async function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// ✅ Add action button
notificationSchema.methods.addAction = async function(label, action, url = null, isPrimary = false) {
  this.actions.push({
    label,
    action,
    url,
    primary: isPrimary
  });
  return this.save();
};

/* =============================
   STATICS
============================= */
// ✅ Create notification helper
notificationSchema.statics.createNotification = async function(data) {
  const {
    userId,
    type,
    title,
    message,
    actor = null,
    relatedTask = null,
    relatedProject = null,
    relatedUser = null,
    priority = 'medium',
    actions = [],
    metadata = {},
    expiresIn = null // hours
  } = data;
  
  const notification = {
    user: userId,
    type,
    title,
    message,
    actor,
    relatedTask,
    relatedProject,
    relatedUser,
    priority,
    actions,
    metadata
  };
  
  // Set category based on type
  if (type.startsWith('task_')) {
    notification.category = 'task';
  } else if (type.startsWith('project_')) {
    notification.category = 'project';
  } else if (type.startsWith('workspace_')) {
    notification.category = 'workspace';
  } else if (type.startsWith('time_')) {
    notification.category = 'time_tracking';
  } else {
    notification.category = 'system';
  }
  
  // Set expiration
  if (expiresIn) {
    notification.expiresAt = new Date(Date.now() + expiresIn * 60 * 60 * 1000);
  }
  
  return this.create(notification);
};

// ✅ Mark all as read for user
notificationSchema.statics.markAllAsRead = async function(userId) {
  return this.updateMany(
    { user: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
};

// ✅ Get unread count
notificationSchema.statics.getUnreadCount = async function(userId) {
  return this.countDocuments({
    user: userId,
    isRead: false,
    isDeleted: false
  });
};

// ✅ Get by category
notificationSchema.statics.getByCategory = async function(userId, category, limit = 20) {
  return this.find({
    user: userId,
    category,
    isDeleted: false
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('actor', 'name email avatar')
    .populate('relatedTask', 'title status')
    .populate('relatedProject', 'name icon color');
};

// ✅ Clean old notifications
notificationSchema.statics.cleanOldNotifications = async function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    isRead: true,
    createdAt: { $lt: cutoffDate }
  });
};

// ✅ Group similar notifications
notificationSchema.statics.groupNotifications = async function(userId, type, relatedEntity) {
  const groupKey = `${type}_${relatedEntity}`;
  
  // Find existing notification in the group
  const existing = await this.findOne({
    user: userId,
    groupKey,
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24h
  });
  
  return existing;
};

/* =============================
   MIDDLEWARE
============================= */
// ✅ Auto-delete expired notifications
notificationSchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    // Auto-expire low priority notifications after 30 days
    if (this.priority === 'low') {
      this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
  }
  next();
});

// ✅ Set content emoji based on type
notificationSchema.pre('save', function(next) {
  if (this.isNew && !this.content?.emoji) {
    const emojiMap = {
      'task_assigned': '📋',
      'task_completed': '✅',
      'task_due_soon': '⏰',
      'task_overdue': '🚨',
      'task_commented': '💬',
      'task_mentioned': '👤',
      'project_created': '🎯',
      'project_completed': '🎉',
      'project_member_added': '👥',
      'milestone_completed': '🏆',
      'workspace_invitation': '✉️',
      'system_announcement': '📢',
      'account_security': '🔒'
    };
    
    if (!this.content) this.content = {};
    this.content.emoji = emojiMap[this.type] || '🔔';
  }
  next();
});

notificationSchema.set('toJSON', { virtuals: true });
notificationSchema.set('toObject', { virtuals: true });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;