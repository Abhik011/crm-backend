import { resolveWorkspaceFromToken } from "../services/authContext.js";

/**
 * Socket.IO handshake: expects `auth: { token: "<Clerk session JWT>" }`
 */
export default async function socketAuthMiddleware(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return next(new Error("Unauthorized"));
    }

    const ctx = await resolveWorkspaceFromToken(token);

    socket.user = {
      clerkId: ctx.clerkUserId,
      companyId: String(ctx.companyId),
      dbUserId: ctx.user._id.toString(),
      role: ctx.user.role,
      name: ctx.user.name || "",
      email: ctx.user.email || "",
    };

    next();
  } catch (e) {
    next(new Error("Unauthorized"));
  }
}
