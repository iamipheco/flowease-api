// models/Section.js
import mongoose from 'mongoose';

const sectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Section name is required'],
    trim: true,
    maxlength: [100, 'Section name cannot exceed 100 characters']
  },
  
  // ✅ ADDED: Description for section
  description: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  },
  
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project reference is required'],
  },
  
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
  },
  
  order: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // ✅ ADDED: Visual customization
  color: {
    type: String,
    default: '#94a3b8', // slate-400
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please provide a valid hex color']
  },
  
  icon: {
    type: String,
    default: null,
    maxlength: 10 // emoji or icon identifier
  },
  
  // ✅ ADDED: Section type/category
  type: {
    type: String,
    enum: ['backlog', 'todo', 'in-progress', 'review', 'done', 'custom'],
    default: 'custom'
  },
  
  // ✅ ADDED: WIP (Work In Progress) limit
  wipLimit: {
    enabled: {
      type: Boolean,
      default: false
    },
    limit: {
      type: Number,
      min: 1,
      default: null
    }
  },
  
  // ✅ ADDED: Task counters
  counters: {
    totalTasks: { type: Number, default: 0, min: 0 },
    completedTasks: { type: Number, default: 0, min: 0 },
    activeTasks: { type: Number, default: 0, min: 0 }
  },
  
  // ✅ ADDED: Section settings
  settings: {
    // Auto-actions
    autoComplete: {
      type: Boolean,
      default: false // Auto-complete tasks when moved to this section
    },
    autoArchive: {
      type: Boolean,
      default: false // Auto-archive tasks after X days
    },
    archiveAfterDays: {
      type: Number,
      min: 1,
      default: 30
    },
    // Visibility
    isCollapsed: {
      type: Boolean,
      default: false
    },
    isVisible: {
      type: Boolean,
      default: true
    }
  },
  
  // ✅ ADDED: Automation rules
  automations: [{
    trigger: {
      type: String,
      enum: ['task_moved_in', 'task_moved_out', 'task_created', 'task_completed'],
      required: true
    },
    action: {
      type: String,
      enum: ['assign_user', 'set_status', 'add_label', 'send_notification', 'set_due_date'],
      required: true
    },
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    enabled: {
      type: Boolean,
      default: true
    }
  }],
  
  isArchived: {
    type: Boolean,
    default: false
  },
  
  archivedAt: {
    type: Date,
    default: null
  },
  
  archivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // ✅ ADDED: Creator tracking
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // ✅ ADDED: Last modified tracking
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
// Compound indexes
sectionSchema.index({ project: 1, order: 1 });
sectionSchema.index({ project: 1, name: 1 }, { unique: true });
sectionSchema.index({ workspace: 1 });
sectionSchema.index({ project: 1, isArchived: 1 });
sectionSchema.index({ type: 1 });
sectionSchema.index({ createdBy: 1 });
sectionSchema.index({ createdAt: -1 });

/* =============================
   VIRTUALS
============================= */
sectionSchema.virtual('taskCount').get(function() {
  return this.counters.totalTasks;
});

sectionSchema.virtual('completionRate').get(function() {
  if (this.counters.totalTasks === 0) return 0;
  return Math.round((this.counters.completedTasks / this.counters.totalTasks) * 100);
});

sectionSchema.virtual('isAtWipLimit').get(function() {
  if (!this.wipLimit.enabled || !this.wipLimit.limit) return false;
  return this.counters.activeTasks >= this.wipLimit.limit;
});

sectionSchema.virtual('wipPercentage').get(function() {
  if (!this.wipLimit.enabled || !this.wipLimit.limit) return 0;
  return Math.round((this.counters.activeTasks / this.wipLimit.limit) * 100);
});

sectionSchema.virtual('isBacklog').get(function() {
  return this.type === 'backlog';
});

sectionSchema.virtual('isDone').get(function() {
  return this.type === 'done';
});

sectionSchema.virtual('canAddTask').get(function() {
  if (!this.wipLimit.enabled) return true;
  return !this.isAtWipLimit;
});

sectionSchema.virtual('hasAutomations').get(function() {
  return this.automations && this.automations.length > 0;
});

/* =============================
   METHODS
============================= */
// ✅ Update task counters
sectionSchema.methods.updateCounters = async function() {
  const Task = mongoose.model('Task');
  
  const [total, completed] = await Promise.all([
    Task.countDocuments({ section: this._id, isArchived: false }),
    Task.countDocuments({ section: this._id, status: 'completed', isArchived: false })
  ]);
  
  this.counters.totalTasks = total;
  this.counters.completedTasks = completed;
  this.counters.activeTasks = total - completed;
  
  return this.save({ validateBeforeSave: false });
};

// ✅ Move to position
sectionSchema.methods.moveTo = async function(newOrder) {
  const Section = this.constructor;
  
  if (newOrder === this.order) return this;
  
  // Get all sections in the same project
  const sections = await Section.find({ 
    project: this.project,
    _id: { $ne: this._id },
    isArchived: false
  }).sort({ order: 1 });
  
  // Update orders
  if (newOrder > this.order) {
    // Moving down
    await Section.updateMany(
      {
        project: this.project,
        order: { $gt: this.order, $lte: newOrder }
      },
      { $inc: { order: -1 } }
    );
  } else {
    // Moving up
    await Section.updateMany(
      {
        project: this.project,
        order: { $gte: newOrder, $lt: this.order }
      },
      { $inc: { order: 1 } }
    );
  }
  
  this.order = newOrder;
  return this.save();
};

// ✅ Archive section
sectionSchema.methods.archive = async function(userId) {
  this.isArchived = true;
  this.archivedAt = new Date();
  this.archivedBy = userId;
  
  // Archive all tasks in this section
  const Task = mongoose.model('Task');
  await Task.updateMany(
    { section: this._id },
    { $set: { isArchived: true } }
  );
  
  return this.save();
};

// ✅ Unarchive section
sectionSchema.methods.unarchive = async function() {
  this.isArchived = false;
  this.archivedAt = null;
  this.archivedBy = null;
  return this.save();
};

// ✅ Duplicate section
sectionSchema.methods.duplicate = async function(userId, newName = null) {
  const Section = this.constructor;
  
  const duplicate = new Section({
    name: newName || `${this.name} (Copy)`,
    description: this.description,
    project: this.project,
    workspace: this.workspace,
    order: this.order + 1,
    color: this.color,
    icon: this.icon,
    type: 'custom', // Duplicates are always custom
    wipLimit: { ...this.wipLimit },
    settings: { ...this.settings },
    automations: [...this.automations],
    createdBy: userId
  });
  
  // Shift other sections down
  await Section.updateMany(
    {
      project: this.project,
      order: { $gt: this.order }
    },
    { $inc: { order: 1 } }
  );
  
  return duplicate.save();
};

// ✅ Add automation
sectionSchema.methods.addAutomation = async function(automation) {
  this.automations.push(automation);
  return this.save();
};

// ✅ Remove automation
sectionSchema.methods.removeAutomation = async function(automationId) {
  this.automations = this.automations.filter(
    a => a._id.toString() !== automationId.toString()
  );
  return this.save();
};

// ✅ Toggle automation
sectionSchema.methods.toggleAutomation = async function(automationId) {
  const automation = this.automations.find(
    a => a._id.toString() === automationId.toString()
  );
  
  if (automation) {
    automation.enabled = !automation.enabled;
    return this.save();
  }
  
  throw new Error('Automation not found');
};

// ✅ Check WIP limit
sectionSchema.methods.checkWipLimit = function() {
  if (!this.wipLimit.enabled) return { allowed: true, message: null };
  
  if (this.isAtWipLimit) {
    return {
      allowed: false,
      message: `This section has reached its WIP limit of ${this.wipLimit.limit} tasks`
    };
  }
  
  return { allowed: true, message: null };
};

/* =============================
   STATICS
============================= */
// ✅ Get sections for project
sectionSchema.statics.getProjectSections = async function(projectId, includeArchived = false) {
  const query = { project: projectId };
  if (!includeArchived) {
    query.isArchived = false;
  }
  
  return this.find(query)
    .sort({ order: 1 })
    .populate('createdBy', 'name email profile.image');
};

// ✅ Create default sections
sectionSchema.statics.createDefaultSections = async function(projectId, workspaceId, userId) {
  const defaultSections = [
    { name: 'To Do', type: 'todo', icon: '📋', color: '#64748b', order: 0 },
    { name: 'In Progress', type: 'in-progress', icon: '🔄', color: '#3b82f6', order: 1 },
    { name: 'Review', type: 'review', icon: '👀', color: '#f59e0b', order: 2 },
    { name: 'Done', type: 'done', icon: '✅', color: '#10b981', order: 3, settings: { autoComplete: true } }
  ];
  
  const sections = defaultSections.map(section => ({
    ...section,
    project: projectId,
    workspace: workspaceId,
    createdBy: userId
  }));
  
  return this.insertMany(sections);
};

// ✅ Reorder sections
sectionSchema.statics.reorder = async function(sectionIds) {
  const updates = sectionIds.map((id, index) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { order: index } }
    }
  }));
  
  return this.bulkWrite(updates);
};

// ✅ Get section with task count
sectionSchema.statics.getSectionWithStats = async function(sectionId) {
  const section = await this.findById(sectionId);
  if (!section) return null;
  
  await section.updateCounters();
  return section;
};

// ✅ Move tasks between sections
sectionSchema.statics.moveTasks = async function(fromSectionId, toSectionId, taskIds = null) {
  const Task = mongoose.model('Task');
  
  const query = { section: fromSectionId };
  if (taskIds) {
    query._id = { $in: taskIds };
  }
  
  const result = await Task.updateMany(
    query,
    { $set: { section: toSectionId } }
  );
  
  // Update counters for both sections
  const [fromSection, toSection] = await Promise.all([
    this.findById(fromSectionId),
    this.findById(toSectionId)
  ]);
  
  if (fromSection) await fromSection.updateCounters();
  if (toSection) await toSection.updateCounters();
  
  return result;
};

/* =============================
   MIDDLEWARE
============================= */
// ✅ Auto-set order for new sections
sectionSchema.pre('save', async function(next) {
  if (this.isNew && this.order === 0) {
    const Section = this.constructor;
    const maxOrder = await Section.findOne({ project: this.project })
      .sort({ order: -1 })
      .select('order')
      .lean();
    
    this.order = maxOrder ? maxOrder.order + 1 : 0;
  }
  next();
});

// ✅ Update lastModifiedBy
sectionSchema.pre('save', function(next) {
  if (!this.isNew && this.isModified()) {
    // This should be set by the controller
    // this.lastModifiedBy = currentUserId;
  }
  next();
});

// ✅ Cascade delete tasks when section is deleted
sectionSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    const Task = mongoose.model('Task');
    
    // Move tasks to project's default section or delete
    // Option 1: Move to first non-deleted section
    const Section = this.constructor;
    const firstSection = await Section.findOne({
      project: this.project,
      _id: { $ne: this._id },
      isArchived: false
    }).sort({ order: 1 });
    
    if (firstSection) {
      await Task.updateMany(
        { section: this._id },
        { $set: { section: firstSection._id } }
      );
      await firstSection.updateCounters();
    } else {
      // No other sections, remove section reference
      await Task.updateMany(
        { section: this._id },
        { $set: { section: null } }
      );
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// ✅ Update project when section order changes
sectionSchema.post('save', async function(doc) {
  // Update project's last modified timestamp
  const Project = mongoose.model('Project');
  await Project.findByIdAndUpdate(doc.project, {
    $set: { updatedAt: new Date() }
  });
});

export default mongoose.model('Section', sectionSchema);