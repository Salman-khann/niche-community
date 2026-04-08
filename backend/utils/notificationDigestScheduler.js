import Profile from "../models/profile.model.js";
import Notification from "../models/notification.model.js";
import User from "../models/user.model.js";
import { sendNotificationDigestEmail } from "../mailtrap/emails.js";

let notificationDigestTimer = null;

const getWindowHours = (frequency) => (frequency === "weekly" ? 24 * 7 : 24);

export const startNotificationDigestScheduler = async () => {
    if (notificationDigestTimer) return;

    const run = async () => {
        const now = new Date();
        const profiles = await Profile.find({ "notificationPrefs.emailDigestEnabled": true })
            .select("userId notificationPrefs")
            .lean();

        for (const profile of profiles) {
            const prefs = profile.notificationPrefs || {};
            const frequency = prefs.digestFrequency || "daily";
            const minHours = getWindowHours(frequency);
            const lastSentAt = prefs.lastDigestSentAt ? new Date(prefs.lastDigestSentAt) : null;
            const lastBoundary = lastSentAt && !Number.isNaN(lastSentAt.getTime())
                ? lastSentAt
                : new Date(now.getTime() - minHours * 60 * 60 * 1000);

            const elapsedHours = (now.getTime() - lastBoundary.getTime()) / (1000 * 60 * 60);
            if (elapsedHours < minHours) continue;

            const user = await User.findById(profile.userId).select("email name").lean();
            if (!user?.email) continue;

            const unread = await Notification.find({
                userId: profile.userId,
                readAt: null,
                createdAt: { $gte: lastBoundary },
            })
                .sort({ createdAt: -1 })
                .limit(40)
                .lean();

            if (unread.length === 0) {
                await Profile.updateOne(
                    { _id: profile._id },
                    { $set: { "notificationPrefs.lastDigestSentAt": now } }
                );
                continue;
            }

            await sendNotificationDigestEmail({
                email: user.email,
                userName: user.name,
                notifications: unread,
                frequency,
            });

            await Profile.updateOne(
                { _id: profile._id },
                { $set: { "notificationPrefs.lastDigestSentAt": now } }
            );
        }
    };

    await run();
    notificationDigestTimer = setInterval(() => {
        run().catch((error) => {
            console.log("Error in notification digest scheduler:", error?.message || error);
        });
    }, 60 * 60 * 1000);

    console.log("✅ Notification digest scheduler started");
};
