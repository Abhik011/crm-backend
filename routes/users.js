import express from "express";
import crypto from "node:crypto";
import User from "../models/User.js";
import Agency from "../models/Agency.js";
import requireRole from "../middleware/requireRole.js";
import { createClerkClient } from "@clerk/backend";
import { isClerkAPIResponseError } from "@clerk/backend/errors";
import { sendEmail } from "../services/emailService.js";
import { INVITE_ROLES, WORKSPACE_ROLES } from "../constants/workspaceRoles.js";
import { generateTemporaryPassword } from "../utils/tempPassword.js";
import multer from "multer";
import { uploadFile, deleteFile } from "../utils/s3.js";
const upload = multer({ storage: multer.memoryStorage() });
import {
  buildWorkspaceInviteHtml,
  buildWorkspaceInviteText,
} from "../templates/workspaceInvite.js";
import { inviteEmailSubject } from "../config/brand.js";
import { companyTenureFromCreatedAt } from "../utils/tenure.js";
import { syncClerkWorkspaceUser } from "../services/clerkSync.js";

const router = express.Router();

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

function splitDisplayName(name) {
  const n = String(name || "").trim();
  if (!n) return { firstName: "User", lastName: "" };
  const parts = n.split(/\s+/);
  const firstName = parts[0] || "User";
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
  return { firstName, lastName };
}
/**
 * Clerk usernames are unique per instance. Many dashboards require username on sign-up;
 * we derive a stable-looking handle from email + random suffix to avoid collisions.
 */
function generateUniqueUsername(email) {
  const local = String(email || "user").split("@")[0] || "user";
  let base = local
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  base = base.replace(/^[0-9]+/, "") || "user";
  base = base.slice(0, 24);
  if (base.length < 3) {
    base = `user${base}`.slice(0, 24);
  }
  const suffix = crypto.randomBytes(5).toString("hex");
  return `${base}${suffix}`.slice(0, 50);
}

function clientAppUrl() {
  return (
    process.env.APP_URL ||
    process.env.CLIENT_URL ||
    process.env.FRONTEND_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

const adminRoles = ["super_admin", "admin"];

router.get("/me", async (req, res) => {
  const u = req.user;
  let companyName = null;
  let ag = null;
  try {
    ag = await Agency.findById(req.companyId)
      .select("name logo planKey workspaceOnboardingCompleted")
      .lean();
    companyName = ag?.name ?? null;
  } catch {
    companyName = null;
    ag = null;
  }

  const tenure = companyTenureFromCreatedAt(u.createdAt);

  res.json({
    id: String(u._id),
    role: u.role,
    name: u.name,
    email: u.email,
    companyId: String(req.companyId),
    companyName,
    image: u.image || "",
    clerkId: u.clerkId,
    createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
    updatedAt: u.updatedAt ? new Date(u.updatedAt).toISOString() : null,
    presenceStatus: u.presenceStatus || "free",
    chatWallpaper: u.chatWallpaper || "default",
    companyTenure: tenure,
    workspaceOnboardingCompleted: ag?.workspaceOnboardingCompleted !== false,
    agencyLogo: ag?.logo || "",
    planKey: ag?.planKey || "free",
    /** false = show onboarding; missing field treated as completed for legacy users */
    onboardingCompleted: u.onboardingCompleted !== false,
  });
});

const PRESENCE_STATUSES = ["free", "busy", "working"];
const CHAT_WALLPAPERS = [
  "default",
  "dots",
  "grid",
  "warm",
  "cool",
  "mint",
  "slate",
];

router.patch("/me/presence", async (req, res) => {
  try {
    const status = String(req.body.status || "").toLowerCase();
    if (!PRESENCE_STATUSES.includes(status)) {
      return res.status(400).json({
        message: "status must be free, busy, or working",
      });
    }

    await User.updateOne(
      { _id: req.user._id, companyId: req.companyId },
      { $set: { presenceStatus: status } }
    );

    const io = req.app.get("io");
    if (io) {
      io.to(`company:${req.companyId}`).emit("presence_update", {
        userId: String(req.user._id),
        presenceStatus: status,
      });
    }

    res.json({ ok: true, presenceStatus: status });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/me/chat-preferences", async (req, res) => {
  try {
    const wallpaper = String(req.body.chatWallpaper || "default");
    if (!CHAT_WALLPAPERS.includes(wallpaper)) {
      return res.status(400).json({ message: "Invalid wallpaper preset" });
    }

    await User.updateOne(
      { _id: req.user._id, companyId: req.companyId },
      { $set: { chatWallpaper: wallpaper } }
    );

    res.json({ ok: true, chatWallpaper: wallpaper });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Mark workspace onboarding finished (invited employees). */
router.post("/me/onboarding/complete", async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.user._id, companyId: req.companyId },
      { $set: { onboardingCompleted: true } }
    );
    req.user.onboardingCompleted = true;
    res.json({ ok: true, onboardingCompleted: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put(
  "/me/profile",
  upload.single("file"),
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id);
console.log(req.headers["content-type"]);
console.log(req.file);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      // update name
      if (req.body.name) {
        user.name = req.body.name;
      }

      // upload image
      if (req.file) {
        const uploaded = await uploadFile({
          file: req.file,
          folder: "profiles",
          companyId: req.companyId,
        });

        user.image = uploaded.url;
      }

      await user.save();

      res.json({
        success: true,
        user,
      });
    } catch (err) {
      console.log(err);

      res.status(500).json({
        message: err.message,
      });
    }
  }
);

/** Minimal user list for issue assignees (any authenticated workspace member). */
router.get("/assignable", async (req, res) => {
  try {
    const users = await User.find({ companyId: req.companyId })
      .select("name email role image presenceStatus createdAt")
      .sort({ name: 1, email: 1 })
      .lean();
    res.json(
      users.map((u) => ({
        id: String(u._id),
        name: u.name || u.email || "Member",
        email: u.email,
        role: u.role,
        image: u.image || "",
        presenceStatus: u.presenceStatus || "free",
        createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
        companyTenure: companyTenureFromCreatedAt(u.createdAt),
      }))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/", requireRole(adminRoles), async (req, res) => {
  try {
    const users = await User.find({
      companyId: req.companyId,
    }).select("-__v");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", requireRole(["super_admin"]), async (req, res) => {
  /** If we create a brand-new Clerk user and Mongo fails, delete that Clerk user. */
  let clerkUserIdToRollback = null;
  /** If we patched an existing Clerk user and Mongo fails, restore their previous publicMetadata. */
  let linkedClerkRestore = null;
  try {
    let { name, email, role } = req.body;

    email = String(email || "").toLowerCase().trim();

    if (!email || !role) {
      return res.status(400).json({ message: "Email and role required" });
    }

    if (!INVITE_ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const existing = await User.findOne({
      email,
      companyId: req.companyId,
    });

    if (existing) {
      return res.status(400).json({ message: "User already exists in this workspace" });
    }

    const { firstName, lastName } = splitDisplayName(name);
    const displayName = name || `${firstName} ${lastName}`.trim();
    const tempPassword = generateTemporaryPassword();
    const signInUrl = `${clientAppUrl()}/sign-in`;

    const list = await clerk.users.getUserList({
      emailAddress: [email],
      limit: 5,
    });
    const existingClerk = list?.data?.find((u) =>
      (u.emailAddresses || []).some(
        (a) => String(a.emailAddress || "").toLowerCase() === email
      )
    );

    let clerkUser;
    /** Set after Clerk user exists and password is applied (new or linked). */
    let plaintextPasswordForEmail = null;

    if (existingClerk) {
      const alreadyMember = await User.findOne({
        clerkId: existingClerk.id,
        companyId: req.companyId,
      });
      if (alreadyMember) {
        return res.status(400).json({
          message: "This person is already a member of this workspace",
        });
      }

      const prevMd = existingClerk.publicMetadata || {};
      await clerk.users.updateUser(existingClerk.id, {
        publicMetadata: {
          ...prevMd,
          companyId: req.companyId.toString(),
          role,
        },
      });
      linkedClerkRestore = {
        userId: existingClerk.id,
        publicMetadata: JSON.parse(JSON.stringify(prevMd)),
      };
      clerkUser = existingClerk;

      const uname =
        existingClerk.username != null && String(existingClerk.username).trim() !== ""
          ? null
          : generateUniqueUsername(email);
      if (uname) {
        try {
          await clerk.users.updateUser(existingClerk.id, { username: uname });
          clerkUser = { ...existingClerk, username: uname };
        } catch (uErr) {
          console.error("Set username for linked Clerk user failed:", uErr);
        }
      }
    } else {
      let createErr;
      let created = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const username = generateUniqueUsername(email);
        try {
          created = await clerk.users.createUser({
            username,
            emailAddress: [email],
            firstName,
            lastName: lastName || undefined,
            password: tempPassword,
            skipPasswordChecks: true,
            skipLegalChecks: true,
            publicMetadata: {
              companyId: req.companyId.toString(),
              role,
            },
          });
          createErr = null;
          break;
        } catch (e) {
          createErr = e;
          const duplicateUser =
            isClerkAPIResponseError(e) &&
            e.errors?.some(
              (er) =>
                String(er.code || "").includes("identifier") ||
                String(er.code || "") === "form_identifier_exists" ||
                String(er.message || "").toLowerCase().includes("already exists")
            );
          if (!duplicateUser || attempt === 4) {
            throw e;
          }
        }
      }
      if (!created) {
        throw createErr || new Error("Clerk user creation failed");
      }
      clerkUser = created;
      clerkUserIdToRollback = clerkUser.id;
      plaintextPasswordForEmail = tempPassword;
    }

    const agInvite = await Agency.findById(req.companyId).select("name").lean();
    const workspaceName = agInvite?.name?.trim() || null;

    const user = await User.create({
      clerkId: clerkUser.id,
      name: displayName,
      email,
      role,
      companyId: req.companyId,
      onboardingCompleted: false,
    });

    await syncClerkWorkspaceUser({
      clerkUserId: clerkUser.id,
      companyId: req.companyId,
      role,
      workspaceName: workspaceName || undefined,
      userName: displayName,
    });

    if (existingClerk) {
      try {
        await clerk.users.updateUser(clerkUser.id, {
          password: tempPassword,
          skipPasswordChecks: true,
        });
        plaintextPasswordForEmail = tempPassword;
      } catch (pwErr) {
        console.error("Set password for linked Clerk user failed:", pwErr);
      }
    }

    const clerkUsernameForEmail =
      clerkUser?.username != null && String(clerkUser.username).trim() !== ""
        ? String(clerkUser.username).trim()
        : null;

    const html = buildWorkspaceInviteHtml({
      displayName,
      signInUrl,
      email,
      plaintextPassword: plaintextPasswordForEmail,
      role,
      clerkUsername: clerkUsernameForEmail,
      workspaceName,
    });
    const text = buildWorkspaceInviteText({
      displayName,
      signInUrl,
      email,
      plaintextPassword: plaintextPasswordForEmail,
      role,
      clerkUsername: clerkUsernameForEmail,
      workspaceName,
    });
    const emailResult = await sendEmail(
      email,
      inviteEmailSubject(),
      html,
      text
    );

    res.status(201).json({
      message: "User created successfully",
      user,
      emailSent: emailResult.ok,
      inviteEmailHasPassword: Boolean(plaintextPasswordForEmail),
      ...(emailResult.ok ? {} : { emailWarning: emailResult.reason }),
    });
  } catch (err) {
    console.error("Create user error:", err);

    if (linkedClerkRestore) {
      try {
        await clerk.users.updateUser(linkedClerkRestore.userId, {
          publicMetadata: linkedClerkRestore.publicMetadata,
        });
      } catch (revertErr) {
        console.error("Revert linked Clerk metadata failed:", revertErr);
      }
    }

    if (clerkUserIdToRollback) {
      try {
        await clerk.users.deleteUser(clerkUserIdToRollback);
      } catch (delErr) {
        console.error("Rollback Clerk user failed:", delErr);
      }
    }

    if (err.code === 11000) {
      return res.status(400).json({ message: "User already exists" });
    }

    if (isClerkAPIResponseError(err)) {
      const first = err.errors?.[0];
      const status =
        err.status === 422 || err.status === 400 || err.status === 409
          ? err.status
          : 502;
      return res.status(status).json({
        message: first?.longMessage || first?.message || "Clerk could not create this user",
        code: first?.code,
        meta: first?.meta,
      });
    }

    res.status(500).json({
      message: err?.message || "Failed to create user",
    });
  }
});

router.patch("/:id/role", requireRole(["super_admin"]), async (req, res) => {
  try {
    const { role } = req.body;

    if (!WORKSPACE_ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const target = await User.findOne({
      _id: req.params.id,
      companyId: req.companyId,
    });

    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    if (target.role === "super_admin" && role !== "super_admin") {
      const superAdmins = await User.countDocuments({
        companyId: req.companyId,
        role: "super_admin",
      });
      if (superAdmins <= 1) {
        return res.status(400).json({
          message: "Cannot change role of the only super admin",
        });
      }
    }

    target.role = role;
    await target.save();

    try {
      const cu = await clerk.users.getUser(target.clerkId);
      const pm = { ...(cu.publicMetadata || {}) };
      pm.companyId = req.companyId.toString();
      pm.role = role;
      await clerk.users.updateUser(target.clerkId, { publicMetadata: pm });
    } catch (syncErr) {
      console.error("Clerk publicMetadata role sync failed:", syncErr);
    }

    res.json(target);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", requireRole(["super_admin"]), async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    const target = await User.findOne({
      _id: req.params.id,
      companyId: req.companyId,
    });

    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    if (target.role === "super_admin") {
      const superAdmins = await User.countDocuments({
        companyId: req.companyId,
        role: "super_admin",
      });
      if (superAdmins <= 1) {
        return res.status(400).json({ message: "Cannot delete the only super admin" });
      }
    }

    const agency = await Agency.findById(req.companyId);
    if (agency && String(agency.clerkUserId || "") === String(target.clerkId || "")) {
      return res.status(400).json({
        message:
          "This user is the workspace billing owner in Clerk. Remove them from Clerk only after transferring company ownership.",
      });
    }

    try {
      await clerk.users.deleteUser(target.clerkId);
    } catch (clerkDelErr) {
      console.error("Clerk deleteUser failed:", clerkDelErr);
      const notFound =
        isClerkAPIResponseError(clerkDelErr) && clerkDelErr.status === 404;
      if (!notFound) {
        const first = clerkDelErr?.errors?.[0];
        return res.status(502).json({
          message:
            first?.longMessage ||
            first?.message ||
            clerkDelErr?.message ||
            "Could not delete user from Clerk",
          code: first?.code,
        });
      }
    }

    await User.findOneAndDelete({
      _id: req.params.id,
      companyId: req.companyId,
    });

    res.json({ message: "User removed from workspace and deleted from Clerk" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
