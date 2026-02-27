import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: { 
      type: String, 
      required: true, 
      trim: true, 
      maxlength: 200 
    },
    description: { 
      type: String, 
      trim: true, 
      maxlength: 2000 
    },
    status: {
      type: String,
      enum: ["todo", "in-progress", "review", "completed", "cancelled"],
      default: "todo",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    category: { 
      type: String, 
      trim: true, 
      default: "general" 
    },
    tags: [{ 
      type: String, 
      trim: true,
      lowercase: true 
    }],
    dueDate: { 
      type: Date, 
      default: null 
    },
    startDate: {
      type: Date,
      default: null
    },
    reminderDate: { 
      type: Date, 
      default: null,
      validate: {
        validator: function(value) {
          return !this.dueDate || !value || value <= this.dueDate;
        },
        message: "Reminder date must be before due date"
      }
    },
    
    // ✅ ENHANCED: Time tracking fields
    timeTracking: {
      estimatedTime: { 
        type: Number, // hours
        default: 0,
        min: 0
      },
      trackedTime: { 
        type: Number, // hours (auto-calculated from TimeEntry)
        default: 0,
        min: 0
      },
      remainingTime: {
        type: Number, // hours (calculated)
        default: null
      },
      isBillable: {
        type: Boolean,
        default: true
      },
      hourlyRate: {
        type: Number,
        default: 0
      }
    },
    
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    
    // ✅ ENHANCED: Better assignee structure
    assignedTo: [
      {
        user: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: "User",
          required: true
        },
        assignedAt: { 
          type: Date, 
          default: Date.now 
        },
        assignedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },
        status: {
          type: String,
          enum: ["pending", "accepted", "declined"],
          default: "pending",
        },
        acceptedAt: Date,
        declinedAt: Date
      },
    ],
    
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    
    // ✅ ADDED: Section for Kanban boards
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      default: null,
    },
    
    // ✅ ENHANCED: Subtask handling
    parentTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    subtasks: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Task" 
    }],
    
    // ✅ ADDED: Counters for performance
    counters: {
      subtasks: { type: Number, default: 0, min: 0 },
      completedSubtasks: { type: Number, default: 0, min: 0 },
      comments: { type: Number, default: 0, min: 0 },
      attachments: { type: Number, default: 0, min: 0 }
    },
    
    attachments: [
      {
        filename: String,
        url: String,
        fileSize: Number, // bytes
        mimeType: String,
        uploadedAt: { 
          type: Date, 
          default: Date.now 
        },
        uploadedBy: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: "User" 
        },
      },
    ],
    
    comments: [
      {
        user: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: "User",
          required: true
        },
        text: { 
          type: String, 
          required: true, 
          maxlength: 1000 
        },
        createdAt: { 
          type: Date, 
          default: Date.now 
        },
        editedAt: Date,
        isEdited: {
          type: Boolean,
          default: false
        }
      },
    ],
    
    // ✅ ENHANCED: Completion tracking
    completedAt: {
      type: Date,
      default: null
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    
    isArchived: { 
      type: Boolean, 
      default: false 
    },
    
    progress: { 
      type: Number, 
      min: 0, 
      max: 100, 
      default: 0 
    },
    
    // ✅ ADDED: Dependencies
    dependencies: [{
      task: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task"
      },
      type: {
        type: String,
        enum: ["blocks", "blocked-by", "related"],
        default: "related"
      }
    }],
    
    // ✅ ADDED: Recurrence for recurring tasks
    recurrence: {
      isRecurring: {
        type: Boolean,
        default: false
      },
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly", "yearly"],
        default: "weekly"
      },
      interval: {
        type: Number,
        default: 1,
        min: 1
      },
      endDate: Date,
      nextOccurrence: Date
    },
    
    // ✅ ADDED: Custom fields for flexibility
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: new Map()
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
taskSchema.index({ createdBy: 1, status: 1 });
taskSchema.index({ "assignedTo.user": 1 });
taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ project: 1, section: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ tags: 1 });
taskSchema.index({ category: 1 });
taskSchema.index({ priority: 1 });
taskSchema.index({ status: 1, dueDate: 1 }); // For overdue queries
taskSchema.index({ parentTask: 1 });
taskSchema.index({ createdAt: -1 });

/* =============================
   VIRTUALS
============================= */
taskSchema.virtual("isOverdue").get(function () {
  if (!this.dueDate || ["completed", "cancelled"].includes(this.status))
    return false;
  return new Date() > this.dueDate;
});

// ✅ ADDED: More useful virtuals
taskSchema.virtual("daysRemaining").get(function () {
  if (!this.dueDate) return null;
  const now = new Date();
  const due = new Date(this.dueDate);
  const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  return diff;
});

taskSchema.virtual("isCompleted").get(function () {
  return this.status === "completed";
});

taskSchema.virtual("isCancelled").get(function () {
  return this.status === "cancelled";
});

taskSchema.virtual("assigneeCount").get(function () {
  return this.assignedTo ? this.assignedTo.length : 0;
});

taskSchema.virtual("hasSubtasks").get(function () {
  return this.counters.subtasks > 0;
});

taskSchema.virtual("subtaskProgress").get(function () {
  if (!this.counters.subtasks || this.counters.subtasks === 0) return 0;
  return Math.round((this.counters.completedSubtasks / this.counters.subtasks) * 100);
});

taskSchema.virtual("timeRemaining").get(function () {
  if (!this.timeTracking.estimatedTime) return null;
  return Math.max(0, this.timeTracking.estimatedTime - this.timeTracking.trackedTime);
});

taskSchema.virtual("isOverBudget").get(function () {
  if (!this.timeTracking.estimatedTime) return false;
  return this.timeTracking.trackedTime > this.timeTracking.estimatedTime;
});

/* =============================
   METHODS
============================= */
// ✅ ADDED: Helper methods
taskSchema.methods.assignUser = async function(userId, assignedBy = null) {
  // Check if already assigned
  const exists = this.assignedTo.some(
    assignment => assignment.user.toString() === userId.toString()
  );
  
  if (exists) {
    throw new Error("User is already assigned to this task");
  }
  
  this.assignedTo.push({
    user: userId,
    assignedBy,
    assignedAt: new Date(),
    status: "pending"
  });
  
  return this.save();
};

taskSchema.methods.unassignUser = async function(userId) {
  this.assignedTo = this.assignedTo.filter(
    assignment => assignment.user.toString() !== userId.toString()
  );
  return this.save();
};

taskSchema.methods.acceptAssignment = async function(userId) {
  const assignment = this.assignedTo.find(
    a => a.user.toString() === userId.toString()
  );
  
  if (!assignment) {
    throw new Error("User is not assigned to this task");
  }
  
  assignment.status = "accepted";
  assignment.acceptedAt = new Date();
  
  return this.save();
};

taskSchema.methods.declineAssignment = async function(userId) {
  const assignment = this.assignedTo.find(
    a => a.user.toString() === userId.toString()
  );
  
  if (!assignment) {
    throw new Error("User is not assigned to this task");
  }
  
  assignment.status = "declined";
  assignment.declinedAt = new Date();
  
  return this.save();
};

taskSchema.methods.addComment = async function(userId, text) {
  this.comments.push({
    user: userId,
    text,
    createdAt: new Date()
  });
  
  this.counters.comments += 1;
  
  return this.save();
};

taskSchema.methods.addAttachment = async function(attachment) {
  this.attachments.push(attachment);
  this.counters.attachments += 1;
  return this.save();
};

taskSchema.methods.updateProgress = async function() {
  // Auto-calculate progress based on subtasks
  if (this.counters.subtasks > 0) {
    this.progress = Math.round(
      (this.counters.completedSubtasks / this.counters.subtasks) * 100
    );
  }
  return this.save();
};

taskSchema.methods.markComplete = async function(completedBy) {
  this.status = "completed";
  this.progress = 100;
  this.completedAt = new Date();
  this.completedBy = completedBy;
  return this.save();
};

taskSchema.methods.markInProgress = async function() {
  if (this.status === "todo") {
    this.status = "in-progress";
    if (!this.startDate) {
      this.startDate = new Date();
    }
  }
  return this.save();
};

/* =============================
   MIDDLEWARE
============================= */
// ✅ Auto-update counters when comments/attachments change
taskSchema.pre("save", function(next) {
  // Update comment counter
  if (this.isModified("comments")) {
    this.counters.comments = this.comments.length;
  }
  
  // Update attachment counter
  if (this.isModified("attachments")) {
    this.counters.attachments = this.attachments.length;
  }
  
  // Update subtask counter
  if (this.isModified("subtasks")) {
    this.counters.subtasks = this.subtasks.length;
  }
  
  next();
});

// ✅ Auto-set completedAt when status changes
taskSchema.pre("save", function(next) {
  if (this.isModified("status")) {
    if (this.status === "completed" && !this.completedAt) {
      this.completedAt = new Date();
    } else if (this.status !== "completed") {
      this.completedAt = null;
      this.completedBy = null;
    }
    
    // Set startDate when moving to in-progress
    if (this.status === "in-progress" && !this.startDate) {
      this.startDate = new Date();
    }
  }
  next();
});

// ✅ Update parent task when subtask changes
taskSchema.pre("save", async function(next) {
  if (this.parentTask && this.isModified("status")) {
    try {
      const Task = mongoose.model("Task");
      const parent = await Task.findById(this.parentTask);
      
      if (parent) {
        // Count completed subtasks
        const completedCount = await Task.countDocuments({
          parentTask: this.parentTask,
          status: "completed"
        });
        
        parent.counters.completedSubtasks = completedCount;
        await parent.updateProgress();
      }
    } catch (error) {
      console.error("Error updating parent task:", error);
    }
  }
  next();
});

// ✅ Update project counters when task changes
taskSchema.pre("save", async function(next) {
  if (this.project && this.isModified("status")) {
    try {
      const Project = mongoose.model("Project");
      const Task = mongoose.model("Task");
      
      const project = await Project.findById(this.project);
      
      if (project) {
        const completedCount = await Task.countDocuments({
          project: this.project,
          status: "completed"
        });
        
        project.counters.completedSubtasks = completedCount;
        await project.save();
      }
    } catch (error) {
      console.error("Error updating project:", error);
    }
  }
  next();
});

// ✅ Cascade delete subtasks
taskSchema.pre("deleteOne", { document: true, query: false }, async function(next) {
  try {
    const Task = mongoose.model("Task");
    const TimeEntry = mongoose.model("TimeEntry");
    
    // Delete all subtasks
    await Task.deleteMany({ parentTask: this._id });
    
    // Delete all time entries
    await TimeEntry.deleteMany({ task: this._id });
    
    next();
  } catch (error) {
    next(error);
  }
});

export default mongoose.model("Task", taskSchema);