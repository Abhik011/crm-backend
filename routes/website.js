import express from "express";
import Lead from "../models/clead.js";
import Subscription from "../models/Subscription.js";

const router = express.Router();

router.post("/lead", async (req, res) => {
  try {
    const { name, email, phone, company, service, message } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const lead = await Lead.create({
      agency: req.companyId,
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
      agency: req.companyId,
    });

    if (exists) {
      return res.json({ message: "Already subscribed" });
    }

    const sub = await Subscription.create({
      email,
      agency: req.companyId,
    });

    res.status(201).json({ message: "Subscribed", sub });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
