import mongoose from "mongoose";

const DealSchema = new mongoose.Schema({
  agency: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Agency",
    index: true,
  },

  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true
  },

  lead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Lead"
  },

  title: {
    type: String,
    required: true,
    trim: true
  },

  service: {
    type: String,
    trim: true
  },

  value: {
    type: Number,
    required: true,
    min: 0
  },

  deadline: Date,

  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium"
  },

  status: {
    type: String,
    enum: [
      "New",
      "Discussion",
      "Proposal Sent",
      "In Progress",
      "Completed",
      "Cancelled"
    ],
    default: "New"
  },

  notes: String,

  // 🔥 NEW (IMPORTANT)
  quoteCreated: {
    type: Boolean,
    default: false
  },

  invoiceCreated: {
    type: Boolean,
    default: false
  },

  createdAt: {
    type: Date,
    default: Date.now
  }

}, { timestamps: true });

export default mongoose.model("Deal", DealSchema);