const mongoose = require("mongoose");

const AgencySchema = new mongoose.Schema(
  {
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
      bank: String,
    },

    /** SaaS: free | starter | pro — synced from Stripe when applicable */
    planKey: {
      type: String,
      default: "free",
      index: true,
    },

    /**
     * none — no Stripe subscription yet
     * trialing | active | past_due | canceled | unpaid — Stripe-aligned
     */
    subscriptionStatus: {
      type: String,
      enum: ["none", "trialing", "active", "past_due", "canceled", "unpaid"],
      default: "active",
    },

    stripeCustomerId: { type: String, index: true, sparse: true },
    stripeSubscriptionId: { type: String, sparse: true },

    currentPeriodEnd: Date,
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Agency", AgencySchema);
