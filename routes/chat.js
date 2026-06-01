import express from "express";
import mongoose from "mongoose";
import ChatRoom from "../models/ChatRoom.js";
import User from "../models/User.js";

const router = express.Router();

function toPlain(room) {
  return room?.toObject ? room.toObject() : { ...room };
}

/**
 * Find an existing 1:1 room or create one (WhatsApp-style DM, same pair = same thread).
 * @returns {Promise<import("mongoose").Document | null>} null if other user not in workspace
 */
async function findOrCreateDirectRoom(companyId, selfUserId, otherIdStr) {
  const otherOid = new mongoose.Types.ObjectId(otherIdStr);
  const selfOid =
    selfUserId instanceof mongoose.Types.ObjectId
      ? selfUserId
      : new mongoose.Types.ObjectId(selfUserId);

  const other = await User.findOne({ _id: otherOid, companyId })
    .select("name email image")
    .lean();
  if (!other) return null;

  let room = await ChatRoom.findOne({
    companyId,
    type: "direct",
    participants: { $all: [selfOid, otherOid], $size: 2 },
  });

  if (!room) {
    const label = other.name?.trim() || other.email || "Chat";
    room = await ChatRoom.create({
      name: label,
      type: "direct",
      participants: [selfOid, otherOid],
      companyId,
    });
  } else {
    room.updatedAt = new Date();
    await room.save();
  }
  return room;
}

/** Attach peer + displayName for direct rooms; normalize ids for JSON. */
async function enrichChatRoomsForClient(rooms, uid, companyId) {
  const uidStr = String(uid);
  const plain = rooms.map(toPlain);

  const peerIds = new Set();
  for (const r of plain) {
    if (r.type !== "direct" || !Array.isArray(r.participants)) continue;
    for (const p of r.participants) {
      const ps = String(p);
      if (ps !== uidStr) peerIds.add(ps);
    }
  }
  const oids = [...peerIds].filter((id) => mongoose.Types.ObjectId.isValid(id));
  const peers = oids.length
    ? await User.find({ _id: { $in: oids }, companyId })
        .select("name email image presenceStatus")
        .lean()
    : [];
  const peerMap = new Map(peers.map((p) => [String(p._id), p]));

  return plain.map((r) => {
    const _id = String(r._id);
    const base = {
      ...r,
      _id,
      companyId: r.companyId != null ? String(r.companyId) : undefined,
    };
    if (Array.isArray(r.participants)) {
      base.participants = r.participants.map((p) => String(p));
    }
    if (r.type !== "direct") return base;

    const otherId = (r.participants || []).map(String).find((id) => id !== uidStr);
    const peer = otherId ? peerMap.get(otherId) : null;
    const displayName = peer
      ? (peer.name?.trim() || peer.email?.split("@")[0] || "Member")
      : base.name || "Chat";
    return {
      ...base,
      peer: peer
        ? {
            _id: String(peer._id),
            name: peer.name,
            email: peer.email,
            image: peer.image || "",
            presenceStatus: peer.presenceStatus || "free",
          }
        : null,
      displayName,
    };
  });
}

/** Group rooms that include every org member (or legacy #General before membersScope existed). */
function workspaceGroupFilter(companyId) {
  return {
    companyId,
    type: "group",
    $or: [
      { membersScope: "workspace" },
      { name: "General", membersScope: { $exists: false } },
    ],
  };
}

/** List rooms the current user participates in; ensures a shared workspace #general exists. */
router.get("/", async (req, res) => {
  try {
    const uid = req.user._id;
    const companyId = req.companyId;

    const workspaceRooms = await ChatRoom.find(workspaceGroupFilter(companyId));
    for (const r of workspaceRooms) {
      if (!r.participants.some((p) => p.equals(uid))) {
        r.participants.push(uid);
        await r.save();
      }
    }

    let rooms = await ChatRoom.find({
      companyId,
      participants: uid,
    })
      .sort({ updatedAt: -1 })
      .lean();

    const general = await ChatRoom.findOne({
      companyId,
      name: "General",
      type: "group",
    });

    if (rooms.length === 0 && !general) {
      const allUsers = await User.find({ companyId }).select("_id").lean();
      const participantIds =
        allUsers.length > 0 ? allUsers.map((u) => u._id) : [uid];
      await ChatRoom.create({
        name: "General",
        type: "group",
        membersScope: "workspace",
        participants: participantIds,
        companyId,
      });
      rooms = await ChatRoom.find({
        companyId,
        participants: uid,
      })
        .sort({ updatedAt: -1 })
        .lean();
    }

    const enriched = await enrichChatRoomsForClient(rooms, uid, companyId);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Start or resume a 1:1 chat with a workspace member (same pair always reuses one room). */
router.post("/dm", async (req, res) => {
  try {
    const raw = req.body?.userId ?? req.body?.peerUserId;
    if (!raw || !mongoose.Types.ObjectId.isValid(String(raw))) {
      return res.status(400).json({ message: "Valid userId required" });
    }
    if (String(raw) === String(req.user._id)) {
      return res.status(400).json({ message: "Cannot start a direct chat with yourself" });
    }

    const room = await findOrCreateDirectRoom(
      req.companyId,
      req.user._id,
      String(raw)
    );
    if (!room) {
      return res.status(404).json({ message: "User not found in this workspace" });
    }

    const [enriched] = await enrichChatRoomsForClient(
      [room.toObject ? room.toObject() : room],
      req.user._id,
      req.companyId
    );
    res.status(200).json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || "").trim() || "Chat";
    const type = body.type === "direct" ? "direct" : "group";
    const membersScope =
      type === "group" && body.membersScope === "custom" ? "custom" : "workspace";

    const selfId = String(req.user._id);
    let participantOids = [];

    if (type === "direct") {
      const participants = Array.isArray(body.participants) ? body.participants : [];
      const ids = [selfId, ...participants]
        .map((id) => (typeof id === "string" ? id : id?.toString?.()))
        .filter(Boolean);
      const unique = [...new Set(ids)].filter((id) => mongoose.Types.ObjectId.isValid(id));
      const others = unique.filter((id) => id !== selfId);
      if (others.length !== 1) {
        return res.status(400).json({
          message:
            "Direct chat requires exactly one other teammate. Prefer POST /chat/dm with { userId }.",
        });
      }
      const room = await findOrCreateDirectRoom(req.companyId, req.user._id, others[0]);
      if (!room) {
        return res.status(404).json({ message: "User not found in this workspace" });
      }
      const [enriched] = await enrichChatRoomsForClient(
        [room.toObject ? room.toObject() : room],
        req.user._id,
        req.companyId
      );
      return res.status(200).json(enriched);
    } else if (membersScope === "workspace") {
      const allUsers = await User.find({ companyId: req.companyId }).select("_id").lean();
      const idStrings = [
        ...new Set(
          (allUsers.length > 0 ? allUsers : [{ _id: req.user._id }]).map((u) =>
            String(u._id)
          )
        ),
      ].filter((id) => mongoose.Types.ObjectId.isValid(id));
      participantOids = idStrings.map((id) => new mongoose.Types.ObjectId(id));
    } else {
      const participants = Array.isArray(body.participants) ? body.participants : [];
      const ids = [selfId, ...participants]
        .map((id) => (typeof id === "string" ? id : id?.toString?.()))
        .filter(Boolean);
      const unique = [...new Set(ids)].filter((id) => mongoose.Types.ObjectId.isValid(id));
      const others = unique.filter((id) => id !== selfId);
      if (others.length > 0) {
        const ok = await User.countDocuments({
          _id: { $in: others },
          companyId: req.companyId,
        });
        if (ok !== others.length) {
          return res.status(400).json({
            message: "All participants must be existing users in this workspace",
          });
        }
      }
      participantOids = unique.map((id) => new mongoose.Types.ObjectId(id));
    }

    const room = await ChatRoom.create({
      name,
      type,
      membersScope: type === "group" ? membersScope : undefined,
      participants: participantOids,
      companyId: req.companyId,
    });

    const [enriched] = await enrichChatRoomsForClient(
      [room.toObject ? room.toObject() : room],
      req.user._id,
      req.companyId
    );
    res.status(201).json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
