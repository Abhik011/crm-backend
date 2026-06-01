import { verifyToken } from "@clerk/backend";
import mongoose from "mongoose";
import Agency from "../models/Agency.js";
import User from "../models/User.js";
import { getLimitsForPlan } from "../config/plans.js";
import {
  readClerkMetadataCompanyId,
  syncClerkWorkspaceUser,
} from "./clerkSync.js";

function clerkPrimaryEmail(payload) {
  if (payload.email) return String(payload.email).toLowerCase();
  const p = payload.primary_email_address;
  if (typeof p === "string") return p.toLowerCase();
  if (p?.email_address) return String(p.email_address).toLowerCase();
  return null;
}

function workspaceTitle(payload, email) {
  if (email) return email.split("@")[0];
  if (payload.username) return String(payload.username);
  if (payload.first_name) return String(payload.first_name);
  return "Workspace";
}

function ownerOnboardingDone(agency) {
  return agency?.workspaceOnboardingCompleted !== false;
}

/**
 * Invited users must join the existing workspace — never auto-create a second org.
 */
async function resolveInvitedMembership(clerkUserId, email) {
  const normalizedEmail = email?.toLowerCase();

  if (normalizedEmail) {
    const byEmail = await User.findOne({ email: normalizedEmail });
    if (byEmail) {
      if (String(byEmail.clerkId) !== String(clerkUserId)) {
        byEmail.clerkId = clerkUserId;
        await byEmail.save();
      }
      const agency = await Agency.findById(byEmail.companyId);
      if (agency) {
        await syncClerkWorkspaceUser({
          clerkUserId,
          companyId: agency._id,
          role: byEmail.role,
          workspaceName: agency.name,
          userName: byEmail.name,
        });
        return { user: byEmail, agency };
      }
    }
  }

  const metaCompanyId = await readClerkMetadataCompanyId(clerkUserId);
  if (metaCompanyId && mongoose.Types.ObjectId.isValid(metaCompanyId)) {
    const agency = await Agency.findById(metaCompanyId);
    if (agency) {
      let user = await User.findOne({
        clerkId: clerkUserId,
        companyId: agency._id,
      });
      if (!user && normalizedEmail) {
        user = await User.findOne({
          email: normalizedEmail,
          companyId: agency._id,
        });
        if (user) {
          user.clerkId = clerkUserId;
          await user.save();
        }
      }
      if (user) {
        await syncClerkWorkspaceUser({
          clerkUserId,
          companyId: agency._id,
          role: user.role,
          workspaceName: agency.name,
          userName: user.name,
        });
        return { user, agency };
      }
    }
  }

  return null;
}

/**
 * Resolves Agency + User from a Clerk session JWT (HTTP or Socket).
 * Supports workspace owner (Agency.clerkUserId) and invited users (User.clerkId).
 */
export async function resolveWorkspaceFromToken(bearerToken) {
  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error("CLERK_SECRET_KEY is not set");
  }

  const token = String(bearerToken || "").trim();
  if (!token) throw new Error("Missing token");

  const payload = await verifyToken(token, {
    secretKey: process.env.CLERK_SECRET_KEY,
  });

  const clerkUserId = payload.sub;
  const email = clerkPrimaryEmail(payload) || undefined;

  let user = await User.findOne({ clerkId: clerkUserId });
  let agency;

  if (user) {
    agency = await Agency.findById(user.companyId);
    if (!agency) {
      throw new Error("User workspace not found");
    }
  } else {
    const invited = await resolveInvitedMembership(clerkUserId, email);
    if (invited) {
      user = invited.user;
      agency = invited.agency;
    } else {
      agency = await Agency.findOne({ clerkUserId });

      if (!agency && email) {
        const legacy = await Agency.findOne({
          email,
          $or: [
            { clerkUserId: { $exists: false } },
            { clerkUserId: null },
            { clerkUserId: "" },
          ],
        });
        if (legacy) {
          legacy.clerkUserId = clerkUserId;
          await legacy.save();
          agency = legacy;
        }
      }

      if (!agency) {
        try {
          agency = await Agency.create({
            name: workspaceTitle(payload, email),
            email,
            clerkUserId,
            planKey: "free",
            subscriptionStatus: "active",
            bankDetails: {},
            workspaceOnboardingCompleted: false,
          });
        } catch (err) {
          if (err?.code === 11000) {
            agency = await Agency.findOne({ clerkUserId });
          }
          if (!agency) throw err;
        }
      }

      user = await User.findOne({ clerkId: clerkUserId, companyId: agency._id });

      if (!user) {
        const count = await User.countDocuments({ companyId: agency._id });
        const isOwner =
          agency.clerkUserId && String(agency.clerkUserId) === String(clerkUserId);

        user = await User.create({
          clerkId: clerkUserId,
          companyId: agency._id,
          email: email || `${clerkUserId}@users.creonox.local`,
          name: payload.first_name || payload.username || "User",
          role: isOwner || count === 0 ? "super_admin" : "employee",
          onboardingCompleted: isOwner
            ? ownerOnboardingDone(agency)
            : false,
        });

        if (isOwner) {
          await syncClerkWorkspaceUser({
            clerkUserId,
            companyId: agency._id,
            role: "super_admin",
            workspaceName: agency.name,
            userName: user.name,
          });
        }
      }
    }
  }

  const plainAgency = agency.toObject ? agency.toObject() : agency;
  const planLimits = getLimitsForPlan(plainAgency.planKey || "free");

  return {
    clerkUserId,
    agency,
    user,
    companyId: agency._id,
    planLimits,
    plainAgency,
  };
}
