import DmThread from "../models/dmThread.model.js";
import DmMessage from "../models/dmMessage.model.js";
const shapeUser = (u) => {
    const profile = u.profileId || {};
    const displayName = profile.displayName || u.name || "Member";
    const username = u.email ? u.email.split("@")[0] : (u.name || "user").toLowerCase();
    return {
        _id: u._id,
        displayName,
        username,
        avatar: profile.avatar || "",
        presence: profile.presence || "offline",
        statusText: profile.status || "",
    };
};

const shapeThread = (thread, currentUserId) => {
    const participants = (thread.participants || []).map(shapeUser);
    const others = participants.filter((p) => p._id.toString() !== currentUserId.toString());
    const displayName = others.length > 1
        ? `${others.slice(0, 2).map((p) => p.displayName).join(", ")}${others.length > 2 ? ` +${others.length - 2}` : ""}`
        : (others[0]?.displayName || "Direct Message");
    return {
        _id: thread._id,
        participants,
        isGroup: !!thread.isGroup || participants.length > 2,
        displayName,
        memberCount: participants.length,
        lastMessageAt: thread.lastMessageAt,
    };
};

// Ensure a thread exists between two users
const getOrCreateThread = async (userId, otherId) => {
    let thread = await DmThread.findOne({
        participants: { $all: [userId, otherId], $size: 2 },
        isGroup: { $ne: true },
    });
    if (!thread) {
        thread = await DmThread.create({ participants: [userId, otherId] });
    }
    return thread;
};

export const getThread = async (req, res) => {
    try {
        const { userId } = req.params;
        const thread = await getOrCreateThread(req.userId, userId);
        res.status(200).json({ success: true, threadId: thread._id });
    } catch (error) {
        console.log("Error in getThread:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getThreads = async (req, res) => {
    try {
        const threads = await DmThread.find({ participants: req.userId })
            .sort({ lastMessageAt: -1 })
            .populate({ path: "participants", populate: { path: "profileId" } })
            .lean();
        const shaped = threads.map((thread) => shapeThread(thread, req.userId));
        res.status(200).json({ success: true, threads: shaped });
    } catch (error) {
        console.log("Error in getThreads:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getThreadInfo = async (req, res) => {
    try {
        const { threadId } = req.params;
        const thread = await DmThread.findById(threadId)
            .populate({ path: "participants", populate: { path: "profileId" } })
            .lean();
        if (!thread) {
            return res.status(404).json({ success: false, message: "Thread not found" });
        }
        const isParticipant = thread.participants.some((p) => p._id.toString() === req.userId.toString());
        if (!isParticipant) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        res.status(200).json({ success: true, thread: shapeThread(thread, req.userId) });
    } catch (error) {
        console.log("Error in getThreadInfo:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const createGroupThread = async (req, res) => {
    try {
        const { participantIds } = req.body || {};
        const ids = Array.from(new Set([req.userId, ...(participantIds || [])])).filter(Boolean);
        if (ids.length < 2) {
            return res.status(400).json({ success: false, message: "At least 2 participants are required" });
        }
        if (ids.length > 5) {
            return res.status(400).json({ success: false, message: "Group DM limit is 5 members" });
        }
        const existing = await DmThread.findOne({
            participants: { $all: ids, $size: ids.length },
        }).populate({ path: "participants", populate: { path: "profileId" } });
        const thread = existing || await DmThread.create({ participants: ids, isGroup: true });
        if (existing && !thread.isGroup) {
            thread.isGroup = true;
            await thread.save();
        }
        const populated = existing
            ? thread
            : await DmThread.findById(thread._id).populate({ path: "participants", populate: { path: "profileId" } });
        const shaped = shapeThread(populated.toObject ? populated.toObject() : populated, req.userId);

        try {
            const { io } = await import("../socket.js");
            ids.forEach((id) => {
                io.to(`user:${id}`).emit("dm:thread:updated", shaped);
            });
        } catch { }

        res.status(201).json({ success: true, thread: shaped });
    } catch (error) {
        console.log("Error in createGroupThread:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const addParticipants = async (req, res) => {
    try {
        const { threadId } = req.params;
        const { participantIds } = req.body || {};
        if (!Array.isArray(participantIds) || participantIds.length === 0) {
            return res.status(400).json({ success: false, message: "Participants required" });
        }
        const thread = await DmThread.findById(threadId);
        if (!thread) {
            return res.status(404).json({ success: false, message: "Thread not found" });
        }
        if (!thread.participants.some((p) => p.toString() === req.userId.toString())) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        const existingIds = new Set(thread.participants.map((id) => id.toString()));
        participantIds.forEach((id) => existingIds.add(id.toString()));
        if (existingIds.size > 5) {
            return res.status(400).json({ success: false, message: "Group DM limit is 5 members" });
        }
        thread.participants = Array.from(existingIds);
        thread.isGroup = thread.isGroup || existingIds.size > 2;
        thread.lastMessageAt = new Date();
        await thread.save();

        const populated = await DmThread.findById(threadId).populate({ path: "participants", populate: { path: "profileId" } });
        const shaped = shapeThread(populated.toObject ? populated.toObject() : populated, req.userId);

        try {
            const { io } = await import("../socket.js");
            shaped.participants.forEach((p) => {
                io.to(`user:${p._id}`).emit("dm:thread:updated", shaped);
            });
        } catch { }

        res.status(200).json({ success: true, thread: shaped });
    } catch (error) {
        console.log("Error in addParticipants:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getMessages = async (req, res) => {
    try {
        const { threadId } = req.params;
        const messages = await DmMessage.find({ threadId })
            .sort({ createdAt: 1 })
            .populate({
                path: 'replyTo',
                select: 'content senderId',
                populate: { path: 'senderId', select: 'name profileId' }
            })
            .lean();
        res.status(200).json({ success: true, messages });
    } catch (error) {
        console.log("Error in getMessages:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const sendMessage = async (req, res) => {
    try {
        const { threadId } = req.params;
        const { content, mediaURLs, replyTo } = req.body;
        if ((!content || !content.trim()) && (!mediaURLs || mediaURLs.length === 0)) {
            return res.status(400).json({ success: false, message: "Message or media is required" });
        }
        const message = await DmMessage.create({
            threadId,
            senderId: req.userId,
            content: content?.trim() || "",
            mediaURLs: mediaURLs || [],
            replyTo: replyTo || null,
        });

        if (message.replyTo) {
            await message.populate({
                path: 'replyTo',
                select: 'content senderId',
                populate: { path: 'senderId', select: 'name profileId' }
            });
        }

        await DmThread.findByIdAndUpdate(threadId, { lastMessageAt: new Date() });

        res.status(201).json({ success: true, message });

        try {
            const { io } = await import("../socket.js");
            io.to(`dm:${threadId}`).emit("dm:message", message);
        } catch { }
    } catch (error) {
        console.log("Error in sendMessage:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const editMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { content } = req.body;
        const message = await DmMessage.findById(messageId);
        if (!message) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        // Enforcement: 15-minute edit limit
        const EDIT_LIMIT_MS = 15 * 60 * 1000;
        const timeElapsed = Date.now() - new Date(message.createdAt).getTime();
        if (timeElapsed > EDIT_LIMIT_MS) {
            return res.status(403).json({ success: false, message: "You can no longer edit this message (15 minute limit reached)" });
        }

        if (message.senderId.toString() !== req.userId.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        if (!content || !content.trim()) {
            return res.status(400).json({ success: false, message: "Content is required" });
        }
        message.content = content.trim();
        message.isEdited = true;
        await message.save();

        if (message.replyTo) {
            await message.populate({
                path: 'replyTo',
                select: 'content senderId',
                populate: { path: 'senderId', select: 'name profileId' }
            });
        }

        res.status(200).json({ success: true, message });
        try {
            const { io } = await import("../socket.js");
            io.to(`dm:${message.threadId}`).emit("dm:message_edited", message);
        } catch { }
    } catch (error) {
        console.log("Error in editMessage:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const leaveThread = async (req, res) => {
    try {
        const { threadId } = req.params;
        const thread = await DmThread.findById(threadId);
        if (!thread) {
            return res.status(404).json({ success: false, message: "Thread not found" });
        }
        if (!thread.participants.some((p) => p.toString() === req.userId.toString())) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        const wasGroup = !!thread.isGroup || thread.participants.length > 2;
        const remaining = thread.participants.filter((id) => id.toString() !== req.userId.toString());
        if (remaining.length <= 1) {
            await DmMessage.deleteMany({ threadId });
            await DmThread.findByIdAndDelete(threadId);
            try {
                const { io } = await import("../socket.js");
                remaining.forEach((id) => {
                    io.to(`user:${id}`).emit("dm:thread:removed", { threadId });
                });
            } catch { }
            return res.status(200).json({ success: true, deleted: true });
        }

        thread.participants = remaining;
        thread.isGroup = wasGroup;
        thread.lastMessageAt = new Date();
        await thread.save();

        const populated = await DmThread.findById(threadId).populate({ path: "participants", populate: { path: "profileId" } });
        const shaped = shapeThread(populated.toObject ? populated.toObject() : populated, req.userId);

        try {
            const { io } = await import("../socket.js");
            remaining.forEach((id) => {
                io.to(`user:${id}`).emit("dm:thread:updated", shaped);
            });
        } catch { }

        res.status(200).json({ success: true, thread: shaped });
    } catch (error) {
        console.log("Error in leaveThread:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
export const deleteDmMessage = async (req, res) => {
    try {
        const { threadId, messageId } = req.params;
        const message = await DmMessage.findById(messageId);
        if (!message || message.threadId.toString() !== threadId) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }
        if (message.senderId.toString() !== req.userId.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        await DmMessage.findByIdAndDelete(messageId);
        res.status(200).json({ success: true, message: "Message deleted" });
        try {
            const { io } = await import("../socket.js");
            io.to(`dm:${threadId}`).emit("dm:message:deleted", { messageId });
        } catch { }
    } catch (error) {
        console.log("Error in deleteDmMessage:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
