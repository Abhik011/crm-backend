import express from "express";
import sendEmail from "../services/emailService.js";

const router = express.Router();

router.post("/send", async (req, res) => {
  const { email, subject, message } = req.body;

  const result = await sendEmail(email, subject, `<p>${message}</p>`);
  if (!result.ok) {
    return res.status(503).json({ message: result.reason });
  }

  res.json({ message: "Email sent successfully" });
});

export default router;