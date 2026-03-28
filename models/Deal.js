const mongoose = require("mongoose");

const DealSchema = new mongoose.Schema({

  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true
  },

  lead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Lead"
  },

  route: String,

  truckType: String,

  volume: Number,

  rate: Number,

  status: {
    type: String,
    enum: [
      "Negotiation",
      "Active",
      "In Progress",
      "Completed",
      "Cancelled"
    ],
    default: "Negotiation"
  },

  createdAt: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model("Deal", DealSchema);