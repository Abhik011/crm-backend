import { resolveWorkspaceFromToken } from "../services/authContext.js";

/**
 * Verifies Clerk JWT and attaches tenant + DB user to the request.
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing Authorization header (Bearer token)" });
    }

    const token = authHeader.slice(7).trim();
    const ctx = await resolveWorkspaceFromToken(token);

    req.clerkUserId = ctx.clerkUserId;
    req.companyId = ctx.companyId;
    req.agencyId = ctx.companyId;
    req.agency = ctx.plainAgency;
    req.planLimits = ctx.planLimits;
    req.user = ctx.user;
    /** Mongo User id — use for Message.sender, ChatRoom.participants, etc. */
    req.userId = ctx.user._id;

    next();
  } catch (err) {
    console.error("requireAuth:", err?.message || err);
    return res.status(401).json({ message: "Unauthorized" });
  }
}

export default requireAuth;
