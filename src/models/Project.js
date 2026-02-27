import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Project name required"],
      trim: true,
      maxlength: [100, "Project name max 100 chars"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description max 1000 chars"],
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    status: {
      type: String,
      enum: ["planning", "active", "on-hold", "completed", "archived"],
      default: "planning",
    },
    startDate: Date,
    endDate: {
      type: Date,
      validate: {
        validator: function (value) {
          return !this.startDate || value >= this.startDate;
        },
        message: "End date must be after start date",
      },
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    progress: { 
      type: Number, 
      min: 0, 
      max: 100, 
      default: 0 
    },
    isArchived: { 
      type: Boolean, 
      default: false 
    },
    tags: [{ 
      type: String, 
      trim: true, 
      lowercase: true 
    }],
    settings: {
      allowComments: { type: Boolean, default: true },
      allowFileUploads: { type: Boolean, default: true },
      isPublic: { type: Boolean, default: false },
    },
    
    // ✅ ADDED: Owner field
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    
    // ✅ IMPROVED: Counter fields with better structure
    counters: {
      subtasks: { type: Number, default: 0, min: 0 },
      files: { type: Number, default: 0, min: 0 },
      messages: { type: Number, default: 0, min: 0 },
      completedSubtasks: { type: Number, default: 0, min: 0 }
    },
    
    // ✅ IMPROVED: Team with more details
    team: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true
        },
        role: {
          type: String,
          default: "Member"
        },
        addedAt: {
          type: Date,
          default: Date.now
        },
        addedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        }
      },
    ],
    
    // ✅ ADDED: Icon and color for better UI
    icon: {
      type: String,
      default: "📋"
    },
    color: {
      type: String,
      default: "#4ecdc4"
    },
    
    // ✅ ADDED: Deadline tracking
    deadline: {
      type: Date,
      default: null
    },
    
    // ✅ ADDED: Budget tracking (optional)
    budget: {
      estimated: { type: Number, default: 0 },
      actual: { type: Number, default: 0 },
      currency: { type: String, default: "USD" }
    },
    
    // ✅ ADDED: Time tracking
    timeTracking: {
      estimatedHours: { type: Number, default: 0 },
      trackedHours: { type: Number, default: 0 }
    },
    
    // ✅ ADDED: Completion tracking
    completedAt: {
      type: Date,
      default: null
    },
    completedBy: {
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
projectSchema.index({ workspace: 1, status: 1 });
projectSchema.index({ workspace: 1, isArchived: 1 });
projectSchema.index({ workspace: 1, createdAt: -1 });
projectSchema.index({ owner: 1 });
projectSchema.index({ 'team.user': 1 });
projectSchema.index({ deadline: 1 });
projectSchema.index({ status: 1, deadline: 1 }); // For overdue queries

/* =============================
   VIRTUALS
============================= */
projectSchema.virtual("duration").get(function () {
  if (!this.startDate || !this.endDate) return null;
  return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
});

projectSchema.virtual("isOverdue").get(function () {
  if (!this.endDate) return false;
  return new Date() > this.endDate && this.status !== "completed";
});

// ✅ ADDED: More useful virtuals
projectSchema.virtual("daysRemaining").get(function () {
  if (!this.endDate) return null;
  const now = new Date();
  const end = new Date(this.endDate);
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return diff;
});

projectSchema.virtual("isCompleted").get(function () {
  return this.status === "completed" || this.progress === 100;
});

projectSchema.virtual("teamCount").get(function () {
  return this.team ? this.team.length : 0;
});

projectSchema.virtual("subtaskProgress").get(function () {
  if (!this.counters.subtasks || this.counters.subtasks === 0) return 0;
  return Math.round((this.counters.completedSubtasks / this.counters.subtasks) * 100);
});

/* =============================
   METHODS
============================= */
// ✅ ADDED: Helper methods
projectSchema.methods.addTeamMember = async function(userId, role = "Member", addedBy = null) {
  // Check if user already exists
  const exists = this.team.some(member => member.user.toString() === userId.toString());
  if (exists) {
    throw new Error("User is already a team member");
  }
  
  this.team.push({
    user: userId,
    role,
    addedBy,
    addedAt: new Date()
  });
  
  return this.save();
};

projectSchema.methods.removeTeamMember = async function(userId) {
  this.team = this.team.filter(member => member.user.toString() !== userId.toString());
  return this.save();
};

projectSchema.methods.updateProgress = async function() {
  // Auto-calculate progress based on completed subtasks
  if (this.counters.subtasks > 0) {
    this.progress = Math.round((this.counters.completedSubtasks / this.counters.subtasks) * 100);
  }
  return this.save();
};

projectSchema.methods.markComplete = async function(completedBy) {
  this.status = "completed";
  this.progress = 100;
  this.completedAt = new Date();
  this.completedBy = completedBy;
  return this.save();
};

/* =============================
   MIDDLEWARE
============================= */
// ✅ IMPROVED: Better cascade delete
projectSchema.pre("deleteOne", { document: true, query: false }, async function (next) {
  try {
    const Task = mongoose.model("Task");
    const Milestone = mongoose.model("Milestone");
    const TimeEntry = mongoose.model("TimeEntry");
    
    // Delete all related data
    await Promise.all([
      Task.deleteMany({ project: this._id }),
      Milestone.deleteMany({ project: this._id }),
      TimeEntry.deleteMany({ project: this._id })
    ]);
    
    next();
  } catch (error) {
    next(error);
  }
});

// ✅ ADDED: Auto-update completedAt when status changes
projectSchema.pre("save", function(next) {
  if (this.isModified("status")) {
    if (this.status === "completed" && !this.completedAt) {
      this.completedAt = new Date();
    } else if (this.status !== "completed") {
      this.completedAt = null;
      this.completedBy = null;
    }
  }
  next();
});

// ✅ ADDED: Validate team members
projectSchema.pre("save", function(next) {
  // Remove duplicate team members
  const uniqueTeam = [];
  const seenUsers = new Set();
  
  for (const member of this.team) {
    const userId = member.user.toString();
    if (!seenUsers.has(userId)) {
      seenUsers.add(userId);
      uniqueTeam.push(member);
    }
  }
  
  this.team = uniqueTeam;
  next();
});

export default mongoose.model("Project", projectSchema);