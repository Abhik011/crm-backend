const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      index: true,
    },
    email: { type: String, required: true },
    source: { type: String, default: "creonox.com" },
  },
  { timestamps: true }
);

subscriptionSchema.index({ company: 1, email: 1 }, { unique: true });

module.exports = mongoose.model("Subscription", subscriptionSchema);