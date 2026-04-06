const mongoose = require("mongoose");
const Agency = require("../models/Agency");
const { getLimitsForPlan } = require("../config/plans");

/**
 * Resolves tenant and loads full Agency document for billing + plan limits.
 */
function resolveTenant(req, res, next) {
  (async () => {
    try {
      const headerId = req.get("X-Company-Id");
      let agencyDoc = null;

      if (headerId && mongoose.Types.ObjectId.isValid(headerId)) {
        agencyDoc = await Agency.findById(headerId);
      }

      if (!agencyDoc) {
        agencyDoc = await Agency.findOne().sort({ createdAt: 1, _id: 1 });
        if (!agencyDoc) {
          agencyDoc = await Agency.create({
            name: "Default Company",
            bankDetails: {},
            planKey: "free",
            subscriptionStatus: "active",
          });
        }
      }

      const plain = agencyDoc.toObject();
      req.companyId = agencyDoc._id;
      req.agency = plain;
      req.planLimits = getLimitsForPlan(plain.planKey || "free");

      next();
    } catch (err) {
      next(err);
    }
  })();
}

module.exports = resolveTenant;
