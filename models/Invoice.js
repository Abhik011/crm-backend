import mongoose from "mongoose";

const InvoiceSchema = new mongoose.Schema({
  agency: {
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
      amount: Number,
      paid: { type: Boolean, default: false },
      paidAmount: { type: Number, default: 0 }
    },
  ],

  // Dates & terms
  issueDate: {
    type: Date,
    default: Date.now,
  },
  dueDate: Date,
  paymentTerms: String,
  notes: String,

  // Document lifecycle status
  // "Draft" = being edited, "Final" = locked/sent to client

  // Money status — separate concern from document status
  paidAmount: { type: Number, default: 0 },
  balanceAmount: { type: Number, default: 0 },
  payments: [
    {
      amount: Number,
      date: Date,
      method: String,
      note: String,
    }
  ],
  paymentStatus: {
    type: String,
    enum: ["Pending", "Partial", "Paid"],  // "Overdue" is frontend-only
    default: "Pending",
  },
  // 💰 Financial Summary (ERP Level)
  totalPaidPercentage: { type: Number, default: 0 }, // % paid
  totalDuePercentage: { type: Number, default: 100 }, // % remaining

  lastPaymentDate: Date,
  nextDueMilestone: {
    label: String,
    amount: Number,
    dueDate: Date
  },

  // 📊 Advanced tracking
  isOverdue: { type: Boolean, default: false },
  overdueDays: { type: Number, default: 0 },

  // 💡 Profit tracking (future ERP feature)
  costAmount: { type: Number, default: 0 },
  profitAmount: { type: Number, default: 0 },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

InvoiceSchema.pre("save", async function () {
  this.balanceAmount = this.totalAmount - this.paidAmount;

  this.totalPaidPercentage =
    this.totalAmount > 0
      ? Math.round((this.paidAmount / this.totalAmount) * 100)
      : 0;

  this.totalDuePercentage = 100 - this.totalPaidPercentage;

  // 🎯 Auto calculate milestone amount
  if (this.milestones && this.milestones.length > 0) {
    this.milestones.forEach(m => {
      if (!m.amount) {
        m.amount = Math.round((m.percent / 100) * this.totalAmount);
      }
    });
  }

  // 📅 Last payment
  if (this.payments && this.payments.length > 0) {
    this.lastPaymentDate =
      this.payments[this.payments.length - 1].date;
  }

  // 🚨 Overdue
  if (this.dueDate && this.balanceAmount > 0) {
    const today = new Date();
    if (today > this.dueDate) {
      this.isOverdue = true;
      this.overdueDays = Math.ceil(
        (today - this.dueDate) / (1000 * 60 * 60 * 24)
      );
    } else {
      this.isOverdue = false;
      this.overdueDays = 0;
    }
  }

  // 🎯 Next milestone
  const nextMilestone = this.milestones?.find(m => !m.paid);
  if (nextMilestone) {
    this.nextDueMilestone = {
      label: nextMilestone.label,
      amount: nextMilestone.amount,
    };
  }
});

// 🔥 ADD THIS BELOW pre-save
InvoiceSchema.virtual("formattedSummary").get(function () {
  return {
    total: this.totalAmount,
    paid: this.paidAmount,
    balance: this.balanceAmount,
    progress: this.totalPaidPercentage,
    status: this.paymentStatus,
  };
});

InvoiceSchema.set("toJSON", { virtuals: true });
InvoiceSchema.set("toObject", { virtuals: true });

export default mongoose.model("Invoice", InvoiceSchema);