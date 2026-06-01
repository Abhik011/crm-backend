import cron from "node-cron";
import Reminder from "../models/Reminder.js";
import Lead from "../models/clead.js";

export default function startReminderJob(
    io
) {

    cron.schedule(
        "*/30 * * * * *", // testing every 10 sec
        async () => {

            try {

                const now =
                    new Date();

                console.log(
                    "\n======================"
                );

                console.log(
                    "⏰ CRON:",
                    now.toLocaleString()
                );

                const reminders =
                    await Reminder.find({

                        status: {
                            $in: [
                                "Pending",
                                "Due"
                            ]
                        }

                    });

                console.log(
                    `📌 Total reminders: ${reminders.length}`
                );

                for (
                    const reminder
                    of reminders
                ) {

                    const reminderTime =
                        new Date(
                            reminder.reminderAt
                        );

                    const diffMinutes =
                        Math.floor(
                            (
                                reminderTime -
                                now
                            ) /
                            1000 /
                            60
                        );



                    /* ======================
                    10 MIN BEFORE
                    ====================== */

                    if (
                        diffMinutes <= 10 &&
                        diffMinutes > 0 &&
                        !reminder.preNotified
                    ) {

                        console.log(
                            "🔔 Upcoming reminder"
                        );

                        io.to(
                            String(
                                reminder.assignedTo
                            )
                        ).emit(
                            "upcoming_reminder",
                            {
                                title:
                                    "Upcoming Follow Up",

                                message:
                                    `${reminder.title} in ${diffMinutes} min`,

                                reminderId:
                                    reminder._id
                            }
                        );

                        reminder.preNotified =
                            true;

                        await reminder.save();

                    }



                    /* ======================
                    DUE NOW
                    ====================== */

                    if (
                        reminderTime <= now &&
                        !reminder.notified
                    ) {

                        console.log(
                            "🔴 Due now"
                        );

                        io.to(
                            String(
                                reminder.assignedTo
                            )
                        ).emit(
                            "reminder",
                            {
                                title:
                                    "Follow Up Due",

                                message:
                                    reminder.title,

                                reminderId:
                                    reminder._id
                            }
                        );

                        reminder.notified =
                            true;

                        reminder.status =
                            "Due";

                        await reminder.save();

                    }



                    /* ======================
                    OVERDUE
                    30 MIN LATER
                    ====================== */

                    const overdueMinutes =
                        Math.floor(
                            (
                                now -
                                reminderTime
                            ) /
                            1000 /
                            60
                        );

                    if (
                        overdueMinutes >= 30 &&
                        reminder.status !==
                        "Completed" &&
                        !reminder.overdueNotified
                    ) {

                        console.log(
                            "⚠️ Overdue reminder"
                        );

                        io.to(
                            String(
                                reminder.assignedTo
                            )
                        ).emit(
                            "overdue_reminder",
                            {
                                title:
                                    "Overdue Follow Up",

                                message:
                                    reminder.title,

                                reminderId:
                                    reminder._id
                            }
                        );

                        reminder.status =
                            "Overdue";

                        reminder.overdueNotified =
                            true;

                        await reminder.save();

                    }



                    /* ======================
                    LIVE DASHBOARD UPDATE
                    ====================== */

                    const lead =
                        await Lead.findById(
                            reminder.leadId
                        );

                    if (
                        lead
                    ) {

                        io.to(
                            String(
                                reminder.assignedTo
                            )
                        ).emit(
                            "lead_updated",
                            lead
                        );

                    }

                }

                console.log(
                    "======================\n"
                );

            } catch (err) {

                console.log(
                    "❌ Reminder Job Error"
                );

                console.error(
                    err
                );

            }

        });
}