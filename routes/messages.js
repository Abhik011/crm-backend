import express from "express";
import mongoose from "mongoose";
import Message from "../models/Message.js";
import ChatRoom from "../models/ChatRoom.js";
import { serializeChatMessage } from "../utils/chatPayload.js";

const router = express.Router();

async function assertRoomAccess(roomId, companyId, userId) {
  if (!mongoose.Types.ObjectId.isValid(roomId)) return null;
  return ChatRoom.findOne({
    _id: roomId,
    companyId,
    participants: userId,
  });
}

/** Mark all other people's messages in this room as read by the current user; notifies room via Socket.IO. */
router.post("/:roomId/read", async (req, res) => {
  try {
    const room = await assertRoomAccess(
      req.params.roomId,
      req.companyId,
      req.user._id
    );
    if (!room) {
      return res.status(404).json({ message: "Room not found or access denied" });
    }

    const readerId = req.user._id;
    await Message.updateMany(
      {
        roomId: room._id,
        companyId: req.companyId,
        sender: { $ne: readerId },
        seenBy: { $nin: [readerId] },
      },
      { $addToSet: { seenBy: readerId } }
    );

    const io = req.app.get("io");
    if (io) {
      io.to(String(room._id)).emit("read_receipt", {
        roomId: String(room._id),
        readerUserId: String(readerId),
      });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:roomId", async (req, res) => {
  try {
    const room = await assertRoomAccess(
      req.params.roomId,
      req.companyId,
      req.user._id
    );
    if (!room) {
      return res.status(404).json({ message: "Room not found or access denied" });
    }

    const messages = await Message.find({
      roomId: room._id,
      companyId: req.companyId,
    })
      .populate("sender", "name email image")
      .sort({ createdAt: 1 });

    res.json(messages.map((m) => serializeChatMessage(m)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { roomId, text, attachments = [], } = req.body;
    const MAX_LEN = 8000;
    const cleanText =
      typeof text === "string"
        ? text.trim()
        : "";

    if (
      !cleanText &&
      (!Array.isArray(attachments) ||
        attachments.length === 0)
    ) {
      return res.status(400).json({
        message:
          "Message or attachment required",
      });
    }
    if (String(text).length > MAX_LEN) {
      return res.status(400).json({
        message: `Message too long (max ${MAX_LEN} characters)`,
      });
    }

    const room = await assertRoomAccess(roomId, req.companyId, req.user._id);
    if (!room) {
      return res.status(404).json({ message: "Room not found or access denied" });
    }

    const message = await Message.create({
      roomId: room._id,
      text: cleanText,
      attachments:
      Array.isArray(
        attachments
      )
        ? attachments
        : [],

      sender: req.user._id,
      companyId: req.companyId,
    });

    await message.populate("sender", "name email image");

    const payload = serializeChatMessage(message);

    const io = req.app.get("io");
    if (io) {
      io.to(String(room._id)).emit("receive_message", payload);
    }

    res.status(201).json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Edit own message (text only; attachments unchanged). */
router.patch("/item/:messageId", async (req, res) => {
  try {
    const { messageId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: "Invalid message id" });
    }

    const message = await Message.findOne({
      _id: messageId,
      companyId: req.companyId,
      sender: req.user._id,
      isDeleted: { $ne: true },
    });

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const room = await assertRoomAccess(
      String(message.roomId),
      req.companyId,
      req.user._id
    );
    if (!room) {
      return res.status(403).json({ message: "Access denied" });
    }

    const cleanText =
      typeof req.body.text === "string" ? req.body.text.trim() : "";
    const MAX_LEN = 8000;
    if (!cleanText) {
      return res.status(400).json({ message: "Message text required" });
    }
    if (cleanText.length > MAX_LEN) {
      return res.status(400).json({
        message: `Message too long (max ${MAX_LEN} characters)`,
      });
    }

    message.text = cleanText;
    message.editedAt = new Date();
    await message.save();
    await message.populate("sender", "name email image");

    const payload = serializeChatMessage(message);
    const io = req.app.get("io");
    if (io) {
      io.to(String(room._id)).emit("message_updated", payload);
    }

    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Soft-delete own message (WhatsApp-style). */
router.delete("/item/:messageId", async (req, res) => {
  try {
    const { messageId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: "Invalid message id" });
    }

    const message = await Message.findOne({
      _id: messageId,
      companyId: req.companyId,
      sender: req.user._id,
      isDeleted: { $ne: true },
    });

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const room = await assertRoomAccess(
      String(message.roomId),
      req.companyId,
      req.user._id
    );
    if (!room) {
      return res.status(403).json({ message: "Access denied" });
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.text = "";
    message.attachments = [];
    await message.save();
    await message.populate("sender", "name email image");

    const payload = serializeChatMessage(message);
    const io = req.app.get("io");
    if (io) {
      io.to(String(room._id)).emit("message_updated", payload);
    }

    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
