const mongoose = require("mongoose");

const InvoiceSchema = new mongoose.Schema({
  invoiceNumber: String,

  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer"
  },

  amount: Number,
  status: {
    type: String,
    default: "Pending"
  },

  dueDate: Date,

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Invoice", InvoiceSchema);