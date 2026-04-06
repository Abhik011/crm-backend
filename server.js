require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const backfillCompany = require("./utils/backfillCompany");
const resolveTenant = require("./middleware/tenant");
const subscriptionWriteGate = require("./middleware/subscriptionGate");

const leads = require("./routes/leads");
const customers = require("./routes/customers");
const deals = require("./routes/deals");
const invoices = require("./routes/invoices");
const dashboard = require("./routes/dashboard");
const websiteRoutes = require("./routes/website");
const agencyRoutes = require("./routes/agency");
const reportsRoutes = require("./routes/reports");
const projectRoutes = require("./routes/project");
const taskRoutes = require("./routes/tasks");
const quotesRoutes = require("./routes/quotes");
const billingRouter = require("./routes/billing");

const app = express();

app.post(
  "/api/billing/webhook",
  express.raw({ type: "application/json" }),
  billingRouter.stripeWebhookHandler
);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 500),
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", apiLimiter);

app.use("/api/billing", billingRouter);

const gated = [resolveTenant, subscriptionWriteGate];

app.use("/api/dashboard", ...gated, dashboard);
app.use("/api/invoices", ...gated, invoices);
app.use("/api/leads", ...gated, leads);
app.use("/api/customers", ...gated, customers);
app.use("/api/deals", ...gated, deals);
app.use("/api/website", ...gated, websiteRoutes);
app.use("/api/reports", ...gated, reportsRoutes);
app.use("/api/projects", ...gated, projectRoutes);
app.use("/api/tasks", ...gated, taskRoutes);
app.use("/api/quotes", ...gated, quotesRoutes);

app.use("/api/agencies", resolveTenant, agencyRoutes);

app.get("/", (req, res) => {
  res.send("Creonox CRM API running");
});

const PORT = Number(process.env.PORT || 5500);

async function start() {
  await connectDB();
  await backfillCompany();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
