const mongoose = require("mongoose");

const AgencySchema = new mongoose.Schema({
  name: String,
  tagline: String,
  address: String,
  email: String,
  phone: String,
  website: String,
  logo: String,
  gstin: String,

  bankDetails: {
    accountName: String,
    accountNumber: String,
    ifsc: String,
    bank: String
  }
});

module.exports = mongoose.model("Agency", AgencySchema);