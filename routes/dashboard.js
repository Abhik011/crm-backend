const Lead = require("../models/clead");
const Customer = require("../models/Customer");
const express = require("express");
const Invoice = require("../models/Invoice");
const router = express.Router();

// 📊 REVENUE (MONTHLY TREND)
router.get("/revenue", async (req, res) => {
  try {
    const invoices = await Invoice.find();

    const months = {};

    invoices.forEach((inv) => {
      const month = new Date(inv.createdAt).toLocaleString("default", {
        month: "short",
      });

      if (!months[month]) months[month] = 0;
      months[month] += inv.totalAmount || 0;
    });

    const result = Object.keys(months).map((m) => ({
      month: m,
      revenue: months[m],
    }));

    res.json(result);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 📊 PIPELINE (LEADS STATUS COUNT)
router.get("/pipeline", async (req, res) => {
  try {
    const leads = await Lead.find();

    const stages = {
      New: 0,
      Contacted: 0,
      Negotiation: 0,
      Qualified: 0,
      Converted: 0,
      Lost: 0,
    };

    leads.forEach((lead) => {
      if (stages[lead.status] !== undefined) {
        stages[lead.status]++;
      }
    });

    const result = Object.keys(stages).map((key) => ({
      stage: key,
      count: stages[key],
    }));

    res.json(result);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const leads = await Lead.countDocuments();
    const customers = await Customer.countDocuments();
    const invoices = await Invoice.countDocuments();

    const revenueData = await Invoice.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    const revenue = revenueData[0]?.total || 0;

    res.json({
      leads,
      customers,
      invoices,
      revenue
    });

  } catch (error) {
    res.status(500).json({ message: "Dashboard stats error" });
  }
});


module.exports = router;