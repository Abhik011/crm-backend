const Agency = require("../models/Agency");
const Customer = require("../models/Customer");
const Deal = require("../models/Deal");
const Invoice = require("../models/Invoice");
const Quote = require("../models/Quote");
const Project = require("../models/Project");
const Task = require("../models/Task");
const Subscription = require("../models/Subscription");
const Lead = require("../models/clead");

/**
 * One-time style migration: attach default agency to legacy documents missing `company`.
 */
async function backfillCompany() {
  let first = await Agency.findOne().sort({ createdAt: 1, _id: 1 });
  if (!first) {
    first = await Agency.create({
      name: "Default Company",
      bankDetails: {},
      planKey: "free",
      subscriptionStatus: "active",
    });
  }
  const cid = first._id;

  await Agency.updateMany(
    {
      $or: [
        { planKey: { $exists: false } },
        { planKey: null },
        { subscriptionStatus: { $exists: false } },
      ],
    },
    {
      $set: {
        planKey: "free",
        subscriptionStatus: "active",
      },
    }
  );

  const models = [
    Customer,
    Deal,
    Invoice,
    Quote,
    Project,
    Task,
    Subscription,
    Lead,
  ];

  for (const Model of models) {
    await Model.updateMany(
      { $or: [{ company: { $exists: false } }, { company: null }] },
      { $set: { company: cid } }
    );
  }

  console.log("Company field backfill complete (default agency:", String(cid), ")");
}

module.exports = backfillCompany;
