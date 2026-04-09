import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";

const presenceFromLastLogin = (profilePresence, lastLogin) => {
    if (["online", "idle", "dnd", "offline"].includes(profilePresence)) return profilePresence;
    if (!lastLogin) return "offline";
    const now = Date.now();
    const diff = now - new Date(lastLogin).getTime();
    if (diff <= 10 * 60 * 1000) return "online";
    if (diff <= 60 * 60 * 1000) return "idle";
    return "offline";
};

const shapeUser = (u) => {
    const displayName = u.profileId?.displayName || u.name || "Member";
    const username = u.email ? u.email.split("@")[0] : (u.name || "user").toLowerCase();
    const presence = presenceFromLastLogin(u.profileId?.presence, u.lastLogin);
    const statusText = u.profileId?.status || "Eat Sleep Code Repeat";
    return {
        _id: u._id,
        displayName,
        username,
        presence,
        statusText,
        avatar: u.profileId?.avatar || "",
        tier: u.profileId?.tier || "free",
    };
};

// ── GET /friends ────────────────────────────────────────────────────────────
export const listFriends = async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .populate({
                path: "friends",
                select: "name email lastLogin profileId",
                populate: { path: "profileId", select: "avatar displayName status presence tier" },
            })
            .lean();

        const friends = (user?.friends || []).map(shapeUser);
        const onlineCount = friends.filter((f) => f.presence !== "offline").length;

        res.status(200).json({ success: true, friends, onlineCount });
    } catch (error) {
        console.log("Error in listFriends:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── GET /friends/requests ───────────────────────────────────────────────────
export const listRequests = async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .select("friendRequests")
            .lean();

        const incomingIds = user?.friendRequests?.incoming?.map((r) => r.userId) || [];
        const outgoingIds = user?.friendRequests?.outgoing?.map((r) => r.userId) || [];

        const [incoming, outgoing] = await Promise.all([
            User.find({ _id: { $in: incomingIds } })
                .select("name email lastLogin profileId")
                .populate("profileId", "avatar displayName status presence tier")
                .lean(),
            User.find({ _id: { $in: outgoingIds } })
                .select("name email lastLogin profileId")
                .populate("profileId", "avatar displayName status presence tier")
                .lean(),
        ]);

        res.status(200).json({
            success: true,
            incoming: incoming.map(shapeUser),
            outgoing: outgoing.map(shapeUser),
        });
    } catch (error) {
        console.log("Error in listRequests:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── POST /friends/request ───────────────────────────────────────────────────
export const sendRequest = async (req, res) => {
    try {
        const { targetId } = req.body;
        if (!targetId) return res.status(400).json({ success: false, message: "targetId is required" });
        if (targetId === req.userId) return res.status(400).json({ success: false, message: "You cannot add yourself" });

        const [sender, target] = await Promise.all([
            User.findById(req.userId)
                .select("name email friends friendRequests profileId")
                .populate("profileId", "avatar displayName")
                .lean(),
            User.findById(targetId).select("friends friendRequests").lean(),
        ]);

        if (!target) return res.status(404).json({ success: false, message: "User not found" });

        const alreadyFriends = sender?.friends?.some((id) => id.toString() === targetId);
        if (alreadyFriends) return res.status(400).json({ success: false, message: "Already friends" });

        const outgoingExists = sender?.friendRequests?.outgoing?.some((r) => r.userId.toString() === targetId);
        if (outgoingExists) return res.status(400).json({ success: false, message: "Request already sent" });

        const incomingExists = sender?.friendRequests?.incoming?.some((r) => r.userId.toString() === targetId);
        if (incomingExists) {
            await Promise.all([
                User.findByIdAndUpdate(req.userId, {
                    $pull: { "friendRequests.incoming": { userId: targetId } },
                    $addToSet: { friends: targetId },
                }),
                User.findByIdAndUpdate(targetId, {
                    $pull: { "friendRequests.outgoing": { userId: req.userId } },
                    $addToSet: { friends: req.userId },
                }),
            ]);
            // Realtime notify both users about new friendship + requests update
            try {
                const { io } = await import("../socket.js");
                io.to(`user:${targetId}`).emit("friends:updated", { userId: targetId });
                io.to(`user:${req.userId}`).emit("friends:updated", { userId: req.userId });
                io.to(`user:${targetId}`).emit("friends:requests:update", { userId: targetId });
                io.to(`user:${req.userId}`).emit("friends:requests:update", { userId: req.userId });
            } catch { }
            return res.status(200).json({ success: true, message: "Friend request accepted" });
        }

        await Promise.all([
            User.findByIdAndUpdate(req.userId, {
                $addToSet: { "friendRequests.outgoing": { userId: targetId } },
            }),
            User.findByIdAndUpdate(targetId, {
                $addToSet: { "friendRequests.incoming": { userId: req.userId } },
            }),
        ]);

        res.status(200).json({ success: true, message: "Friend request sent" });

        // Realtime notify both users (requests update should fire even if notification fails)
        try {
            const { io } = await import("../socket.js");
            io.to(`user:${targetId}`).emit("friends:requests:update", { userId: targetId });
            io.to(`user:${req.userId}`).emit("friends:requests:update", { userId: req.userId });
            try {
                const notification = await Notification.create({
                    userId: targetId,
                    type: "friend",
                    meta: {
                        action: "request",
                        requesterId: req.userId,
                        requesterName: sender?.profileId?.displayName || sender?.name || "Member",
                        requesterAvatar: sender?.profileId?.avatar || "",
                    },
                });
                io.to(`user:${targetId}`).emit("new_notification", notification);
            } catch { }
        } catch { }
    } catch (error) {
        console.log("Error in sendRequest:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── POST /friends/accept ────────────────────────────────────────────────────
export const acceptRequest = async (req, res) => {
    try {
        const { requesterId } = req.body;
        if (!requesterId) return res.status(400).json({ success: false, message: "requesterId is required" });
        if (requesterId === req.userId) return res.status(400).json({ success: false, message: "You cannot accept yourself" });

        const [currentUser, requester] = await Promise.all([
            User.findById(req.userId).select("friendRequests friends").lean(),
            User.findById(requesterId).select("_id").lean(),
        ]);

        if (!requester) return res.status(404).json({ success: false, message: "User not found" });

        const hasIncoming = currentUser?.friendRequests?.incoming?.some((r) => r.userId?.toString?.() === requesterId);
        if (!hasIncoming) {
            return res.status(400).json({ success: false, message: "No pending request from this user" });
        }

        const alreadyFriends = currentUser?.friends?.some((id) => id?.toString?.() === requesterId);
        if (alreadyFriends) {
            return res.status(400).json({ success: false, message: "Already friends" });
        }

        const accepter = await User.findById(req.userId)
            .select("name email profileId")
            .populate("profileId", "avatar displayName")
            .lean();

        await Promise.all([
            User.findByIdAndUpdate(req.userId, {
                $pull: { "friendRequests.incoming": { userId: requesterId } },
                $addToSet: { friends: requesterId },
            }),
            User.findByIdAndUpdate(requesterId, {
                $pull: { "friendRequests.outgoing": { userId: req.userId } },
                $addToSet: { friends: req.userId },
            }),
        ]);

        res.status(200).json({ success: true, message: "Friend request accepted" });

        // Realtime notify both users
        try {
            const { io } = await import("../socket.js");
            io.to(`user:${requesterId}`).emit("friends:updated", { userId: requesterId });
            io.to(`user:${req.userId}`).emit("friends:updated", { userId: req.userId });
            io.to(`user:${requesterId}`).emit("friends:requests:update", { userId: requesterId });
            io.to(`user:${req.userId}`).emit("friends:requests:update", { userId: req.userId });

            if (accepter) {
                try {
                    const notification = await Notification.create({
                        userId: requesterId,
                        type: "friend",
                        meta: {
                            action: "accepted",
                            requesterId: req.userId,
                            requesterName: accepter?.profileId?.displayName || accepter?.name || "Member",
                            requesterAvatar: accepter?.profileId?.avatar || "",
                        },
                    });
                    io.to(`user:${requesterId}`).emit("new_notification", notification);
                } catch { }
            }
        } catch { }
    } catch (error) {
        console.log("Error in acceptRequest:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── GET /friends/search ────────────────────────────────────────────────────
export const searchUsers = async (req, res) => {
    try {
        const q = (req.query.q || "").trim();
        const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 10));
        if (q.length < 2) {
            return res.status(200).json({ success: true, users: [] });
        }

        const self = await User.findById(req.userId)
            .select("friends friendRequests")
            .lean();

        const friendIds = new Set((self?.friends || []).map((id) => id?.toString?.() || String(id)));
        const incomingIds = new Set((self?.friendRequests?.incoming || []).map((r) => r.userId?.toString?.() || String(r.userId)));
        const outgoingIds = new Set((self?.friendRequests?.outgoing || []).map((r) => r.userId?.toString?.() || String(r.userId)));
        const selfFriendIds = new Set((self?.friends || []).map((id) => id?.toString?.() || String(id)));

        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escaped, "i");

        const candidates = await User.find({
            _id: { $ne: req.userId },
            $or: [
                { name: regex },
                { email: regex },
            ],
        })
            .select("name email lastLogin profileId friends")
            .populate("profileId", "avatar displayName status presence tier")
            .limit(limit * 3)
            .lean();

        const users = [];
        for (const u of candidates) {
            const id = u?._id?.toString?.() || String(u?._id || "");
            if (!id) continue;
            const candidateFriendIds = new Set((u?.friends || []).map((fid) => fid?.toString?.() || String(fid)));
            const mutualFriendsCount = Array.from(candidateFriendIds).reduce((acc, fid) => acc + (selfFriendIds.has(fid) ? 1 : 0), 0);

            let relationship = "none";
            if (friendIds.has(id)) relationship = "friend";
            else if (incomingIds.has(id)) relationship = "incoming";
            else if (outgoingIds.has(id)) relationship = "outgoing";

            users.push({
                ...shapeUser(u),
                relationship,
                mutualFriendsCount,
            });
            if (users.length >= limit) break;
        }

        return res.status(200).json({ success: true, users });
    } catch (error) {
        console.log("Error in searchUsers:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── POST /friends/decline ───────────────────────────────────────────────────
export const declineRequest = async (req, res) => {
    try {
        const { requesterId } = req.body;
        if (!requesterId) return res.status(400).json({ success: false, message: "requesterId is required" });

        await Promise.all([
            User.findByIdAndUpdate(req.userId, {
                $pull: { "friendRequests.incoming": { userId: requesterId } },
            }),
            User.findByIdAndUpdate(requesterId, {
                $pull: { "friendRequests.outgoing": { userId: req.userId } },
            }),
        ]);

        res.status(200).json({ success: true, message: "Friend request declined" });

        // Realtime notify both users
        try {
            const { io } = await import("../socket.js");
            io.to(`user:${requesterId}`).emit("friends:requests:update", { userId: requesterId });
            io.to(`user:${req.userId}`).emit("friends:requests:update", { userId: req.userId });
            io.to(`user:${requesterId}`).emit("friends:request:declined", {
                byUserId: req.userId,
            });
        } catch { }
    } catch (error) {
        console.log("Error in declineRequest:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── POST /friends/remove ───────────────────────────────────────────────────
export const removeFriend = async (req, res) => {
    try {
        const { targetId } = req.body;
        if (!targetId) return res.status(400).json({ success: false, message: "targetId is required" });
        if (targetId === req.userId) return res.status(400).json({ success: false, message: "You cannot remove yourself" });

        const target = await User.findById(targetId).select("_id").lean();
        if (!target) return res.status(404).json({ success: false, message: "User not found" });

        await Promise.all([
            User.findByIdAndUpdate(req.userId, {
                $pull: {
                    friends: targetId,
                    "friendRequests.incoming": { userId: targetId },
                    "friendRequests.outgoing": { userId: targetId },
                },
            }),
            User.findByIdAndUpdate(targetId, {
                $pull: {
                    friends: req.userId,
                    "friendRequests.incoming": { userId: req.userId },
                    "friendRequests.outgoing": { userId: req.userId },
                },
            }),
        ]);

        res.status(200).json({ success: true, message: "Friend removed" });

        try {
            const { io } = await import("../socket.js");
            io.to(`user:${targetId}`).emit("friends:updated", { userId: targetId });
            io.to(`user:${req.userId}`).emit("friends:updated", { userId: req.userId });
            io.to(`user:${targetId}`).emit("friends:requests:update", { userId: targetId });
            io.to(`user:${req.userId}`).emit("friends:requests:update", { userId: req.userId });
        } catch { }
    } catch (error) {
        console.log("Error in removeFriend:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
