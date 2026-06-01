import Agency from "../models/Agency.js";
import Customer from "../models/Customer.js";
import Deal from "../models/Deal.js";
import Invoice from "../models/Invoice.js";
import Quote from "../models/Quote.js";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import Subscription from "../models/Subscription.js";
import Lead from "../models/clead.js";

/**
 * One-time style migration: attach default agency to legacy documents missing `agency`.
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
      { $or: [{ agency: { $exists: false } }, { agency: null }] },
      { $set: { agency: cid } }
    );
  }

  console.log(
    "Company field backfill complete (default agency:",
    String(cid),
    ")"
  );
}

export default backfillCompany;