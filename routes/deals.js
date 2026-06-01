import express from "express";
import Deal from "../models/Deal.js";
import Quote from "../models/Quote.js";
import Invoice from "../models/Invoice.js";
import Customer from "../models/Customer.js";
import Agency from "../models/Agency.js";
import { calcQuoteTotals } from "../utils/quoteCalc.js";
import { assertWithinLimit } from "../services/assertPlanLimit.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const deals = await Deal.find({ agency: req.companyId })
      .populate("customer")
      .sort({ createdAt: -1 });

    res.json(deals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    if (!(await assertWithinLimit(req, res, "deals"))) return;

    const cust = await Customer.findOne({
      _id: req.body.customer,
      agency: req.companyId,
    });
    if (!cust) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const deal = await Deal.create({
      agency: req.companyId,
      customer: req.body.customer,
      title: req.body.title,
      service: req.body.service,
      value: Number(req.body.value),
      deadline: req.body.deadline,
      priority: req.body.priority,
      notes: req.body.notes,
    });

    res.json(deal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/customer/:customerId", async (req, res) => {
  try {
    const deals = await Deal.find({
      agency: req.companyId,
      customer: req.params.customerId,
    });

    res.json(deals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const deal = await Deal.findOne({
      _id: req.params.id,
      agency: req.companyId,
    }).populate("customer");
    if (!deal) return res.status(404).json({ message: "Deal not found" });
    res.json(deal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const body = { ...req.body };
    delete body.company;
    const updated = await Deal.findOneAndUpdate(
      { _id: req.params.id, agency: req.companyId },
      body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Deal not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const r = await Deal.deleteOne({
      _id: req.params.id,
      agency: req.companyId,
    });
    if (r.deletedCount === 0) {
      return res.status(404).json({ message: "Deal not found" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id/status", async (req, res) => {
  try {
    const deal = await Deal.findOne({
      _id: req.params.id,
      agency: req.companyId,
    });
    if (!deal) return res.status(404).json({ message: "Deal not found" });

    const newStatus = req.body.status;
    deal.status = newStatus;

    const [customerData, agencyData] = await Promise.all([
      Customer.findById(deal.customer),
      Agency.findById(req.companyId),
    ]);

    if (
      newStatus === "Proposal Sent" &&
      !deal.quoteCreated
    ) {
      const calc = calcQuoteTotals(
        [
          {
            name: deal.title || deal.service || "Services",
            quantity: 1,
            rate: deal.value,
          },
        ],
        "CGST_SGST",
        0
      );

      await Quote.create({
        agency: req.companyId,
        customer: deal.customer,
        deal: deal._id,
        title: deal.title || "Quotation",
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
        customerSnapshot: customerData
          ? {
              name: customerData.name || "",
              companyName: customerData.companyName || "",
              contactPerson: customerData.contactPerson || "",
              email: customerData.email || "",
              phone: customerData.phone || "",
              address: customerData.address || "",
              gstNumber: customerData.gstNumber || "",
            }
          : {},
      });

      deal.quoteCreated = true;
    }

    if (
      newStatus === "In Progress" &&
      !deal.invoiceCreated
    ) {
      const subtotal = deal.value;
      const cgst = Math.round(subtotal * 0.09);
      const sgst = Math.round(subtotal * 0.09);
      const totalAmount = subtotal + cgst + sgst;

      await Invoice.create({
        agency: req.companyId,
        customer: deal.customer,
        deal: deal._id,
        agency: agencyData?._id,
        customerSnapshot: customerData
          ? {
              name: customerData.name || "",
              companyName: customerData.companyName || "",
              contactPerson: customerData.contactPerson || "",
              email: customerData.email || "",
              phone: customerData.phone || "",
              address: customerData.address || "",
              gstNumber: customerData.gstNumber || "",
            }
          : {},
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
        items: [
          {
            name: deal.title,
            quantity: 1,
            rate: deal.value,
            total: deal.value,
          },
        ],
        subtotal: deal.value,
        cgst,
        sgst,
        igst: 0,
        gstType: "CGST_SGST",
        totalAmount,
        status: "Draft",
        invoiceNumber: "INV-" + Date.now(),
      });

      deal.invoiceCreated = true;
    }

    if (newStatus === "Completed") {
      const invoice = await Invoice.findOne({
        deal: deal._id,
        agency: req.companyId,
      });

      if (invoice) {
        invoice.status = "Final";
        await invoice.save();
      }
    }

    await deal.save();
    res.json(deal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
