require("dotenv").config();
const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");

const leads = require("./routes/leads");
const customers = require("./routes/customers");
const deals = require("./routes/deals");
const invoices = require("./routes/invoices");
const dashboard = require("./routes/dashboard");
const websiteRoutes = require("./routes/website");
const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.use("/api/dashboard", dashboard)
app.use("/api/invoices", invoices);
app.use("/api/leads", leads);
app.use("/api/customers", customers);
app.use("/api/deals", deals);
app.use("/api/website", websiteRoutes);
app.get("/", (req, res) => {
  res.send("Creonox CRM API running");
});

const PORT = 5500;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});