import express from "express";
import Task from "../models/Task.js";
import Project from "../models/Project.js";
import User from "../models/User.js";
import {
  coerceStatusForWrite,
  normalizeStatus,
} from "../utils/issueStatus.js";
import { issuePrefixFromName } from "../utils/projectKeys.js";

const router = express.Router();

const populatePaths = [
  { path: "assignee", select: "name email role" },
  { path: "reporter", select: "name email role" },
];

const ALLOWED_PRIORITIES = new Set(["lowest", "low", "medium", "high", "highest"]);
const ALLOWED_TYPES = new Set(["epic", "story", "task", "bug", "subtask"]);

function serializeTask(t) {
  const o = t?.toObject ? t.toObject() : { ...t };
  return {
    ...o,
    status: normalizeStatus(o.status),
  };
}

async function assigneeIdForAgency(companyId, assigneeId) {
  if (!assigneeId) return null;
  const u = await User.findOne({ _id: assigneeId, companyId }).select("_id").lean();
  return u?._id || null;
}

async function ensureProjectIssuePrefix(project) {
  let dirty = false;
  if (!project.issueKeyPrefix) {
    project.issueKeyPrefix = issuePrefixFromName(project.name);
    dirty = true;
  }
  if (project.issueSeq == null || Number.isNaN(project.issueSeq)) {
    project.issueSeq = 0;
    dirty = true;
  }
  if (dirty) await project.save();
}

async function backfillMissingIssueKeys(project, agencyId) {
  await ensureProjectIssuePrefix(project);
  const prefix = String(project.issueKeyPrefix).toUpperCase();

  const missing = await Task.find({
    project: project._id,
    agency: agencyId,
    $or: [{ issueKey: { $exists: false } }, { issueKey: null }, { issueKey: "" }],
  }).sort({ createdAt: 1 });

  for (const t of missing) {
    const prog = await Project.findOneAndUpdate(
      { _id: project._id, agency: agencyId },
      { $inc: { issueSeq: 1 } },
      { new: true }
    );
    const n = prog.issueSeq;
    const key = `${String(prog.issueKeyPrefix || prefix).toUpperCase()}-${n}`;
    await Task.updateOne({ _id: t._id }, { $set: { issueKey: key, issueNumber: n } });
  }
}

router.get("/project/:projectId", async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.projectId,
      agency: req.companyId,
    });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    await backfillMissingIssueKeys(project, req.companyId);

    const tasks = await Task.find({
      project: req.params.projectId,
      agency: req.companyId,
    })
      .populate(populatePaths)
      .sort({ issueNumber: 1, createdAt: -1 })
      .exec();

    res.json(tasks.map(serializeTask));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/project/:projectId", async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.projectId,
      agency: req.companyId,
    });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    await ensureProjectIssuePrefix(project);

    const title = String(req.body.title || "").trim();
    if (!title) {
      return res.status(400).json({ message: "Title required" });
    }

    const description = String(req.body.description || "");
    const acceptanceCriteria = String(req.body.acceptanceCriteria || "");
    let issueType = String(req.body.issueType || "task").toLowerCase();
    if (!ALLOWED_TYPES.has(issueType)) issueType = "task";

    let priority = String(req.body.priority || "medium").toLowerCase();
    if (!ALLOWED_PRIORITIES.has(priority)) priority = "medium";

    const status = coerceStatusForWrite(req.body.status || "backlog");

    const labels = Array.isArray(req.body.labels)
      ? req.body.labels.map((x) => String(x).trim()).filter(Boolean).slice(0, 20)
      : [];

    const assigneeId = await assigneeIdForAgency(req.companyId, req.body.assignee);

    const prog = await Project.findOneAndUpdate(
      { _id: project._id, agency: req.companyId },
      { $inc: { issueSeq: 1 } },
      { new: true }
    );
    const n = prog.issueSeq;
    const prefix = String(prog.issueKeyPrefix).toUpperCase();
    const issueKey = `${prefix}-${n}`;

    const task = await Task.create({
      agency: req.companyId,
      project: project._id,
      issueKey,
      issueNumber: n,
      title,
      description,
      acceptanceCriteria,
      issueType,
      status,
      priority,
      assignee: assigneeId || undefined,
      reporter: req.user._id,
      labels,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
    });

    const populated = await Task.findById(task._id).populate(populatePaths);
    res.status(201).json(serializeTask(populated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      agency: req.companyId,
    }).populate(populatePaths);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    res.json(serializeTask(task));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function pickAllowedUpdates(body) {
  const out = {};
  if (body.title !== undefined) {
    out.title = String(body.title || "").trim();
  }
  if (body.description !== undefined) {
    out.description = String(body.description ?? "");
  }
  if (body.acceptanceCriteria !== undefined) {
    out.acceptanceCriteria = String(body.acceptanceCriteria ?? "");
  }
  if (body.status !== undefined) {
    out.status = coerceStatusForWrite(body.status);
  }
  if (body.priority !== undefined) {
    let p = String(body.priority || "medium").toLowerCase();
    out.priority = ALLOWED_PRIORITIES.has(p) ? p : "medium";
  }
  if (body.issueType !== undefined) {
    let t = String(body.issueType || "task").toLowerCase();
    out.issueType = ALLOWED_TYPES.has(t) ? t : "task";
  }
  if (body.labels !== undefined) {
    out.labels = Array.isArray(body.labels)
      ? body.labels.map((x) => String(x).trim()).filter(Boolean).slice(0, 20)
      : [];
  }
  if (body.dueDate !== undefined) {
    out.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  }
  if (body.timeSpent !== undefined && body.timeSpent !== null) {
    const n = Number(body.timeSpent);
    if (!Number.isNaN(n) && n >= 0) out.timeSpent = n;
  }
  if (body.assignee !== undefined) {
    out._assigneeRaw = body.assignee;
  }
  return out;
}

router.put("/:id", async (req, res) => {
  try {
    const existing = await Task.findOne({
      _id: req.params.id,
      agency: req.companyId,
    });
    if (!existing) {
      return res.status(404).json({ message: "Task not found" });
    }

    const updates = pickAllowedUpdates(req.body);
    const assigneeRaw = updates._assigneeRaw;
    delete updates._assigneeRaw;

    if (assigneeRaw !== undefined) {
      if (assigneeRaw === null || assigneeRaw === "") {
        updates.assignee = null;
      } else {
        const aid = await assigneeIdForAgency(req.companyId, assigneeRaw);
        updates.assignee = aid;
      }
    }

    if (updates.title !== undefined && updates.title === "") {
      return res.status(400).json({ message: "Title cannot be empty" });
    }

    Object.assign(existing, updates);
    await existing.save();

    const populated = await Task.findById(existing._id).populate(populatePaths);
    res.json(serializeTask(populated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      agency: req.companyId,
    });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
