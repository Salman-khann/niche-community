import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://localhost:3000'
].filter(Boolean);

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
                callback(null, true);
            } else {
                callback(null, true);
            }
        },
        credentials: true,
    },
});

const ROOM_EMPTY_TTL_MS = 30000;
const MAX_CALL_PARTICIPANTS = 5;
let redisStateClient = null;

// ── Redis Adapter (optional — graceful fallback for dev) ─────────────────────
async function attachRedisAdapter() {
    try {
        const { createAdapter } = await import("@socket.io/redis-adapter");
        const { default: Redis } = await import("ioredis");

        const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

        // Upstash / cloud Redis uses rediss:// (TLS) — ioredis needs `tls` enabled
        const useTls = redisUrl.startsWith("rediss://");
        const redisOpts = {
            maxRetriesPerRequest: null, // required by @socket.io/redis-adapter
            ...(useTls ? { tls: { rejectUnauthorized: false } } : {}),
        };

        const pubClient = new Redis(redisUrl, redisOpts);
        const subClient = pubClient.duplicate();

        await Promise.all([
            new Promise((resolve, reject) => {
                pubClient.on("ready", resolve);
                pubClient.on("error", reject);
            }),
            new Promise((resolve, reject) => {
                subClient.on("ready", resolve);
                subClient.on("error", reject);
            }),
        ]);

        io.adapter(createAdapter(pubClient, subClient));
        redisStateClient = pubClient;
        console.log("✅ Socket.io Redis adapter connected");
    } catch (error) {
        console.log("⚠️  Redis not available — running Socket.io in-memory (fine for dev)");
        console.log("   Reason:", error.message || error);
    }
}

attachRedisAdapter();

// ── Socket Events ────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Join a community room for scoped broadcasts
    socket.on("join_community_room", async (communityId) => {
        if (communityId) {
            socket.join(`community:${communityId}`);
            socket.data.activeCommunityId = communityId;
            console.log(`   → ${socket.id} joined room community:${communityId}`);

            const useRedisVoice = !!redisStateClient && redisStateClient.status === "ready";
            if (useRedisVoice) {
                try {
                    const communityValue = communityId?.toString?.() || String(communityId);
                    const keys = await redisStateClient.keys("voice:channel:*:community");
                    for (const key of keys) {
                        const value = await redisStateClient.get(key);
                        if (!value || value.toString() !== communityValue) continue;
                        const channelId = key.split(":")[2];
                        const memberMap = await redisStateClient.hgetall(`voice:channel:${channelId}:members`);
                        const members = Object.entries(memberMap || {}).map(([sid, raw]) => {
                            try {
                                return { socketId: sid, ...JSON.parse(raw) };
                            } catch {
                                return null;
                            }
                        }).filter(Boolean);
                        socket.emit("voice:members", { channelId, members });
                    }
                } catch {
                    // fall back to process-local state below
                }
            }

            if (!useRedisVoice && io.voiceState?.channels && io.voiceState?.channelCommunity) {
                const targetId = communityId?.toString?.() || String(communityId);
                io.voiceState.channelCommunity.forEach((communityForChannel, channelId) => {
                    const channelCommunityId = communityForChannel?.toString?.() || String(communityForChannel);
                    if (channelCommunityId !== targetId) return;
                    const channelMap = io.voiceState.channels.get(channelId);
                    const members = channelMap
                        ? Array.from(channelMap.entries()).map(([sid, info]) => ({
                              socketId: sid,
                              ...info,
                          }))
                        : [];
                    socket.emit("voice:members", { channelId, members });
                });
            }
        }
    });

    socket.on("leave_community_room", (communityId) => {
        if (communityId) {
            socket.leave(`community:${communityId}`);
            if (socket.data.activeCommunityId === communityId) {
                socket.data.activeCommunityId = null;
            }
        }
    });

    // Join a global feed room (for dev, since we have one community)
    socket.on("join_feed", () => {
        socket.join("feed");
        console.log(`   → ${socket.id} joined feed room`);
    });

    // Join the events room for real-time event updates
    socket.on("join_events", () => {
        socket.join("events");
        console.log(`   → ${socket.id} joined events room`);
    });

    // Join a user-specific room for personal notifications
    socket.on("join_user_room", (userId) => {
        if (userId) {
            socket.join(`user:${userId}`);
            socket.data.userId = userId;
            console.log(`   → ${socket.id} joined room user:${userId}`);
        }
    });

    // Join a DM thread room
    socket.on("join_dm", (threadId) => {
        if (threadId) {
            socket.join(`dm:${threadId}`);
        }
    });

    // ── Direct Message Calls ───────────────────────────────────────────────
    socket.on("dm:call:start", ({ toUserId, threadId, fromUser, threadMeta }) => {
        if (!toUserId || !threadId) return;
        io.to(`user:${toUserId}`).emit("dm:call:incoming", {
            threadId,
            fromUser,
            threadMeta,
        });
    });

    socket.on("dm:call:accept", ({ toUserId, threadId }) => {
        if (!toUserId || !threadId) return;
        io.to(`user:${toUserId}`).emit("dm:call:accepted", { threadId });
    });

    socket.on("dm:call:decline", ({ toUserId, threadId }) => {
        if (!toUserId || !threadId) return;
        io.to(`user:${toUserId}`).emit("dm:call:declined", { threadId });
    });

    socket.on("dm:call:cancel", ({ toUserId, threadId }) => {
        if (!toUserId || !threadId) return;
        io.to(`user:${toUserId}`).emit("dm:call:cancelled", { threadId });
    });

    socket.on("dm:call:end", ({ toUserId, threadId }) => {
        if (!toUserId || !threadId) return;
        io.to(`user:${toUserId}`).emit("dm:call:ended", { threadId });
    });

    // Join a channel room for realtime chat
    socket.on("join_channel", (channelId) => {
        if (channelId) {
            socket.join(`channel:${channelId}`);
        }
    });

    socket.on("channel:typing", ({ channelId, userId, isTyping }) => {
        if (channelId) {
            socket.to(`channel:${channelId}`).emit("channel:typing", { channelId, userId, isTyping });
        }
    });

    // Typing indicator
    socket.on("dm:typing", ({ threadId, userId, isTyping }) => {
        if (threadId) {
            socket.to(`dm:${threadId}`).emit("dm:typing", { threadId, userId, isTyping });
        }
    });

    // ── Voice Channels (WebRTC signaling) ───────────────────────────────────
    if (!io.voiceState) {
        io.voiceState = {
            channels: new Map(), // channelId -> Map(socketId -> user)
            socketToChannel: new Map(),
            channelCommunity: new Map(), // channelId -> communityId
            cleanupTimers: new Map(), // channelId -> timeout
        };
    }

    if (!io.callRooms) {
        io.callRooms = new Map(); // roomId -> { users: Map<userId, { socketId, displayName, avatar }>, invited: Set, cleanupTimer }
    }

    const getCallRoom = (roomId) => {
        if (!roomId) return null;
        const key = roomId?.toString?.() || String(roomId);
        let room = io.callRooms.get(key);
        if (!room) {
            room = { users: new Map(), invited: new Set(), cleanupTimer: null };
            io.callRooms.set(key, room);
        }
        return room;
    };

    const clearCallRoomCleanup = (roomId) => {
        const key = roomId?.toString?.() || String(roomId);
        const room = io.callRooms.get(key);
        if (room?.cleanupTimer) {
            clearTimeout(room.cleanupTimer);
            room.cleanupTimer = null;
        }
    };

    const scheduleCallRoomCleanup = (roomId) => {
        const key = roomId?.toString?.() || String(roomId);
        const room = io.callRooms.get(key);
        if (!room) return;
        if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
        room.cleanupTimer = setTimeout(() => {
            const latest = io.callRooms.get(key);
            if (!latest) return;
            if (latest.users.size > 0) return;
            io.callRooms.delete(key);
        }, ROOM_EMPTY_TTL_MS);
    };

    const buildRoomUsersPayload = (room) => Array.from(room.users.entries()).map(([userId, info]) => ({
        userId,
        socketId: info.socketId,
        displayName: info.displayName,
        avatar: info.avatar,
    }));

    const joinCallRoom = (socketRef, roomId, user) => {
        if (!roomId) return null;
        const userId = user?.userId || socketRef.data.userId;
        if (!userId) return null;
        socketRef.data.userId = userId;
        if (user?.displayName) socketRef.data.displayName = user.displayName;
        if (user?.avatar) socketRef.data.avatar = user.avatar;
        const room = getCallRoom(roomId);
        if (!room) return null;
        const existing = room.users.get(userId);
        const isRejoin = existing && existing.socketId !== socketRef.id;
        const isDuplicate = existing && existing.socketId === socketRef.id;
        if (!existing && room.users.size >= MAX_CALL_PARTICIPANTS) {
            return { room, isFull: true, userId };
        }
        room.users.set(userId, {
            socketId: socketRef.id,
            displayName: user?.displayName || socketRef.data.displayName || "Member",
            avatar: user?.avatar || socketRef.data.avatar || "",
        });
        room.invited.delete(userId);
        clearCallRoomCleanup(roomId);
        socketRef.join(`callroom:${roomId}`);
        socketRef.data.activeCallRoom = roomId;
        return { room, isRejoin, isDuplicate, userId };
    };

    const leaveCallRoom = (socketRef, roomId) => {
        const key = roomId?.toString?.() || String(roomId || '');
        if (!key) return null;
        const room = io.callRooms.get(key);
        if (!room) return null;
        const userId = socketRef.data.userId;
        if (userId) {
            const existing = room.users.get(userId);
            if (existing && existing.socketId === socketRef.id) {
                room.users.delete(userId);
            }
        }
        socketRef.leave(`callroom:${key}`);
        if (socketRef.data.activeCallRoom === key) {
            socketRef.data.activeCallRoom = null;
        }
        if (room.users.size === 0) {
            scheduleCallRoomCleanup(key);
        }
        return { room, userId };
    };

    const clearRoomCleanup = (channelKey) => {
        const timer = io.voiceState.cleanupTimers.get(channelKey);
        if (timer) {
            clearTimeout(timer);
            io.voiceState.cleanupTimers.delete(channelKey);
        }
    };

    const scheduleRoomCleanup = (channelKey) => {
        clearRoomCleanup(channelKey);
        const timeout = setTimeout(() => {
            const channelMap = io.voiceState.channels.get(channelKey);
            if (channelMap && channelMap.size > 0) return;
            io.voiceState.channels.delete(channelKey);
            io.voiceState.channelCommunity.delete(channelKey);
            io.voiceState.cleanupTimers.delete(channelKey);
        }, ROOM_EMPTY_TTL_MS);
        io.voiceState.cleanupTimers.set(channelKey, timeout);
    };

    const useRedisVoiceState = () => !!redisStateClient && redisStateClient.status === "ready";

    const readVoiceMembers = async (channelKey) => {
        if (useRedisVoiceState()) {
            const map = await redisStateClient.hgetall(`voice:channel:${channelKey}:members`);
            return Object.entries(map || {}).map(([sid, raw]) => {
                try {
                    return { socketId: sid, ...JSON.parse(raw) };
                } catch {
                    return null;
                }
            }).filter(Boolean);
        }
        const channelMap = io.voiceState.channels.get(channelKey);
        return channelMap
            ? Array.from(channelMap.entries()).map(([sid, info]) => ({ socketId: sid, ...info }))
            : [];
    };

    const emitVoiceMembers = async (channelId, communityOverride) => {
        const channelKey = channelId?.toString?.() || String(channelId);
        const members = await readVoiceMembers(channelKey);
        io.to(`voice:${channelKey}`).emit("voice:members", { channelId: channelKey, members });
        io.to(`voicewatch:${channelKey}`).emit("voice:members", { channelId: channelKey, members });
        let communityId = communityOverride || io.voiceState.channelCommunity.get(channelKey);
        if (!communityId && useRedisVoiceState()) {
            communityId = await redisStateClient.get(`voice:channel:${channelKey}:community`);
        }
        if (communityId) {
            io.to(`community:${communityId}`).emit("voice:members", { channelId: channelKey, members });
        }
    };

    const leaveVoiceChannel = async () => {
        let currentChannel = io.voiceState.socketToChannel.get(socket.id);
        if (!currentChannel && useRedisVoiceState()) {
            currentChannel = await redisStateClient.get(`voice:socket:${socket.id}:channel`);
        }
        if (!currentChannel) return;
        const channelMap = io.voiceState.channels.get(currentChannel);
        const communityId = io.voiceState.channelCommunity.get(currentChannel);
        if (channelMap) {
            channelMap.delete(socket.id);
            if (channelMap.size === 0) {
                scheduleRoomCleanup(currentChannel);
            }
        }
        io.voiceState.socketToChannel.delete(socket.id);
        if (useRedisVoiceState()) {
            await redisStateClient.hdel(`voice:channel:${currentChannel}:members`, socket.id);
            await redisStateClient.del(`voice:socket:${socket.id}:channel`);
            const leftCount = await redisStateClient.hlen(`voice:channel:${currentChannel}:members`);
            if (leftCount === 0) {
                await redisStateClient.del(`voice:channel:${currentChannel}:community`);
            }
        }
        socket.leave(`voice:${currentChannel}`);
        socket.to(`voice:${currentChannel}`).emit("voice:peer-left", { socketId: socket.id });
        await emitVoiceMembers(currentChannel, communityId);
    };

    socket.on("voice:join", async ({ channelId, user, communityId }) => {
        if (!channelId) return;
        const channelKey = channelId?.toString?.() || String(channelId);
        if (user?.userId) {
            socket.data.userId = user.userId;
        }
        if (user?.displayName) socket.data.displayName = user.displayName;
        if (user?.avatar) socket.data.avatar = user.avatar;
        const callRoom = io.callRooms?.get(channelKey);
        const currentUserId = user?.userId || socket.data.userId;
        if (callRoom && currentUserId && !callRoom.users.has(currentUserId) && callRoom.users.size >= MAX_CALL_PARTICIPANTS) {
            socket.emit("room-join-denied", { roomId: channelKey, reason: "full", max: MAX_CALL_PARTICIPANTS });
            return;
        }
        clearRoomCleanup(channelKey);
        await leaveVoiceChannel();
        socket.join(`voice:${channelKey}`);

        const channelMap = io.voiceState.channels.get(channelKey) || new Map();
        const voiceInfo = {
            userId: user?.userId || null,
            displayName: user?.displayName || "Member",
            avatar: user?.avatar || "",
            isMuted: false,
            isSharing: false,
            isCameraOn: false,
            screenStreamId: null,
        };
        channelMap.set(socket.id, voiceInfo);
        io.voiceState.channels.set(channelKey, channelMap);
        io.voiceState.socketToChannel.set(socket.id, channelKey);
        const resolvedCommunityId = communityId || socket.data.activeCommunityId;
        if (resolvedCommunityId) {
            io.voiceState.channelCommunity.set(channelKey, resolvedCommunityId);
        }
        if (useRedisVoiceState()) {
            await redisStateClient.hset(`voice:channel:${channelKey}:members`, socket.id, JSON.stringify(voiceInfo));
            await redisStateClient.set(`voice:socket:${socket.id}:channel`, channelKey, "EX", 60 * 60 * 12);
            if (resolvedCommunityId) {
                await redisStateClient.set(`voice:channel:${channelKey}:community`, `${resolvedCommunityId}`);
            }
        }

        const peers = Array.from(channelMap.entries())
            .filter(([sid]) => sid !== socket.id)
            .map(([sid, info]) => ({ socketId: sid, ...info }));

        socket.emit("voice:peers", { channelId: channelKey, peers });
        socket.to(`voice:${channelKey}`).emit("voice:peer-joined", {
            socketId: socket.id,
            userId: user?.userId || null,
            displayName: user?.displayName || "Member",
            avatar: user?.avatar || "",
            isMuted: false,
        });
        await emitVoiceMembers(channelKey);
    });

    socket.on("voice:leave", async () => {
        await leaveVoiceChannel();
    });

    // ── Call Room Invites ─────────────────────────────────────────────────
    socket.on("invite-to-room", ({ roomId, invitedUserIds, roomMeta }) => {
        const senderId = socket.data.userId;
        if (!roomId || !senderId || !Array.isArray(invitedUserIds)) return;
        const room = getCallRoom(roomId);
        if (!room || !room.users.has(senderId)) return;
        const availableSlots = MAX_CALL_PARTICIPANTS - room.users.size;
        if (availableSlots <= 0) {
            socket.emit("room-invite-error", { roomId, reason: "full", max: MAX_CALL_PARTICIPANTS });
            return;
        }
        let remaining = availableSlots;
        invitedUserIds.forEach((userId) => {
            if (remaining <= 0) return;
            if (!userId) return;
            if (room.users.has(userId)) return;
            if (room.invited.has(userId)) return;
            room.invited.add(userId);
            remaining -= 1;
            io.to(`user:${userId}`).emit("room-invite", {
                roomId,
                invitedBy: senderId,
                invitedByName: socket.data.displayName || null,
                invitedByAvatar: socket.data.avatar || null,
                roomMeta: roomMeta || null,
            });
        });
    });

    socket.on("accept-room-invite", ({ roomId, user }) => {
        if (!roomId) return;
        const result = joinCallRoom(socket, roomId, user);
        if (!result) return;
        const { room, isDuplicate, isRejoin, userId, isFull } = result;
        if (isFull) {
            socket.emit("room-join-denied", { roomId, reason: "full", max: MAX_CALL_PARTICIPANTS });
            return;
        }
        const usersPayload = buildRoomUsersPayload(room);
        socket.emit("room-users", { roomId, users: usersPayload });
        if (!isDuplicate) {
            socket.to(`callroom:${roomId}`).emit("user-joined", {
                roomId,
                userId,
                socketId: socket.id,
                displayName: socket.data.displayName || "Member",
                avatar: socket.data.avatar || "",
                rejoined: !!isRejoin,
            });
        }
    });

    socket.on("reject-room-invite", ({ roomId, invitedBy }) => {
        const userId = socket.data.userId;
        if (!roomId || !userId) return;
        const room = getCallRoom(roomId);
        if (!room) return;
        room.invited.delete(userId);
        io.to(`callroom:${roomId}`).emit("room-invite-updated", { roomId, userId, status: "rejected" });
        if (invitedBy) {
            io.to(`user:${invitedBy}`).emit("room-invite-updated", { roomId, userId, status: "rejected" });
        }
    });

    socket.on("join-room", ({ roomId, user }) => {
        if (!roomId) return;
        const result = joinCallRoom(socket, roomId, user);
        if (!result) return;
        const { room, isDuplicate, isRejoin, userId, isFull } = result;
        if (isFull) {
            socket.emit("room-join-denied", { roomId, reason: "full", max: MAX_CALL_PARTICIPANTS });
            return;
        }
        const usersPayload = buildRoomUsersPayload(room);
        socket.emit("room-users", { roomId, users: usersPayload });
        if (!isDuplicate) {
            socket.to(`callroom:${roomId}`).emit("user-joined", {
                roomId,
                userId,
                socketId: socket.id,
                displayName: socket.data.displayName || "Member",
                avatar: socket.data.avatar || "",
                rejoined: !!isRejoin,
            });
        }
    });

    socket.on("leave-room", ({ roomId }) => {
        if (!roomId) return;
        const result = leaveCallRoom(socket, roomId);
        if (!result) return;
        const { userId } = result;
        socket.to(`callroom:${roomId}`).emit("user-left", { roomId, userId, socketId: socket.id });
    });

    socket.on("signal", ({ to, data }) => {
        if (!to) return;
        io.to(to).emit("signal", { from: socket.id, fromUserId: socket.data.userId || null, data });
    });

    socket.on("voice:watch", async ({ channelId }) => {
        if (!channelId) return;
        const channelKey = channelId?.toString?.() || String(channelId);
        socket.join(`voicewatch:${channelKey}`);
        await emitVoiceMembers(channelKey);
    });

    socket.on("voice:unwatch", ({ channelId }) => {
        if (!channelId) return;
        const channelKey = channelId?.toString?.() || String(channelId);
        socket.leave(`voicewatch:${channelKey}`);
    });

    socket.on("voice:peek", async ({ channelId }) => {
        if (!channelId) return;
        const channelKey = channelId?.toString?.() || String(channelId);
        const members = await readVoiceMembers(channelKey);
        socket.emit("voice:room-status", { roomId: channelKey, members });
    });

    socket.on("voice:signal", ({ to, data }) => {
        if (!to) return;
        io.to(to).emit("voice:signal", { from: socket.id, data });
    });

    socket.on("voice:share-stop", async ({ channelId }) => {
        if (!channelId) return;
        const channelKey = channelId?.toString?.() || String(channelId);
        const channelMap = io.voiceState?.channels?.get(channelKey);
        if (channelMap?.has(socket.id)) {
            const current = channelMap.get(socket.id);
            const updated = { ...current, isSharing: false, screenStreamId: null };
            channelMap.set(socket.id, updated);
            if (useRedisVoiceState()) {
                await redisStateClient.hset(`voice:channel:${channelKey}:members`, socket.id, JSON.stringify(updated));
            }
            await emitVoiceMembers(channelKey);
        }
        socket.to(`voice:${channelId}`).emit("voice:share-stopped", { socketId: socket.id });
    });

    socket.on("voice:share-start", async ({ channelId, streamId }) => {
        if (!channelId) return;
        const channelKey = channelId?.toString?.() || String(channelId);
        const channelMap = io.voiceState?.channels?.get(channelKey);
        if (channelMap?.has(socket.id)) {
            const current = channelMap.get(socket.id);
            const updated = { ...current, isSharing: true, screenStreamId: streamId || null };
            channelMap.set(socket.id, updated);
            if (useRedisVoiceState()) {
                await redisStateClient.hset(`voice:channel:${channelKey}:members`, socket.id, JSON.stringify(updated));
            }
            await emitVoiceMembers(channelKey);
        }
        socket.to(`voice:${channelId}`).emit("voice:share-started", { socketId: socket.id, streamId: streamId || null });
    });

    socket.on("voice:camera-stop", async ({ channelId }) => {
        if (!channelId) return;
        const channelKey = channelId?.toString?.() || String(channelId);
        const channelMap = io.voiceState?.channels?.get(channelKey);
        if (channelMap?.has(socket.id)) {
            const current = channelMap.get(socket.id);
            const updated = { ...current, isCameraOn: false };
            channelMap.set(socket.id, updated);
            if (useRedisVoiceState()) {
                await redisStateClient.hset(`voice:channel:${channelKey}:members`, socket.id, JSON.stringify(updated));
            }
            await emitVoiceMembers(channelKey);
        }
        socket.to(`voice:${channelId}`).emit("voice:camera-stopped", { socketId: socket.id });
    });

    socket.on("voice:camera-start", async ({ channelId }) => {
        if (!channelId) return;
        const channelKey = channelId?.toString?.() || String(channelId);
        const channelMap = io.voiceState?.channels?.get(channelKey);
        if (channelMap?.has(socket.id)) {
            const current = channelMap.get(socket.id);
            const updated = { ...current, isCameraOn: true };
            channelMap.set(socket.id, updated);
            if (useRedisVoiceState()) {
                await redisStateClient.hset(`voice:channel:${channelKey}:members`, socket.id, JSON.stringify(updated));
            }
            await emitVoiceMembers(channelKey);
        }
    });

    socket.on("voice:mute", async ({ channelId, isMuted }) => {
        const channelKey = channelId?.toString?.() || String(channelId);
        const channelMap = io.voiceState?.channels?.get(channelKey);
        if (!channelMap) return;
        const userInfo = channelMap.get(socket.id);
        if (!userInfo) return;
        const updated = { ...userInfo, isMuted: !!isMuted };
        channelMap.set(socket.id, updated);
        if (useRedisVoiceState()) {
            await redisStateClient.hset(`voice:channel:${channelKey}:members`, socket.id, JSON.stringify(updated));
        }
        await emitVoiceMembers(channelKey);
    });

    socket.on("voice:reaction", async ({ channelId, emoji, user }) => {
        if (!channelId || !emoji) return;
        const channelKey = channelId?.toString?.() || String(channelId);
        const roomName = `voice:${channelKey}`;
        if (!socket.rooms.has(roomName)) return;
        let memberInfo = io.voiceState?.channels?.get(channelKey)?.get(socket.id) || null;
        if (!memberInfo && useRedisVoiceState()) {
            const raw = await redisStateClient.hget(`voice:channel:${channelKey}:members`, socket.id);
            if (raw) {
                try {
                    memberInfo = JSON.parse(raw);
                } catch {
                    memberInfo = null;
                }
            }
        }
        const payload = {
            channelId: channelKey,
            socketId: socket.id,
            userId: memberInfo?.userId || socket.data.userId || user?.userId || null,
            displayName: memberInfo?.displayName || socket.data.displayName || user?.displayName || "Member",
            avatar: memberInfo?.avatar || socket.data.avatar || user?.avatar || "",
            emoji,
            createdAt: Date.now(),
        };
        io.to(`voice:${channelKey}`).emit("voice:reaction", payload);
        io.to(`voicewatch:${channelKey}`).emit("voice:reaction", payload);
        const communityId = io.voiceState?.channelCommunity?.get(channelKey)
            || (useRedisVoiceState() ? await redisStateClient.get(`voice:channel:${channelKey}:community`) : null);
        if (communityId) {
            io.to(`community:${communityId}`).emit("voice:reaction", payload);
        }
    });

    socket.on("disconnect", async () => {
        if (socket.data.activeCallRoom) {
            const roomId = socket.data.activeCallRoom;
            const result = leaveCallRoom(socket, roomId);
            if (result) {
                socket.to(`callroom:${roomId}`).emit("user-left", { roomId, userId: result.userId, socketId: socket.id });
            }
        }
        await leaveVoiceChannel();
        console.log(`🔌 Client disconnected: ${socket.id}`);
    });
});

export { io, app, server };
