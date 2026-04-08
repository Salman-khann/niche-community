import ChannelMessage from "../models/channelMessage.model.js";
import ChannelMessageComment from "../models/channelMessageComment.model.js";
import Channel from "../models/channel.model.js";
import User from "../models/user.model.js";
import Community from "../models/community.model.js";
import Notification from "../models/notification.model.js";
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

const SUSPICIOUS_TLDS = new Set(['zip', 'mov', 'xyz', 'top', 'gq', 'tk', 'ml', 'cf', 'ru']);
const SUSPICIOUS_DOMAINS = new Set(['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'cutt.ly', 'ow.ly', 'rb.gy']);

const extractUrls = (text = '') => {
    if (!text) return [];
    return text.match(/https?:\/\/[^\s<>()]+/gi) || [];
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
        const messages = await ChannelMessage.find({ channelId }).sort({ createdAt: 1 }).lean();
        res.status(200).json({ success: true, messages });
    } catch (error) {
        console.log("Error in getChannelMessages:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const createChannelMessage = async (req, res) => {
    try {
        const { channelId } = req.params;
        const { content, mediaURLs, mentions } = req.body;

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
        });

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

// ── React to a channel message (like toggle) ────────────────────────────────
export const reactToChannelMessage = async (req, res) => {
    try {
        const { channelId, messageId } = req.params;
        const userId = req.userId;

        const message = await ChannelMessage.findById(messageId);
        if (!message || message.channelId.toString() !== channelId) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        const alreadyLiked = message.likedBy.some((id) => id.toString() === userId);
        if (alreadyLiked) {
            message.likedBy.pull(userId);
            message.likesCount = Math.max(0, message.likesCount - 1);
        } else {
            message.likedBy.push(userId);
            message.likesCount += 1;
        }

        await message.save();

        if (message.senderId.toString() !== userId) {
            const likeMultiplier = alreadyLiked ? -1 : 1;
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

        const payload = {
            messageId: message._id,
            likesCount: message.likesCount,
            likedBy: message.likedBy,
            action: alreadyLiked ? "unlike" : "like",
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
        const message = await ChannelMessage.findById(messageId).lean();
        if (!message || message.channelId.toString() !== channelId) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        const comments = await ChannelMessageComment.find({ messageId })
            .sort({ createdAt: 1 })
            .populate("authorId", "name profileId")
            .lean();

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

        res.status(200).json({ success: true, comments: shaped });
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
