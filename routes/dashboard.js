const Lead = require("../models/Lead");
const Customer = require("../models/Customer");
const express = require("express");
const Invoice = require("../models/Invoice");
const router = express.Router();

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