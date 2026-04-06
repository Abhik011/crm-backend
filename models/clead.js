const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    // 🔑 WHO OWNS THIS DATA (MANDATORY)
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      required: true,
      index: true,
    },

    // 👤 FUTURE RELATION (after conversion)
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },

    // 🏢 RAW COMPANY NAME (from form)
    companyName: {
      type: String,
      trim: true,
    },

    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },

    service: { type: String },
    message: { type: String },

    source: {
      type: String,
      default: "creonox.com",
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "New",
        "Contacted",
        "Negotiation",
        "Qualified",
        "Converted",
        "Lost",
      ],
      default: "New",
    },

    estimatedValue: { type: Number, min: 0 },
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("CLead", leadSchema);