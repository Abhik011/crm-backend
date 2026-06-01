import mongoose from "mongoose";

const AgencySchema = new mongoose.Schema(
  {
    /** Clerk user id (`sub`) — owner of this workspace (one org per account for now) */
    clerkUserId: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
      index: true,
    },

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
     upiId: {
      type: String,
      trim: true,
    },
    // ✅ NEW: Place of Supply (GST state)
    placeOfSupply: {
      type: String,
      trim: true,
    },

    subscriptionStatus: {
      type: String,
      enum: ["none", "trialing", "active", "past_due", "canceled", "unpaid"],
      default: "active",
    },

    stripeCustomerId: { type: String, index: true, sparse: true },
    stripeSubscriptionId: { type: String, sparse: true },

    currentPeriodEnd: Date,
    cancelAtPeriodEnd: { type: Boolean, default: false },

    /** Owner setup wizard: name, logo, plan (false until completed) */
    workspaceOnboardingCompleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Agency", AgencySchema);
