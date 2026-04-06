const express = require("express");
const router = express.Router();
const Lead = require("../models/clead");
const Customer = require("../models/Customer");
const Deal = require("../models/Deal");
const { assertWithinLimit } = require("../services/assertPlanLimit");
const Quote = require("../models/Quote");
const Agency = require("../models/Agency");
const { calcQuoteTotals } = require("../utils/quoteCalc");

router.post("/:id/convert", async (req, res) => {
  try {
    if (!(await assertWithinLimit(req, res, "customers"))) return;
    if (!(await assertWithinLimit(req, res, "deals"))) return;

    const lead = await Lead.findOne({
      _id: req.params.id,
      agency: req.companyId,
    });

    if (!lead) return res.status(404).json({ message: "Lead not found" });

    if (lead.status !== "Qualified")
      return res.status(400).json({
        message: "Lead must be Qualified before conversion",
      });

    const customer = await Customer.create({
      agency: req.companyId, // 🔑 ownership
      name: lead.name,
      companyName: lead.companyName, // from lead input
      phone: lead.phone,
      email: lead.email,
      source: lead.source,
      notes: lead.notes,
    });

    const deal = await Deal.create({
      agency: req.companyId,
      customer: customer._id,
      title: lead.companyName || lead.name,
      service: lead.service || "General",
      value: lead.estimatedValue || 0,
      status: "New",
      notes: lead.notes || "",
    });

    lead.status = "Converted";
    await lead.save();

    res.json({
      message: "Lead converted successfully",
      customer,
      deal,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    if (!(await assertWithinLimit(req, res, "leads"))) return;

    const lead = new Lead({
      ...req.body,
      agency: req.companyId,
    });
    await lead.save();
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const leads = await Lead.find({ agency: req.companyId }).sort({
      createdAt: -1,
    });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



router.put("/:id/status", async (req, res) => {
  try {
    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, agency: req.companyId },
      { status: req.body.status },
      { new: true }
    );

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // 🚀 AUTO QUOTE GENERATION
    if (req.body.status === "Negotiation") {
      const agency = await Agency.findById(req.companyId);

      const calc = calcQuoteTotals(
        [{ name: lead.service || "Service", quantity: 1, rate: lead.estimatedValue || 0 }],
        "CGST_SGST",
        0
      );

      await Quote.create({
        company: req.companyId,
        title: lead.companyName || lead.name,
        quoteNumber: "QT-" + Date.now(),
        items: calc.calculatedItems,
        subtotal: calc.subtotal,
        totalAmount: calc.totalAmount,
        amount: calc.totalAmount,
        status: "Draft",

        // 🔥 SNAPSHOTS
        agencySnapshot: {
          name: agency?.name,
          address: agency?.address,
          email: agency?.email,
          phone: agency?.phone,
          gstin: agency?.gstin,
        },

        customerSnapshot: {
          name: lead.name,
          companyName: lead.companyName,
          email: lead.email,
          phone: lead.phone,
        },
      });
    }

    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
