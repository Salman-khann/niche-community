import Post from "../models/post.model.js";
import Comment from "../models/thread.model.js";
import User from "../models/user.model.js";
import Profile from "../models/profile.model.js";
import AuditLog from "../models/auditLog.model.js";
import Community from "../models/community.model.js";
import Channel from "../models/channel.model.js";
import ChannelMessage from "../models/channelMessage.model.js";
import ChannelMessageComment from "../models/channelMessageComment.model.js";
import Notification from "../models/notification.model.js";
import { io } from "../socket.js";

// ── Helpers ──────────────────────────────────────────────────────────────────
const requireAdmin = (communityRole) => communityRole === 'admin';

const resolveRolePermissions = async (req) => {
    const roleIds = req.communityMembership?.roles || [];
    if (!roleIds.length) return {};
    const community = await Community.findById(req.communityId).select("roles").lean();
    if (!community) return {};
    const roleMap = new Map((community.roles || []).map((r) => [r._id.toString(), r.permissions || {}]));
    return roleIds.reduce((acc, roleId) => {
        const perms = roleMap.get(roleId?.toString?.() || String(roleId));
        if (!perms) return acc;
        Object.keys(perms).forEach((key) => {
            if (perms[key]) acc[key] = true;
        });
        return acc;
    }, {});
};

const hasModerationAccess = (communityRole, perms, key) =>
    ['admin', 'moderator'].includes(communityRole) || !!perms[key];

const REPORT_REASONS = [
    'Spam',
    'Harassment',
    'Hate Speech',
    'Scam',
    'Inappropriate Content',
    'Other',
];

const parseDuration = (dur) => {
    const map = { '24h': 24, '7d': 168, '30d': 720 };
    const hours = map[dur];
    if (!hours) throw new Error(`Invalid duration "${dur}". Use 24h, 7d, or 30d.`);
    return new Date(Date.now() + hours * 60 * 60 * 1000);
};

const logAction = (communityId, moderatorId, targetUserId, actionType, reason = '', metadata = {}) =>
    AuditLog.create({ communityId, moderatorId, targetUserId, actionType, reason, metadata });

// ── Flag Post (any authenticated user) ──────────────────────────────────────
export const flagPost = async (req, res) => {
    try {
        const { postId, reason } = req.body;
        if (!postId) return res.status(400).json({ success: false, message: "postId is required" });

        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ success: false, message: "Post not found" });

        if (post.flaggedBy.includes(req.userId)) {
            return res.status(400).json({ success: false, message: "You have already flagged this post" });
        }

        post.flaggedBy.push(req.userId);
        post.flagged = true;
        post.flaggedAt = new Date();
        if (reason) post.flagReason = reason;
        await post.save();

        res.status(200).json({
            success: true,
            message: "Post flagged successfully",
            post: { _id: post._id, flagged: post.flagged, flaggedAt: post.flaggedAt, flagCount: post.flaggedBy.length },
        });
    } catch (error) {
        console.log("Error in flagPost:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Get Moderation Queue (Admin / Mod, community-scoped) ─────────────────────
export const getModerationQueue = async (req, res) => {
    try {
        const perms = await resolveRolePermissions(req);
        if (!hasModerationAccess(req.communityRole, perms, 'moderateContent')) {
            return res.status(403).json({ success: false, message: "Admin or Moderator access required" });
        }

        const flaggedPosts = await Post.find({ flagged: true, communityId: req.communityId })
            .sort({ flaggedAt: -1 })
            .populate("authorId", "name email")
            .populate("flaggedBy", "name email")
            .lean();

        const authorIds = [...new Set(flaggedPosts.map((p) => p.authorId?._id?.toString()).filter(Boolean))];
        const profiles = await Profile.find({ userId: { $in: authorIds } }).lean();
        const profileMap = {};
        profiles.forEach((p) => { profileMap[p.userId.toString()] = p; });

        const enrichedPosts = flaggedPosts.map((post) => {
            const prof = profileMap[post.authorId?._id?.toString()];
            return {
                ...post,
                type: 'post',
                author: {
                    _id: post.authorId?._id,
                    name: post.authorId?.name,
                    email: post.authorId?.email,
                    avatar: prof?.avatar || "",
                    reputation: prof?.reputation || 0,
                },
                reporters: (post.flaggedBy || []).map((u) => ({
                    _id: u?._id,
                    name: u?.name,
                    email: u?.email,
                })),
                flagCount: post.flaggedBy?.length || 0,
            };
        });

        const channels = await Channel.find({ communityId: req.communityId }).select("_id name").lean();
        const channelIds = channels.map((c) => c._id);
        const channelMap = new Map(channels.map((c) => [c._id.toString(), c]));

        const flaggedMessages = await ChannelMessage.find({ flagged: true, channelId: { $in: channelIds } })
            .sort({ flaggedAt: -1 })
            .populate("senderId", "name email")
            .populate("flaggedBy", "name email")
            .lean();

        const messageAuthorIds = [...new Set(flaggedMessages.map((m) => m.senderId?._id?.toString()).filter(Boolean))];
        const messageProfiles = await Profile.find({ userId: { $in: messageAuthorIds } }).lean();
        const messageProfileMap = {};
        messageProfiles.forEach((p) => { messageProfileMap[p.userId.toString()] = p; });

        const enrichedMessages = flaggedMessages.map((msg) => {
            const prof = messageProfileMap[msg.senderId?._id?.toString()];
            const channel = channelMap.get(msg.channelId?.toString?.()) || null;
            const reporters = (msg.flaggedBy || []).map((u) => ({
                _id: u?._id,
                name: u?.name,
                email: u?.email,
            }));
            const flagReasons = msg.flagReasons?.length
                ? msg.flagReasons
                : (msg.flagReason ? [msg.flagReason] : []);
            return {
                _id: msg._id,
                type: 'message',
                content: msg.content,
                createdAt: msg.createdAt,
                flaggedAt: msg.flaggedAt || msg.createdAt,
                flagReason: msg.flagReason || '',
                flagReasons,
                flagSource: msg.flagSource || (reporters.length ? 'user' : 'auto'),
                flagCount: reporters.length,
                reporters,
                author: {
                    _id: msg.senderId?._id,
                    name: msg.senderId?.name,
                    email: msg.senderId?.email,
                    avatar: prof?.avatar || "",
                    reputation: prof?.reputation || 0,
                },
                channel: channel ? { _id: channel._id, name: channel.name } : null,
            };
        });

        const combined = [...enrichedPosts, ...enrichedMessages].sort((a, b) => {
            const aTime = new Date(a.flaggedAt || a.createdAt || 0).getTime();
            const bTime = new Date(b.flaggedAt || b.createdAt || 0).getTime();
            return bTime - aTime;
        });

        res.status(200).json({ success: true, queue: combined, total: combined.length });
    } catch (error) {
        console.log("Error in getModerationQueue:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Report Channel Message (any authenticated user) ────────────────────────
export const reportMessage = async (req, res) => {
    try {
        const { messageId, reason, details } = req.body;
        if (!messageId) return res.status(400).json({ success: false, message: "messageId is required" });
        if (!reason || !REPORT_REASONS.includes(reason)) {
            return res.status(400).json({ success: false, message: "Invalid report reason" });
        }

        const message = await ChannelMessage.findById(messageId);
        if (!message) return res.status(404).json({ success: false, message: "Message not found" });

        const channel = await Channel.findById(message.channelId).select("communityId name").lean();
        if (!channel || channel.communityId?.toString() !== req.communityId) {
            return res.status(403).json({ success: false, message: "Message does not belong to this community" });
        }

        if ((message.flaggedBy || []).some((id) => id.toString() === req.userId)) {
            return res.status(400).json({ success: false, message: "You have already reported this message" });
        }

        const finalReason = reason === 'Other' && details?.trim()
            ? `Other: ${details.trim()}`
            : reason;

        message.flaggedBy = [...(message.flaggedBy || []), req.userId];
        message.flagged = true;
        message.flaggedAt = new Date();
        message.flagReason = finalReason;
        const nextReasons = new Set(message.flagReasons || []);
        nextReasons.add(finalReason);
        message.flagReasons = Array.from(nextReasons);
        message.flagSource = message.flagSource === 'auto' ? 'mixed' : 'user';
        await message.save();

        try {
            const community = await Community.findById(req.communityId).select("name roles").lean();
            const reporter = await User.findById(req.userId).select("name").lean();
            const modRoleIds = (community?.roles || [])
                .filter((role) => role?.permissions?.moderateContent)
                .map((role) => role._id.toString());

            const roleFilter = [{ role: { $in: ['admin', 'moderator'] } }];
            if (modRoleIds.length) roleFilter.push({ roles: { $in: modRoleIds } });

            const moderators = await User.find({
                memberships: {
                    $elemMatch: {
                        communityId: req.communityId,
                        $or: roleFilter,
                    },
                },
            }).select("_id").lean();

            const uniqueIds = Array.from(new Set((moderators || []).map((m) => m._id?.toString?.() || String(m._id))));
            if (uniqueIds.length > 0) {
                const notifications = await Notification.insertMany(
                    uniqueIds.map((id) => ({
                        userId: id,
                        type: "moderator",
                        meta: {
                            action: "report_message",
                            communityId: req.communityId,
                            communityName: community?.name || "Server",
                            channelId: message.channelId,
                            channelName: channel?.name || "",
                            messageId: message._id,
                            messageSnippet: message.content?.slice(0, 120) || "",
                            reporterId: req.userId,
                            reporterName: reporter?.name || "Member",
                        },
                    }))
                );

                notifications.forEach((notif) => {
                    io.to(`user:${notif.userId}`).emit("new_notification", notif);
                });
            }
        } catch (notifErr) {
            console.log("⚠️  Failed to create report notifications:", notifErr);
        }

        res.status(200).json({
            success: true,
            message: "Message reported successfully",
            flagCount: message.flaggedBy.length,
            flaggedAt: message.flaggedAt,
        });
    } catch (error) {
        console.log("Error in reportMessage:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Dismiss / Resolve Flag (Admin / Mod) ─────────────────────────────────────
export const resolveFlag = async (req, res) => {
    try {
        const perms = await resolveRolePermissions(req);
        if (!hasModerationAccess(req.communityRole, perms, 'moderateContent')) {
            return res.status(403).json({ success: false, message: "Admin or Moderator access required" });
        }

        const { id } = req.params;
        if (id !== req.communityId) {
            // id here is postId, not communityId — skip the mismatch check
        }

        const post = await Post.findById(id);
        if (!post) return res.status(404).json({ success: false, message: "Post not found" });

        post.flagged = false;
        post.flaggedBy = [];
        post.flaggedAt = null;
        post.flagReason = "";
        await post.save();

        await logAction(req.communityId, req.userId, post.authorId, 'dismiss', 'Flag dismissed', { postId: id });

        res.status(200).json({ success: true, message: "Flag dismissed successfully", postId: post._id });
    } catch (error) {
        console.log("Error in resolveFlag:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Dismiss / Resolve Message Flag (Admin / Mod) ────────────────────────────
export const resolveMessageFlag = async (req, res) => {
    try {
        const perms = await resolveRolePermissions(req);
        if (!hasModerationAccess(req.communityRole, perms, 'moderateContent')) {
            return res.status(403).json({ success: false, message: "Admin or Moderator access required" });
        }

        const { id } = req.params;
        const message = await ChannelMessage.findById(id);
        if (!message) return res.status(404).json({ success: false, message: "Message not found" });

        const channel = await Channel.findById(message.channelId).select("communityId").lean();
        if (!channel || channel.communityId?.toString() !== req.communityId) {
            return res.status(403).json({ success: false, message: "Message does not belong to this community" });
        }

        message.flagged = false;
        message.flaggedBy = [];
        message.flaggedAt = null;
        message.flagReason = "";
        message.flagReasons = [];
        message.flagSource = "";
        await message.save();

        await logAction(req.communityId, req.userId, message.senderId, 'dismiss', 'Flag dismissed', {
            messageId: id,
        });

        res.status(200).json({ success: true, message: "Flag dismissed successfully", messageId: message._id });
    } catch (error) {
        console.log("Error in resolveMessageFlag:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Delete Post (Admin / Mod) ─────────────────────────────────────────────────
export const deletePost = async (req, res) => {
    try {
        const perms = await resolveRolePermissions(req);
        if (!hasModerationAccess(req.communityRole, perms, 'moderateContent')) {
            return res.status(403).json({ success: false, message: "Admin or Moderator access required" });
        }

        const { id } = req.params;
        const post = await Post.findById(id);
        if (!post) return res.status(404).json({ success: false, message: "Post not found" });

        await logAction(req.communityId, req.userId, post.authorId, 'delete_post', req.body.reason || '', {
            postId: id,
            postPreview: post.content?.slice(0, 120),
        });

        try {
            if (post.authorId?.toString?.() !== req.userId) {
                const notification = await Notification.create({
                    userId: post.authorId,
                    type: "moderator",
                    meta: {
                        action: "delete_post",
                        reason: req.body.reason || "",
                        communityId: req.communityId,
                        postId: id,
                    },
                });
                io.to(`user:${post.authorId}`).emit("new_notification", notification);
            }
        } catch (notifErr) {
            console.log("⚠️  Failed to create delete post notification:", notifErr);
        }

        await Comment.deleteMany({ postId: id });
        await Post.findByIdAndDelete(id);

        res.status(200).json({ success: true, message: "Post and associated comments deleted", postId: id });
    } catch (error) {
        console.log("Error in deletePost:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Delete Channel Message (Admin / Mod) ────────────────────────────────────
export const deleteMessage = async (req, res) => {
    try {
        const perms = await resolveRolePermissions(req);
        if (!hasModerationAccess(req.communityRole, perms, 'moderateContent')) {
            return res.status(403).json({ success: false, message: "Admin or Moderator access required" });
        }

        const { id } = req.params;
        const message = await ChannelMessage.findById(id);
        if (!message) return res.status(404).json({ success: false, message: "Message not found" });

        const channel = await Channel.findById(message.channelId).select("communityId").lean();
        if (!channel || channel.communityId?.toString() !== req.communityId) {
            return res.status(403).json({ success: false, message: "Message does not belong to this community" });
        }

        await logAction(req.communityId, req.userId, message.senderId, 'delete_message', req.body.reason || '', {
            messageId: id,
            channelId: message.channelId,
            messagePreview: message.content?.slice(0, 120),
        });

        try {
            if (message.senderId?.toString?.() !== req.userId) {
                const notification = await Notification.create({
                    userId: message.senderId,
                    type: "moderator",
                    meta: {
                        action: "delete_message",
                        reason: req.body.reason || "",
                        communityId: req.communityId,
                        channelId: message.channelId,
                        messageId: id,
                    },
                });
                io.to(`user:${message.senderId}`).emit("new_notification", notification);
            }
        } catch (notifErr) {
            console.log("⚠️  Failed to create delete message notification:", notifErr);
        }

        await ChannelMessageComment.deleteMany({ messageId: id });
        await ChannelMessage.findByIdAndDelete(id);

        res.status(200).json({ success: true, message: "Message deleted", messageId: id });
    } catch (error) {
        console.log("Error in deleteMessage:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Warn User (Admin / Mod) ───────────────────────────────────────────────────
export const warnUser = async (req, res) => {
    try {
        const perms = await resolveRolePermissions(req);
        if (!hasModerationAccess(req.communityRole, perms, 'warnMembers')) {
            return res.status(403).json({ success: false, message: "Admin or Moderator access required" });
        }

        const { userId } = req.params;
        const { reason = '' } = req.body;

        const target = await User.findById(userId);
        if (!target) return res.status(404).json({ success: false, message: "User not found" });

        const membership = target.memberships.find(
            (m) => m.communityId.toString() === req.communityId
        );
        if (!membership) return res.status(404).json({ success: false, message: "User is not a member of this community" });
        if (membership.role === 'admin') return res.status(403).json({ success: false, message: "Cannot warn an admin" });

        membership.warningsCount = (membership.warningsCount || 0) + 1;
        await target.save();

        await logAction(req.communityId, req.userId, userId, 'warn', reason, {
            warningsCount: membership.warningsCount,
        });

        try {
            const notification = await Notification.create({
                userId,
                type: "warning",
                meta: {
                    action: "warn",
                    reason,
                    communityId: req.communityId,
                },
            });
            io.to(`user:${userId}`).emit("new_notification", notification);
        } catch (notifErr) {
            console.log("⚠️  Failed to create warning notification:", notifErr);
        }

        res.status(200).json({
            success: true,
            message: `Warning issued. Total warnings: ${membership.warningsCount}`,
            userId,
            warningsCount: membership.warningsCount,
        });
    } catch (error) {
        console.log("Error in warnUser:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Suspend User (Admin / Mod) ────────────────────────────────────────────────
export const suspendUser = async (req, res) => {
    try {
        const perms = await resolveRolePermissions(req);
        if (!hasModerationAccess(req.communityRole, perms, 'suspendMembers')) {
            return res.status(403).json({ success: false, message: "Admin or Moderator access required" });
        }

        const { userId } = req.params;
        const { duration = '24h', reason = '' } = req.body;

        let suspensionEndDate;
        try {
            suspensionEndDate = parseDuration(duration);
        } catch (e) {
            return res.status(400).json({ success: false, message: e.message });
        }

        const target = await User.findById(userId);
        if (!target) return res.status(404).json({ success: false, message: "User not found" });

        const membership = target.memberships.find(
            (m) => m.communityId.toString() === req.communityId
        );
        if (!membership) return res.status(404).json({ success: false, message: "User is not a member of this community" });
        if (membership.role === 'admin') return res.status(403).json({ success: false, message: "Cannot suspend an admin" });

        membership.suspensionEndDate = suspensionEndDate;
        await target.save();

        await logAction(req.communityId, req.userId, userId, 'suspend', reason, {
            duration,
            suspensionEndDate,
        });

        try {
            const notification = await Notification.create({
                userId,
                type: "moderator",
                meta: {
                    action: "suspend",
                    reason,
                    duration,
                    communityId: req.communityId,
                    suspensionEndDate,
                },
            });
            io.to(`user:${userId}`).emit("new_notification", notification);
        } catch (notifErr) {
            console.log("⚠️  Failed to create suspension notification:", notifErr);
        }

        res.status(200).json({
            success: true,
            message: `User suspended for ${duration}`,
            userId,
            suspensionEndDate,
        });
    } catch (error) {
        console.log("Error in suspendUser:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Ban User (Admin only) ─────────────────────────────────────────────────────
export const banUser = async (req, res) => {
    try {
        const perms = await resolveRolePermissions(req);
        const canBan = req.communityRole === 'admin' || perms.banMembers;
        if (!canBan) {
            return res.status(403).json({ success: false, message: "Only admins can ban users" });
        }

        const { userId } = req.params;
        const { reason = '' } = req.body;

        const target = await User.findById(userId);
        if (!target) return res.status(404).json({ success: false, message: "User not found" });

        const membership = target.memberships.find(
            (m) => m.communityId.toString() === req.communityId
        );
        if (!membership) return res.status(404).json({ success: false, message: "User is not a member of this community" });
        if (membership.role === 'admin') return res.status(403).json({ success: false, message: "Cannot ban an admin" });

        membership.isBanned = true;
        membership.suspensionEndDate = null; // clear any active suspension
        await target.save();

        await logAction(req.communityId, req.userId, userId, 'ban', reason);

        res.status(200).json({ success: true, message: "User has been banned from this community", userId });
    } catch (error) {
        console.log("Error in banUser:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Add Blocklist Entry (Admin / Mod) ───────────────────────────────────────
export const addBlocklistEntry = async (req, res) => {
    try {
        const perms = await resolveRolePermissions(req);
        if (!hasModerationAccess(req.communityRole, perms, 'moderateContent')) {
            return res.status(403).json({ success: false, message: "Admin or Moderator access required" });
        }

        const { value, reason = '' } = req.body;
        const normalized = (value || '').trim().toLowerCase();
        if (!normalized) {
            return res.status(400).json({ success: false, message: "Blocklist value is required" });
        }

        const community = await Community.findById(req.communityId);
        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found" });
        }

        const already = (community.blocklist || []).some((item) => item.value === normalized);
        if (!already) {
            community.blocklist.push({ value: normalized, createdBy: req.userId });
            await community.save();
        }

        await logAction(req.communityId, req.userId, null, 'blocklist_add', reason, { value: normalized });

        res.status(200).json({
            success: true,
            message: already ? "Blocklist entry already exists" : "Blocklist entry added",
            value: normalized,
        });
    } catch (error) {
        console.log("Error in addBlocklistEntry:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Get Blocklist (Admin / Mod) ─────────────────────────────────────────────
export const getBlocklist = async (req, res) => {
    try {
        const perms = await resolveRolePermissions(req);
        if (!hasModerationAccess(req.communityRole, perms, 'moderateContent')) {
            return res.status(403).json({ success: false, message: "Admin or Moderator access required" });
        }

        const community = await Community.findById(req.communityId)
            .select("blocklist")
            .populate("blocklist.createdBy", "name email")
            .lean();
        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found" });
        }

        const blocklist = (community.blocklist || []).sort((a, b) => {
            const aTime = new Date(a.createdAt || 0).getTime();
            const bTime = new Date(b.createdAt || 0).getTime();
            return bTime - aTime;
        });

        res.status(200).json({ success: true, blocklist });
    } catch (error) {
        console.log("Error in getBlocklist:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Remove Blocklist Entry (Admin / Mod) ────────────────────────────────────
export const removeBlocklistEntry = async (req, res) => {
    try {
        const perms = await resolveRolePermissions(req);
        if (!hasModerationAccess(req.communityRole, perms, 'moderateContent')) {
            return res.status(403).json({ success: false, message: "Admin or Moderator access required" });
        }

        const { value, reason = '' } = req.body;
        const normalized = (value || '').trim().toLowerCase();
        if (!normalized) {
            return res.status(400).json({ success: false, message: "Blocklist value is required" });
        }

        const community = await Community.findById(req.communityId);
        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found" });
        }

        const originalCount = community.blocklist?.length || 0;
        community.blocklist = (community.blocklist || []).filter((item) => item.value !== normalized);
        if (community.blocklist.length === originalCount) {
            return res.status(404).json({ success: false, message: "Blocklist entry not found" });
        }

        await community.save();
        await logAction(req.communityId, req.userId, null, 'blocklist_remove', reason, { value: normalized });

        res.status(200).json({ success: true, message: "Blocklist entry removed", value: normalized });
    } catch (error) {
        console.log("Error in removeBlocklistEntry:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Get Audit Logs (Admin / Mod) ─────────────────────────────────────────────
export const getAuditLogs = async (req, res) => {
    try {
        const perms = await resolveRolePermissions(req);
        if (!hasModerationAccess(req.communityRole, perms, 'viewAuditLog')) {
            return res.status(403).json({ success: false, message: "Admin or Moderator access required" });
        }

        const logs = await AuditLog.find({ communityId: req.communityId })
            .sort({ createdAt: -1 })
            .limit(200)
            .populate('moderatorId', 'name email')
            .populate('targetUserId', 'name email')
            .lean();

        res.status(200).json({ success: true, logs, total: logs.length });
    } catch (error) {
        console.log("Error in getAuditLogs:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Unban User (Admin only) ──────────────────────────────────────────────────────────
export const unbanUser = async (req, res) => {
    try {
        const perms = await resolveRolePermissions(req);
        const canBan = req.communityRole === 'admin' || perms.banMembers;
        if (!canBan) {
            return res.status(403).json({ success: false, message: "Only admins can unban users" });
        }

        const { userId } = req.params;
        const target = await User.findById(userId);
        if (!target) return res.status(404).json({ success: false, message: "User not found" });

        const membership = target.memberships.find(
            (m) => m.communityId.toString() === req.communityId
        );
        if (!membership) return res.status(404).json({ success: false, message: "User is not a member of this community" });

        membership.isBanned = false;
        await target.save();

        await logAction(req.communityId, req.userId, userId, 'unban', 'Revoked ban');

        res.status(200).json({ success: true, message: "User has been unbanned from this community", userId });
    } catch (error) {
        console.log("Error in unbanUser:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
