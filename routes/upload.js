import express from "express";
import multer from "multer";
import { uploadFile } from "../utils/s3.js";

const router = express.Router();

const storage = multer.memoryStorage();

function attachmentTypeFromMime(mimetype, originalname) {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.startsWith("audio/")) return "audio";
  const lower = String(originalname || "").toLowerCase();
  if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar)$/i.test(lower)) {
    return "file";
  }
  return "file";
}

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 100,
  },
  fileFilter: (req, file, cb) => {
    const mime = file.mimetype || "";
    const allowed =
      mime.startsWith("image/") ||
      mime.startsWith("video/") ||
      mime.startsWith("audio/") ||
      mime === "application/pdf" ||
      mime.includes("document") ||
      mime.includes("spreadsheet") ||
      mime.includes("presentation") ||
      mime === "text/plain" ||
      mime === "application/zip" ||
      mime === "application/x-zip-compressed";

    const lower = String(file.originalname || "").toLowerCase();
    const extOk = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|webm|mp3|m4a|wav|ogg)$/i.test(
      lower
    );

    if (allowed || extOk) {
      return cb(null, true);
    }

    return cb(
      new Error(
        "File type not allowed. Use images, videos, audio, or common documents."
      )
    );
  },
});

router.post("/chat", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "File required" });
    }

    if (!req.companyId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const uploaded = await uploadFile({
      file: req.file,
      folder: "chat",
      companyId: req.companyId,
    });

    const type = attachmentTypeFromMime(
      req.file.mimetype,
      req.file.originalname
    );

    return res.json({
      success: true,
      file: {
        url: uploaded.url,
        name: req.file.originalname,
        type,
      },
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: err.message || "Upload failed",
    });
  }
});

export default router;
