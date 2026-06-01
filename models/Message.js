import mongoose from "mongoose";

const attachmentSchema =
  new mongoose.Schema(
    {
      url: {
        type: String,
        required: true,
      },

      type: {
        type: String,
        enum: ["image", "video", "file", "audio"],
        default: "file",
      },

      name: {
        type: String,
        default: "",
      },
    },
    { _id: false }
  );

const messageSchema =
  new mongoose.Schema(
    {
      roomId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "ChatRoom",
      },

      sender: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
      },

      text: {
        type: String,
        default: "",
      },

      attachments: {
        type: [attachmentSchema],
        default: [],
      },

      seenBy: [
        {
          type:
            mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],

      companyId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Agency",
      },

      editedAt: {
        type: Date,
        default: null,
      },

      deletedAt: {
        type: Date,
        default: null,
      },

      isDeleted: {
        type: Boolean,
        default: false,
      },
    },
    {
      timestamps: true,
    }
  );

export default mongoose.model(
  "Message",
  messageSchema
);