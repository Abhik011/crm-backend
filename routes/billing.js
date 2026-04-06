const express = require("express");
const mongoose = require("mongoose");
const resolveTenant = require("../middleware/tenant");
const Agency = require("../models/Agency");
const {
  listPlansPublic,
  getStripePriceId,
  PLANS,
} = require("../config/plans");
const { getUsageSnapshot } = require("../services/usage");

const router = express.Router();

router.get("/plans", (req, res) => {
  res.json({ plans: listPlansPublic() });
});

router.get("/status", resolveTenant, async (req, res) => {
  try {
    const usage = await getUsageSnapshot(req.companyId);
    res.json({
      planKey: req.agency.planKey || "free",
      subscriptionStatus: req.agency.subscriptionStatus || "active",
      limits: req.planLimits,
      usage,
      hasStripeCustomer: !!req.agency.stripeCustomerId,
      currentPeriodEnd: req.agency.currentPeriodEnd,
      cancelAtPeriodEnd: req.agency.cancelAtPeriodEnd,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/checkout", resolveTenant, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ message: "Stripe is not configured" });
    }
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    const { planKey } = req.body;
    const priceId = getStripePriceId(planKey);
    if (!priceId || !PLANS[planKey]?.stripePriceIdEnv) {
      return res
        .status(400)
        .json({ message: "Invalid plan or STRIPE_PRICE_* env not set" });
    }

    const agency = await Agency.findById(req.companyId);
    if (!agency) return res.status(404).json({ message: "Company not found" });

    let customerId = agency.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: agency.email || undefined,
        name: agency.name || undefined,
        metadata: { companyId: String(req.companyId) },
      });
      customerId = customer.id;
      agency.stripeCustomerId = customerId;
      await agency.save();
    }

    const appUrl = (process.env.APP_URL || "http://localhost:3001").replace(
      /\/$/,
      ""
    );

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: String(req.companyId),
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing?canceled=1`,
      subscription_data: {
        metadata: {
          companyId: String(req.companyId),
          planKey,
        },
      },
      metadata: {
        companyId: String(req.companyId),
        planKey,
      },
    });

    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/portal", resolveTenant, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ message: "Stripe is not configured" });
    }
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    const agency = await Agency.findById(req.companyId);
    if (!agency?.stripeCustomerId) {
      return res.status(400).json({
        message:
          "No Stripe customer yet. Start a paid subscription from Pricing first.",
      });
    }

    const appUrl = (process.env.APP_URL || "http://localhost:3001").replace(
      /\/$/,
      ""
    );

    const session = await stripe.billingPortal.sessions.create({
      customer: agency.stripeCustomerId,
      return_url: `${appUrl}/billing`,
    });

    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function mapStripeSubStatus(stripeStatus) {
  const m = {
    trialing: "trialing",
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "unpaid",
    incomplete: "none",
    incomplete_expired: "canceled",
    paused: "past_due",
  };
  return m[stripeStatus] || "active";
}

function planKeyFromStripePriceId(priceId) {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  return null;
}

async function stripeWebhookHandler(req, res) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).send("Stripe webhook not configured");
  }

  const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const companyId = session.metadata?.companyId || session.client_reference_id;
        const planKey = session.metadata?.planKey;
        if (companyId && mongoose.Types.ObjectId.isValid(companyId)) {
          const update = {
            subscriptionStatus: "active",
            stripeCustomerId: session.customer,
          };
          if (session.subscription) {
            update.stripeSubscriptionId = session.subscription;
          }
          if (planKey && PLANS[planKey]) {
            update.planKey = planKey;
          }
          await Agency.findByIdAndUpdate(companyId, { $set: update });
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object;
        const priceId = sub.items?.data?.[0]?.price?.id;
        let planKey = sub.metadata?.planKey || planKeyFromStripePriceId(priceId);

        let agency =
          (await Agency.findOne({ stripeSubscriptionId: sub.id })) ||
          (sub.metadata?.companyId &&
            mongoose.Types.ObjectId.isValid(sub.metadata.companyId)
            ? await Agency.findById(sub.metadata.companyId)
            : null);

        if (agency) {
          const update = {
            stripeSubscriptionId: sub.id,
            subscriptionStatus: mapStripeSubStatus(sub.status),
            currentPeriodEnd: sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : undefined,
            cancelAtPeriodEnd: !!sub.cancel_at_period_end,
          };
          if (planKey && PLANS[planKey]) {
            update.planKey = planKey;
          }
          await Agency.findByIdAndUpdate(agency._id, { $set: update });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const agency = await Agency.findOne({
          stripeSubscriptionId: sub.id,
        });
        if (agency) {
          await Agency.findByIdAndUpdate(agency._id, {
            $set: {
              subscriptionStatus: "canceled",
              planKey: "free",
              stripeSubscriptionId: null,
              cancelAtPeriodEnd: false,
            },
          });
        }
        break;
      }

      default:
        break;
    }
  } catch (e) {
    console.error("Stripe webhook handler error", e);
    return res.status(500).json({ error: e.message });
  }

  res.json({ received: true });
}

module.exports = router;
module.exports.stripeWebhookHandler = stripeWebhookHandler;
