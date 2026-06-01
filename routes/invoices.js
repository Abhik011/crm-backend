import express from "express";
import Invoice from "../models/Invoice.js";
import generateInvoicePDF from "../utils/generateInvoicePDF.js";
import Customer from "../models/Customer.js";
import Agency from "../models/Agency.js";
import { assertWithinLimit } from "../services/assertPlanLimit.js";

const router = express.Router();
router.post("/", async (req, res) => {
  try {
    if (!(await assertWithinLimit(req, res, "invoices"))) return;

    const {
      customer,
      deal,
      items = [],
      gstType = "CGST_SGST",
      projectName,
      projectDescription,
    } = req.body;

    const customerData = await Customer.findOne({
      _id: customer,
      agency: req.agencyId,
    });
    if (!customerData) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const agencyData = await Agency.findById(req.agencyId);

    const calculatedItems = items.map((item) => {
      const qty = Number(item.quantity || 1);
      const rate = Number(item.rate ?? item.price ?? 0);
      return {
        name: item.name,
        description: item.description,
        quantity: qty,
        rate,
        total: qty * rate,
      };
    });

    const subtotal = calculatedItems.reduce((sum, item) => sum + item.total, 0);

    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let totalAmount = subtotal;

    if (gstType === "CGST_SGST") {
      cgst = Math.round(subtotal * 0.09);
      sgst = Math.round(subtotal * 0.09);
      totalAmount = subtotal + cgst + sgst;
    } else {
      igst = Math.round(subtotal * 0.18);
      totalAmount = subtotal + igst;
    }

    const invoice = await Invoice.create({
      agency: req.agencyId,
      customer,
      deal,
      agency: agencyData?._id,
      customerSnapshot: {
        name: customerData?.name || "",
        companyName: customerData?.companyName || "",
        contactPerson: customerData?.contactPerson || "",
        email: customerData?.email || "",
        phone: customerData?.phone || "",
        address: customerData?.address || "",
        gstNumber: customerData?.gstNumber || "",
      },
      agencySnapshot: agencyData
        ? {
          name: agencyData.name,
          tagline: agencyData.tagline,
          address: agencyData.address,
          email: agencyData.email,
          phone: agencyData.phone,
          website: agencyData.website,
          logo: agencyData.logo,
          gstin: agencyData.gstin,
          bankDetails: agencyData.bankDetails,
        }
        : {},
      projectName: projectName || "",
      projectDescription: projectDescription || "",
      items: calculatedItems,
      subtotal,
      gstType,
      cgst,
      sgst,
      igst,
      totalAmount,
      paymentStatus: "Pending",
      invoiceNumber: "INV-" + Date.now(),
    });

    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



router.get("/", async (req, res) => {
  try {
    const invoices = await Invoice.find({ agency: req.agencyId })
      .populate("customer")
      .sort({ createdAt: -1 });

    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/customer/:customerId", async (req, res) => {
  try {
    const invoices = await Invoice.find({
      agency: req.agencyId,
      customer: req.params.customerId,
    });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/pdf", async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      agency: req.agencyId,
    }).populate("customer");
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    generateInvoicePDF(invoice, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      agency: req.agencyId,
    })
      .populate("customer")
      .populate("agency");

    if (!invoice) return res.status(404).json({ message: "Not found" });

    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id/pay", async (req, res) => {
  const { amount, milestoneId, method, note } = req.body;
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) return res.status(404).json({ message: "Not found" });

  const payAmount = Number(amount);

  if (!amount || isNaN(payAmount) || payAmount <= 0) {
    return res.status(400).json({
      message: "Invalid payment amount",
    });
  }
  // ❌ Prevent invoice overpayment
  if (payAmount > invoice.balanceAmount) {
    return res.status(400).json({
      message: "Payment exceeds remaining balance",
    });
  }
  // 🎯 Milestone logic FIRST
  let finalAmount = payAmount;

  // 🎯 1. IF specific milestone selected
  if (milestoneId) {
    const milestone = invoice.milestones.id(milestoneId);

    if (milestone) {
      milestone.paidAmount += payAmount;

      // 🚫 Cap milestone
      if (milestone.paidAmount > milestone.amount) {
        const extra = milestone.paidAmount - milestone.amount;

        milestone.paidAmount = milestone.amount;

        // adjust actual amount used
        finalAmount = payAmount - extra;
      }

      if (milestone.paidAmount >= milestone.amount) {
        milestone.paid = true;
      }
    }

  } else {
    // 🚀 2. AUTO DISTRIBUTE (no milestoneId)
    let remainingAmount = payAmount;

    for (const milestone of invoice.milestones) {
      if (remainingAmount <= 0) break;

      const remainingMilestoneAmount =
        milestone.amount - milestone.paidAmount;

      if (remainingMilestoneAmount <= 0) continue;

      const payToMilestone = Math.min(
        remainingAmount,
        remainingMilestoneAmount
      );

      milestone.paidAmount += payToMilestone;

      if (milestone.paidAmount >= milestone.amount) {
        milestone.paid = true;
      }

      remainingAmount -= payToMilestone;
    }

    finalAmount = payAmount - remainingAmount;
  }

  // ✅ Now update invoice with CORRECT amount
  invoice.paidAmount += finalAmount;

  // ✅ Add payment history
  invoice.payments.push({
    amount: finalAmount,
    date: new Date(),
    method: method || "UPI",
      note: note || "",
  });

  // 📊 Status
  if (invoice.paidAmount === 0) {
    invoice.paymentStatus = "Pending";
  } else if (invoice.paidAmount < invoice.totalAmount) {
    invoice.paymentStatus = "Partial";
  } else {
    invoice.paymentStatus = "Paid";
  }

  await invoice.save();

  res.json(invoice);
});

router.put("/:id", async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      agency: req.agencyId,
    });
    if (!invoice) return res.status(404).json({ message: "Not found" });

    const body = { ...req.body };
    delete body.company;

    Object.assign(invoice, body);

    if (Array.isArray(invoice.items) && invoice.items.length > 0) {
      invoice.subtotal = invoice.items.reduce((sum, item) => {
        const lineTotal = Number(item.total ?? item.amount ?? 0);
        return sum + (isNaN(lineTotal) ? 0 : lineTotal);
      }, 0);
    }

    const subtotal = Number(invoice.subtotal) || 0;
    const discountPct = Number(invoice.discount) || 0;
    const discountAmt = Math.round((subtotal * discountPct) / 100);
    const taxable = subtotal - discountAmt;

    if (invoice.gstType === "CGST_SGST") {
      invoice.cgst = Math.round(taxable * 0.09);
      invoice.sgst = Math.round(taxable * 0.09);
      invoice.igst = 0;
      invoice.totalAmount = taxable + invoice.cgst + invoice.sgst;
    } else {
      invoice.igst = Math.round(taxable * 0.18);
      invoice.cgst = 0;
      invoice.sgst = 0;
      invoice.totalAmount = taxable + invoice.igst;
    }

    const validStatuses = ["Draft", "Final"];
    if (!validStatuses.includes(invoice.status)) {
      invoice.status = "Draft";
    }

    await invoice.save();
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const r = await Invoice.deleteOne({
      _id: req.params.id,
      agency: req.agencyId,
    });
    if (r.deletedCount === 0) {
      return res.status(404).json({ message: "Not found" });
    }
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
