// models/Task.js
import mongoose from "mongoose";

const ISSUE_TYPES = ["epic", "story", "task", "bug", "subtask"];

const taskSchema = new mongoose.Schema(
  {
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      required: true,
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      index: true,
    },

    issueKey: { type: String, index: true },
    issueNumber: { type: Number },

    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    acceptanceCriteria: { type: String, default: "" },

    issueType: {
      type: String,
      enum: ISSUE_TYPES,
      default: "task",
    },
    /** Canonical values: backlog | todo | in_progress | in_review | done */
    status: { type: String, default: "backlog" },
    priority: { type: String, default: "medium", trim: true },

    assignee: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    labels: [{ type: String, trim: true }],

    /** @deprecated use assignee */
    assignedTo: String,

    timeSpent: { type: Number, default: 0 },
    dueDate: Date,
  },
  { timestamps: true }
);

taskSchema.index({ project: 1, issueNumber: 1 });

export default mongoose.model("Task", taskSchema);
