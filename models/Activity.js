import mongoose from "mongoose";

const ActivitySchema = new mongoose.Schema({
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Lead"
  },
  type: String,
  description: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model("Activity", ActivitySchema);