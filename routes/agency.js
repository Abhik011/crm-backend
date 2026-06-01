import express from "express";
import AWS from "aws-sdk";
import multer from "multer";

import Agency from "../models/Agency.js";
import User from "../models/User.js";
import { uploadFile, deleteFile } from "../utils/s3.js";
import { PLANS } from "../config/plans.js";
import { syncClerkWorkspaceUser } from "../services/clerkSync.js";

const router = express.Router();
const upload = multer();

const s3 = new AWS.S3();

// 🔥 DELETE HELPER
const deleteFromS3 = async (url) => {
  try {
    if (!url) return;

    const key = url.split(".amazonaws.com/")[1];
    if (!key) return;

    await s3
      .deleteObject({
        Bucket: process.env.S3_BUCKET,
        Key: key,
      })
      .promise();
  } catch (err) {
    console.error("S3 delete error:", err.message);
  }
};

// ✅ CREATE AGENCY (usually auto-created on first auth; kept for explicit setup)
router.post("/", async (req, res) => {
  try {
    const existing = await Agency.findOne({ clerkUserId: req.clerkUserId });
    if (existing) {
      return res.status(409).json({
        message: "Workspace already exists for this account",
        agency: existing,
      });
    }

    const agency = await Agency.create({
      name: req.body.name,
      tagline: req.body.tagline,
      address: req.body.address,
      email: req.body.email,
      phone: req.body.phone,
      website: req.body.website,
      logo: req.body.logo,
      gstin: req.body.gstin,
      upiId: req.body.upiId,
      placeOfSupply: req.body.placeOfSupply,
      clerkUserId: req.clerkUserId,
      planKey: "free",
      subscriptionStatus: "active",
      workspaceOnboardingCompleted: false,

      bankDetails: {
        accountName: req.body.bankDetails?.accountName,
        accountNumber: req.body.bankDetails?.accountNumber,
        ifsc: req.body.bankDetails?.ifsc,
        bank: req.body.bankDetails?.bank,
      },
    });

    res.json(agency);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Owner workspace onboarding status */
router.get("/onboarding/status", async (req, res) => {
  try {
    const agency = await Agency.findById(req.companyId).lean();
    if (!agency) {
      return res.status(404).json({ message: "Workspace not found" });
    }
    res.json({
      workspaceOnboardingCompleted: agency.workspaceOnboardingCompleted !== false,
      name: agency.name || "",
      tagline: agency.tagline || "",
      logo: agency.logo || "",
      planKey: agency.planKey || "free",
      email: agency.email || "",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Update workspace profile during owner onboarding (super admin only) */
router.patch("/onboarding", async (req, res) => {
  try {
    if (req.user?.role !== "super_admin") {
      return res.status(403).json({
        message: "Only the workspace owner can complete organization setup",
      });
    }

    const agency = await Agency.findById(req.companyId);
    if (!agency) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    const { name, tagline, logo, planKey } = req.body || {};

    if (name != null) {
      const n = String(name).trim();
      if (!n) {
        return res.status(400).json({ message: "Organization name is required" });
      }
      agency.name = n;
    }
    if (tagline != null) agency.tagline = String(tagline).trim();
    if (logo != null) agency.logo = String(logo).trim();
    if (planKey != null) {
      const pk = String(planKey).toLowerCase();
      if (!PLANS[pk]) {
        return res.status(400).json({ message: "Invalid plan" });
      }
      agency.planKey = pk;
    }

    await agency.save();

    await syncClerkWorkspaceUser({
      clerkUserId: req.clerkUserId,
      companyId: agency._id,
      role: req.user.role,
      workspaceName: agency.name,
      userName: req.user.name,
    });

    res.json({
      ok: true,
      name: agency.name,
      tagline: agency.tagline,
      logo: agency.logo,
      planKey: agency.planKey,
      workspaceOnboardingCompleted: agency.workspaceOnboardingCompleted !== false,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Finish owner onboarding — enables dashboard for the organization */
router.post("/onboarding/complete", async (req, res) => {
  try {
    if (req.user?.role !== "super_admin") {
      return res.status(403).json({
        message: "Only the workspace owner can complete organization setup",
      });
    }

    const agency = await Agency.findById(req.companyId);
    if (!agency) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    if (!agency.name?.trim()) {
      return res.status(400).json({
        message: "Set your organization name before finishing",
      });
    }

    agency.workspaceOnboardingCompleted = true;
    await agency.save();

    await User.updateOne(
      { _id: req.user._id, companyId: req.companyId },
      { $set: { onboardingCompleted: true } }
    );

    await syncClerkWorkspaceUser({
      clerkUserId: req.clerkUserId,
      companyId: agency._id,
      role: req.user.role,
      workspaceName: agency.name,
      userName: req.user.name,
    });

    res.json({
      ok: true,
      workspaceOnboardingCompleted: true,
      companyName: agency.name,
      planKey: agency.planKey || "free",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ DEFAULT COMPANY
router.get("/default", async (req, res) => {
  try {
    const agency = await Agency.findById(req.companyId);
    if (!agency) {
      return res.status(404).json({ message: "Company not found" });
    }
    res.json(agency);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ UPLOAD LOGO (super admin only — company branding)
router.post("/logo", upload.single("file"), async (req, res) => {
  try {
    if (req.user?.role !== "super_admin") {
      return res.status(403).json({
        message: "Only a super admin can upload the company logo",
      });
    }
    const file = req.file;

    const result = await uploadFile({
      file,
      folder: "logos",
      companyId: req.companyId,
    });

    res.json({ url: result.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ UPDATE AGENCY (super admin only)
router.put("/:id", async (req, res) => {
  try {
    const agencyId = req.params.id;

    if (agencyId !== req.companyId?.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (req.user?.role !== "super_admin") {
      return res.status(403).json({
        message: "Only a super admin can update the workspace company profile",
      });
    }

    const oldAgency = await Agency.findById(agencyId);

    if (!oldAgency) {
      return res.status(404).json({ message: "Agency not found" });
    }

    // 🔥 DELETE OLD LOGO
    if (oldAgency.logo && req.body.logo && oldAgency.logo !== req.body.logo) {
      await deleteFile(oldAgency.logo);
    }

    const safe = { ...req.body };
    delete safe.clerkUserId;
    delete safe.stripeCustomerId;
    delete safe.stripeSubscriptionId;

    const updated = await Agency.findByIdAndUpdate(
      agencyId,
      {
        ...safe,
        upiId: req.body.upiId,
        placeOfSupply: req.body.placeOfSupply,
      },
      { returnDocument: "after" }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET ALL — owned workspaces + any agency this Clerk user is a member of
router.get("/", async (req, res) => {
  try {
    const owned = await Agency.find({ clerkUserId: req.clerkUserId }).sort({
      createdAt: 1,
    });
    const memberCompanyIds = await User.find({ clerkId: req.clerkUserId }).distinct(
      "companyId"
    );
    const ownedSet = new Set(owned.map((a) => String(a._id)));
    const extraIds = memberCompanyIds.filter((id) => !ownedSet.has(String(id)));
    const extra =
      extraIds.length > 0
        ? await Agency.find({ _id: { $in: extraIds } }).sort({ createdAt: 1 })
        : [];
    const byId = new Map();
    for (const a of [...owned, ...extra]) {
      byId.set(String(a._id), a);
    }
    res.json([...byId.values()]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET ONE — must be the authenticated user's current workspace
router.get("/:id", async (req, res) => {
  try {
    if (String(req.params.id) !== String(req.companyId)) {
      return res.status(403).json({ message: "Not your current workspace" });
    }
    const agency = await Agency.findById(req.companyId);
    if (!agency) return res.status(404).json({ message: "Not found" });
    res.json(agency);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ DELETE — only the Clerk workspace owner
router.delete("/:id", async (req, res) => {
  try {
    if (String(req.params.id) !== String(req.companyId)) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    const agency = await Agency.findById(req.params.id);
    if (!agency) {
      return res.status(404).json({ message: "Not found" });
    }
    if (String(agency.clerkUserId || "") !== String(req.clerkUserId || "")) {
      return res.status(403).json({
        message: "Only the workspace owner can delete this company",
      });
    }
    await Agency.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;