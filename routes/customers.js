const express = require("express");
const router = express.Router();
const Customer = require("../models/Customer");


// CREATE CUSTOMER
router.post("/", async (req, res) => {
  const customer = new Customer(req.body);
  await customer.save();
  res.json(customer);
});


// GET ALL CUSTOMERS
router.get("/", async (req, res) => {
  const customers = await Customer.find();
  res.json(customers);
});


// GET SINGLE CUSTOMER
router.get("/:id", async (req, res) => {

  try {

    const customer = await Customer.findById(req.params.id);

    if (!customer)
      return res.status(404).json({ message: "Customer not found" });

    res.json(customer);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});


module.exports = router;