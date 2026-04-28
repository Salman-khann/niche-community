import ChannelMessage from "../models/channelMessage.model.js";
import ChannelMessageComment from "../models/channelMessageComment.model.js";
import Channel from "../models/channel.model.js";
import User from "../models/user.model.js";
import Profile from "../models/profile.model.js";
import Community from "../models/community.model.js";
import Notification from "../models/notification.model.js";
import mongoose from "mongoose";
import { io } from "../socket.js";
import { filterBadWords } from "../utils/badWords.js";
import { trackReputationSignal } from "../utils/reputationSignals.js";
import { tryHandleBotCommand } from "../utils/leaderboardBot.js";

const shapeCommentReactions = (comment, viewerUserId) => (
    (comment?.reactions || [])
        .map((entry) => {
            const users = entry?.users || [];
            return {
                emoji: entry.emoji,
                count: users.length,
                reacted: users.some((id) => id?.toString?.() === viewerUserId),
            };
        })
        .filter((entry) => entry.count > 0)
);

const HEART_EMOJI = '❤️';

const shapeMessageReactions = (message, viewerUserId) => (
    (message?.reactions || [])
        .map((entry) => {
            const users = entry?.users || [];
            return {
                emoji: entry.emoji,
                count: users.length,
                reacted: users.some((id) => id?.toString?.() === viewerUserId),
            };
        })
        .filter((entry) => entry.count > 0)
);

const SUSPICIOUS_TLDS = new Set(['zip', 'mov', 'xyz', 'top', 'gq', 'tk', 'ml', 'cf', 'ru']);
const SUSPICIOUS_DOMAINS = new Set(['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'cutt.ly', 'ow.ly', 'rb.gy']);

const extractUrls = (text = '') => {
    if (!text) return [];
    return text.match(/https?:\/\/[^\s<>()]+/gi) || [];
};

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const tokenizeSearch = (raw = '') => {
    const tokens = String(raw || '').match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    return tokens.map((token) => {
        if (token.startsWith('"') && token.endsWith('"')) {
            return token.slice(1, -1).trim();
        }
        return token.trim();
    }).filter(Boolean);
};

const parseDateToken = (value, type) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;

    const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (!dayOnly) return parsed;

    const [year, month, day] = value.split('-').map((v) => parseInt(v, 10));
    if (type === 'before') {
        return new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
    }
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
};

const parseMessageSearchQuery = (raw = '') => {
    const tokens = tokenizeSearch(raw);
    const parsed = {
        freeText: '',
        from: '',
        hasLink: false,
        hasFile: false,
        beforeDate: null,
        afterDate: null,
    };

    const freeTextChunks = [];
    for (const token of tokens) {
        const lowered = token.toLowerCase();
        if (lowered.startsWith('from:')) {
            parsed.from = token.slice(5).trim();
            continue;
        }
        if (lowered === 'has:link') {
            parsed.hasLink = true;
            continue;
        }
        if (lowered === 'has:file' || lowered === 'has:attachment') {
            parsed.hasFile = true;
            continue;
        }
        if (lowered.startsWith('before:')) {
            parsed.beforeDate = parseDateToken(token.slice(7).trim(), 'before');
            continue;
        }
        if (lowered.startsWith('after:')) {
            parsed.afterDate = parseDateToken(token.slice(6).trim(), 'after');
            continue;
        }
        freeTextChunks.push(token);
    }

    parsed.freeText = freeTextChunks.join(' ').trim();
    return parsed;
};

const isSuspiciousLink = (url) => {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        const parts = host.split('.');
        const tld = parts[parts.length - 1];
        if (SUSPICIOUS_DOMAINS.has(host)) return true;
        if (SUSPICIOUS_TLDS.has(tld)) return true;
        return false;
    } catch {
        return false;
    }
};

export const getChannelMessages = async (req, res) => {
    try {
        const { channelId } = req.params;
        const limit = Math.min(100, Math.max(10, parseInt(req.query.limit, 10) || 50));
        const before = req.query.before ? String(req.query.before) : null;

        const filter = { channelId };
        if (before) {
            if (!mongoose.Types.ObjectId.isValid(before)) {
                return res.status(400).json({ success: false, message: "Invalid pagination cursor" });
            }
            filter._id = { $lt: before };
        }

        // Query newest first for efficient cursor pagination, then reverse for UI order.
        const rows = await ChannelMessage.find(filter)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate({
                path: 'replyTo',
                select: 'content senderId',
                populate: { path: 'senderId', select: 'name profileId' }
            })
            .lean();

        const hasMore = rows.length > limit;
        const pageRows = hasMore ? rows.slice(0, limit) : rows;
        const messages = pageRows.reverse().map((row) => ({
            ...row,
            reactions: shapeMessageReactions(row, req.userId),
        }));
        const nextBefore = hasMore && messages.length > 0
            ? messages[0]._id?.toString?.() || String(messages[0]._id)
            : null;

        res.status(200).json({ success: true, messages, hasMore, nextBefore });
    } catch (error) {
        console.log("Error in getChannelMessages:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const searchChannelMessages = async (req, res) => {
    try {
        const { channelId } = req.params;
        const rawQuery = String(req.query.q || '').trim();
        const limit = Math.min(50, Math.max(5, parseInt(req.query.limit, 10) || 20));
        const beforeId = req.query.beforeId ? String(req.query.beforeId) : null;

        const parsed = parseMessageSearchQuery(rawQuery);
        const hasAnyFilter = Boolean(
            parsed.freeText || parsed.from || parsed.hasLink || parsed.hasFile || parsed.beforeDate || parsed.afterDate
        );

        if (!hasAnyFilter) {
            return res.status(400).json({
                success: false,
                message: 'Add a search term or filter (for example: from:name, has:link, before:2026-01-01)',
            });
        }

        if (parsed.freeText && parsed.freeText.length < 2) {
            return res.status(400).json({ success: false, message: 'Search text must be at least 2 characters' });
        }

        const filter = { channelId };

        if (beforeId) {
            if (!mongoose.Types.ObjectId.isValid(beforeId)) {
                return res.status(400).json({ success: false, message: 'Invalid search cursor' });
            }
            filter._id = { $lt: beforeId };
        }

        const andClauses = [];
        if (parsed.freeText) {
            andClauses.push({ content: { $regex: escapeRegex(parsed.freeText), $options: 'i' } });
        }

        if (parsed.hasLink) {
            andClauses.push({ content: { $regex: 'https?:\\/\\/', $options: 'i' } });
        }

        if (parsed.hasFile) {
            filter['mediaURLs.0'] = { $exists: true };
        }

        if (andClauses.length > 0) {
            filter.$and = andClauses;
        }

        if (parsed.beforeDate || parsed.afterDate) {
            filter.createdAt = {};
            if (parsed.beforeDate) filter.createdAt.$lt = parsed.beforeDate;
            if (parsed.afterDate) filter.createdAt.$gte = parsed.afterDate;
        }

        if (parsed.from) {
            const fromRegex = new RegExp(escapeRegex(parsed.from), 'i');
            const profileRows = await Profile.find({ displayName: fromRegex }).select('userId').lean();
            const profileUserIds = profileRows
                .map((row) => row?.userId)
                .filter(Boolean);

            const senderRows = await User.find({
                $or: [
                    { name: fromRegex },
                    { _id: { $in: profileUserIds } },
                ],
            }).select('_id').lean();

            const senderIds = senderRows.map((row) => row._id);
            if (senderIds.length === 0) {
                return res.status(200).json({
                    success: true,
                    results: [],
                    hasMore: false,
                    nextBeforeId: null,
                    parsed,
                });
            }
            filter.senderId = { $in: senderIds };
        }

        const rows = await ChannelMessage.find(filter)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate({
                path: 'senderId',
                select: 'name profileId',
                populate: { path: 'profileId', select: 'displayName avatar' },
            })
            .lean();

        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
        const nextBeforeId = hasMore && page.length > 0
            ? page[page.length - 1]._id?.toString?.() || String(page[page.length - 1]._id)
            : null;

        const results = page.map((row) => {
            const sender = row.senderId || {};
            const profile = sender.profileId || {};
            const content = row.content || '';
            const hasMedia = Array.isArray(row.mediaURLs) && row.mediaURLs.length > 0;
            return {
                _id: row._id,
                channelId: row.channelId,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                content,
                mediaURLs: row.mediaURLs || [],
                likesCount: row.likesCount || 0,
                commentsCount: row.commentsCount || 0,
                sender: {
                    _id: sender._id,
                    displayName: profile.displayName || sender.name || 'Member',
                    avatar: profile.avatar || '',
                },
                matchSummary: {
                    hasMedia,
                    hasLink: /https?:\/\//i.test(content),
                },
            };
        });

        res.status(200).json({
            success: true,
            results,
            hasMore,
            nextBeforeId,
            parsed,
        });
    } catch (error) {
        console.log('Error in searchChannelMessages:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const createChannelMessage = async (req, res) => {
    try {
        const { channelId } = req.params;
        const { content, mediaURLs, mentions, replyTo } = req.body;

        const channel = await Channel.findOne({ _id: channelId, communityId: req.communityId }).select("type").lean();
        if (!channel) {
            return res.status(404).json({ success: false, message: "Channel not found" });
        }
        if (channel.type === "announcement" && !["admin", "moderator"].includes(req.communityRole)) {
            return res.status(403).json({ success: false, message: "Only admins or moderators can post in announcements" });
        }

        if ((!content || !content.trim()) && (!mediaURLs || mediaURLs.length === 0)) {
            return res.status(400).json({ success: false, message: "Message or media required" });
        }

        const cleanedContent = filterBadWords(content?.trim() || "");

        const botMessage = await tryHandleBotCommand({
            communityId: req.communityId,
            channelId,
            content: cleanedContent,
            senderId: req.userId,
        });
        if (botMessage) {
            return res.status(200).json({
                success: true,
                message: botMessage,
                commandHandled: true,
            });
        }

        const message = await ChannelMessage.create({
            channelId,
            senderId: req.userId,
            content: cleanedContent,
            mediaURLs: mediaURLs || [],
            mentions: mentions || [],
            replyTo: replyTo || null,
        });

        // Populate sender for socket emission if needed, but the model doesn't embed it.
        // We'll populate replyTo if it exists for the client.
        if (message.replyTo) {
            await message.populate({
                path: 'replyTo',
                select: 'content senderId',
                populate: { path: 'senderId', select: 'name profileId' }
            });
        }

        await trackReputationSignal({
            userId: req.userId,
            communityId: req.communityId,
            signal: "message_sent",
        });

        const actor = await User.findById(req.userId).select("name").lean();
        const actorName = actor?.name || "Someone";
        const snippet = cleanedContent.trim().slice(0, 120);

        // ── Mention notifications (channel messages) ──────────────────────
        if (Array.isArray(mentions) && mentions.length > 0) {
            const uniqueMentions = [...new Set(mentions.map((id) => id?.toString?.() || String(id)))];
            for (const mentionedUserId of uniqueMentions) {
                if (!mentionedUserId || mentionedUserId === req.userId) continue;
                try {
                    const notification = await Notification.create({
                        userId: mentionedUserId,
                        type: "mention",
                        meta: {
                            communityId: req.communityId,
                            channelId,
                            messageId: message._id,
                            mentionerName: actorName,
                            messageSnippet: snippet,
                        },
                    });
                    io.to(`user:${mentionedUserId}`).emit("new_notification", notification);
                } catch (notifErr) {
                    console.log("⚠️  Failed to create channel mention notification:", notifErr);
                }
            }
        }

        // ── Announcement notifications (broadcast) ────────────────────────
        if (channel.type === "announcement") {
            try {
                const community = await Community.findById(req.communityId)
                    .select("members name")
                    .lean();
                const memberIds = (community?.members || [])
                    .map((id) => id?.toString?.() || String(id))
                    .filter((id) => id && id !== req.userId);

                for (const memberId of memberIds) {
                    try {
                        const notification = await Notification.create({
                            userId: memberId,
                            type: "admin",
                            meta: {
                                communityId: req.communityId,
                                communityName: community?.name || "",
                                channelId,
                                messageId: message._id,
                                senderName: actorName,
                                messageSnippet: snippet,
                            },
                        });
                        io.to(`user:${memberId}`).emit("new_notification", notification);
                    } catch (notifErr) {
                        console.log("⚠️  Failed to create announcement notification:", notifErr);
                    }
                }
            } catch (notifErr) {
                console.log("⚠️  Failed to broadcast announcement notifications:", notifErr);
            }
        }

        const flagReasons = [];
        const mentionCount = (mentions || []).length;
        if (mentionCount >= 5) {
            flagReasons.push('Excessive mentions');
        }

        const urls = extractUrls(cleanedContent);
        if (urls.some((url) => isSuspiciousLink(url))) {
            flagReasons.push('Suspicious links');
        }

        if (cleanedContent) {
            const community = await Community.findById(req.communityId).select("blocklist").lean();
            const blocklist = community?.blocklist || [];
            const lower = cleanedContent.toLowerCase();
            const match = blocklist.find((item) => item?.value && lower.includes(item.value));
            if (match?.value) {
                flagReasons.push(`Blocklist match: ${match.value}`);
            }
        }

        if (flagReasons.length > 0) {
            message.flagged = true;
            message.flaggedAt = new Date();
            message.flagReasons = flagReasons;
            message.flagReason = flagReasons.join(', ');
            message.flagSource = 'auto';
            await message.save();
        }

        res.status(201).json({ success: true, message });

        try {
            io.to(`channel:${channelId}`).emit("channel:message", message);
        } catch { }
    } catch (error) {
        console.log("Error in createChannelMessage:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── React to a channel message (emoji toggle) ───────────────────────────────
export const reactToChannelMessage = async (req, res) => {
    try {
        const { channelId, messageId } = req.params;
        const { emoji } = req.body || {};
        const userId = req.userId;
        const normalizedEmoji = (typeof emoji === 'string' && emoji.trim()) ? emoji.trim().slice(0, 16) : HEART_EMOJI;

        const message = await ChannelMessage.findById(messageId);
        if (!message || message.channelId.toString() !== channelId) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        if (!Array.isArray(message.reactions)) {
            message.reactions = [];
        }

        // Backfill legacy likes into heart reactions once for older messages.
        if ((message.likedBy || []).length > 0) {
            const hasHeart = message.reactions.some((entry) => entry.emoji === HEART_EMOJI);
            if (!hasHeart) {
                message.reactions.push({ emoji: HEART_EMOJI, users: [...message.likedBy] });
            }
        }

        const existing = message.reactions.find((entry) => entry.emoji === normalizedEmoji);
        let reacted = false;
        if (!existing) {
            message.reactions.push({ emoji: normalizedEmoji, users: [userId] });
            reacted = true;
        } else {
            const alreadyReacted = existing.users.some((id) => id.toString() === userId);
            if (alreadyReacted) {
                existing.users = existing.users.filter((id) => id.toString() !== userId);
                reacted = false;
            } else {
                existing.users.push(userId);
                reacted = true;
            }
            message.reactions = message.reactions.filter((entry) => (entry.users || []).length > 0);
        }

        const heartReaction = message.reactions.find((entry) => entry.emoji === HEART_EMOJI);
        const heartUsers = heartReaction?.users || [];
        message.likedBy = heartUsers;
        message.likesCount = heartUsers.length;

        await message.save();

        if (message.senderId.toString() !== userId) {
            const likeMultiplier = reacted ? 1 : -1;
            await trackReputationSignal({
                userId: message.senderId,
                communityId: req.communityId,
                signal: "message_like_received",
                multiplier: likeMultiplier,
            });
            await trackReputationSignal({
                userId,
                communityId: req.communityId,
                signal: "message_like_given",
                multiplier: likeMultiplier,
            });
        }

        const reactions = shapeMessageReactions(message.toObject(), userId);

        const payload = {
            messageId: message._id,
            emoji: normalizedEmoji,
            reacted,
            reactions,
            likesCount: message.likesCount,
            likedBy: message.likedBy,
            action: reacted ? "react" : "unreact",
        };

        res.status(200).json({ success: true, ...payload });

        try {
            const { io } = await import("../socket.js");
            io.to(`channel:${channelId}`).emit("channel:reaction", payload);
        } catch { }
    } catch (error) {
        console.log("Error in reactToChannelMessage:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Get comments for a channel message ──────────────────────────────────────
export const getChannelMessageComments = async (req, res) => {
    try {
        const { channelId, messageId } = req.params;
        const limit = Math.min(100, Math.max(10, parseInt(req.query.limit, 10) || 50));
        const before = req.query.before ? String(req.query.before) : null;
        const message = await ChannelMessage.findById(messageId).lean();
        if (!message || message.channelId.toString() !== channelId) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        const filter = { messageId };
        if (before) {
            if (!mongoose.Types.ObjectId.isValid(before)) {
                return res.status(400).json({ success: false, message: "Invalid pagination cursor" });
            }
            filter._id = { $lt: before };
        }

        const rows = await ChannelMessageComment.find(filter)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate("authorId", "name profileId")
            .lean();

        const hasMore = rows.length > limit;
        const pageRows = hasMore ? rows.slice(0, limit) : rows;
        const comments = pageRows.reverse();
        const nextBefore = hasMore && comments.length > 0
            ? comments[0]._id?.toString?.() || String(comments[0]._id)
            : null;

        const shaped = comments.map((c) => ({
            _id: c._id,
            content: c.content,
            createdAt: c.createdAt,
            reactions: shapeCommentReactions(c, req.userId),
            author: {
                _id: c.authorId?._id,
                displayName: c.authorId?.profileId?.displayName || c.authorId?.name || "Member",
                avatar: c.authorId?.profileId?.avatar || "",
            },
        }));

        res.status(200).json({ success: true, comments: shaped, hasMore, nextBefore });
    } catch (error) {
        console.log("Error in getChannelMessageComments:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Add comment to channel message ──────────────────────────────────────────
export const addChannelMessageComment = async (req, res) => {
    try {
        const { channelId, messageId } = req.params;
        const { content, mentions } = req.body;

        const channel = await Channel.findOne({ _id: channelId, communityId: req.communityId }).select("type").lean();
        if (!channel) {
            return res.status(404).json({ success: false, message: "Channel not found" });
        }
        if (channel.type === "announcement" && !["admin", "moderator"].includes(req.communityRole)) {
            return res.status(403).json({ success: false, message: "Only admins or moderators can comment in announcements" });
        }

        if (!content || !content.trim()) {
            return res.status(400).json({ success: false, message: "Comment content is required" });
        }

        const message = await ChannelMessage.findById(messageId);
        if (!message || message.channelId.toString() !== channelId) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        const comment = await ChannelMessageComment.create({
            messageId,
            authorId: req.userId,
            content: filterBadWords(content.trim()),
            mentions: mentions || [],
        });

        await trackReputationSignal({
            userId: req.userId,
            communityId: req.communityId,
            signal: "message_comment_created",
        });

        message.commentsCount += 1;
        await message.save();

        const author = await User.findById(req.userId).populate("profileId", "displayName avatar").lean();
        const shapedComment = {
            _id: comment._id,
            content: comment.content,
            createdAt: comment.createdAt,
            reactions: [],
            author: {
                _id: author?._id,
                displayName: author?.profileId?.displayName || author?.name || "Member",
                avatar: author?.profileId?.avatar || "",
            },
        };

        const commenterName = author?.name || author?.profileId?.displayName || "Someone";
        const commentSnippet = comment.content.trim().slice(0, 120);

        // ── Reply notification (comment on message) ────────────────────────
        if (message.senderId?.toString() !== req.userId) {
            await trackReputationSignal({
                userId: message.senderId,
                communityId: req.communityId,
                signal: "message_reply_received",
            });
            try {
                const notification = await Notification.create({
                    userId: message.senderId,
                    type: "reply",
                    meta: {
                        communityId: req.communityId,
                        channelId,
                        messageId,
                        commentId: comment._id,
                        commenterName,
                        commentSnippet,
                    },
                });
                io.to(`user:${message.senderId}`).emit("new_notification", notification);
            } catch (notifErr) {
                console.log("⚠️  Failed to create reply notification:", notifErr);
            }
        }

        // ── Mention notifications in comments ─────────────────────────────
        if (Array.isArray(mentions) && mentions.length > 0) {
            const uniqueMentions = [...new Set(mentions.map((id) => id?.toString?.() || String(id)))];
            for (const mentionedUserId of uniqueMentions) {
                if (!mentionedUserId || mentionedUserId === req.userId) continue;
                if (mentionedUserId === message.senderId?.toString()) continue; // already notified via reply
                try {
                    const notification = await Notification.create({
                        userId: mentionedUserId,
                        type: "mention",
                        meta: {
                            communityId: req.communityId,
                            channelId,
                            messageId,
                            commentId: comment._id,
                            mentionerName: commenterName,
                            messageSnippet: commentSnippet,
                        },
                    });
                    io.to(`user:${mentionedUserId}`).emit("new_notification", notification);
                } catch (notifErr) {
                    console.log("⚠️  Failed to create comment mention notification:", notifErr);
                }
            }
        }

        res.status(201).json({ success: true, comment: shapedComment, commentsCount: message.commentsCount });

        try {
            io.to(`channel:${channelId}`).emit("channel:comment", {
                messageId,
                comment: shapedComment,
                commentsCount: message.commentsCount,
            });
        } catch { }
    } catch (error) {
        console.log("Error in addChannelMessageComment:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Toggle reaction on channel message comment ─────────────────────────────
export const reactToChannelMessageComment = async (req, res) => {
    try {
        const { channelId, messageId, commentId } = req.params;
        const { emoji } = req.body || {};
        const userId = req.userId;

        if (!emoji || typeof emoji !== "string" || emoji.trim().length === 0) {
            return res.status(400).json({ success: false, message: "Emoji is required" });
        }

        const normalizedEmoji = emoji.trim().slice(0, 16);

        const message = await ChannelMessage.findById(messageId).lean();
        if (!message || message.channelId.toString() !== channelId) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        const comment = await ChannelMessageComment.findOne({ _id: commentId, messageId });
        if (!comment) {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }

        const existing = comment.reactions.find((entry) => entry.emoji === normalizedEmoji);
        let reacted = false;

        if (!existing) {
            comment.reactions.push({ emoji: normalizedEmoji, users: [userId] });
            reacted = true;
        } else {
            const alreadyReacted = existing.users.some((id) => id.toString() === userId);
            if (alreadyReacted) {
                existing.users = existing.users.filter((id) => id.toString() !== userId);
                reacted = false;
            } else {
                existing.users.push(userId);
                reacted = true;
            }
            comment.reactions = comment.reactions.filter((entry) => (entry.users || []).length > 0);
        }

        await comment.save();

        const reactions = shapeCommentReactions(comment.toObject(), userId);

        const payload = {
            messageId,
            commentId: comment._id,
            emoji: normalizedEmoji,
            reacted,
            reactions,
        };

        io.to(`channel:${channelId}`).emit("channel:comment-reaction", payload);
        return res.status(200).json({ success: true, ...payload });
    } catch (error) {
        console.log("Error in reactToChannelMessageComment:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Toggle pin for a message ────────────────────────────────────────────────
export const togglePin = async (req, res) => {
    try {
        const { channelId, messageId } = req.params;
        const userId = req.userId;

        const message = await ChannelMessage.findById(messageId);
        if (!message || message.channelId.toString() !== channelId) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        const alreadyPinned = message.pinnedBy?.some((id) => id.toString() === userId);
        if (alreadyPinned) {
            message.pinnedBy.pull(userId);
        } else {
            message.pinnedBy.push(userId);
        }
        await message.save();

        const payload = {
            messageId: message._id,
            pinnedBy: message.pinnedBy || [],
            action: alreadyPinned ? 'unpin' : 'pin',
        };

        res.status(200).json({ success: true, ...payload });

        try {
            const { io } = await import("../socket.js");
            io.to(`channel:${channelId}`).emit("channel:pin", payload);
        } catch { }
    } catch (error) {
        console.log("Error in togglePin:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Get pinned messages for a channel ───────────────────────────────────────
export const getPinnedMessages = async (req, res) => {
    try {
        const { channelId } = req.params;
        const messages = await ChannelMessage.find({
            channelId,
            pinnedBy: { $exists: true, $ne: [] },
        }).sort({ updatedAt: -1 }).lean();

        res.status(200).json({ success: true, messages });
    } catch (error) {
        console.log("Error in getPinnedMessages:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
export const editChannelMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { content } = req.body;

        const message = await ChannelMessage.findById(messageId);
        if (!message) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        // Enforcement: 15-minute edit limit
        const EDIT_LIMIT_MS = 15 * 60 * 1000;
        const timeElapsed = Date.now() - new Date(message.createdAt).getTime();
        if (timeElapsed > EDIT_LIMIT_MS) {
            return res.status(403).json({ success: false, message: "You can no longer edit this message (15 minute limit reached)" });
        }

        if (message.senderId.toString() !== req.userId) {
            return res.status(403).json({ success: false, message: "Not authorized to edit this message" });
        }

        const cleanedContent = filterBadWords(content?.trim() || "");
        if (!cleanedContent) {
            return res.status(400).json({ success: false, message: "Content cannot be empty" });
        }

        message.content = cleanedContent;
        message.isEdited = true;
        await message.save();

        // Populate for client
        if (message.replyTo) {
            await message.populate({
                path: 'replyTo',
                select: 'content senderId',
                populate: { path: 'senderId', select: 'name profileId' }
            });
        }

        res.status(200).json({ success: true, message });
        io.to(`channel:${message.channelId}`).emit("channel:message_edited", message);
    } catch (error) {
        console.log("Error in editChannelMessage:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const deleteChannelMessage = async (req, res) => {
    try {
        const { channelId, messageId } = req.params;
        const message = await ChannelMessage.findById(messageId);
        
        if (!message || message.channelId.toString() !== channelId) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        // Check permission: Is owner or is admin/moderator
        const isOwner = message.senderId.toString() === req.userId;
        const isAdminMod = ["admin", "moderator"].includes(req.communityRole);

        if (!isOwner && !isAdminMod) {
            return res.status(403).json({ success: false, message: "You do not have permission to delete this message" });
        }

        await ChannelMessage.findByIdAndDelete(messageId);
        
        // Also delete any comments associated with this message
        await ChannelMessageComment.deleteMany({ messageId });

        res.status(200).json({ success: true, message: "Message deleted successfully" });

        try {
            io.to(`channel:${channelId}`).emit("channel:message-deleted", { messageId });
        } catch { }
    } catch (error) {
        console.log("Error in deleteChannelMessage:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
