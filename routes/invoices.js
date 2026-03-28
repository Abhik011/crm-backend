const express = require("express");
const router = express.Router();
const Invoice = require("../models/Invoice");

router.post("/", async (req, res) => {

  const invoiceNumber = "INV-" + Date.now();

  const invoice = new Invoice({
    ...req.body,
    invoiceNumber
  });

  await invoice.save();

  res.json(invoice);
});

router.get("/customer/:customerId", async (req, res) => {

  try {

    const invoices = await Invoice.find({
      customer: req.params.customerId
    });

    res.json(invoices);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

router.get("/", async (req, res) => {
  const invoices = await Invoice.find().populate("customer");
  res.json(invoices);
});

module.exports = router;