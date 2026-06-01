import express from "express";
import Lead from "../models/clead.js";
import Customer from "../models/Customer.js";
import Invoice from "../models/Invoice.js";

const router = express.Router();
router.get("/revenue", async (req, res) => {
  try {
    const { range = "month" } = req.query;

    const invoices = await Invoice.find({ agency: req.companyId });

    const data = {};

    invoices.forEach((inv) => {
      const date = new Date(inv.createdAt);

      let key;

      if (range === "day") {
        key = date.toLocaleDateString();
      } else if (range === "week") {
        const week = Math.ceil(date.getDate() / 7);
        key = `W${week}`;
      } else if (range === "year") {
        key = date.getFullYear().toString();
      } else {
        key = date.toLocaleString("default", { month: "short" });
      }

      if (!data[key]) data[key] = 0;
      data[key] += inv.totalAmount || 0;
    });

    // 🔥 FILL MISSING MONTHS
    if (range === "month") {
      const monthsList = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      monthsList.forEach((m) => {
        if (!data[m]) data[m] = 0;
      });
    }

    const result = Object.keys(data).map((k) => ({
      month: k,
      revenue: data[k],
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/pipeline", async (req, res) => {
  try {
    const leads = await Lead.find({ agency: req.companyId });

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
    const q = { agency: req.companyId };
    const leads = await Lead.countDocuments(q);
    const customers = await Customer.countDocuments(q);
    const invoices = await Invoice.countDocuments(q);

    const revenueData = await Invoice.aggregate([
      { $match: { agency: req.companyId } },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ["$totalAmount", 0] } },
        },
      },
    ]);

    const revenue = revenueData[0]?.total || 0;

    res.json({
      leads,
      customers,
      invoices,
      revenue,
    });
  } catch (error) {
    res.status(500).json({ message: "Dashboard stats error" });
  }
});

export default router;
