const mongoose = require("mongoose");

const QuoteSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      required: true,
      index: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    deal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
    },

    title: { type: String, default: "Quotation" },
    quoteNumber: String,

    /** @deprecated use totalAmount — kept for older records */
    amount: Number,

    agencySnapshot: {
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
    },

    customerSnapshot: {
      name: String,
      companyName: String,
      contactPerson: String,
      email: String,
      phone: String,
      address: String,
      gstNumber: String,
    },

    items: [
      {
        name: String,
        description: String,
        quantity: { type: Number, default: 1 },
        rate: Number,
        total: Number,
      },
    ],

    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },

    gstType: {
      type: String,
      enum: ["CGST_SGST", "IGST"],
      default: "CGST_SGST",
    },

    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },

    validUntil: Date,
    notes: String,

    status: {
      type: String,
      enum: ["Draft", "Sent", "Accepted", "Rejected"],
      default: "Draft",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Quote", QuoteSchema);
