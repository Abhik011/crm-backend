const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Agency",
    index: true,
  },
  name: String,
  companyName: String,
  contactPerson: String,
  phone: String,
  email: String,
  address: String,
  gstNumber: String,
  creditLimit: Number,
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Customer", CustomerSchema);