const express = require("express");
const router = express.Router();

const Invoice = require("../models/Invoice");

// 📊 FINANCIAL YEAR REPORT
router.get("/financial-year", async (req, res) => {
  try {
    const { year } = req.query;

    const start = new Date(`${year}-04-01`);
    const end = new Date(`${Number(year) + 1}-03-31`);

    const invoices = await Invoice.find({
      createdAt: { $gte: start, $lte: end },
    });

    let total = 0;
    let paid = 0;
    let pending = 0;

    const months = {};

    invoices.forEach((inv) => {
      const month = new Date(inv.createdAt).toLocaleString("default", {
        month: "short",
      });

      total += inv.totalAmount;

      if (inv.paymentStatus === "Paid") paid += inv.totalAmount;
      else pending += inv.totalAmount;

      if (!months[month]) months[month] = 0;
      months[month] += inv.totalAmount;
    });

    res.json({
      total,
      paid,
      pending,
      months,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📊 MONTHLY REPORT
router.get("/monthly", async (req, res) => {
  try {
    const { year, month } = req.query;

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);

    const invoices = await Invoice.find({
      createdAt: { $gte: start, $lte: end },
    });

    let total = 0;
    let paid = 0;
    let count = invoices.length;

    invoices.forEach((inv) => {
      total += inv.totalAmount;
      if (inv.paymentStatus === "Paid") paid += inv.totalAmount;
    });

    res.json({
      total,
      paid,
      unpaid: total - paid,
      count,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;