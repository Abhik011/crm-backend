// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    clerkId: { type: String, required: true, index: true },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      required: true,
      index: true,
    },
    name: String,
    email: { type: String, required: true, lowercase: true, trim: true },
    role: {
      type: String,
      enum: [
        "super_admin",
        "admin",
        "manager",
        "employee",
        "viewer",
        "sales",
        "developer",
        "finance",
      ],
      default: "employee",
      index: true,
    },
    image: {
      type: String,
      default: "",
    },
    onboardingCompleted: { type: Boolean, default: false },
    /** free | busy | working — workspace presence for chat */
    presenceStatus: {
      type: String,
      enum: ["free", "busy", "working"],
      default: "free",
    },
    /** Chat wallpaper preset id (client may also cache locally) */
    chatWallpaper: {
      type: String,
      default: "default",
    },
  },
  { timestamps: true }
);

// prevent duplicate email per company
userSchema.index({ email: 1, companyId: 1 }, { unique: true });

export default mongoose.model("User", userSchema);