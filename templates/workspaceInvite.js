import { DISPLAY_PRODUCT, PRODUCT_TAGLINE } from "../config/brand.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Enterprise-style plain-text invite (NEXORA branding by default).
 */
export function buildWorkspaceInviteText({
  displayName,
  signInUrl,
  email,
  plaintextPassword,
  role,
  clerkUsername,
  workspaceName,
}) {
  const name = displayName || "there";
  const roleLabel = String(role).replace(/_/g, " ");
  const product = DISPLAY_PRODUCT;
  const ws = workspaceName || "your organization";
  const userLine = clerkUsername
    ? `Username (sign-in): ${clerkUsername}`
    : null;

  const header = [
    `${product}`,
    `${PRODUCT_TAGLINE}`,
    "",
    `────────────────────────────────────────`,
    "",
  ].join("\n");

  if (plaintextPassword) {
    return (
      header +
      [
        `Hello ${name},`,
        ``,
        `You have been invited to join ${ws} on ${product}.`,
        `Your workspace role: ${roleLabel}.`,
        ``,
        `SIGN IN`,
        `1) Open (copy into your browser): ${signInUrl}`,
        `2) Use email + password if Clerk shows both options (recommended for invites).`,
        `3) Email: ${email}`,
        ...(userLine ? [userLine] : []),
        `4) Temporary password — copy exactly, then change it after first sign-in:`,
        plaintextPassword,
        `5) After sign-in, complete the short onboarding checklist in ${product}.`,
        ``,
        `Security: Do not forward this email. If you did not expect this invitation, contact your workspace administrator.`,
        ``,
        `— ${product} · Automated message`,
      ].join("\n")
    );
  }

  return (
    header +
    [
      `Hello ${name},`,
      ``,
      `You have been invited to join ${ws} on ${product}.`,
      `Your workspace role: ${roleLabel}.`,
      ``,
      `You already have an account for ${email}.`,
      `Open ${signInUrl} and sign in with your existing password or SSO (Google / Microsoft, etc.).`,
      `After sign-in, complete the onboarding checklist in ${product}.`,
      ``,
      `If sign-in fails, ask your administrator to confirm password sign-in is enabled in your identity provider settings.`,
      ``,
      `— ${product} · Automated message`,
    ].join("\n")
  );
}

/**
 * Enterprise HTML invite — responsive table layout, NEXORA-style header.
 */
export function buildWorkspaceInviteHtml({
  displayName,
  signInUrl,
  email,
  plaintextPassword,
  role,
  clerkUsername,
  workspaceName,
}) {
  const safeName = escapeHtml(displayName || "there");
  const safeUrl = escapeHtml(signInUrl);
  const safeEmail = escapeHtml(email);
  const safeRole = escapeHtml(String(role).replace(/_/g, " "));
  const safeWs = escapeHtml(workspaceName || "your organization");
  const product = escapeHtml(DISPLAY_PRODUCT);
  const tagline = escapeHtml(PRODUCT_TAGLINE);
  const safeUser = clerkUsername ? escapeHtml(clerkUsername) : "";

  const stepsBlock = plaintextPassword
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:#f8fafc;padding:16px 20px;border-bottom:1px solid #e2e8f0;">
            <p style="margin:0;font-size:13px;font-weight:600;color:#0f172a;letter-spacing:0.02em;text-transform:uppercase;">Secure sign-in</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px;background:#ffffff;">
            <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6;">Use the temporary password below, then set your own password after first login.</p>
            <div style="font-family:ui-monospace,Consolas,monospace;font-size:15px;background:#0f172a;color:#f8fafc;padding:14px 16px;border-radius:8px;word-break:break-all;letter-spacing:0.02em;">${escapeHtml(
              plaintextPassword
            )}</div>
            <ol style="margin:20px 0 0;padding-left:20px;color:#334155;font-size:14px;line-height:1.75;">
              <li>Open the <a href="${safeUrl}" style="color:#2563eb;font-weight:600;">sign-in page</a>.</li>
              <li>Choose <strong>email and password</strong> when available.</li>
              <li>Email: <strong style="color:#0f172a;">${safeEmail}</strong></li>
              ${clerkUsername ? `<li>Username field (if shown): <strong>${safeUser}</strong></li>` : ""}
              <li>After sign-in, complete onboarding in <strong>${product}</strong>.</li>
            </ol>
          </td>
        </tr>
      </table>`
    : `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #e2e8f0;border-radius:12px;">
        <tr>
          <td style="padding:20px;background:#f8fafc;">
            <p style="margin:0;font-size:14px;color:#334155;line-height:1.65;">You already have an identity for <strong style="color:#0f172a;">${safeEmail}</strong>.</p>
            <p style="margin:12px 0 0;font-size:14px;color:#334155;line-height:1.65;">Open the <a href="${safeUrl}" style="color:#2563eb;font-weight:600;">sign-in page</a> and use your existing password or corporate SSO.</p>
            <p style="margin:12px 0 0;font-size:13px;color:#64748b;">Then complete the onboarding checklist in <strong>${product}</strong>.</p>
            ${
              clerkUsername
                ? `<p style="margin:12px 0 0;font-size:13px;color:#64748b;">If you are prompted for a <strong>username</strong>, use: <span style="font-family:ui-monospace,monospace;color:#0f172a;font-weight:600;">${safeUser}</span></p>`
                : ""
            }
          </td>
        </tr>
      </table>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${product}</title></head>
<body style="margin:0;padding:0;background:#eef2f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(15,23,42,0.08);border:1px solid #e2e8f0;">
<tr>
<td style="background:linear-gradient(135deg,#0b1220 0%,#1e293b 55%,#0f172a 100%);padding:32px 36px;text-align:left;">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;letter-spacing:0.22em;color:#f8fafc;">${product}</div>
<div style="margin-top:10px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:12px;color:#94a3b8;line-height:1.5;max-width:420px;">${tagline}</div>
</td>
</tr>
<tr>
<td style="padding:32px 36px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;">
<p style="margin:0;font-size:16px;line-height:1.6;color:#334155;">Hello <strong style="color:#0f172a;">${safeName}</strong>,</p>
<p style="margin:16px 0 0;font-size:15px;line-height:1.65;color:#475569;">You have been invited to join <strong style="color:#0f172a;">${safeWs}</strong> on <strong style="color:#0f172a;">${product}</strong>.</p>
<p style="margin:8px 0 0;font-size:14px;color:#64748b;">Role: <strong style="color:#334155;">${safeRole}</strong></p>
${stepsBlock}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px;">
<tr><td style="border-radius:10px;background:#2563eb;">
<a href="${safeUrl}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">Open workspace sign-in</a>
</td></tr>
</table>
<table role="presentation" width="100%" style="margin-top:28px;border-top:1px solid #e2e8f0;padding-top:20px;">
<tr><td style="font-size:12px;color:#94a3b8;line-height:1.55;">This message was sent by your organization&apos;s ${product} administrator. Do not share credentials. If this was a mistake, contact your admin or ignore this email.</td></tr>
</table>
</td>
</tr>
</table>
<p style="font-family:system-ui,sans-serif;font-size:11px;color:#94a3b8;margin:20px 0 0;text-align:center;">© ${product} · Enterprise communications</p>
</td></tr>
</table>
</body></html>`;
}
