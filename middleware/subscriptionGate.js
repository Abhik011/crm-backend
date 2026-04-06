/**
 * Blocks mutating requests when subscription is not in good standing.
 * GET/HEAD/OPTIONS always pass (read-only access for churned customers).
 */
function subscriptionWriteGate(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const status = req.agency?.subscriptionStatus ?? "active";

  if (["canceled", "unpaid"].includes(status)) {
    return res.status(402).json({
      code: "SUBSCRIPTION_INACTIVE",
      message:
        "Your subscription is not active. Open Billing to renew or choose a plan.",
      subscriptionStatus: status,
    });
  }

  next();
}

module.exports = subscriptionWriteGate;
