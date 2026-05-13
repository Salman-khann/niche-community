import crypto from "crypto";
import Community from "../models/community.model.js";
import User from "../models/user.model.js";
import Profile from "../models/profile.model.js";
import Channel from "../models/channel.model.js";
import ChannelMessage from "../models/channelMessage.model.js";
import ChannelMessageComment from "../models/channelMessageComment.model.js";
import Event from "../models/event.model.js";
import Post from "../models/post.model.js";
import Comment from "../models/thread.model.js";
import AuditLog from "../models/auditLog.model.js";
import InviteRequest from "../models/inviteRequest.model.js";
import Notification from "../models/notification.model.js";
import { io } from "../socket.js";
import { sendInviteEmail } from "../mailtrap/emails.js";
import { logAction } from "../utils/auditUtils.js";

// ── Helper: generate CIRCLE-XXXX-XXXX code ──────────────────────────────────
const generateCode = () => {
    const seg = () => crypto.randomBytes(2).toString("hex").toUpperCase();
    return `CIRCLE-${seg()}-${seg()}`;
};

// ── GET /communities/mine ────────────────────────────────────────────────────
export const getMyCommunity = async (req, res) => {
    try {
        const community = await Community.findOne({ owner: req.userId });
        if (!community) {
            return res.status(404).json({ success: false, message: "You don't own any community yet" });
        }
        res.status(200).json({ success: true, community });
    } catch (error) {
        console.log("Error in getMyCommunity:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── GET /communities/mine-all ─────────────────────────────────────────────────
export const getMyCommunities = async (req, res) => {
    try {
        const communities = await Community.find({ owner: req.userId }).select('name slug description members communityScore').lean();
        res.status(200).json({ success: true, communities });
    } catch (error) {
        console.log("Error in getMyCommunities:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── GET /communities/all ─────────────────────────────────────────────────────
export const getAllCommunities = async (req, res) => {
    try {
        const communities = await Community.find({})
            .select('name slug description icon bannerColor traits profileDescription kind template members communityScore')
            .lean();

        const payload = (communities || []).map((c) => ({
            _id: c._id,
            name: c.name,
            slug: c.slug,
            description: c.description || c.profileDescription || '',
            icon: c.icon || '',
            bannerColor: c.bannerColor || '',
            traits: c.traits || [],
            kind: c.kind,
            template: c.template,
            communityScore: c.communityScore || 0,
            membersCount: Array.isArray(c.members) ? c.members.length : 0,
        }));

        res.status(200).json({ success: true, communities: payload });
    } catch (error) {
        console.log("Error in getAllCommunities:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── POST /communities/:id/invite-requests ───────────────────────────────────
export const createInviteRequest = async (req, res) => {
    const { id } = req.params;
    const { message } = req.body;

    try {
        const community = await Community.findById(id).select("name").lean();
        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found" });
        }

        const user = await User.findById(req.userId).select("name email memberships").lean();
        if (!user) {
            return res.status(401).json({ success: false, message: "User not found" });
        }

        const alreadyMember = (user.memberships || []).some(
            (m) => m.communityId?.toString?.() === id.toString()
        );
        if (alreadyMember) {
            return res.status(400).json({ success: false, message: "You're already a member of this community" });
        }

        const existing = await InviteRequest.findOne({
            communityId: id,
            requesterId: user._id,
            status: "pending",
        });
        if (existing) {
            return res.status(409).json({ success: false, message: "Invite request already submitted" });
        }

        const request = await InviteRequest.create({
            communityId: id,
            requesterId: user._id,
            requesterName: user.name || "Member",
            requesterEmail: user.email,
            message: (message || "").trim(),
        });

        // Notify admins
        const admins = await User.find({
            "memberships.communityId": id,
            "memberships.role": "admin",
        }).select("_id name").lean();

        if (admins.length > 0) {
            await Promise.all(admins.map(async (admin) => {
                const notification = await Notification.create({
                    userId: admin._id,
                    type: "admin",
                    meta: {
                        action: "invite_request",
                        communityId: id,
                        communityName: community.name,
                        requesterName: user.name || "Member",
                        requesterEmail: user.email,
                        requestId: request._id,
                    },
                });
                io.to(`user:${admin._id}`).emit("new_notification", notification);
            }));
        }

        res.status(201).json({ success: true, request });
    } catch (error) {
        console.log("Error in createInviteRequest:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── GET /communities/:id/invite-requests ────────────────────────────────────
export const getInviteRequests = async (req, res) => {
    const { id } = req.params;

    try {
        if (id !== req.communityId) {
            return res.status(403).json({ success: false, message: "Community ID mismatch" });
        }

        if (req.communityRole !== "admin") {
            return res.status(403).json({ success: false, message: "Only admins can view invite requests" });
        }

        const requests = await InviteRequest.find({ communityId: id })
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({ success: true, requests });
    } catch (error) {
        console.log("Error in getInviteRequests:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── POST /communities/:id/invite-requests/:requestId/approve ─────────────────
export const approveInviteRequest = async (req, res) => {
    const { id, requestId } = req.params;

    try {
        if (id !== req.communityId) {
            return res.status(403).json({ success: false, message: "Community ID mismatch" });
        }

        if (req.communityRole !== "admin") {
            return res.status(403).json({ success: false, message: "Only admins can approve invite requests" });
        }

        const request = await InviteRequest.findOne({ _id: requestId, communityId: id });
        if (!request) {
            return res.status(404).json({ success: false, message: "Invite request not found" });
        }
        if (request.status !== "pending") {
            return res.status(400).json({ success: false, message: "Invite request already resolved" });
        }

        const community = await Community.findById(id);
        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found" });
        }

        const requester = await User.findById(request.requesterId);
        if (!requester) {
            return res.status(404).json({ success: false, message: "Requester not found" });
        }

        const alreadyMember = (requester.memberships || []).some(
            (m) => m.communityId?.toString?.() === id.toString()
        );

        const code = generateCode();
        community.inviteCodes.push({
            code,
            isUsed: false,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        if (!alreadyMember) {
            community.members.addToSet(requester._id);
        }
        await community.save();

        request.status = "approved";
        request.respondedBy = req.userId;
        request.respondedAt = new Date();
        request.inviteCode = code;
        await request.save();

        if (!alreadyMember) {
            requester.memberships.push({ communityId: community._id, role: "member" });
            await requester.save();
        }

        let emailSent = false;
        try {
            await sendInviteEmail(request.requesterEmail, community.name, code);
            emailSent = true;
        } catch (emailErr) {
            console.log("Email send failed (invite approved):", emailErr);
        }

        // Notify requester + push realtime membership update
        try {
            const notification = await Notification.create({
                userId: requester._id,
                type: "admin",
                meta: {
                    action: "invite_approved",
                    communityId: community._id,
                    communityName: community.name,
                    inviteCode: code,
                },
            });
            io.to(`user:${requester._id}`).emit("new_notification", notification);
        } catch (notifErr) {
            console.log("⚠️  Failed to create invite approval notification:", notifErr);
        }

        io.to(`user:${requester._id}`).emit("community:member_added", {
            community: {
                _id: community._id,
                name: community.name,
                slug: community.slug,
                icon: community.icon || "",
            },
            role: "member",
        });

        res.status(200).json({ success: true, request, emailSent });
    } catch (error) {
        console.log("Error in approveInviteRequest:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── POST /communities/:id/invite-requests/:requestId/reject ──────────────────
export const rejectInviteRequest = async (req, res) => {
    const { id, requestId } = req.params;

    try {
        if (id !== req.communityId) {
            return res.status(403).json({ success: false, message: "Community ID mismatch" });
        }

        if (req.communityRole !== "admin") {
            return res.status(403).json({ success: false, message: "Only admins can reject invite requests" });
        }

        const request = await InviteRequest.findOne({ _id: requestId, communityId: id });
        if (!request) {
            return res.status(404).json({ success: false, message: "Invite request not found" });
        }
        if (request.status !== "pending") {
            return res.status(400).json({ success: false, message: "Invite request already resolved" });
        }

        request.status = "rejected";
        request.respondedBy = req.userId;
        request.respondedAt = new Date();
        await request.save();

        res.status(200).json({ success: true, request });
    } catch (error) {
        console.log("Error in rejectInviteRequest:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── POST /communities ────────────────────────────────────────────────────────
export const createCommunity = async (req, res) => {
    const { name, description, icon, kind, template } = req.body;

    try {
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: "Community name is required" });
        }

        // Auto-generate slug from name
        const slug =
            req.body.slug?.trim() ||
            name
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "");

        // Check slug uniqueness
        const existing = await Community.findOne({ slug });
        if (existing) {
            return res.status(400).json({ success: false, message: "A community with this slug already exists" });
        }

        const normalizedDescription = description?.trim() || "";
        const normalizedTemplate = (template || "custom").toLowerCase();
        const normalizedKind = ["friends", "community"].includes(kind) ? kind : "community";

        const community = await Community.create({
            name: name.trim(),
            slug,
            description: normalizedDescription,
            profileDescription: normalizedDescription,
            icon: icon || "",
            kind: normalizedKind,
            template: template || "custom",
            owner: req.userId,
            members: [req.userId],
            categories: [
                { name: "TEXT CHANNELS", position: 0 },
                { name: "VOICE CHANNELS", position: 1 }
            ],
        });

        // Promote user to admin & grant invite-verified access + membership
        await User.findByIdAndUpdate(req.userId, {
            role: "admin",
            isInviteVerified: true,
            $push: { memberships: { communityId: community._id, role: "admin" } },
        });

        // Fetch updated user to return
        const updatedUser = await User.findById(req.userId)
            .select("-password")
            .populate("memberships.communityId", "name slug icon");

        const textCategoryId = community.categories[0]._id;
        const voiceCategoryId = community.categories[1]._id;

        const templateChannels = {
            gaming: [
                { name: "lobby", description: "General game chat", type: "text", categoryId: textCategoryId },
                { name: "lfg", description: "Find teammates and squads", type: "text", categoryId: textCategoryId },
                { name: "1v1-text", description: "Challenge and setup duels", type: "text", categoryId: textCategoryId },
                { name: "highlights", description: "Clips, wins, and hype", type: "text", categoryId: textCategoryId },
                { name: "general-voice", description: "Main voice channel", type: "voice", categoryId: voiceCategoryId },
                { name: "1v1-voice", description: "Duel voice channel", type: "voice", categoryId: voiceCategoryId },
                { name: "squad-voice", description: "Team voice channel", type: "voice", categoryId: voiceCategoryId },
            ],
            friends: [
                { name: "hangout", description: "Daily chat and updates", type: "text", categoryId: textCategoryId },
                { name: "memes", description: "Share memes and laughs", type: "text", categoryId: textCategoryId },
                { name: "plans", description: "Plan meetups and games", type: "text", categoryId: textCategoryId },
                { name: "chill-voice", description: "Casual voice hangouts", type: "voice", categoryId: voiceCategoryId },
                { name: "party-voice", description: "Group voice room", type: "voice", categoryId: voiceCategoryId },
            ],
            study: [
                { name: "study-chat", description: "Study discussion", type: "text", categoryId: textCategoryId },
                { name: "resources", description: "Notes, links, and guides", type: "text", categoryId: textCategoryId },
                { name: "assignments", description: "Homework and deadlines", type: "text", categoryId: textCategoryId },
                { name: "focus-room", description: "Quiet focus voice", type: "voice", categoryId: voiceCategoryId },
                { name: "study-group", description: "Group study voice", type: "voice", categoryId: voiceCategoryId },
            ],
            school: [
                { name: "announcements", description: "Club announcements", type: "announcement", categoryId: textCategoryId },
                { name: "club-chat", description: "General club chat", type: "text", categoryId: textCategoryId },
                { name: "events", description: "Event planning", type: "text", categoryId: textCategoryId },
                { name: "resources", description: "Shared resources", type: "text", categoryId: textCategoryId },
                { name: "meetings", description: "Club meetings voice", type: "voice", categoryId: voiceCategoryId },
            ],
        };

        const kindChannels = {
            friends: [
                { name: "friends-chat", description: "Chat with your friends", type: "text", categoryId: textCategoryId },
                { name: "media", description: "Photos and clips", type: "text", categoryId: textCategoryId },
                { name: "game-night", description: "Plan game nights", type: "text", categoryId: textCategoryId },
                { name: "friends-voice", description: "Friends voice channel", type: "voice", categoryId: voiceCategoryId },
                { name: "hangout-voice", description: "Casual hangout voice", type: "voice", categoryId: voiceCategoryId },
            ],
            community: [
                { name: "welcome", description: "Start here", type: "text", categoryId: textCategoryId },
                { name: "announcements", description: "Community updates", type: "announcement", categoryId: textCategoryId },
                { name: "general", description: "Community chat", type: "text", categoryId: textCategoryId },
                { name: "events", description: "Upcoming events", type: "text", categoryId: textCategoryId },
                { name: "general-voice", description: "Community voice", type: "voice", categoryId: voiceCategoryId },
            ],
        };

        const defaultChannels =
            templateChannels[normalizedTemplate] ||
            kindChannels[normalizedKind] ||
            [
                { name: "general", description: "General chat", type: "text", categoryId: textCategoryId },
                { name: "announcements", description: "Official announcements", type: "announcement", categoryId: textCategoryId },
                { name: "general-voice", description: "General voice channel", type: "voice", categoryId: voiceCategoryId },
            ];

        await Channel.insertMany(
            defaultChannels.map((ch, idx) => ({
                communityId: community._id,
                name: ch.name,
                description: ch.description,
                type: ch.type,
                categoryId: ch.categoryId,
                position: idx,
            }))
        );

        res.status(201).json({
            success: true,
            message: "Community created successfully!",
            community,
            user: updatedUser,
        });
    } catch (error) {
        console.log("Error in createCommunity:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── POST /communities/:id/invites ────────────────────────────────────────────
export const generateInvite = async (req, res) => {
    const { id } = req.params;
    const { email } = req.body;

    try {
        if (id !== req.communityId) {
            return res.status(403).json({ success: false, message: "Community ID mismatch" });
        }

        const community = await Community.findById(id);
        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found" });
        }

        // Allow any community member to generate invites
        if (!req.communityRole) {
            return res.status(403).json({ success: false, message: "Only community members can generate invites" });
        }

        const code = generateCode();

        community.inviteCodes.push({
            code,
            isUsed: false,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        });
        await community.save();

        // Optionally send invite email
        if (email && email.trim()) {
            try {
                await sendInviteEmail(email.trim(), community.name, code);
            } catch (emailErr) {
                console.log("Email send failed (invite still created):", emailErr);
                return res.status(201).json({
                    success: true,
                    message: "Invite code created but email failed to send",
                    code,
                    emailSent: false,
                });
            }
        }

        res.status(201).json({
            success: true,
            message: email ? "Invite sent successfully!" : "Invite code generated!",
            code,
            emailSent: !!email,
        });
    } catch (error) {
        console.log("Error in generateInvite:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── GET /communities/:id/invites ─────────────────────────────────────────────
export const getInviteCodes = async (req, res) => {
    const { id } = req.params;

    try {
        const community = await Community.findById(id);
        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found" });
        }

        if (community.owner.toString() !== req.userId) {
            return res.status(403).json({ success: false, message: "Only the community owner can view invites" });
        }

        res.status(200).json({
            success: true,
            communityName: community.name,
            inviteCodes: community.inviteCodes,
        });
    } catch (error) {
        console.log("Error in getInviteCodes:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
// ── GET /communities/:id/members ─────────────────────────────────────────────
export const getMembers = async (req, res) => {
    const { id } = req.params;

    try {
        // Security: ensure the path community matches the one validated by verifyCommunityAccess
        // Prevents an attacker from passing their own community in the header but targeting another via the URL
        if (id !== req.communityId) {
            return res.status(403).json({ success: false, message: "Community ID mismatch" });
        }

        const rolesCommunity = await Community.findById(id).select("roles").lean();
        const roleIds = req.communityMembership?.roles || [];
        const roleMap = new Map((rolesCommunity?.roles || []).map((r) => [r._id.toString(), r.permissions || {}]));
        const rolePermissions = roleIds.reduce((acc, roleId) => {
            const perms = roleMap.get(roleId?.toString?.() || String(roleId));
            if (!perms) return acc;
            Object.keys(perms).forEach((key) => {
                if (perms[key]) acc[key] = true;
            });
            return acc;
        }, {});

        // Only admin, moderator, or members with kick permission can view the member list
        if (!['admin', 'moderator'].includes(req.communityRole) && !rolePermissions.kickMembers) {
            return res.status(403).json({ success: false, message: "Admin or Moderator access required" });
        }

        // Find all users who have a membership in this community
        const members = await User
            .find({ 'memberships.communityId': id })
            .select('name email role memberships isSuspended profileId')
            .populate('profileId', 'avatar reputation tier')
            .lean();

        // Shape the response: pull out the per-community membership info
        const shaped = members.map((u) => {
            const membership = u.memberships.find(
                (m) => m.communityId.toString() === id
            );
            const isSuspended = membership?.suspensionEndDate
                ? new Date(membership.suspensionEndDate) > new Date()
                : false;
            const username = u.email ? u.email.split('@')[0] : (u.name || 'user').toLowerCase();
            return {
                _id: u._id,
                name: u.name,
                username,
                email: u.email,
                globalRole: u.role,
                communityRole: membership?.role ?? 'member',
                roleIds: membership?.roles ?? [],
                joinedAt: membership?.joinedAt ?? null,
                isSuspended,
                suspensionEndDate: membership?.suspensionEndDate ?? null,
                isBanned: membership?.isBanned ?? false,
                avatar: u.profileId?.avatar ?? null,
                reputation: u.profileId?.reputation ?? 0,
                tier: u.profileId?.tier ?? 'free',
            };
        });

        res.status(200).json({ success: true, members: shaped });
    } catch (error) {
        console.log("Error in getMembers:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── GET /communities/roster ────────────────────────────────────────────────
export const getRoster = async (req, res) => {
    try {
        const communityId = req.communityId;
        const currentUserId = req.userId;

        const members = await User
            .find({ 'memberships.communityId': communityId })
            .select('name email lastLogin profileId memberships')
            .populate('profileId', 'avatar displayName status presence tier bannerColor bio')
            .lean();

        const now = Date.now();
        const toPresence = (profilePresence, lastLogin) => {
            if (['online', 'idle', 'dnd', 'offline'].includes(profilePresence)) return profilePresence;
            if (!lastLogin) return 'offline';
            const diff = now - new Date(lastLogin).getTime();
            if (diff <= 10 * 60 * 1000) return 'online';
            if (diff <= 60 * 60 * 1000) return 'idle';
            return 'offline';
        };

        const shaped = members.map((u) => {
            const membership = u.memberships?.find((m) => m.communityId.toString() === communityId);
            const displayName = u.profileId?.displayName || u.name || 'Member';
            const username = u.email ? u.email.split('@')[0] : (u.name || 'user').toLowerCase();
            const presence = toPresence(u.profileId?.presence, u.lastLogin);
            const statusText = u.profileId?.status || 'Eat Sleep Code Repeat';
            return {
                _id: u._id,
                displayName,
                username,
                presence,
                statusText,
                avatar: u.profileId?.avatar || '',
                bannerColor: u.profileId?.bannerColor || '#3f4f4f',
                bio: u.profileId?.bio || '',
                tier: u.profileId?.tier || 'free',
                communityRole: membership?.role || 'member',
                roleIds: membership?.roles || [],
            };
        });

        const friends = shaped.filter((m) => m._id.toString() !== currentUserId);
        const presenceOrder = { online: 0, dnd: 1, idle: 2, offline: 3 };
        friends.sort((a, b) => {
            const diff = (presenceOrder[a.presence] ?? 9) - (presenceOrder[b.presence] ?? 9);
            if (diff !== 0) return diff;
            return a.displayName.localeCompare(b.displayName);
        });

        const onlineCount = friends.filter((m) => m.presence !== 'offline').length;
        const dms = friends.slice(0, 10);

        res.status(200).json({
            success: true,
            friends,
            dms,
            onlineCount,
        });
    } catch (error) {
        console.log('Error in getRoster:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ── PUT /communities/:id/members/:userId/role ─────────────────────────────────
export const updateMemberRole = async (req, res) => {
    const { id, userId } = req.params;
    const { role } = req.body;

    const ALLOWED_ROLES = ['moderator', 'member'];

    try {
        // Security: path community must match the one validated by middleware
        if (id !== req.communityId) {
            return res.status(403).json({ success: false, message: "Community ID mismatch" });
        }

        // Only community admin can change roles
        if (req.communityRole !== 'admin') {
            return res.status(403).json({ success: false, message: "Only community admins can change roles" });
        }

        if (!ALLOWED_ROLES.includes(role)) {
            return res.status(400).json({ success: false, message: `Role must be one of: ${ALLOWED_ROLES.join(', ')}` });
        }

        // Find target user
        const target = await User.findById(userId);
        if (!target) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Locate their membership in this community
        const membership = target.memberships.find(
            (m) => m.communityId.toString() === id
        );

        if (!membership) {
            return res.status(404).json({ success: false, message: "User is not a member of this community" });
        }

        // Cannot demote the community admin
        if (membership.role === 'admin') {
            return res.status(403).json({ success: false, message: "Cannot change the role of the community admin" });
        }

        // Update community-level role
        membership.role = role;

        // Sync global user.role: moderator → 'moderator', member → 'user'
        target.role = role === 'moderator' ? 'moderator' : 'user';

        await target.save();

        try {
            io.to(`user:${userId}`).emit("community:role_updated", {
                communityId: id,
                role,
                globalRole: target.role,
            });
        } catch (err) {
            console.log("Socket emit failed (updateMemberRole):", err?.message || err);
        }

        res.status(200).json({
            success: true,
            message: `User role updated to ${role}`,
            userId,
            newRole: role,
        });
    } catch (error) {
        console.log("Error in updateMemberRole:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── GET /communities/:id/roles ───────────────────────────────────────────────
export const getRoles = async (req, res) => {
    const { id } = req.params;

    try {
        if (id !== req.communityId) {
            return res.status(403).json({ success: false, message: "Community ID mismatch" });
        }

        const community = await Community.findById(id).lean();
        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found" });
        }

        const members = await User.find({ 'memberships.communityId': id })
            .select('memberships')
            .lean();

        const counts = {};
        members.forEach((u) => {
            const membership = u.memberships.find((m) => m.communityId.toString() === id);
            (membership?.roles || []).forEach((roleId) => {
                counts[roleId] = (counts[roleId] || 0) + 1;
            });
        });

        const roles = (community.roles || []).map((r) => ({
            _id: r._id,
            name: r.name,
            permissions: r.permissions || {},
            color: r.color,
            hoist: r.hoist,
            mentionable: r.mentionable,
            position: r.position,
            memberCount: counts[r._id.toString()] || 0,
            createdAt: r.createdAt,
        }));

        roles.sort((a, b) => (b.position || 0) - (a.position || 0)); // Discord-style: higher position first

        res.status(200).json({ success: true, roles });
    } catch (error) {
        console.log("Error in getRoles:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── GET /communities/:id/bans ───────────────────────────────────────────────
export const getBans = async (req, res) => {
    const { id } = req.params;

    try {
        if (id !== req.communityId) {
            return res.status(403).json({ success: false, message: "Community ID mismatch" });
        }
        if (!['admin', 'moderator'].includes(req.communityRole)) {
            return res.status(403).json({ success: false, message: "Only admins/mods can view bans" });
        }

        const community = await Community.findById(id)
            .select("bannedUsers")
            .populate("bannedUsers.userId", "name email")
            .populate("bannedUsers.executor", "name email")
            .lean();

        if (!community) return res.status(404).json({ success: false, message: "Community not found" });

        res.status(200).json({ success: true, bans: community.bannedUsers || [] });
    } catch (error) {
        console.log("Error in getBans:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── POST /communities/:id/roles ──────────────────────────────────────────────
export const createRole = async (req, res) => {
    const { id } = req.params;
    const { name, permissions } = req.body;

    try {
        if (id !== req.communityId) {
            return res.status(403).json({ success: false, message: "Community ID mismatch" });
        }
        const communityForPermissions = await Community.findById(id).select("roles").lean();
        const roleIds = req.communityMembership?.roles || [];
        const roleMap = new Map((communityForPermissions?.roles || []).map((r) => [r._id.toString(), r.permissions || {}]));
        const rolePermissions = roleIds.reduce((acc, roleId) => {
            const perms = roleMap.get(roleId?.toString?.() || String(roleId));
            if (!perms) return acc;
            Object.keys(perms).forEach((key) => {
                if (perms[key]) acc[key] = true;
            });
            return acc;
        }, {});
        if (!['admin', 'moderator'].includes(req.communityRole) && !rolePermissions.manageRoles) {
            return res.status(403).json({ success: false, message: "Admin or Moderator access required" });
        }
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: "Role name is required" });
        }

        const community = await Community.findById(id);
        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found" });
        }

        const maxPos = community.roles.reduce((max, r) => Math.max(max, r.position || 0), -1);
        const role = {
            name: name.trim(),
            permissions: permissions || {},
            color: req.body.color || "#99aab5",
            hoist: !!req.body.hoist,
            mentionable: !!req.body.mentionable,
            position: maxPos + 1,
        };
        community.roles.push(role);
        await community.save();

        const created = community.roles[community.roles.length - 1];
        
        await logAction(id, req.userId, null, 'role_create', '', { 
            roleName: created.name, 
            roleId: created._id 
        });

        res.status(201).json({ success: true, role: created });
    } catch (error) {
        console.log("Error in createRole:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── PUT /communities/:id/roles/:roleId ───────────────────────────────────────
export const updateRole = async (req, res) => {
    const { id, roleId } = req.params;
    const { name, permissions, color, hoist, mentionable, position } = req.body;

    try {
        if (id !== req.communityId) {
            return res.status(403).json({ success: false, message: "Community ID mismatch" });
        }
        const communityForPermissions = await Community.findById(id).select("roles").lean();
        const roleIds = req.communityMembership?.roles || [];
        const roleMap = new Map((communityForPermissions?.roles || []).map((r) => [r._id.toString(), r.permissions || {}]));
        const rolePermissions = roleIds.reduce((acc, roleId) => {
            const perms = roleMap.get(roleId?.toString?.() || String(roleId));
            if (!perms) return acc;
            Object.keys(perms).forEach((key) => {
                if (perms[key]) acc[key] = true;
            });
            return acc;
        }, {});
        if (!['admin', 'moderator'].includes(req.communityRole) && !rolePermissions.manageRoles) {
            return res.status(403).json({ success: false, message: "Admin or Moderator access required" });
        }

        const community = await Community.findById(id);
        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found" });
        }

        const role = community.roles.id(roleId);
        if (!role) {
            return res.status(404).json({ success: false, message: "Role not found" });
        }

        if (name !== undefined) role.name = name;
        if (permissions !== undefined) role.permissions = permissions;
        if (color !== undefined) role.color = color;
        if (hoist !== undefined) role.hoist = hoist;
        if (mentionable !== undefined) role.mentionable = mentionable;
        if (position !== undefined) role.position = position;
        await community.save();

        await logAction(id, req.userId, null, 'role_update', '', { 
            roleName: role.name, 
            roleId: role._id,
            changes: { name, permissions: !!permissions, color, hoist, mentionable, position }
        });

        res.status(200).json({ success: true, role });
    } catch (error) {
        console.log("Error in updateRole:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── PUT /communities/:id/roles/reorder ──────────────────────────────────────
export const reorderRoles = async (req, res) => {
    const { id } = req.params;
    const { roles } = req.body; // Array of { _id, position }

    try {
        if (id !== req.communityId) {
            return res.status(403).json({ success: false, message: "Community ID mismatch" });
        }
        if (req.communityRole !== "admin") {
            return res.status(403).json({ success: false, message: "Only admins can reorder roles" });
        }

        const community = await Community.findById(id);
        if (!community) return res.status(404).json({ success: false, message: "Community not found" });

        roles.forEach((update) => {
            const role = community.roles.id(update._id);
            if (role) {
                role.position = update.position;
            }
        });

        await community.save();
        res.status(200).json({ success: true, message: "Roles reordered" });
    } catch (error) {
        console.log("Error in reorderRoles:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── DELETE /communities/:id/roles/:roleId ────────────────────────────────────
export const deleteRole = async (req, res) => {
    const { id, roleId } = req.params;

    try {
        if (id !== req.communityId) {
            return res.status(403).json({ success: false, message: "Community ID mismatch" });
        }
        const communityForPermissions = await Community.findById(id).select("roles").lean();
        const roleIds = req.communityMembership?.roles || [];
        const roleMap = new Map((communityForPermissions?.roles || []).map((r) => [r._id.toString(), r.permissions || {}]));
        const rolePermissions = roleIds.reduce((acc, roleId) => {
            const perms = roleMap.get(roleId?.toString?.() || String(roleId));
            if (!perms) return acc;
            Object.keys(perms).forEach((key) => {
                if (perms[key]) acc[key] = true;
            });
            return acc;
        }, {});
        if (!['admin', 'moderator'].includes(req.communityRole) && !rolePermissions.manageRoles) {
            return res.status(403).json({ success: false, message: "Admin or Moderator access required" });
        }

        if (!communityForPermissions) {
            return res.status(404).json({ success: false, message: "Community not found" });
        }

        const roleExists = (communityForPermissions.roles || []).some(
            (r) => r._id?.toString?.() === roleId
        );
        if (!roleExists) {
            return res.status(404).json({ success: false, message: "Role not found" });
        }

        const targetRole = communityForPermissions.roles.find(r => r._id.toString() === roleId);
        const roleName = targetRole?.name || 'unknown';

        await Community.findByIdAndUpdate(id, {
            $pull: { roles: { _id: roleId } },
        });

        await logAction(id, req.userId, null, 'role_delete', '', { roleId, roleName });

        const users = await User.find({ 'memberships.communityId': id });
        await Promise.all(
            users.map(async (user) => {
                let changed = false;
                user.memberships.forEach((membership) => {
                    if (membership.communityId.toString() !== id) return;
                    const nextRoles = (membership.roles || []).filter((rid) => rid.toString() !== roleId);
                    if (nextRoles.length !== (membership.roles || []).length) {
                        membership.roles = nextRoles;
                        changed = true;
                    }
                });
                if (changed) await user.save();
            })
        );

        res.status(200).json({ success: true, message: "Role deleted" });
    } catch (error) {
        console.log("Error in deleteRole:", error);
        res.status(500).json({ success: false, message: error.message || "Server error" });
    }
};

// ── PUT /communities/:id/members/:userId/roles ───────────────────────────────
export const updateMemberRoles = async (req, res) => {
    const { id, userId } = req.params;
    const { roleIds } = req.body;

    try {
        if (id !== req.communityId) {
            return res.status(403).json({ success: false, message: "Community ID mismatch" });
        }
        if (!['admin', 'moderator'].includes(req.communityRole)) {
            return res.status(403).json({ success: false, message: "Admin or Moderator access required" });
        }

        const community = await Community.findById(id).lean();
        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found" });
        }

        const validRoleIds = new Set((community.roles || []).map((r) => r._id.toString()));
        const normalized = Array.isArray(roleIds)
            ? roleIds.filter((rid) => validRoleIds.has(rid))
            : [];

        const target = await User.findById(userId);
        if (!target) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const membership = target.memberships.find((m) => m.communityId.toString() === id);
        if (!membership) {
            return res.status(404).json({ success: false, message: "User is not a member of this community" });
        }

        membership.roles = normalized;
        await target.save();

        res.status(200).json({ success: true, roleIds: normalized });
    } catch (error) {
        console.log("Error in updateMemberRoles:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── DELETE /communities/:id/members/:userId ─────────────────────────────────
export const kickMember = async (req, res) => {
    const { id, userId } = req.params;

    try {
        if (id !== req.communityId) {
            return res.status(403).json({ success: false, message: "Community ID mismatch" });
        }

        const rolesCommunity = await Community.findById(id).select("roles").lean();
        const roleIds = req.communityMembership?.roles || [];
        const roleMap = new Map((rolesCommunity?.roles || []).map((r) => [r._id.toString(), r.permissions || {}]));
        const rolePermissions = roleIds.reduce((acc, roleId) => {
            const perms = roleMap.get(roleId?.toString?.() || String(roleId));
            if (!perms) return acc;
            Object.keys(perms).forEach((key) => {
                if (perms[key]) acc[key] = true;
            });
            return acc;
        }, {});
        const canKick = ['admin', 'moderator'].includes(req.communityRole) || rolePermissions.kickMembers;
        if (!canKick) {
            return res.status(403).json({ success: false, message: "You do not have permission to kick members" });
        }

        if (userId === req.userId) {
            return res.status(400).json({ success: false, message: "You cannot kick yourself" });
        }

        const community = await Community.findById(id);
        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found" });
        }

        const target = await User.findById(userId);
        if (!target) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const membership = target.memberships.find((m) => m.communityId.toString() === id);
        if (!membership) {
            return res.status(404).json({ success: false, message: "User is not a member of this community" });
        }

        if (membership.role === 'admin') {
            return res.status(403).json({ success: false, message: "Cannot kick another admin" });
        }

        target.memberships = target.memberships.filter((m) => m.communityId.toString() !== id);
        await target.save();

        community.members = community.members.filter((m) => m.toString() !== userId);
        await community.save();

        try {
            await AuditLog.create({
                communityId: id,
                moderatorId: req.userId,
                targetUserId: userId,
                actionType: 'kick',
                reason: '',
                metadata: { communityId: id },
            });
        } catch (err) {
            console.log("Audit log failed (kickMember):", err?.message || err);
        }

        try {
            io.to(`community:${id}`).emit("community:member_kicked", { communityId: id, userId });
            io.to(`user:${userId}`).emit("community:kicked", { communityId: id });
        } catch (err) {
            console.log("Socket emit failed (kickMember):", err?.message || err);
        }

        res.status(200).json({
            success: true,
            message: "Member kicked successfully",
            userId,
        });
    } catch (error) {
        console.log("Error in kickMember:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── GET /communities/:id/members/search?q= ──────────────────────────────────
export const searchMembers = async (req, res) => {
    try {
        const q = (req.query.q || "").trim();
        if (!q) return res.status(200).json({ success: true, members: [] });

        const communityId = req.params.id;

        // Find users who are members of this community and whose name matches the query
        const users = await User.find({
            "memberships.communityId": communityId,
            name: { $regex: q, $options: "i" },
        })
            .select("_id name")
            .limit(10)
            .lean();

        // Fetch avatars
        const userIds = users.map((u) => u._id);
        const profiles = await Profile.find({ userId: { $in: userIds } })
            .select("userId avatar")
            .lean();
        const avatarMap = {};
        profiles.forEach((p) => { avatarMap[p.userId.toString()] = p.avatar || ""; });

        const members = users.map((u) => ({
            _id: u._id,
            name: u.name,
            avatar: avatarMap[u._id.toString()] || "",
        }));

        res.status(200).json({ success: true, members });
    } catch (error) {
        console.log("Error in searchMembers:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── POST /communities/join ──────────────────────────────────────────────────
export const joinCommunity = async (req, res) => {
    const { inviteCode } = req.body;

    try {
        if (!inviteCode || !inviteCode.trim()) {
            return res.status(400).json({ success: false, message: "Invite code is required" });
        }

        const code = inviteCode.trim().toUpperCase();

        // Find the community with this unused invite code
        const community = await Community.findOne({
            "inviteCodes.code": code,
            "inviteCodes.isUsed": false,
        });

        if (!community) {
            return res.status(400).json({
                success: false,
                message: "Invalid or already used invite code",
            });
        }

        // Ban check
        const isBanned = (community.bannedUsers || []).some(
            (b) => b.userId?.toString() === req.userId?.toString()
        );
        if (isBanned) {
            return res.status(403).json({ success: false, message: "You are banned from this community" });
        }

        const inviteEntry = community.inviteCodes.find(
            (inv) => inv.code === code && !inv.isUsed
        );

        if (!inviteEntry) {
            return res.status(400).json({
                success: false,
                message: "Invalid or already used invite code",
            });
        }

        if (inviteEntry.expiresAt && new Date(inviteEntry.expiresAt) < new Date()) {
            return res.status(400).json({
                success: false,
                message: "This invite code has expired",
            });
        }

        // Check if user is already a member of this community
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const alreadyMember = user.memberships.some(
            (m) => m.communityId.toString() === community._id.toString()
        );

        if (alreadyMember) {
            return res.status(400).json({
                success: false,
                message: "You are already a member of this community",
            });
        }

        // Mark invite code as used
        inviteEntry.isUsed = true;
        inviteEntry.usedBy = user._id;
        community.members.push(user._id);
        await community.save();

        // Add membership to user
        user.memberships.push({ communityId: community._id, role: "member" });
        await user.save();

        // Return updated user with populated memberships
        const populatedUser = await User.findById(user._id)
            .populate("memberships.communityId", "name slug icon")
            .lean();

        res.status(200).json({
            success: true,
            message: `You've joined ${community.name}!`,
            community: { _id: community._id, name: community.name, slug: community.slug },
            user: { ...populatedUser, password: undefined },
        });
    } catch (error) {
        console.log("Error in joinCommunity:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── GET /communities/:id/profile ────────────────────────────────────────────
export const getCommunityProfile = async (req, res) => {
    const { id } = req.params;

    try {
        if (id !== req.communityId) {
            return res.status(403).json({ success: false, message: "Community ID mismatch" });
        }

        const community = await Community.findById(id).select(
            "name icon bannerColor traits profileDescription description createdAt members engagement emojis access safety community onboarding"
        );

        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found" });
        }

        res.status(200).json({
            success: true,
            profile: {
                _id: community._id,
                name: community.name,
                icon: community.icon || "",
                bannerColor: community.bannerColor || "",
                traits: community.traits || [],
                profileDescription: community.profileDescription || community.description || "",
                description: community.description || "",
                createdAt: community.createdAt,
                membersCount: community.members?.length || 0,
                engagement: community.engagement || {},
                emojis: community.emojis || [],
                access: community.access || { joinMethod: 'invite', isAgeRestricted: false, rules: { enabled: false, list: [] } },
                safety: community.safety || { verificationLevel: 'none', explicitContentFilter: 'members_without_roles', twoFactorModeration: false },
                community: community.community || { enabled: true, rulesChannelId: null, updatesChannelId: null, safetyChannelId: null, primaryLanguage: 'English', description: '' },
                onboarding: community.onboarding || { enabled: false, steps: [], memberTags: [] },
            },
        });
    } catch (error) {
        console.log("Error in getCommunityProfile:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── PUT /communities/:id/profile ────────────────────────────────────────────
export const updateCommunityProfile = async (req, res) => {
    const { id } = req.params;
    const { name, icon, bannerColor, traits, profileDescription, engagement, access, safety, community: communityData, onboarding } = req.body;

    try {
        if (id !== req.communityId) {
            return res.status(403).json({ success: false, message: "Community ID mismatch" });
        }

        const community = await Community.findById(id);
        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found" });
        }

        let canEditProfile = ['admin', 'moderator'].includes(req.communityRole);
        if (!canEditProfile) {
            const roleIds = req.communityMembership?.roles || [];
            if (roleIds.length > 0) {
                const roleMap = new Map((community.roles || []).map((r) => [r._id.toString(), r.permissions || {}]));
                canEditProfile = roleIds.some((rid) => roleMap.get(rid.toString())?.editServerProfile);
            }
        }

        if (!canEditProfile) {
            return res.status(403).json({ success: false, message: "You do not have permission to update the server profile" });
        }

        if (name !== undefined) {
            if (!name || !name.trim()) {
                return res.status(400).json({ success: false, message: "Server name cannot be empty" });
            }
            community.name = name.trim();
        }

        if (icon !== undefined) {
            community.icon = icon || "";
        }

        if (bannerColor !== undefined) {
            community.bannerColor = bannerColor || "";
        }

        if (Array.isArray(traits)) {
            const cleaned = traits
                .map((t) => (typeof t === "string" ? t.trim() : ""))
                .filter(Boolean)
                .slice(0, 5);
            community.traits = cleaned;
        }

        if (profileDescription !== undefined) {
            const trimmed = profileDescription?.trim() || "";
            community.profileDescription = trimmed;
            community.description = trimmed;
        }

        if (engagement !== undefined) {
            // Robust merging of engagement settings
            if (!community.engagement) community.engagement = {};
            
            if (engagement.systemMessages) {
                if (!community.engagement.systemMessages) community.engagement.systemMessages = {};
                const sm = engagement.systemMessages;
                if (sm.welcomeEnabled !== undefined) community.engagement.systemMessages.welcomeEnabled = !!sm.welcomeEnabled;
                if (sm.welcomePromptEnabled !== undefined) community.engagement.systemMessages.welcomePromptEnabled = !!sm.welcomePromptEnabled;
                if (sm.boostEnabled !== undefined) community.engagement.systemMessages.boostEnabled = !!sm.boostEnabled;
                if (sm.tipsEnabled !== undefined) community.engagement.systemMessages.tipsEnabled = !!sm.tipsEnabled;
                if (sm.channelId !== undefined) community.engagement.systemMessages.channelId = sm.channelId || null;
            }

            if (engagement.activityFeed) {
                if (!community.engagement.activityFeed) community.engagement.activityFeed = {};
                if (engagement.activityFeed.displayEnabled !== undefined) {
                    community.engagement.activityFeed.displayEnabled = !!engagement.activityFeed.displayEnabled;
                }
            }

            if (engagement.defaultNotifications !== undefined) {
                if (["all", "mentions"].includes(engagement.defaultNotifications)) {
                    community.engagement.defaultNotifications = engagement.defaultNotifications;
                }
            }

            if (engagement.afk) {
                if (!community.engagement.afk) community.engagement.afk = {};
                if (engagement.afk.channelId !== undefined) community.engagement.afk.channelId = engagement.afk.channelId || null;
                if (engagement.afk.timeout !== undefined) community.engagement.afk.timeout = Number(engagement.afk.timeout) || 300;
            }
        }

        if (access !== undefined) {
            if (!community.access) community.access = { joinMethod: 'invite', isAgeRestricted: false, rules: { enabled: false, list: [] } };
            
            if (access.joinMethod !== undefined && ["invite", "apply", "discoverable"].includes(access.joinMethod)) {
                community.access.joinMethod = access.joinMethod;
                // Sync with existing field if necessary
                community.inviteRequestsEnabled = access.joinMethod === "apply";
            }

            if (access.isAgeRestricted !== undefined) {
                community.access.isAgeRestricted = !!access.isAgeRestricted;
            }

            if (access.rules !== undefined) {
                if (!community.access.rules) community.access.rules = { enabled: false, list: [] };
                if (access.rules.enabled !== undefined) community.access.rules.enabled = !!access.rules.enabled;
                if (Array.isArray(access.rules.list)) {
                    community.access.rules.list = access.rules.list.filter(r => typeof r === 'string' && r.trim()).map(r => r.trim());
                }
            }
        }

        if (safety !== undefined) {
            if (!community.safety) community.safety = { verificationLevel: 'none', explicitContentFilter: 'members_without_roles', twoFactorModeration: false };
            
            if (safety.verificationLevel !== undefined && ["none", "low", "medium", "high", "highest"].includes(safety.verificationLevel)) {
                community.safety.verificationLevel = safety.verificationLevel;
            }

            if (safety.explicitContentFilter !== undefined && ["disabled", "members_without_roles", "all_members"].includes(safety.explicitContentFilter)) {
                community.safety.explicitContentFilter = safety.explicitContentFilter;
            }

            if (safety.twoFactorModeration !== undefined) {
                community.safety.twoFactorModeration = !!safety.twoFactorModeration;
            }
        }

        if (communityData !== undefined) {
            if (!community.community) community.community = { enabled: true, rulesChannelId: null, updatesChannelId: null, safetyChannelId: null, primaryLanguage: 'English', description: '' };
            if (communityData.enabled !== undefined) community.community.enabled = !!communityData.enabled;
            if (communityData.rulesChannelId !== undefined) community.community.rulesChannelId = communityData.rulesChannelId || null;
            if (communityData.updatesChannelId !== undefined) community.community.updatesChannelId = communityData.updatesChannelId || null;
            if (communityData.safetyChannelId !== undefined) community.community.safetyChannelId = communityData.safetyChannelId || null;
            if (communityData.primaryLanguage !== undefined) community.community.primaryLanguage = communityData.primaryLanguage || 'English';
            if (communityData.description !== undefined) community.community.description = communityData.description || '';
        }

        if (onboarding !== undefined) {
            if (!community.onboarding) community.onboarding = { enabled: false, steps: [], memberTags: [] };
            if (onboarding.enabled !== undefined) community.onboarding.enabled = !!onboarding.enabled;
            if (Array.isArray(onboarding.steps)) {
                community.onboarding.steps = onboarding.steps.map(s => ({
                    title: s.title || 'Welcome Step',
                    description: s.description || '',
                    icon: s.icon || '',
                    channelId: s.channelId || null,
                }));
            }
            if (Array.isArray(onboarding.memberTags)) {
                community.onboarding.memberTags = onboarding.memberTags.filter(t => typeof t === 'string' && t.trim()).map(t => t.trim());
            }
        }

        await community.save();

        await logAction(id, req.userId, null, 'community_update', '', { 
            changes: { name, icon: !!icon, bannerColor, traits, profileDescription: !!profileDescription }
        });

        res.status(200).json({
            success: true,
            message: "Server profile updated",
            profile: {
                _id: community._id,
                name: community.name,
                icon: community.icon || "",
                bannerColor: community.bannerColor || "",
                traits: community.traits || [],
                profileDescription: community.profileDescription || community.description || "",
                description: community.description || "",
                createdAt: community.createdAt,
                membersCount: community.members?.length || 0,
                engagement: community.engagement || {},
                access: community.access || { joinMethod: 'invite', isAgeRestricted: false, rules: { enabled: false, list: [] } },
                safety: community.safety || { verificationLevel: 'none', explicitContentFilter: 'members_without_roles', twoFactorModeration: false },
                community: community.community || { enabled: true, rulesChannelId: null, updatesChannelId: null, safetyChannelId: null, primaryLanguage: 'English', description: '' },
                onboarding: community.onboarding || { enabled: false, steps: [], memberTags: [] },
            },
        });
    } catch (error) {
        console.log("Error in updateCommunityProfile:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── DELETE /communities/:id ─────────────────────────────────────────────────
export const deleteCommunity = async (req, res) => {
    const { id } = req.params;

    try {
        if (id !== req.communityId) {
            return res.status(403).json({ success: false, message: "Community ID mismatch" });
        }

        if (req.communityRole !== 'admin') {
            return res.status(403).json({ success: false, message: "Only community admins can delete the server" });
        }

        const community = await Community.findById(id);
        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found" });
        }

        const channels = await Channel.find({ communityId: id }).select("_id").lean();
        const channelIds = channels.map((c) => c._id);

        if (channelIds.length > 0) {
            const messages = await ChannelMessage.find({ channelId: { $in: channelIds } }).select("_id").lean();
            const messageIds = messages.map((m) => m._id);
            if (messageIds.length > 0) {
                await ChannelMessageComment.deleteMany({ messageId: { $in: messageIds } });
            }
            await ChannelMessage.deleteMany({ channelId: { $in: channelIds } });
        }

        await Channel.deleteMany({ communityId: id });
        await Event.deleteMany({ communityId: id });

        const posts = await Post.find({ communityId: id }).select("_id").lean();
        const postIds = posts.map((p) => p._id);
        if (postIds.length > 0) {
            await Comment.deleteMany({ postId: { $in: postIds } });
        }
        await Post.deleteMany({ communityId: id });

        await AuditLog.deleteMany({ communityId: id });
        await InviteRequest.deleteMany({ communityId: id });
        await Notification.deleteMany({ 'meta.communityId': id });

        await User.updateMany(
            { "memberships.communityId": id },
            { $pull: { memberships: { communityId: id } } }
        );

        await Community.findByIdAndDelete(id);

        const updatedUser = await User.findById(req.userId)
            .select("-password")
            .populate("memberships.communityId", "name slug icon")
            .lean();

        res.status(200).json({
            success: true,
            message: "Server deleted successfully",
            user: updatedUser,
        });
    } catch (error) {
        console.log("Error in deleteCommunity:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const updateNotificationSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const updates = req.body;
    
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const membership = user.memberships.find(m => m.communityId.toString() === id.toString());
    if (!membership) return res.status(403).json({ message: 'Not a member' });
    
    membership.notificationSettings = { ...membership.notificationSettings, ...updates };
    await user.save();
    
    res.status(200).json({ success: true, notificationSettings: membership.notificationSettings });
  } catch (error) {
    console.error('Update Notification Settings Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── CATEGORIES ─────────────────────────────────────────────────────────────

export const createCategory = async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    try {
        if (id !== req.communityId) return res.status(403).json({ success: false, message: "Community ID mismatch" });
        if (!["admin", "moderator"].includes(req.communityRole)) return res.status(403).json({ success: false, message: "No permission" });

        const community = await Community.findById(id);
        if (!community) return res.status(404).json({ success: false, message: "Community not found" });

        const position = community.categories.length;
        community.categories.push({ name, position });
        await community.save();

        const created = community.categories[community.categories.length - 1];
        
        await logAction(id, req.userId, null, 'category_create', `Created category ${name}`, { 
            categoryId: created._id,
            categoryName: name
        });

        res.status(201).json({ success: true, category: created });
    } catch (error) {
        console.log("Error in createCategory:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const updateCategory = async (req, res) => {
    const { id, categoryId } = req.params;
    const { name, position } = req.body;

    try {
        if (id !== req.communityId) return res.status(403).json({ success: false, message: "Community ID mismatch" });
        if (!["admin", "moderator"].includes(req.communityRole)) return res.status(403).json({ success: false, message: "No permission" });

        const community = await Community.findById(id);
        if (!community) return res.status(404).json({ success: false, message: "Community not found" });

        const category = community.categories.id(categoryId);
        if (!category) return res.status(404).json({ success: false, message: "Category not found" });

        if (name) category.name = name;
        if (typeof position === "number") category.position = position;

        await community.save();

        await logAction(id, req.userId, null, 'category_update', '', { 
            categoryId: category._id,
            categoryName: category.name,
            changes: { name, position }
        });

        res.status(200).json({ success: true, category });
    } catch (error) {
        console.log("Error in updateCategory:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const deleteCategory = async (req, res) => {
    const { id, categoryId } = req.params;

    try {
        if (id !== req.communityId) return res.status(403).json({ success: false, message: "Community ID mismatch" });
        if (req.communityRole !== "admin") return res.status(403).json({ success: false, message: "Only owners can delete categories" });

        const community = await Community.findById(id);
        if (!community) return res.status(404).json({ success: false, message: "Community not found" });

        const category = community.categories.id(categoryId);
        const categoryName = category?.name || 'unknown';

        community.categories.pull(categoryId);
        
        // Move channels to "Uncategorized" (null)
        await Channel.updateMany({ communityId: id, categoryId }, { $set: { categoryId: null } });

        await community.save();

        await logAction(id, req.userId, null, 'category_delete', '', { 
            categoryId,
            categoryName
        });

        res.status(200).json({ success: true, message: "Category deleted" });
    } catch (error) {
        console.log("Error in deleteCategory:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const updateCategoryOverwrites = async (req, res) => {
    const { id, categoryId } = req.params;
    const { overwrites } = req.body;

    try {
        if (id !== req.communityId) return res.status(403).json({ success: false, message: "Community ID mismatch" });
        if (!["admin", "moderator"].includes(req.communityRole)) return res.status(403).json({ success: false, message: "No permission" });

        const community = await Community.findById(id);
        if (!community) return res.status(404).json({ success: false, message: "Community not found" });

        const category = community.categories.id(categoryId);
        if (!category) return res.status(404).json({ success: false, message: "Category not found" });

        // Update overwrites
        category.permissionOverwrites = overwrites;

        await community.save();
        res.status(200).json({ success: true, category });
    } catch (error) {
        console.log("Error in updateCategoryOverwrites:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── POST /communities/:id/emojis ───────────────────────────────────────────
export const uploadEmoji = async (req, res) => {
    const { id } = req.params;
    const { name, url } = req.body;

    try {
        if (id !== req.communityId) {
            return res.status(403).json({ success: false, message: "Community ID mismatch" });
        }

        if (!['admin', 'moderator'].includes(req.communityRole)) {
            return res.status(403).json({ success: false, message: "Only admins and moderators can upload emojis" });
        }

        if (!name || !url) {
            return res.status(400).json({ success: false, message: "Name and URL are required" });
        }

        const community = await Community.findById(id);
        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found" });
        }

        if (community.emojis.length >= 50) {
            return res.status(400).json({ success: false, message: "Server has reached the maximum limit of 50 emojis" });
        }

        const newEmoji = {
            name: name.trim().replace(/[^a-zA-Z0-9_]/g, ""),
            url,
            uploadedBy: req.userId,
            createdAt: new Date(),
        };

        community.emojis.push(newEmoji);
        await community.save();

        res.status(201).json({ success: true, emoji: community.emojis[community.emojis.length - 1] });
    } catch (error) {
        console.log("Error in uploadEmoji:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── PATCH /communities/:id/emojis/:emojiId ──────────────────────────────────
export const updateEmoji = async (req, res) => {
    const { id, emojiId } = req.params;
    const { name } = req.body;

    try {
        if (id !== req.communityId) {
            return res.status(403).json({ success: false, message: "Community ID mismatch" });
        }

        if (!['admin', 'moderator'].includes(req.communityRole)) {
            return res.status(403).json({ success: false, message: "Only admins and moderators can rename emojis" });
        }

        const community = await Community.findById(id);
        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found" });
        }

        const emoji = community.emojis.id(emojiId);
        if (!emoji) {
            return res.status(404).json({ success: false, message: "Emoji not found" });
        }

        if (name) {
            emoji.name = name.trim().replace(/[^a-zA-Z0-9_]/g, "");
        }

        await community.save();
        res.status(200).json({ success: true, emoji });
    } catch (error) {
        console.log("Error in updateEmoji:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── DELETE /communities/:id/emojis/:emojiId ─────────────────────────────────
export const deleteEmoji = async (req, res) => {
    const { id, emojiId } = req.params;

    try {
        if (id !== req.communityId) {
            return res.status(403).json({ success: false, message: "Community ID mismatch" });
        }

        if (!['admin', 'moderator'].includes(req.communityRole)) {
            return res.status(403).json({ success: false, message: "Only admins and moderators can delete emojis" });
        }

        const community = await Community.findById(id);
        if (!community) {
            return res.status(404).json({ success: false, message: "Community not found" });
        }

        const emoji = community.emojis.id(emojiId);
        if (!emoji) {
            return res.status(404).json({ success: false, message: "Emoji not found" });
        }

        community.emojis.pull(emojiId);
        await community.save();

        res.status(200).json({ success: true, message: "Emoji deleted" });
    } catch (error) {
        console.log("Error in deleteEmoji:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
