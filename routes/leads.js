const express = require("express");
const router = express.Router();
const Lead = require("../models/Lead");
const Customer = require("../models/Customer");
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

    // Create customer
    const customer = await Customer.create({
      name: lead.name,
      company: lead.company,
      phone: lead.phone,
      email: lead.email,
      source: lead.source,
      notes: lead.notes
    });

    // Create deal / project
    const deal = await Deal.create({
      customer: customer._id,
      title: lead.company || lead.name,
      status: "Active"
    });

    lead.status = "Converted";
    await lead.save();

    res.json({
      message: "Lead converted successfully",
      customer,
      deal
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});
// CREATE LEAD
router.post("/", async (req, res) => {
  try {
    const lead = new Lead(req.body);
    await lead.save();
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET ALL LEADS
router.get("/", async (req, res) => {
  const leads = await Lead.find().sort({ createdAt: -1 });
  res.json(leads);
});


// UPDATE STATUS
router.put("/:id/status", async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );

    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;