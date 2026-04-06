const express = require("express");
const router = express.Router();

const Project = require("../models/Project");
const Task = require("../models/Task");

router.get("/", async (req, res) => {
  try {
    const projects = await Project.find({ company: req.companyId })
      .populate("customer")
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/progress", async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      company: req.companyId,
    });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const tasks = await Task.find({
      project: req.params.id,
      company: req.companyId,
    });

    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "Done").length;

    const progress = total === 0 ? 0 : Math.round((done / total) * 100);

    res.json({ total, done, progress });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
