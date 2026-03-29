const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },

  title: String,
  description: String,

  assignedTo: String, // later → userId
  status: {
    type: String,
    enum: ["Todo", "In Progress", "Done"],
    default: "Todo",
  },

  priority: String,

  timeSpent: { type: Number, default: 0 }, // ⏱ minutes
  dueDate: Date,

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Task", taskSchema);