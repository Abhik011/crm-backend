const express = require("express");
const router = express.Router();

const Lead = require("../models/clead");
const Subscription = require("../models/Subscription");

router.post("/lead", async (req, res) => {
  try {
    const { name, email, phone, company, service, message } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const lead = await Lead.create({
      company: req.companyId,
      name,
      email,
      phone,
      company,
      service,
      message,
    });

    res.status(201).json({ message: "Lead created", lead });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/subscribe", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const exists = await Subscription.findOne({
      email,
      company: req.companyId,
    });

    if (exists) {
      return res.json({ message: "Already subscribed" });
    }

    const sub = await Subscription.create({
      email,
      company: req.companyId,
    });

    res.status(201).json({ message: "Subscribed", sub });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
