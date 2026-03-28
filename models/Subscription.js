const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    source: { type: String, default: "creonox.com" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscription", subscriptionSchema);