// models/Milestone.js
import mongoose from 'mongoose';

const milestoneSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Milestone title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: ''
  },
  
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project reference is required']
  },
  
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  
  // ✅ ADDED: Start and end dates
  startDate: {
    type: Date,
    default: null
  },
  
  dueDate: {
    type: Date,
    required: true
  },
  
  completedDate: {
    type: Date,
    default: null
  },
  
  // ✅ ADDED: Milestone type
  type: {
    type: String,
    enum: ['feature', 'release', 'sprint', 'phase', 'goal', 'deliverable', 'custom'],
    default: 'custom'
  },
  
  // ✅ ADDED: Priority
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  
  // ✅ ENHANCED: Status with more options
  status: {
    type: String,
    enum: ['not-started', 'in-progress', 'on-hold', 'at-risk', 'completed', 'cancelled'],
    default: 'not-started'
  },
  
  // ✅ ADDED: Health status
  health: {
    type: String,
    enum: ['on-track', 'at-risk', 'off-track'],
    default: 'on-track'
  },
  
  // ✅ ENHANCED: Team with roles
  team: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      default: 'Member'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ✅ ADDED: Owner/Lead
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // ✅ ADDED: Linked tasks
  tasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  
  // ✅ ADDED: Subtasks/checklist
  checklist: [{
    title: {
      type: String,
      required: true,
      maxlength: 200
    },
    isCompleted: {
      type: Boolean,
      default: false
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    completedAt: Date,
    order: {
      type: Number,
      default: 0
    }
  }],
  
  // ✅ ADDED: Dependencies
  dependencies: [{
    milestone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Milestone'
    },
    type: {
      type: String,
      enum: ['blocks', 'blocked-by', 'related'],
      default: 'related'
    }
  }],
  
  // ✅ ADDED: Success criteria
  successCriteria: [{
    criterion: {
      type: String,
      required: true,
      maxlength: 500
    },
    isMet: {
      type: Boolean,
      default: false
    },
    metAt: Date,
    metBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  }],
  
  // ✅ ADDED: Metrics/KPIs
  metrics: [{
    name: {
      type: String,
      required: true
    },
    target: {
      type: Number,
      required: true
    },
    current: {
      type: Number,
      default: 0
    },
    unit: {
      type: String,
      default: ''
    }
  }],
  
  // ✅ ADDED: Budget tracking
  budget: {
    estimated: {
      type: Number,
      default: 0
    },
    actual: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  
  // ✅ ADDED: Time tracking
  timeTracking: {
    estimatedHours: {
      type: Number,
      default: 0
    },
    trackedHours: {
      type: Number,
      default: 0
    }
  },
  
  // ✅ ADDED: Tags
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  // ✅ ADDED: Visual customization
  color: {
    type: String,
    default: '#3b82f6',
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please provide a valid hex color']
  },
  
  icon: {
    type: String,
    default: '🎯',
    maxlength: 10
  },
  
  // ✅ ADDED: Attachments
  attachments: [{
    filename: String,
    url: String,
    fileSize: Number,
    mimeType: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ✅ ADDED: Notes/Updates
  updates: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ✅ ADDED: Reminder settings
  reminders: [{
    type: {
      type: String,
      enum: ['before-due', 'on-due', 'custom'],
      default: 'before-due'
    },
    days: {
      type: Number,
      default: 1
    },
    date: Date,
    sent: {
      type: Boolean,
      default: false
    }
  }],
  
  // ✅ ADDED: Recurring milestone
  recurrence: {
    isRecurring: {
      type: Boolean,
      default: false
    },
    frequency: {
      type: String,
      enum: ['weekly', 'monthly', 'quarterly', 'yearly'],
      default: 'monthly'
    },
    interval: {
      type: Number,
      default: 1,
      min: 1
    },
    endDate: Date,
    nextOccurrence: Date
  },
  
  isArchived: {
    type: Boolean,
    default: false
  },
  
  archivedAt: Date,
  
  archivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // ✅ ADDED: Metadata
  metadata: {
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
milestoneSchema.index({ project: 1, dueDate: 1 });
milestoneSchema.index({ workspace: 1, dueDate: 1 });
milestoneSchema.index({ createdBy: 1 });
milestoneSchema.index({ owner: 1 });
milestoneSchema.index({ status: 1, dueDate: 1 });
milestoneSchema.index({ 'team.user': 1 });
milestoneSchema.index({ priority: 1 });
milestoneSchema.index({ type: 1 });
milestoneSchema.index({ isArchived: 1 });
milestoneSchema.index({ createdAt: -1 });

// Compound indexes
milestoneSchema.index({ project: 1, status: 1, isArchived: 1 });
milestoneSchema.index({ workspace: 1, status: 1, dueDate: 1 });

/* =============================
   VIRTUALS
============================= */
milestoneSchema.virtual('isOverdue').get(function() {
  if (this.status === 'completed' || this.status === 'cancelled') return false;
  return this.dueDate && new Date() > this.dueDate;
});

milestoneSchema.virtual('daysRemaining').get(function() {
  if (!this.dueDate) return null;
  const now = new Date();
  const due = new Date(this.dueDate);
  const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  return diff;
});

milestoneSchema.virtual('daysUntilStart').get(function() {
  if (!this.startDate) return null;
  const now = new Date();
  const start = new Date(this.startDate);
  const diff = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
});

milestoneSchema.virtual('duration').get(function() {
  if (!this.startDate || !this.dueDate) return null;
  const start = new Date(this.startDate);
  const due = new Date(this.dueDate);
  return Math.ceil((due - start) / (1000 * 60 * 60 * 24));
});

milestoneSchema.virtual('isCompleted').get(function() {
  return this.status === 'completed';
});

milestoneSchema.virtual('isActive').get(function() {
  return this.status === 'in-progress' && !this.isOverdue;
});

milestoneSchema.virtual('isAtRisk').get(function() {
  return this.health === 'at-risk' || this.health === 'off-track';
});

milestoneSchema.virtual('teamCount').get(function() {
  return this.team ? this.team.length : 0;
});

milestoneSchema.virtual('checklistProgress').get(function() {
  if (!this.checklist || this.checklist.length === 0) return 0;
  const completed = this.checklist.filter(item => item.isCompleted).length;
  return Math.round((completed / this.checklist.length) * 100);
});

milestoneSchema.virtual('tasksProgress').get(function() {
  // This would need to be populated from Task model
  return this.progress;
});

milestoneSchema.virtual('budgetPercentage').get(function() {
  if (!this.budget.estimated || this.budget.estimated === 0) return 0;
  return Math.round((this.budget.actual / this.budget.estimated) * 100);
});

milestoneSchema.virtual('isOverBudget').get(function() {
  return this.budget.actual > this.budget.estimated;
});

milestoneSchema.virtual('timePercentage').get(function() {
  if (!this.timeTracking.estimatedHours || this.timeTracking.estimatedHours === 0) return 0;
  return Math.round((this.timeTracking.trackedHours / this.timeTracking.estimatedHours) * 100);
});

milestoneSchema.virtual('successCriteriaProgress').get(function() {
  if (!this.successCriteria || this.successCriteria.length === 0) return 100;
  const met = this.successCriteria.filter(c => c.isMet).length;
  return Math.round((met / this.successCriteria.length) * 100);
});

milestoneSchema.virtual('canComplete').get(function() {
  // Can only complete if all success criteria are met
  return this.successCriteriaProgress === 100;
});

milestoneSchema.virtual('displayName').get(function() {
  return `${this.icon} ${this.title}`;
});

/* =============================
   METHODS
============================= */
// ✅ Update progress
milestoneSchema.methods.updateProgress = async function() {
  const Task = mongoose.model('Task');
  
  if (this.tasks.length > 0) {
    const tasks = await Task.find({ _id: { $in: this.tasks } });
    const completed = tasks.filter(t => t.status === 'completed').length;
    this.progress = Math.round((completed / tasks.length) * 100);
  } else if (this.checklist.length > 0) {
    this.progress = this.checklistProgress;
  }
  
  // Auto-update status based on progress
  if (this.progress === 0 && this.status === 'not-started') {
    // Keep as not-started
  } else if (this.progress > 0 && this.progress < 100 && this.status === 'not-started') {
    this.status = 'in-progress';
  } else if (this.progress === 100 && this.status !== 'completed') {
    this.status = 'completed';
    this.completedDate = new Date();
  }
  
  return this.save({ validateBeforeSave: false });
};

// ✅ Add team member
milestoneSchema.methods.addTeamMember = async function(userId, role = 'Member') {
  const exists = this.team.some(m => m.user.toString() === userId.toString());
  if (exists) {
    throw new Error('User is already a team member');
  }
  
  this.team.push({
    user: userId,
    role,
    addedAt: new Date()
  });
  
  return this.save();
};

// ✅ Remove team member
milestoneSchema.methods.removeTeamMember = async function(userId) {
  this.team = this.team.filter(m => m.user.toString() !== userId.toString());
  return this.save();
};

// ✅ Add checklist item
milestoneSchema.methods.addChecklistItem = async function(title) {
  const maxOrder = this.checklist.length > 0 
    ? Math.max(...this.checklist.map(item => item.order))
    : -1;
  
  this.checklist.push({
    title,
    isCompleted: false,
    order: maxOrder + 1
  });
  
  return this.save();
};

// ✅ Complete checklist item
milestoneSchema.methods.completeChecklistItem = async function(itemId, userId) {
  const item = this.checklist.id(itemId);
  if (!item) {
    throw new Error('Checklist item not found');
  }
  
  item.isCompleted = true;
  item.completedBy = userId;
  item.completedAt = new Date();
  
  await this.updateProgress();
  return this.save();
};

// ✅ Mark success criterion as met
milestoneSchema.methods.markCriterionMet = async function(criterionId, userId) {
  const criterion = this.successCriteria.id(criterionId);
  if (!criterion) {
    throw new Error('Success criterion not found');
  }
  
  criterion.isMet = true;
  criterion.metAt = new Date();
  criterion.metBy = userId;
  
  // Check if all criteria met
  if (this.canComplete) {
    await this.complete(userId);
  }
  
  return this.save();
};

// ✅ Add update/note
milestoneSchema.methods.addUpdate = async function(userId, message) {
  this.updates.push({
    user: userId,
    message,
    createdAt: new Date()
  });
  
  return this.save();
};

// ✅ Complete milestone
milestoneSchema.methods.complete = async function(userId) {
  this.status = 'completed';
  this.progress = 100;
  this.completedDate = new Date();
  this.lastModifiedBy = userId;
  
  // Create notification
  const Notification = mongoose.model('Notification');
  await Notification.createNotification({
    userId: this.createdBy,
    type: 'milestone_completed',
    title: 'Milestone Completed',
    message: `${this.title} has been completed`,
    relatedProject: this.project,
    relatedMilestone: this._id,
    actor: userId,
    priority: 'high'
  });
  
  return this.save();
};

// ✅ Archive milestone
milestoneSchema.methods.archive = async function(userId) {
  this.isArchived = true;
  this.archivedAt = new Date();
  this.archivedBy = userId;
  return this.save();
};

// ✅ Calculate health status
milestoneSchema.methods.calculateHealth = async function() {
  const now = new Date();
  const due = new Date(this.dueDate);
  const daysRemaining = this.daysRemaining;
  
  if (this.status === 'completed') {
    this.health = 'on-track';
    return this.save({ validateBeforeSave: false });
  }
  
  // If overdue, definitely off-track
  if (daysRemaining < 0) {
    this.health = 'off-track';
    return this.save({ validateBeforeSave: false });
  }
  
  // Calculate expected progress based on time
  let expectedProgress = 0;
  if (this.startDate) {
    const totalDays = this.duration;
    const elapsedDays = totalDays - daysRemaining;
    expectedProgress = (elapsedDays / totalDays) * 100;
  }
  
  // Compare actual vs expected progress
  const progressGap = this.progress - expectedProgress;
  
  if (progressGap >= 0) {
    this.health = 'on-track';
  } else if (progressGap >= -20) {
    this.health = 'at-risk';
  } else {
    this.health = 'off-track';
  }
  
  return this.save({ validateBeforeSave: false });
};

/* =============================
   STATICS
============================= */
// ✅ Get project milestones
milestoneSchema.statics.getProjectMilestones = async function(projectId, includeArchived = false) {
  const query = { project: projectId };
  if (!includeArchived) {
    query.isArchived = false;
  }
  
  return this.find(query)
    .sort({ dueDate: 1 })
    .populate('owner', 'name email profile.image')
    .populate('team.user', 'name profile.image');
};

// ✅ Get upcoming milestones
milestoneSchema.statics.getUpcoming = async function(workspaceId, days = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    workspace: workspaceId,
    dueDate: { $gte: new Date(), $lte: futureDate },
    status: { $nin: ['completed', 'cancelled'] },
    isArchived: false
  })
    .sort({ dueDate: 1 })
    .populate('project', 'name icon color')
    .populate('owner', 'name profile.image');
};

// ✅ Get overdue milestones
milestoneSchema.statics.getOverdue = async function(workspaceId) {
  return this.find({
    workspace: workspaceId,
    dueDate: { $lt: new Date() },
    status: { $nin: ['completed', 'cancelled'] },
    isArchived: false
  })
    .sort({ dueDate: 1 })
    .populate('project', 'name icon color')
    .populate('owner', 'name profile.image');
};

// ✅ Get milestones by status
milestoneSchema.statics.getByStatus = async function(workspaceId, status) {
  return this.find({
    workspace: workspaceId,
    status,
    isArchived: false
  })
    .sort({ dueDate: 1 })
    .populate('project', 'name icon color');
};

// ✅ Get workspace statistics
milestoneSchema.statics.getWorkspaceStats = async function(workspaceId) {
  const milestones = await this.find({
    workspace: workspaceId,
    isArchived: false
  });
  
  const stats = {
    total: milestones.length,
    notStarted: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
    atRisk: 0,
    onTrack: 0,
    averageProgress: 0,
    upcomingThisWeek: 0,
    upcomingThisMonth: 0
  };
  
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  let totalProgress = 0;
  
  milestones.forEach(milestone => {
    // Status counts
    if (milestone.status === 'not-started') stats.notStarted++;
    if (milestone.status === 'in-progress') stats.inProgress++;
    if (milestone.status === 'completed') stats.completed++;
    
    // Health counts
    if (milestone.isOverdue) stats.overdue++;
    if (milestone.health === 'at-risk') stats.atRisk++;
    if (milestone.health === 'on-track') stats.onTrack++;
    
    // Upcoming counts
    if (milestone.dueDate <= weekFromNow && milestone.dueDate >= now) {
      stats.upcomingThisWeek++;
    }
    if (milestone.dueDate <= monthFromNow && milestone.dueDate >= now) {
      stats.upcomingThisMonth++;
    }
    
    totalProgress += milestone.progress;
  });
  
  stats.averageProgress = milestones.length > 0 
    ? Math.round(totalProgress / milestones.length) 
    : 0;
  
  return stats;
};

/* =============================
   MIDDLEWARE
============================= */
// ✅ Calculate health before save
milestoneSchema.pre('save', async function(next) {
  if (this.isModified('progress') || this.isModified('dueDate')) {
    await this.calculateHealth();
  }
  next();
});

// ✅ Update project when milestone changes
milestoneSchema.post('save', async function(doc) {
  const Project = mongoose.model('Project');
  await Project.findByIdAndUpdate(doc.project, {
    $set: { updatedAt: new Date() }
  });
});

export default mongoose.model('Milestone', milestoneSchema);