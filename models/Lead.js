import mongoose from "mongoose";

const LeadSchema = new mongoose.Schema({
  name: String,
  agency: String,
  contactPerson: String,
  phone: String,
  email: String,
  source: String,
status: {
  type: String,
  enum: ["New", "Contacted", "Qualified", "Converted", "Lost"],
  default: "New"
},
  estimatedValue: Number,   // 🔥 ADD (deal value hint)
  service: String,
  notes: String,
  createdAt: {
    type: Date, 
    default: Date.now
  }
});

export default mongoose.model("Lead", LeadSchema);