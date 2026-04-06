const { getLimitsForPlan } = require("../config/plans");
const { countForCompany } = require("./usage");

/**
 * Returns false and sends JSON error if limit exceeded; otherwise true.
 */
async function assertWithinLimit(req, res, resource) {
  const planKey = req.agency?.planKey || "free";
  const limits = req.planLimits || getLimitsForPlan(planKey);
  const max = limits[resource];

  if (max === -1 || max === undefined) return true;

  const usage = await countForCompany(req.companyId, resource);
  if (usage >= max) {
    res.status(403).json({
      code: "PLAN_LIMIT",
      resource,
      limit: max,
      usage,
      planKey,
      message: `Plan limit reached for ${resource}. Upgrade your subscription to add more.`,
    });
    return false;
  }
  return true;
}

module.exports = { assertWithinLimit };
