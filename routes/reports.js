import express from "express";
import Invoice from "../models/Invoice.js";

const router = express.Router();

router.get("/financial-year", async (req, res) => {
  try {
    const { year } = req.query;

    const start = new Date(`${year}-04-01`);
    const end = new Date(`${Number(year) + 1}-03-31T23:59:59`);

    const data = await Invoice.aggregate([
      {
        $match: {
          agency: req.companyId,
          createdAt: { $gte: start, $lte: end },
        },
      },

      {
        $addFields: {
          month: { $month: "$createdAt" },
          year: { $year: "$createdAt" },
        },
      },

      {
        $group: {
          _id: "$month",

          total: { $sum: "$totalAmount" },

          paid: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "Paid"] }, "$totalAmount", 0],
            },
          },

          partial: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "Partial"] }, "$paidAmount", 0],
            },
          },

          pending: {
            $sum: {
              $cond: [
                { $in: ["$paymentStatus", ["Pending", "Overdue"]] },
                "$totalAmount",
                0,
              ],
            },
          },

          gst: { $sum: "$gstAmount" },
        },
      },

      { $sort: { _id: 1 } },
    ]);

    // 🔥 Ensure Apr → Mar order
    const monthOrder = [4,5,6,7,8,9,10,11,12,1,2,3];

    const monthMap = {};
    data.forEach((m) => {
      monthMap[m._id] = m;
    });

    const months = monthOrder.map((m) => {
      const d = monthMap[m] || {};

      return {
        month: new Date(2020, m - 1).toLocaleString("default", { month: "short" }),
        total: d.total || 0,
        paid: d.paid || 0,
        pending: d.pending || 0,
        gst: d.gst || 0,
      };
    });

    const totals = months.reduce(
      (acc, m) => {
        acc.total += m.total;
        acc.paid += m.paid;
        acc.pending += m.pending;
        acc.gst += m.gst;
        return acc;
      },
      { total: 0, paid: 0, pending: 0, gst: 0 }
    );

    res.json({
      ...totals,
      months,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/monthly", async (req, res) => {
  try {
    const { year, month } = req.query;

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const invoices = await Invoice.find({
      agency: req.companyId,
      createdAt: { $gte: start, $lte: end },
    });

    let total = 0;
    let paid = 0;
    let partial = 0;
    let overdue = 0;
    let gst = 0;

    invoices.forEach((inv) => {
      total += inv.totalAmount || 0;
      gst += inv.gstAmount || 0;

      if (inv.paymentStatus === "Paid") {
        paid += inv.totalAmount;
      } else if (inv.paymentStatus === "Partial") {
          paid += paidAmt; 
        partial += inv.paidAmount || 0;
      } else if (inv.paymentStatus === "Overdue") {
        overdue += inv.totalAmount;
      }
    });

    res.json({
      total,
      paid,
      partial,
      overdue,
      unpaid: total - paid,
      gst,
      count: invoices.length,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/finance-overview", async (req, res) => {
  try {
    const { year } = req.query;

    const start = new Date(`${year}-04-01`);
    const end = new Date(`${Number(year) + 1}-03-31T23:59:59`);

    const invoices = await Invoice.find({
      agency: req.companyId,
      createdAt: { $gte: start, $lte: end },
    }).populate("customer");

    let total = 0;
    let paid = 0;
    let expected = 0;
    let overdue = 0;
    let gst = 0;
    let partial = 0;

    let totalCollectionDays = 0;
    let paidInvoicesCount = 0;

    const customerMap = {};
    const monthlyTrend = {};
    const paymentTrend = { onTime: 0, late: 0 };

    invoices.forEach((inv) => {
      const amount = inv.totalAmount || 0;
      const paidAmt = inv.paidAmount || 0;

      total += amount;
      gst += inv.gstAmount || 0;

      // 🔥 CASH FLOW
      if (inv.paymentStatus === "Paid") {
        paid += amount;

        // DSO calc
        if (inv.paidAt && inv.createdAt) {
          const days =
            (new Date(inv.paidAt) - new Date(inv.createdAt)) /
            (1000 * 60 * 60 * 24);
          totalCollectionDays += days;
          paidInvoicesCount++;

          // Payment trend
          if (inv.paidAt <= inv.dueDate) paymentTrend.onTime++;
          else paymentTrend.late++;
        }
      } else if (inv.paymentStatus === "Partial") {
          paid += paidAmt; 
        partial += paidAmt;
        expected += amount - paidAmt;
      } else if (inv.paymentStatus === "Overdue") {
        overdue += amount;
      } else {
        expected += amount;
      }

      // 🔥 TOP CUSTOMERS
      const name = inv.customer?.name || "Unknown";
      if (!customerMap[name]) customerMap[name] = 0;
      customerMap[name] += amount;

      // 🔥 MONTHLY TREND
      const month = new Date(inv.createdAt).toLocaleString("default", {
        month: "short",
      });
      if (!monthlyTrend[month]) monthlyTrend[month] = 0;
      monthlyTrend[month] += amount;
    });

    // 🔥 DSO
    const dso =
      paidInvoicesCount > 0
        ? Math.round(totalCollectionDays / paidInvoicesCount)
        : 0;

    // 🔥 TOP CUSTOMERS SORT
    const topCustomers = Object.entries(customerMap)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    res.json({
      total,
      paid,
      expected,
      overdue,
      partial,
      gst,

      dso,

      paymentTrend,
      monthlyTrend,
      topCustomers,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
