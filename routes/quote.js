const express = require("express");
const router = express.Router();
const Quote = require("../models/Quote");

// GET BY CUSTOMER
router.get("/customer/:customerId", async (req, res) => {
  try {

    const quotes = await Quote.find({
      customer: req.params.customerId
    });

    res.json(quotes);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;