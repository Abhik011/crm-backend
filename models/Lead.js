const mongoose = require("mongoose");

const LeadSchema = new mongoose.Schema({
  name: String,
  company: String,
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

module.exports = mongoose.model("Lead", LeadSchema);