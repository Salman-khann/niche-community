import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';
import { SOCKET_URL } from '../config/urls';

/**
 * Custom hook to manage the Socket.io client connection.
 * Connects on mount, joins the "feed" room and a user-specific room
 * for personal notifications, and disconnects on unmount.
 *
 * Uses useState (not useRef) so that when the socket is created it triggers
 * a re-render, allowing consuming components to register event listeners.
 *
 * @param {string} [userId] - The logged-in user's ID (for personal notifications)
 * @returns {object} socket - the Socket.io client instance
 */
const useSocket = (userId, communityId) => {
    const [socket, setSocket] = useState(null);
    const prevCommunityRef = useRef(null);

    useEffect(() => {
        // Connect to the Socket.io server
        const newSocket = io(SOCKET_URL, {
            withCredentials: true,
            transports: ['websocket', 'polling'],
        });

        newSocket.on('connect', () => {
            console.log('🔌 Socket connected:', newSocket.id);
            // Join the global feed room
            newSocket.emit('join_feed');
            // Join user-specific room for notifications
            if (userId) {
                newSocket.emit('join_user_room', userId);
            }
            // Join active community room for presence updates
            if (communityId) {
                newSocket.emit('join_community_room', communityId);
            }
        });

        newSocket.on('disconnect', () => {
            console.log('🔌 Socket disconnected');
        });

        const handleRoleUpdate = (payload) => {
            const communityId = payload?.communityId;
            const nextRole = payload?.role;
            if (!communityId || !nextRole) return;
            const { user, setUser } = useAuthStore.getState();
            if (!user?.memberships) return;
            let found = false;
            const updatedMemberships = user.memberships.map((m) => {
                const id = m.communityId?._id || m.communityId;
                if ((id?.toString?.() || String(id)) === (communityId?.toString?.() || String(communityId))) {
                    found = true;
                    return { ...m, role: nextRole };
                }
                return m;
            });
            if (!found) return;
            setUser({
                ...user,
                role: payload?.globalRole || user.role,
                memberships: updatedMemberships,
            });
        };
        newSocket.on('community:role_updated', handleRoleUpdate);

        const handleNotification = (notification) => {
            if (!notification?._id) return;
            const store = useNotificationStore.getState();
            store.addNotification(notification);

            const prefs = store.prefs || {};
            const canBrowserNotify = typeof window !== 'undefined' && 'Notification' in window;
            if (!prefs.pushEnabled || !canBrowserNotify) return;
            if (document.visibilityState === 'visible') return;
            if (Notification.permission !== 'granted') return;

            const meta = notification.meta || {};
            const title = meta.eventTitle || meta.communityName || 'CircleCore';
            const body = meta.commentSnippet || meta.postSnippet || meta.messageSnippet || 'You have a new notification';
            try {
                new Notification(title, { body, tag: `notif-${notification._id}` });
            } catch {
                // ignore browser notification errors
            }
        };
        newSocket.on('new_notification', handleNotification);

        const handleMemberAdded = (payload) => {
            const community = payload?.community;
            if (!community?._id) return;
            const { user, setUser } = useAuthStore.getState();
            if (!user) return;
            const exists = (user.memberships || []).some((m) => {
                const id = m.communityId?._id || m.communityId;
                return (id?.toString?.() || String(id)) === (community._id?.toString?.() || String(community._id));
            });
            if (exists) return;
            const nextMemberships = [
                ...(user.memberships || []),
                { communityId: community, role: payload?.role || 'member' },
            ];
            setUser({ ...user, memberships: nextMemberships });
        };
        newSocket.on('community:member_added', handleMemberAdded);

        const handleKicked = ({ communityId }) => {
            if (!communityId) return;
            const { user, setUser } = useAuthStore.getState();
            if (!user) return;
            const nextMemberships = (user.memberships || []).filter((m) => {
                const id = m.communityId?._id || m.communityId;
                return (id?.toString?.() || String(id)) !== (communityId?.toString?.() || String(communityId));
            });
            if (nextMemberships.length === (user.memberships || []).length) return;
            setUser({ ...user, memberships: nextMemberships });
        };
        newSocket.on('community:kicked', handleKicked);

        setSocket(newSocket);

        // Cleanup on unmount
        return () => {
            newSocket.off('community:role_updated', handleRoleUpdate);
            newSocket.off('new_notification', handleNotification);
            newSocket.off('community:member_added', handleMemberAdded);
            newSocket.off('community:kicked', handleKicked);
            newSocket.disconnect();
            setSocket(null);
        };
    }, [userId]);

    useEffect(() => {
        if (!socket) return;
        const prev = prevCommunityRef.current;
        if (prev && prev !== communityId) {
            socket.emit('leave_community_room', prev);
        }
        if (communityId) {
            socket.emit('join_community_room', communityId);
        }
        prevCommunityRef.current = communityId || null;
    }, [socket, communityId]);

    return socket;
};

export default useSocket;
