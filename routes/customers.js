import express from "express";
import Customer from "../models/Customer.js";
import { assertWithinLimit } from "../services/assertPlanLimit.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    if (!(await assertWithinLimit(req, res, "customers"))) return;

    const customer = new Customer({
      ...req.body,
      agency: req.companyId,
    });
    await customer.save();
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/search", async (req, res) => {
  try {
    const q = req.query.q;

    const customers = await Customer.find({
      agency: req.companyId,
      $or: [
        { name: new RegExp(q, "i") },
        { companyName: new RegExp(q, "i") },
        { email: new RegExp(q, "i") },
        
      ],
    }).limit(10);

    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const customers = await Customer.find({ agency: req.companyId });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      agency: req.companyId,
    });

    if (!customer)
      return res.status(404).json({ message: "Customer not found" });

    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
