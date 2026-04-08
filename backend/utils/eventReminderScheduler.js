import Event from "../models/event.model.js";
import Notification from "../models/notification.model.js";
import { io } from "../socket.js";

let eventReminderTimer = null;

const formatEventTime = (dateValue) => {
    const dt = new Date(dateValue);
    if (Number.isNaN(dt.getTime())) return "soon";
    return dt.toLocaleString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
};

export const startEventReminderScheduler = async () => {
    if (eventReminderTimer) return;

    const run = async () => {
        const now = new Date();
        const dueEvents = await Event.find({
            reminders: { $elemMatch: { sentAt: null, remindAt: { $lte: now } } },
        })
            .select("title startDate date reminders communityId")
            .lean();

        for (const event of dueEvents) {
            for (const reminder of (event.reminders || [])) {
                if (reminder.sentAt) continue;
                const remindAt = new Date(reminder.remindAt);
                if (Number.isNaN(remindAt.getTime()) || remindAt > now) continue;

                const updateResult = await Event.updateOne(
                    {
                        _id: event._id,
                        reminders: {
                            $elemMatch: {
                                _id: reminder._id,
                                sentAt: null,
                                remindAt: { $lte: now },
                            },
                        },
                    },
                    {
                        $set: { "reminders.$.sentAt": now },
                    }
                );

                if (!updateResult.modifiedCount) continue;

                const eventStart = event.startDate || event.date;
                const minutesBefore = reminder.minutesBefore || 0;
                const notification = await Notification.create({
                    userId: reminder.userId,
                    type: "event",
                    meta: {
                        kind: "reminder",
                        eventId: event._id,
                        communityId: event.communityId,
                        eventTitle: event.title,
                        minutesBefore,
                        startsAt: eventStart,
                        startsAtLabel: formatEventTime(eventStart),
                    },
                });

                io.to(`user:${reminder.userId}`).emit("new_notification", notification);
            }
        }
    };

    await run();
    eventReminderTimer = setInterval(() => {
        run().catch((error) => {
            console.log("Error in event reminder scheduler:", error?.message || error);
        });
    }, 30 * 1000);

    console.log("✅ Event reminder scheduler started");
};
