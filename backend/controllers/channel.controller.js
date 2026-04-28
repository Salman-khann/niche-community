import Channel from "../models/channel.model.js";
import Community from "../models/community.model.js";
import ChannelMessage from "../models/channelMessage.model.js";
import ChannelMessageComment from "../models/channelMessageComment.model.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import { resolveChannelPermissions, PERMISSIONS } from "../utils/permissionUtils.js";
import { logAction } from "../utils/auditUtils.js";

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

// ── Get all channels ────────────────────────────────────────────────────────
export const getChannels = async (req, res) => {
    try {
        const [channels, community, user] = await Promise.all([
            Channel.find({ communityId: req.communityId }).sort({ position: 1, createdAt: 1 }).lean(),
            Community.findById(req.communityId).select("categories roles owner").lean(),
            User.findById(req.userId).select("memberships").lean()
        ]);

        if (!community || !user) {
            return res.status(404).json({ success: false, message: "Community or User not found" });
        }

        // Filter channels based on VIEW_CHANNEL permission
        const visibleChannels = channels.filter(channel => {
            const perms = resolveChannelPermissions(user, community, channel);
            return perms[PERMISSIONS.VIEW_CHANNEL] !== false; 
            // In Discord, if it's not explicitly denied, it depends on base perms.
            // But here, if the function returns the merged object, we just check the key.
        });

        res.status(200).json({ success: true, channels: visibleChannels, categories: community?.categories || [] });
    } catch (error) {
        console.log("Error in getChannels:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Create channel (Admin/Moderator only) ───────────────────────────────────
export const createChannel = async (req, res) => {
    try {
        const rolePermissions = await resolveRolePermissions(req);
        const canCreateChannel =
            ["admin", "moderator"].includes(req.communityRole) ||
            rolePermissions.createChannels ||
            rolePermissions.manageChannels;
        if (!canCreateChannel) {
            return res.status(403).json({
                success: false,
                message: "Only admins or moderators can create channels",
            });
        }

        const { name, description, isPrivate, isPremium, type, categoryId } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Channel name is required",
            });
        }

        // Normalize: lowercase, trim, replace spaces with hyphens
        const normalizedName = name.trim().toLowerCase().replace(/\s+/g, "-");

        // Check for duplicates
        const existing = await Channel.findOne({
            communityId: req.communityId,
            name: normalizedName,
        });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: `Channel #${normalizedName} already exists`,
            });
        }

        const lastChannel = await Channel.findOne({ communityId: req.communityId, categoryId }).sort({ position: -1 }).select("position").lean();
        const position = lastChannel ? lastChannel.position + 1 : 0;

        const channel = await Channel.create({
            communityId: req.communityId,
            name: normalizedName,
            description: (description || "").trim(),
            type: ["text", "voice", "forum", "announcement"].includes(type) ? type : "text",
            isPrivate: isPrivate || false,
            isPremium: isPremium || false,
            categoryId: categoryId || null,
            position,
        });

        await logAction(req.communityId, req.userId, null, 'channel_create', `Created channel #${normalizedName}`, {
            channelId: channel._id,
            channelName: normalizedName,
            type: channel.type
        });

        res.status(201).json({
            success: true,
            message: "Channel created",
            channel,
        });
    } catch (error) {
        console.log("Error in createChannel:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Join channel (premium channels require premium tier middleware) ────────
export const joinChannel = async (req, res) => {
    try {
        const { id } = req.params;
        const [channel, community, user] = await Promise.all([
            req.targetChannel || Channel.findOne({ _id: id, communityId: req.communityId }).lean(),
            Community.findById(req.communityId).select("categories roles owner").lean(),
            User.findById(req.userId).select("memberships").lean()
        ]);

        if (!channel || !community || !user) {
            return res.status(404).json({
                success: false,
                message: "Channel, Community, or User not found",
            });
        }

        const perms = resolveChannelPermissions(user, community, channel);
        if (perms[PERMISSIONS.VIEW_CHANNEL] === false) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to view this channel",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Channel access granted",
            channel,
            permissions: perms, // Optionally send permissions to frontend
        });
    } catch (error) {
        console.log("Error in joinChannel:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Update channel name (Admin/Moderator or manageChannels) ─────────────────
export const updateChannel = async (req, res) => {
    try {
        const { id } = req.params;
        const rolePermissions = await resolveRolePermissions(req);
        const canManage =
            ["admin", "moderator"].includes(req.communityRole) ||
            rolePermissions.manageChannels;

        if (!canManage) {
            return res.status(403).json({
                success: false,
                message: "Only admins, moderators, or members with channel permissions can edit channels",
            });
        }

        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Channel name is required",
            });
        }

        const normalizedName = name.trim().toLowerCase().replace(/\s+/g, "-");

        const existing = await Channel.findOne({
            communityId: req.communityId,
            name: normalizedName,
            _id: { $ne: id },
        });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: `Channel #${normalizedName} already exists`,
            });
        }

        const channel = await Channel.findOneAndUpdate(
            { _id: id, communityId: req.communityId },
            { name: normalizedName },
            { new: true }
        );

        if (!channel) {
            return res.status(404).json({
                success: false,
                message: "Channel not found",
            });
        }

        await logAction(req.communityId, req.userId, null, 'channel_update', `Updated channel #${normalizedName}`, {
            channelId: channel._id,
            channelName: normalizedName
        });

        res.status(200).json({ success: true, channel });
    } catch (error) {
        console.log("Error in updateChannel:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Delete channel (Admin/Moderator or manageChannels) ──────────────────────
export const deleteChannel = async (req, res) => {
    try {
        const { id } = req.params;
        const rolePermissions = await resolveRolePermissions(req);
        const canManage =
            ["admin", "moderator"].includes(req.communityRole) ||
            rolePermissions.manageChannels;

        if (!canManage) {
            return res.status(403).json({
                success: false,
                message: "Only admins, moderators, or members with channel permissions can delete channels",
            });
        }

        const channel = await Channel.findOne({ _id: id, communityId: req.communityId }).lean();
        if (!channel) {
            return res.status(404).json({
                success: false,
                message: "Channel not found",
            });
        }

        const messageIds = await ChannelMessage.find({ channelId: id }).select("_id").lean();
        if (messageIds.length > 0) {
            await ChannelMessageComment.deleteMany({ messageId: { $in: messageIds.map((m) => m._id) } });
            await ChannelMessage.deleteMany({ channelId: id });
        }

        await Post.updateMany({ channelId: id }, { $set: { channelId: null } });
        await Channel.findByIdAndDelete(id);

        await logAction(req.communityId, req.userId, null, 'channel_delete', `Deleted channel #${channel.name}`, {
            channelId: id,
            channelName: channel.name
        });

        res.status(200).json({ success: true, message: "Channel deleted", channelId: id });
    } catch (error) {
        console.log("Error in deleteChannel:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Sync channel permissions ────────────────────────────────────────────────
export const syncChannelPermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const { sync } = req.body; // Boolean

        const rolePermissions = await resolveRolePermissions(req);
        const canManage = ["admin", "moderator"].includes(req.communityRole) || rolePermissions.manageChannels;
        if (!canManage) {
            return res.status(403).json({ success: false, message: "No permission" });
        }

        const channel = await Channel.findOneAndUpdate(
            { _id: id, communityId: req.communityId },
            { isSynced: !!sync },
            { new: true }
        );

        if (!channel) return res.status(404).json({ success: false, message: "Channel not found" });

        res.status(200).json({ success: true, channel });
    } catch (error) {
        console.log("Error in syncChannelPermissions:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Update channel overwrites ───────────────────────────────────────────────
export const updateChannelOverwrites = async (req, res) => {
    try {
        const { id } = req.params;
        const { overwrites } = req.body;

        const rolePermissions = await resolveRolePermissions(req);
        const canManage = ["admin", "moderator"].includes(req.communityRole) || rolePermissions.manageChannels;
        if (!canManage) {
            return res.status(403).json({ success: false, message: "No permission" });
        }

        const channel = await Channel.findOneAndUpdate(
            { _id: id, communityId: req.communityId },
            { 
                permissionOverwrites: overwrites,
                isSynced: false // Automatically unsync if overwrites are manually set? 
                // Discord does this if you change them while synced.
            },
            { new: true }
        );

        if (!channel) return res.status(404).json({ success: false, message: "Channel not found" });

        res.status(200).json({ success: true, channel });
    } catch (error) {
        console.log("Error in updateChannelOverwrites:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
