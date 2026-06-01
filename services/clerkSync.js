import { createClerkClient } from "@clerk/backend";

const clerk =
  process.env.CLERK_SECRET_KEY &&
  createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

/**
 * Keep Clerk publicMetadata aligned with Nexora workspace (Mongo Agency + User).
 */
export async function syncClerkWorkspaceUser({
  clerkUserId,
  companyId,
  role,
  workspaceName,
  userName,
}) {
  if (!clerk || !clerkUserId) return;

  try {
    const publicMetadata = {
      companyId: companyId != null ? String(companyId) : undefined,
      role: role || undefined,
      workspaceName: workspaceName || undefined,
      product: "nexora",
    };

    const patch = { publicMetadata };
    if (userName?.trim()) {
      const parts = userName.trim().split(/\s+/);
      patch.firstName = parts[0] || "User";
      patch.lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
    }

    await clerk.users.updateUser(clerkUserId, patch);
  } catch (err) {
    console.error("syncClerkWorkspaceUser:", err?.message || err);
  }
}

export async function readClerkMetadataCompanyId(clerkUserId) {
  if (!clerk || !clerkUserId) return null;
  try {
    const cu = await clerk.users.getUser(clerkUserId);
    const cid = cu?.publicMetadata?.companyId;
    return cid != null ? String(cid) : null;
  } catch {
    return null;
  }
}
