import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      index: true,
    },
    email: { type: String, required: true },
    source: { type: String, default: "creonox.com" },
  },
  { timestamps: true }
);

subscriptionSchema.index({ agency: 1, email: 1 }, { unique: true });

export default mongoose.model("Subscription", subscriptionSchema);