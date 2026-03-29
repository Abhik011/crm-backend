const express = require("express");
const router = express.Router();

const Project = require("../models/Project");
const Task = require("../models/Task");


// ✅ GET ALL PROJECTS
router.get("/", async (req, res) => {
  try {
    const projects = await Project.find()
      .populate("customer")
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ✅ GET PROJECT PROGRESS
router.get("/:id/progress", async (req, res) => {
  try {
    const tasks = await Task.find({ project: req.params.id });

    const total = tasks.length;
    const done = tasks.filter(t => t.status === "Done").length;

    const progress =
      total === 0 ? 0 : Math.round((done / total) * 100);

    res.json({ total, done, progress });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;