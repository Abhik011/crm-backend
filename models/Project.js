// models/Project.js — software agency / enterprise delivery
import mongoose from "mongoose";

const ENGAGEMENT_TYPES = ["fixed_price", "time_materials", "retainer", "hybrid"];
const DELIVERY_MODELS = [
  "dedicated_team",
  "sprint_based",
  "staff_augmentation",
  "fixed_scope",
];
const PROJECT_STAGES = [
  "discovery",
  "proposal",
  "signed",
  "kickoff",
  "build",
  "uat",
  "launch",
  "warranty",
  "closed",
];
const HEALTH = ["on_track", "at_risk", "blocked", "completed"];
const PRIORITY = ["p0", "p1", "p2", "p3"];

const projectSchema = new mongoose.Schema(
  {
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    /** Human-readable ref e.g. PRJ-2025-014 */
    projectCode: { type: String, default: "", trim: true },

    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    deal: { type: mongoose.Schema.Types.ObjectId, ref: "Deal" },

    /** Legacy + display status */
    status: { type: String, default: "Active" },

    /** Delivery lifecycle (agency SOW) */
    projectStage: {
      type: String,
      enum: PROJECT_STAGES,
      default: "discovery",
    },
    health: { type: String, enum: HEALTH, default: "on_track" },
    priority: { type: String, enum: PRIORITY, default: "p2" },

    engagementType: {
      type: String,
      enum: ENGAGEMENT_TYPES,
      default: "fixed_price",
    },
    deliveryModel: {
      type: String,
      enum: DELIVERY_MODELS,
      default: "fixed_scope",
    },

    /** Contract / commercial (main currency units, e.g. INR lakhs/crore as full number) */
    contractValue: { type: Number, default: 0 },
    currency: { type: String, default: "INR", trim: true, uppercase: true },
    contractReference: { type: String, default: "", trim: true },
    clientPoNumber: { type: String, default: "", trim: true },
    invoicedToDate: { type: Number, default: 0 },
    /** Estimated internal delivery cost for margin view */
    estimatedInternalCost: { type: Number, default: 0 },
    /** Blended sell rate for burn-from-time estimate (per hour, same currency) */
    blendedHourlyRate: { type: Number, default: 0 },

    accountManager: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    techStack: [{ type: String, trim: true }],
    successCriteria: { type: String, default: "" },
    risksAndDependencies: { type: String, default: "" },

    /** Uppercase prefix for issue keys, e.g. CRM → CRM-12 */
    issueKeyPrefix: { type: String, default: "", trim: true, uppercase: true },
    issueSeq: { type: Number, default: 0 },

    startDate: Date,
    deadline: Date,
  },
  { timestamps: true }
);

projectSchema.index({ agency: 1, projectCode: 1 }, { sparse: true });

export default mongoose.model("Project", projectSchema);
