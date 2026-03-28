const express = require("express");
const router = express.Router();
const Deal = require("../models/Deal");


router.post("/:id/convert", async (req, res) => {

  try {

    const lead = await Lead.findById(req.params.id);

    if (!lead)
      return res.status(404).json({ message: "Lead not found" });

    if (lead.status !== "Qualified")
      return res.status(400).json({
        message: "Lead must be Qualified before conversion"
      });

    const customer = await Customer.create({
      name: lead.name,
      company: lead.company,
      phone: lead.phone,
      email: lead.email,
      source: lead.source,
      notes: lead.notes
    });

    const deal = await Deal.create({
      customer: customer._id,
      lead: lead._id,
      route: req.body.route || "",
      truckType: req.body.truckType || "",
      volume: req.body.volume || 0,
      rate: req.body.rate || 0
    });

    lead.status = "Converted";
    await lead.save();

    res.json({
      message: "Lead converted",
      customer,
      deal
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  const deal = new Deal(req.body);
  await deal.save();
  res.json(deal);
});

router.get("/", async (req, res) => {
  const deals = await Deal.find().populate("customer");
  res.json(deals);
});

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

module.exports = router;