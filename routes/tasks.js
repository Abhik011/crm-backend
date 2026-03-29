const express = require("express");
const router = express.Router();
const Task = require("../models/Task");

// GET TASKS BY PROJECT
router.get("/project/:projectId", async (req, res) => {
  const tasks = await Task.find({
    project: req.params.projectId
  });
  res.json(tasks);
});

// UPDATE STATUS
router.put("/:id", async (req, res) => {
  const task = await Task.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(task);
});

module.exports = router;