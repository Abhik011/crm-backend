const express = require("express");
const router = express.Router();
const Invoice = require("../models/Invoice");
const generateInvoicePDF = require("../utils/generateInvoicePDF");
const Customer = require("../models/Customer"); // ✅ ADD THIS
const Agency = require("../models/Agency");

router.post("/", async (req, res) => {
  try {
   const {
      customer,
      deal,
      items = [],
      gstType = "CGST_SGST",
      projectName,
      projectDescription
    } = req.body;

    // ✅ FETCH CUSTOMER (FIX 1)
    const customerData = await Customer.findById(customer);
    const agencyData = await Agency.findOne(); // or findById(req.body.agency)
    // ✅ FIX ITEMS (USE rate + quantity)
    const calculatedItems = items.map((item) => {
      const qty = Number(item.quantity || 1);
      const rate = Number(item.rate ?? item.price ?? 0);

      return {
        name: item.name,
        description: item.description,
        quantity: qty,
        rate,
        total: qty * rate, // ✅ IMPORTANT
      };
    });
    // ✅ SUBTOTAL
    const subtotal = calculatedItems.reduce(
      (sum, item) => sum + item.total,
      0
    );

    let cgst = 0, sgst = 0, igst = 0, totalAmount = subtotal;

    if (gstType === "CGST_SGST") {
      cgst = Math.round(subtotal * 0.09);
      sgst = Math.round(subtotal * 0.09);
      totalAmount = subtotal + cgst + sgst;
    } else {
      igst = Math.round(subtotal * 0.18);
      totalAmount = subtotal + igst;
    }

    const invoice = await Invoice.create({
      customer,
      deal,
      agency: agencyData?._id,
      // ✅ SNAPSHOT (FIX 2)
      customerSnapshot: {
        name: customerData?.name || "",
        companyName: customerData?.companyName || "", // ✅ ADD
        contactPerson: customerData?.contactPerson || "",
        email: customerData?.email || "",
        phone: customerData?.phone || "",
        address: customerData?.address || "",
        gstNumber: customerData?.gstNumber || "",     // ✅ ADD
      },
      agencySnapshot: agencyData ? {
        name: agencyData.name,
        tagline: agencyData.tagline,
        address: agencyData.address,
        email: agencyData.email,
        phone: agencyData.phone,
        website: agencyData.website,
        logo: agencyData.logo,
        gstin: agencyData.gstin,
        bankDetails: agencyData.bankDetails,
      } : {},
      // ✅ PROJECT (FIX 3)
      projectName: projectName || "",
      projectDescription: projectDescription || "",

      items: calculatedItems,
      subtotal,
      gstType,
      cgst,
      sgst,
      igst,
      totalAmount,

      status: "Draft",
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
    const invoices = await Invoice.find()
      .populate("customer")
      .sort({ createdAt: -1 }); // ✅ backend sort

    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET SINGLE INVOICE
router.get("/:id", async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate("customer")
      .populate("agency");

    if (!invoice) return res.status(404).json({ message: "Not found" });

    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE INVOICE  ← main fix here
router.put("/:id", async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Not found" });

    // Apply all fields from body
    Object.assign(invoice, req.body);

    // ── FIX 1: Recalculate subtotal from items if items were sent ──
    // The frontend sends items with a `total` field per line, not `amount`.
    // Recalculate subtotal from whichever field is present.
    if (Array.isArray(invoice.items) && invoice.items.length > 0) {
      invoice.subtotal = invoice.items.reduce((sum, item) => {
        const lineTotal = Number(item.total ?? item.amount ?? 0);
        return sum + (isNaN(lineTotal) ? 0 : lineTotal);
      }, 0);
    }

    const subtotal = Number(invoice.subtotal) || 0;

    // Apply discount if present
    const discountPct = Number(invoice.discount) || 0;
    const discountAmt = Math.round((subtotal * discountPct) / 100);
    const taxable = subtotal - discountAmt;

    // ── FIX 2: Guard against NaN before saving ──
    if (invoice.gstType === "CGST_SGST") {
      invoice.cgst = Math.round(taxable * 0.09);
      invoice.sgst = Math.round(taxable * 0.09);
      invoice.igst = 0;                               // ← always reset the unused field to 0, not NaN
      invoice.totalAmount = taxable + invoice.cgst + invoice.sgst;
    } else {
      invoice.igst = Math.round(taxable * 0.18);
      invoice.cgst = 0;
      invoice.sgst = 0;
      invoice.totalAmount = taxable + invoice.igst;
    }

    // ── FIX 3: `status` enum is "Draft" | "Final" — never set it to "Pending" ──
    // paymentStatus is the Pending/Partial/Paid field.
    // Only update status if the incoming value is a valid enum member.
    const validStatuses = ["Draft", "Final"];
    if (!validStatuses.includes(invoice.status)) {
      invoice.status = "Draft"; // safe fallback
    }

    await invoice.save();
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GENERATE PDF
router.get("/:id/pdf", async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate("customer");
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    generateInvoicePDF(invoice, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// RECORD PAYMENT
router.put("/:id/pay", async (req, res) => {
  try {
    const { amount } = req.body;
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    invoice.paidAmount = (Number(invoice.paidAmount) || 0) + Number(amount);

    if (invoice.paidAmount <= 0) {
      invoice.paymentStatus = "Pending";
    } else if (invoice.paidAmount < invoice.totalAmount) {
      invoice.paymentStatus = "Partial";
    } else {
      invoice.paymentStatus = "Paid";
      invoice.status = "Final";               // ← use "Final", not "Paid"
    }

    await invoice.save();
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET BY CUSTOMER
router.get("/customer/:customerId", async (req, res) => {
  try {
    const invoices = await Invoice.find({ customer: req.params.customerId });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// GET ALL INVOICES


// DELETE
router.delete("/:id", async (req, res) => {
  try {
    await Invoice.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;