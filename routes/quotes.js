import express from "express";
import Lead from "../models/clead.js";
import Quote from "../models/Quote.js";
import Customer from "../models/Customer.js";
import Agency from "../models/Agency.js";
import generateQuotePDF from "../utils/generateQuotePDF.js";
import { calcQuoteTotals } from "../utils/quoteCalc.js";
import { assertWithinLimit } from "../services/assertPlanLimit.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    if (!(await assertWithinLimit(req, res, "quotes"))) return;

    const {
      customer,
      deal,
      title,
      items = [],
      gstType = "CGST_SGST",
      discount = 0,
      validUntil,
      notes,
    } = req.body;

    const customerData = await Customer.findOne({
      _id: customer,
      agency: req.companyId,
    });
    if (!customerData) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const agencyData = await Agency.findById(req.companyId);
    const calc = calcQuoteTotals(items, gstType, discount);

    const quote = await Quote.create({
      agency: req.companyId,
      customer,
      deal: deal || undefined,
      title: title || "Quotation",
      quoteNumber: "QT-" + Date.now(),
      items: calc.calculatedItems,
      subtotal: calc.subtotal,
      discount: calc.discount,
      gstType: calc.gstType,
      cgst: calc.cgst,
      sgst: calc.sgst,
      igst: calc.igst,
      totalAmount: calc.totalAmount,
      amount: calc.totalAmount,
      validUntil: validUntil || null,
      notes: notes || "",
      status: "Draft",
      agencySnapshot: agencyData
        ? {
            name: agencyData.name,
            tagline: agencyData.tagline,
            address: agencyData.address,
            email: agencyData.email,
            phone: agencyData.phone,
            website: agencyData.website,
            gstin: agencyData.gstin,
            bankDetails: agencyData.bankDetails,
          }
        : {},
      customerSnapshot: {
        name: customerData.name || "",
        companyName: customerData.companyName || "",
        contactPerson: customerData.contactPerson || "",
        email: customerData.email || "",
        phone: customerData.phone || "",
        address: customerData.address || "",
        gstNumber: customerData.gstNumber || "",
      },
    });

    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/search", async (req, res) => {
  const q = req.query.q;

  const customers = await Customer.find({
    agency: req.companyId,
    $or: [
      { name: new RegExp(q, "i") },
      { companyName: new RegExp(q, "i") },
    ],
  }).limit(5);

  const leads = await Lead.find({
    agency: req.companyId,
    $or: [
      { name: new RegExp(q, "i") },
      { companyName: new RegExp(q, "i") },
    ],
  }).limit(5);

  res.json({ customers, leads });
});

router.get("/", async (req, res) => {
  try {
    const quotes = await Quote.find({ agency: req.companyId })
      .populate("customer")
      .sort({ createdAt: -1 });
    res.json(quotes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/customer/:customerId", async (req, res) => {
  try {
    const quotes = await Quote.find({
      agency: req.companyId,
      customer: req.params.customerId,
    })
      .sort({ createdAt: -1 });
    res.json(quotes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/view", async (req, res) => {
  try {
    const quote = await Quote.findOne({
      _id: req.params.id,
      agency: req.companyId,
    });

    if (!quote) return res.status(404).json({ message: "Not found" });

    // 🔥 Transform for template
    const data = {
      quoteNumber: quote.quoteNumber,
      date: quote.createdAt,
      validUntil: quote.validUntil,

      customer: quote.customerSnapshot,
      agency: quote.agencySnapshot,

      items: quote.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        rate: i.rate,
        total: i.total,
      })),

      subtotal: quote.subtotal,
      discount: quote.discount,
      total: quote.totalAmount,
      notes: quote.notes,
      gstType: quote.gstType,
      cgst: quote.cgst,
      sgst: quote.sgst,
      igst: quote.igst,
    };

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/pdf", async (req, res) => {
  try {
    const quote = await Quote.findOne({
      _id: req.params.id,
      agency: req.companyId,
    });

    if (!quote) return res.status(404).json({ message: "Quote not found" });

    const viewData = {
      ...quote.toObject(),
      items: quote.items,
    };

    // 🔥 Pass template data
    generateQuotePDF(viewData, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const quote = await Quote.findOne({
      _id: req.params.id,
      agency: req.companyId,
    })
      .populate("customer")
      .populate("deal");
    if (!quote) return res.status(404).json({ message: "Not found" });
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const quote = await Quote.findOne({
      _id: req.params.id,
      agency: req.companyId,
    });
    if (!quote) return res.status(404).json({ message: "Not found" });

    const body = { ...req.body };
    delete body.company;
    delete body.quoteNumber;

    const validStatuses = ["Draft", "Sent", "Accepted", "Rejected"];
    if (body.status != null && !validStatuses.includes(body.status)) {
      delete body.status;
    }

    if (Array.isArray(body.items)) {
      const calc = calcQuoteTotals(
        body.items,
        body.gstType || quote.gstType,
        body.discount ?? quote.discount
      );
      body.items = calc.calculatedItems;
      body.subtotal = calc.subtotal;
      body.cgst = calc.cgst;
      body.sgst = calc.sgst;
      body.igst = calc.igst;
      body.totalAmount = calc.totalAmount;
      body.amount = calc.totalAmount;
      body.gstType = calc.gstType;
    }

    Object.assign(quote, body);
    await quote.save();
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await Quote.deleteOne({ _id: req.params.id, agency: req.companyId });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
