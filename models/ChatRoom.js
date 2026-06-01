import mongoose from "mongoose";

const chatRoomSchema = new mongoose.Schema(
  {
    name: String,
    type: { type: String, enum: ["direct", "group"], default: "direct" },
    /** workspace = all org users are participants (new hires auto-join); custom = explicit list only */
    membersScope: {
      type: String,
      enum: ["workspace", "custom"],
    },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Agency" },
    lastMessage: String,
  },
  { timestamps: true }
);

export default mongoose.model("ChatRoom", chatRoomSchema);