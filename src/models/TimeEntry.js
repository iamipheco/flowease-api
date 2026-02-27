// models/TimeEntry.js - STREAMLINED VERSION
import mongoose from 'mongoose';

const timeEntrySchema = new mongoose.Schema({
  // ✅ KEEP - Core references (REQUIRED NOW)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null,
  },
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
  },
  
  // ✅ CHANGED - Use startTime/endTime instead of clockIn/clockOut (REQUIRED NOW)
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
    default: null,  // null = timer is running
  },
  duration: {
    type: Number, // seconds (not milliseconds)
    default: 0,
    min: 0
  },
  
  // ✅ KEEP - Basic fields (USEFUL NOW)
  description: {
    type: String,
    maxlength: 500,
    trim: true
  },
  
  // ✅ KEEP - Billing (NEEDED FOR MANUAL ENTRY & REPORTS)
  isBillable: {
    type: Boolean,
    default: false
  },
  hourlyRate: {
    type: Number,
    min: 0,
    default: 0
  },
  
  // ✅ KEEP - Source tracking (USEFUL NOW)
  source: {
    type: String,
    enum: ['manual', 'timer'],
    default: 'timer',
  },
  
  // ✅ KEEP - Soft delete (USEFUL NOW)
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // ✅ KEEP FOR FUTURE - Tags (EASY TO ADD LATER)
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  // ✅ KEEP FOR FUTURE - Edit history (GOOD TO HAVE)
  editHistory: [{
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    editedAt: {
      type: Date,
      default: Date.now
    },
    changes: {
      type: mongoose.Schema.Types.Mixed
    },
    reason: String
  }],
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/* =============================
   INDEXES - Keep essential ones
============================= */
timeEntrySchema.index({ user: 1, startTime: -1 });
timeEntrySchema.index({ workspace: 1, startTime: -1 });
timeEntrySchema.index({ task: 1 });
timeEntrySchema.index({ project: 1 });
timeEntrySchema.index({ endTime: 1 });  // For finding running timers
timeEntrySchema.index({ user: 1, endTime: 1, isDeleted: 1 });  // Running timer lookup

/* =============================
   VIRTUALS - Keep useful ones
============================= */
timeEntrySchema.virtual('hours').get(function() {
  return parseFloat((this.duration / 3600).toFixed(2));
});

timeEntrySchema.virtual('minutes').get(function() {
  return Math.round(this.duration / 60);
});

timeEntrySchema.virtual('billableAmount').get(function() {
  if (!this.isBillable) return 0;
  const hours = this.hours;
  const rate = this.hourlyRate || 0;
  return parseFloat((hours * rate).toFixed(2));
});

timeEntrySchema.virtual('isRunning').get(function() {
  return !this.endTime;
});

timeEntrySchema.virtual('durationDisplay').get(function() {
  const hours = Math.floor(this.hours);
  const minutes = this.minutes % 60;
  return `${hours}h ${minutes}m`;
});

/* =============================
   MIDDLEWARE - Essential only
============================= */
// ✅ Calculate duration on save
timeEntrySchema.pre('save', function(next) {
  if (this.endTime && this.startTime) {
    this.duration = Math.floor((this.endTime - this.startTime) / 1000); // seconds
  }
  next();
});

/* =============================
   METHODS - Keep essential ones
============================= */
// ✅ Soft delete
timeEntrySchema.methods.softDelete = async function(userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  return this.save();
};

// ✅ Edit entry (with history)
timeEntrySchema.methods.edit = async function(userId, changes, reason = null) {
  // Record edit history
  const editRecord = {
    editedBy: userId,
    editedAt: new Date(),
    changes: {},
    reason
  };
  
  // Track what changed
  Object.keys(changes).forEach(key => {
    if (this[key] !== changes[key]) {
      editRecord.changes[key] = {
        from: this[key],
        to: changes[key]
      };
      this[key] = changes[key];
    }
  });
  
  this.editHistory.push(editRecord);
  return this.save();
};

/* =============================
   STATICS - Keep essential ones
============================= */
// ✅ Get running timer
timeEntrySchema.statics.getRunningTimer = async function(userId) {
  return this.findOne({
    user: userId,
    endTime: null,
    isDeleted: false
  })
    .populate('project', 'name icon color')
    .populate({
      path: 'task',
      select: 'title status',
      populate: {
        path: 'project',
        select: 'name color'
      }
    });
};

// ✅ Get entries for date range
timeEntrySchema.statics.getEntriesForRange = async function(userId, startDate, endDate) {
  return this.find({
    user: userId,
    startTime: { $gte: startDate, $lte: endDate },
    isDeleted: false
  })
    .sort({ startTime: -1 })
    .populate('project', 'name icon color')
    .populate({
      path: 'task',
      select: 'title status',
      populate: {
        path: 'project',
        select: 'name color'
      }
    });
};

export default mongoose.model('TimeEntry', timeEntrySchema);