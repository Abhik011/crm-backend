const express = require("express");
const router = express.Router();
const Task = require("../models/Task");
const Project = require("../models/Project");

router.get("/project/:projectId", async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.projectId,
      company: req.companyId,
    });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const tasks = await Task.find({
      project: req.params.projectId,
      company: req.companyId,
    });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const body = { ...req.body };
    delete body.company;

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, company: req.companyId },
      body,
      { new: true }
    );
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
