// Must be first: ESM hoists imports, so `dotenv.config()` after imports runs too late
// for modules that read `process.env` at load time (e.g. routes/users.js).
import "./loadEnv.js";

import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import http from "http";
import mongoose from "mongoose";
import { Server } from "socket.io";
import connectDB from "./config/db.js";
import backfillCompany from "./utils/backfillCompany.js";
import requireAuth from "./middleware/requireAuth.js";
import resolveWebsiteTenant from "./middleware/websiteTenant.js";
import subscriptionWriteGate from "./middleware/subscriptionGate.js";

import leads from "./routes/leads.js";
import customers from "./routes/customers.js";
import deals from "./routes/deals.js";
import invoices from "./routes/invoices.js";
import dashboard from "./routes/dashboard.js";
import websiteRoutes from "./routes/website.js";
import agencyRoutes from "./routes/agency.js";
import reportsRoutes from "./routes/reports.js";
import projectRoutes from "./routes/project.js";
import taskRoutes from "./routes/tasks.js";
import quotesRoutes from "./routes/quotes.js";
import billingRouter, { stripeWebhookHandler } from "./routes/billing.js";
import chatRoutes from "./routes/chat.js";
import messageRoutes from "./routes/messages.js";
import ChatRoom from "./models/ChatRoom.js";
import Message from "./models/Message.js";
import User from "./models/User.js";
import userRoutes from "./routes/users.js";
import leadImportRoutes from "./routes/leadImport.js";
import socketAuthMiddleware from "./middleware/socketAuth.js";
import { serializeChatMessage } from "./utils/chatPayload.js";
import uploadRoutes from "./routes/upload.js";
import reminderRoutes from "./routes/reminders.js";
import startReminderJob from "./jobs/reminderJob.js";


const app = express();

// 🔥 Stripe webhook (raw body)
app.post(
  "/api/billing/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

// Middleware
app.use(cors());
app.use(express.json({
  limit: "50mb",
  type: (req) => {
    const contentType = req.headers["content-type"] || "";

    // ❌ skip multipart
    if (contentType.includes("multipart/form-data")) {
      return false;
    }

    return contentType.includes("application/json");
  },
}));

app.use(express.urlencoded({
  extended: true,
  limit: "50mb",
}));

// Rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 500),
  standardHeaders: true,
  legacyHeaders: false,
});



app.use("/api/", apiLimiter);

// Billing routes
app.use("/api/billing", billingRouter);

// 🔥 Clerk auth + subscription write gate (mutating requests blocked when churned)
const gated = [requireAuth, subscriptionWriteGate];


app.use("/api/chat", ...gated, chatRoutes);
app.use("/api/messages", ...gated, messageRoutes);
// Routes (authenticated CRM API)
app.use("/api/dashboard", ...gated, dashboard);
app.use("/api/invoices", ...gated, invoices);
app.use("/api/leads", ...gated, leads);
app.use("/api/customers", ...gated, customers);
app.use("/api/deals", ...gated, deals);
app.use("/api/reports", ...gated, reportsRoutes);
app.use("/api/projects", ...gated, projectRoutes);
app.use("/api/tasks", ...gated, taskRoutes);
app.use("/api/quotes", ...gated, quotesRoutes);
app.use("/api/users", requireAuth, userRoutes);
app.use("/api/upload", requireAuth, uploadRoutes);
// Public-site embeds (lead capture): tenant via X-Company-Id only
app.use("/api/website", resolveWebsiteTenant, subscriptionWriteGate, websiteRoutes);
app.use("/api/import-leads", ...gated, leadImportRoutes);
app.use("/api/agencies", requireAuth, agencyRoutes);
app.use("/api/reminders", ...gated, reminderRoutes);

// Health route
app.get("/", (req, res) => {
  res.send("Creonox ERP API running");
});

const PORT = Number(process.env.PORT || 5500);

// Start server
async function start() {
  await connectDB();
  await backfillCompany();
  console.log("Database connected and backfilled");

  const server = http.createServer(app);

  const io = new Server(
    server,
    {
      cors: {
        origin: "*",
      },
    });

  app.set(
    "io",
    io
  );

  // start reminder worker
  startReminderJob(io);

  io.use(socketAuthMiddleware);

  io.on("connection", async (socket) => {
    console.log("Socket connected:", socket.user.dbUserId);

    const companyRoom = `company:${socket.user.companyId}`;
    socket.join(companyRoom);

    try {
      const dbUser = await User.findById(socket.user.dbUserId)
        .select("presenceStatus")
        .lean();
      const presenceStatus = dbUser?.presenceStatus || "free";
      socket.to(companyRoom).emit("presence_update", {
        userId: socket.user.dbUserId,
        presenceStatus,
      });
    } catch {
      /* ignore */
    }

    socket.on("set_presence", async ({ status }) => {
      try {
        const next = String(status || "").toLowerCase();
        if (!["free", "busy", "working"].includes(next)) {
          return socket.emit("error", { message: "Invalid status" });
        }
        await User.updateOne(
          { _id: socket.user.dbUserId },
          { $set: { presenceStatus: next } }
        );
        io.to(companyRoom).emit("presence_update", {
          userId: socket.user.dbUserId,
          presenceStatus: next,
        });
      } catch (e) {
        socket.emit("error", { message: e.message });
      }
    });

    socket.on("join_room", async ({ roomId }) => {
      try {
        if (!roomId) {
          return socket.emit("error", { message: "roomId required" });
        }
        const rid = String(roomId);
        if (!mongoose.Types.ObjectId.isValid(rid)) {
          return socket.emit("error", { message: "Invalid room" });
        }
        const uid = new mongoose.Types.ObjectId(socket.user.dbUserId);
        const companyOid = new mongoose.Types.ObjectId(socket.user.companyId);
        const room = await ChatRoom.findOne({
          _id: rid,
          companyId: companyOid,
          participants: uid,
        });

        if (!room) {
          return socket.emit("error", { message: "Access denied" });
        }

        socket.join(rid);
      } catch (e) {
        socket.emit("error", { message: e.message });
      }
    });

    socket.on("leave_room", ({ roomId }) => {
      if (!roomId) return;
      socket.leave(String(roomId));
    });

    socket.on("send_message", async ({ roomId, text }) => {
      try {
        if (!text?.trim()) return;
        const rid = roomId != null ? String(roomId) : "";
        if (!mongoose.Types.ObjectId.isValid(rid)) {
          return socket.emit("error", { message: "Invalid room" });
        }

        const uid = new mongoose.Types.ObjectId(socket.user.dbUserId);
        const companyOid = new mongoose.Types.ObjectId(socket.user.companyId);
        const room = await ChatRoom.findOne({
          _id: rid,
          companyId: companyOid,
          participants: uid,
        });

        if (!room) {
          return socket.emit("error", { message: "Access denied" });
        }

        const message = await Message.create({
          roomId: room._id,
          text: String(text).trim(),
          sender: uid,
          companyId: companyOid,
        });

        await message.populate("sender", "name email");

        const payload = serializeChatMessage(message);
        io.to(rid).emit("receive_message", payload);
      } catch (err) {
        console.error("Message error:", err);
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("typing", ({ roomId }) => {
      if (!roomId) return;
      const rid = String(roomId);
      socket.to(rid).emit("user_typing", {
        userId: socket.user.dbUserId,
        userName: socket.user.name?.trim() || socket.user.email || "Someone",
      });
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.user?.dbUserId);
    });
  });

  // ✅ IMPORTANT: start server (not app.listen)
  server.listen(PORT, () => {
    console.log(`🚀 Server + Socket running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});