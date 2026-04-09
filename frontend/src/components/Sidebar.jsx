import { useMemo, useState, useEffect } from 'react';
import { Hash, Plus, X, ChevronDown, Lock, Users, Settings, Volume2, Calendar, Sparkles, Megaphone, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChannelStore } from '../stores/channelStore';
import { useAuthStore } from '../stores/authStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useProfileStore } from '../stores/profileStore';
import { apiFetch } from '../stores/apiFetch';
import ChannelCreateModal from './ChannelCreateModal';
import ServerMenu from './ServerMenu';
import InviteModal from './InviteModal';
import { useFriendStore } from '../stores/friendStore';
import { useCommunityStore } from '../stores/communityStore';
import { useEventStore } from '../stores/eventStore';
import { useRosterStore } from '../stores/rosterStore';
import EventsModal from './EventsModal';
import EventCreateModal from './EventCreateModal';
import EventDetailsModal from './EventDetailsModal';
import VoiceConnectedBar from './VoiceConnectedBar';

const Sidebar = ({ isOpen, onClose, onProfileClick, onFriendsClick, onSettingsClick, onVoiceChannelClick, onOpenChannelSettings, voiceState, animateClassName = '' }) => {
    const navigate = useNavigate();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showServerMenu, setShowServerMenu] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showEventsModal, setShowEventsModal] = useState(false);
    const [showEventCreateModal, setShowEventCreateModal] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [showEventDetails, setShowEventDetails] = useState(false);
    const [activeEvent, setActiveEvent] = useState(null);
    const [dismissedLiveEventId, setDismissedLiveEventId] = useState(null);
    const [createError, setCreateError] = useState('');

    const { channels, activeChannelId, fetchChannels, createChannel, setActiveChannel, isLoading } = useChannelStore();
    const { user } = useAuthStore();
    const { profile } = useProfileStore();
    const { activeCommunityId } = useWorkspaceStore();
    const { friends, fetchFriends } = useFriendStore();
    const { friends: rosterMembers, fetchRoster } = useRosterStore();
    const { generateInvite, sendServerInvite } = useCommunityStore();
    const { events, fetchEvents, deleteEvent, startEvent, endEvent, handleStartEvent, handleEndEvent } = useEventStore();
    const activeMembership = user?.memberships?.find((m) => {
        const membershipCommunityId = typeof m.communityId === 'string' ? m.communityId : m.communityId?._id;
        return membershipCommunityId === activeCommunityId;
    });
    const [rolePermissions, setRolePermissions] = useState({});
    const canCreateChannels = ['admin', 'moderator'].includes(activeMembership?.role) || rolePermissions.createChannels || rolePermissions.manageChannels;
    const canInvite = ['admin', 'moderator'].includes(activeMembership?.role) || rolePermissions.createInvite;
    const canEditChannel = ['admin', 'moderator'].includes(activeMembership?.role) || rolePermissions.manageChannels;
    const isFreeTier = (profile?.tier || 'free') === 'free';
    const canCreateEvents = ['admin', 'moderator'].includes(activeMembership?.role) || rolePermissions.createEvents;
    const canManageSettings = ['admin', 'moderator'].includes(activeMembership?.role)
        || rolePermissions.manageRoles
        || rolePermissions.manageChannels
        || rolePermissions.createChannels
        || rolePermissions.createEvents
        || rolePermissions.createInvite
        || rolePermissions.kickMembers
        || rolePermissions.banMembers
        || rolePermissions.moderateContent
        || rolePermissions.warnMembers
        || rolePermissions.suspendMembers
        || rolePermissions.viewAuditLog;

    useEffect(() => { fetchChannels(); }, [activeCommunityId]);
    const roleIdsKey = JSON.stringify(activeMembership?.roles || []);
    useEffect(() => {
        const roleIds = activeMembership?.roles || [];
        if (!activeCommunityId || roleIds.length === 0) {
            setRolePermissions({});
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
                const roleMap = new Map((data.roles || []).map((r) => [r._id, r.permissions || {}]));
                const merged = (roleIds || []).reduce((acc, roleId) => {
                    const perms = roleMap.get(roleId);
                    if (!perms) return acc;
                    Object.keys(perms).forEach((key) => {
                        if (perms[key]) acc[key] = true;
                    });
                    return acc;
                }, {});
                if (!cancelled) setRolePermissions(merged);
            } catch {
                if (!cancelled) setRolePermissions({});
            }
        };
        fetchRoles();
        return () => { cancelled = true; };
    }, [activeCommunityId, roleIdsKey]);
    useEffect(() => { fetchFriends(); }, []);
    useEffect(() => { fetchRoster(); }, [activeCommunityId, fetchRoster]);
    useEffect(() => {
        if (!activeCommunityId) return;
        fetchEvents().catch(() => { });
    }, [activeCommunityId, fetchEvents]);

    const liveEvent = useMemo(() => {
        const list = events || [];
        const active = list.find((e) => e.status === 'live');
        if (active && dismissedLiveEventId && active._id === dismissedLiveEventId) return null;
        return active || null;
    }, [events, dismissedLiveEventId]);

    const handleCreate = async ({ name, type, isPrivate, isPremium }) => {
        setCreateError('');
        try {
            await createChannel(name, { type, isPrivate, isPremium });
            setShowCreateModal(false);
        } catch (err) {
            setCreateError(err.message);
        }
    };

    const handleChannelClick = (channel) => {
        if (channel?.isPremium && isFreeTier && !canEditChannel) {
            navigate('/upgrade');
            onClose?.();
            return;
        }
        const channelId = channel?._id ?? null;
        setActiveChannel(channelId);
        onClose?.();
    };

    const communityName = activeMembership?.communityId?.name || activeMembership?.communityId?.slug || 'Server';
    const remoteVoiceMember = useMemo(() => {
        const list = voiceState?.members || [];
        return list.find((m) => !(m?.isLocal || m?.socketId === 'local')) || null;
    }, [voiceState?.members]);

    const content = (
        <div className="flex flex-col h-full">
            {/* Server header */}
            <div className="ui-topbar flex items-center justify-between px-4 py-3 shadow-sm relative">
                <button
                    className="group ui-chip ui-chip--active flex items-center gap-2 text-sm font-semibold px-2 py-1 transition
                    active:bg-discord-darkest/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blurple/60"
                    onClick={() => setShowServerMenu((v) => !v)}
                >
                    <span className="truncate">{communityName}</span>
                    <ChevronDown
                        className={`w-4 h-4 text-discord-faint transition-transform duration-200 ${showServerMenu ? 'rotate-180' : 'rotate-0'}`}
                    />
                </button>
                <div className="flex items-center gap-1.5" />
                <ServerMenu
                    isOpen={showServerMenu}
                    onClose={() => setShowServerMenu(false)}
                    onInvite={() => { setShowServerMenu(false); setShowInviteModal(true); }}
                    onServerSettings={() => { setShowServerMenu(false); navigate('/server-settings'); }}
                    onCreateChannel={() => { setShowServerMenu(false); setShowCreateModal(true); }}
                    onCreateEvent={() => { setShowServerMenu(false); setShowEventCreateModal(true); }}
                    hideInvite={!canInvite}
                    hideEvent={!canCreateEvents}
                    hideCreateChannel={!canCreateChannels}
                    hideSettings={!canManageSettings}
                />
            </div>

            {/* Server actions */}
            {liveEvent && (
                <div className="px-3 pt-3">
                    <div className="rounded-xl border border-discord-border/50 bg-discord-darkest/80 px-4 py-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-discord-green font-semibold">
                                <span className="w-2.5 h-2.5 rounded-full bg-discord-green" />
                                Happening Now
                            </div>
                            <button
                                onClick={() => {
                                    if (liveEvent?._id) setDismissedLiveEventId(liveEvent._id);
                                }}
                                className="text-discord-faint hover:text-discord-light"
                                title="Dismiss"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div>
                            <h4 className="text-lg font-semibold text-discord-white">{liveEvent.title}</h4>
                            <div className="mt-1 flex items-center gap-2 text-sm text-discord-faint">
                                <MapPin className="w-4 h-4" />
                                <span>{liveEvent.location || 'Somewhere else'}</span>
                            </div>
                        </div>
                        <button
                            onClick={() => { setActiveEvent(liveEvent); setShowEventDetails(true); }}
                            className="w-full px-3 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition"
                        >
                            Event Details
                        </button>
                    </div>
                </div>
            )}
            <div className="ui-topbar px-3 py-3 space-y-1 text-sm text-discord-muted">
                <button
                    onClick={() => setShowEventsModal(true)}
                    className="ui-chip w-full flex items-center gap-2 px-2 py-1.5 cursor-pointer"
                >
                    <Calendar className="w-4 h-4" />
                    Events
                </button>
                <button
                    onClick={() => navigate('/upgrade')}
                    className="ui-chip w-full flex items-center gap-2 px-2 py-1.5 cursor-pointer"
                >
                    <Sparkles className="w-4 h-4" />
                    CircleCore Plus
                </button>
            </div>

            <ChannelCreateModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreate={handleCreate}
                isLoading={isLoading}
            />
            <InviteModal
                isOpen={showInviteModal}
                onClose={() => setShowInviteModal(false)}
                communityName={communityName}
                friends={friends}
                onGenerateInvite={(email) => {
                    if (!activeCommunityId) throw new Error('No active server');
                    return generateInvite(activeCommunityId, email);
                }}
                onSendInvite={(userId) => {
                    if (!activeCommunityId) throw new Error('No active server');
                    return sendServerInvite(activeCommunityId, userId);
                }}
            />
            <EventsModal
                isOpen={showEventsModal}
                onClose={() => setShowEventsModal(false)}
                onCreate={() => { setShowEventsModal(false); setShowEventCreateModal(true); }}
                canCreate={canCreateEvents}
                onDelete={deleteEvent}
                onEdit={(event) => { setShowEventsModal(false); setShowEventCreateModal(true); setEditingEvent(event); }}
                onStart={async (event) => {
                    try {
                        const res = await startEvent(event._id);
                        if (res?.event) handleStartEvent(res.event);
                    } catch { }
                }}
                onEnd={async (event) => {
                    try {
                        const res = await endEvent(event._id);
                        if (res?.event) handleEndEvent(res.event);
                    } catch { }
                }}
            />
            <EventCreateModal
                isOpen={showEventCreateModal}
                onClose={() => { setShowEventCreateModal(false); setEditingEvent(null); }}
                initialEvent={editingEvent}
            />
            <EventDetailsModal
                isOpen={showEventDetails}
                event={activeEvent || liveEvent}
                onClose={() => setShowEventDetails(false)}
                onEnd={async () => {
                    const target = activeEvent || liveEvent;
                    if (!target?._id) return;
                    try {
                        const res = await endEvent(target._id);
                        if (res?.event) handleEndEvent(res.event);
                        setShowEventDetails(false);
                    } catch { }
                }}
                canEnd={(() => {
                    const target = activeEvent || liveEvent;
                    if (!target || !user?._id) return false;
                    const isCreator = target.creator?._id === user._id || target.creatorId === user._id;
                    const isAdmin = activeMembership?.role === 'admin';
                    const isModerator = activeMembership?.role === 'moderator';
                    return isCreator || isAdmin || isModerator;
                })()}
                rosterMembers={rosterMembers}
                communityName={communityName}
            />
            {createError && <div className="px-4 py-2 text-xs text-discord-red">{createError}</div>}

            {/* Channel list */}
            <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
                <div>
                    <div className="flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-discord-faint">
                        <div className="flex items-center gap-1">
                            <ChevronDown className="w-3 h-3" />
                            Text Channels
                        </div>
                        {canCreateChannels && (
                            <button onClick={() => setShowCreateModal(true)}
                                className="w-6 h-6 rounded-md hover:bg-discord-border-light/30 flex items-center justify-center transition-colors cursor-pointer"
                                title="Create channel">
                                <Plus className="w-3.5 h-3.5 text-discord-muted" strokeWidth={2} />
                            </button>
                        )}
                    </div>

                    <div className="mt-1 space-y-0.5">
                        {/* Channel items */}
                {channels.filter((ch) => ['text', 'announcement', 'forum'].includes(ch.type || 'text')).map((ch) => {
                    const isActive = activeChannelId === ch._id;
                    const isAnnouncement = ch.type === 'announcement';
                    return (
                        <button key={ch._id} onClick={() => handleChannelClick(ch)}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left transition-all duration-150 cursor-pointer group
                                ${isActive
                                    ? 'bg-discord-border-light/30 text-discord-white'
                                    : 'text-discord-muted hover:bg-discord-border-light/15 hover:text-discord-light'
                                }`}
                            title={ch.description || ch.name}>
                            {ch.isPremium || ch.isPrivate ? (
                                <Lock className="w-4 h-4 shrink-0" strokeWidth={2} />
                            ) : isAnnouncement ? (
                                <Megaphone className="w-4 h-4 shrink-0" strokeWidth={2} />
                            ) : (
                                <Hash className="w-4 h-4 shrink-0" strokeWidth={2} />
                            )}
                            <span className="text-sm font-medium truncate">{ch.name}</span>
                            {ch.isPremium && (
                                <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-200 border border-amber-500/25">
                                    Premium
                                </span>
                            )}
                            {isActive && canEditChannel && (
                                <div className="ml-auto flex items-center gap-1">
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenChannelSettings?.(ch);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onOpenChannelSettings?.(ch);
                                            }
                                        }}
                                        className="w-6 h-6 rounded-md hover:bg-discord-border-light/30 flex items-center justify-center transition-colors cursor-pointer"
                                        title="Edit channel"
                                    >
                                        <Settings className="w-3.5 h-3.5 text-discord-faint" />
                                    </span>
                                </div>
                            )}
                        </button>
                    );
                })}
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-discord-faint">
                        <div className="flex items-center gap-1">
                            <ChevronDown className="w-3 h-3" />
                            Voice Channels
                        </div>
                        {canCreateChannels && (
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="w-6 h-6 rounded-md hover:bg-discord-border-light/30 flex items-center justify-center transition-colors cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5 text-discord-muted" strokeWidth={2} />
                            </button>
                        )}
                    </div>
                    <div className="mt-1 space-y-0.5">
                        {(channels.filter((ch) => ch.type === 'voice').map((ch) => ch.name)).length > 0
                            ? channels.filter((ch) => ch.type === 'voice').map((ch) => {
                                const isActive = voiceState?.activeChannelId === ch._id;
                                const presenceMembers = voiceState?.voicePresence?.[ch._id] || [];
                                const allMembers = isActive ? (voiceState?.members || []) : presenceMembers;
                                const connectedIds = isActive ? (voiceState?.connectedPeerIds || []) : [];
                                const dedupedMembers = allMembers.reduce((acc, member) => {
                                    if (!member) return acc;
                                    const key = member.userId || member.socketId;
                                    if (!key) return acc;
                                    const current = acc.get(key);
                                    const memberConnected = !!member.isLocal || connectedIds.includes(member.socketId);
                                    const currentConnected = current ? (!!current.isLocal || connectedIds.includes(current.socketId)) : false;
                                    if (!current || (!currentConnected && memberConnected)) {
                                        acc.set(key, member);
                                    }
                                    return acc;
                                }, new Map());
                                const normalizedMembers = Array.from(dedupedMembers.values());
                                const nonLocalMembers = normalizedMembers.filter((m) => !(m?.isLocal || m?.socketId === 'local'));
                                const members = isActive && nonLocalMembers.length === 0 ? [] : normalizedMembers;
                                return (
                                    <div key={ch._id}>
                                        <button
                                            onClick={() => onVoiceChannelClick?.(ch)}
                                            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left transition-colors cursor-pointer ${
                                                isActive
                                                    ? 'bg-discord-border-light/25 text-discord-white'
                                                    : 'text-discord-muted hover:bg-discord-border-light/15 hover:text-discord-light'
                                            }`}
                                        >
                                            <Volume2 className="w-4 h-4 shrink-0" strokeWidth={2} />
                                            <span className="text-sm font-medium truncate">{ch.name}</span>
                                            {(isActive || members.length > 0) && (
                                                <div className="ml-auto flex items-center gap-2">
                                                    {members.length > 0 && (
                                                        <span className="text-[11px] text-discord-faint font-semibold">
                                                            {members.length}
                                                        </span>
                                                    )}
                                                    {isActive && (
                                                        <span className="text-xs text-discord-green font-semibold">
                                                            {voiceState?.elapsedLabel || '0:00'}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </button>
                                        {members.length > 0 && (
                                            <div className="mt-1 ml-7 space-y-1">
                                                {members.map((m) => (
                                                    <div key={m.userId || m.socketId} className="flex items-center gap-2 text-xs text-discord-light">
                                                        <div className="relative w-6 h-6 rounded-full bg-discord-darkest flex items-center justify-center text-[10px] font-semibold">
                                                            {m.avatar ? (
                                                                <img src={m.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                                                            ) : (
                                                                (m.displayName || 'U').charAt(0).toUpperCase()
                                                            )}
                                                            <span
                                                                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-discord-sidebar ${
                                                                    isActive
                                                                        ? (m.isLocal || connectedIds.includes(m.socketId) ? 'bg-discord-green' : 'bg-discord-faint/60')
                                                                        : 'bg-discord-green'
                                                                }`}
                                                                title={
                                                                    isActive
                                                                        ? (m.isLocal || connectedIds.includes(m.socketId) ? 'Connected' : 'Connecting')
                                                                        : 'In voice'
                                                                }
                                                            />
                                                        </div>
                                                        <span className="truncate text-discord-light">{m.displayName}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                            : ['Lobby', 'Gaming'].map((v) => (
                                <button key={v} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left text-discord-muted hover:bg-discord-border-light/15 hover:text-discord-light cursor-pointer">
                                    <Volume2 className="w-4 h-4 shrink-0" strokeWidth={2} />
                                    <span className="text-sm font-medium truncate">{v}</span>
                                </button>
                            ))}
                    </div>
                </div>
            </nav>

            {/* User bar */}
            {voiceState?.isConnected && (
                <VoiceConnectedBar
                    channelName={voiceState?.activeChannelName || 'Voice'}
                    elapsed={voiceState?.elapsed || 0}
                    isMuted={voiceState?.isMuted}
                    isDeafened={voiceState?.isDeafened}
                    isSharing={voiceState?.isSharing}
                    noiseReduction={voiceState?.noiseReduction}
                    hasRemoteStream={voiceState?.hasRemoteStream}
                    memberCount={voiceState?.memberCount || 0}
                    connectedCount={(voiceState?.connectedPeerIds || []).length}
                    onToggleViewer={voiceState?.onToggleViewer}
                    onToggleMute={voiceState?.onToggleMute}
                    onToggleDeafen={voiceState?.onToggleDeafen}
                    onToggleNoiseReduction={voiceState?.onToggleNoiseReduction}
                    onToggleShare={voiceState?.onToggleShare}
                    onOpenCallView={voiceState?.onOpenCallView}
                    onLeave={voiceState?.onLeave}
                    onProfileClick={onProfileClick}
                    onSettingsClick={onSettingsClick}
                    displayName={remoteVoiceMember?.displayName || ''}
                    avatar={remoteVoiceMember?.avatar || ''}
                />
            )}
            {!voiceState?.isConnected && (
            <div className="h-14 px-3 border-t border-discord-darkest/60 flex items-center gap-2 bg-discord-darkest/80 cursor-pointer" onClick={onProfileClick}>
                <div className="relative">
                    {profile?.avatar ? (
                        <img src={profile.avatar} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-discord-border" />
                    ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blurple to-indigo-600 flex items-center justify-center text-xs font-bold">
                            {(profile?.displayName || user?.name || 'U').charAt(0).toUpperCase()}
                        </div>
                    )}
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-discord-darkest ${
                        profile?.presence === 'dnd' ? 'bg-red-500' : profile?.presence === 'idle' ? 'bg-yellow-400' : profile?.presence === 'offline' ? 'bg-discord-faint/60' : 'bg-discord-green'
                    }`} />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-semibold leading-tight truncate text-discord-white">{profile?.displayName || user?.name || 'User'}</p>
                    <p className="text-[11px] text-discord-faint truncate">{profile?.bio || 'No bio yet'}</p>
                </div>
                <div className="ml-auto flex items-center gap-1">
                    <button
                        onClick={(event) => {
                            event.stopPropagation();
                            onSettingsClick?.();
                        }}
                        className="w-7 h-7 rounded-md bg-discord-darkest flex items-center justify-center hover:bg-discord-border-light/40 cursor-pointer"
                        title="Settings"
                    >
                        <Settings className="w-3.5 h-3.5 text-discord-muted" />
                    </button>
                </div>
            </div>
            )}
        </div>
    );

    return (
        <>
            {/* Desktop sidebar */}
            <aside className={`hidden md:flex relative z-20 w-60 shrink-0 bg-discord-sidebar border-r border-discord-darkest/60 flex-col overflow-visible ${animateClassName}`}>
                {content}
            </aside>

            {/* Mobile overlay */}
            {isOpen && (
                <>
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden" onClick={onClose} />
                    <aside className={`fixed top-0 left-0 bottom-0 w-72 bg-discord-sidebar z-50 shadow-2xl animate-slide-right md:hidden overflow-visible ${animateClassName}`}>
                        {content}
                    </aside>
                </>
            )}
        </>
    );
};

export default Sidebar;
