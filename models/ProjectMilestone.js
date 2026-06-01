import mongoose from "mongoose";

const milestoneSchema = new mongoose.Schema(
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
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    targetDate: Date,
    status: {
      type: String,
      enum: ["pending", "in_progress", "done", "skipped"],
      default: "pending",
    },
    billingAmount: { type: Number, default: 0 },
    billingPercent: { type: Number, min: 0, max: 100, default: 0 },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

milestoneSchema.index({ project: 1, sortOrder: 1 });

export default mongoose.model("ProjectMilestone", milestoneSchema);
