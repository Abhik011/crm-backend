const mongoose = require("mongoose");

const QuoteSchema = new mongoose.Schema({

  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true
  },

  deal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Deal"
  },

  quoteNumber: String,
  amount: Number,

  status: {
    type: String,
    enum: ["Draft", "Sent", "Accepted", "Rejected"],
    default: "Draft"
  },

  createdAt: {
    type: Date,
    default: Date.now
  }

});

// ✅ IMPORTANT LINE
module.exports = mongoose.model("Quote", QuoteSchema);