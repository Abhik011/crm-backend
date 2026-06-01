import express from "express";

import Lead from "../models/clead.js";
import Customer from "../models/Customer.js";
import Deal from "../models/Deal.js";
import Quote from "../models/Quote.js";
import Agency from "../models/Agency.js";
import { calculateLeadScore } from "../utils/calculateLeadScore.js";
import { assertWithinLimit } from "../services/assertPlanLimit.js";
import { calcQuoteTotals } from "../utils/quoteCalc.js";
import Reminder from "../models/Reminder.js";
const router = express.Router();

// 🔥 CONVERT LEAD → CUSTOMER + DEAL
router.post("/:id/convert", async (req, res) => {
  try {
    if (!(await assertWithinLimit(req, res, "customers"))) return;
    if (!(await assertWithinLimit(req, res, "deals"))) return;

    const lead = await Lead.findOne({
      _id: req.params.id,
      agency: req.companyId,
    });

    if (!lead) return res.status(404).json({ message: "Lead not found" });

    if (lead.status !== "Qualified") {
      return res.status(400).json({
        message: "Lead must be Qualified before conversion",
      });
    }

    const customer = await Customer.create({
      agency: req.companyId,
      name: lead.name,
      companyName: lead.companyName,
      phone: lead.phone,
      email: lead.email,
      source: lead.source,
      notes: lead.notes,
    });

    const deal = await Deal.create({
      agency: req.companyId,
      customer: customer._id,
      title: lead.companyName || lead.name,
      service: lead.service || "General",
      value: lead.estimatedValue || 0,
      status: "New",
      notes: lead.notes || "",
    });

    lead.status = "Converted";
    await lead.save();

    res.json({
      message: "Lead converted successfully",
      customer,
      deal,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {

    if (
      !(await assertWithinLimit(
        req,
        res,
        "leads"
      ))
    )
      return;

    const payload = {
      ...req.body,

      agency: req.companyId,
      owner:
        req.body.owner ||
        req.user._id,
    };

    /* =========================
       AUTO LEAD SCORE
    ========================= */

    payload.leadScore =
      calculateLeadScore(
        payload
      );

    /* =========================
       AUTO TEMPERATURE
    ========================= */

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

    const lead =
      await Lead.create(
        payload
      );

    res.json(lead);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message,
    });

  }
});

// ✅ GET ALL LEADS
router.get("/", async (req, res) => {
  try {
    let query = {
      agency: req.companyId,
    };

    const role = req.user.role;

    // Admin + Super Admin see all
    if (
      role !== "admin" &&
      role !== "super_admin"
    ) {
      query.owner =
        req.user._id;
    }

    const leads =
      await Lead.find(query)
        .populate(
          "owner",
          "name email image"
        )
        .sort({
          createdAt: -1,
        });

    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {

    const existingLead =
      await Lead.findOne({
        _id: req.params.id,
        agency: req.companyId,
      });

    if (!existingLead) {
      return res.status(404).json({
        message: "Lead not found",
      });
    }

    const payload = {
      ...req.body,
      agency: req.companyId,
    };

    const isAdmin =
      req.user.role === "admin" ||
      req.user.role === "super_admin";

    // only admin can change owner
    if (!isAdmin) {
      delete payload.owner;
    } else if (!payload.owner) {
      payload.owner =
        existingLead.owner;
    }

    /* =========================
       RECALCULATE SCORE
    ========================= */

    payload.leadScore =
      calculateLeadScore(
        payload
      );

    /* =========================
       AUTO TEMPERATURE
    ========================= */

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

    const lead =
      await Lead.findOneAndUpdate(
        {
          _id: req.params.id,
          agency: req.companyId
        },
        payload,
        {
          new: true
        }
      );

    if (!lead) {

      return res
        .status(404)
        .json({
          message:
            "Lead not found"
        });

    }

    /* ======================
    CREATE REMINDER
    ====================== */

    if (
      payload.nextFollowUp
    ) {

      const exists =
        await Reminder.findOne({

          leadId:
            lead._id,

          reminderAt:
            new Date(
              payload.nextFollowUp
            ),

          assignedTo:
            lead.owner,

          status:
            "Pending"

        });

      if (
        !exists
      ) {

        await Reminder.create({

          title:
            payload.followUpType ||
            payload.followUps?.[
              payload.followUps.length - 1
            ]?.type ||
            "Task",

          description:
            payload.notes ||
            "Auto created from lead form",

          reminderAt:
            new Date(
              payload.nextFollowUp
            ),

          leadId:
            lead._id,

          assignedTo:
            lead.owner,

          companyId:
            req.companyId,

          status:
            "Pending"

        });

      }

    }

    res.json(
      lead
    );


  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message,
    });

  }
});
// ✅ UPDATE STATUS + AUTO QUOTE
router.put("/:id/status", async (req, res) => {
  try {
    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, agency: req.companyId },
      { status: req.body.status },
      { new: true }
    );

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // 🚀 AUTO QUOTE GENERATION
    if (req.body.status === "Negotiation") {
      const agency = await Agency.findById(req.companyId);

      const calc = calcQuoteTotals(
        [
          {
            name: lead.service || "Service",
            quantity: 1,
            rate: lead.estimatedValue || 0,
          },
        ],
        "CGST_SGST",
        0
      );

      await Quote.create({
        agency: req.companyId,
        title: lead.companyName || lead.name,
        quoteNumber: "QT-" + Date.now(),
        items: calc.calculatedItems,
        subtotal: calc.subtotal,
        totalAmount: calc.totalAmount,
        amount: calc.totalAmount,
        status: "Draft",

        agencySnapshot: {
          name: agency?.name,
          address: agency?.address,
          email: agency?.email,
          phone: agency?.phone,
          gstin: agency?.gstin,
        },

        customerSnapshot: {
          name: lead.name,
          companyName: lead.companyName,
          email: lead.email,
          phone: lead.phone,
        },
      });
    }

    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const lead =
      await Lead.findOneAndDelete({
        _id: req.params.id,
        agency: req.companyId,
      });

    if (!lead) {
      return res.status(404).json({
        message: "Lead not found",
      });
    }

    res.json({
      success: true,
      message:
        "Lead deleted successfully",
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
});
export default router;