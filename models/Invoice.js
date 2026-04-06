const mongoose = require("mongoose");

const InvoiceSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Agency",
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

  agency: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Agency",
  },
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
    }
  },
  customerSnapshot: {
    name: String,
    contactPerson: String,
    email: String,
    phone: String,
    address: String
  },

  invoiceNumber: String,
  projectName: String,
  projectDescription: String,

  // Line items — supports both old (amount) and new (rate/quantity/total) shapes
  items: [
    {
      name: String,
      description: String,
      quantity: { type: Number, default: 1 },
      rate: Number,
      amount: Number,   // legacy: quantity × price
      total: Number,    // new: quantity × rate (same meaning, aligned with frontend)
    },
  ],

  subtotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },  // percentage

  gstType: {
    type: String,
    enum: ["CGST_SGST", "IGST"],
    default: "CGST_SGST",
  },

  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },

  // GST / compliance
  customerGSTIN: String,
  agencyGSTIN: String,
  placeOfSupply: String,
  hsn: String,

  // Bank
  bankDetails: {
    accountName: String,
    accountNumber: String,
    ifsc: String,
    bank: String,   // was `bankName` — aligned with frontend key
  },

  // Milestone payment tracking
  milestones: [
    {
      label: String,
      percent: Number,
      paid: { type: Boolean, default: false },
    },
  ],

  // Dates & terms
  dueDate: Date,
  paymentTerms: String,
  notes: String,

  // Document lifecycle status
  // "Draft" = being edited, "Final" = locked/sent to client
  status: {
    type: String,
    enum: ["Draft", "Final"],   // ← never "Pending" or "Paid" here
    default: "Draft",
  },

  // Money status — separate concern from document status
  paidAmount: { type: Number, default: 0 },
  paymentStatus: {
    type: String,
    enum: ["Pending", "Partial", "Paid"],  // "Overdue" is frontend-only
    default: "Pending",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Invoice", InvoiceSchema);