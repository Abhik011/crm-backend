const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    company: { type: String },
    service: { type: String },
    message: { type: String },
    source: { type: String, default: "creonox.com" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CLead", leadSchema);