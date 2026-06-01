/**
 * Product branding for transactional email and API copy.
 * Override with env for white-label deployments.
 */
export const DISPLAY_PRODUCT =
  process.env.PRODUCT_DISPLAY_NAME?.trim() || "NEXORA";

export const PRODUCT_TAGLINE =
  process.env.PRODUCT_TAGLINE?.trim() ||
  "Enterprise workspace — secure collaboration, CRM, and operations in one place";

/** Default "From" display name when EMAIL_FROM is not set */
export function emailSenderDisplayName() {
  return process.env.EMAIL_SENDER_NAME?.trim() || DISPLAY_PRODUCT;
}

export function inviteEmailSubject() {
  return `${DISPLAY_PRODUCT} — workspace invitation`;
}
