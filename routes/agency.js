const express = require("express");
const router = express.Router();

const Agency = require("../models/Agency");


// ✅ CREATE AGENCY
router.post("/", async (req, res) => {
    try {

        const agency = await Agency.create({
            name: req.body.name,
            tagline: req.body.tagline,
            address: req.body.address,
            email: req.body.email,
            phone: req.body.phone,
            website: req.body.website,
            logo: req.body.logo,
            gstin: req.body.gstin,

            bankDetails: {
                accountName: req.body.bankDetails?.accountName,
                accountNumber: req.body.bankDetails?.accountNumber,
                ifsc: req.body.bankDetails?.ifsc,
                bank: req.body.bankDetails?.bank
            }
        });

        res.json(agency);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Current company profile (from X-Company-Id / default tenant)
router.get("/default", async (req, res) => {
  try {
    const agency = await Agency.findById(req.companyId);
    if (!agency) {
      return res.status(404).json({ message: "Company not found" });
    }
    res.json(agency);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ✅ GET ALL AGENCIES
router.get("/", async (req, res) => {
    try {

        const agencies = await Agency.find();
        res.json(agencies);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ✅ GET SINGLE AGENCY
router.get("/:id", async (req, res) => {
    try {

        const agency = await Agency.findById(req.params.id);

        if (!agency)
            return res.status(404).json({ message: "Agency not found" });

        res.json(agency);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ✅ UPDATE AGENCY
router.put("/:id", async (req, res) => {
    try {

        const agency = await Agency.findById(req.params.id);

        if (!agency)
            return res.status(404).json({ message: "Agency not found" });

        Object.assign(agency, req.body);

        await agency.save();

        res.json(agency);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ✅ DELETE (optional)
router.delete("/:id", async (req, res) => {
    try {

        await Agency.findByIdAndDelete(req.params.id);

        res.json({ message: "Agency deleted" });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


module.exports = router;