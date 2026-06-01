import express from "express";
import multer from "multer";
import XLSX from "xlsx";

import Lead from "../models/clead.js";

import { calculateLeadScore } from "../utils/calculateLeadScore.js";

const router = express.Router();

/* =====================================
   MULTER
===================================== */

const storage = multer.memoryStorage();

const upload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

/* =====================================
   IMPORT
===================================== */

router.post(
  "/import",
  upload.single("file"),

  async (req, res) => {
    try {

      if (!req.file) {

        return res.status(400).json({
          message: "No file uploaded",
        });

      }

      /* =====================================
         READ EXCEL / CSV
      ===================================== */

      const workbook = XLSX.read(
        req.file.buffer,
        {
          type: "buffer",
        }
      );

      const sheetName =
        workbook.SheetNames[0];

      const sheet =
        workbook.Sheets[sheetName];

      const rows =
        XLSX.utils.sheet_to_json(sheet);

      /* =====================================
         RESULT ARRAYS
      ===================================== */

      const inserted = [];

      const duplicates = [];

      const invalid = [];

      /* =====================================
         LOOP ROWS
      ===================================== */

      for (const row of rows) {

        const payload = {

          agency: req.companyId,

          fullName:
            row.fullName ||
            row.name ||
            "",

          email:
            row.email || "",

          phone:
            row.phone ||
            row.mobile ||
            "",

          designation:
            row.designation ||
            "",

          source:
            row.source ||
            "Imported CSV",

          tags:
            typeof row.tags ===
            "string"
              ? row.tags
                  .split(",")
                  .map((t) =>
                    t.trim()
                  )
              : [],

          company: {
            name:
              row.company ||
              row.companyName ||
              "",

            industry:
              row.industry ||
              "",
          },

          socials: {
            linkedin:
              row.linkedin ||
              "",
          },

          importedFrom:
            req.file.originalname,

          importedAt:
            new Date(),

          status: "New",
        };

        /* =====================================
           VALIDATION
        ===================================== */

        if (
          !payload.fullName &&
          !payload.email &&
          !payload.phone
        ) {

          invalid.push(row);

          continue;
        }

        /* =====================================
           DUPLICATE CHECK
        ===================================== */

        const duplicate =
          await Lead.findOne({
            agency:
              req.companyId,

            $or: [

              payload.email
                ? {
                    email:
                      payload.email,
                  }
                : null,

              payload.phone
                ? {
                    phone:
                      payload.phone,
                  }
                : null,

              payload.socials
                ?.linkedin
                ? {
                    "socials.linkedin":
                      payload
                        .socials
                        .linkedin,
                  }
                : null,

            ].filter(Boolean),
          });

        if (duplicate) {

          duplicates.push({
            fullName:
              payload.fullName,

            email:
              payload.email,
          });

          continue;
        }

        /* =====================================
           AUTO SCORE
        ===================================== */

        payload.leadScore =
          calculateLeadScore(
            payload
          );

        /* =====================================
           TEMPERATURE
        ===================================== */

        if (
          payload.leadScore >= 70
        ) {

          payload.temperature =
            "Hot";

        } else if (
          payload.leadScore >= 40
        ) {

          payload.temperature =
            "Warm";

        } else {

          payload.temperature =
            "Cold";

        }

        inserted.push(payload);
      }

      /* =====================================
         BULK INSERT
      ===================================== */

      if (
        inserted.length > 0
      ) {

        await Lead.insertMany(
          inserted
        );

      }

      res.json({

        success: true,

        imported:
          inserted.length,

        duplicateCount:
          duplicates.length,

        invalidCount:
          invalid.length,

        duplicates,

        invalid,

      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error: err.message,
      });

    }
  }
);

export default router;