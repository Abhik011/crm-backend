import express from "express";
import Reminder from "../models/Reminder.js";
import Lead from "../models/clead.js";

const router =
    express.Router();

router.post(
    "/",
    async (req, res) => {
        try {

            const {
                title,
                description,
                reminderAt,
                leadId,
            } = req.body;

            const lead =
                await Lead.findOne({
                    _id: leadId,
                    agency: req.companyId,
                });

            if (!lead) {
                return res.status(404)
                    .json({
                        message:
                            "Lead not found"
                    });
            }

            const reminder =
                await Reminder.create({

                    title,

                    description,

                    reminderAt,

                    leadId,

                    assignedTo:
                        lead.owner,

                    companyId:
                        req.companyId,

                });

            res.status(201)
                .json(reminder);

        } catch (err) {

            res.status(500)
                .json({
                    error: err.message
                });

        }
    });

router.get(
    "/today",
    async (req, res) => {

        try {

            const start =
                new Date();

            start.setHours(
                0, 0, 0, 0
            );

            const end =
                new Date();

            end.setHours(
                23, 59, 59, 999
            );

            const reminders =
                await Reminder.find({

                    assignedTo:
                        req.user._id,

                    companyId:
                        req.companyId,

                    status:
                        "Pending",

                    reminderAt: {
                        $gte: start,
                        $lte: end
                    }

                })

                    .populate(
                        "leadId",
                        "fullName companyName"
                    )

                    .sort({
                        reminderAt: 1
                    });

            const formatted = reminders.map(
                    (item) => ({

                        _id: item._id,

                        leadName:
                            item.leadId
                                ?.fullName ||
                            "Unknown Lead",

                        type:
                            item.title,

                        date:
                            item.reminderAt,

                        description:
                            item.description

                    })
                );

            res.json(
                formatted
            );

        } catch (err) {

            res.status(500)
                .json({
                    error:
                        err.message
                });

        }

    });

router.get(
    "/my",
    async (req, res) => {

        try {

            const reminders =
                await Reminder.find({

                    assignedTo:
                        req.user._id,

                    companyId:
                        req.companyId,

                    status: "Pending"

                })
                    .populate(
                        "leadId",
                        "fullName companyName"
                    )
                    .sort({
                        reminderAt: 1
                    });

            res.json(
                reminders
            );

        } catch (err) {

            res.status(500)
                .json({
                    error:
                        err.message
                });

        }

    });
export default router;