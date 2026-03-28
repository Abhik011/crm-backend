const express = require("express");
const router = express.Router();
const sendEmail = require("../services/emailService");

router.post("/send", async (req, res) => {
  const { email, subject, message } = req.body;

  await sendEmail(email, subject, `<p>${message}</p>`);

  res.json({ message: "Email sent successfully" });
});

module.exports = router;