const express = require("express");
const router = express.Router();
const Deal = require("../models/Deal");
const Quote = require("../models/Quote");
const Invoice = require("../models/Invoice");
const Project = require("../models/Project");
const Task = require("../models/Task");

// ✅ GET ALL DEALS
router.get("/", async (req, res) => {
  try {
    const deals = await Deal.find()
      .populate("customer") // 🔥 IMPORTANT
      .sort({ createdAt: -1 });

    res.json(deals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ✅ CREATE DEAL
router.post("/", async (req, res) => {
  try {

    const deal = await Deal.create({
      customer: req.body.customer,
      title: req.body.title,
      service: req.body.service,
      value: Number(req.body.value),
      deadline: req.body.deadline,
      priority: req.body.priority,
      notes: req.body.notes
    });

    res.json(deal);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET DEAL BY ID
router.get("/:id", async (req, res) => {
  const deal = await Deal.findById(req.params.id).populate("customer");
  res.json(deal);
});

// ✅ UPDATE DEAL
router.put("/:id", async (req, res) => {
  const updated = await Deal.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(updated);
});
// ✅ DELETE DEAL
router.delete("/:id", async (req, res) => {
  try {
    await Deal.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET DEALS BY CUSTOMER
router.get("/customer/:customerId", async (req, res) => {
  try {
    const deals = await Deal.find({
      customer: req.params.customerId
    });

    res.json(deals);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.put("/:id/status", async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id);
    if (!deal)
      return res.status(404).json({ message: "Deal not found" });
    const newStatus = req.body.status;
    deal.status = newStatus;
    if (
      newStatus === "Proposal Sent" &&
      !deal.quoteCreated
    ) {
      await Quote.create({
        customer: deal.customer,
        deal: deal._id,
        amount: deal.value,
        quoteNumber: "QT-" + Date.now()
      });

      deal.quoteCreated = true;
    }
    if (
      newStatus === "In Progress" &&
      !deal.invoiceCreated
    ) {
      await Invoice.create({
        customer: deal.customer,
        deal: deal._id,

        // ✅ STRUCTURED INVOICE
        items: [
          {
            name: deal.title,
            quantity: 1,
            price: deal.value,
            total: deal.value
          }
        ],

        subtotal: deal.value,
        tax: deal.value * 0.18,
        taxRate: 18,
        totalAmount: deal.value * 1.18,

        status: "Draft",
        invoiceNumber: "INV-" + Date.now()
      });

      deal.invoiceCreated = true;
    }
    // 🔥 FINAL INVOICE UPDATE (Completed)
    if (newStatus === "Completed") {
      const invoice = await Invoice.findOne({ deal: deal._id });

      if (invoice) {
        invoice.status = "Final";
        await invoice.save();
      }
    }
    await deal.save(); // ✅ SAVE AFTER LOGIC

    res.json(deal);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;