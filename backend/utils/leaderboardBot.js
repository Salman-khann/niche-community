import bcrypt from "bcryptjs";
import crypto from "crypto";
import Channel from "../models/channel.model.js";
import ChannelMessage from "../models/channelMessage.model.js";
import ChannelMessageComment from "../models/channelMessageComment.model.js";
import Community from "../models/community.model.js";
import Event from "../models/event.model.js";
import Post from "../models/post.model.js";
import Profile from "../models/profile.model.js";
import Comment from "../models/thread.model.js";
import User from "../models/user.model.js";
import AuditLog from "../models/auditLog.model.js";
import { io } from "../socket.js";

const BOT_KEY = "circle_leaderboard_bot";
const BOT_EMAIL = process.env.LEADERBOARD_BOT_EMAIL || "circlebot@circlecore.local";
const BOT_NAME = process.env.LEADERBOARD_BOT_NAME || "CircleBot";
const BOT_INTERVAL_MINUTES = Math.max(5, Number(process.env.LEADERBOARD_BOT_INTERVAL_MINUTES || 1440));
const BOT_LIMIT = Math.min(20, Math.max(3, Number(process.env.LEADERBOARD_BOT_POST_LIMIT || 5)));
const DIGEST_INTERVAL_HOURS = Math.max(6, Number(process.env.LEADERBOARD_BOT_DIGEST_INTERVAL_HOURS || 168));
const REPUTATION_ROLE_THRESHOLD = Math.max(10, Number(process.env.LEADERBOARD_BOT_ROLE_THRESHOLD || 100));
const REPUTATION_ROLE_NAME = (process.env.LEADERBOARD_BOT_ROLE_NAME || "top-contributor").toLowerCase();

let schedulerHandle = null;

const FAQ_TOPICS = {
    invites: "Use invite codes from server admins. For private communities, request access from /invite.",
    reputation: "Reputation increases through quality posts, helpful replies, and positive reactions.",
    events: "Use the Events section to RSVP. CircleBot sends reminders at 24h, 1h, and 10m before start.",
    moderation: "Report harmful content and moderators will review it in the moderation queue.",
    premium: "Premium unlocks advanced channels and perks through the upgrade flow.",
};

const buildTable = (headers, rows) => {
    const safeRows = rows.length ? rows : [["-", "No data yet"]];
    const allRows = [headers, ...safeRows];
    const widths = headers.map((_, col) => Math.max(...allRows.map((row) => String(row[col] ?? "").length)));

    const line = (row) => `| ${row.map((cell, i) => String(cell ?? "").padEnd(widths[i], " ")).join(" | ")} |`;
    const divider = `| ${widths.map((w) => "-".repeat(w)).join(" | ")} |`;
    return [line(headers), divider, ...safeRows.map(line)].join("\n");
};

const formatTopMembers = (members = []) => {
    return buildTable(
        ["Rank", "Member", "Reputation"],
        members.map((item, index) => [
            index + 1,
            item.userId?.name || item.displayName || "Member",
            item.reputation || 0,
        ])
    );
};

const formatTopCommunities = (communities = []) => {
    return buildTable(
        ["Rank", "Community", "Score"],
        communities.map((item, index) => [index + 1, item.name, item.communityScore || 0])
    );
};

const buildLeaderboardMessage = ({ communityName, members, communities, reason = "update" }) => {
    const reasonLabel = reason === "scheduled" ? "Scheduled update" : "Requested update";
    return [
        `🏆 **${communityName} Leaderboard**`,
        `_${reasonLabel} • ${new Date().toLocaleString()}_`,
        "",
        "**Top Members (Reputation)**",
        "```",
        formatTopMembers(members),
        "```",
        "",
        "**Top Communities (Score)**",
        "```",
        formatTopCommunities(communities),
        "```",
    ].join("\n");
};

const buildWeeklyDigestMessage = ({ communityName, stats }) => {
    const table = buildTable(
        ["Metric", "Value"],
        [
            ["Posts (7d)", stats.posts],
            ["Thread Comments (7d)", stats.comments],
            ["Channel Messages (7d)", stats.messages],
            ["Message Comments (7d)", stats.messageComments],
            ["Active Members (7d)", stats.activeMembers],
            ["New Members (7d)", stats.newMembers],
        ]
    );

    return [
        `📊 **${communityName} Weekly Digest**`,
        `_${new Date().toLocaleString()}_`,
        "",
        "```",
        table,
        "```",
    ].join("\n");
};

const buildEventReminderMessage = ({ event, minutesUntilStart }) => {
    const hours = Math.floor(minutesUntilStart / 60);
    const mins = minutesUntilStart % 60;
    const lead = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    return [
        `⏰ **Event Reminder: ${event.title}**`,
        `Starts in **${lead}**`,
        event.location ? `Location: ${event.location}` : "",
        `Start: ${new Date(event.startDate || event.date).toLocaleString()}`,
        `RSVPs: ${event.rsvpList?.length || 0}`,
    ].filter(Boolean).join("\n");
};

const buildSimpleCard = (title, lines = []) => [
    `🤖 **${title}**`,
    ...lines.filter(Boolean),
].join("\n");

const postBotText = async ({ communityId, channelId, content }) => {
    const community = await Community.findById(communityId).select("_id").lean();
    if (!community) return null;
    const channel = await pickTargetChannel(communityId, channelId);
    if (!channel) return null;
    const bot = await ensureBotInCommunity(communityId);

    const message = await ChannelMessage.create({
        channelId: channel._id,
        senderId: bot._id,
        content,
        mediaURLs: [],
        mentions: [],
    });

    try {
        io.to(`channel:${channel._id}`).emit("channel:message", message);
    } catch {
        // ignore socket failures
    }
    return message;
};

const getSenderCommunityRole = async ({ senderId, communityId }) => {
    const sender = await User.findById(senderId).select("memberships").lean();
    const membership = sender?.memberships?.find((m) => m.communityId?.toString() === communityId.toString());
    return membership?.role || "member";
};

const handleModLogCommand = async ({ communityId, channelId, senderId }) => {
    const role = await getSenderCommunityRole({ senderId, communityId });
    if (!["admin", "moderator"].includes(role)) {
        return postBotText({ communityId, channelId, content: buildSimpleCard("Moderation Logs", ["Only admins or moderators can use /modlog."]) });
    }

    const logs = await AuditLog.find({ communityId })
        .sort({ createdAt: -1 })
        .limit(8)
        .populate("targetUserId", "name")
        .populate("moderatorId", "name")
        .lean();

    const lines = logs.length
        ? logs.map((item) => `- ${new Date(item.createdAt).toLocaleDateString()} | ${item.actionType} | target: ${item.targetUserId?.name || "n/a"} | by: ${item.moderatorId?.name || "n/a"}`)
        : ["No moderation actions logged yet."];

    return postBotText({ communityId, channelId, content: buildSimpleCard("Moderation Logs", lines) });
};

const handleRepTopCommand = async ({ communityId, channelId }) => {
    const community = await Community.findById(communityId).select("name members").lean();
    if (!community) return null;
    return postCommunityLeaderboard({ communityId: community._id, channelId, reason: "requested" });
};

const handleEventRemindCommand = async ({ communityId, channelId, args }) => {
    const eventId = args[0];
    let event = null;
    if (eventId) {
        event = await Event.findOne({ _id: eventId, communityId }).lean();
    }
    if (!event) {
        event = await Event.findOne({ communityId, status: "scheduled", date: { $gte: new Date() } })
            .sort({ date: 1 })
            .lean();
    }

    if (!event) {
        return postBotText({ communityId, channelId, content: buildSimpleCard("Event Reminder", ["No upcoming scheduled events found."]) });
    }

    const mins = Math.max(0, Math.floor((new Date(event.startDate || event.date).getTime() - Date.now()) / 60000));
    const content = buildEventReminderMessage({ event, minutesUntilStart: mins });
    return postBotText({ communityId, channelId, content });
};

const handleWelcomeSetupCommand = async ({ communityId, channelId }) => {
    const content = buildSimpleCard("Welcome Setup", [
        "1. Start in #welcome and introduce your community purpose.",
        "2. Ask new members to complete profile onboarding.",
        "3. Share rules, posting format, and how to ask for help.",
        "4. Use /leaderboard weekly to celebrate top contributors.",
    ]);
    return postBotText({ communityId, channelId, content });
};

const handleBestOfCommand = async ({ communityId, channelId }) => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const posts = await Post.find({ communityId, createdAt: { $gte: since } })
        .sort({ likesCount: -1, commentsCount: -1, createdAt: -1 })
        .limit(5)
        .populate("authorId", "name")
        .lean();

    const lines = posts.length
        ? posts.map((post, idx) => `${idx + 1}. ${post.authorId?.name || "Member"} | ❤️ ${post.likesCount || 0} | 💬 ${post.commentsCount || 0} | ${(post.content || "").slice(0, 80)}`)
        : ["No standout posts this week yet."];

    return postBotText({ communityId, channelId, content: buildSimpleCard("Best Of This Week", lines) });
};

const handleUnansweredCommand = async ({ communityId, channelId }) => {
    const posts = await Post.find({ communityId, commentsCount: 0 })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("authorId", "name")
        .lean();

    const lines = posts.length
        ? posts.map((post, idx) => `${idx + 1}. ${post.authorId?.name || "Member"} | ${(post.content || "").slice(0, 90)}`)
        : ["Great job. No unanswered posts right now."];

    return postBotText({ communityId, channelId, content: buildSimpleCard("Unanswered Posts", lines) });
};

const handleSafetyStatusCommand = async ({ communityId, channelId }) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const channels = await Channel.find({ communityId }).select("_id").lean();
    const channelIds = channels.map((c) => c._id);

    const [flaggedPosts, flaggedMessages, community] = await Promise.all([
        Post.countDocuments({ communityId, flagged: true, flaggedAt: { $gte: since } }),
        ChannelMessage.countDocuments({ channelId: { $in: channelIds }, flagged: true, flaggedAt: { $gte: since } }),
        Community.findById(communityId).select("botMeta").lean(),
    ]);

    const raidMode = !!community?.botMeta?.raidMode;
    const content = buildSimpleCard("Safety Status (24h)", [
        `Raid mode: ${raidMode ? "ON" : "OFF"}`,
        `Flagged posts: ${flaggedPosts}`,
        `Flagged messages: ${flaggedMessages}`,
        `Risk level: ${flaggedPosts + flaggedMessages > 20 ? "High" : flaggedPosts + flaggedMessages > 8 ? "Medium" : "Low"}`,
    ]);

    return postBotText({ communityId, channelId, content });
};

const handleRaidModeCommand = async ({ communityId, channelId, senderId, args }) => {
    const role = await getSenderCommunityRole({ senderId, communityId });
    if (role !== "admin") {
        return postBotText({ communityId, channelId, content: buildSimpleCard("Raid Mode", ["Only admins can toggle raid mode."]) });
    }

    const mode = (args[0] || "").toLowerCase();
    if (!["on", "off"].includes(mode)) {
        return postBotText({ communityId, channelId, content: buildSimpleCard("Raid Mode", ["Usage: /raid-mode on|off"]) });
    }

    await Community.findByIdAndUpdate(communityId, { $set: { "botMeta.raidMode": mode === "on" } });
    return postBotText({ communityId, channelId, content: buildSimpleCard("Raid Mode", [`Raid mode is now ${mode.toUpperCase()}.`]) });
};

const handleFaqCommand = async ({ communityId, channelId, args }) => {
    const topic = (args[0] || "").toLowerCase();
    if (!topic || !FAQ_TOPICS[topic]) {
        const topics = Object.keys(FAQ_TOPICS).join(", ");
        return postBotText({ communityId, channelId, content: buildSimpleCard("FAQ", [`Usage: /faq <topic>`, `Topics: ${topics}`]) });
    }
    return postBotText({ communityId, channelId, content: buildSimpleCard(`FAQ: ${topic}`, [FAQ_TOPICS[topic]]) });
};

const handlePollCommand = async ({ communityId, channelId, args }) => {
    const raw = args.join(" ");
    const parts = raw.split("|").map((part) => part.trim()).filter(Boolean);
    if (parts.length < 3) {
        return postBotText({ communityId, channelId, content: buildSimpleCard("Quick Poll", ["Usage: /poll Question | Option 1 | Option 2 | [Option 3..]"]) });
    }

    const [question, ...options] = parts;
    const lines = options.slice(0, 6).map((opt, idx) => `${idx + 1}. ${opt}`);
    const content = buildSimpleCard(`Poll: ${question}`, lines);
    return postBotText({ communityId, channelId, content });
};

export const ensureLeaderboardBotUser = async () => {
    let bot = await User.findOne({ botKey: BOT_KEY });
    if (bot) return bot;

    bot = await User.findOne({ email: BOT_EMAIL.toLowerCase() });
    if (bot) {
        if (!bot.isBot || bot.botKey !== BOT_KEY) {
            bot.isBot = true;
            bot.botKey = BOT_KEY;
            bot.isVerified = true;
            bot.isInviteVerified = true;
            await bot.save();
        }
        return bot;
    }

    const randomPassword = crypto.randomBytes(32).toString("hex");
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    bot = await User.create({
        email: BOT_EMAIL.toLowerCase(),
        name: BOT_NAME,
        password: hashedPassword,
        isBot: true,
        botKey: BOT_KEY,
        isVerified: true,
        isInviteVerified: true,
    });

    return bot;
};

const ensureBotInCommunity = async (communityId) => {
    const bot = await ensureLeaderboardBotUser();
    const community = await Community.findById(communityId);
    if (!community) return bot;

    const botId = bot._id.toString();
    if (!(community.members || []).some((id) => id.toString() === botId)) {
        community.members.push(bot._id);
        await community.save();
    }

    const botUser = await User.findById(bot._id);
    if (!botUser.memberships.some((m) => m.communityId?.toString() === communityId.toString())) {
        botUser.memberships.push({ communityId, role: "member", roles: [] });
        await botUser.save();
    }

    return bot;
};

const getTopMembersForCommunity = async (community, limit = BOT_LIMIT) => {
    const memberIds = (community.members || []).map((id) => id.toString());
    if (!memberIds.length) return [];

    return Profile.find({ userId: { $in: memberIds }, reputation: { $gt: 0 } })
        .sort({ reputation: -1, updatedAt: -1 })
        .limit(limit)
        .populate("userId", "name")
        .lean();
};

const getTopCommunities = async (limit = BOT_LIMIT) => {
    return Community.find({ communityScore: { $gt: 0 } })
        .sort({ communityScore: -1, updatedAt: -1 })
        .limit(limit)
        .select("name communityScore")
        .lean();
};

const pickTargetChannel = async (communityId, channelIdOverride = null) => {
    if (channelIdOverride) {
        const chosen = await Channel.findOne({ _id: channelIdOverride, communityId }).lean();
        if (chosen) return chosen;
    }

    const announcement = await Channel.findOne({ communityId, type: "announcement" })
        .sort({ createdAt: 1 })
        .lean();
    if (announcement) return announcement;

    return Channel.findOne({ communityId, type: "text" })
        .sort({ createdAt: 1 })
        .lean();
};

const sendBotMessage = async ({ community, channel, reason = "update" }) => {
    const bot = await ensureBotInCommunity(community._id);
    const [members, communities] = await Promise.all([
        getTopMembersForCommunity(community),
        getTopCommunities(),
    ]);

    const content = buildLeaderboardMessage({
        communityName: community.name,
        members,
        communities,
        reason,
    });

    const message = await ChannelMessage.create({
        channelId: channel._id,
        senderId: bot._id,
        content,
        mediaURLs: [],
        mentions: [],
    });

    try {
        io.to(`channel:${channel._id}`).emit("channel:message", message);
    } catch {
        // ignore socket failures
    }

    return message;
};

export const postCommunityLeaderboard = async ({ communityId, channelId = null, reason = "update" }) => {
    const community = await Community.findById(communityId).select("_id name members").lean();
    if (!community) return null;

    const channel = await pickTargetChannel(communityId, channelId);
    if (!channel) return null;

    return sendBotMessage({ community, channel, reason });
};

const postDigest = async ({ community, channelId = null }) => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const communityId = community._id;

    const [posts, comments, messages, messageComments, newMembers] = await Promise.all([
        Post.countDocuments({ communityId, createdAt: { $gte: since } }),
        Comment.countDocuments({ createdAt: { $gte: since }, postId: { $exists: true } }),
        ChannelMessage.countDocuments({ createdAt: { $gte: since }, channelId: { $exists: true } }),
        ChannelMessageComment.countDocuments({ createdAt: { $gte: since } }),
        User.countDocuments({ memberships: { $elemMatch: { communityId, joinedAt: { $gte: since } } } }),
    ]);

    const [activePostUsers, activeCommentUsers, activeMessageUsers, activeMessageCommentUsers] = await Promise.all([
        Post.distinct("authorId", { communityId, createdAt: { $gte: since } }),
        Comment.distinct("authorId", { createdAt: { $gte: since } }),
        ChannelMessage.distinct("senderId", { createdAt: { $gte: since } }),
        ChannelMessageComment.distinct("authorId", { createdAt: { $gte: since } }),
    ]);

    const activeMemberSet = new Set([
        ...activePostUsers.map(String),
        ...activeCommentUsers.map(String),
        ...activeMessageUsers.map(String),
        ...activeMessageCommentUsers.map(String),
    ]);

    const channel = await pickTargetChannel(communityId, channelId);
    if (!channel) return null;

    const bot = await ensureBotInCommunity(communityId);
    const content = buildWeeklyDigestMessage({
        communityName: community.name,
        stats: {
            posts,
            comments,
            messages,
            messageComments,
            activeMembers: activeMemberSet.size,
            newMembers,
        },
    });

    const message = await ChannelMessage.create({
        channelId: channel._id,
        senderId: bot._id,
        content,
        mediaURLs: [],
        mentions: [],
    });

    try {
        io.to(`channel:${channel._id}`).emit("channel:message", message);
    } catch {
        // ignore socket failures
    }

    await Community.findByIdAndUpdate(communityId, { $set: { "botMeta.lastDigestAt": new Date() } });
    return message;
};

const applyReputationRoles = async (community) => {
    let roleId = (community.roles || []).find((r) => r.name?.toLowerCase() === REPUTATION_ROLE_NAME)?._id;
    if (!roleId) {
        community.roles.push({
            name: REPUTATION_ROLE_NAME,
            permissions: {},
        });
        await community.save();
        roleId = community.roles.find((r) => r.name?.toLowerCase() === REPUTATION_ROLE_NAME)?._id;
    }
    if (!roleId) return;

    const memberIds = (community.members || []).map((id) => id.toString());
    if (!memberIds.length) return;

    const qualifiedProfiles = await Profile.find({
        userId: { $in: memberIds },
        reputation: { $gte: REPUTATION_ROLE_THRESHOLD },
    }).select("userId").lean();
    const qualifiedIds = new Set(qualifiedProfiles.map((p) => p.userId.toString()));
    const roleIdStr = roleId.toString();

    const users = await User.find({ _id: { $in: memberIds } });
    for (const user of users) {
        const membership = user.memberships.find((m) => m.communityId?.toString() === community._id.toString());
        if (!membership) continue;

        const hasRole = (membership.roles || []).map((r) => r.toString()).includes(roleIdStr);
        const shouldHaveRole = qualifiedIds.has(user._id.toString());
        if (shouldHaveRole && !hasRole) {
            membership.roles = [...(membership.roles || []), roleId];
            await user.save();
        } else if (!shouldHaveRole && hasRole) {
            membership.roles = (membership.roles || []).filter((r) => r.toString() !== roleIdStr);
            await user.save();
        }
    }
};

const processEventReminders = async (community) => {
    const now = Date.now();
    const maxWindowMs = 24 * 60 * 60 * 1000;
    const events = await Event.find({
        communityId: community._id,
        status: "scheduled",
        date: { $gte: new Date(now), $lte: new Date(now + maxWindowMs) },
    }).lean();

    if (!events.length) return;
    const channel = await pickTargetChannel(community._id);
    if (!channel) return;
    const bot = await ensureBotInCommunity(community._id);

    for (const event of events) {
        const startMs = new Date(event.startDate || event.date).getTime();
        const minsUntilStart = Math.max(0, Math.floor((startMs - now) / 60000));
        const updates = {};

        if (!event.botReminders?.d24h && minsUntilStart <= 24 * 60 && minsUntilStart > 60) {
            updates["botReminders.d24h"] = true;
        }
        if (!event.botReminders?.d1h && minsUntilStart <= 60 && minsUntilStart > 10) {
            updates["botReminders.d1h"] = true;
        }
        if (!event.botReminders?.d10m && minsUntilStart <= 10 && minsUntilStart >= 0) {
            updates["botReminders.d10m"] = true;
        }

        if (Object.keys(updates).length === 0) continue;

        const content = buildEventReminderMessage({ event, minutesUntilStart: minsUntilStart });
        const message = await ChannelMessage.create({
            channelId: channel._id,
            senderId: bot._id,
            content,
            mediaURLs: [],
            mentions: [],
        });

        await Event.findByIdAndUpdate(event._id, { $set: updates });

        try {
            io.to(`channel:${channel._id}`).emit("channel:message", message);
        } catch {
            // ignore socket failures
        }
    }
};

export const tryHandleBotCommand = async ({ communityId, channelId, content, senderId }) => {
    const commandsEnabled = String(process.env.LEADERBOARD_BOT_COMMANDS_ENABLED || "true").toLowerCase() !== "false";
    if (!commandsEnabled) return null;

    const trimmed = (content || "").trim();
    if (!trimmed.startsWith("/")) return null;

    const sender = await User.findById(senderId).select("isBot").lean();
    if (sender?.isBot) return null;

    const [command, ...args] = trimmed.split(/\s+/);
    const normalized = command.toLowerCase();

    if (normalized === "/leaderboard") {
        return handleRepTopCommand({ communityId, channelId });
    }

    if (normalized === "/digest") {
        const community = await Community.findById(communityId).select("_id name").lean();
        if (!community) return null;
        return postDigest({ community, channelId });
    }

    if (normalized === "/modlog") return handleModLogCommand({ communityId, channelId, senderId });
    if (normalized === "/event-remind") return handleEventRemindCommand({ communityId, channelId, args });
    if (normalized === "/welcome-setup") return handleWelcomeSetupCommand({ communityId, channelId });
    if (normalized === "/bestof") return handleBestOfCommand({ communityId, channelId });
    if (normalized === "/unanswered") return handleUnansweredCommand({ communityId, channelId });
    if (normalized === "/safety-status") return handleSafetyStatusCommand({ communityId, channelId });
    if (normalized === "/raid-mode") return handleRaidModeCommand({ communityId, channelId, senderId, args });
    if (normalized === "/faq") return handleFaqCommand({ communityId, channelId, args });
    if (normalized === "/poll") return handlePollCommand({ communityId, channelId, args });

    return null;
};

const runScheduledLeaderboardPost = async () => {
    const communities = await Community.find({ members: { $exists: true, $ne: [] } })
        .select("_id name members roles botMeta")
        .lean();

    for (const community of communities) {
        try {
            await postCommunityLeaderboard({
                communityId: community._id,
                reason: "scheduled",
            });
            const now = Date.now();
            const lastDigestAt = community.botMeta?.lastDigestAt ? new Date(community.botMeta.lastDigestAt).getTime() : 0;
            if (now - lastDigestAt >= DIGEST_INTERVAL_HOURS * 60 * 60 * 1000) {
                await postDigest({ community });
            }

            const fullCommunity = await Community.findById(community._id).select("_id members roles name");
            if (fullCommunity) {
                await applyReputationRoles(fullCommunity);
                await processEventReminders(fullCommunity);
            }
        } catch (error) {
            console.log("⚠️  Leaderboard bot post failed:", error.message || error);
        }
    }
};

export const startLeaderboardBotScheduler = async () => {
    const enabled = String(process.env.LEADERBOARD_BOT_ENABLED || "true").toLowerCase() !== "false";
    if (!enabled) return;

    await ensureLeaderboardBotUser();

    if (schedulerHandle) {
        clearInterval(schedulerHandle);
    }

    const intervalMs = BOT_INTERVAL_MINUTES * 60 * 1000;
    schedulerHandle = setInterval(() => {
        runScheduledLeaderboardPost().catch((error) => {
            console.log("⚠️  Leaderboard bot scheduler error:", error.message || error);
        });
    }, intervalMs);
    schedulerHandle.unref();

    console.log(`🤖 Leaderboard bot scheduler started (every ${BOT_INTERVAL_MINUTES} min)`);
};
