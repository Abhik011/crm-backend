import mongoose from "mongoose";
import Agency from "../models/Agency.js";
import { getLimitsForPlan } from "../config/plans.js";

/**
 * Public embed routes (e.g. lead forms): tenant must be passed explicitly.
 * Requires header `X-Company-Id` with a valid Agency id — no default/fallback.
 */
function resolveWebsiteTenant(req, res, next) {
  (async () => {
    try {
      const headerId = req.get("X-Company-Id");
      if (!headerId || !mongoose.Types.ObjectId.isValid(headerId)) {
        return res.status(400).json({
          message: "X-Company-Id header must be set to a valid company id",
        });
      }

      const agencyDoc = await Agency.findById(headerId);
      if (!agencyDoc) {
        return res.status(404).json({ message: "Company not found" });
      }

      const plain = agencyDoc.toObject();

      req.companyId = agencyDoc._id;
      req.agencyId = agencyDoc._id;
      req.agency = plain;
      req.planLimits = getLimitsForPlan(plain.planKey || "free");

      next();
    } catch (err) {
      next(err);
    }
  })();
}

export default resolveWebsiteTenant;
