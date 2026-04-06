const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Agency",
    index: true,
  },
  name: String,
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  deal: { type: mongoose.Schema.Types.ObjectId, ref: "Deal" },

  status: {
    type: String,
    default: "Active"
  },

  startDate: Date,
  deadline: Date,

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Project", projectSchema);