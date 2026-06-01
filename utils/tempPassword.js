import crypto from "node:crypto";

/** Clerk-friendly temporary password (length + mixed character classes). */
export function generateTemporaryPassword() {
  const raw = crypto.randomBytes(18).toString("base64url");
  return `Crx1!${raw}`;
}
