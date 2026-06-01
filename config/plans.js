function envPrice(key) {
  return process.env[key] || null;
}

export const PLANS = {
  free: {
    key: "free",
    name: "Free",
    description: "Get started with core CRM features",
    limits: {
      leads: 100,
      customers: 100,
      deals: 50,
      invoices: 50,
      quotes: 50,
    },
    stripePriceId: null,
    features: ["Leads & pipeline", "Customers", "Deals", "Invoices & quotes", "Reports"],
  },
  starter: {
    key: "starter",
    name: "Starter",
    description: "Growing teams that need higher limits",
    limits: {
      leads: 5000,
      customers: 5000,
      deals: 2500,
      invoices: 2500,
      quotes: 2500,
    },
    stripePriceIdEnv: "STRIPE_PRICE_STARTER",
    features: ["Everything in Free", "Higher record limits", "Email support"],
  },
  pro: {
    key: "pro",
    name: "Pro",
    description: "Unlimited scale for serious operations",
    limits: {
      leads: -1,
      customers: -1,
      deals: -1,
      invoices: -1,
      quotes: -1,
    },
    stripePriceIdEnv: "STRIPE_PRICE_PRO",
    features: ["Unlimited records", "Priority support", "Best for SaaS resale"],
  },
};

export function getStripePriceId(planKey) {
  const p = PLANS[planKey];
  if (!p || !p.stripePriceIdEnv) return null;
  return envPrice(p.stripePriceIdEnv);
}

export function getLimitsForPlan(planKey) {
  const p = PLANS[planKey] || PLANS.free;
  return { ...p.limits };
}

export function listPlansPublic() {
  return Object.values(PLANS).map((p) => ({
    key: p.key,
    name: p.name,
    description: p.description,
    limits: p.limits,
    features: p.features,
    isPaid: !!p.stripePriceIdEnv,
  }));
}