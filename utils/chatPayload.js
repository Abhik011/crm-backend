/**
 * Plain JSON-safe message shape for REST + Socket.IO (avoids ObjectId / BSON quirks in clients).
 */
export function serializeChatMessage(doc) {
  const o = doc?.toObject ? doc.toObject() : { ...(doc || {}) };
  let sender = o.sender;
  if (sender && typeof sender === "object") {
    sender = {
      _id: String(sender._id ?? sender.id ?? ""),
      name: sender.name,
      email: sender.email,
      image: sender.image || "",
    };
  }
  return {
    _id: String(o._id),
    roomId: o.roomId != null ? String(o.roomId) : undefined,
    text: o.text,
   attachments: Array.isArray(
  o.attachments
)
  ? o.attachments.map((a) => ({
      url: a.url || "",
      type: a.type || "file",
      name: a.name || "",
    }))
  : [],
    sender,
    companyId: o.companyId != null ? String(o.companyId) : undefined,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    seenBy: Array.isArray(o.seenBy)
      ? o.seenBy.map((id) => (id != null ? String(id) : id)).filter(Boolean)
      : [],
    editedAt: o.editedAt ?? null,
    deletedAt: o.deletedAt ?? null,
    isDeleted: Boolean(o.isDeleted),
  };
}
