import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Hash, Search, Users, Pin, HelpCircle, User, MessageCircle, Phone, MoreVertical, Settings, Menu, X, Server, Compass, Maximize2, MoreHorizontal, MonitorUp, UserPlus, MoveHorizontal, Lock } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useFeedStore } from '../stores/feedStore';
import { useProfileStore } from '../stores/profileStore';
import { useRosterStore } from '../stores/rosterStore';
import { useMemberStore } from '../stores/memberStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import WorkspaceSwitcher from '../components/WorkspaceSwitcher';
import Sidebar from '../components/Sidebar';
import { useChannelStore } from '../stores/channelStore';
import { useChannelMessageStore } from '../stores/channelMessageStore';
import { useFriendStore } from '../stores/friendStore';
import { useServerInviteStore } from '../stores/serverInviteStore';
import ProfilePopout from '../components/ProfilePopout';
import MemberProfilePopout from '../components/MemberProfilePopout';
import ProfileSettingsModal from '../components/ProfileSettingsModal';
import NotificationBell from '../components/NotificationBell';
import useSocket from '../hooks/useSocket';
import useVoiceCall from '../hooks/useVoiceCall';
import { useDmStore } from '../stores/dmStore';
import DmPanel from '../components/DmPanel';
import ChannelChat from '../components/ChannelChat';
import VoiceAudioPlayer from '../components/VoiceAudioPlayer';
import VoiceVideoPlayer from '../components/VoiceVideoPlayer';
import { useEventStore } from '../stores/eventStore';
import { apiFetch } from '../stores/apiFetch';
import { normalizeEmojiShortcodes } from '../utils/emojiShortcodes';

const presenceColor = (presence) => {
    if (presence === 'dnd') return 'bg-red-500';
    if (presence === 'idle') return 'bg-yellow-400';
    if (presence === 'offline') return 'bg-discord-faint/60';
    return 'bg-discord-green';
};

const filterStatusText = (text) => {
    const value = (text || '').trim();
    if (!value) return '';
    if (value.toLowerCase() === 'eat sleep code repeat') return '';
    return value;
};

const FeedPage = () => {
    const [viewMode, setViewMode] = useState('server'); // 'server' | 'friends' | 'dm'
    const [showProfilePopout, setShowProfilePopout] = useState(false);
    const [showProfileSettings, setShowProfileSettings] = useState(false);
    const [showPins, setShowPins] = useState(false);
    const [activeTab, setActiveTab] = useState('online');
    const [showMemberList, setShowMemberList] = useState(true);
    const [memberSearchQuery, setMemberSearchQuery] = useState('');
    const [selectedMember, setSelectedMember] = useState(null);
    const [showMemberPopout, setShowMemberPopout] = useState(false);
    const [friendIdInput, setFriendIdInput] = useState('');
    const [addFriendSearchQuery, setAddFriendSearchQuery] = useState('');
    const [friendSearchQuery, setFriendSearchQuery] = useState('');
    const [requestFilter, setRequestFilter] = useState('all');
    const [activeFriendMenuId, setActiveFriendMenuId] = useState(null);
    const [showMobileSidebar, setShowMobileSidebar] = useState(false);
    const [showMobileDmList, setShowMobileDmList] = useState(false);
    const [showMobileServers, setShowMobileServers] = useState(false);
    const [mobileDirectorySignal, setMobileDirectorySignal] = useState(0);
    const [isServerSwitching, setIsServerSwitching] = useState(false);
    const [editChannelSignal, setEditChannelSignal] = useState(0);
    const [pendingEditChannelId, setPendingEditChannelId] = useState(null);
    const [dmRoomStatus, setDmRoomStatus] = useState({});
    const [showCallInvite, setShowCallInvite] = useState(false);
    const [callInviteSearch, setCallInviteSearch] = useState('');
    const [callInviteSelection, setCallInviteSelection] = useState([]);
    const [callInviteError, setCallInviteError] = useState('');
    const [roomInvites, setRoomInvites] = useState({});
    const [incomingRoomInvite, setIncomingRoomInvite] = useState(null);
    const [callToast, setCallToast] = useState('');
    const { user, setUser } = useAuthStore();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { uploadFile, fetchFeed } = useFeedStore();
    const { profile, updateProfile } = useProfileStore();
    const { activeCommunityId, setActiveCommunity } = useWorkspaceStore();
    const { friends: rosterFriends, fetchRoster, updatePresence: updateRosterPresence } = useRosterStore();
    const { members: communityMembers, fetchMembers: fetchCommunityMembers } = useMemberStore();
    const { channels, activeChannelId, fetchChannels, setActiveChannel, clearChannels } = useChannelStore();
    const {
        searchResults: channelSearchResults,
        searchLoading: channelSearchLoading,
        searchError: channelSearchError,
        searchHasMore: channelSearchHasMore,
        searchMessages,
        loadMoreSearchResults,
        clearSearch: clearChannelMessageSearch,
        jumpToMessage,
    } = useChannelMessageStore();
    const {
        friends,
        onlineCount,
        incoming,
        outgoing,
        isLoading: isFriendLoading,
        error: friendError,
        success: friendSuccess,
        fetchFriends,
        fetchRequests,
        sendRequest,
        acceptRequest,
        declineRequest,
        removeFriend,
        searchUsers,
        searchResults,
        clearMessages,
        updatePresence: updateFriendPresence,
        removeOutgoing,
    } = useFriendStore();
    const {
        invites,
        isLoading: isInviteLoading,
        error: inviteError,
        fetchInvites,
        acceptInvite,
        declineInvite,
        clearError: clearInviteError,
    } = useServerInviteStore();
    const {
        threadId,
        messages,
        threads: dmThreads,
        openThread,
        setThreadId,
        fetchThreads,
        fetchThreadInfo,
        createGroupThread,
        addParticipants: addParticipantsToThread,
        leaveThread,
        removeThread,
        fetchMessages,
        sendMessage,
        pushMessage,
        upsertThread,
    } = useDmStore();
    const { fetchEvents, handleNewEvent, handleRsvpUpdate, handleDeleteEvent, handleUpdateEvent, handleStartEvent, handleEndEvent } = useEventStore();
    const [activeDm, setActiveDm] = useState(null);
    const [dmText, setDmText] = useState('');
    const [dmFiles, setDmFiles] = useState([]);
    const [dmSending, setDmSending] = useState(false);
    const [typingUser, setTypingUser] = useState(null);
    const [showStreamViewer, setShowStreamViewer] = useState(true);
    const [fullscreenStream, setFullscreenStream] = useState(null);
    const [hoveredVoiceTile, setHoveredVoiceTile] = useState(null);
    const [showShareModePicker, setShowShareModePicker] = useState(false);
    const [showVoiceStageView, setShowVoiceStageView] = useState(false);
    const [previewVoiceChannel, setPreviewVoiceChannel] = useState(null);
    const [showVoiceInviteModal, setShowVoiceInviteModal] = useState(false);
    const [showVoiceStageChatDrawer, setShowVoiceStageChatDrawer] = useState(false);
    const [voiceStageChatWidth, setVoiceStageChatWidth] = useState(420);
    const [channelSearchQuery, setChannelSearchQuery] = useState('');
    const [showChannelSearchPanel, setShowChannelSearchPanel] = useState(false);
    const [channelSearchJumpError, setChannelSearchJumpError] = useState('');
    const [voiceInviteSearch, setVoiceInviteSearch] = useState('');
    const [invitingVoiceUserIds, setInvitingVoiceUserIds] = useState([]);
    const [voiceInvitedUserIds, setVoiceInvitedUserIds] = useState([]);
    const [showGroupAdd, setShowGroupAdd] = useState(false);
    const [groupSearch, setGroupSearch] = useState('');
    const [groupSelection, setGroupSelection] = useState([]);
    const [groupError, setGroupError] = useState('');
    const [roles, setRoles] = useState([]);
    const streamVideoRef = useRef(null);
    const previousStagePresenceRef = useRef({ channelId: null, count: 0 });
    const isResizingVoiceStageChatRef = useRef(false);
    const voiceStageResizeStartXRef = useRef(0);
    const voiceStageResizeStartWidthRef = useRef(420);
    const typingTimeoutRef = useRef(null);
    const channelSearchPanelRef = useRef(null);
    const prevCommunityIdRef = useRef(activeCommunityId);
    const [incomingCall, setIncomingCall] = useState(null);
    const [outgoingCall, setOutgoingCall] = useState(null);
    const [activeDmCall, setActiveDmCall] = useState(null);
    const [ongoingDmCalls, setOngoingDmCalls] = useState(() => new Set());
    const [voicePresence, setVoicePresence] = useState({});
    const ringtoneRef = useRef({ ctx: null, timer: null });

    const displayName = profile?.displayName || profile?.name || user?.name || 'Usman';
    const username = user?.username || 'usman1943';
    const statusText = profile?.bio || 'No bio yet';

    const buildDmEntry = useCallback((thread) => {
        if (!thread) return null;
        const participants = thread.participants || [];
        const others = participants.filter((p) => p._id !== user?._id);
        const isGroup = !!thread.isGroup || others.length > 1;
        const displayName = isGroup
            ? `${others.slice(0, 2).map((p) => p.displayName).join(', ')}${others.length > 2 ? ` +${others.length - 2}` : ''}`
            : (others[0]?.displayName || thread.displayName || 'Direct Message');
        const subtitle = isGroup ? `${participants.length} Members` : (others[0]?.username || '');
        return {
            ...thread,
            participants,
            others,
            isGroup,
            displayName,
            subtitle,
            avatar: !isGroup ? (others[0]?.avatar || '') : '',
            presence: !isGroup ? (others[0]?.presence || 'offline') : 'online',
        };
    }, [user?._id]);

    useEffect(() => {
        const openDir = searchParams.get('openDirectory');
        if (openDir === 'true') {
            setMobileDirectorySignal((prev) => prev + 1);
            // Clear the param without refreshing to avoid re-opening on every render
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('openDirectory');
            navigate(`/feed?${newParams.toString()}`, { replace: true });
        }
    }, [searchParams, navigate]);

    const playRingtone = useCallback(() => {
        if (ringtoneRef.current.timer) return;
        const ringOnce = () => {
            try {
                if (!ringtoneRef.current.ctx) {
                    ringtoneRef.current.ctx = new (window.AudioContext || window.webkitAudioContext)();
                }
                const ctx = ringtoneRef.current.ctx;
                const gain = ctx.createGain();
                gain.gain.value = 0.0;
                gain.connect(ctx.destination);

                const toneA = ctx.createOscillator();
                toneA.type = 'sine';
                toneA.frequency.value = 523.25;
                toneA.connect(gain);

                const toneB = ctx.createOscillator();
                toneB.type = 'sine';
                toneB.frequency.value = 659.25;
                toneB.connect(gain);

                const now = ctx.currentTime;
                gain.gain.linearRampToValueAtTime(0.06, now + 0.02);
                gain.gain.linearRampToValueAtTime(0.0, now + 0.42);

                toneA.start(now);
                toneB.start(now);
                toneA.stop(now + 0.45);
                toneB.stop(now + 0.45);
            } catch {
                // ignore audio errors
            }
        };
        ringOnce();
        ringtoneRef.current.timer = setInterval(ringOnce, 1400);
    }, []);

    const stopRingtone = useCallback(() => {
        if (ringtoneRef.current.timer) {
            clearInterval(ringtoneRef.current.timer);
            ringtoneRef.current.timer = null;
        }
    }, []);

    useEffect(() => {
        if (!user?.memberships || user.memberships.length === 0) {
            setViewMode('friends');
        }
    }, [user?.memberships?.length]);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['online', 'all', 'pending', 'requests', 'invites', 'add'].includes(tab)) {
            setViewMode('friends');
            setActiveTab(tab === 'pending' ? 'requests' : tab);
        }
    }, [searchParams]);

    useEffect(() => {
        if (!activeCommunityId) return;
        fetchRoster();
    }, [activeCommunityId, fetchRoster]);

    useEffect(() => {
        setVoicePresence({});
    }, [activeCommunityId]);

    useEffect(() => {
        if (!user?._id) return;
        fetchThreads();
    }, [user?._id, fetchThreads]);

    useEffect(() => {
        if (!pendingEditChannelId || pendingEditChannelId !== activeChannelId) return;
        setEditChannelSignal((v) => v + 1);
        setPendingEditChannelId(null);
    }, [pendingEditChannelId, activeChannelId]);

    useEffect(() => {
        if (!activeCommunityId) {
            setRoles([]);
            return;
        }
        let cancelled = false;
        const fetchRoles = async () => {
            try {
                const res = await apiFetch(`/api/communities/${activeCommunityId}/roles`, {
                    credentials: 'include',
                    headers: { 'x-community-id': activeCommunityId },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Failed to fetch roles');
                if (!cancelled) setRoles(data.roles || []);
            } catch {
                if (!cancelled) setRoles([]);
            }
        };
        fetchRoles();
        return () => { cancelled = true; };
    }, [activeCommunityId]);

    const socket = useSocket(user?._id, activeCommunityId);
    const {
        activeVoiceChannel,
        participants: voiceParticipants,
        remoteMedia,
        remoteScreenStreams,
        remoteCameraStreams,
        localScreenStream,
        localCameraStream,
        isMuted,
        isDeafened,
        isSharing,
        isCameraOn,
        noiseReduction,
        liveReactions,
        connectedPeerIds,
        elapsed,
        joinVoice,
        leaveVoice,
        toggleMute,
        toggleDeafen,
        toggleNoiseReduction,
        startCamera,
        stopCamera,
        startScreenShare,
        stopScreenShare,
        sendReaction,
    } = useVoiceCall(socket, user, profile);

    const remoteCameraStream = remoteCameraStreams[0]?.stream || null;
    const screenShareTiles = useMemo(() => {
        const tiles = [];
        if (localScreenStream) {
            tiles.push({
                id: 'local-share',
                stream: localScreenStream,
                ownerName: displayName || 'You',
                isLocal: true,
            });
        }
        remoteScreenStreams.forEach((item) => {
            const name = voiceParticipants.find((p) => p.socketId === item.socketId)?.displayName || 'Someone';
            tiles.push({
                id: `remote-share-${item.socketId}`,
                stream: item.stream,
                ownerName: name,
                isLocal: false,
            });
        });
        return tiles;
    }, [localScreenStream, remoteScreenStreams, voiceParticipants, displayName]);
    const activeScreenShareTile = screenShareTiles.find((tile) => !tile.isLocal) || screenShareTiles[0] || null;
    const screenShareStream = screenShareTiles[0]?.stream || null;
    const isRemoteScreenShare = screenShareTiles.some((t) => !t.isLocal);
    const showStreamFullscreen = !!fullscreenStream;
    const remoteCameraMap = useMemo(() => {
        const map = new Map();
        remoteCameraStreams.forEach((item) => {
            if (item?.socketId) map.set(item.socketId, item.stream);
        });
        return map;
    }, [remoteCameraStreams]);
    const primaryVoiceTile = useMemo(() => {
        if (activeScreenShareTile?.stream) {
            return {
                id: activeScreenShareTile.id,
                title: `${activeScreenShareTile.ownerName || 'Member'} is sharing`,
                subtitle: 'Screen Share',
                stream: activeScreenShareTile.stream,
                isLocal: !!activeScreenShareTile.isLocal,
            };
        }

        const localEntry = voiceParticipants.find((p) => p.isLocal) || null;
        const fallbackEntry = localEntry || voiceParticipants[0] || null;
        if (!fallbackEntry) return null;
        const stream = fallbackEntry.isLocal
            ? localCameraStream
            : remoteCameraMap.get(fallbackEntry.socketId) || null;
        return {
            id: `voice-tile-${fallbackEntry.socketId || fallbackEntry.userId || 'member'}`,
            title: fallbackEntry.displayName || 'Member',
            subtitle: stream ? 'Camera Live' : 'No Video',
            stream,
            avatar: fallbackEntry.avatar || '',
            isLocal: !!fallbackEntry.isLocal,
        };
    }, [activeScreenShareTile, voiceParticipants, localCameraStream, remoteCameraMap]);
    const stageVoiceChannel = previewVoiceChannel || activeVoiceChannel;
    const isViewingActiveVoiceChannel = !!activeVoiceChannel?._id && activeVoiceChannel?._id === stageVoiceChannel?._id;
    const stagePresenceMembers = useMemo(() => {
        const channelId = stageVoiceChannel?._id;
        if (!channelId) return [];
        if (isViewingActiveVoiceChannel) return voiceParticipants || [];
        const list = voicePresence?.[channelId] || [];
        return Array.isArray(list) ? list : [];
    }, [stageVoiceChannel?._id, isViewingActiveVoiceChannel, voiceParticipants, voicePresence]);
    const secondaryVoiceTiles = useMemo(() => {
        if (!isViewingActiveVoiceChannel) return [];
        const primaryId = primaryVoiceTile?.id;
        return (voiceParticipants || [])
            .map((member, index) => {
                const stream = member?.isLocal
                    ? localCameraStream
                    : remoteCameraMap.get(member?.socketId) || null;
                return {
                    id: `voice-member-${member?.socketId || member?.userId || index}`,
                    title: member?.displayName || 'Member',
                    stream,
                    avatar: member?.avatar || '',
                };
            })
            .filter((tile) => tile.id !== primaryId);
    }, [isViewingActiveVoiceChannel, voiceParticipants, localCameraStream, remoteCameraMap, primaryVoiceTile?.id]);
    const inCallUserIds = useMemo(() => new Set(
        (voiceParticipants || []).map((p) => p.userId).filter(Boolean)
    ), [voiceParticipants]);
    const inviteCandidates = useMemo(() => {
        const query = (voiceInviteSearch || '').trim().toLowerCase();
        return (rosterFriends || []).filter((m) => {
            if (!m?._id) return false;
            if (m._id === user?._id) return false;
            if (inCallUserIds.has(m._id)) return false;
            if (!query) return true;
            const name = (m.displayName || '').toLowerCase();
            const handle = (m.username || '').toLowerCase();
            return name.includes(query) || handle.includes(query);
        });
    }, [voiceInviteSearch, rosterFriends, user?._id, inCallUserIds]);
    const showServerVoiceStage = viewMode === 'server' && !!stageVoiceChannel && showVoiceStageView;
    const shouldRenderVoiceStageChatDrawer = showServerVoiceStage && showVoiceStageChatDrawer;

    const openShareModePicker = useCallback(() => {
        setShowShareModePicker(true);
    }, []);

    const closeShareModePicker = useCallback(() => {
        setShowShareModePicker(false);
    }, []);

    const openVoiceStageView = useCallback(() => {
        if (!activeVoiceChannel) return;
        setPreviewVoiceChannel(activeVoiceChannel);
        setShowVoiceStageView(true);
    }, [activeVoiceChannel]);

    const closeVoiceStageView = useCallback(() => {
        setShowVoiceStageView(false);
        setPreviewVoiceChannel(null);
        setShowVoiceInviteModal(false);
        setShowVoiceStageChatDrawer(false);
    }, []);

    const toggleVoiceChannelChatDrawer = useCallback(() => {
        const voiceChannelId = stageVoiceChannel?._id;
        if (!voiceChannelId) return;
        if (activeChannelId !== voiceChannelId) {
            setActiveChannel(voiceChannelId);
        }
        setShowVoiceStageChatDrawer((prev) => !prev);
    }, [stageVoiceChannel?._id, activeChannelId, setActiveChannel]);

    const startVoiceStageChatResize = useCallback((event) => {
        if (!shouldRenderVoiceStageChatDrawer) return;
        event.preventDefault();
        isResizingVoiceStageChatRef.current = true;
        voiceStageResizeStartXRef.current = event.clientX;
        voiceStageResizeStartWidthRef.current = voiceStageChatWidth;
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
    }, [shouldRenderVoiceStageChatDrawer, voiceStageChatWidth]);

    useEffect(() => {
        const handleMouseMove = (event) => {
            if (!isResizingVoiceStageChatRef.current) return;
            const delta = voiceStageResizeStartXRef.current - event.clientX;
            const maxAllowed = Math.min(760, Math.floor(window.innerWidth * 0.7));
            const nextWidth = Math.min(maxAllowed, Math.max(320, voiceStageResizeStartWidthRef.current + delta));
            setVoiceStageChatWidth(nextWidth);
        };

        const handleMouseUp = () => {
            if (!isResizingVoiceStageChatRef.current) return;
            isResizingVoiceStageChatRef.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, []);

    const handleShareToggle = useCallback(() => {
        if (isSharing) {
            stopScreenShare();
            return;
        }
        openShareModePicker();
    }, [isSharing, stopScreenShare, openShareModePicker]);

    const startShareWithMode = useCallback(async (mode) => {
        setShowShareModePicker(false);
        const includeAudio = mode !== 'window';
        await startScreenShare({ mode, includeAudio });
    }, [startScreenShare]);

    const sendQuickReaction = useCallback((emoji) => {
        sendReaction(emoji);
    }, [sendReaction]);

    useEffect(() => {
        if (screenShareTiles.length > 0) {
            setShowStreamViewer(true);
        }
    }, [screenShareTiles.length]);

    useEffect(() => {
        if (activeVoiceChannel) {
            setPreviewVoiceChannel(activeVoiceChannel);
            return;
        }
        setShowShareModePicker(false);
        setShowVoiceInviteModal(false);
        setShowVoiceStageChatDrawer(false);
        setVoiceInviteSearch('');
        setInvitingVoiceUserIds([]);
        setVoiceInvitedUserIds([]);
        if (!previewVoiceChannel?._id) {
            setShowVoiceStageView(false);
        }
    }, [activeVoiceChannel, previewVoiceChannel?._id]);

    useEffect(() => {
        if (isViewingActiveVoiceChannel) return;
        setShowVoiceInviteModal(false);
    }, [isViewingActiveVoiceChannel]);

    useEffect(() => {
        if (!showVoiceStageView || viewMode !== 'server') return;
        const activeType = (channels.find((ch) => ch._id === activeChannelId) || channels[0])?.type || 'text';
        if (!['text', 'announcement', 'forum'].includes(activeType)) return;
        closeVoiceStageView();
    }, [showVoiceStageView, viewMode, channels, activeChannelId, closeVoiceStageView]);

    useEffect(() => {
        const channelId = stageVoiceChannel?._id || null;
        const count = stagePresenceMembers.length;
        const previous = previousStagePresenceRef.current;

        if (!showVoiceStageView || !channelId || isViewingActiveVoiceChannel) {
            previousStagePresenceRef.current = { channelId, count };
            return;
        }

        const roomJustEnded = previous.channelId === channelId && previous.count > 0 && count === 0;
        if (roomJustEnded) {
            closeVoiceStageView();
        }

        previousStagePresenceRef.current = { channelId, count };
    }, [showVoiceStageView, stageVoiceChannel?._id, stagePresenceMembers.length, isViewingActiveVoiceChannel, closeVoiceStageView]);

    useEffect(() => {
        setVoiceInvitedUserIds((prev) => prev.filter((id) => !inCallUserIds.has(id)));
    }, [inCallUserIds]);

    const inviteUserToVoice = useCallback((member) => {
        if (!socket || !activeVoiceChannel?._id || !member?._id) return;
        const targetId = member._id;
        if (inCallUserIds.has(targetId)) return;
        if (invitingVoiceUserIds.includes(targetId)) return;
        setInvitingVoiceUserIds((prev) => [...prev, targetId]);
        socket.emit('invite-to-room', {
            roomId: activeVoiceChannel._id,
            invitedUserIds: [targetId],
            roomMeta: {
                type: 'voice',
                channelName: activeVoiceChannel?.name || 'Voice Channel',
                communityId: activeCommunityId,
            },
        });
        setVoiceInvitedUserIds((prev) => (prev.includes(targetId) ? prev : [...prev, targetId]));
        setTimeout(() => {
            setInvitingVoiceUserIds((prev) => prev.filter((id) => id !== targetId));
        }, 500);
    }, [socket, activeVoiceChannel?._id, activeVoiceChannel?.name, activeCommunityId, inCallUserIds, invitingVoiceUserIds]);

    useEffect(() => {
        if (!fullscreenStream) return;
        const activeStreams = new Set([screenShareStream, remoteCameraStream, localCameraStream].filter(Boolean));
        if (activeStreams.size === 0 || !activeStreams.has(fullscreenStream)) {
            setFullscreenStream(null);
        }
    }, [fullscreenStream, screenShareStream, remoteCameraStream, localCameraStream]);

    useEffect(() => {
        if (!socket) return;
        socket.emit('join_events');
        const handlePresence = (payload) => {
            if (payload?.userId === user?._id) {
                useProfileStore.setState((state) => ({
                    profile: {
                        ...(state.profile || {}),
                        presence: payload.presence ?? state.profile?.presence,
                        bio: payload.bio ?? state.profile?.bio,
                        displayName: payload.displayName ?? state.profile?.displayName,
                        avatar: payload.avatar ?? state.profile?.avatar,
                    },
                }));
            }
            if (payload?.userId) {
                updateFriendPresence(payload.userId, payload.presence);
                updateRosterPresence(payload.userId, payload.presence);
            }
        };
        const handleFriends = () => {
            fetchFriends();
            fetchRequests();
        };
        const handleDmMessage = (msg) => {
            pushMessage(msg);
        };
        const handleTyping = ({ threadId: tId, userId, isTyping }) => {
            if (!tId || tId !== threadId) return;
            if (userId !== user?._id) {
                setTypingUser(isTyping ? userId : null);
            }
        };
        const handleNotification = (notification) => {
            const action = notification?.meta?.action;
            if (action === 'server_invite') {
                fetchInvites().catch(() => { });
            }
            if (notification?.type === 'friend' || action === 'request') {
                fetchRequests().catch(() => { });
                fetchFriends().catch(() => { });
            }
        };
        const handleThreadUpdated = (thread) => {
            if (!thread?._id) return;
            upsertThread(thread);
            if (activeDm?._id === thread._id) {
                setActiveDm(thread);
            }
        };
        const handleThreadRemoved = ({ threadId: removedId }) => {
            if (!removedId) return;
            removeThread(removedId);
            if (activeDmCall?.threadId === removedId) {
                setActiveDmCall(null);
                if (isSharing) stopScreenShare();
                leaveVoice();
            }
            if (activeDm?._id === removedId) {
                setActiveDm(null);
                setThreadId(null);
                setViewMode('dm');
            }
        };
        const handleCommunityMemberJoined = ({ communityId }) => {
            if (!communityId) return;
            const current = activeCommunityId?.toString?.() || String(activeCommunityId || '');
            const incoming = communityId?.toString?.() || String(communityId);
            if (current && current === incoming) {
                fetchRoster();
            }
        };
        const handleCommunityMemberKicked = ({ communityId }) => {
            if (!communityId) return;
            const current = activeCommunityId?.toString?.() || String(activeCommunityId || '');
            const incoming = communityId?.toString?.() || String(communityId);
            if (current && current === incoming) {
                fetchRoster();
            }
        };
        const handleCommunityKicked = ({ communityId }) => {
            if (!communityId) return;
            const current = activeCommunityId?.toString?.() || String(activeCommunityId || '');
            const incoming = communityId?.toString?.() || String(communityId);
            if (current && current === incoming) {
                clearChannels();
                setActiveChannel(null);
                setActiveCommunity(null);
                setViewMode('friends');
            }
        };
        const handleRequestDeclined = ({ byUserId }) => {
            if (byUserId) {
                removeOutgoing(byUserId);
            }
        };
        const handleIncomingCall = (payload) => {
            if (!payload?.threadId || !payload?.fromUser) return;
            if (activeDmCall || outgoingCall) {
                socket.emit('dm:call:decline', { toUserId: payload.fromUser.userId, threadId: payload.threadId });
                return;
            }
            setOngoingDmCalls((prev) => {
                const next = new Set(prev);
                next.add(payload.threadId);
                return next;
            });
            setIncomingCall(payload);
            playRingtone();
        };
        const handleCallAccepted = ({ threadId: tId }) => {
            if (!outgoingCall || outgoingCall.threadId !== tId) return;
            stopRingtone();
            setOutgoingCall(null);
            setActiveDmCall({ threadId: tId, peer: outgoingCall.toUser, isGroup: outgoingCall.toUser?.isGroup });
            setOngoingDmCalls((prev) => {
                const next = new Set(prev);
                next.add(tId);
                return next;
            });
            if (outgoingCall.threadMeta?.participants) {
                const threadEntry = buildDmEntry({
                    _id: tId,
                    participants: outgoingCall.threadMeta.participants,
                    displayName: outgoingCall.threadMeta.displayName,
                    isGroup: true,
                });
                if (threadEntry) {
                    setActiveDm(threadEntry);
                    setThreadId(tId);
                }
            } else {
                setActiveDm(outgoingCall.toUser);
            }
            setViewMode('dm');
            joinVoice({ _id: `dm-${tId}`, name: 'Direct Call' });
        };
        const handleCallDeclined = ({ threadId: tId }) => {
            if (!outgoingCall || outgoingCall.threadId !== tId) return;
            if (outgoingCall.toUsers?.length) return;
            stopRingtone();
            setOutgoingCall(null);
            setOngoingDmCalls((prev) => {
                const next = new Set(prev);
                next.delete(tId);
                return next;
            });
        };
        const handleCallCancelled = ({ threadId: tId }) => {
            if (!incomingCall || incomingCall.threadId !== tId) return;
            stopRingtone();
            setIncomingCall(null);
            setOngoingDmCalls((prev) => {
                const next = new Set(prev);
                next.delete(tId);
                return next;
            });
        };
        const handleCallEnded = ({ threadId: tId }) => {
            setOngoingDmCalls((prev) => {
                const next = new Set(prev);
                next.delete(tId);
                return next;
            });
            if (!tId) return;
            setDmRoomStatus((prev) => ({
                ...prev,
                [tId]: {
                    members: [],
                    count: 0,
                },
            }));
            setRoomInvites((prev) => {
                if (!prev[tId]) return prev;
                return { ...prev, [tId]: [] };
            });
            if (activeDmCall?.threadId === tId) {
                if (activeVoiceChannel?._id === `dm-${tId}`) {
                    leaveVoice();
                }
                setActiveDmCall(null);
            }
        };
        const handleVoicePresence = ({ channelId, members }) => {
            if (!channelId) return;
            const channelKey = channelId?.toString?.() || String(channelId);
            const uniqueMembers = Array.isArray(members)
                ? Array.from((members || []).reduce((acc, member) => {
                    if (!member) return acc;
                    const key = member.userId || member.socketId;
                    if (!key) return acc;
                    if (!acc.has(key)) acc.set(key, member);
                    return acc;
                }, new Map()).values())
                : [];
            if (channelKey.startsWith('dm-')) {
                const threadKey = channelKey.replace(/^dm-/, '');
                const list = uniqueMembers;
                setDmRoomStatus((prev) => ({
                    ...prev,
                    [threadKey]: {
                        members: list,
                        count: list.length,
                    },
                }));
                setRoomInvites((prev) => {
                    const existing = prev[threadKey] || [];
                    if (existing.length === 0) return prev;
                    const memberIds = new Set(list.map((m) => m.userId).filter(Boolean));
                    const filtered = existing.filter((id) => !memberIds.has(id));
                    if (filtered.length === existing.length) return prev;
                    return { ...prev, [threadKey]: filtered };
                });
                return;
            }
            if (uniqueMembers.length === 0) {
                setVoicePresence((prev) => {
                    if (!prev[channelKey]) return prev;
                    const next = { ...prev };
                    delete next[channelKey];
                    return next;
                });
                return;
            }
            setVoicePresence((prev) => {
                const activeKey = activeVoiceChannel?._id?.toString?.() || String(activeVoiceChannel?._id || '');
                const currentUid = user?._id?.toString?.() || String(user?._id || '');
                const others = uniqueMembers.filter((m) => {
                    const uid = m?.userId?.toString?.() || String(m?.userId || '');
                    if (!uid || !currentUid) return true;
                    return uid !== currentUid;
                });
                if (others.length === 0 && channelKey !== activeKey) {
                    if (!prev[channelKey]) return prev;
                    const next = { ...prev };
                    delete next[channelKey];
                    return next;
                }
                return {
                    ...prev,
                    [channelKey]: others,
                };
            });
        };
        const handleRoomStatus = ({ roomId, members }) => {
            if (!roomId || !roomId.startsWith('dm-')) return;
            const threadKey = roomId.replace(/^dm-/, '');
            const list = Array.isArray(members) ? members : [];
            setDmRoomStatus((prev) => ({
                ...prev,
                [threadKey]: {
                    members: list,
                    count: list.length,
                },
            }));
        };
        const handleRoomInvite = (invite) => {
            if (!invite?.roomId) return;
            if (!activeDmCall && !incomingCall) {
                playRingtone();
            }
            setIncomingRoomInvite(invite);
        };
        const handleRoomInviteUpdate = ({ roomId, userId }) => {
            if (!roomId || !userId || !roomId.startsWith('dm-')) return;
            const threadKey = roomId.replace(/^dm-/, '');
            setRoomInvites((prev) => {
                const existing = prev[threadKey] || [];
                if (!existing.includes(userId)) return prev;
                return { ...prev, [threadKey]: existing.filter((id) => id !== userId) };
            });
        };
        const handleRoomJoinDenied = ({ roomId, reason, max }) => {
            if (reason !== 'full') return;
            setCallToast(`Call is full (max ${max || 5} people).`);
            setTimeout(() => setCallToast(''), 2200);
            if (activeVoiceChannel?._id === roomId) {
                leaveVoice();
                setActiveDmCall(null);
            }
        };
        const handleRoomInviteError = ({ reason, max }) => {
            if (reason !== 'full') return;
            setCallToast(`Call is full (max ${max || 5} people).`);
            setTimeout(() => setCallToast(''), 2200);
        };
        const handleNewEventSocket = (event) => handleNewEvent(event);
        const handleRsvpSocket = (payload) => handleRsvpUpdate(payload);
        const handleDeleteSocket = ({ eventId }) => handleDeleteEvent(eventId);
        const handleUpdateSocket = (event) => handleUpdateEvent(event);
        const handleStartSocket = (event) => handleStartEvent(event);
        const handleEndSocket = (event) => handleEndEvent(event);
        socket.on('presence:update', handlePresence);
        socket.on('profile:updated', handlePresence);
        socket.on('friends:updated', handleFriends);
        socket.on('friends:requests:update', handleFriends);
        socket.on('dm:message', handleDmMessage);
        socket.on('dm:typing', handleTyping);
        socket.on('dm:thread:updated', handleThreadUpdated);
        socket.on('dm:thread:removed', handleThreadRemoved);
        socket.on('new_notification', handleNotification);
        socket.on('friends:request:declined', handleRequestDeclined);
        socket.on('community:member_joined', handleCommunityMemberJoined);
        socket.on('community:member_kicked', handleCommunityMemberKicked);
        socket.on('community:kicked', handleCommunityKicked);
        socket.on('dm:call:incoming', handleIncomingCall);
        socket.on('dm:call:accepted', handleCallAccepted);
        socket.on('dm:call:declined', handleCallDeclined);
        socket.on('dm:call:cancelled', handleCallCancelled);
        socket.on('dm:call:ended', handleCallEnded);
        socket.on('voice:members', handleVoicePresence);
        socket.on('voice:room-status', handleRoomStatus);
        socket.on('room-invite', handleRoomInvite);
        socket.on('room-invite-updated', handleRoomInviteUpdate);
        socket.on('room-join-denied', handleRoomJoinDenied);
        socket.on('room-invite-error', handleRoomInviteError);
        socket.on('new_event', handleNewEventSocket);
        socket.on('rsvp_update', handleRsvpSocket);
        socket.on('event_deleted', handleDeleteSocket);
        socket.on('event_updated', handleUpdateSocket);
        socket.on('event_started', handleStartSocket);
        socket.on('event_ended', handleEndSocket);
        return () => {
            socket.off('presence:update', handlePresence);
            socket.off('profile:updated', handlePresence);
            socket.off('friends:updated', handleFriends);
            socket.off('friends:requests:update', handleFriends);
            socket.off('dm:message', handleDmMessage);
            socket.off('dm:typing', handleTyping);
            socket.off('dm:thread:updated', handleThreadUpdated);
            socket.off('dm:thread:removed', handleThreadRemoved);
            socket.off('new_notification', handleNotification);
            socket.off('friends:request:declined', handleRequestDeclined);
            socket.off('community:member_joined', handleCommunityMemberJoined);
            socket.off('community:member_kicked', handleCommunityMemberKicked);
            socket.off('community:kicked', handleCommunityKicked);
            socket.off('dm:call:incoming', handleIncomingCall);
            socket.off('dm:call:accepted', handleCallAccepted);
            socket.off('dm:call:declined', handleCallDeclined);
            socket.off('dm:call:cancelled', handleCallCancelled);
            socket.off('dm:call:ended', handleCallEnded);
            socket.off('voice:members', handleVoicePresence);
            socket.off('voice:room-status', handleRoomStatus);
            socket.off('room-invite', handleRoomInvite);
            socket.off('room-invite-updated', handleRoomInviteUpdate);
            socket.off('room-join-denied', handleRoomJoinDenied);
            socket.off('room-invite-error', handleRoomInviteError);
            socket.off('new_event', handleNewEventSocket);
            socket.off('rsvp_update', handleRsvpSocket);
            socket.off('event_deleted', handleDeleteSocket);
            socket.off('event_updated', handleUpdateSocket);
            socket.off('event_started', handleStartSocket);
            socket.off('event_ended', handleEndSocket);
        };
    }, [
        socket,
        user?._id,
        updateProfile,
        fetchFriends,
        fetchRequests,
        threadId,
        handleNewEvent,
        handleRsvpUpdate,
        handleDeleteEvent,
        handleUpdateEvent,
        handleStartEvent,
        handleEndEvent,
        updateFriendPresence,
        updateRosterPresence,
        upsertThread,
        activeDmCall,
        outgoingCall,
        incomingCall,
        activeCommunityId,
        fetchRoster,
        clearChannels,
        setActiveChannel,
        setActiveCommunity,
        setViewMode,
        joinVoice,
        leaveVoice,
        stopScreenShare,
        isSharing,
        activeVoiceChannel?._id,
        playRingtone,
        stopRingtone,
        buildDmEntry,
        setThreadId,
        fetchInvites,
        removeThread,
        activeDm,
    ]);

    useEffect(() => {
        if (!socket || !threadId) return;
        const channelId = `dm-${threadId}`;
        socket.emit('voice:watch', { channelId });
        socket.emit('voice:peek', { channelId });
        return () => {
            socket.emit('voice:unwatch', { channelId });
        };
    }, [socket, threadId]);

    useEffect(() => {
        const activeThreadId = activeDmCall?.threadId;
        if (!activeThreadId) return;
        if (!Object.prototype.hasOwnProperty.call(dmRoomStatus, activeThreadId)) return;

        const status = dmRoomStatus[activeThreadId];
        const isCallStillActive = (status?.count || 0) > 0;
        if (isCallStillActive) return;

        const activeRoomId = `dm-${activeThreadId}`;
        if (activeVoiceChannel?._id === activeRoomId) {
            leaveVoice();
        }
        setActiveDmCall(null);
    }, [activeDmCall?.threadId, dmRoomStatus, activeVoiceChannel?._id, leaveVoice]);

    useEffect(() => {
        setShowCallInvite(false);
        setCallInviteSelection([]);
        setCallInviteSearch('');
        setCallInviteError('');
    }, [threadId]);

    const prevRoomMembersRef = useRef(new Set());
    useEffect(() => {
        if (!threadId) return;
        const members = dmRoomStatus[threadId]?.members || [];
        const nextIds = new Set(members.map((m) => m.userId).filter(Boolean));
        const prevIds = prevRoomMembersRef.current;
        const joinedIds = Array.from(nextIds).filter((id) => !prevIds.has(id) && id !== user?._id);
        if (joinedIds.length > 0) {
            const joinedUser = friends.find((f) => f._id === joinedIds[0]);
            const name = joinedUser?.displayName || 'Someone';
            setCallToast(`${name} joined the call`);
            setTimeout(() => setCallToast(''), 2200);
        }
        prevRoomMembersRef.current = nextIds;
    }, [dmRoomStatus, threadId, friends, user?._id]);

    // Intentionally do NOT auto-convert DMs into group threads when call size grows.

    useEffect(() => {
        if (!activeCommunityId) return;
        fetchChannels();
        fetchCommunityMembers(activeCommunityId).catch(() => { });
    }, [activeCommunityId, fetchChannels, fetchCommunityMembers]);

    useEffect(() => {
        if (!activeCommunityId) return;
        clearChannels();
        setActiveChannel(null);
    }, [activeCommunityId, clearChannels, setActiveChannel]);

    useEffect(() => {
        fetchFriends();
        fetchRequests();
    }, [fetchFriends, fetchRequests]);

    useEffect(() => {
        if (viewMode !== 'friends' || activeTab !== 'invites') return;
        fetchInvites().catch(() => { });
        clearInviteError();
    }, [viewMode, activeTab, fetchInvites, clearInviteError]);

    useEffect(() => {
        setShowMobileSidebar(false);
        setShowMobileDmList(false);
        setShowMobileServers(false);
    }, [viewMode]);

    useEffect(() => {
        const prev = prevCommunityIdRef.current;
        if (prev && activeCommunityId && prev !== activeCommunityId) {
            setIsServerSwitching(true);
            const timer = setTimeout(() => setIsServerSwitching(false), 280);
            prevCommunityIdRef.current = activeCommunityId;
            return () => clearTimeout(timer);
        }
        prevCommunityIdRef.current = activeCommunityId;
    }, [activeCommunityId]);

    useEffect(() => {
        setVoicePresence({});
    }, [activeCommunityId]);

    const openDmForFriend = async (friend) => {
        if (!friend?._id) return;
        setActiveFriendMenuId(null);
        setViewMode('dm');
        try {
            const tid = await openThread(friend._id);
            setThreadId(tid);
            socket?.emit('join_dm', tid);
            await fetchMessages(tid);
            const threadInfo = await fetchThreadInfo(tid);
            const entry = buildDmEntry(threadInfo);
            if (entry) setActiveDm(entry);
        } catch { }
    };

    const sendGroupCallInvite = useCallback((targetIds, threadEntry) => {
        if (!socket || !Array.isArray(targetIds) || targetIds.length === 0) return;
        const meta = {
            threadId: threadEntry._id,
            fromUser: {
                userId: user?._id,
                displayName,
                avatar: profile?.avatar || '',
            },
            threadMeta: {
                isGroup: true,
                participants: threadEntry.participants || [],
                displayName: threadEntry.displayName,
            },
        };
        targetIds.forEach((id) => {
            socket.emit('dm:call:start', { toUserId: id, ...meta });
        });
    }, [socket, user?._id, displayName, profile?.avatar]);

    const dmRoomInfo = threadId ? dmRoomStatus[threadId] : null;
    const dmRoomCount = dmRoomInfo?.count || 0;
    const isDmRoomActive = dmRoomCount > 0;
    const isInDmCall = !!threadId && activeVoiceChannel?._id === `dm-${threadId}`;
    const dmRoomMembers = dmRoomInfo?.members || [];
    const activeCallThreadId = activeDmCall?.threadId || null;
    const isViewingActiveCall = !!activeCallThreadId && viewMode === 'dm' && threadId === activeCallThreadId;
    const activeCallRoomInfo = activeCallThreadId ? dmRoomStatus[activeCallThreadId] : null;
    const activeCallCount = activeCallRoomInfo?.count || 0;
    const activeCallMembers = activeCallRoomInfo?.members || [];
    const activeCallEntry = useMemo(() => {
        if (!activeCallThreadId) return null;
        if (activeDm && activeDm._id === activeCallThreadId) return activeDm;
        const thread = (dmThreads || []).find((t) => t._id === activeCallThreadId);
        return thread ? buildDmEntry(thread) : null;
    }, [activeCallThreadId, activeDm, dmThreads, buildDmEntry]);
    const activeCallTitle = activeCallEntry?.displayName || activeDmCall?.peer?.displayName || 'Call';

    const joinDmRoom = useCallback((targetThreadId = threadId, dmEntry = activeDm) => {
        if (!targetThreadId || !dmEntry) return;
        const roomInfo = dmRoomStatus[targetThreadId];
        const roomCount = roomInfo?.count || 0;
        const roomKey = `dm-${targetThreadId}`;
        if (roomCount >= 5 && activeVoiceChannel?._id !== roomKey) {
            setCallToast('Call is full (max 5 people).');
            setTimeout(() => setCallToast(''), 2200);
            return;
        }
        setViewMode('dm');
        const targetChannelId = roomKey;
        if (activeVoiceChannel?._id && activeVoiceChannel._id !== targetChannelId) {
            leaveVoice();
        }
        if (activeVoiceChannel?._id === targetChannelId) {
            setActiveDmCall({
                threadId: targetThreadId,
                peer: { displayName: dmEntry.displayName, isGroup: dmEntry.isGroup },
                isGroup: dmEntry.isGroup,
            });
            return;
        }
        const callName = dmEntry.isGroup ? 'Group Call' : 'Direct Call';
        joinVoice({ _id: targetChannelId, name: callName });
        setActiveDmCall({
            threadId: targetThreadId,
            peer: { displayName: dmEntry.displayName, isGroup: dmEntry.isGroup },
            isGroup: dmEntry.isGroup,
        });
    }, [threadId, activeDm, joinVoice, setViewMode, leaveVoice, activeVoiceChannel?._id, dmRoomStatus]);

    const returnToActiveCall = useCallback(async () => {
        if (!activeCallThreadId) return;
        setViewMode('dm');
        let entry = activeCallEntry;
        if (!entry) {
            try {
                setThreadId(activeCallThreadId);
                socket?.emit('join_dm', activeCallThreadId);
                await fetchMessages(activeCallThreadId);
                const threadInfo = await fetchThreadInfo(activeCallThreadId);
                const fetchedEntry = buildDmEntry(threadInfo);
                if (fetchedEntry) entry = fetchedEntry;
            } catch { }
        }
        if (!entry) {
            entry = {
                _id: activeCallThreadId,
                displayName: activeDmCall?.peer?.displayName || 'Call',
                isGroup: activeDmCall?.isGroup ?? true,
                participants: activeCallMembers.map((m) => ({ _id: m.userId, displayName: m.displayName, avatar: m.avatar })),
            };
        }
        setActiveDm(entry);
        joinDmRoom(activeCallThreadId, entry);
    }, [
        activeCallThreadId,
        activeCallEntry,
        setViewMode,
        setThreadId,
        socket,
        fetchMessages,
        fetchThreadInfo,
        buildDmEntry,
        setActiveDm,
        joinDmRoom,
        activeDmCall,
        activeCallMembers,
    ]);

    const joinDmRoomWithVideo = useCallback(() => {
        joinDmRoom();
        setTimeout(() => {
            if (!isCameraOn) startCamera();
        }, 200);
    }, [joinDmRoom, startCamera, isCameraOn]);

    const startCallForFriend = useCallback(async (friend) => {
        if (!socket || !friend?._id) return;
        if (incomingCall || outgoingCall || activeDmCall) return;
        try {
            const tid = await openThread(friend._id);
            setThreadId(tid);
            socket.emit('join_dm', tid);
            await fetchMessages(tid);
            const threadInfo = await fetchThreadInfo(tid);
            const entry = buildDmEntry(threadInfo);
            if (entry) setActiveDm(entry);
            setViewMode('dm');
            const toUser = {
                _id: friend._id,
                displayName: friend.displayName || 'Friend',
                avatar: friend.avatar || '',
            };
            setOutgoingCall({ threadId: tid, toUser });
            socket.emit('dm:call:start', {
                toUserId: friend._id,
                threadId: tid,
                fromUser: {
                    userId: user?._id,
                    displayName,
                    avatar: profile?.avatar || '',
                },
                threadMeta: entry ? {
                    isGroup: entry.isGroup,
                    participants: entry.participants || [],
                    displayName: entry.displayName,
                } : undefined,
            });
        } catch { }
    }, [socket, incomingCall, outgoingCall, activeDmCall, openThread, fetchMessages, fetchThreadInfo, buildDmEntry, user?._id, displayName, profile?.avatar, setThreadId]);

    const startDmCall = useCallback(() => {
        if (!socket || !activeDm || !threadId) return;
        if (incomingCall || outgoingCall || activeDmCall) return;
        if (isDmRoomActive) {
            joinDmRoom();
            return;
        }
        const callMeta = {
            threadId,
            fromUser: {
                userId: user?._id,
                displayName,
                avatar: profile?.avatar || '',
            },
            threadMeta: {
                isGroup: activeDm.isGroup,
                participants: activeDm.participants || [],
                displayName: activeDm.displayName,
            },
        };

        if (activeDm.isGroup) {
            const recipients = (activeDm.participants || []).filter((p) => p._id !== user?._id);
            if (recipients.length === 0) return;
            joinDmRoom();
            setOutgoingCall({
                threadId,
                toUser: { displayName: activeDm.displayName, isGroup: true },
                toUsers: recipients.map((p) => p._id),
                threadMeta: callMeta.threadMeta,
            });
            sendGroupCallInvite(recipients.map((p) => p._id), {
                _id: threadId,
                participants: activeDm.participants || [],
                displayName: activeDm.displayName,
            });
            setOngoingDmCalls((prev) => {
                const next = new Set(prev);
                next.add(threadId);
                return next;
            });
            return;
        }

        const peer = activeDm.others?.[0] || (activeDm.participants || []).find((p) => p._id !== user?._id);
        const toUser = {
            _id: peer?._id,
            displayName: peer?.displayName || activeDm.displayName,
            avatar: peer?.avatar || activeDm.avatar || '',
        };
        if (!toUser._id) return;
        joinDmRoom();
        setOutgoingCall({ threadId, toUser });
        socket.emit('dm:call:start', {
            toUserId: toUser._id,
            ...callMeta,
        });
    }, [socket, activeDm, threadId, incomingCall, outgoingCall, activeDmCall, user?._id, displayName, profile?.avatar, sendGroupCallInvite, isDmRoomActive, joinDmRoom]);

    const openGroupAddModal = useCallback(() => {
        setGroupSearch('');
        setGroupSelection([]);
        setGroupError('');
        setShowGroupAdd(true);
    }, []);


    const groupCandidateList = useMemo(() => {
        const activeIds = new Set((activeDm?.participants || []).map((p) => p._id));
        const candidates = friends
            .filter((f) => f._id !== user?._id && !activeIds.has(f._id))
            .filter((f) => {
                if (!groupSearch.trim()) return true;
                const query = groupSearch.trim().toLowerCase();
                return (f.displayName || '').toLowerCase().includes(query)
                    || (f.username || '').toLowerCase().includes(query);
            });
        return candidates;
    }, [friends, activeDm?.participants, groupSearch, user?._id]);

    const maxGroupSize = 5;
    const currentGroupSize = activeDm?.participants?.length || 0;
    const remainingSlots = Math.max(0, maxGroupSize - currentGroupSize);

    const toggleGroupSelection = (id) => {
        setGroupError('');
        setGroupSelection((prev) => {
            if (prev.includes(id)) return prev.filter((x) => x !== id);
            if (remainingSlots <= prev.length) {
                setGroupError(`Group limit is ${maxGroupSize} members.`);
                return prev;
            }
            return [...prev, id];
        });
    };

    const callRoomId = threadId ? `dm-${threadId}` : null;
    const callRoomMembers = threadId ? (dmRoomStatus[threadId]?.members || []) : [];
    const callRoomMemberIds = useMemo(() => new Set(callRoomMembers.map((m) => m.userId).filter(Boolean)), [callRoomMembers]);
    const callRoomInvitedIds = useMemo(() => new Set((roomInvites[threadId] || [])), [roomInvites, threadId]);

    const callInviteCandidates = useMemo(() => {
        const query = callInviteSearch.trim().toLowerCase();
        return friends
            .filter((f) => f._id !== user?._id)
            .filter((f) => {
                if (!query) return true;
                return (f.displayName || '').toLowerCase().includes(query)
                    || (f.username || '').toLowerCase().includes(query);
            });
    }, [friends, callInviteSearch, user?._id]);

    const toggleCallInviteSelection = (id) => {
        setCallInviteError('');
        setCallInviteSelection((prev) => {
            if (prev.includes(id)) return prev.filter((x) => x !== id);
            return [...prev, id];
        });
    };

    const handleSendCallInvites = async () => {
        if (!socket || !callRoomId || callInviteSelection.length === 0) return;
        if (!isInDmCall) {
            setCallInviteError('Join the call before inviting people.');
            return;
        }
        if (!threadId) {
            setCallInviteError('Open the DM before inviting people.');
            return;
        }
        let threadEntry = activeDm;
        if (activeDm && !activeDm.isGroup) {
            const existingIds = new Set(
                (activeDm.participants || [])
                    .map((p) => p?._id?.toString?.() || String(p?._id || ''))
                    .filter(Boolean)
            );
            const missingIds = callInviteSelection.filter((id) => !existingIds.has(id));
            if (missingIds.length > 0) {
                try {
                    const updatedThread = await addParticipantsToThread(threadId, missingIds);
                    const entry = buildDmEntry(updatedThread);
                    if (entry) {
                        setActiveDm(entry);
                        setThreadId(entry._id);
                        threadEntry = entry;
                    }
                } catch (err) {
                    setCallInviteError(err?.message || 'Could not convert this DM into a group.');
                    return;
                }
            }
        }
        socket.emit('invite-to-room', {
            roomId: callRoomId,
            invitedUserIds: callInviteSelection,
            roomMeta: {
                displayName: threadEntry?.displayName || activeDm?.displayName || 'Call',
                isGroup: !!threadEntry?.isGroup || !!activeDm?.isGroup,
                participants: threadEntry?.participants || activeDm?.participants || [],
            },
        });
        setRoomInvites((prev) => {
            const existing = new Set(prev[threadId] || []);
            callInviteSelection.forEach((id) => existing.add(id));
            return { ...prev, [threadId]: Array.from(existing) };
        });
        setCallInviteSelection([]);
        setShowCallInvite(false);
    };

    const openCallInviteModal = useCallback(() => {
        if (!callRoomId) return;
        setCallInviteSearch('');
        setCallInviteSelection([]);
        setCallInviteError('');
        setShowCallInvite(true);
    }, [callRoomId]);

    const handleAddGroupMembers = async () => {
        if (!activeDm?._id || groupSelection.length === 0) return;
        if (groupSelection.length > remainingSlots) {
            setGroupError(`Group limit is ${maxGroupSize} members.`);
            return;
        }
        try {
            let updated = null;
            if (activeDm?.isGroup) {
                updated = await addParticipantsToThread(activeDm._id, groupSelection);
            } else {
                const existing = (activeDm.participants || [])
                    .map((p) => p._id)
                    .filter((id) => id && id !== user?._id);
                const ids = Array.from(new Set([...existing, ...groupSelection]));
                updated = await createGroupThread(ids);
            }
            const entry = buildDmEntry(updated);
            if (entry) {
                setActiveDm(entry);
                setViewMode('dm');
                setThreadId(entry._id);
                socket?.emit('join_dm', entry._id);
                await fetchMessages(entry._id);
                if (activeDmCall?.threadId === entry._id) {
                    sendGroupCallInvite(groupSelection, entry);
                }
            }
        } catch { }
        setShowGroupAdd(false);
        setGroupSelection([]);
        setGroupError('');
    };

    const acceptDmCall = useCallback(async () => {
        if (!incomingCall) return;
        stopRingtone();
        const { threadId: incomingThreadId, fromUser, threadMeta } = incomingCall;
        setIncomingCall(null);
        setViewMode('dm');
        let nextEntry = null;
        if (threadMeta?.isGroup) {
            setThreadId(incomingThreadId);
            socket?.emit('join_dm', incomingThreadId);
            await fetchMessages(incomingThreadId);
            if (threadMeta?.participants) {
                nextEntry = buildDmEntry({
                    _id: incomingThreadId,
                    participants: threadMeta.participants,
                    displayName: threadMeta.displayName,
                    isGroup: true,
                });
            }
            if (!nextEntry) {
                const threadInfo = await fetchThreadInfo(incomingThreadId);
                nextEntry = buildDmEntry(threadInfo);
            }
            if (nextEntry) setActiveDm(nextEntry);
        } else {
            const nextDm = {
                _id: fromUser.userId,
                displayName: fromUser.displayName || 'Friend',
                avatar: fromUser.avatar || '',
            };
            setActiveDm(nextDm);
            try {
                const tid = await openThread(fromUser.userId);
                setThreadId(tid);
                socket?.emit('join_dm', tid);
                await fetchMessages(tid);
                const threadInfo = await fetchThreadInfo(tid);
                const entry = buildDmEntry(threadInfo);
                if (entry) {
                    setActiveDm(entry);
                    nextEntry = entry;
                }
            } catch { }
        }
        socket?.emit('dm:call:accept', { toUserId: fromUser.userId, threadId: incomingThreadId });
        joinDmRoom(incomingThreadId, nextEntry || activeDm);
    }, [incomingCall, stopRingtone, openThread, fetchMessages, fetchThreadInfo, buildDmEntry, socket, setThreadId, joinDmRoom]);

    const acceptRoomInvite = useCallback(async () => {
        if (!incomingRoomInvite) return;
        const { roomId } = incomingRoomInvite;
        stopRingtone();
        setIncomingRoomInvite(null);
        if (socket) {
            socket.emit('accept-room-invite', { roomId });
        }
        if (!roomId?.startsWith('dm-')) return;
        const tId = roomId.replace(/^dm-/, '');
        setViewMode('dm');
        const existingThread = (dmThreads || []).find((t) => t._id === tId);
        let entry = existingThread ? buildDmEntry(existingThread) : null;
        if (!entry && incomingRoomInvite?.roomMeta) {
            entry = buildDmEntry({
                _id: tId,
                participants: incomingRoomInvite.roomMeta.participants || [],
                displayName: incomingRoomInvite.roomMeta.displayName,
                isGroup: incomingRoomInvite.roomMeta.isGroup,
            });
        }
        try {
            setThreadId(tId);
            socket?.emit('join_dm', tId);
            await fetchMessages(tId);
            const threadInfo = await fetchThreadInfo(tId);
            const fetchedEntry = buildDmEntry(threadInfo);
            if (fetchedEntry) entry = fetchedEntry;
        } catch {
            // keep fallback entry if fetch fails
        }
        if (!entry) {
            entry = {
                _id: tId,
                displayName: incomingRoomInvite?.roomMeta?.displayName || 'Call',
                isGroup: incomingRoomInvite?.roomMeta?.isGroup ?? true,
                participants: incomingRoomInvite?.roomMeta?.participants || [],
            };
        }
        setActiveDm(entry);
        joinDmRoom(tId, entry);
    }, [incomingRoomInvite, socket, fetchMessages, fetchThreadInfo, buildDmEntry, joinDmRoom, setThreadId, setViewMode, dmThreads, stopRingtone]);

    const rejectRoomInvite = useCallback(() => {
        if (!incomingRoomInvite) return;
        socket?.emit('reject-room-invite', { roomId: incomingRoomInvite.roomId, invitedBy: incomingRoomInvite.invitedBy });
        stopRingtone();
        setIncomingRoomInvite(null);
    }, [incomingRoomInvite, socket, stopRingtone]);

    const declineDmCall = useCallback(() => {
        if (!incomingCall) return;
        stopRingtone();
        socket?.emit('dm:call:decline', { toUserId: incomingCall.fromUser.userId, threadId: incomingCall.threadId });
        setIncomingCall(null);
    }, [incomingCall, socket, stopRingtone]);

    const cancelDmCall = useCallback(() => {
        if (!outgoingCall) return;
        if (Array.isArray(outgoingCall.toUsers) && outgoingCall.toUsers.length > 0) {
            outgoingCall.toUsers.forEach((id) => {
                socket?.emit('dm:call:cancel', { toUserId: id, threadId: outgoingCall.threadId });
            });
        } else if (outgoingCall.toUser?._id) {
            socket?.emit('dm:call:cancel', { toUserId: outgoingCall.toUser._id, threadId: outgoingCall.threadId });
        }
        setOutgoingCall(null);
        setOngoingDmCalls((prev) => {
            const next = new Set(prev);
            next.delete(outgoingCall.threadId);
            return next;
        });
    }, [outgoingCall, socket]);

    const endDmCall = useCallback(() => {
        if (!activeDmCall) return;
        setActiveDmCall(null);
        if (isSharing) stopScreenShare();
        leaveVoice();
    }, [activeDmCall, leaveVoice, isSharing, stopScreenShare]);

    const handleLeaveGroup = useCallback(async () => {
        if (!activeDm?.isGroup || !activeDm?._id) return;
        if (activeDmCall?.threadId === activeDm._id) {
            endDmCall();
        }
        try {
            await leaveThread(activeDm._id);
        } catch (error) {
            console.log('Failed to leave group:', error);
        } finally {
            removeThread(activeDm._id);
            setActiveDm(null);
            setThreadId(null);
            setDmText('');
            setDmFiles([]);
            setViewMode('dm');
        }
    }, [activeDm, activeDmCall?.threadId, endDmCall, leaveThread, removeThread, setThreadId]);

    const exitDmCallForVoice = useCallback(() => {
        if (incomingCall) {
            declineDmCall();
            return;
        }
        if (outgoingCall) {
            cancelDmCall();
            return;
        }
        if (activeDmCall) {
            endDmCall();
        }
    }, [incomingCall, outgoingCall, activeDmCall, declineDmCall, cancelDmCall, endDmCall]);

    const handleVoiceBarLeave = useCallback(() => {
        if (activeDmCall) {
            endDmCall();
            return;
        }
        leaveVoice();
    }, [activeDmCall, endDmCall, leaveVoice]);

    const handleVoiceChannelPreview = useCallback((channel) => {
        if (!channel?._id) return;
        setActiveChannel(channel._id);
        setPreviewVoiceChannel(channel);
        setShowVoiceStageView(true);
    }, [setActiveChannel]);

    const handleVoiceChannelJoin = useCallback((channel) => {
        if (!channel?._id) return;
        if (incomingCall || outgoingCall || activeDmCall) {
            exitDmCallForVoice();
        }
        setActiveChannel(channel._id);
        setPreviewVoiceChannel(channel);
        setShowVoiceStageView(true);
        if (activeVoiceChannel?._id === channel._id) {
            return;
        }
        joinVoice({ ...channel, communityId: activeCommunityId });
    }, [incomingCall, outgoingCall, activeDmCall, exitDmCallForVoice, activeVoiceChannel?._id, joinVoice, activeCommunityId, setActiveChannel]);

    useEffect(() => {
        if (!friendError && !friendSuccess) return;
        const t = setTimeout(() => clearMessages(), 2500);
        return () => clearTimeout(t);
    }, [friendError, friendSuccess, clearMessages]);

    useEffect(() => {
        if (!activeChannelId && channels.length > 0) {
            setActiveChannel(channels[0]._id);
        }
    }, [activeChannelId, channels, setActiveChannel]);

    const activeChannel = useMemo(
        () => channels.find((ch) => ch._id === activeChannelId) || channels[0],
        [channels, activeChannelId]
    );

    useEffect(() => {
        setChannelSearchQuery('');
        setShowChannelSearchPanel(false);
        setChannelSearchJumpError('');
        clearChannelMessageSearch();
    }, [activeCommunityId, activeChannel?._id, viewMode, clearChannelMessageSearch]);

    useEffect(() => {
        if (viewMode !== 'server' || !activeChannel?._id) return;
        const trimmed = channelSearchQuery.trim();
        if (!trimmed) {
            clearChannelMessageSearch();
            setChannelSearchJumpError('');
            return;
        }
        const t = setTimeout(() => {
            searchMessages(activeChannel._id, trimmed, { reset: true, limit: 20 }).catch(() => { });
        }, 260);
        return () => clearTimeout(t);
    }, [viewMode, activeChannel?._id, channelSearchQuery, searchMessages, clearChannelMessageSearch]);

    useEffect(() => {
        if (!showChannelSearchPanel) return;
        const onPointerDown = (event) => {
            if (!channelSearchPanelRef.current) return;
            if (channelSearchPanelRef.current.contains(event.target)) return;
            setShowChannelSearchPanel(false);
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [showChannelSearchPanel]);

    const formatSearchTimestamp = useCallback((value) => {
        if (!value) return '';
        try {
            return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    }, []);

    const buildSearchPreview = useCallback((content) => {
        const text = String(content || '').replace(/\s+/g, ' ').trim();
        if (!text) return 'Attachment message';

        const query = channelSearchQuery.trim().toLowerCase();
        if (!query || query.length < 2) return text.length > 150 ? `${text.slice(0, 147)}...` : text;

        const at = text.toLowerCase().indexOf(query);
        if (at < 0) return text.length > 150 ? `${text.slice(0, 147)}...` : text;

        const start = Math.max(0, at - 48);
        const end = Math.min(text.length, at + query.length + 72);
        const prefix = start > 0 ? '...' : '';
        const suffix = end < text.length ? '...' : '';
        return `${prefix}${text.slice(start, end)}${suffix}`;
    }, [channelSearchQuery]);

    const handleSelectSearchResult = useCallback(async (result) => {
        if (!activeChannel?._id || !result?._id) return;
        setChannelSearchJumpError('');
        const ok = await jumpToMessage(activeChannel._id, result._id);
        if (!ok) {
            setChannelSearchJumpError('Could not locate that message in channel history.');
            return;
        }
        setShowChannelSearchPanel(false);
    }, [activeChannel?._id, jumpToMessage]);

    const isTextChannelActive = useMemo(() => {
        const type = activeChannel?.type || 'text';
        return ['text', 'announcement', 'forum'].includes(type);
    }, [activeChannel?.type]);
    const shouldShowServerMembersPanel = useMemo(() => {
        return isTextChannelActive && !activeVoiceChannel;
    }, [isTextChannelActive, activeVoiceChannel]);

    useEffect(() => {
        if (shouldShowServerMembersPanel) return;
        setShowMemberList(false);
        setMemberSearchQuery('');
    }, [shouldShowServerMembersPanel]);

    const activeMembership = useMemo(() => (
        user?.memberships?.find((m) => {
            const membershipCommunityId = typeof m.communityId === 'string' ? m.communityId : m.communityId?._id;
            return membershipCommunityId === activeCommunityId;
        }) || null
    ), [user?.memberships, activeCommunityId]);

    const channelChatCurrentUser = useMemo(() => ({
        id: user?._id,
        displayName,
        username: user?.username || username,
        avatar: profile?.avatar || '',
        communityRole: user?.memberships?.find((m) => {
            const id = m.communityId?._id || m.communityId;
            return id?.toString?.() === activeCommunityId;
        })?.role,
    }), [user?._id, user?.username, user?.memberships, displayName, username, profile?.avatar, activeCommunityId]);

    const memberList = useMemo(() => {
        const current = {
            _id: user?._id || 'me',
            displayName,
            statusText,
            presence: profile?.presence || 'online',
            avatar: profile?.avatar || '',
            bannerColor: profile?.bannerColor || '#3f4f4f',
            bio: profile?.bio || '',
            username: user?.username || (user?.email ? user.email.split('@')[0] : 'user'),
            communityRole: activeMembership?.role || 'member',
            roleIds: activeMembership?.roles || [],
        };
        const others = (rosterFriends || []).map((m) => ({
            ...m,
            presence: m.presence || 'online',
        }));
        return [current, ...others];
    }, [
        user?._id,
        user?.username,
        user?.email,
        displayName,
        statusText,
        profile?.avatar,
        profile?.presence,
        profile?.bannerColor,
        profile?.bio,
        rosterFriends,
        activeMembership?.role,
        activeMembership?.roles,
    ]);

    const rolePermissions = useMemo(() => {
        const map = new Map((roles || []).map((r) => [r._id?.toString?.() || String(r._id), r.permissions || {}]));
        return (activeMembership?.roles || []).reduce((acc, roleId) => {
            const perms = map.get(roleId?.toString?.() || String(roleId));
            if (!perms) return acc;
            Object.keys(perms).forEach((key) => {
                if (perms[key]) acc[key] = true;
            });
            return acc;
        }, {});
    }, [roles, activeMembership?.roles]);

    const canEditChannel = ['admin', 'moderator'].includes(activeMembership?.role) || rolePermissions.manageChannels;

    const handleOpenChannelSettings = (channel) => {
        if (!channel?._id || !canEditChannel) return;
        if (channel._id !== activeChannelId) {
            setPendingEditChannelId(channel._id);
            setActiveChannel(channel._id);
            return;
        }
        setEditChannelSignal((v) => v + 1);
    };

    const filteredMemberList = useMemo(() => {
        const q = (memberSearchQuery || '').trim().toLowerCase();
        const base = (memberList || []).filter((m) => !!m?._id);
        if (!q) return base;
        return base.filter((m) => {
            const name = (m.displayName || '').toLowerCase();
            const handle = (m.username || '').toLowerCase();
            const status = (filterStatusText(m.bio || m.statusText) || '').toLowerCase();
            return name.includes(q) || handle.includes(q) || status.includes(q);
        });
    }, [memberList, memberSearchQuery]);

    const memberSections = useMemo(() => {
        const presenceOrder = { online: 0, dnd: 1, idle: 2, offline: 3 };
        const sortByPresence = (list) => [...list].sort((a, b) => {
            const diff = (presenceOrder[a.presence] ?? 9) - (presenceOrder[b.presence] ?? 9);
            if (diff !== 0) return diff;
            return (a.displayName || '').localeCompare(b.displayName || '');
        });
        const online = sortByPresence(filteredMemberList.filter((m) => m.presence !== 'offline'));
        const offline = sortByPresence(filteredMemberList.filter((m) => m.presence === 'offline'));
        return [
            { id: 'online', label: 'Online', members: online },
            { id: 'offline', label: 'Offline', members: offline },
        ];
    }, [filteredMemberList]);

    const filteredFriends = useMemo(() => {
        let base = friends;
        if (activeTab === 'online') base = friends.filter((f) => f.presence === 'online');
        if (activeTab === 'requests') return [];
        if (activeTab === 'blocked') return [];
        const q = friendSearchQuery.trim().toLowerCase();
        if (!q) return base;
        return base.filter((f) => {
            const name = (f.displayName || '').toLowerCase();
            const username = (f.username || '').toLowerCase();
            const status = (f.statusText || '').toLowerCase();
            return name.includes(q) || username.includes(q) || status.includes(q);
        });
    }, [friends, activeTab, friendSearchQuery]);

    const activeNowFriends = useMemo(() => {
        return (friends || [])
            .filter((f) => f.presence === 'online' || f.presence === 'dnd' || f.presence === 'idle')
            .slice(0, 3);
    }, [friends]);

    const suggestionCount = Math.max(0, (friends || []).length - onlineCount);

    const pendingCount = incoming.length + outgoing.length;

    const requestBuckets = useMemo(() => {
        const q = friendSearchQuery.trim().toLowerCase();
        const matches = (friend) => {
            if (!q) return true;
            const name = (friend.displayName || '').toLowerCase();
            const username = (friend.username || '').toLowerCase();
            return name.includes(q) || username.includes(q);
        };
        const presenceWeight = { online: 0, idle: 1, dnd: 2, offline: 3 };
        const sortRequests = (arr) => [...arr].sort((a, b) => {
            const pA = presenceWeight[a.presence] ?? 9;
            const pB = presenceWeight[b.presence] ?? 9;
            if (pA !== pB) return pA - pB;
            return (a.displayName || '').localeCompare(b.displayName || '');
        });

        const incomingFiltered = sortRequests((incoming || []).filter(matches));
        const outgoingFiltered = sortRequests((outgoing || []).filter(matches));
        const all = [
            ...incomingFiltered.map((f) => ({ ...f, requestType: 'incoming' })),
            ...outgoingFiltered.map((f) => ({ ...f, requestType: 'outgoing' })),
        ];

        return {
            incoming: incomingFiltered,
            outgoing: outgoingFiltered,
            all,
        };
    }, [incoming, outgoing, friendSearchQuery]);

    const dmThreadEntries = useMemo(() => {
        return (dmThreads || []).map((thread) => buildDmEntry(thread)).filter(Boolean);
    }, [dmThreads, buildDmEntry]);

    const directDmEntries = useMemo(() => dmThreadEntries.filter((dm) => !dm.isGroup), [dmThreadEntries]);
    const groupDmEntries = useMemo(() => dmThreadEntries.filter((dm) => dm.isGroup), [dmThreadEntries]);

    useEffect(() => {
        if (!activeDm?._id) return;
        const updated = dmThreadEntries.find((t) => t._id === activeDm._id);
        if (updated) {
            setActiveDm(updated);
        }
    }, [dmThreadEntries, activeDm?._id]);

    const handleSendRequest = async (targetId = friendIdInput) => {
        const id = (targetId || '').trim();
        if (!id) return;
        try {
            await sendRequest(id);
            if (id === (friendIdInput || '').trim()) {
                setFriendIdInput('');
            }
            fetchFriends();
            fetchRequests();
            if (addFriendSearchQuery.trim().length >= 2) {
                searchUsers(addFriendSearchQuery.trim()).catch(() => { });
            }
        } catch { }
    };

    useEffect(() => {
        if (activeTab !== 'add') return;
        const q = addFriendSearchQuery.trim();
        if (q.length < 2) return;
        const timer = setTimeout(() => {
            searchUsers(q).catch(() => { });
        }, 220);
        return () => clearTimeout(timer);
    }, [activeTab, addFriendSearchQuery, searchUsers]);

    const handleMobileServerSwitch = (communityId) => {
        if (!communityId) return;
        if (communityId === activeCommunityId) {
            setViewMode('server');
            setShowMobileServers(false);
            return;
        }
        clearChannels();
        setActiveCommunity(communityId);
        setActiveChannel(null);
        setViewMode('server');
        setShowMobileServers(false);
        setTimeout(() => {
            fetchFeed(1, null, null);
            fetchChannels();
            fetchEvents();
        }, 0);
    };

    const memberships = user?.memberships || [];
    const getCommunityId = (membership) => membership?.communityId?._id || membership?.communityId;
    const getCommunityName = (membership) => membership?.communityId?.name || membership?.communityId?.slug || 'Community';
    const getCommunityIcon = (membership) => membership?.communityId?.icon || '';

    const dmSidebarBody = (
        <div className="flex h-full flex-col">
            <div className="h-3 border-b border-discord-darkest/80" />

            <div className="px-3 pt-3 space-y-1 text-xs font-semibold text-discord-faint">
                <button className="w-full text-left px-2 py-1.5 rounded-md bg-discord-darkest text-discord-white flex items-center gap-2 cursor-pointer">
                    <User className="w-4 h-4 text-discord-faint" />
                    Friends
                    {pendingCount > 0 && (
                        <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-500 text-[10px] font-semibold text-white">
                            {pendingCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => {
                        setViewMode('friends');
                        setActiveTab('requests');
                        setShowMobileDmList(false);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-discord-darkest/80 text-discord-muted cursor-pointer flex items-center gap-2"
                >
                    <MessageCircle className="w-4 h-4 text-discord-faint" />
                    Message Requests
                    {pendingCount > 0 && (
                        <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-500 text-[10px] font-semibold text-white">
                            {pendingCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => navigate('/upgrade')}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-discord-darkest/80 text-discord-muted cursor-pointer"
                >
                    CircleCore Plus
                </button>
            </div>

            <div className="mt-5 px-3 text-[10px] font-semibold tracking-[0.12em] uppercase text-discord-faint">
                Direct Messages
            </div>

            <div className="mt-1 flex-1 overflow-y-auto px-1.5 pb-2 space-y-0.5">
                {directDmEntries.length === 0 && (
                    <div className="px-2 py-3 text-xs text-discord-faint">No direct messages yet.</div>
                )}
                {directDmEntries.map((dm) => (
                    <button
                        key={dm._id}
                        onClick={async () => {
                            setActiveDm(dm);
                            setViewMode('dm');
                            setShowMobileDmList(false);
                            setThreadId(dm._id);
                            socket?.emit('join_dm', dm._id);
                            await fetchMessages(dm._id);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-sm text-discord-muted hover:bg-discord-darkest/80 hover:text-discord-light cursor-pointer"
                    >
                        <div className="relative w-8 h-8 rounded-full bg-discord-darkest flex items-center justify-center text-xs font-semibold text-discord-light">
                            {dm.avatar ? (
                                <img src={dm.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                                dm.displayName?.charAt(0).toUpperCase()
                            )}
                            {!dm.isGroup && (
                                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-discord-darker ${presenceColor(dm.presence)}`} />
                            )}
                        </div>
                        <div className="min-w-0">
                            <span className="block truncate">{dm.displayName}</span>
                            <span className="block text-[11px] text-discord-faint truncate">{dm.subtitle}</span>
                        </div>
                    </button>
                ))}
                {groupDmEntries.length > 0 && (
                    <>
                        <div className="mt-3 px-2 text-[10px] font-semibold tracking-[0.12em] uppercase text-discord-faint">
                            Group Messages
                        </div>
                        {groupDmEntries.map((dm) => (
                            <button
                                key={dm._id}
                                onClick={async () => {
                                    setActiveDm(dm);
                                    setViewMode('dm');
                                    setShowMobileDmList(false);
                                    setThreadId(dm._id);
                                    socket?.emit('join_dm', dm._id);
                                    await fetchMessages(dm._id);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-sm text-discord-muted hover:bg-discord-darkest/80 hover:text-discord-light cursor-pointer"
                            >
                                <div className="relative w-8 h-8 rounded-full bg-discord-darkest flex items-center justify-center text-xs font-semibold text-discord-light">
                                    {dm.avatar ? (
                                        <img src={dm.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                                    ) : (
                                        dm.displayName?.charAt(0).toUpperCase()
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <span className="block truncate">{dm.displayName}</span>
                                    <span className="block text-[11px] text-discord-faint truncate">{dm.subtitle}</span>
                                </div>
                            </button>
                        ))}
                    </>
                )}
            </div>

            <div className="h-14 px-2 border-t border-discord-darkest/80 flex items-center gap-2 bg-discord-darkest/80 cursor-pointer" onClick={() => setShowProfilePopout(true)}>
                <div className="relative">
                    {profile?.avatar ? (
                        <img src={profile.avatar} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-discord-border" />
                    ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blurple to-indigo-600 flex items-center justify-center text-xs font-bold">
                            {displayName.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-discord-darkest ${profile?.presence === 'dnd' ? 'bg-red-500' : profile?.presence === 'idle' ? 'bg-yellow-400' : profile?.presence === 'offline' ? 'bg-discord-faint/60' : 'bg-discord-green'
                        }`} />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-semibold leading-tight truncate">{displayName}</p>
                    <p className="text-[11px] text-discord-faint truncate">{user?._id || username}</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                    <button
                        onClick={(event) => {
                            event.stopPropagation();
                            setShowProfileSettings(true);
                        }}
                        className="w-7 h-7 rounded-md bg-discord-darkest flex items-center justify-center hover:bg-discord-border-light/40 cursor-pointer"
                        title="Settings"
                    >
                        <Settings className="w-3.5 h-3.5 text-discord-muted" />
                    </button>
                </div>
            </div>
        </div>
    );

    const memberListBody = (
        <div className="flex-1 min-h-0 flex flex-col bg-[#1a1a1e]">
            <div className="px-3 pt-3 pb-2 border-b border-discord-darkest/70 bg-[#1a1a1e]">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-discord-faint" />
                    <input
                        type="text"
                        value={memberSearchQuery}
                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                        placeholder="Search members"
                        className="w-full pl-8 pr-3 py-2 text-xs rounded-md border border-[#29292d] bg-[#111318] text-discord-light placeholder:text-discord-faint/70 focus:outline-none focus:border-[#3a3a40]"
                    />
                </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-5">
                {memberSections.map((group) => (
                    <div key={group.id}>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-discord-faint mb-2">
                            {group.label} — {group.members.length}
                        </div>
                        {group.members.length === 0 ? (
                            <div className="px-2 py-2 text-xs text-discord-faint">No members</div>
                        ) : (
                            <div className="space-y-1">
                                {group.members.map((m) => (
                                    <button
                                        key={m._id}
                                        onClick={() => { setSelectedMember(m); setShowMemberPopout(true); }}
                                        className="w-full flex items-center gap-2 text-sm text-discord-light rounded-lg px-2 py-1.5 hover:bg-discord-darkest/70 transition cursor-pointer text-left"
                                    >
                                        <div className="relative w-8 h-8 shrink-0 rounded-full bg-discord-darkest flex items-center justify-center text-xs font-semibold overflow-hidden">
                                            {m.avatar ? (
                                                <img src={m.avatar} alt="" className="w-8 h-8 object-cover" />
                                            ) : (
                                                m.displayName?.charAt(0).toUpperCase()
                                            )}
                                            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-discord-darker ${presenceColor(m.presence)}`} />
                                        </div>
                                        <div className="min-w-0 flex-1 leading-tight">
                                            <p className="text-sm font-semibold text-discord-white truncate">{m.displayName}</p>
                                            {filterStatusText(m.bio || m.statusText) && (
                                                <p className="text-[11px] text-discord-faint truncate">
                                                    {filterStatusText(m.bio || m.statusText)}
                                                </p>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );

    const switchAnimClass = isServerSwitching
        ? 'opacity-70 translate-y-1'
        : 'opacity-100 translate-y-0';
    const switchAnimBase = 'transition-all duration-300';

    return (
        <div className="ui-shell h-screen h-[100dvh] text-discord-white flex overflow-hidden">
            {/* Left server rail */}
            <WorkspaceSwitcher
                onHomeClick={() => setViewMode('friends')}
                onServerSelect={() => setViewMode('server')}
                openDirectorySignal={mobileDirectorySignal}
            />

            {viewMode === 'server' ? (
                <Sidebar
                    isOpen={showMobileSidebar}
                    onClose={() => setShowMobileSidebar(false)}
                    animateClassName={`${switchAnimBase} ${switchAnimClass}`}
                    onProfileClick={() => setShowProfilePopout(true)}
                    onSettingsClick={() => setShowProfileSettings(true)}
                    onFriendsClick={() => {
                        setViewMode('friends');
                        setActiveTab('all');
                        setShowMobileSidebar(false);
                        setShowMobileServers(false);
                    }}
                    onOpenChannelSettings={handleOpenChannelSettings}
                    onVoiceChannelClick={handleVoiceChannelPreview}
                    onVoiceChannelDoubleClick={handleVoiceChannelJoin}
                    voiceState={{
                        isConnected: !!activeVoiceChannel,
                        activeChannelId: activeVoiceChannel?._id,
                        activeChannelName: activeVoiceChannel?.name,
                        members: voiceParticipants,
                        voicePresence,
                        connectedPeerIds,
                        memberCount: voiceParticipants.length,
                        elapsed,
                        elapsedLabel: `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`,
                        isMuted,
                        isDeafened,
                        isSharing,
                        noiseReduction,
                        hasRemoteStream: screenShareTiles.length > 0,
                        onToggleViewer: () => setShowStreamViewer((prev) => !prev),
                        onToggleMute: toggleMute,
                        onToggleDeafen: toggleDeafen,
                        onToggleNoiseReduction: toggleNoiseReduction,
                        onToggleShare: handleShareToggle,
                        onOpenCallView: openVoiceStageView,
                        onLeave: handleVoiceBarLeave,
                    }}
                />
            ) : (
                <>
                    <aside className={`hidden md:flex w-64 bg-discord-darker border-r border-discord-darkest/80 flex-col ${switchAnimBase} ${switchAnimClass}`}>
                        {dmSidebarBody}
                    </aside>
                    {showMobileDmList && (
                        <>
                            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden" onClick={() => setShowMobileDmList(false)} />
                            <aside className={`fixed top-0 left-0 bottom-0 w-72 bg-discord-darker z-50 shadow-2xl md:hidden flex flex-col ${switchAnimBase} ${switchAnimClass}`}>
                                <div className="h-12 flex items-center justify-between px-4 border-b border-discord-darkest/80">
                                    <span className="text-sm font-semibold text-discord-light">Direct Messages</span>
                                    <button onClick={() => setShowMobileDmList(false)} className="text-discord-faint hover:text-white">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                {dmSidebarBody}
                            </aside>
                        </>
                    )}
                </>
            )}

            {showMobileServers && (
                <>
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden" onClick={() => setShowMobileServers(false)} />
                    <aside className={`fixed top-0 left-0 bottom-0 w-64 bg-discord-sidebar z-50 shadow-2xl md:hidden flex flex-col ${switchAnimBase} ${switchAnimClass}`}>
                        <div className="h-12 flex items-center justify-between px-4 border-b border-discord-darkest/80">
                            <span className="text-sm font-semibold text-discord-light">Servers</span>
                            <button onClick={() => setShowMobileServers(false)} className="text-discord-faint hover:text-white">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                            <button
                                onClick={() => { setViewMode('friends'); setShowMobileServers(false); }}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${viewMode === 'friends' ? 'bg-discord-darkest text-white' : 'text-discord-muted hover:bg-discord-darkest/70'
                                    }`}
                            >
                                <div className="w-9 h-9 rounded-xl bg-blurple flex items-center justify-center text-white font-bold">
                                    CC
                                </div>
                                <span className="truncate">Home</span>
                            </button>
                            <button
                                onClick={() => { setMobileDirectorySignal((v) => v + 1); setShowMobileServers(false); }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-discord-muted hover:bg-discord-darkest/70"
                            >
                                <div className="w-9 h-9 rounded-xl bg-discord-darkest flex items-center justify-center text-discord-light">
                                    <Compass className="w-4 h-4" />
                                </div>
                                <span className="truncate">Discover</span>
                            </button>
                            {memberships.map((m) => {
                                const id = getCommunityId(m);
                                const isActive = id === activeCommunityId && viewMode === 'server';
                                const icon = getCommunityIcon(m);
                                return (
                                    <button
                                        key={id}
                                        onClick={() => handleMobileServerSwitch(id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-discord-darkest text-white' : 'text-discord-muted hover:bg-discord-darkest/70'
                                            }`}
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-discord-darkest flex items-center justify-center text-xs font-bold text-discord-light overflow-hidden">
                                            {icon ? (
                                                <img src={icon} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                getCommunityName(m).charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div className="min-w-0 text-left">
                                            <div className="truncate text-sm font-semibold">{getCommunityName(m)}</div>
                                            <div className="text-[11px] text-discord-faint capitalize">{m.role || 'member'}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>
                </>
            )}

            <main className={`ui-panel flex-1 flex flex-col ${switchAnimBase} ${switchAnimClass}`}>
                {viewMode === 'server' ? (
                    <>
                        <div
                            className="ui-topbar relative z-[140] h-12 flex items-center justify-between px-4 border-b border-[#29292d] shadow-[0_1px_0_rgba(0,0,0,0.45)]"
                            style={{ background: '#1a1a1e' }}
                        >
                            <div className="flex items-center gap-2 text-sm font-semibold text-discord-light">
                                <button
                                    onClick={() => setShowMobileServers(true)}
                                    className="md:hidden w-8 h-8 rounded-md hover:bg-[#23262e] text-discord-faint hover:text-discord-light flex items-center justify-center"
                                    title="Open servers"
                                >
                                    <Server className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setShowMobileSidebar(true)}
                                    className="md:hidden w-8 h-8 rounded-md hover:bg-[#23262e] text-discord-faint hover:text-discord-light flex items-center justify-center"
                                    title="Open channels"
                                >
                                    <Menu className="w-4 h-4" />
                                </button>
                                {activeChannel?.name ? (
                                    <>
                                        {activeChannel?.isPrivate ? (
                                            <Lock className="w-3.5 h-3.5 text-discord-faint" />
                                        ) : (
                                            <Hash className="w-4 h-4 text-discord-faint" />
                                        )}
                                        <span>{activeChannel.name}</span>
                                    </>
                                ) : (
                                    <span className="text-discord-faint text-xs uppercase tracking-[0.2em]">Loading channel</span>
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-discord-faint">
                                <button
                                    onClick={() => setMobileDirectorySignal((v) => v + 1)}
                                    className="md:hidden w-8 h-8 rounded-md hover:bg-[#23262e] hover:text-discord-light cursor-pointer flex items-center justify-center"
                                    title="Discover servers"
                                >
                                    <Compass className="w-4 h-4" />
                                </button>
                                {shouldShowServerMembersPanel && (
                                    <button
                                        onClick={() => setShowMemberList((v) => !v)}
                                        className={`w-8 h-8 rounded-md hover:bg-[#23262e] hover:text-discord-light cursor-pointer flex items-center justify-center ${showMemberList ? 'text-discord-white' : 'text-discord-faint'}`}
                                        title="Toggle members list"
                                    >
                                        <Users className="w-4 h-4" />
                                    </button>
                                )}
                                <button onClick={() => setShowPins(true)} className="w-8 h-8 rounded-md hover:bg-[#23262e] hover:text-discord-light cursor-pointer flex items-center justify-center">
                                    <Pin className="w-4 h-4" />
                                </button>
                                <NotificationBell />
                                <button onClick={() => navigate('/help')} className="w-8 h-8 rounded-md hover:bg-[#23262e] hover:text-discord-light cursor-pointer flex items-center justify-center" title="Help">
                                    <HelpCircle className="w-4 h-4" />
                                </button>
                                <div ref={channelSearchPanelRef} className="hidden md:block relative z-[150]">
                                    <div className="flex items-center gap-2 h-8 w-[300px] rounded-md border border-[#2a2d33] bg-[#0f1117] px-2.5 text-xs text-discord-faint">
                                        <Search className="w-3.5 h-3.5 shrink-0" />
                                        <input
                                            type="text"
                                            value={channelSearchQuery}
                                            onFocus={() => setShowChannelSearchPanel(true)}
                                            onChange={(e) => {
                                                setChannelSearchQuery(e.target.value);
                                                setShowChannelSearchPanel(true);
                                                setChannelSearchJumpError('');
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Escape') {
                                                    setShowChannelSearchPanel(false);
                                                }
                                                if (e.key === 'Enter' && channelSearchResults.length > 0) {
                                                    e.preventDefault();
                                                    handleSelectSearchResult(channelSearchResults[0]);
                                                }
                                            }}
                                            placeholder="Search messages"
                                            className="flex-1 bg-transparent outline-none text-discord-light placeholder:text-discord-faint/80"
                                        />
                                    </div>

                                    {showChannelSearchPanel && (
                                        <div className="absolute right-0 top-10 z-[220] w-[420px] max-w-[70vw] rounded-lg border border-[#2a2d33] bg-[#111318] shadow-2xl overflow-hidden">
                                            <div className="px-3 py-2 border-b border-[#29292d] text-[11px] uppercase tracking-[0.12em] text-discord-faint font-semibold">
                                                Search In #{activeChannel?.name || 'channel'}
                                            </div>

                                            <div className="max-h-[420px] overflow-y-auto">
                                                {!channelSearchQuery.trim() && (
                                                    <div className="px-3 py-3 text-xs text-discord-faint">
                                                        Use filters like from:name, has:link, has:file, before:2026-01-01, after:2026-01-01.
                                                    </div>
                                                )}

                                                {channelSearchQuery.trim() && channelSearchQuery.trim().length < 2 && !channelSearchLoading && (
                                                    <div className="px-3 py-3 text-xs text-discord-faint">Type at least 2 characters to search.</div>
                                                )}

                                                {channelSearchLoading && (
                                                    <div className="px-3 py-3 text-xs text-discord-faint">Searching messages...</div>
                                                )}

                                                {!!channelSearchError && !channelSearchLoading && (
                                                    <div className="px-3 py-3 text-xs text-discord-red">{channelSearchError}</div>
                                                )}

                                                {!channelSearchLoading && !channelSearchError && channelSearchQuery.trim().length >= 2 && channelSearchResults.length === 0 && (
                                                    <div className="px-3 py-3 text-xs text-discord-faint">No messages matched this search.</div>
                                                )}

                                                {!channelSearchLoading && channelSearchResults.length > 0 && (
                                                    <div className="divide-y divide-[#29292d]">
                                                        {channelSearchResults.map((row) => (
                                                            <button
                                                                key={row._id}
                                                                type="button"
                                                                onClick={() => handleSelectSearchResult(row)}
                                                                className="w-full px-3 py-2.5 text-left hover:bg-[#1d2028] transition-colors"
                                                            >
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <div className="text-xs font-semibold text-discord-light truncate">{row.sender?.displayName || 'Member'}</div>
                                                                    <div className="text-[11px] text-discord-faint shrink-0">{formatSearchTimestamp(row.createdAt)}</div>
                                                                </div>
                                                                <div className="mt-1 text-xs text-discord-muted leading-relaxed">
                                                                    {buildSearchPreview(row.content)}
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {channelSearchHasMore && !channelSearchLoading && (
                                                <div className="px-3 py-2 border-t border-[#29292d]">
                                                    <button
                                                        type="button"
                                                        onClick={() => loadMoreSearchResults(activeChannel?._id, 20)}
                                                        className="w-full h-8 rounded-md bg-[#1b1e25] border border-[#2a2d33] text-xs text-discord-light hover:bg-[#242833]"
                                                    >
                                                        Load More Results
                                                    </button>
                                                </div>
                                            )}

                                            {channelSearchJumpError && (
                                                <div className="px-3 py-2 border-t border-[#29292d] text-xs text-discord-red">
                                                    {channelSearchJumpError}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {showServerVoiceStage && (
                            <div className="fixed inset-0 z-[85] bg-[#05070c]">
                                <div className="h-12 border-b border-discord-border/60 px-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-discord-light">
                                        <UserPlus className="w-4 h-4 text-discord-faint" />
                                        <p className="text-sm font-semibold">Voice Call - {stageVoiceChannel?.name || 'Channel'}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isViewingActiveVoiceChannel && (
                                            <button
                                                type="button"
                                                onClick={() => setShowVoiceInviteModal(true)}
                                                className="h-8 px-2.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5"
                                                title="Invite members"
                                            >
                                                <UserPlus className="w-3.5 h-3.5" />
                                                Invite
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={toggleVoiceChannelChatDrawer}
                                            className={`w-8 h-8 rounded-md text-white flex items-center justify-center transition-colors ${shouldRenderVoiceStageChatDrawer ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20'
                                                }`}
                                            title={shouldRenderVoiceStageChatDrawer ? 'Close channel chat' : 'Open channel chat'}
                                        >
                                            <MessageCircle className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={closeVoiceStageView}
                                            className="w-8 h-8 rounded-md hover:bg-discord-border-light/30 text-discord-faint hover:text-discord-light flex items-center justify-center"
                                            title="Close call view"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="h-[calc(100%-3rem)] p-3 md:p-4">
                                    {!isViewingActiveVoiceChannel ? (
                                        <div className="h-full rounded-2xl border border-discord-border/50 bg-[radial-gradient(circle_at_50%_120%,rgba(116,122,255,0.55),rgba(31,35,99,0.82)_35%,rgba(14,17,52,0.96)_72%)] flex flex-col">
                                            <div className="px-3 py-2 flex items-center justify-between">
                                                <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">Channel Chat</p>
                                                <button
                                                    type="button"
                                                    onClick={toggleVoiceChannelChatDrawer}
                                                    className={`w-8 h-8 rounded-md text-white flex items-center justify-center transition-colors ${shouldRenderVoiceStageChatDrawer ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20'
                                                        }`}
                                                    title={shouldRenderVoiceStageChatDrawer ? 'Close channel chat' : 'Open channel chat'}
                                                >
                                                    <MessageCircle className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="flex-1 min-h-0 flex gap-3 px-3 pb-3">
                                                <div className="flex-1 min-h-0 px-1 pb-3">
                                                    {stagePresenceMembers.length === 0 ? (
                                                        <div className="h-full flex flex-col items-center justify-center text-center">
                                                            <p className="text-4xl md:text-5xl font-bold text-white/90 leading-none">{stageVoiceChannel?.name || 'Voice Channel'}</p>
                                                            <p className="mt-3 text-sm text-white/70">No one is currently in voice</p>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleVoiceChannelJoin(stageVoiceChannel)}
                                                                className="mt-6 px-5 py-2.5 rounded-lg bg-white text-[#20254f] text-sm font-semibold hover:bg-white/90"
                                                            >
                                                                Join Voice
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="h-full overflow-y-auto">
                                                            <div className="mb-3 flex items-center justify-end">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleVoiceChannelJoin(stageVoiceChannel)}
                                                                    className="px-3 py-1.5 rounded-md bg-white text-[#1e234f] text-xs font-semibold hover:bg-white/90"
                                                                >
                                                                    Join Voice
                                                                </button>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                                {stagePresenceMembers.map((member) => (
                                                                    <div key={`stage-member-${member.userId || member.socketId}`} className="rounded-xl border border-white/10 bg-black/25 backdrop-blur-sm px-3 py-3 flex items-center gap-3">
                                                                        <div className="w-11 h-11 rounded-full bg-discord-darkest overflow-hidden flex items-center justify-center text-sm font-semibold text-discord-light shrink-0">
                                                                            {member.avatar ? (
                                                                                <img src={member.avatar} alt="" className="w-11 h-11 object-cover" />
                                                                            ) : (
                                                                                (member.displayName || 'U').charAt(0).toUpperCase()
                                                                            )}
                                                                        </div>
                                                                        <div className="min-w-0">
                                                                            <p className="text-sm font-semibold text-white truncate">{member.displayName || 'Member'}</p>
                                                                            <p className="text-xs text-white/70 truncate">In voice</p>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                </div>

                                                {shouldRenderVoiceStageChatDrawer && (
                                                    <aside
                                                        className="h-full min-h-0 rounded-xl border border-discord-border/70 bg-discord-chat overflow-hidden"
                                                        style={{ width: `${voiceStageChatWidth}px` }}
                                                    >
                                                        <ChannelChat
                                                            channel={activeChannel}
                                                            socket={socket}
                                                            editSignal={editChannelSignal}
                                                            currentUser={channelChatCurrentUser}
                                                            members={rosterFriends}
                                                            showPins={showPins}
                                                            onClosePins={() => setShowPins(false)}
                                                            canEditChannel={canEditChannel}
                                                        />
                                                    </aside>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-full flex gap-3">
                                            <div className="flex-1 min-w-0 h-full flex flex-col">
                                                <div
                                                    className="group relative flex-1 min-h-[260px] rounded-xl border border-emerald-500/55 overflow-hidden bg-zinc-300"
                                                    onMouseEnter={() => setHoveredVoiceTile('primary')}
                                                    onMouseLeave={() => setHoveredVoiceTile(null)}
                                                >
                                                    {primaryVoiceTile?.stream ? (
                                                        <VoiceVideoPlayer
                                                            stream={primaryVoiceTile.stream}
                                                            muted
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="h-full w-full flex items-center justify-center">
                                                            {primaryVoiceTile?.avatar ? (
                                                                <img src={primaryVoiceTile.avatar} alt="" className="w-24 h-24 rounded-full object-cover shadow-lg" />
                                                            ) : (
                                                                <div className="w-24 h-24 rounded-full bg-white/80 flex items-center justify-center text-2xl font-bold text-black shadow-lg">
                                                                    {(primaryVoiceTile?.title || 'U').charAt(0).toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="absolute left-3 top-3 rounded-lg bg-black/45 px-2.5 py-1 text-[11px] text-white backdrop-blur">
                                                        <p className="font-semibold leading-none">{primaryVoiceTile?.title || 'Voice'}</p>
                                                        <p className="text-[10px] text-white/80 mt-1">{primaryVoiceTile?.subtitle || 'Connected'}</p>
                                                    </div>

                                                    <div className={`absolute left-1/2 -translate-x-1/2 bottom-3 transition-all duration-150 ${hoveredVoiceTile === 'primary' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                                                        <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/55 backdrop-blur px-2 py-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => primaryVoiceTile?.stream && setFullscreenStream(primaryVoiceTile.stream)}
                                                                className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                                                                title="Fullscreen"
                                                            >
                                                                <Maximize2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={handleShareToggle}
                                                                className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                                                                title={isSharing ? 'Stop share' : 'Share screen'}
                                                            >
                                                                <MonitorUp className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                                                                title="More"
                                                            >
                                                                <MoreHorizontal className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                        <div className="mt-2 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md px-2.5 py-2">
                                                            <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 text-center mb-2">Quick Reactions</p>
                                                            <div className="flex items-center justify-center gap-2">
                                                                {['🙋', '👍', '👏', '❤️'].map((emoji) => (
                                                                    <button
                                                                        key={`stage-reaction-${emoji}`}
                                                                        type="button"
                                                                        onClick={() => sendQuickReaction(emoji)}
                                                                        className="h-9 w-9 rounded-xl border border-white/15 bg-gradient-to-b from-white/18 to-white/5 hover:from-white/26 hover:to-white/12 text-white flex items-center justify-center shadow-[0_8px_18px_rgba(0,0,0,0.35)] transition-all hover:-translate-y-0.5"
                                                                        title={`React ${emoji}`}
                                                                    >
                                                                        <span className="text-lg leading-none drop-shadow">{emoji}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {secondaryVoiceTiles.length > 0 && (
                                                    <div className="mt-3 rounded-xl border border-discord-border/60 bg-discord-darkest/60 p-2.5">
                                                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-discord-faint mb-2 px-1">
                                                            Participants — {voiceParticipants.length}
                                                        </div>
                                                        <div className="max-h-[180px] overflow-y-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                                                            {secondaryVoiceTiles.map((tile) => (
                                                                <div key={tile.id} className="rounded-lg border border-white/10 bg-black/25 p-2 flex items-center gap-2">
                                                                    <div className="w-8 h-8 rounded-full bg-discord-darkest overflow-hidden flex items-center justify-center text-xs font-semibold text-discord-light shrink-0">
                                                                        {tile.stream ? (
                                                                            <VoiceVideoPlayer stream={tile.stream} muted className="w-8 h-8 object-cover" />
                                                                        ) : tile.avatar ? (
                                                                            <img src={tile.avatar} alt="" className="w-8 h-8 object-cover" />
                                                                        ) : (
                                                                            tile.title.charAt(0).toUpperCase()
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs text-white truncate">{tile.title}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {shouldRenderVoiceStageChatDrawer && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onMouseDown={startVoiceStageChatResize}
                                                        className="group relative w-3 shrink-0 cursor-ew-resize rounded-full bg-discord-border/50 hover:bg-blurple/60 transition-colors"
                                                        aria-label="Resize chat drawer"
                                                        title="Drag to resize"
                                                    >
                                                        <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/35" />
                                                        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-discord-darkest/90 border border-discord-border/60 px-1 py-0.5 text-white/80 opacity-80 group-hover:opacity-100">
                                                            <MoveHorizontal className="w-3 h-3" />
                                                        </span>
                                                    </button>

                                                    <aside
                                                        className="h-full min-h-0 rounded-xl border border-discord-border/70 bg-discord-chat overflow-hidden"
                                                        style={{ width: `${voiceStageChatWidth}px` }}
                                                    >
                                                        <ChannelChat
                                                            channel={activeChannel}
                                                            socket={socket}
                                                            editSignal={editChannelSignal}
                                                            currentUser={channelChatCurrentUser}
                                                            members={rosterFriends}
                                                            showPins={showPins}
                                                            onClosePins={() => setShowPins(false)}
                                                            canEditChannel={canEditChannel}
                                                        />
                                                    </aside>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {showVoiceInviteModal && isViewingActiveVoiceChannel && (
                                        <div className="fixed inset-0 z-[95] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowVoiceInviteModal(false)}>
                                            <div className="w-full max-w-3xl max-h-[82vh] rounded-2xl border border-discord-border/70 bg-discord-darker shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
                                                <div className="px-4 py-3 border-b border-discord-border/50 flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-semibold text-discord-light">Invite Others</p>
                                                        <p className="text-[11px] text-discord-faint">Add community members to this voice channel.</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowVoiceInviteModal(false)}
                                                        className="w-8 h-8 rounded-md hover:bg-discord-border-light/30 text-discord-faint hover:text-discord-light flex items-center justify-center"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <div className="p-4 border-b border-discord-border/40">
                                                    <div className="relative">
                                                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-discord-faint" />
                                                        <input
                                                            type="text"
                                                            value={voiceInviteSearch}
                                                            onChange={(e) => setVoiceInviteSearch(e.target.value)}
                                                            placeholder="Search members"
                                                            className="w-full pl-8 pr-3 py-2 rounded-lg bg-discord-darkest border border-discord-border/50 text-sm text-discord-light placeholder:text-discord-faint/70 outline-none"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="p-4 flex-1 overflow-y-auto space-y-2">
                                                    {inviteCandidates.length === 0 && (
                                                        <div className="h-full min-h-[120px] flex items-center justify-center text-xs text-discord-faint text-center">
                                                            No members available to invite.
                                                        </div>
                                                    )}
                                                    {inviteCandidates.map((member) => {
                                                        const isInviting = invitingVoiceUserIds.includes(member._id);
                                                        const isInvited = voiceInvitedUserIds.includes(member._id);
                                                        const isInCall = inCallUserIds.has(member._id);
                                                        return (
                                                            <div key={member._id} className="rounded-lg bg-discord-darkest/70 border border-discord-border/40 px-2.5 py-2 flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-full bg-discord-darkest flex items-center justify-center text-xs font-semibold overflow-hidden">
                                                                    {member.avatar ? (
                                                                        <img src={member.avatar} alt="" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        (member.displayName || 'M').charAt(0).toUpperCase()
                                                                    )}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-sm text-discord-light font-semibold truncate">{member.displayName || 'Member'}</p>
                                                                    <p className="text-[11px] text-discord-faint truncate">{member.username ? `@${member.username}` : 'Member'}</p>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    disabled={isInCall || isInviting || isInvited}
                                                                    onClick={() => inviteUserToVoice(member)}
                                                                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold ${isInCall
                                                                            ? 'bg-discord-border/30 text-discord-faint cursor-not-allowed'
                                                                            : isInviting
                                                                                ? 'bg-amber-500/20 text-amber-200 cursor-wait'
                                                                                : isInvited
                                                                                    ? 'bg-emerald-500/20 text-emerald-200 cursor-default'
                                                                                    : 'bg-blurple/80 text-white hover:bg-blurple'
                                                                        }`}
                                                                >
                                                                    {isInCall ? 'In Call' : isInviting ? 'Inviting...' : isInvited ? 'Invited' : 'Invite'}
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {!shouldRenderVoiceStageChatDrawer && (
                            <ChannelChat
                                channel={activeChannel}
                                socket={socket}
                                editSignal={editChannelSignal}
                                currentUser={channelChatCurrentUser}
                                members={communityMembers}
                                roles={roles}
                                showPins={showPins}
                                onClosePins={() => setShowPins(false)}
                                canEditChannel={canEditChannel}
                            />
                        )}
                    </>
                ) : viewMode === 'dm' ? (
                    <>
                        {activeDm ? (
                            <DmPanel
                                activeDm={{ ...activeDm, selfId: user?._id, selfInitial: displayName.charAt(0).toUpperCase() }}
                                messages={messages}
                                typing={!!typingUser}
                                typingName={typingUser ? activeDm?.displayName : ''}
                                value={dmText}
                                onChange={setDmText}
                                files={dmFiles}
                                onAddFiles={(fileList) => {
                                    const next = Array.from(fileList || []).map((file) => ({
                                        file,
                                        id: `${file.name}-${file.size}-${file.lastModified}`,
                                        isImage: file.type.startsWith('image/'),
                                        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
                                    }));
                                    setDmFiles((prev) => [...prev, ...next]);
                                }}
                                onRemoveFile={(id) => {
                                    setDmFiles((prev) => {
                                        const file = prev.find((f) => f.id === id);
                                        if (file?.preview) URL.revokeObjectURL(file.preview);
                                        return prev.filter((f) => f.id !== id);
                                    });
                                }}
                                sending={dmSending}
                                onTyping={() => {
                                    if (!threadId) return;
                                    socket?.emit('dm:typing', { threadId, userId: user?._id, isTyping: true });
                                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                                    typingTimeoutRef.current = setTimeout(() => {
                                        socket?.emit('dm:typing', { threadId, userId: user?._id, isTyping: false });
                                    }, 1200);
                                }}
                                onSend={async () => {
                                    const normalizedText = normalizeEmojiShortcodes(dmText);
                                    if (!normalizedText.trim() && dmFiles.length === 0) return;
                                    setDmSending(true);
                                    try {
                                        const mediaURLs = [];
                                        for (const f of dmFiles) {
                                            const url = await uploadFile(f.file);
                                            mediaURLs.push(url);
                                        }
                                        const payload = { content: normalizedText.trim(), mediaURLs };
                                        const msg = await sendMessage(threadId, payload);
                                        pushMessage(msg);
                                        setDmText('');
                                        dmFiles.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
                                        setDmFiles([]);
                                        socket?.emit('dm:typing', { threadId, userId: user?._id, isTyping: false });
                                    } finally {
                                        setDmSending(false);
                                    }
                                }}
                                onOpenSidebar={() => setShowMobileDmList(true)}
                                onOpenServers={() => setShowMobileServers(true)}
                                onCall={startDmCall}
                                onJoinCall={joinDmRoom}
                                onJoinWithVideo={joinDmRoomWithVideo}
                                onOpenInvite={openCallInviteModal}
                                onAddToGroup={openGroupAddModal}
                                onLeaveGroup={handleLeaveGroup}
                                canAddToGroup={!!activeDm}
                                callDisabled={!threadId || !!outgoingCall || !!incomingCall || !!activeDmCall}
                                activeCall={activeDmCall}
                                selfProfile={{ avatar: profile?.avatar || '', displayName }}
                                onToggleMute={toggleMute}
                                onToggleCamera={() => {
                                    if (isCameraOn) stopCamera();
                                    else startCamera();
                                }}
                                onToggleShare={() => {
                                    handleShareToggle();
                                }}
                                onSendReaction={sendQuickReaction}
                                onEndCall={endDmCall}
                                isMuted={isMuted}
                                isSharing={isSharing}
                                isCameraOn={isCameraOn}
                                screenShareStream={screenShareStream}
                                screenShareStreams={screenShareTiles}
                                localCameraStream={localCameraStream}
                                remoteCameraStream={remoteCameraStream}
                                remoteCameraStreams={remoteCameraStreams}
                                participants={voiceParticipants}
                                isRemoteScreenShare={isRemoteScreenShare}
                                onOpenStreamFullscreen={(stream) => setFullscreenStream(stream)}
                                callStatus={{
                                    isActive: isDmRoomActive,
                                    participantCount: dmRoomCount,
                                    isInCall: isInDmCall,
                                    members: dmRoomMembers,
                                }}
                            />
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-discord-faint">Select a friend to start chatting.</div>
                        )}
                    </>
                ) : (
                    <>
                        <div className="ui-topbar px-4 py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                                <button
                                    onClick={() => setShowMobileServers(true)}
                                    className="ui-icon-btn md:hidden w-8 h-8 flex items-center justify-center"
                                    title="Open servers"
                                >
                                    <Server className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setShowMobileDmList(true)}
                                    className="ui-icon-btn md:hidden w-8 h-8 flex items-center justify-center"
                                    title="Open direct messages"
                                >
                                    <Menu className="w-4 h-4" />
                                </button>
                                <User className="w-5 h-5 text-discord-faint" />
                                <span className="text-discord-white">Friends</span>
                                <span className="text-discord-faint">|</span>
                                <div className="flex items-center gap-1 overflow-x-auto">
                                    <button
                                        onClick={() => setActiveTab('online')}
                                        className={`ui-chip px-2 py-1 text-xs font-semibold cursor-pointer ${activeTab === 'online' ? 'ui-chip--active' : ''
                                            }`}
                                    >
                                        Online
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('all')}
                                        className={`ui-chip px-2 py-1 text-xs font-semibold cursor-pointer ${activeTab === 'all' ? 'ui-chip--active' : ''
                                            }`}
                                    >
                                        All
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('requests')}
                                        className={`ui-chip px-2 py-1 text-xs font-semibold cursor-pointer ${activeTab === 'requests' ? 'ui-chip--active' : ''
                                            }`}
                                    >
                                        Message Requests
                                        {pendingCount > 0 && (
                                            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-500 text-[10px] font-semibold text-white">
                                                {pendingCount}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('invites')}
                                        className={`ui-chip px-2 py-1 text-xs font-semibold cursor-pointer ${activeTab === 'invites' ? 'ui-chip--active' : ''
                                            }`}
                                    >
                                        Suggestions
                                        {suggestionCount > 0 && (
                                            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-blurple/80 text-[10px] font-semibold text-white">
                                                {suggestionCount}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => setActiveTab('add')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${activeTab === 'add'
                                        ? 'bg-blurple text-white'
                                        : 'bg-blurple/35 text-blue-100 hover:bg-blurple/55'
                                    }`}
                            >
                                Add Friend
                            </button>
                        </div>

                        {activeTab !== 'add' && (
                            <div className="hidden md:block px-4 py-3 border-b border-discord-darkest/80">
                                <div className="relative w-full max-w-[560px]">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-discord-faint" />
                                    <input
                                        type="text"
                                        value={friendSearchQuery}
                                        onChange={(e) => setFriendSearchQuery(e.target.value)}
                                        placeholder="Search"
                                        className="ui-search-input w-full pl-8 pr-3 py-2 text-xs placeholder:text-discord-faint/60 focus:outline-none"
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'add' && (
                            <div className="flex-1 overflow-y-auto px-4 py-6">
                                <div className="max-w-3xl">
                                    <h2 className="text-xl font-bold text-white">Add Friend</h2>
                                    <p className="text-sm text-discord-muted mt-1">Search users by name/email or send by user ID.</p>

                                    <div className="mt-4 rounded-xl bg-discord-darkest/70 border border-discord-border/50 px-3 py-2">
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-discord-faint" />
                                            <input
                                                type="text"
                                                value={addFriendSearchQuery}
                                                onChange={(e) => setAddFriendSearchQuery(e.target.value)}
                                                placeholder="Search users"
                                                className="w-full pl-8 pr-3 py-2 bg-transparent text-sm text-discord-white placeholder:text-discord-faint/60 outline-none"
                                            />
                                        </div>
                                    </div>

                                    {addFriendSearchQuery.trim().length >= 2 && (
                                        <div className="mt-3 rounded-xl border border-discord-border/50 bg-discord-darkest/55 divide-y divide-discord-border/40 overflow-hidden">
                                            {searchResults.length === 0 ? (
                                                <div className="px-3 py-4 text-xs text-discord-faint">No users found.</div>
                                            ) : (
                                                searchResults.map((candidate) => (
                                                    <div key={`candidate-${candidate._id}`} className="px-3 py-2 flex items-center gap-3 justify-between">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="w-9 h-9 rounded-full bg-discord-darkest overflow-hidden flex items-center justify-center text-xs font-semibold text-discord-light shrink-0">
                                                                {candidate.avatar ? (
                                                                    <img src={candidate.avatar} alt="" className="w-9 h-9 object-cover" />
                                                                ) : (
                                                                    (candidate.displayName || 'U').charAt(0).toUpperCase()
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-semibold text-discord-white truncate">{candidate.displayName}</p>
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <p className="text-[11px] text-discord-faint truncate">{candidate.username ? `@${candidate.username}` : candidate._id}</p>
                                                                    {!!candidate.mutualFriendsCount && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-discord-border/40 text-discord-light">
                                                                            {candidate.mutualFriendsCount} mutual
                                                                        </span>
                                                                    )}
                                                                    {candidate.relationship === 'friend' && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200">Friend</span>
                                                                    )}
                                                                    {candidate.relationship === 'outgoing' && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200">Requested</span>
                                                                    )}
                                                                    {candidate.relationship === 'incoming' && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-200">Wants to connect</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {candidate.relationship === 'incoming' ? (
                                                            <button
                                                                onClick={async () => {
                                                                    await acceptRequest(candidate._id);
                                                                    fetchFriends();
                                                                    fetchRequests();
                                                                    searchUsers(addFriendSearchQuery.trim()).catch(() => { });
                                                                }}
                                                                disabled={isFriendLoading}
                                                                className="px-3 py-1.5 rounded-md bg-discord-green text-xs font-semibold text-discord-darkest hover:bg-discord-green/90 disabled:opacity-60"
                                                            >
                                                                Accept
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleSendRequest(candidate._id)}
                                                                disabled={isFriendLoading || candidate.relationship === 'friend' || candidate.relationship === 'outgoing'}
                                                                className={`px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-60 ${candidate.relationship === 'friend'
                                                                        ? 'bg-discord-border/30 text-discord-faint cursor-not-allowed'
                                                                        : candidate.relationship === 'outgoing'
                                                                            ? 'bg-amber-500/20 text-amber-200 cursor-not-allowed'
                                                                            : 'bg-blurple text-white hover:bg-blurple-hover'
                                                                    }`}
                                                            >
                                                                {candidate.relationship === 'friend' ? 'Added' : candidate.relationship === 'outgoing' ? 'Requested' : 'Add'}
                                                            </button>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}

                                    <div className="mt-4 flex items-center gap-3 rounded-xl bg-discord-darkest/70 border border-discord-border/50 px-3 py-2">
                                        <input
                                            type="text"
                                            value={friendIdInput}
                                            onChange={(e) => setFriendIdInput(e.target.value)}
                                            placeholder="Enter user ID"
                                            className="flex-1 bg-transparent text-sm text-discord-white placeholder:text-discord-faint/60 outline-none"
                                        />
                                        <button
                                            onClick={handleSendRequest}
                                            disabled={isFriendLoading}
                                            className="px-4 py-2 rounded-lg bg-blurple text-sm font-semibold text-white hover:bg-blurple-hover disabled:opacity-60 cursor-pointer"
                                        >
                                            Send Friend Request
                                        </button>
                                    </div>

                                    {(friendError || friendSuccess) && (
                                        <div className={`mt-3 text-sm ${friendError ? 'text-discord-red' : 'text-discord-green'}`}>
                                            {friendError || friendSuccess}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'requests' && (
                            <div className="flex-1 overflow-y-auto px-4 py-4">
                                <div className="flex items-center gap-2 mb-3">
                                    {[
                                        { key: 'all', label: `All (${pendingCount})` },
                                        { key: 'incoming', label: `Incoming (${incoming.length})` },
                                        { key: 'outgoing', label: `Outgoing (${outgoing.length})` },
                                    ].map((item) => (
                                        <button
                                            key={item.key}
                                            onClick={() => setRequestFilter(item.key)}
                                            className={`ui-chip px-2.5 py-1.5 text-xs font-semibold ${requestFilter === item.key ? 'ui-chip--active' : ''}`}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>

                                {requestFilter === 'incoming' && requestBuckets.incoming.length === 0 && (
                                    <div className="px-3 py-6 text-xs text-discord-faint">No incoming requests.</div>
                                )}
                                {requestFilter === 'outgoing' && requestBuckets.outgoing.length === 0 && (
                                    <div className="px-3 py-6 text-xs text-discord-faint">No outgoing requests.</div>
                                )}
                                {requestFilter === 'all' && requestBuckets.all.length === 0 && (
                                    <div className="px-3 py-6 text-xs text-discord-faint">No message requests right now.</div>
                                )}

                                <div className="space-y-1">
                                    {(requestFilter === 'incoming'
                                        ? requestBuckets.incoming.map((f) => ({ ...f, requestType: 'incoming' }))
                                        : requestFilter === 'outgoing'
                                            ? requestBuckets.outgoing.map((f) => ({ ...f, requestType: 'outgoing' }))
                                            : requestBuckets.all
                                    ).map((friend) => (
                                        <div key={`${friend.requestType}-${friend._id}`} className="ui-list-row w-full flex items-center justify-between px-3 py-2 bg-discord-darkest/55">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="relative w-9 h-9 rounded-full bg-discord-darker flex items-center justify-center text-sm font-semibold text-discord-light shrink-0">
                                                    {friend.avatar ? (
                                                        <img src={friend.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                                                    ) : (
                                                        friend.displayName.charAt(0).toUpperCase()
                                                    )}
                                                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-discord-darkest ${presenceColor(friend.presence)}`} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-discord-white truncate">{friend.displayName}</p>
                                                    <p className="text-[11px] text-discord-faint truncate">
                                                        {friend.requestType === 'incoming' ? 'Wants to connect' : 'Request sent'}
                                                        {friend.username ? ` · ${friend.username}` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {friend.requestType === 'incoming' ? (
                                                    <>
                                                        <button
                                                            onClick={async () => {
                                                                await acceptRequest(friend._id);
                                                                fetchFriends();
                                                                fetchRequests();
                                                            }}
                                                            className="px-3 py-1.5 rounded-md bg-discord-green text-xs font-semibold text-discord-darkest hover:bg-discord-green/90 cursor-pointer"
                                                        >
                                                            Accept
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                await declineRequest(friend._id);
                                                                fetchRequests();
                                                            }}
                                                            className="px-3 py-1.5 rounded-md bg-discord-darkest text-xs font-semibold text-discord-faint hover:bg-discord-border-light/40 cursor-pointer"
                                                        >
                                                            Decline
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className="px-2 py-1 rounded-md text-[11px] font-semibold text-discord-faint bg-discord-darkest/80 border border-discord-border/60">
                                                        Pending
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'invites' && (
                            <div className="flex-1 overflow-y-auto px-4 py-4">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-discord-faint mb-2">
                                    Server Invites — {invites.length}
                                </div>
                                {inviteError && (
                                    <div className="px-3 py-2 mb-3 text-xs text-discord-red bg-discord-red/10 border border-discord-red/20 rounded-md">
                                        {inviteError}
                                    </div>
                                )}
                                {isInviteLoading && (
                                    <div className="px-3 py-4 text-xs text-discord-faint">Loading invites…</div>
                                )}
                                {!isInviteLoading && invites.length === 0 && (
                                    <div className="px-3 py-4 text-xs text-discord-faint">No server invites yet.</div>
                                )}
                                <div className="space-y-1">
                                    {invites.map((invite) => (
                                        <div key={invite._id} className="ui-list-row w-full flex items-center justify-between px-3 py-2 bg-discord-darkest/55">
                                            <div className="flex items-center gap-3">
                                                <div className="relative w-9 h-9 rounded-full bg-discord-darker flex items-center justify-center text-sm font-semibold text-discord-light">
                                                    {invite.community?.icon ? (
                                                        <img src={invite.community.icon} alt="" className="w-9 h-9 rounded-full object-cover" />
                                                    ) : (
                                                        (invite.community?.name || 'S').charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-discord-white">{invite.community?.name || 'Server'}</p>
                                                    <p className="text-[11px] text-discord-faint">Invited by {invite.inviter?.name || 'Admin'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={async () => {
                                                        const data = await acceptInvite(invite._id);
                                                        if (data?.user) setUser(data.user);
                                                    }}
                                                    className="px-3 py-1.5 rounded-md bg-discord-green text-xs font-semibold text-discord-darkest hover:bg-discord-green/90 cursor-pointer"
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={async () => { await declineInvite(invite._id); }}
                                                    className="px-3 py-1.5 rounded-md bg-discord-darkest text-xs font-semibold text-discord-faint hover:bg-discord-border-light/40 cursor-pointer"
                                                >
                                                    Decline
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(activeTab === 'online' || activeTab === 'all') && (
                            <div className="flex-1 min-h-0 flex">
                                <div className="flex-1 overflow-y-auto px-4 py-4">
                                    <div className="ui-section-label text-[11px] font-semibold uppercase mb-2">
                                        Online — {onlineCount}
                                    </div>
                                    <div className="space-y-0">
                                        {isFriendLoading && (
                                            <div className="px-3 py-6 text-xs text-discord-faint">Loading friends…</div>
                                        )}
                                        {!isFriendLoading && filteredFriends.length === 0 && (
                                            <div className="px-3 py-6 text-xs text-discord-faint">No friends to show.</div>
                                        )}
                                        {activeFriendMenuId && (
                                            <button
                                                onClick={() => setActiveFriendMenuId(null)}
                                                className="fixed inset-0 z-10 cursor-default"
                                            />
                                        )}
                                        {filteredFriends.map((friend) => (
                                            <div
                                                key={friend._id}
                                                className="ui-list-row w-full relative flex items-center justify-between px-3 py-2 text-left"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="relative w-9 h-9 rounded-full bg-discord-darker flex items-center justify-center text-sm font-semibold text-discord-light shrink-0">
                                                        {friend.avatar ? (
                                                            <img src={friend.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                                                        ) : (
                                                            friend.displayName.charAt(0).toUpperCase()
                                                        )}
                                                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-discord-darkest ${presenceColor(friend.presence)}`} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-discord-white truncate">{friend.displayName}</p>
                                                        <p className="text-[11px] text-discord-faint truncate">{filterStatusText(friend.statusText || friend.status) || (friend.presence === 'online' ? 'Online' : friend.presence === 'idle' ? 'Idle' : friend.presence === 'dnd' ? 'Do Not Disturb' : 'Offline')}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => openDmForFriend(friend)}
                                                        className="ui-icon-btn w-7 h-7 flex items-center justify-center cursor-pointer"
                                                        title="Message"
                                                    >
                                                        <MessageCircle className="w-3.5 h-3.5 text-discord-faint" />
                                                    </button>
                                                    <button
                                                        onClick={() => setActiveFriendMenuId((prev) => (prev === friend._id ? null : friend._id))}
                                                        className="ui-icon-btn w-7 h-7 flex items-center justify-center cursor-pointer"
                                                        title="More"
                                                    >
                                                        <MoreVertical className="w-3.5 h-3.5 text-discord-faint" />
                                                    </button>
                                                </div>
                                                {activeFriendMenuId === friend._id && (
                                                    <div className="absolute right-2 top-11 z-20 w-44 rounded-lg border border-discord-border/60 bg-discord-darkest shadow-xl p-1">
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    await removeFriend(friend._id);
                                                                } catch { }
                                                                setActiveFriendMenuId(null);
                                                            }}
                                                            className="w-full text-left px-3 py-2 text-sm text-discord-red hover:bg-discord-border/40 rounded-md"
                                                        >
                                                            Remove Friend
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                startCallForFriend(friend);
                                                                setActiveFriendMenuId(null);
                                                            }}
                                                            className="w-full text-left px-3 py-2 text-sm text-discord-light hover:bg-discord-border/40 rounded-md"
                                                        >
                                                            Call
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <aside className="hidden lg:block w-80 border-l border-discord-darkest/80 px-4 py-4 bg-discord-chat/40">
                                    <h3 className="text-2xl font-bold text-white mb-4">Active Now</h3>
                                    {activeNowFriends.length === 0 ? (
                                        <div className="rounded-xl border border-discord-border/60 bg-discord-darkest/40 p-4 text-sm text-discord-faint">
                                            It's quiet for now. Check back later.
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-discord-border/60 bg-discord-darkest/40 divide-y divide-discord-border/40 overflow-hidden">
                                            {activeNowFriends.map((friend) => (
                                                <div key={`active-${friend._id}`} className="p-3 flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-discord-darker overflow-hidden flex items-center justify-center text-sm font-semibold text-discord-light shrink-0">
                                                        {friend.avatar ? (
                                                            <img src={friend.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                                                        ) : (
                                                            friend.displayName.charAt(0).toUpperCase()
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-discord-white truncate">{friend.displayName}</p>
                                                        <p className="text-xs text-discord-faint truncate">
                                                            {filterStatusText(friend.statusText || friend.status) || 'In a Voice Channel'}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </aside>
                            </div>
                        )}
                    </>
                )}
            </main>

            {viewMode === 'server' && shouldShowServerMembersPanel && showMemberList && (
                <>
                    <aside className="hidden lg:flex w-60 border-l border-discord-darkest/80 bg-[#1a1a1e] flex-col">
                        {memberListBody}
                    </aside>
                    <div className="lg:hidden">
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setShowMemberList(false)} />
                        <aside className="fixed top-0 right-0 bottom-0 w-72 bg-[#1a1a1e] z-50 shadow-2xl flex flex-col">
                            <div className="h-12 flex items-center justify-between px-4 border-b border-discord-darkest/80 bg-[#1a1a1e]">
                                <span className="text-sm font-semibold text-discord-light">Members</span>
                                <button onClick={() => setShowMemberList(false)} className="text-discord-faint hover:text-white">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            {memberListBody}
                        </aside>
                    </div>
                </>
            )}

            <ProfilePopout
                isOpen={showProfilePopout}
                onClose={() => setShowProfilePopout(false)}
                profile={profile}
                user={user}
                onUpdatePresence={async (presence) => {
                    if (!user?._id) return;
                    await updateProfile(user._id, { presence });
                }}
                onUpdateStatus={async (status) => {
                    if (!user?._id) return;
                    await updateProfile(user._id, { status });
                }}
                onEditProfile={() => setShowProfileSettings(true)}
                anchorClassName={viewMode === 'friends' ? 'md:left-[272px]' : 'md:left-[300px]'}
            />

            <MemberProfilePopout
                isOpen={showMemberPopout}
                onClose={() => setShowMemberPopout(false)}
                member={selectedMember}
                anchorClassName="md:top-24 md:right-[260px]"
            />

            <ProfileSettingsModal
                isOpen={showProfileSettings}
                onClose={() => setShowProfileSettings(false)}
                profile={profile}
                user={user}
                onSave={async (payload) => {
                    if (!user?._id) return;
                    await updateProfile(user._id, payload);
                }}
            />

            {incomingCall && (
                <div className="dm-call-modal fixed inset-0 z-[80] flex items-center justify-center">
                    <div className="dm-call-card dm-call-card--incoming w-[360px] rounded-3xl border border-discord-border/60 shadow-2xl p-7 text-center space-y-5">
                        <div className="dm-call-card__ambient" aria-hidden="true">
                            <span className="dm-call-card__orb dm-call-card__orb--one" />
                            <span className="dm-call-card__orb dm-call-card__orb--two" />
                            <span className="dm-call-card__ring dm-call-card__ring--one" />
                            <span className="dm-call-card__ring dm-call-card__ring--two" />
                        </div>
                        <div className="dm-call-card__content space-y-4">
                            <div className="dm-call-avatar-wrap">
                                <div className="dm-call-avatar w-20 h-20 rounded-full bg-discord-darkest mx-auto flex items-center justify-center text-2xl font-bold text-white overflow-hidden">
                                    {incomingCall.threadMeta?.isGroup ? (
                                        (incomingCall.threadMeta?.displayName || 'G').charAt(0).toUpperCase()
                                    ) : incomingCall.fromUser?.avatar ? (
                                        <img src={incomingCall.fromUser.avatar} alt="" className="w-20 h-20 object-cover" />
                                    ) : (
                                        (incomingCall.fromUser?.displayName || 'F').charAt(0).toUpperCase()
                                    )}
                                </div>
                                <span className="dm-call-avatar-pulse" aria-hidden="true" />
                                <span className="dm-call-avatar-pulse dm-call-avatar-pulse--delay" aria-hidden="true" />
                            </div>
                            <div>
                                <p className="text-sm text-discord-faint uppercase tracking-[0.3em]">Incoming</p>
                                <p className="text-xl font-semibold text-white mt-2">
                                    {incomingCall.threadMeta?.displayName || incomingCall.fromUser?.displayName || 'Friend'}
                                </p>
                            </div>
                            <div className="dm-call-actions flex items-center justify-center gap-4">
                                <button
                                    onClick={declineDmCall}
                                    className="dm-call-action dm-call-action--decline w-12 h-12 rounded-full text-white flex items-center justify-center"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={acceptDmCall}
                                    className="dm-call-action dm-call-action--accept w-12 h-12 rounded-full text-white flex items-center justify-center"
                                >
                                    <Phone className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showGroupAdd && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-[520px] max-w-[92vw] rounded-2xl border border-discord-border/60 bg-discord-darker shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-discord-darkest/80">
                            <div>
                                <h3 className="text-lg font-semibold text-white">Add Friends to Group DM</h3>
                                <p className="text-xs text-discord-faint mt-1">
                                    Select friends to add to this group conversation.
                                </p>
                                <p className="text-[11px] text-discord-faint mt-1">
                                    {remainingSlots} slots left (max {maxGroupSize} members).
                                </p>
                            </div>
                            <button
                                onClick={() => setShowGroupAdd(false)}
                                className="w-8 h-8 rounded-full bg-discord-darkest/70 text-discord-faint hover:text-white flex items-center justify-center"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="px-6 pt-4 pb-2">
                            <div className="flex items-center gap-3">
                                <input
                                    value={groupSearch}
                                    onChange={(e) => setGroupSearch(e.target.value)}
                                    placeholder="Search for friends"
                                    className="flex-1 px-3 py-2 rounded-xl bg-discord-darkest text-sm text-discord-light border border-discord-border/60 focus:outline-none focus:ring-2 focus:ring-blurple/60"
                                />
                                <button
                                    onClick={handleAddGroupMembers}
                                    disabled={groupSelection.length === 0 || remainingSlots === 0}
                                    className="px-4 py-2 rounded-xl bg-blurple text-white text-sm font-semibold disabled:opacity-50"
                                >
                                    Add
                                </button>
                            </div>
                        </div>
                        <div className="px-6 pb-5 max-h-[360px] overflow-y-auto space-y-1">
                            {groupError && (
                                <div className="px-3 py-2 rounded-lg text-xs text-discord-red bg-discord-red/10 border border-discord-red/30">
                                    {groupError}
                                </div>
                            )}
                            {groupCandidateList.length === 0 && (
                                <div className="py-8 text-center text-sm text-discord-faint">No friends available.</div>
                            )}
                            {groupCandidateList.map((friend) => (
                                (() => {
                                    const atLimit = remainingSlots <= groupSelection.length;
                                    const isSelected = groupSelection.includes(friend._id);
                                    const disabled = !isSelected && atLimit;
                                    return (
                                        <button
                                            key={friend._id}
                                            onClick={() => !disabled && toggleGroupSelection(friend._id)}
                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-discord-darkest/70'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="relative w-10 h-10 rounded-full bg-discord-darkest flex items-center justify-center text-sm font-semibold text-discord-light">
                                                    {friend.avatar ? (
                                                        <img src={friend.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                                                    ) : (
                                                        friend.displayName?.charAt(0).toUpperCase()
                                                    )}
                                                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-discord-darker ${presenceColor(friend.presence)}`} />
                                                </div>
                                                <div>
                                                    <p className="text-sm text-discord-light font-semibold">{friend.displayName}</p>
                                                    <p className="text-xs text-discord-faint">{friend.username}</p>
                                                </div>
                                            </div>
                                            <div className={`w-5 h-5 rounded-md border ${isSelected ? 'bg-blurple border-blurple' : 'border-discord-border/60'}`} />
                                        </button>
                                    );
                                })()
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showCallInvite && (
                <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-[520px] max-w-[92vw] rounded-2xl border border-discord-border/60 bg-discord-darker shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-discord-darkest/80">
                            <div>
                                <h3 className="text-lg font-semibold text-white">Invite People to Call</h3>
                                <p className="text-xs text-discord-faint mt-1">
                                    Invite friends to join this call.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowCallInvite(false)}
                                className="w-8 h-8 rounded-full bg-discord-darkest/70 text-discord-faint hover:text-white flex items-center justify-center"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="px-6 pt-4 pb-2">
                            <div className="flex items-center gap-3">
                                <input
                                    value={callInviteSearch}
                                    onChange={(e) => setCallInviteSearch(e.target.value)}
                                    placeholder="Search for friends"
                                    className="flex-1 px-3 py-2 rounded-xl bg-discord-darkest text-sm text-discord-light border border-discord-border/60 focus:outline-none focus:ring-2 focus:ring-blurple/60"
                                />
                                <button
                                    onClick={handleSendCallInvites}
                                    disabled={callInviteSelection.length === 0}
                                    className="px-4 py-2 rounded-xl bg-blurple text-white text-sm font-semibold disabled:opacity-50"
                                >
                                    Invite
                                </button>
                            </div>
                        </div>
                        <div className="px-6 pb-5 max-h-[360px] overflow-y-auto space-y-1">
                            {callInviteError && (
                                <div className="px-3 py-2 rounded-lg text-xs text-discord-red bg-discord-red/10 border border-discord-red/30">
                                    {callInviteError}
                                </div>
                            )}
                            {callInviteCandidates.length === 0 && (
                                <div className="px-3 py-2 text-xs text-discord-faint">No friends match your search.</div>
                            )}
                            {callInviteCandidates.map((friend) => {
                                const isInCall = callRoomMemberIds.has(friend._id);
                                const isInvited = callRoomInvitedIds.has(friend._id);
                                const isSelected = callInviteSelection.includes(friend._id);
                                const isDisabled = isInCall || isInvited;
                                return (
                                    <button
                                        key={friend._id}
                                        disabled={isDisabled}
                                        onClick={() => toggleCallInviteSelection(friend._id)}
                                        className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left transition ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-discord-darkest/70'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-discord-darkest flex items-center justify-center text-xs font-semibold text-discord-light overflow-hidden">
                                                {friend.avatar ? (
                                                    <img src={friend.avatar} alt="" className="w-10 h-10 object-cover" />
                                                ) : (
                                                    (friend.displayName || 'F').charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-sm text-discord-light font-semibold">{friend.displayName}</p>
                                                <p className="text-xs text-discord-faint">{friend.username}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isInCall && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-200">
                                                    In Call
                                                </span>
                                            )}
                                            {!isInCall && isInvited && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-200">
                                                    Invited
                                                </span>
                                            )}
                                            {!isDisabled && (
                                                <div className={`w-5 h-5 rounded-md border ${isSelected ? 'bg-blurple border-blurple' : 'border-discord-border/60'}`} />
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {incomingRoomInvite && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="w-[360px] max-w-[92vw] rounded-2xl border border-discord-border/60 bg-discord-darker shadow-2xl p-6 text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-discord-darkest mx-auto flex items-center justify-center text-2xl font-bold text-white overflow-hidden">
                            {incomingRoomInvite.invitedByAvatar ? (
                                <img src={incomingRoomInvite.invitedByAvatar} alt="" className="w-16 h-16 object-cover" />
                            ) : (
                                ((incomingRoomInvite.invitedByName || friends.find((f) => f._id === incomingRoomInvite.invitedBy)?.displayName) || 'C').charAt(0).toUpperCase()
                            )}
                        </div>
                        <div>
                            <p className="text-sm text-discord-faint uppercase tracking-[0.3em]">Call Invite</p>
                            <p className="text-lg font-semibold text-white mt-2">
                                {(incomingRoomInvite.invitedByName || friends.find((f) => f._id === incomingRoomInvite.invitedBy)?.displayName || 'Someone')} invited you to a call
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-4">
                            <button
                                onClick={rejectRoomInvite}
                                className="w-12 h-12 rounded-full bg-discord-darkest text-discord-faint hover:text-white flex items-center justify-center"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <button
                                onClick={acceptRoomInvite}
                                className="w-12 h-12 rounded-full bg-emerald-500/90 text-white flex items-center justify-center hover:bg-emerald-500"
                            >
                                <Phone className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {outgoingCall && !activeDmCall && (
                <div className="dm-call-modal dm-call-modal--soft fixed inset-0 z-[70] flex items-center justify-center">
                    <div className="dm-call-card dm-call-card--outgoing w-[300px] rounded-3xl border border-discord-border/60 shadow-2xl p-6 text-center space-y-4">
                        <div className="dm-call-card__ambient" aria-hidden="true">
                            <span className="dm-call-card__orb dm-call-card__orb--one" />
                            <span className="dm-call-card__orb dm-call-card__orb--two" />
                        </div>
                        <div className="dm-call-card__content space-y-3">
                            <p className="dm-call-status text-xs text-discord-faint uppercase tracking-[0.35em]">
                                Calling
                                <span className="dm-call-dots" aria-hidden="true">
                                    <span />
                                    <span />
                                    <span />
                                </span>
                            </p>
                            <p className="text-xl font-semibold text-white">{outgoingCall.toUser?.displayName || 'Friend'}</p>
                            <button
                                onClick={cancelDmCall}
                                className="dm-call-action dm-call-action--decline px-6 py-2.5 rounded-full text-white text-sm font-semibold"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeDmCall && !isViewingActiveCall && (
                <div className="fixed bottom-6 left-6 z-[88] w-[320px] max-w-[80vw] rounded-2xl border border-discord-border/60 bg-discord-darker/95 shadow-2xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="relative h-12 w-12 rounded-xl bg-discord-darkest overflow-hidden flex items-center justify-center text-sm font-semibold text-white">
                            {activeCallEntry?.avatar ? (
                                <img src={activeCallEntry.avatar} alt="" className="h-full w-full object-cover" />
                            ) : (
                                activeCallTitle.charAt(0).toUpperCase()
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] uppercase tracking-[0.32em] text-discord-faint">Call Active</p>
                            <p className="text-sm font-semibold text-white truncate">{activeCallTitle}</p>
                            <p className="text-xs text-discord-muted">
                                {activeCallCount > 0 ? `${activeCallCount} in call` : 'Join the call'}
                            </p>
                        </div>
                        <button
                            onClick={returnToActiveCall}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/80 text-white text-xs font-semibold hover:bg-emerald-500"
                        >
                            Return
                        </button>
                    </div>
                    {activeCallMembers.length > 0 && (
                        <div className="mt-3 flex items-center -space-x-2">
                            {activeCallMembers.slice(0, 5).map((member) => (
                                <div
                                    key={member.socketId || member.userId}
                                    className="h-7 w-7 rounded-full border-2 border-discord-darker bg-discord-darkest overflow-hidden flex items-center justify-center text-[10px] font-semibold text-white"
                                    title={member.displayName || 'Member'}
                                >
                                    {member.avatar ? (
                                        <img src={member.avatar} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        (member.displayName || 'M').charAt(0).toUpperCase()
                                    )}
                                </div>
                            ))}
                            {activeCallMembers.length > 5 && (
                                <span className="ml-2 text-xs text-discord-faint">+{activeCallMembers.length - 5}</span>
                            )}
                        </div>
                    )}
                </div>
            )}

            {callToast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] rounded-full bg-discord-darkest/90 border border-discord-border/60 px-4 py-2 text-sm text-discord-light shadow-lg">
                    {callToast}
                </div>
            )}

            {remoteMedia.map((item) => (
                <VoiceAudioPlayer key={item.socketId} stream={item.stream} muted={isDeafened} />
            ))}

            {screenShareTiles.length > 0 && showStreamViewer && viewMode !== 'server' && (
                <div className="fixed bottom-6 right-6 z-40 w-[320px] max-w-[90vw] rounded-2xl bg-discord-darkest/90 border border-discord-border/60 shadow-2xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-discord-faint">Screen Share</p>
                            {activeScreenShareTile && (
                                <p className="text-[11px] text-discord-muted truncate">
                                    Live now: {activeScreenShareTile.ownerName}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={() => setFullscreenStream(activeScreenShareTile?.stream || null)}
                            className="text-[11px] px-2 py-1 rounded-md bg-discord-darkest text-discord-light hover:bg-discord-border-light/40"
                        >
                            Fullscreen
                        </button>
                    </div>
                    <div className="space-y-2">
                        {screenShareTiles.map((item, idx) => (
                            <button
                                key={item.id}
                                onClick={() => setFullscreenStream(item.stream)}
                                className="w-full text-left rounded-xl border border-transparent hover:border-discord-border/80 transition-colors"
                            >
                                <div className="w-full aspect-video rounded-xl bg-black/60 overflow-hidden">
                                    <VoiceVideoPlayer
                                        stream={item.stream}
                                        muted
                                        ref={idx === 0 ? streamVideoRef : undefined}
                                        id={idx === 0 ? 'cc-screen-share-video' : undefined}
                                    />
                                </div>
                                <div className="mt-1.5 flex items-center justify-between">
                                    <p className="text-[11px] font-medium text-discord-light truncate">{item.ownerName}</p>
                                    <span className="text-[10px] uppercase tracking-[0.12em] text-discord-faint">
                                        {item.isLocal ? 'You' : 'Live'}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {fullscreenStream && showStreamFullscreen && (
                <div
                    className="fixed inset-0 z-[90] bg-black/90 flex items-center justify-center"
                    onClick={() => setFullscreenStream(null)}
                >
                    <div
                        className="w-[92vw] h-[92vh] max-w-[1400px] max-h-[880px] rounded-2xl bg-black/80 border border-discord-border/60 shadow-2xl p-3"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <VoiceVideoPlayer
                            stream={fullscreenStream}
                            muted
                            className="w-full h-full object-contain rounded-xl bg-black"
                        />
                    </div>
                </div>
            )}

            {liveReactions.length > 0 && (
                <div className="fixed right-5 top-16 z-[96] flex flex-col gap-2 pointer-events-none">
                    {liveReactions.slice(-5).map((reaction) => (
                        <div
                            key={reaction.id}
                            className="px-2.5 py-1.5 rounded-2xl bg-black/58 border border-white/10 text-white text-xs flex items-center gap-2 shadow-[0_12px_24px_rgba(0,0,0,0.4)] backdrop-blur-md"
                        >
                            <span className="w-7 h-7 rounded-xl bg-white/12 border border-white/15 flex items-center justify-center text-base leading-none">
                                {reaction.emoji}
                            </span>
                            <div className="min-w-0">
                                <p className="truncate max-w-[170px] text-[12px] font-semibold leading-tight">{reaction.displayName || 'Member'}</p>
                                <p className="text-[10px] text-white/65 leading-tight">Reacted just now</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showShareModePicker && (
                <div className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeShareModePicker}>
                    <div
                        className="w-full max-w-md rounded-2xl border border-discord-border/70 bg-discord-darker p-4 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <p className="text-base font-semibold text-discord-white">Share your screen</p>
                        <p className="text-xs text-discord-faint mt-1">Choose how you want to present in this voice call.</p>
                        <div className="mt-4 space-y-2">
                            <button
                                type="button"
                                onClick={() => startShareWithMode('screen')}
                                className="w-full rounded-xl border border-discord-border/60 bg-discord-darkest/70 px-3 py-2 text-left hover:bg-discord-border-light/25"
                            >
                                <p className="text-sm font-semibold text-discord-light">Entire Screen</p>
                                <p className="text-[11px] text-discord-faint mt-0.5">Best for slides, demos, and multi-app walkthroughs.</p>
                            </button>
                            <button
                                type="button"
                                onClick={() => startShareWithMode('window')}
                                className="w-full rounded-xl border border-discord-border/60 bg-discord-darkest/70 px-3 py-2 text-left hover:bg-discord-border-light/25"
                            >
                                <p className="text-sm font-semibold text-discord-light">Application Window</p>
                                <p className="text-[11px] text-discord-faint mt-0.5">Share one app window for cleaner, focused presenting.</p>
                            </button>
                            <button
                                type="button"
                                onClick={() => startShareWithMode('tab')}
                                className="w-full rounded-xl border border-discord-border/60 bg-discord-darkest/70 px-3 py-2 text-left hover:bg-discord-border-light/25"
                            >
                                <p className="text-sm font-semibold text-discord-light">Browser Tab (with audio)</p>
                                <p className="text-[11px] text-discord-faint mt-0.5">Ideal for videos and web demos with tab sound when supported.</p>
                            </button>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button
                                type="button"
                                onClick={closeShareModePicker}
                                className="px-3 py-1.5 rounded-lg bg-discord-darkest text-discord-light text-sm hover:bg-discord-border-light/30"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default FeedPage;
