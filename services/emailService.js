import nodemailer from "nodemailer";
import { emailSenderDisplayName } from "../config/brand.js";

/**
 * Builds a Nodemailer transport from environment variables.
 *
 * Gmail 535-5.7.8: Google rejects the password. You must use a 16-character App Password
 * (https://myaccount.google.com/apppasswords) from the SAME Google account as EMAIL_USER,
 * with 2-Step Verification enabled — not your normal Gmail password.
 *
 * Priority: SMTP_URL → EMAIL_HOST → Gmail (EMAIL_USER + password).
 */
function normalizePassword(pass) {
  if (pass == null) return "";
  return String(pass).replace(/\s/g, "");
}

/** Use when .env would mangle special characters: `node -e "console.log(Buffer.from('pass','utf8').toString('base64'))"` */
function resolvePassword() {
  const b64 = process.env.EMAIL_PASS_BASE64?.trim();
  if (b64) {
    try {
      return Buffer.from(b64, "base64").toString("utf8").trim();
    } catch {
      return "";
    }
  }
  return normalizePassword(process.env.EMAIL_PASS);
}

let gmailPasswordLengthWarned = false;

function warnGmailPasswordShape(user, pass) {
  if (gmailPasswordLengthWarned) return;
  if (!user?.toLowerCase().includes("@gmail.") && !user?.toLowerCase().includes("@googlemail.")) {
    return;
  }
  const len = pass.length;
  if (len > 0 && len !== 16) {
    gmailPasswordLengthWarned = true;
    console.warn(
      `[email] Gmail App Passwords are exactly 16 characters (after removing spaces). ` +
        `Current EMAIL_PASS length is ${len}. If you see 535 errors, create a new App Password at ` +
        `https://myaccount.google.com/apppasswords — or set EMAIL_PASS_BASE64 to avoid .env quoting issues.`
    );
  }
}

function getTransport() {
  const user = process.env.EMAIL_USER?.trim();
  const pass = resolvePassword();

  if (process.env.SMTP_URL?.trim()) {
    return nodemailer.createTransport(process.env.SMTP_URL.trim());
  }

  const host = process.env.EMAIL_HOST?.trim();
  if (host && user && pass) {
    const port = Number(process.env.EMAIL_PORT || 587);
    const secure =
      process.env.EMAIL_SECURE === "true" || process.env.EMAIL_SECURE === "1" || port === 465;
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== "false" },
    });
  }

  if (user && pass) {
    warnGmailPasswordShape(user, pass);
    const use465 = process.env.EMAIL_GMAIL_USE_SSL === "true" || process.env.EMAIL_GMAIL_USE_SSL === "1";
    return nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: use465 ? 465 : 587,
      secure: use465,
      requireTLS: !use465,
      auth: { user, pass },
      ...(process.env.EMAIL_DEBUG === "1" ? { logger: true, debug: true } : {}),
    });
  }

  return null;
}

function getFromAddress() {
  const from = process.env.EMAIL_FROM?.trim();
  const user = process.env.EMAIL_USER?.trim();
  if (from) return from;
  if (user) return `"${emailSenderDisplayName()}" <${user}>`;
  return null;
}

function friendlySmtpReason(err) {
  const raw = err?.message || err?.response || String(err || "");
  const s = String(raw);

  if (s.includes("535") && s.includes("5.7.8")) {
    return [
      "Gmail rejected the login (535-5.7.8).",
      "Create a 16-character App Password: Google Account → Security → 2-Step Verification → App passwords (use type 'Mail' / 'Other').",
      "EMAIL_USER must be the exact Gmail address for that account (e.g. devwithabhijeet@gmail.com). EMAIL_PASS must be that App Password only — not your normal Gmail password.",
      "If .env mangles the password, use EMAIL_PASS_BASE64 (see backend/.env.example).",
      "First-time SMTP blocks: https://accounts.google.com/DisplayUnlockCaptcha (same account, then retry).",
      "Details: " + s.split("\n")[0],
    ].join(" ");
  }

  if (s.includes("Invalid login") || s.includes("EAUTH") || s.includes("535")) {
    return `SMTP authentication failed. Check EMAIL_USER / EMAIL_PASS (or SMTP_URL). ${s.split("\n")[0]}`;
  }

  return s || "Failed to send email";
}

/**
 * @param {string} [text] — plain-text body (recommended for passwords so users can copy easily)
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 */
export async function sendEmail(to, subject, html, text) {
  const transport = getTransport();
  if (!transport) {
    return {
      ok: false,
      reason:
        "Email is not configured. Set EMAIL_USER + EMAIL_PASS (or EMAIL_PASS_BASE64), or EMAIL_HOST + EMAIL_USER + EMAIL_PASS, or SMTP_URL in backend/.env — see .env.example.",
    };
  }

  const from = getFromAddress();
  if (!from) {
    return { ok: false, reason: "EMAIL_USER or EMAIL_FROM must be set for the From address." };
  }

  try {
    await transport.sendMail({
      from,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
    });
    return { ok: true };
  } catch (err) {
    console.error("sendEmail failed:", err);
    return {
      ok: false,
      reason: friendlySmtpReason(err),
    };
  }
}

export default sendEmail;
