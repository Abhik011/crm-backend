import mongoose from "mongoose";

const reminderSchema =
  new mongoose.Schema(
    {
      title: {
        type: String,
        required: true,
      },

      description: String,

      reminderAt: {
        type: Date,
        required: true,
        index: true,
      },

      leadId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "CLead",
      },

      assignedTo: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      companyId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Agency",
        required: true,
        index: true,
      },

      status: {
        type: String,
        enum: [
          "Pending",
          "Completed",
          "Missed",
          "Overdue",
          "Due"
        ],
        default: "Pending",
      },

      notified: {
        type: Boolean,
        default: false,
      },
      preNotified: {
        type: Boolean,
        default: false
      },

      overdueNotified: {
        type: Boolean,
        default: false
      },
    },
    {
      timestamps: true,
    }
  );

const Reminder =
  mongoose.models.Reminder ||
  mongoose.model(
    "Reminder",
    reminderSchema
  );

export default Reminder;