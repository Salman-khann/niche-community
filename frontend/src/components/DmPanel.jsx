import { useEffect, useMemo, useRef, useState } from 'react';
import { Phone, Smile, Send, Plus, Image as ImageIcon, X, Menu, Server, Mic, MicOff, ScreenShare, Video, VideoOff, UserPlus, LogOut, MoreHorizontal, Reply, Forward, Copy, Link2, ChevronRight, Bell, Volume2 } from 'lucide-react';
import VoiceVideoPlayer from './VoiceVideoPlayer';
import EmojiPicker from './EmojiPicker';
import AttachmentPreviewCard from './AttachmentPreviewCard';
import EmojiArt from './EmojiArt';
import { CHAT_REACTION_EMOJIS } from '../utils/emojiShortcodes';

const formatTime = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString();
};


const DmPanel = ({
    activeDm,
    messages,
    typing,
    typingName,
    onSend,
    onTyping,
    value,
    onChange,
    files,
    onAddFiles,
    onRemoveFile,
    sending,
    onOpenSidebar,
    onOpenServers,
    onCall,
    onJoinCall,
    onJoinWithVideo,
    onOpenInvite,
    onAddToGroup,
    onLeaveGroup,
    canAddToGroup = false,
    callDisabled,
    activeCall,
    selfProfile,
    onToggleMute,
    onToggleCamera,
    onToggleShare,
    onSendReaction,
    onEndCall,
    isMuted,
    isSharing,
    isCameraOn,
    screenShareStream,
    screenShareStreams = [],
    localCameraStream,
    remoteCameraStream,
    remoteCameraStreams = [],
    participants = [],
    screenShareOwnerName,
    isRemoteScreenShare = false,
    onOpenStreamFullscreen,
    callStatus,
}) => {
    const headerTitle = activeDm?.displayName || 'Direct Messages';
    const username = activeDm?.subtitle || activeDm?.username || '';
    const [showEmoji, setShowEmoji] = useState(false);
    const [hoveredMessageId, setHoveredMessageId] = useState(null);
    const [openMessageMenuId, setOpenMessageMenuId] = useState(null);
    const [reactionPickerMessageId, setReactionPickerMessageId] = useState(null);
    const [copiedMessageId, setCopiedMessageId] = useState(null);
    const dmMenuRef = useRef(null);
    const sendLockRef = useRef(false);
    const hasLocalCamera = !!localCameraStream;
    const hasRemoteCamera = !!remoteCameraStream;
    const cameraStreamMap = useMemo(() => {
        const map = new Map();
        remoteCameraStreams.forEach((item) => {
            if (item?.socketId) map.set(item.socketId, item.stream);
        });
        return map;
    }, [remoteCameraStreams]);
    const fallbackParticipants = useMemo(() => {
        const list = [];
        list.push({
            socketId: 'local',
            displayName: selfProfile?.displayName || 'You',
            avatar: selfProfile?.avatar || '',
            isLocal: true,
        });
        if (activeDm && !activeDm.isGroup) {
            list.push({
                socketId: activeDm._id || 'remote',
                displayName: activeDm.displayName || headerTitle,
                avatar: activeDm.avatar || '',
                isLocal: false,
            });
        }
        return list;
    }, [activeDm, headerTitle, selfProfile?.avatar, selfProfile?.displayName]);
    const participantTiles = useMemo(() => {
        const base = participants.length > 0 ? participants : fallbackParticipants;
        return base.map((p) => {
            const isLocal = !!p.isLocal;
            const stream = isLocal ? localCameraStream : cameraStreamMap.get(p.socketId);
            return {
                id: p.socketId || p.userId || p._id,
                isLocal,
                displayName: p.displayName || 'Member',
                avatar: p.avatar || '',
                stream,
                isMuted: isLocal ? isMuted : !!p.isMuted,
            };
        });
    }, [participants, fallbackParticipants, localCameraStream, cameraStreamMap, isMuted]);
    const shareTiles = useMemo(() => {
        if (Array.isArray(screenShareStreams) && screenShareStreams.length > 0) {
            return screenShareStreams;
        }
        if (screenShareStream) {
            return [{
                id: 'screen-share',
                stream: screenShareStream,
                ownerName: isRemoteScreenShare ? 'Screen Share' : 'Your Screen',
                isLocal: !isRemoteScreenShare,
            }];
        }
        return [];
    }, [screenShareStreams, screenShareStream, isRemoteScreenShare]);
    const callRoster = useMemo(() => (
        participantTiles.map((p) => ({
            id: p.id,
            displayName: p.displayName || 'Member',
            avatar: p.avatar || '',
            isMuted: !!p.isMuted,
            isLocal: !!p.isLocal,
        }))
    ), [participantTiles]);
    const showCallRoster = callRoster.length >= 3;
    const participantGridClass = participantTiles.length <= 2
        ? 'grid-cols-2'
        : participantTiles.length === 3
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    const shareGridClass = shareTiles.length <= 1
        ? 'grid-cols-1'
        : shareTiles.length === 2
            ? 'grid-cols-1 sm:grid-cols-2'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    const isCrowded = participantTiles.length > 6;
    const participantMap = useMemo(() => {
        const map = new Map();
        (activeDm?.participants || []).forEach((p) => {
            if (p?._id) map.set(p._id?.toString?.() || String(p._id), p);
        });
        return map;
    }, [activeDm?.participants]);

    const hasHistory = messages.length > 0;

    const intro = useMemo(() => ({
        title: headerTitle,
        subtitle: username,
        text: `This is the beginning of your direct message history with ${headerTitle}.`,
    }), [headerTitle, username]);

    const handleEmoji = (emoji) => {
        onChange?.(`${value || ''}${emoji}`);
        setShowEmoji(false);
        onTyping?.();
    };

    useEffect(() => {
        if (!openMessageMenuId) return;
        const onOutside = (e) => {
            if (dmMenuRef.current && !dmMenuRef.current.contains(e.target)) {
                setOpenMessageMenuId(null);
                setReactionPickerMessageId(null);
            }
        };
        document.addEventListener('mousedown', onOutside);
        return () => document.removeEventListener('mousedown', onOutside);
    }, [openMessageMenuId]);

    const handleReply = (message, senderName) => {
        const replyText = `> ${senderName}: ${message?.content || ''}\n`;
        onChange?.(`${value || ''}${replyText}`);
        onTyping?.();
        setOpenMessageMenuId(null);
    };

    const handleForward = (message, senderName) => {
        const forwardText = `Fwd from ${senderName}: ${message?.content || ''}`;
        onChange?.(`${value || ''}${forwardText}\n`);
        onTyping?.();
        setOpenMessageMenuId(null);
    };

    const copyText = async (messageId, text) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopiedMessageId(messageId);
            setTimeout(() => setCopiedMessageId((prev) => (prev === messageId ? null : prev)), 1200);
            setOpenMessageMenuId(null);
        } catch {
            // ignore clipboard failures
        }
    };

    const copyLink = async (messageId) => {
        try {
            const link = `${window.location.origin}/feed?dm=${activeDm?._id}&message=${messageId}`;
            await navigator.clipboard.writeText(link);
            setCopiedMessageId(messageId);
            setTimeout(() => setCopiedMessageId((prev) => (prev === messageId ? null : prev)), 1200);
            setOpenMessageMenuId(null);
        } catch {
            // ignore clipboard failures
        }
    };

    const speakMessage = (content) => {
        if (!content || typeof window === 'undefined' || !window.speechSynthesis) return;
        const utterance = new SpeechSynthesisUtterance(content);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        setOpenMessageMenuId(null);
    };

    const fireSend = async () => {
        if (!onSend) return;
        if (sendLockRef.current || sending) return;
        const trimmed = (value || '').trim();
        if (!trimmed && (!files || files.length === 0)) return;
        sendLockRef.current = true;
        try {
            await onSend();
        } finally {
            sendLockRef.current = false;
        }
    };

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="ui-topbar h-12 flex items-center justify-between px-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-discord-light">
                        <button
                            onClick={() => onOpenServers?.()}
                            className="ui-icon-btn md:hidden w-8 h-8 flex items-center justify-center"
                            title="Open servers"
                        >
                            <Server className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => onOpenSidebar?.()}
                            className="ui-icon-btn md:hidden w-8 h-8 flex items-center justify-center"
                            title="Open direct messages"
                        >
                            <Menu className="w-4 h-4" />
                        </button>
                        <div className="w-6 h-6 rounded-full bg-discord-darkest flex items-center justify-center text-xs font-bold">
                            {activeDm?.avatar ? (
                                <img src={activeDm.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                                headerTitle.charAt(0).toUpperCase()
                            )}
                        </div>
                        <span>{headerTitle}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {canAddToGroup && (
                            <button
                                onClick={() => onAddToGroup?.()}
                                className="ui-icon-btn w-8 h-8 flex items-center justify-center"
                                title="Add friends to group"
                            >
                                <UserPlus className="w-4 h-4" />
                            </button>
                        )}
                        {activeDm?.isGroup && (
                            <button
                                onClick={() => onLeaveGroup?.()}
                                className="ui-icon-btn w-8 h-8 flex items-center justify-center"
                                title="Leave group"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={() => (callStatus?.isActive ? onJoinCall?.() : onCall?.())}
                            disabled={callDisabled}
                            className="ui-icon-btn w-8 h-8 flex items-center justify-center disabled:opacity-50"
                            title={callStatus?.isActive ? 'Join call' : 'Call'}
                        >
                            <Phone className="w-4 h-4" />
                        </button>
                    </div>
                </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-6">
                {!activeCall && callStatus?.isActive && !callStatus?.isInCall && (
                    <div className="mb-6 flex items-center justify-center">
                        <div className="w-full max-w-[520px] rounded-3xl border border-emerald-500/25 bg-[#0f1d18] p-6 text-center shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
                            <div className="relative mx-auto h-24 w-24 rounded-full bg-discord-darkest flex items-center justify-center text-3xl font-bold text-white overflow-hidden ring-2 ring-emerald-500/40">
                                {callStatus?.members?.[0]?.avatar ? (
                                    <img src={callStatus.members[0].avatar} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    (headerTitle || 'C').charAt(0).toUpperCase()
                                )}
                            </div>
                            {Array.isArray(callStatus?.members) && callStatus.members.length > 1 && (
                                <div className="mt-3 flex items-center justify-center -space-x-2">
                                    {callStatus.members.slice(0, 4).map((m) => (
                                        <div
                                            key={m.socketId || m.userId}
                                            className="h-8 w-8 rounded-full border-2 border-[#0f1d18] bg-discord-darkest overflow-hidden flex items-center justify-center text-[10px] font-semibold text-white"
                                        >
                                            {m.avatar ? (
                                                <img src={m.avatar} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                                (m.displayName || 'M').charAt(0).toUpperCase()
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            <p className="mt-4 text-xs uppercase tracking-[0.25em] text-emerald-200/70">Call Active</p>
                            <p className="mt-2 text-lg font-semibold text-emerald-100">
                                {callStatus.participantCount} {callStatus.participantCount === 1 ? 'person' : 'people'} in call
                            </p>
                            <div className="mt-5 flex items-center justify-center gap-3">
                                <button
                                    onClick={() => onJoinCall?.()}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                                >
                                    <Phone className="h-4 w-4" />
                                    Join Call
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {activeCall && (
                    <div className="dm-call rounded-2xl border border-discord-border/60 p-6 mb-8">
                        <div className="dm-call__orbs" aria-hidden="true">
                            <span className="dm-call__orb dm-call__orb--one" />
                            <span className="dm-call__orb dm-call__orb--two" />
                            <span className="dm-call__spark dm-call__spark--one" />
                            <span className="dm-call__spark dm-call__spark--two" />
                        </div>
                        {shareTiles.length > 0 && (
                            <div className={`grid gap-3 ${shareGridClass} mb-4`}>
                                {shareTiles.map((share) => (
                                    <button
                                        key={share.id}
                                        type="button"
                                        onClick={() => onOpenStreamFullscreen?.(share.stream)}
                                        className="dm-call__tile dm-call__tile--screen relative rounded-xl border border-discord-border/60 h-[230px] md:h-[260px] overflow-hidden focus:outline-none focus:ring-2 focus:ring-blurple/70"
                                        title="Open screen share"
                                    >
                                        <VoiceVideoPlayer stream={share.stream} muted className="w-full h-full object-cover" />
                                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-red-500 text-[10px] font-semibold text-white">
                                            LIVE
                                        </span>
                                        <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/50 text-[10px] font-semibold text-white">
                                            {share.ownerName || 'Screen Share'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className={`flex ${showCallRoster ? 'flex-col lg:flex-row' : 'flex-col'} gap-4`}>
                            <div className={`flex-1 ${isCrowded ? 'max-h-[420px] overflow-y-auto pr-1' : ''}`}>
                                <div className={`dm-call__tiles grid gap-3 ${participantGridClass}`}>
                                    {participantTiles.map((tile) => (
                                        <button
                                            key={tile.id}
                                            type="button"
                                            disabled={!tile.stream}
                                            onClick={() => tile.stream && onOpenStreamFullscreen?.(tile.stream)}
                                            className={`dm-call__tile relative rounded-xl border h-[190px] flex items-center justify-center overflow-hidden focus:outline-none
                                                ${tile.isLocal ? 'border-emerald-400/40 focus:ring-2 focus:ring-emerald-300/60' : 'border-discord-border/60 focus:ring-2 focus:ring-blurple/70'}`}
                                            title={tile.stream ? `Open ${tile.isLocal ? 'your' : tile.displayName}'s camera` : tile.displayName}
                                        >
                                            {tile.stream ? (
                                                <VoiceVideoPlayer stream={tile.stream} muted={tile.isLocal} className="w-full h-full object-cover" />
                                            ) : tile.avatar ? (
                                                <img src={tile.avatar} alt="" className="dm-call__avatar w-20 h-20 rounded-full object-cover" />
                                            ) : (
                                                <div className="dm-call__avatar w-20 h-20 rounded-full bg-discord-darkest flex items-center justify-center text-2xl font-bold text-white">
                                                    {tile.displayName?.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            {tile.isMuted && (
                                                <span className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-red-500/90 flex items-center justify-center shadow-lg ring-2 ring-black/30">
                                                    <MicOff className="w-3.5 h-3.5 text-white" />
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {showCallRoster && (
                                <aside className="w-full lg:w-64 rounded-xl border border-discord-border/60 bg-discord-darkest/60 p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-discord-faint">In Call</p>
                                        <span className="text-xs text-discord-muted">{callRoster.length}</span>
                                    </div>
                                    <div className="max-h-[360px] overflow-y-auto pr-1 space-y-2">
                                        {callRoster.map((member) => (
                                            <div key={member.id} className="flex items-center gap-2.5 rounded-lg px-2 py-2 bg-discord-darkest/70">
                                                <div className="relative w-8 h-8 rounded-full bg-discord-darkest overflow-hidden flex items-center justify-center text-xs font-semibold text-white">
                                                    {member.avatar ? (
                                                        <img src={member.avatar} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        member.displayName.charAt(0).toUpperCase()
                                                    )}
                                                    {member.isLocal && (
                                                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-discord-darkest" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm text-discord-light font-semibold truncate">{member.displayName}</p>
                                                    <p className="text-[11px] text-discord-faint truncate">{member.isLocal ? 'You' : 'In call'}</p>
                                                </div>
                                                {member.isMuted && (
                                                    <span className="w-6 h-6 rounded-full bg-red-500/90 flex items-center justify-center">
                                                        <MicOff className="w-3 h-3 text-white" />
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </aside>
                            )}
                        </div>
                        <div className="dm-call__controls mt-4 flex items-center justify-center gap-3">
                            <button
                                onClick={onToggleMute}
                                className={`dm-call__btn w-11 h-11 rounded-full flex items-center justify-center ${isMuted ? 'bg-amber-500/20 text-amber-200' : 'bg-discord-darkest text-discord-light'}`}
                                title={isMuted ? 'Unmute' : 'Mute'}
                            >
                                <Mic className="w-5 h-5" />
                            </button>
                            <button
                                onClick={onToggleCamera}
                                className={`dm-call__btn w-11 h-11 rounded-full flex items-center justify-center ${isCameraOn ? 'bg-sky-500/20 text-sky-200' : 'bg-discord-darkest text-discord-light'}`}
                                title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
                            >
                                {isCameraOn ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                            </button>
                            <button
                                onClick={onToggleShare}
                                className={`dm-call__btn w-11 h-11 rounded-full flex items-center justify-center ${isSharing ? 'bg-emerald-500/20 text-emerald-200' : 'bg-discord-darkest text-discord-light'}`}
                                title={isSharing ? 'Stop streaming' : 'Share screen'}
                            >
                                <ScreenShare className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => onOpenInvite?.()}
                                className="dm-call__btn w-11 h-11 rounded-full flex items-center justify-center bg-discord-darkest text-discord-light hover:bg-discord-border-light/30"
                                title="Add people"
                            >
                                <UserPlus className="w-5 h-5" />
                            </button>
                            <button
                                onClick={onEndCall}
                                className="dm-call__btn dm-call__end w-11 h-11 rounded-full bg-red-500/90 text-white flex items-center justify-center hover:bg-red-500"
                                title="End call"
                            >
                                <Phone className="w-5 h-5" />
                            </button>
                        </div>
                        {onSendReaction && (
                            <div className="mt-3 rounded-2xl border border-discord-border/50 bg-discord-darkest/55 px-3 py-2">
                                <p className="text-[10px] uppercase tracking-[0.16em] text-discord-faint text-center mb-2">Quick Reactions</p>
                                <div className="flex items-center justify-center gap-2">
                                    {['🙋', '👍', '👏', '❤️'].map((emoji) => (
                                    <button
                                        key={`dm-call-reaction-${emoji}`}
                                        type="button"
                                        onClick={() => onSendReaction(emoji)}
                                        className="w-10 h-10 rounded-xl border border-discord-border/60 bg-gradient-to-b from-discord-border-light/45 to-discord-darkest text-white hover:from-discord-border-light/60 hover:to-discord-border-light/20 flex items-center justify-center shadow-md transition-all hover:-translate-y-0.5"
                                        title={`React ${emoji}`}
                                    >
                                        <EmojiArt emoji={emoji} className="w-5 h-5" />
                                    </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {!hasHistory && (
                    <div className="max-w-2xl">
                        <div className="w-16 h-16 rounded-full bg-discord-darkest flex items-center justify-center text-2xl text-discord-faint mb-4">
                            {activeDm?.avatar ? (
                                <img src={activeDm.avatar} alt="" className="w-16 h-16 rounded-full object-cover" />
                            ) : (
                                headerTitle.charAt(0).toUpperCase()
                            )}
                        </div>
                        <h2 className="text-2xl font-bold text-white">{intro.title}</h2>
                        <p className="text-sm text-discord-faint mt-1">{intro.subtitle}</p>
                        <p className="text-sm text-discord-muted mt-3">{intro.text}</p>
                        <div className="mt-4 text-xs text-discord-faint">
                            No servers in common
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    {messages.map((m) => {
                        const senderKey = m.senderId?.toString?.() || String(m.senderId);
                        const isMe = senderKey === (activeDm?.selfId?.toString?.() || String(activeDm?.selfId));
                        const sender = participantMap.get(senderKey);
                        const senderName = isMe ? 'You' : (sender?.displayName || headerTitle);
                        const senderAvatar = isMe
                            ? (selfProfile?.avatar || '')
                            : (sender?.avatar || activeDm?.avatar || '');
                        return (
                            <div
                                key={m._id}
                                className="group relative flex items-start gap-3"
                                onMouseEnter={() => setHoveredMessageId(m._id)}
                                onMouseLeave={() => {
                                    if (openMessageMenuId !== m._id) setHoveredMessageId((prev) => (prev === m._id ? null : prev));
                                }}
                            >
                                {(hoveredMessageId === m._id || openMessageMenuId === m._id) && (
                                    <div className="absolute -top-4 right-0 z-20 flex items-center gap-1 rounded-lg border border-[#1f2024] bg-[#2b2d31] p-1 shadow-[0_8px_20px_rgba(0,0,0,0.35)]">
                                        {CHAT_REACTION_EMOJIS.map((emoji) => (
                                            <button
                                                key={`${m._id}-${emoji}`}
                                                type="button"
                                                onClick={() => {
                                                    onChange?.(`${value || ''}${emoji}`);
                                                    onTyping?.();
                                                }}
                                                className="h-8 w-8 rounded-md bg-[#3a3c43] hover:bg-[#4a4d57] transition-colors flex items-center justify-center"
                                                title={`React ${emoji}`}
                                            >
                                                <EmojiArt emoji={emoji} className="w-[18px] h-[18px]" />
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => handleReply(m, senderName)}
                                            className="w-8 h-8 rounded-md flex items-center justify-center bg-[#3a3c43] hover:bg-[#4a4d57] text-discord-faint hover:text-discord-light"
                                            title="Reply"
                                        >
                                            <Reply className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleForward(m, senderName)}
                                            className="w-8 h-8 rounded-md flex items-center justify-center bg-[#3a3c43] hover:bg-[#4a4d57] text-discord-faint hover:text-discord-light"
                                            title="Forward"
                                        >
                                            <Forward className="w-4 h-4" />
                                        </button>
                                        <div className="relative" ref={openMessageMenuId === m._id ? dmMenuRef : null}>
                                            <button
                                                type="button"
                                                onClick={() => setOpenMessageMenuId((prev) => (prev === m._id ? null : m._id))}
                                                className="w-8 h-8 rounded-md flex items-center justify-center bg-[#3a3c43] hover:bg-[#4a4d57] text-discord-faint hover:text-discord-light"
                                                title="More"
                                            >
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>
                                            {openMessageMenuId === m._id && (
                                                <div className="absolute right-0 top-10 w-64 rounded-lg border border-[#141518] bg-[#1e1f22] shadow-2xl p-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setReactionPickerMessageId((prev) => (prev === m._id ? null : m._id));
                                                        }}
                                                        className="w-full px-3 py-2 rounded-md text-left text-sm text-discord-light hover:bg-[#32353b] flex items-center justify-between"
                                                    >
                                                        Add Reaction <ChevronRight className="w-4 h-4 text-discord-faint" />
                                                    </button>
                                                    <div className="my-1 h-px bg-[#2b2d31]" />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleReply(m, senderName)}
                                                        className="w-full px-3 py-2 rounded-md text-left text-sm text-discord-light hover:bg-[#32353b] flex items-center justify-between"
                                                    >
                                                        Reply <Reply className="w-4 h-4 text-discord-faint" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleForward(m, senderName)}
                                                        className="w-full px-3 py-2 rounded-md text-left text-sm text-discord-light hover:bg-[#32353b] flex items-center justify-between"
                                                    >
                                                        Forward <Forward className="w-4 h-4 text-discord-faint" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyText(m._id, m.content || '')}
                                                        className="w-full px-3 py-2 rounded-md text-left text-sm text-discord-light hover:bg-[#32353b] flex items-center justify-between"
                                                    >
                                                        Copy Text <Copy className="w-4 h-4 text-discord-faint" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setOpenMessageMenuId(null)}
                                                        className="w-full px-3 py-2 rounded-md text-left text-sm text-discord-light hover:bg-[#32353b] flex items-center justify-between"
                                                    >
                                                        Mark Unread <Bell className="w-4 h-4 text-discord-faint" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyLink(m._id)}
                                                        className="w-full px-3 py-2 rounded-md text-left text-sm text-discord-light hover:bg-[#32353b] flex items-center justify-between"
                                                    >
                                                        Copy Message Link <Link2 className="w-4 h-4 text-discord-faint" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => speakMessage(m.content || '')}
                                                        className="w-full px-3 py-2 rounded-md text-left text-sm text-discord-light hover:bg-[#32353b] flex items-center justify-between"
                                                    >
                                                        Speak Message <Volume2 className="w-4 h-4 text-discord-faint" />
                                                    </button>
                                                </div>
                                            )}
                                            {reactionPickerMessageId === m._id && (
                                                <EmojiPicker
                                                    onSelect={(emoji) => {
                                                        onChange?.(`${value || ''}${emoji}`);
                                                        onTyping?.();
                                                        setReactionPickerMessageId(null);
                                                        setOpenMessageMenuId(null);
                                                    }}
                                                    onClose={() => setReactionPickerMessageId(null)}
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div className="w-9 h-9 rounded-full bg-discord-darkest flex items-center justify-center text-xs font-semibold text-discord-light">
                                    {isMe ? (
                                        senderAvatar
                                            ? <img src={senderAvatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                                            : (activeDm?.selfInitial || 'U')
                                    ) : (
                                        senderAvatar
                                            ? <img src={senderAvatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                                            : (senderName || headerTitle).charAt(0).toUpperCase()
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-white">{senderName}</span>
                                        <span className="text-[11px] text-discord-faint">{formatTime(m.createdAt)}</span>
                                    </div>
                                    <p className="text-sm text-discord-light">{m.content}</p>
                                    {copiedMessageId === m._id && (
                                        <div className="mt-1 text-[11px] text-emerald-300">Copied</div>
                                    )}
                                    {m.mediaURLs?.length > 0 && (
                                        <div className="mt-2 grid grid-cols-1 gap-2 max-w-md">
                                            {m.mediaURLs.map((url) => {
                                                const isImage = url.match(/\.(png|jpe?g|gif|webp|bmp)$/i) || url.includes('image/upload');
                                                const docUrls = m.mediaURLs.filter((candidate) => !(candidate.match(/\.(png|jpe?g|gif|webp|bmp)$/i) || candidate.includes('image/upload')));
                                                const docIndex = docUrls.findIndex((candidate) => candidate === url);
                                                return (
                                                (url.match(/\.(png|jpe?g|gif|webp|bmp)$/i) || url.includes('image/upload')) ? (
                                                    <div key={url} className="rounded-lg border border-discord-border/40 overflow-hidden bg-discord-darkest">
                                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <AttachmentPreviewCard key={url} url={url} allUrls={docUrls} initialIndex={Math.max(0, docIndex)} />
                                                )
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {typing && (
                        <div className="text-xs text-discord-faint">{typingName ? `${typingName} is typing…` : 'Typing…'}</div>
                    )}
                </div>
            </div>

            <div className="px-4 pb-4">
                {files?.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                        {files.map((f) => (
                            <div key={f.id} className="relative w-20 h-20 rounded-lg border border-discord-border/40 bg-discord-darkest overflow-hidden">
                                {f.preview ? (
                                    <img src={f.preview} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-xs text-discord-faint">
                                        <ImageIcon className="w-4 h-4 mb-1" />
                                        <span className="px-2 text-center truncate">{f.file.name}</span>
                                    </div>
                                )}
                                <button
                                    onClick={() => onRemoveFile?.(f.id)}
                                    className="ui-icon-btn absolute top-1 right-1 w-5 h-5 flex items-center justify-center"
                                >
                                    <X className="w-3 h-3 text-discord-light" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="relative flex items-center gap-2 ui-search-input rounded-xl px-3 py-2">
                    <label className="w-8 h-8 rounded-md hover:bg-discord-border-light/20 flex items-center justify-center cursor-pointer">
                        <Plus className="w-4 h-4 text-discord-faint" />
                        <input
                            type="file"
                            multiple
                            accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx"
                            className="hidden"
                            onChange={(e) => {
                                onAddFiles?.(e.target.files);
                                e.target.value = '';
                            }}
                        />
                    </label>
                    <input
                        value={value}
                        onChange={(e) => { onChange(e.target.value); onTyping?.(); }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                if (e.nativeEvent?.isComposing) return;
                                e.preventDefault();
                                fireSend();
                            }
                        }}
                        placeholder={`Message @${headerTitle}`}
                        className="flex-1 bg-transparent text-sm text-discord-white placeholder:text-discord-faint/60 outline-none"
                    />
                    <div className="flex items-center gap-1.5 text-discord-faint">
                        <button
                            onClick={() => setShowEmoji((s) => !s)}
                            className="w-8 h-8 rounded-md hover:bg-discord-border-light/20 flex items-center justify-center cursor-pointer"
                        >
                            <Smile className="w-4 h-4" />
                        </button>
                        <Send
                            className={`w-4 h-4 cursor-pointer ${sending ? 'opacity-50' : ''}`}
                            onClick={() => fireSend()}
                        />
                    </div>

                    {showEmoji && (
                        <EmojiPicker
                            onSelect={handleEmoji}
                            onClose={() => setShowEmoji(false)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default DmPanel;
