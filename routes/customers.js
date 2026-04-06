const express = require("express");
const router = express.Router();
const Customer = require("../models/Customer");
const { assertWithinLimit } = require("../services/assertPlanLimit");

router.post("/", async (req, res) => {
  try {
    if (!(await assertWithinLimit(req, res, "customers"))) return;

    const customer = new Customer({
      ...req.body,
      company: req.companyId,
    });
    await customer.save();
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const customers = await Customer.find({ company: req.companyId });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      company: req.companyId,
    });

    if (!customer)
      return res.status(404).json({ message: "Customer not found" });

    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
