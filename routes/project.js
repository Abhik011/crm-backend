import express from "express";
import Project from "../models/Project.js";
import ProjectMilestone from "../models/ProjectMilestone.js";
import Task from "../models/Task.js";
import User from "../models/User.js";
import { isDoneStatus } from "../utils/issueStatus.js";
import { issuePrefixFromName, normalizeIssuePrefix } from "../utils/projectKeys.js";

const router = express.Router();

const ENGAGEMENT_TYPES = new Set([
  "fixed_price",
  "time_materials",
  "retainer",
  "hybrid",
]);
const DELIVERY_MODELS = new Set([
  "dedicated_team",
  "sprint_based",
  "staff_augmentation",
  "fixed_scope",
]);
const PROJECT_STAGES = new Set([
  "discovery",
  "proposal",
  "signed",
  "kickoff",
  "build",
  "uat",
  "launch",
  "warranty",
  "closed",
]);
const HEALTH = new Set(["on_track", "at_risk", "blocked", "completed"]);
const PRIORITY = new Set(["p0", "p1", "p2", "p3"]);
const MILESTONE_STATUS = new Set(["pending", "in_progress", "done", "skipped"]);

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function validateAccountManager(companyId, userId) {
  if (!userId) return null;
  const u = await User.findOne({ _id: userId, companyId }).select("_id").lean();
  return u?._id || null;
}

router.get("/", async (req, res) => {
  try {
    const projects = await Project.find({ agency: req.companyId })
      .populate("customer")
      .populate("accountManager", "name email")
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const n = String(body.name || "").trim();
    if (!n) {
      return res.status(400).json({ message: "Project name required" });
    }

    const prefix = normalizeIssuePrefix(body.issueKeyPrefix, n);
    const am = await validateAccountManager(req.companyId, body.accountManager);

    const engagementType = ENGAGEMENT_TYPES.has(String(body.engagementType))
      ? body.engagementType
      : "fixed_price";
    const deliveryModel = DELIVERY_MODELS.has(String(body.deliveryModel))
      ? body.deliveryModel
      : "fixed_scope";
    const projectStage = PROJECT_STAGES.has(String(body.projectStage))
      ? body.projectStage
      : "discovery";
    const health = HEALTH.has(String(body.health)) ? body.health : "on_track";
    const priority = PRIORITY.has(String(body.priority)) ? body.priority : "p2";

    const project = await Project.create({
      agency: req.companyId,
      name: n,
      description: String(body.description || ""),
      projectCode: String(body.projectCode || "").trim().slice(0, 40),
      customer: body.customer || undefined,
      deal: body.deal || undefined,
      issueKeyPrefix: prefix,
      issueSeq: 0,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      deadline: body.deadline ? new Date(body.deadline) : undefined,
      engagementType,
      deliveryModel,
      projectStage,
      health,
      priority,
      contractValue: num(body.contractValue, 0),
      currency: String(body.currency || "INR")
        .toUpperCase()
        .slice(0, 8),
      contractReference: String(body.contractReference || "").slice(0, 120),
      clientPoNumber: String(body.clientPoNumber || "").slice(0, 80),
      invoicedToDate: num(body.invoicedToDate, 0),
      estimatedInternalCost: num(body.estimatedInternalCost, 0),
      blendedHourlyRate: num(body.blendedHourlyRate, 0),
      accountManager: am || undefined,
      techStack: Array.isArray(body.techStack)
        ? body.techStack.map((x) => String(x).trim()).filter(Boolean).slice(0, 30)
        : [],
      successCriteria: String(body.successCriteria || ""),
      risksAndDependencies: String(body.risksAndDependencies || ""),
    });
    const populated = await Project.findById(project._id)
      .populate("customer")
      .populate("accountManager", "name email");
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/progress", async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      agency: req.companyId,
    });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const tasks = await Task.find({
      project: req.params.id,
      agency: req.companyId,
    });

    const total = tasks.length;
    const done = tasks.filter((t) => isDoneStatus(t.status)).length;

    const progress = total === 0 ? 0 : Math.round((done / total) * 100);

    res.json({ total, done, progress });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/summary", async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      agency: req.companyId,
    });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const [tasks, milestones] = await Promise.all([
      Task.find({ project: req.params.id, agency: req.companyId }),
      ProjectMilestone.find({ project: req.params.id, agency: req.companyId }).sort({
        sortOrder: 1,
        targetDate: 1,
      }),
    ]);

    const total = tasks.length;
    const done = tasks.filter((t) => isDoneStatus(t.status)).length;
    const progressPercent = total === 0 ? 0 : Math.round((done / total) * 100);

    const totalMinutes = tasks.reduce((a, t) => a + num(t.timeSpent, 0), 0);
    const rate = num(project.blendedHourlyRate, 0);
    const estimatedSellFromLoggedTime = (totalMinutes / 60) * rate;

    const contract = num(project.contractValue, 0);
    const invoiced = num(project.invoicedToDate, 0);
    const internal = num(project.estimatedInternalCost, 0);
    const unbilled = Math.max(0, contract - invoiced);
    const marginVsContract = contract - internal;
    const milestoneDone = milestones.filter((m) => m.status === "done").length;

    res.json({
      taskCount: total,
      tasksDone: done,
      progressPercent,
      totalTimeMinutes: totalMinutes,
      estimatedSellFromLoggedTime,
      milestoneCount: milestones.length,
      milestonesDone: milestoneDone,
      contractValue: contract,
      invoicedToDate: invoiced,
      estimatedInternalCost: internal,
      unbilledContractValue: unbilled,
      marginVsContract,
      currency: project.currency || "INR",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/milestones", async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      agency: req.companyId,
    });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    const list = await ProjectMilestone.find({
      project: req.params.id,
      agency: req.companyId,
    }).sort({ sortOrder: 1, targetDate: 1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/milestones", async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      agency: req.companyId,
    });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    const title = String(req.body.title || "").trim();
    if (!title) {
      return res.status(400).json({ message: "Milestone title required" });
    }
    const status = MILESTONE_STATUS.has(String(req.body.status))
      ? req.body.status
      : "pending";
    const maxSort = await ProjectMilestone.findOne({
      project: project._id,
      agency: req.companyId,
    })
      .sort({ sortOrder: -1 })
      .select("sortOrder")
      .lean();
    const sortOrder =
      req.body.sortOrder != null
        ? num(req.body.sortOrder, 0)
        : num(maxSort?.sortOrder, -1) + 1;

    const m = await ProjectMilestone.create({
      agency: req.companyId,
      project: project._id,
      title,
      description: String(req.body.description || ""),
      targetDate: req.body.targetDate ? new Date(req.body.targetDate) : undefined,
      status,
      billingAmount: num(req.body.billingAmount, 0),
      billingPercent: Math.min(100, Math.max(0, num(req.body.billingPercent, 0))),
      sortOrder,
    });
    res.status(201).json(m);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/milestones/:milestoneId", async (req, res) => {
  try {
    const m = await ProjectMilestone.findOne({
      _id: req.params.milestoneId,
      project: req.params.id,
      agency: req.companyId,
    });
    if (!m) {
      return res.status(404).json({ message: "Milestone not found" });
    }
    const b = req.body || {};
    if (b.title !== undefined) m.title = String(b.title || "").trim();
    if (b.description !== undefined) m.description = String(b.description ?? "");
    if (b.targetDate !== undefined) {
      m.targetDate = b.targetDate ? new Date(b.targetDate) : null;
    }
    if (b.status !== undefined && MILESTONE_STATUS.has(String(b.status))) {
      m.status = b.status;
    }
    if (b.billingAmount !== undefined) m.billingAmount = num(b.billingAmount, 0);
    if (b.billingPercent !== undefined) {
      m.billingPercent = Math.min(100, Math.max(0, num(b.billingPercent, 0)));
    }
    if (b.sortOrder !== undefined) m.sortOrder = num(b.sortOrder, 0);
    await m.save();
    res.json(m);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id/milestones/:milestoneId", async (req, res) => {
  try {
    const r = await ProjectMilestone.deleteOne({
      _id: req.params.milestoneId,
      project: req.params.id,
      agency: req.companyId,
    });
    if (r.deletedCount === 0) {
      return res.status(404).json({ message: "Milestone not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      agency: req.companyId,
    })
      .populate("customer")
      .populate("accountManager", "name email");

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (!project.issueKeyPrefix) {
      project.issueKeyPrefix = issuePrefixFromName(project.name);
    }
    if (project.issueSeq == null || Number.isNaN(project.issueSeq)) {
      project.issueSeq = 0;
    }
    await project.save();

    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const existing = await Project.findOne({
      _id: req.params.id,
      agency: req.companyId,
    });
    if (!existing) {
      return res.status(404).json({ message: "Project not found" });
    }

    const allowed = [
      "name",
      "description",
      "status",
      "startDate",
      "deadline",
      "customer",
      "deal",
      "issueKeyPrefix",
      "projectCode",
      "projectStage",
      "health",
      "priority",
      "engagementType",
      "deliveryModel",
      "contractValue",
      "currency",
      "contractReference",
      "clientPoNumber",
      "invoicedToDate",
      "estimatedInternalCost",
      "blendedHourlyRate",
      "accountManager",
      "techStack",
      "successCriteria",
      "risksAndDependencies",
    ];
    const updates = {};
    const fallbackName =
      req.body.name !== undefined
        ? String(req.body.name || "").trim()
        : existing.name;

    for (const k of allowed) {
      if (req.body[k] === undefined) continue;
      if (k === "issueKeyPrefix") {
        updates[k] = normalizeIssuePrefix(req.body[k], fallbackName);
      } else if (k === "startDate" || k === "deadline") {
        updates[k] = req.body[k] ? new Date(req.body[k]) : null;
      } else if (k === "name") {
        updates[k] = String(req.body[k] || "").trim();
      } else if (k === "projectCode") {
        updates[k] = String(req.body[k] || "").trim().slice(0, 40);
      } else if (k === "description") {
        updates[k] = String(req.body[k] ?? "");
      } else if (k === "contractReference") {
        updates[k] = String(req.body[k] || "").slice(0, 120);
      } else if (k === "clientPoNumber") {
        updates[k] = String(req.body[k] || "").slice(0, 80);
      } else if (k === "successCriteria" || k === "risksAndDependencies") {
        updates[k] = String(req.body[k] ?? "");
      } else if (k === "currency") {
        updates[k] = String(req.body[k] || "INR")
          .toUpperCase()
          .slice(0, 8);
      } else if (
        k === "contractValue" ||
        k === "invoicedToDate" ||
        k === "estimatedInternalCost" ||
        k === "blendedHourlyRate"
      ) {
        updates[k] = num(req.body[k], 0);
      } else if (k === "accountManager") {
        updates[k] = await validateAccountManager(req.companyId, req.body[k]);
      } else if (k === "techStack") {
        updates[k] = Array.isArray(req.body[k])
          ? req.body[k].map((x) => String(x).trim()).filter(Boolean).slice(0, 30)
          : [];
      } else if (k === "engagementType" && ENGAGEMENT_TYPES.has(String(req.body[k]))) {
        updates[k] = req.body[k];
      } else if (k === "deliveryModel" && DELIVERY_MODELS.has(String(req.body[k]))) {
        updates[k] = req.body[k];
      } else if (k === "projectStage" && PROJECT_STAGES.has(String(req.body[k]))) {
        updates[k] = req.body[k];
      } else if (k === "health" && HEALTH.has(String(req.body[k]))) {
        updates[k] = req.body[k];
      } else if (k === "priority" && PRIORITY.has(String(req.body[k]))) {
        updates[k] = req.body[k];
      } else if (["customer", "deal", "status"].includes(k)) {
        updates[k] = req.body[k];
      }
    }

    Object.assign(existing, updates);
    await existing.save();

    const project = await Project.findById(existing._id)
      .populate("customer")
      .populate("accountManager", "name email");
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      agency: req.companyId,
    });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    await Task.deleteMany({ project: project._id, agency: req.companyId });
    await ProjectMilestone.deleteMany({ project: project._id, agency: req.companyId });
    await Project.deleteOne({ _id: project._id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
