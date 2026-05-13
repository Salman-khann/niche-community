import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Image as ImageIcon, Save, Shield, Trash2, MoreVertical, Pencil, Check, Users, Sparkles, Smile, Tag, Activity, Zap, Volume2, Lock, ShieldAlert, ClipboardList, Hammer, Globe, UserPlus, TrendingUp, Layout, Mail, ChevronDown, BarChart2, Info, Compass } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useCommunityStore } from '../stores/communityStore';
import { useMemberStore } from '../stores/memberStore';
import { useInviteRequestStore } from '../stores/inviteRequestStore';
import useSocket from '../hooks/useSocket';
import { useAuthStore } from '../stores/authStore';
import { useFeedStore } from '../stores/feedStore';
import { useChannelStore } from '../stores/channelStore';
import { apiUrl } from '../config/urls';

const bannerOptions = [
    { value: 'linear-gradient(135deg, #111827, #1f2937)', label: 'Slate' },
    { value: 'linear-gradient(135deg, #ec4899, #f97316)', label: 'Sunset' },
    { value: 'linear-gradient(135deg, #ef4444, #f97316)', label: 'Fire' },
    { value: 'linear-gradient(135deg, #f97316, #facc15)', label: 'Amber' },
    { value: 'linear-gradient(135deg, #fde047, #f59e0b)', label: 'Gold' },
    { value: 'linear-gradient(135deg, #7c3aed, #a855f7)', label: 'Violet' },
    { value: 'linear-gradient(135deg, #0ea5e9, #22d3ee)', label: 'Ocean' },
    { value: 'linear-gradient(135deg, #2dd4bf, #0ea5e9)', label: 'Teal' },
    { value: 'linear-gradient(135deg, #16a34a, #84cc16)', label: 'Forest' },
    { value: 'linear-gradient(135deg, #1f2937, #0f172a)', label: 'Midnight' },
];

const rolePermissionOptions = [
    {
        key: 'viewChannels',
        label: 'View Channels',
        description: 'Allows members to view channels by default (excluding private channels).',
    },
    {
        key: 'createChannels',
        label: 'Create Channels',
        description: 'Allows members to create new channels.',
    },
    {
        key: 'manageChannels',
        label: 'Manage Channels',
        description: 'Allows members to create, edit, or delete channels.',
    },
    {
        key: 'manageRoles',
        label: 'Manage Roles',
        description: 'Allows members to create new roles and edit or delete roles lower than their highest role.',
    },
    {
        key: 'createEvents',
        label: 'Create Events',
        description: 'Allows members to create new events.',
    },
    {
        key: 'createInvite',
        label: 'Create Invite',
        description: 'Allows members to invite new people to this server.',
    },
    {
        key: 'kickMembers',
        label: 'Kick Members',
        description: 'Allows members to remove other members from this server.',
    },
    {
        key: 'banMembers',
        label: 'Ban Members',
        description: 'Allows members to permanently ban other members from this server.',
    },
    {
        key: 'manageMessages',
        label: 'Manage Messages',
        description: 'Allows members to delete messages by other members or pin any message.',
    },
    {
        key: 'moderateContent',
        label: 'Moderate Content',
        description: 'Review and resolve reported posts in the moderation queue.',
    },
    {
        key: 'warnMembers',
        label: 'Member Warnings',
        description: 'Issue warnings to members for rule violations.',
    },
    {
        key: 'suspendMembers',
        label: 'Temporary Suspensions',
        description: 'Temporarily suspend members from the server.',
    },
    {
        key: 'viewAuditLog',
        label: 'Audit Logs',
        description: 'View moderation actions and audit trails.',
    },
    {
        key: 'editServerProfile',
        label: 'Edit Server Profile',
        description: 'Allows members to update the server profile details.',
    },
];

const moderationItems = [
    {
        title: 'Content flags',
        description: 'Members can report content for review.',
    },
    {
        title: 'Moderator review queue',
        description: 'Review flagged posts in a centralized queue.',
    },
    {
        title: 'Member warnings',
        description: 'Warn members for violations.',
    },
    {
        title: 'Temporary suspensions',
        description: 'Suspend members for a set duration.',
    },
    {
        title: 'Blocklists',
        description: 'Auto-flag messages that contain blocked words or links.',
    },
    {
        title: 'Audit trails',
        description: 'Track all moderation actions.',
    },
    {
        title: 'Moderator actions',
        description: 'See who took which action and when.',
    },
];

const formatAuditLog = (log) => {
    const moderator = log?.moderatorId?.name || 'Moderator';
    const target = log?.targetUserId?.name || 'member';
    const reason = log?.reason ? ` for ${log.reason}` : '';
    switch (log?.actionType) {
        case 'warn':
            return `${moderator} warned ${target}${reason}`;
        case 'suspend':
            return `${moderator} suspended ${target}${log?.metadata?.duration ? ` for ${log.metadata.duration}` : ''}${reason}`;
        case 'ban':
            return `${moderator} banned ${target}${reason}`;
        case 'kick':
            return `${moderator} kicked ${target}${reason}`;
        case 'delete_post':
            return `${moderator} deleted a post by ${target}${reason}`;
        case 'delete_message':
            return `${moderator} deleted a message by ${target}${reason}`;
        case 'blocklist_add':
            return `${moderator} added "${log?.metadata?.value || 'item'}" to the blocklist${reason}`;
        case 'blocklist_remove':
            return `${moderator} removed "${log?.metadata?.value || 'item'}" from the blocklist${reason}`;
        case 'dismiss':
            return `${moderator} dismissed a report${reason}`;
        case 'channel_create':
            return `${moderator} created channel #${log?.metadata?.channelName || 'unknown'}`;
        case 'channel_update':
            return `${moderator} updated channel #${log?.metadata?.channelName || 'unknown'}`;
        case 'channel_delete':
            return `${moderator} deleted channel #${log?.metadata?.channelName || 'unknown'}`;
        case 'category_create':
            return `${moderator} created category "${log?.metadata?.categoryName || 'unknown'}"`;
        case 'category_update':
            return `${moderator} updated category "${log?.metadata?.categoryName || 'unknown'}"`;
        case 'category_delete':
            return `${moderator} deleted category "${log?.metadata?.categoryName || 'unknown'}"`;
        case 'role_create':
            return `${moderator} created role "${log?.metadata?.roleName || 'unknown'}"`;
        case 'role_update':
            return `${moderator} updated role "${log?.metadata?.roleName || 'unknown'}"`;
        case 'role_delete':
            return `${moderator} deleted role "${log?.metadata?.roleName || 'ID ' + (log?.metadata?.roleId || 'unknown')}"`;
        case 'community_update':
            const changes = log?.metadata?.changes ? Object.keys(log.metadata.changes).filter(k => log.metadata.changes[k] !== undefined).join(', ') : '';
            return `${moderator} updated server profile${changes ? ` (${changes})` : ''}`;
        default:
            return `${moderator} performed ${log?.actionType || 'an action'}${reason}`;
    }
};

const ServerSettingsPage = () => {
    const navigate = useNavigate();
    const { activeCommunityId, clearWorkspace, initFromMemberships } = useWorkspaceStore();
    const { user, setUser } = useAuthStore();
    const { uploadFile } = useFeedStore();
    const { communityProfile, fetchCommunityProfile, updateCommunityProfile, deleteCommunity, reorderRoles, isLoading, error: communityError, successMessage: communitySuccess, clearSuccess, clearError } = useCommunityStore();
    const { members, fetchMembers, isLoading: isMembersLoading, error: membersError, clearError: clearMembersError, kickMember, removeMember, updateRoles, updateRole, unbanMember, banMember } = useMemberStore();
    const { requests: inviteRequests, fetchRequests: fetchInviteRequests, approveRequest, rejectRequest, isLoading: isInviteRequestsLoading, error: inviteRequestsError, clearError: clearInviteRequestsError } = useInviteRequestStore();
    const [successMessage, setSuccessMessage] = useState('');
    const [error, setError] = useState('');
    const [notifications, setNotifications] = useState({ requests: 0 });
    const fileRef = useRef(null);
    const [name, setName] = useState('');
    const [icon, setIcon] = useState('');
    const [bannerColor, setBannerColor] = useState('');
    const [traits, setTraits] = useState([]);
    const [traitInput, setTraitInput] = useState('');
    const [description, setDescription] = useState('');
    const [inviteRequestsEnabled, setInviteRequestsEnabled] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteName, setDeleteName] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [activeSettingsTab, setActiveSettingsTab] = useState('profile');
    const [moderationSection, setModerationSection] = useState('reports');
    const [memberQuery, setMemberQuery] = useState('');
    const [openMemberMenuId, setOpenMemberMenuId] = useState(null);
    const [pendingKickMember, setPendingKickMember] = useState(null);
    const [isKicking, setIsKicking] = useState(false);
    const [roles, setRoles] = useState([]);
    const [roleQuery, setRoleQuery] = useState('');
    const [isRolesLoading, setIsRolesLoading] = useState(false);
    const [openRoleMenuId, setOpenRoleMenuId] = useState(null);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [roleTab, setRoleTab] = useState('display');
    const [roleName, setRoleName] = useState('');
    const [permissionQuery, setPermissionQuery] = useState('');
    const [rolePerms, setRolePerms] = useState({
        viewChannels: false,
        createChannels: false,
        manageChannels: false,
        manageRoles: false,
        createEvents: false,
        createInvite: false,
        kickMembers: false,
        banMembers: false,
        moderateContent: false,
        manageMessages: false,
        warnMembers: false,
        suspendMembers: false,
        viewAuditLog: false,
        editServerProfile: false,
    });
    const [roleColor, setRoleColor] = useState('#99aab5');
    const [roleHoist, setRoleHoist] = useState(false);
    const [roleMentionable, setRoleMentionable] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignMember, setAssignMember] = useState(null);
    const [assignRoleIds, setAssignRoleIds] = useState([]);
    const [moderationQueue, setModerationQueue] = useState([]);
    const [isModerationLoading, setIsModerationLoading] = useState(false);
    const [moderationError, setModerationError] = useState('');
    const [auditLogs, setAuditLogs] = useState([]);
    const [isLogsLoading, setIsLogsLoading] = useState(false);
    const [logsError, setLogsError] = useState('');
    const [auditFilterUser, setAuditFilterUser] = useState('All Users');
    const [auditFilterAction, setAuditFilterAction] = useState('All Actions');
    const [actionModal, setActionModal] = useState(null);
    const [actionReason, setActionReason] = useState('');
    const [actionDuration, setActionDuration] = useState('24h');
    const [isActionBusy, setIsActionBusy] = useState(false);
    const [blocklistValue, setBlocklistValue] = useState('');
    const [blocklistEntries, setBlocklistEntries] = useState([]);
    const [blocklistInput, setBlocklistInput] = useState('');
    const [blocklistQuery, setBlocklistQuery] = useState('');
    const [isBlocklistLoading, setIsBlocklistLoading] = useState(false);
    const [blocklistError, setBlocklistError] = useState('');
    const [isBlocklistSaving, setIsBlocklistSaving] = useState(false);
    const [blocklistBusyValue, setBlocklistBusyValue] = useState('');
    const [bannedUsers, setBannedUsers] = useState([]);
    const [isBansLoading, setIsBansLoading] = useState(false);
    const { getBannedUsers } = useCommunityStore();
    const { channels, fetchChannels } = useChannelStore();

    // Engagement Settings
    const [welcomeEnabled, setWelcomeEnabled] = useState(true);
    const [welcomePromptEnabled, setWelcomePromptEnabled] = useState(true);
    const [boostEnabled, setBoostEnabled] = useState(true);
    const [tipsEnabled, setTipsEnabled] = useState(true);
    const [systemChannelId, setSystemChannelId] = useState('');
    const [displayActivityFeed, setDisplayActivityFeed] = useState(true);
    const [notificationType, setNotificationType] = useState('mentions');
    const [afkChannelId, setAfkChannelId] = useState('');
    const [afkTimeout, setAfkTimeout] = useState(300);
    const [emojis, setEmojis] = useState([]);
    const [isEmojiUploading, setIsEmojiUploading] = useState(false);
    const [editingEmojiId, setEditingEmojiId] = useState(null);
    const [newEmojiName, setNewEmojiName] = useState('');
    const [joinMethod, setJoinMethod] = useState('invite');
    const [isAgeRestricted, setIsAgeRestricted] = useState(false);
    const [rulesEnabled, setRulesEnabled] = useState(false);
    const [rulesList, setRulesList] = useState([]);
    const [newRule, setNewRule] = useState('');
    const [verificationLevel, setVerificationLevel] = useState('none');
    const [explicitContentFilter, setExplicitContentFilter] = useState('members_without_roles');
    const [twoFactorModeration, setTwoFactorModeration] = useState(false);
    const [communityEnabled, setCommunityEnabled] = useState(true);
    const [rulesChannelId, setRulesChannelId] = useState('');
    const [updatesChannelId, setUpdatesChannelId] = useState('');
    const [safetyChannelId, setSafetyChannelId] = useState('');
    const [primaryLanguage, setPrimaryLanguage] = useState('English');
    const [serverDescription, setServerDescription] = useState('');
    const [onboardingEnabled, setOnboardingEnabled] = useState(false);
    const [onboardingSteps, setOnboardingSteps] = useState([]);
    const [memberTags, setMemberTags] = useState([]);
    const traitsInitRef = useRef(false);
    const API_BASE = apiUrl('/api/communities');

    const membership = user?.memberships?.find((m) => {
        const id = m.communityId?._id || m.communityId;
        return id?.toString?.() === activeCommunityId;
    });
    const currentRolePermissions = useMemo(() => {
        const roleIds = membership?.roles || [];
        if (!roleIds.length) return {};
        const map = new Map((roles || []).map((r) => [r._id?.toString?.() || String(r._id), r.permissions || {}]));
        return roleIds.reduce((acc, roleId) => {
            const perms = map.get(roleId?.toString?.() || String(roleId));
            if (!perms) return acc;
            Object.keys(perms).forEach((key) => {
                if (perms[key]) acc[key] = true;
            });
            return acc;
        }, {});
    }, [membership?.roles, roles]);
    const canManage = ['admin', 'moderator'].includes(membership?.role)
        || currentRolePermissions.manageRoles
        || currentRolePermissions.manageChannels
        || currentRolePermissions.createChannels
        || currentRolePermissions.createEvents
        || currentRolePermissions.createInvite
        || currentRolePermissions.kickMembers
        || currentRolePermissions.banMembers
        || currentRolePermissions.moderateContent
        || currentRolePermissions.warnMembers
        || currentRolePermissions.suspendMembers
        || currentRolePermissions.viewAuditLog;
    const canEditServerProfile = ['admin', 'moderator'].includes(membership?.role) || currentRolePermissions.editServerProfile;
    const canManageRoles = ['admin', 'moderator'].includes(membership?.role) || currentRolePermissions.manageRoles;
    const canModerate = ['admin', 'moderator'].includes(membership?.role) || currentRolePermissions.moderateContent || currentRolePermissions.warnMembers || currentRolePermissions.suspendMembers || currentRolePermissions.banMembers || currentRolePermissions.viewAuditLog;
    const canViewAuditLog = ['admin', 'moderator'].includes(membership?.role) || currentRolePermissions.viewAuditLog;
    const canManageBlocklist = ['admin', 'moderator'].includes(membership?.role) || currentRolePermissions.moderateContent;
    const canModerateTab = canModerate || (membership?.roles?.length ?? 0) > 0;
    const canReviewInvites = membership?.role === 'admin';
    const canDeleteServer = membership?.role === 'admin';
    const socket = useSocket(user?._id, activeCommunityId);

    const filteredBlocklist = useMemo(() => {
        const query = blocklistQuery.trim().toLowerCase();
        if (!query) return blocklistEntries;
        return blocklistEntries.filter((item) => item?.value?.includes(query));
    }, [blocklistEntries, blocklistQuery]);

    const loadBlocklist = useCallback(async () => {
        if (!activeCommunityId) return;
        setIsBlocklistLoading(true);
        setBlocklistError('');
        try {
            const res = await fetch(apiUrl('/api/moderate/blocklist'), {
                credentials: 'include',
                headers: { 'x-community-id': activeCommunityId },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to fetch blocklist');
            setBlocklistEntries(data.blocklist || []);
        } catch (err) {
            setBlocklistError(err.message || 'Failed to fetch blocklist');
        }
        setIsBlocklistLoading(false);
    }, [activeCommunityId]);

    useEffect(() => {
        if (!activeCommunityId) return;

        let cancelled = false;
        const fetchInitialData = async () => {
            try {
                await fetchCommunityProfile(activeCommunityId);
                await fetchMembers(activeCommunityId);
                await fetchInviteRequests(activeCommunityId);

                const bans = await getBannedUsers(activeCommunityId);
                if (!cancelled) setBannedUsers(bans || []);

                // Fetch roles
                const res = await fetch(apiUrl(`/api/communities/${activeCommunityId}/roles`), {
                    credentials: 'include',
                });
                const data = await res.json();
                if (!cancelled && res.ok) setRoles(data.roles || []);
            } catch (err) {
                console.error("Failed to load initial settings data:", err);
            }
        };

        fetchInitialData();
        fetchChannels(); // For engagement dropdowns
        return () => { cancelled = true; };
    }, [activeCommunityId, fetchCommunityProfile, fetchMembers, fetchInviteRequests, getBannedUsers, fetchChannels]);

    // Update pending requests count for notification badge
    useEffect(() => {
        const pendingCount = (inviteRequests || []).filter(r => r.status === 'pending').length;
        setNotifications(prev => ({ ...prev, requests: pendingCount }));
    }, [inviteRequests]);
    useEffect(() => {
        if (!communityProfile) return;
        setName(communityProfile.name || '');
        setIcon(communityProfile.icon || '');
        setBannerColor(communityProfile.bannerColor || bannerOptions[0].value);
        setTraits(Array.isArray(communityProfile.traits) ? communityProfile.traits : []);
        setDescription(communityProfile.profileDescription || communityProfile.description || '');
        setInviteRequestsEnabled(!!communityProfile.inviteRequestsEnabled);

        // Initialize Engagement Settings
        const eng = communityProfile.engagement || {};
        setWelcomeEnabled(eng.systemMessages?.welcomeEnabled ?? true);
        setWelcomePromptEnabled(eng.systemMessages?.welcomePromptEnabled ?? true);
        setBoostEnabled(eng.systemMessages?.boostEnabled ?? true);
        setTipsEnabled(eng.systemMessages?.tipsEnabled ?? true);
        setSystemChannelId(eng.systemMessages?.channelId || '');
        setDisplayActivityFeed(eng.activityFeed?.displayEnabled ?? true);
        setNotificationType(eng.defaultNotifications || 'mentions');
        setAfkChannelId(eng.afk?.channelId || '');
        setAfkTimeout(eng.afk?.timeout || 300);
        setEmojis(communityProfile.emojis || []);

        // Initialize Access Settings
        const acc = communityProfile.access || {};
        setJoinMethod(acc.joinMethod || 'invite');
        setIsAgeRestricted(acc.isAgeRestricted ?? false);
        setRulesEnabled(acc.rules?.enabled ?? false);
        setRulesList(acc.rules?.list || []);

        // Initialize Safety Settings
        const safe = communityProfile.safety || {};
        setVerificationLevel(safe.verificationLevel || 'none');
        setExplicitContentFilter(safe.explicitContentFilter || 'members_without_roles');
        setTwoFactorModeration(safe.twoFactorModeration ?? false);

        // Initialize Community Settings
        const comm = communityProfile.community || {};
        setCommunityEnabled(comm.enabled ?? true);
        setRulesChannelId(comm.rulesChannelId || '');
        setUpdatesChannelId(comm.updatesChannelId || '');
        setSafetyChannelId(comm.safetyChannelId || '');
        setPrimaryLanguage(comm.primaryLanguage || 'English');
        setServerDescription(comm.description || '');

        // Initialize Onboarding Settings
        const onb = communityProfile.onboarding || {};
        setOnboardingEnabled(onb.enabled ?? false);
        setOnboardingSteps(onb.steps || []);
        setMemberTags(onb.memberTags || []);

        traitsInitRef.current = true;
    }, [communityProfile]);

    useEffect(() => {
        if (activeSettingsTab !== 'bans' || !activeCommunityId || !canModerate) return;
        let cancelled = false;
        const fetchQueue = async () => {
            setIsModerationLoading(true);
            setModerationError('');
            try {
                const res = await fetch(apiUrl('/api/moderate/queue'), {
                    credentials: 'include',
                    headers: { 'x-community-id': activeCommunityId },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Failed to fetch moderation queue');
                if (!cancelled) setModerationQueue(data.queue || []);
            } catch (err) {
                if (!cancelled) setModerationError(err.message || 'Failed to fetch moderation queue');
            }
            if (!cancelled) setIsModerationLoading(false);
        };
        fetchQueue();
        return () => { cancelled = true; };
    }, [activeSettingsTab, activeCommunityId, canModerate]);

    useEffect(() => {
        if (activeSettingsTab !== 'auditLog' || !activeCommunityId || !canViewAuditLog) return;
        let cancelled = false;
        const fetchLogs = async () => {
            setIsLogsLoading(true);
            setLogsError('');
            try {
                const res = await fetch(apiUrl('/api/moderate/logs'), {
                    credentials: 'include',
                    headers: { 'x-community-id': activeCommunityId },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Failed to fetch audit logs');
                if (!cancelled) setAuditLogs(data.logs || []);
            } catch (err) {
                if (!cancelled) setLogsError(err.message || 'Failed to fetch audit logs');
            }
            if (!cancelled) setIsLogsLoading(false);
        };
        fetchLogs();
        return () => { cancelled = true; };
    }, [activeSettingsTab, activeCommunityId, canViewAuditLog]);

    useEffect(() => {
        if (activeSettingsTab !== 'bans' || !activeCommunityId || !canManageBlocklist) return;
        loadBlocklist();
    }, [activeSettingsTab, activeCommunityId, canManageBlocklist, loadBlocklist]);

    useEffect(() => {
        if (!membersError) return;
        const t = setTimeout(() => clearMembersError(), 2200);
        return () => clearTimeout(t);
    }, [membersError, clearMembersError]);

    useEffect(() => {
        if (!inviteRequestsError) return;
        const t = setTimeout(() => clearInviteRequestsError(), 2200);
        return () => clearTimeout(t);
    }, [inviteRequestsError, clearInviteRequestsError]);

    useEffect(() => {
        setOpenMemberMenuId(null);
    }, [activeSettingsTab]);

    useEffect(() => {
        setOpenRoleMenuId(null);
    }, [activeSettingsTab, showRoleModal]);

    useEffect(() => {
        if (!socket) return;
        const handleKicked = ({ communityId, userId }) => {
            if (communityId !== activeCommunityId) return;
            removeMember(userId);
        };
        socket.on('community:member_kicked', handleKicked);
        return () => {
            socket.off('community:member_kicked', handleKicked);
        };
    }, [socket, activeCommunityId, removeMember]);

    useEffect(() => {
        if (!activeCommunityId) return;
        const shouldFetch =
            ['roles', 'members', 'bans'].includes(activeSettingsTab) ||
            (membership?.roles?.length ?? 0) > 0;
        if (!shouldFetch) return;
        let cancelled = false;
        const fetchRoles = async () => {
            setIsRolesLoading(true);
            try {
                const res = await fetch(`${API_BASE}/${activeCommunityId}/roles`, {
                    credentials: 'include',
                    headers: { 'x-community-id': activeCommunityId },
                });
                const data = await res.json();
                if (res.ok) setRoles(data.roles || []);
            } catch { }
            setIsRolesLoading(false);
        };

        if (activeSettingsTab === 'roles') fetchRoles();

        if (activeSettingsTab === 'bans') {
            setIsBansLoading(true);
            getBannedUsers(activeCommunityId)
                .then(setBannedUsers)
                .catch(() => { })
                .finally(() => setIsBansLoading(false));
        }

        if (activeSettingsTab === 'invites' && canReviewInvites) {
            fetchInviteRequests(activeCommunityId).catch(() => { });
        }
    }, [activeSettingsTab, activeCommunityId, fetchInviteRequests, canReviewInvites, getBannedUsers]);

    const openCreateRole = () => {
        setEditingRole(null);
        setRoleName('');
        setRolePerms(getDefaultRolePerms());
        setRoleColor('#99aab5');
        setRoleHoist(false);
        setRoleMentionable(false);
        setRoleTab('display');
        setPermissionQuery('');
        setShowRoleModal(true);
    };

    const getDefaultRolePerms = () => ({
        viewChannels: false,
        createChannels: false,
        manageChannels: false,
        manageRoles: false,
        createEvents: false,
        createInvite: false,
        kickMembers: false,
        banMembers: false,
        moderateContent: false,
        manageMessages: false,
        warnMembers: false,
        suspendMembers: false,
        viewAuditLog: false,
        editServerProfile: false,
    });

    const applyModeratorPreset = (perms) => {
        const next = { ...perms };
        rolePermissionOptions.forEach((perm) => {
            next[perm.key] = true;
        });
        return next;
    };

    const openEditRole = (role) => {
        setEditingRole(role);
        const nextName = role?.name || '';
        const basePerms = { ...getDefaultRolePerms(), ...(role?.permissions || {}) };
        const nextPerms = nextName.toLowerCase().includes('moderator')
            ? applyModeratorPreset(basePerms)
            : basePerms;
        setRoleName(nextName);
        setRolePerms(nextPerms);
        setRoleColor(role?.color || '#99aab5');
        setRoleHoist(!!role?.hoist);
        setRoleMentionable(!!role?.mentionable);
        setRoleTab('display');
        setPermissionQuery('');
        setShowRoleModal(true);
    };

    const handleSaveRole = async () => {
        if (!activeCommunityId || !roleName.trim()) return;
        try {
            const trimmedName = roleName.trim();
            const enforcedPerms = trimmedName.toLowerCase().includes('moderator')
                ? applyModeratorPreset(rolePerms)
                : rolePerms;
            const payload = {
                name: trimmedName,
                permissions: enforcedPerms,
                color: roleColor,
                hoist: roleHoist,
                mentionable: roleMentionable
            };
            const url = editingRole
                ? `${API_BASE}/${activeCommunityId}/roles/${editingRole._id}`
                : `${API_BASE}/${activeCommunityId}/roles`;
            const method = editingRole ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'x-community-id': activeCommunityId,
                },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to save role');
            if (editingRole) {
                setRoles((prev) => prev.map((r) => (r._id === editingRole._id ? { ...r, ...data.role } : r)));
            } else {
                setRoles((prev) => [data.role, ...prev]);
            }
            setShowRoleModal(false);
        } catch { }
    };

    const handleDeleteRole = async (roleId) => {
        if (!activeCommunityId || !roleId) return;
        try {
            const res = await fetch(`${API_BASE}/${activeCommunityId}/roles/${roleId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: { 'x-community-id': activeCommunityId },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to delete role');
            setRoles((prev) => prev.filter((r) => r._id !== roleId));
        } catch { }
    };

    const openAssignRoles = (member) => {
        setAssignMember(member);
        setAssignRoleIds((member?.roleIds || []).map((id) => id?.toString?.() || String(id)));
        setShowAssignModal(true);
    };

    const handleAssignRoles = async () => {
        if (!assignMember || !activeCommunityId) return;
        try {
            await updateRoles(activeCommunityId, assignMember._id, assignRoleIds);
            setShowAssignModal(false);
        } catch { }
    };

    const openModerationAction = (type, target) => {
        setActionModal({ type, target });
        setActionReason('');
        setActionDuration('24h');
        if (type === 'blocklist') {
            const content = (target?.content || '').trim();
            const urlMatch = content.match(/https?:\/\/[^\s<>()]+/i);
            const seed = (urlMatch?.[0] || content).slice(0, 160);
            setBlocklistValue(seed);
        } else {
            setBlocklistValue('');
        }
    };

    const handleAddBlocklistEntry = async () => {
        if (!activeCommunityId) return;
        const value = blocklistInput.trim();
        if (!value) return;
        setIsBlocklistSaving(true);
        setBlocklistError('');
        try {
            const res = await fetch(apiUrl('/api/moderate/blocklist'), {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'x-community-id': activeCommunityId,
                },
                body: JSON.stringify({ value }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to add blocklist entry');
            setBlocklistInput('');
            await loadBlocklist();
            if (canViewAuditLog) {
                const logsRes = await fetch(apiUrl('/api/moderate/logs'), {
                    credentials: 'include',
                    headers: { 'x-community-id': activeCommunityId },
                });
                const logsData = await logsRes.json();
                if (logsRes.ok) setAuditLogs(logsData.logs || []);
            }
        } catch (err) {
            setBlocklistError(err.message || 'Failed to add blocklist entry');
        }
        setIsBlocklistSaving(false);
    };

    const handleRemoveBlocklistEntry = async (value) => {
        if (!activeCommunityId || !value) return;
        setBlocklistBusyValue(value);
        setBlocklistError('');
        try {
            const res = await fetch(apiUrl('/api/moderate/blocklist'), {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'x-community-id': activeCommunityId,
                },
                body: JSON.stringify({ value }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to remove blocklist entry');
            await loadBlocklist();
            if (canViewAuditLog) {
                const logsRes = await fetch(apiUrl('/api/moderate/logs'), {
                    credentials: 'include',
                    headers: { 'x-community-id': activeCommunityId },
                });
                const logsData = await logsRes.json();
                if (logsRes.ok) setAuditLogs(logsData.logs || []);
            }
        } catch (err) {
            setBlocklistError(err.message || 'Failed to remove blocklist entry');
        }
        setBlocklistBusyValue('');
    };

    const handleModerationAction = async () => {
        if (!actionModal || !activeCommunityId) return;
        setIsActionBusy(true);
        try {
            const { type, target } = actionModal;
            if (type === 'dismiss') {
                const path = target?.type === 'message'
                    ? `/api/moderate/resolve-message/${target._id}`
                    : `/api/moderate/resolve/${target._id}`;
                await fetch(apiUrl(path), {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'x-community-id': activeCommunityId },
                });
            } else if (type === 'delete_post') {
                await fetch(apiUrl(`/api/moderate/post/${target._id}`), {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-community-id': activeCommunityId,
                    },
                    body: JSON.stringify({ reason: actionReason }),
                });
            } else if (type === 'delete_message') {
                await fetch(apiUrl(`/api/moderate/message/${target._id}`), {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-community-id': activeCommunityId,
                    },
                    body: JSON.stringify({ reason: actionReason }),
                });
            } else if (type === 'warn') {
                await fetch(apiUrl(`/api/moderate/warn/${target.author?._id}`), {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-community-id': activeCommunityId,
                    },
                    body: JSON.stringify({ reason: actionReason }),
                });
            } else if (type === 'suspend') {
                await fetch(apiUrl(`/api/moderate/suspend/${target.author?._id}`), {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-community-id': activeCommunityId,
                    },
                    body: JSON.stringify({ reason: actionReason, duration: actionDuration }),
                });
            } else if (type === 'ban') {
                await fetch(apiUrl(`/api/moderate/ban/${target.author?._id}`), {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-community-id': activeCommunityId,
                    },
                    body: JSON.stringify({ reason: actionReason }),
                });
            } else if (type === 'kick') {
                await fetch(apiUrl(`/api/communities/${activeCommunityId}/members/${target.author?._id}`), {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: { 'x-community-id': activeCommunityId },
                });
            } else if (type === 'blocklist') {
                await fetch(apiUrl('/api/moderate/blocklist'), {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-community-id': activeCommunityId,
                    },
                    body: JSON.stringify({ value: blocklistValue, reason: actionReason }),
                });
            }
            // refresh queue
            const res = await fetch(apiUrl('/api/moderate/queue'), {
                credentials: 'include',
                headers: { 'x-community-id': activeCommunityId },
            });
            const data = await res.json();
            if (res.ok) setModerationQueue(data.queue || []);
            if (type === 'blocklist' && canManageBlocklist) {
                await loadBlocklist();
            }
            if (canViewAuditLog) {
                const logsRes = await fetch(apiUrl('/api/moderate/logs'), {
                    credentials: 'include',
                    headers: { 'x-community-id': activeCommunityId },
                });
                const logsData = await logsRes.json();
                if (logsRes.ok) setAuditLogs(logsData.logs || []);
            }
            setActionModal(null);
        } catch { }
        setIsActionBusy(false);
    };

    const handleConfirmKick = async () => {
        if (!pendingKickMember || !activeCommunityId) return;
        setIsKicking(true);
        try {
            await kickMember(activeCommunityId, pendingKickMember._id);
            setPendingKickMember(null);
        } catch { }
        setIsKicking(false);
    };

    const handlePickIcon = () => fileRef.current?.click();

    const handleIconChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const url = await uploadFile(file);
            setIcon(url);
        } catch { }
    };


    useEffect(() => {
        if (!traitsInitRef.current) return;
    }, [traits]);

    const handleSave = async () => {
        if (!activeCommunityId || !canManage) return;
        setIsSaving(true);
        try {
            const payload = {
                name: name.trim(),
                icon,
                bannerColor,
                traits: traits.filter(t => t.trim() !== ''),
                profileDescription: description.trim(),
                inviteRequestsEnabled: !!inviteRequestsEnabled,
                engagement: {
                    systemMessages: {
                        welcomeEnabled,
                        welcomePromptEnabled,
                        boostEnabled,
                        tipsEnabled,
                        channelId: systemChannelId || null,
                    },
                    activityFeed: {
                        displayEnabled: displayActivityFeed,
                    },
                    defaultNotifications: notificationType,
                    afk: {
                        channelId: afkChannelId || null,
                        timeout: Number(afkTimeout),
                    },
                },
                access: {
                    joinMethod,
                    isAgeRestricted,
                    rules: {
                        enabled: rulesEnabled,
                        list: rulesList,
                    },
                },
                safety: {
                    verificationLevel,
                    explicitContentFilter,
                    twoFactorModeration,
                },
                community: {
                    enabled: communityEnabled,
                    rulesChannelId,
                    updatesChannelId,
                    safetyChannelId,
                    primaryLanguage,
                    description: serverDescription,
                },
                onboarding: {
                    enabled: onboardingEnabled,
                    steps: onboardingSteps,
                    memberTags,
                },
            };
            await updateCommunityProfile(activeCommunityId, payload);
            await fetchCommunityProfile(activeCommunityId);
            setSuccessMessage('Server settings saved successfully!');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            setError(err.message || 'Failed to save settings');
            setTimeout(() => setError(''), 3000);
        }
        setIsSaving(false);
    };

    const handleDeleteServer = async () => {
        if (!activeCommunityId || !canDeleteServer || !communityProfile?.name) return;
        if (deleteName.trim() !== communityProfile.name) return;
        setIsDeleting(true);
        try {
            const data = await deleteCommunity(activeCommunityId);
            if (data?.user) {
                setUser(data.user);
                if (data.user.memberships?.length > 0) {
                    initFromMemberships(data.user.memberships);
                } else {
                    clearWorkspace();
                }
            } else {
                clearWorkspace();
            }
            setShowDeleteModal(false);
            setDeleteName('');
            navigate('/feed');
        } catch {
            setIsDeleting(false);
            return;
        }
        setIsDeleting(false);
    };

    const estLabel = useMemo(() => {
        if (!communityProfile?.createdAt) return 'Est. 2026';
        const d = new Date(communityProfile.createdAt);
        return `Est. ${d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    }, [communityProfile?.createdAt]);

    const filteredMembers = useMemo(() => {
        const unbanned = members.filter(m => !m.isBanned);
        if (!memberQuery.trim()) return unbanned;
        const q = memberQuery.trim().toLowerCase();
        return unbanned.filter((m) => (
            (m.name || '').toLowerCase().includes(q) ||
            (m.email || '').toLowerCase().includes(q)
        ));
    }, [members, memberQuery]);

    const roleMap = useMemo(() => {
        const map = new Map();
        roles.forEach((r) => {
            if (r?._id) map.set(r._id.toString(), r);
        });
        return map;
    }, [roles]);

    const filteredRoles = useMemo(() => {
        if (!roleQuery.trim()) return roles;
        const q = roleQuery.trim().toLowerCase();
        return roles.filter((r) => (r.name || '').toLowerCase().includes(q));
    }, [roles, roleQuery]);

    const filteredPermissionOptions = useMemo(() => {
        if (!permissionQuery.trim()) return rolePermissionOptions;
        const q = permissionQuery.trim().toLowerCase();
        return rolePermissionOptions.filter((perm) =>
            perm.label.toLowerCase().includes(q) || perm.description.toLowerCase().includes(q)
        );
    }, [permissionQuery]);

    const formatDate = (dateValue) => {
        if (!dateValue) return '—';
        const d = new Date(dateValue);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const isDirty = useMemo(() => {
        if (!communityProfile) return false;
        const profileTraits = Array.isArray(communityProfile.traits) ? communityProfile.traits : [];
        const normalizeSteps = (steps) => (steps || []).map(s => ({
            title: s.title || '',
            description: s.description || '',
            icon: s.icon || '',
            channelId: s.channelId?.toString?.() || s.channelId || null
        }));

        const currentSteps = normalizeSteps(onboardingSteps);
        const serverSteps = normalizeSteps(communityProfile.onboarding?.steps);

        return (
            name.trim() !== (communityProfile.name || '').trim() ||
            icon !== (communityProfile.icon || '') ||
            bannerColor !== (communityProfile.bannerColor || bannerOptions[0].value) ||
            description.trim() !== (communityProfile.profileDescription || communityProfile.description || '').trim() ||
            inviteRequestsEnabled !== !!communityProfile.inviteRequestsEnabled ||
            JSON.stringify(traits.map(t => t.trim()).filter(Boolean)) !== JSON.stringify(profileTraits.map(t => t.trim()).filter(Boolean)) ||
            welcomeEnabled !== (communityProfile.engagement?.systemMessages?.welcomeEnabled ?? true) ||
            welcomePromptEnabled !== (communityProfile.engagement?.systemMessages?.welcomePromptEnabled ?? true) ||
            boostEnabled !== (communityProfile.engagement?.systemMessages?.boostEnabled ?? true) ||
            tipsEnabled !== (communityProfile.engagement?.systemMessages?.tipsEnabled ?? true) ||
            (systemChannelId || null) !== (communityProfile.engagement?.systemMessages?.channelId || null) ||
            displayActivityFeed !== (communityProfile.engagement?.activityFeed?.displayEnabled ?? true) ||
            notificationType !== (communityProfile.engagement?.defaultNotifications || 'mentions') ||
            (afkChannelId || null) !== (communityProfile.engagement?.afk?.channelId || null) ||
            Number(afkTimeout) !== (communityProfile.engagement?.afk?.timeout || 300) ||
            joinMethod !== (communityProfile.access?.joinMethod || 'invite') ||
            isAgeRestricted !== (communityProfile.access?.isAgeRestricted ?? false) ||
            rulesEnabled !== (communityProfile.access?.rules?.enabled ?? false) ||
            JSON.stringify(rulesList.map(r => r.trim()).filter(Boolean)) !== JSON.stringify((communityProfile.access?.rules?.list || []).map(r => r.trim()).filter(Boolean)) ||
            verificationLevel !== (communityProfile.safety?.verificationLevel || 'none') ||
            explicitContentFilter !== (communityProfile.safety?.explicitContentFilter || 'members_without_roles') ||
            twoFactorModeration !== (communityProfile.safety?.twoFactorModeration ?? false) ||
            communityEnabled !== (communityProfile.community?.enabled ?? true) ||
            (rulesChannelId || null) !== (communityProfile.community?.rulesChannelId || null) ||
            (updatesChannelId || null) !== (communityProfile.community?.updatesChannelId || null) ||
            (safetyChannelId || null) !== (communityProfile.community?.safetyChannelId || null) ||
            primaryLanguage !== (communityProfile.community?.primaryLanguage || 'English') ||
            serverDescription.trim() !== (communityProfile.community?.description || '').trim() ||
            onboardingEnabled !== (communityProfile.onboarding?.enabled ?? false) ||
            JSON.stringify(currentSteps) !== JSON.stringify(serverSteps) ||
            JSON.stringify(memberTags.map(t => t.trim()).filter(Boolean)) !== JSON.stringify((communityProfile.onboarding?.memberTags || []).map(t => t.trim()).filter(Boolean))
        );
    }, [name, icon, bannerColor, description, inviteRequestsEnabled, traits, communityProfile, welcomeEnabled, welcomePromptEnabled, boostEnabled, tipsEnabled, systemChannelId, displayActivityFeed, notificationType, afkChannelId, afkTimeout, joinMethod, isAgeRestricted, rulesEnabled, rulesList, verificationLevel, explicitContentFilter, twoFactorModeration, communityEnabled, rulesChannelId, updatesChannelId, safetyChannelId, primaryLanguage, serverDescription, onboardingEnabled, onboardingSteps, memberTags]);

    const handleReset = () => {
        if (!communityProfile) return;
        setName(communityProfile.name || '');
        setIcon(communityProfile.icon || '');
        setBannerColor(communityProfile.bannerColor || bannerOptions[0].value);
        setTraits(Array.isArray(communityProfile.traits) ? communityProfile.traits : []);
        setDescription(communityProfile.profileDescription || communityProfile.description || '');
        setInviteRequestsEnabled(!!communityProfile.inviteRequestsEnabled);

        const eng = communityProfile.engagement || {};
        setWelcomeEnabled(eng.systemMessages?.welcomeEnabled ?? true);
        setWelcomePromptEnabled(eng.systemMessages?.welcomePromptEnabled ?? true);
        setBoostEnabled(eng.systemMessages?.boostEnabled ?? true);
        setTipsEnabled(eng.systemMessages?.tipsEnabled ?? true);
        setSystemChannelId(eng.systemMessages?.channelId || '');
        setDisplayActivityFeed(eng.activityFeed?.displayEnabled ?? true);
        setNotificationType(eng.defaultNotifications || 'mentions');
        setAfkChannelId(eng.afk?.channelId || '');
        setAfkTimeout(eng.afk?.timeout || 300);
        setEmojis(communityProfile.emojis || []);

        const acc = communityProfile.access || {};
        setJoinMethod(acc.joinMethod || 'invite');
        setIsAgeRestricted(acc.isAgeRestricted ?? false);
        setRulesEnabled(acc.rules?.enabled ?? false);
        setRulesList(acc.rules?.list || []);
        setNewRule('');

        const safe = communityProfile.safety || {};
        setVerificationLevel(safe.verificationLevel || 'none');
        setExplicitContentFilter(safe.explicitContentFilter || 'members_without_roles');
        setTwoFactorModeration(safe.twoFactorModeration ?? false);

        const comm = communityProfile.community || {};
        setCommunityEnabled(comm.enabled ?? true);
        setRulesChannelId(comm.rulesChannelId || '');
        setUpdatesChannelId(comm.updatesChannelId || '');
        setSafetyChannelId(comm.safetyChannelId || '');
        setPrimaryLanguage(comm.primaryLanguage || 'English');
        setServerDescription(comm.description || '');

        const onb = communityProfile.onboarding || {};
        setOnboardingEnabled(onb.enabled ?? false);
        setOnboardingSteps(onb.steps || []);
        setMemberTags(onb.memberTags || []);
    };

    const handleUploadEmoji = async (file) => {
        if (!file || !activeCommunityId) return;
        if (emojis.length >= 50) {
            alert("You've reached the limit of 50 emojis.");
            return;
        }

        setIsEmojiUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const uploadRes = await fetch(apiUrl('/api/upload'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: formData,
            });
            const uploadData = await uploadRes.json();

            if (!uploadData.success) throw new Error(uploadData.message);

            const emojiName = file.name.split('.')[0].replace(/[^a-zA-Z0-9_]/g, "");
            
            const res = await fetch(apiUrl(`/api/communities/${activeCommunityId}/emojis`), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({
                    name: emojiName || 'unnamed',
                    url: uploadData.url,
                }),
            });
            const data = await res.json();

            if (data.success) {
                setEmojis(prev => [...prev, data.emoji]);
                await fetchCommunityProfile(activeCommunityId); // Refresh store
            }
        } catch (err) {
            console.error("Failed to upload emoji:", err);
            alert(err.message || "Failed to upload emoji");
        } finally {
            setIsEmojiUploading(false);
        }
    };

    const handleDeleteEmoji = async (emojiId) => {
        if (!activeCommunityId || !window.confirm("Are you sure you want to delete this emoji?")) return;

        try {
            const res = await fetch(apiUrl(`/api/communities/${activeCommunityId}/emojis/${emojiId}`), {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });
            if (res.ok) {
                setEmojis(prev => prev.filter(e => e._id !== emojiId));
                await fetchCommunityProfile(activeCommunityId);
            }
        } catch (err) {
            console.error("Failed to delete emoji:", err);
        }
    };

    const handleRenameEmoji = async (emojiId) => {
        if (!activeCommunityId || !newEmojiName.trim()) {
            setEditingEmojiId(null);
            return;
        }

        try {
            const res = await fetch(apiUrl(`/api/communities/${activeCommunityId}/emojis/${emojiId}`), {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({ name: newEmojiName.trim().replace(/[^a-zA-Z0-9_]/g, "") }),
            });
            const data = await res.json();
            if (data.success) {
                setEmojis(prev => prev.map(e => e._id === emojiId ? data.emoji : e));
                setEditingEmojiId(null);
                await fetchCommunityProfile(activeCommunityId);
            }
        } catch (err) {
            console.error("Failed to rename emoji:", err);
        }
    };

    const handleAddRule = () => {
        if (!newRule.trim()) return;
        setRulesList(prev => [...prev, newRule.trim()]);
        setNewRule('');
    };

    const handleRemoveRule = (index) => {
        setRulesList(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddExampleRule = (rule) => {
        if (rulesList.includes(rule)) return;
        setRulesList(prev => [...prev, rule]);
    };

    const handleAddOnboardingStep = () => {
        setOnboardingSteps(prev => [...prev, { title: 'New Step', description: '', icon: '', channelId: '' }]);
    };

    const handleUpdateOnboardingStep = (index, field, value) => {
        const newSteps = [...onboardingSteps];
        newSteps[index] = { ...newSteps[index], [field]: value };
        setOnboardingSteps(newSteps);
    };

    const handleRemoveOnboardingStep = (index) => {
        setOnboardingSteps(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddMemberTag = (tag) => {
        if (!tag.trim() || memberTags.includes(tag.trim())) return;
        setMemberTags(prev => [...prev, tag.trim()]);
    };

    const handleRemoveMemberTag = (index) => {
        setMemberTags(prev => prev.filter((_, i) => i !== index));
    };

    const previewBanner = bannerColor || bannerOptions[0].value;
    const previewTraits = traits.length > 0 ? traits.filter(t => t.trim()) : ['Community', 'Chat', 'Events'];
    const isRestricted = useMemo(() => {
        if (activeSettingsTab === 'profile') return !canEditServerProfile;
        if (activeSettingsTab === 'members') return !canManage;
        if (activeSettingsTab === 'invites') return !canReviewInvites;
        if (activeSettingsTab === 'roles') return !canManageRoles;
        if (activeSettingsTab === 'bans') return !canModerate;
        if (activeSettingsTab === 'access') return !canManage;
        if (activeSettingsTab === 'safety') return !canModerateTab;
        if (['overview', 'onboarding', 'insights'].includes(activeSettingsTab)) return !canEditServerProfile;
        return false;
    }, [activeSettingsTab, canEditServerProfile, canManage, canManageRoles, canReviewInvites, canModerate]);

    const firstAllowedTab = useMemo(() => {
        if (canEditServerProfile) return 'profile';
        if (canManage) return 'members';
        if (canReviewInvites) return 'invites';
        if (canManageRoles) return 'roles';
        if (canModerateTab) return 'bans';
        return 'profile';
    }, [canEditServerProfile, canManage, canReviewInvites, canManageRoles, canModerateTab]);

    useEffect(() => {
        if (activeSettingsTab === 'profile' && !canEditServerProfile) {
            setActiveSettingsTab(firstAllowedTab);
            return;
        }
        if (activeSettingsTab === 'members' && !canManage) {
            setActiveSettingsTab(firstAllowedTab);
            return;
        }
        if (activeSettingsTab === 'invites' && !canReviewInvites) {
            setActiveSettingsTab(firstAllowedTab);
            return;
        }
        if (activeSettingsTab === 'roles' && !canManageRoles) {
            setActiveSettingsTab(firstAllowedTab);
            return;
        }
        if (activeSettingsTab === 'bans' && !canModerateTab) {
            setActiveSettingsTab(firstAllowedTab);
        }
    }, [activeSettingsTab, canEditServerProfile, canManage, canReviewInvites, canManageRoles, canModerateTab, firstAllowedTab]);

    return (
        <>
            <div className="min-h-screen bg-[#202024] text-discord-white overflow-hidden">
                <div className="flex h-screen">
                    {/* Left nav (Aligned right within flexible left side) */}
                    <div className="hidden md:flex flex-1 justify-end bg-[#121214]">
                        <aside className="w-[240px] shrink-0 pt-14 pb-20 pr-2 pl-4 flex-col overflow-y-auto">
                            <div className="flex flex-col space-y-[2px]">
                                {/* Server Name Header */}
                                <div className="px-2.5 pb-2 text-[12px] font-bold uppercase tracking-wide text-[#949ba4] truncate">
                                    {communityProfile?.name || 'Server Settings'}
                                </div>

                                <button
                                    onClick={() => setActiveSettingsTab('profile')}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium transition-colors ${activeSettingsTab === 'profile'
                                        ? 'bg-[rgba(78,80,88,0.6)] text-white'
                                        : 'text-[#b5bac1] hover:bg-[rgba(78,80,88,0.3)] hover:text-[#dbdee1]'
                                        }`}
                                >
                                    Server Profile
                                </button>
                                <button
                                    onClick={() => setActiveSettingsTab('engagement')}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium transition-colors ${activeSettingsTab === 'engagement'
                                        ? 'bg-[rgba(78,80,88,0.6)] text-white'
                                        : 'text-[#b5bac1] hover:bg-[rgba(78,80,88,0.3)] hover:text-[#dbdee1]'
                                        }`}
                                >
                                    Engagement
                                </button>
                                <button
                                    onClick={() => setActiveSettingsTab('access')}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium transition-colors ${activeSettingsTab === 'access'
                                        ? 'bg-[rgba(78,80,88,0.6)] text-white'
                                        : 'text-[#b5bac1] hover:bg-[rgba(78,80,88,0.3)] hover:text-[#dbdee1]'
                                        }`}
                                >
                                    Access
                                </button>

                                {/* Expression */}
                                <div className="px-2.5 pt-6 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#949ba4]">Expression</div>
                                <button
                                    onClick={() => setActiveSettingsTab('emoji')}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium transition-colors ${activeSettingsTab === 'emoji'
                                        ? 'bg-[rgba(78,80,88,0.6)] text-white'
                                        : 'text-[#b5bac1] hover:bg-[rgba(78,80,88,0.3)] hover:text-[#dbdee1]'
                                        }`}
                                >
                                    Emoji
                                </button>

                                {/* People */}
                                <div className="px-2.5 pt-6 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#949ba4]">People</div>
                                {canManage && (
                                    <button
                                        onClick={() => setActiveSettingsTab('members')}
                                        className={`group flex items-center justify-between w-full text-left px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium transition-colors ${activeSettingsTab === 'members'
                                            ? 'bg-[rgba(78,80,88,0.6)] text-white'
                                            : 'text-[#b5bac1] hover:bg-[rgba(78,80,88,0.3)] hover:text-[#dbdee1]'
                                            }`}
                                    >
                                        <span>Members</span>
                                        <MoreVertical className="w-3.5 h-3.5 text-[#949ba4] rotate-90" />
                                    </button>
                                )}
                                {canManageRoles && (
                                    <button
                                        onClick={() => setActiveSettingsTab('roles')}
                                        className={`w-full text-left px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium transition-colors ${activeSettingsTab === 'roles'
                                            ? 'bg-[rgba(78,80,88,0.6)] text-white'
                                            : 'text-[#b5bac1] hover:bg-[rgba(78,80,88,0.3)] hover:text-[#dbdee1]'
                                            }`}
                                    >
                                        Roles
                                    </button>
                                )}
                                {canReviewInvites && (
                                    <button
                                        onClick={() => setActiveSettingsTab('invites')}
                                        className={`group flex items-center justify-between w-full text-left px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium transition-colors ${activeSettingsTab === 'invites'
                                            ? 'bg-[rgba(78,80,88,0.6)] text-white'
                                            : 'text-[#b5bac1] hover:bg-[rgba(78,80,88,0.3)] hover:text-[#dbdee1]'
                                            }`}
                                    >
                                        Invites
                                        {notifications.requests > 0 && (
                                            <span className="min-w-[16px] h-[16px] px-1 rounded-full bg-[#f23f42] text-[10px] font-bold text-white flex items-center justify-center">
                                                {notifications.requests}
                                            </span>
                                        )}
                                    </button>
                                )}
                                <button
                                    onClick={() => setActiveSettingsTab('access')}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium transition-colors ${activeSettingsTab === 'access'
                                        ? 'bg-[rgba(78,80,88,0.6)] text-white'
                                        : 'text-[#b5bac1] hover:bg-[rgba(78,80,88,0.3)] hover:text-[#dbdee1]'
                                        }`}
                                >
                                    Access
                                </button>

                                {/* Moderation */}
                                <div className="px-2.5 pt-6 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#949ba4]">Moderation</div>
                                <button
                                    onClick={() => setActiveSettingsTab('safety')}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium transition-colors ${activeSettingsTab === 'safety'
                                        ? 'bg-[rgba(78,80,88,0.6)] text-white'
                                        : 'text-[#b5bac1] hover:bg-[rgba(78,80,88,0.3)] hover:text-[#dbdee1]'
                                        }`}
                                >
                                    Safety Setup
                                </button>
                                {canViewAuditLog && (
                                    <button
                                        onClick={() => setActiveSettingsTab('auditLog')}
                                        className={`w-full text-left px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium transition-colors ${activeSettingsTab === 'auditLog'
                                            ? 'bg-[rgba(78,80,88,0.6)] text-white'
                                            : 'text-[#b5bac1] hover:bg-[rgba(78,80,88,0.3)] hover:text-[#dbdee1]'
                                            }`}
                                    >
                                        Audit Log
                                    </button>
                                )}
                                {canModerateTab && (
                                    <button
                                        onClick={() => setActiveSettingsTab('bans')}
                                        className={`w-full text-left px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium transition-colors ${activeSettingsTab === 'bans'
                                            ? 'bg-[rgba(78,80,88,0.6)] text-white'
                                            : 'text-[#b5bac1] hover:bg-[rgba(78,80,88,0.3)] hover:text-[#dbdee1]'
                                            }`}
                                    >
                                        Bans
                                    </button>
                                )}

                                {/* Community */}
                                <div className="px-2.5 pt-6 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#949ba4]">Community</div>
                                <button
                                    onClick={() => setActiveSettingsTab('overview')}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium transition-colors ${activeSettingsTab === 'overview'
                                        ? 'bg-[rgba(78,80,88,0.6)] text-white'
                                        : 'text-[#b5bac1] hover:bg-[rgba(78,80,88,0.3)] hover:text-[#dbdee1]'
                                        }`}
                                >
                                    Overview
                                </button>
                                <button
                                    onClick={() => setActiveSettingsTab('onboarding')}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium transition-colors ${activeSettingsTab === 'onboarding'
                                        ? 'bg-[rgba(78,80,88,0.6)] text-white'
                                        : 'text-[#b5bac1] hover:bg-[rgba(78,80,88,0.3)] hover:text-[#dbdee1]'
                                        }`}
                                >
                                    Onboarding
                                </button>
                                <button
                                    onClick={() => setActiveSettingsTab('insights')}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium transition-colors ${activeSettingsTab === 'insights'
                                        ? 'bg-[rgba(78,80,88,0.6)] text-white'
                                        : 'text-[#b5bac1] hover:bg-[rgba(78,80,88,0.3)] hover:text-[#dbdee1]'
                                        }`}
                                >
                                    Server Insights
                                </button>

                                <div className="h-[1px] bg-[rgba(255,255,255,0.06)] mx-2 my-2" />

                                <button className="w-full text-left px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium text-[#b5bac1] hover:bg-[rgba(78,80,88,0.3)] hover:text-[#dbdee1] transition-colors">
                                    Server Template
                                </button>

                                {canDeleteServer && (
                                    <button
                                        onClick={() => setShowDeleteModal(true)}
                                        className="group flex items-center justify-between w-full px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium text-[#f23f42] hover:bg-[#f23f42] hover:text-white transition-colors"
                                    >
                                        Delete Server
                                        <Trash2 className="w-4 h-4 text-[#f23f42] group-hover:text-white" />
                                    </button>
                                )}
                            </div>
                        </aside>
                    </div>

                    {/* Main Content (Aligned left within flexible right side) */}
                    <main className="flex-[2] overflow-y-auto relative bg-[#202024]">
                        {/* Desktop Close Button */}
                        <div className="hidden md:block fixed top-12 right-12 z-50">
                            <div className="flex flex-col items-center gap-1.5">
                                <button
                                    onClick={() => navigate('/feed')}
                                    className="w-9 h-9 rounded-full border-2 border-[#b5bac1] flex items-center justify-center text-[#b5bac1] hover:text-white hover:border-white transition-all duration-150 group"
                                    title="Close (ESC)"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                <span className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wide group-hover:text-white">ESC</span>
                            </div>
                        </div>
                        <div className="max-w-[740px] px-5 sm:px-10 py-12 sm:py-14 mx-auto md:mx-0 md:ml-0 lg:ml-10">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 sm:mb-8">
                                <div className="md:hidden flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-xs uppercase tracking-[0.16em] text-discord-faint">
                                                {communityProfile?.name || 'Server'}
                                            </div>
                                            <h1 className="text-lg font-semibold text-white">
                                                {activeSettingsTab === 'members'
                                                    ? 'Server Members'
                                                    : activeSettingsTab === 'invites'
                                                        ? 'Invite Requests'
                                                        : activeSettingsTab === 'roles'
                                                            ? 'Roles'
                                                            : activeSettingsTab === 'auditLog'
                                                                ? 'Audit Log'
                                                                : activeSettingsTab === 'bans'
                                                                    ? 'Bans'
                                                                    : activeSettingsTab === 'engagement'
                                                                        ? 'Engagement'
                                                                        : activeSettingsTab === 'emoji'
                                                                            ? 'Emoji'
                                                                            : 'Server Profile'}
                                            </h1>
                                        </div>
                                        <button
                                            onClick={() => navigate('/feed')}
                                            className="w-9 h-9 rounded-full border border-discord-border/50 flex items-center justify-center hover:bg-discord-border-light/30 transition"
                                            title="Close"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {canEditServerProfile && (
                                            <button
                                                onClick={() => setActiveSettingsTab('profile')}
                                                className={`px-3 py-1.5 rounded-full text-xs font-semibold ${activeSettingsTab === 'profile'
                                                    ? 'bg-discord-border-light/30 text-discord-white'
                                                    : 'text-discord-faint hover:bg-discord-border-light/20'
                                                    }`}
                                            >
                                                Profile
                                            </button>
                                        )}
                                        {canManage && (
                                            <button
                                                onClick={() => setActiveSettingsTab('members')}
                                                className={`px-3 py-1.5 rounded-full text-xs font-semibold ${activeSettingsTab === 'members'
                                                    ? 'bg-discord-border-light/30 text-discord-white'
                                                    : 'text-discord-faint hover:bg-discord-border-light/20'
                                                    }`}
                                            >
                                                Members
                                            </button>
                                        )}
                                        {canReviewInvites && (
                                            <button
                                                onClick={() => setActiveSettingsTab('invites')}
                                                className={`px-3 py-1.5 rounded-full text-xs font-semibold ${activeSettingsTab === 'invites'
                                                    ? 'bg-discord-border-light/30 text-discord-white'
                                                    : 'text-discord-faint hover:bg-discord-border-light/20'
                                                    }`}
                                            >
                                                Invites
                                            </button>
                                        )}
                                        {canManageRoles && (
                                            <button
                                                onClick={() => setActiveSettingsTab('roles')}
                                                className={`px-3 py-1.5 rounded-full text-xs font-semibold ${activeSettingsTab === 'roles'
                                                    ? 'bg-discord-border-light/30 text-discord-white'
                                                    : 'text-discord-faint hover:bg-discord-border-light/20'
                                                    }`}
                                            >
                                                Roles
                                            </button>
                                        )}
                                        {canModerateTab && (
                                            <button
                                                onClick={() => setActiveSettingsTab('bans')}
                                                className={`px-3 py-1.5 rounded-full text-xs font-semibold ${activeSettingsTab === 'bans'
                                                    ? 'bg-discord-border-light/30 text-discord-white'
                                                    : 'text-discord-faint hover:bg-discord-border-light/20'
                                                    }`}
                                            >
                                                Moderation
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="hidden md:flex justify-between items-start w-full">
                                    <div className="flex-1">
                                        <h1 className="text-2xl font-bold">
                                            {activeSettingsTab === 'members'
                                                ? 'Server Members'
                                                : activeSettingsTab === 'invites'
                                                    ? 'Invite Requests'
                                                    : activeSettingsTab === 'roles'
                                                        ? 'Roles'
                                                        : activeSettingsTab === 'auditLog'
                                                            ? 'Audit Log'
                                                            : activeSettingsTab === 'bans'
                                                                ? 'Bans'
                                                                : activeSettingsTab === 'engagement'
                                                                    ? 'Engagement'
                                                                    : 'Server Profile'}
                                        </h1>
                                        {activeSettingsTab !== 'auditLog' && (
                                            <p className="text-sm text-discord-faint mt-1">
                                                {activeSettingsTab === 'members'
                                                    ? 'Manage your server members and search by name.'
                                                    : activeSettingsTab === 'invites'
                                                        ? 'Review invite requests and approve or reject them.'
                                                        : activeSettingsTab === 'roles'
                                                            ? 'Use roles to group members and assign permissions.'
                                                            : activeSettingsTab === 'bans'
                                                                ? 'Moderation tools and permissions for this server.'
                                                                : activeSettingsTab === 'engagement'
                                                                    ? 'Manage settings that help keep your server active.'
                                                                    : activeSettingsTab === 'emoji'
                                                                        ? 'Add and manage custom emojis for your server.'
                                                                        : 'Customize how your server appears in invite links and community discovery.'}
                                            </p>
                                        )}
                                    </div>
                                    {activeSettingsTab === 'auditLog' && (
                                        <div className="flex items-center gap-6 pr-12">
                                            <div>
                                                <div className="text-[12px] font-bold text-discord-light mb-1.5">Filter by User</div>
                                                <select
                                                    value={auditFilterUser}
                                                    onChange={(e) => setAuditFilterUser(e.target.value)}
                                                    className="w-[180px] bg-discord-darkest text-discord-light text-[13px] px-3 py-1.5 border border-discord-border/30 rounded focus:outline-none"
                                                >
                                                    <option value="All Users">All Users</option>
                                                </select>
                                            </div>
                                            <div>
                                                <div className="text-[12px] font-bold text-discord-light mb-1.5">Filter by Action</div>
                                                <select
                                                    value={auditFilterAction}
                                                    onChange={(e) => setAuditFilterAction(e.target.value)}
                                                    className="w-[180px] bg-discord-darkest text-discord-light text-[13px] px-3 py-1.5 border border-discord-border/30 rounded focus:outline-none"
                                                >
                                                    <option value="All Actions">All Actions</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    {(activeSettingsTab === 'profile' || activeSettingsTab === 'engagement') && (
                                        <button
                                            className="px-4 py-2 rounded-md bg-discord-border-light/30 text-sm font-semibold hover:bg-discord-border-light/50 transition disabled:opacity-50"
                                            onClick={handleSave}
                                            disabled={!canEditServerProfile || isSaving}
                                        >
                                            <Save className="w-4 h-4 inline mr-2" />
                                            {isSaving ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => navigate('/feed')}
                                        className="w-9 h-9 rounded-full border border-discord-border/50 flex items-center justify-center hover:bg-discord-border-light/30 transition"
                                        title="Close"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {isRestricted && (
                                <div className="mb-6 flex items-center gap-2 text-sm text-discord-faint bg-discord-border-light/15 border border-discord-border/40 rounded-lg px-4 py-3">
                                    <Shield className="w-4 h-4" />
                                    You don't have permission to edit this page.
                                </div>
                            )}

                            {activeSettingsTab === 'engagement' ? (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    {/* System Messages */}
                                    <section>
                                        <h2 className="text-[12px] font-bold text-[#949ba4] uppercase tracking-wide mb-4">System Messages</h2>
                                        <p className="text-sm text-[#b5bac1] mb-6">Configure system event messages sent to your server.</p>
                                        
                                        <div className="space-y-4">
                                            {[
                                                { label: 'Send a random welcome message when someone joins this server.', state: welcomeEnabled, setter: setWelcomeEnabled },
                                                { label: 'Prompt members to reply to welcome messages with an emoji.', state: welcomePromptEnabled, setter: setWelcomePromptEnabled },
                                                { label: 'Send a message when someone Boosts this server.', state: boostEnabled, setter: setBoostEnabled },
                                                { label: 'Send helpful tips for server setup.', state: tipsEnabled, setter: setTipsEnabled },
                                            ].map((item, idx) => (
                                                <div key={idx} className="flex items-center justify-between py-2 border-b border-[rgba(255,255,255,0.04)]">
                                                    <span className="text-[15px] text-[#dbdee1] leading-tight pr-4">{item.label}</span>
                                                    <button
                                                        onClick={() => item.setter(!item.state)}
                                                        className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blurple focus-visible:ring-offset-2 focus-visible:ring-offset-[#313338] ${item.state ? 'bg-[#23a559]' : 'bg-[#80848e]'}`}
                                                    >
                                                        <span className={`pointer-events-none block h-[18px] w-[18px] rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${item.state ? 'translate-x-[18px]' : 'translate-x-1'}`} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-6">
                                            <label className="block text-[12px] font-bold text-[#949ba4] uppercase tracking-wide mb-2">System Messages Channel</label>
                                            <p className="text-xs text-[#949ba4] mb-3">This is the channel that we send system event messages to.</p>
                                            <div className="relative group">
                                                <select
                                                    value={systemChannelId}
                                                    onChange={(e) => setSystemChannelId(e.target.value)}
                                                    className="w-full bg-[#1e1f22] text-[#dbdee1] text-[15px] px-3 py-2.5 rounded-[4px] border border-transparent focus:outline-none appearance-none cursor-pointer hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                                                >
                                                    <option value="">No System Channel</option>
                                                    {channels.filter(c => c.type === 'text' || c.type === 'announcement').map(ch => (
                                                        <option key={ch._id} value={ch._id}># {ch.name}</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#b5bac1]">
                                                    <MoreVertical className="w-4 h-4 rotate-90" />
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    <div className="h-[1px] bg-[rgba(255,255,255,0.06)]" />

                                    {/* Activity Feed */}
                                    <section>
                                        <h2 className="text-[12px] font-bold text-[#949ba4] uppercase tracking-wide mb-4">Activity Feed Settings</h2>
                                        <p className="text-sm text-[#b5bac1] mb-6">Shows a feed of activity from games and connected apps in this server.</p>
                                        
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[15px] text-[#dbdee1]">Display Activity Feed in this server</span>
                                            <button
                                                onClick={() => setDisplayActivityFeed(!displayActivityFeed)}
                                                className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${displayActivityFeed ? 'bg-[#23a559]' : 'bg-[#80848e]'}`}
                                            >
                                                <span className={`pointer-events-none block h-[18px] w-[18px] rounded-full bg-white transition-transform duration-200 ${displayActivityFeed ? 'translate-x-[18px]' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    </section>

                                    <div className="h-[1px] bg-[rgba(255,255,255,0.06)]" />

                                    {/* Default Notification Settings */}
                                    <section>
                                        <h2 className="text-[12px] font-bold text-[#949ba4] uppercase tracking-wide mb-2">Default Notification Settings</h2>
                                        <p className="text-sm text-[#b5bac1] mb-6">This will determine whether members who have not explicitly set their notification settings receive a notification for every message sent in this server or not.</p>
                                        
                                        <div className="space-y-4">
                                            {[
                                                { id: 'all', label: 'All Messages' },
                                                { id: 'mentions', label: 'Only @mentions' },
                                            ].map((opt) => (
                                                <label key={opt.id} className="flex items-start gap-3 cursor-pointer group">
                                                    <div className="relative flex items-center mt-0.5">
                                                        <input
                                                            type="radio"
                                                            name="notificationType"
                                                            checked={notificationType === opt.id}
                                                            onChange={() => setNotificationType(opt.id)}
                                                            className="sr-only"
                                                        />
                                                        <div className={`w-5 h-5 rounded-full border-2 transition-colors flex items-center justify-center ${notificationType === opt.id ? 'border-blurple' : 'border-[#b5bac1] group-hover:border-[#dbdee1]'}`}>
                                                            {notificationType === opt.id && <div className="w-2.5 h-2.5 rounded-full bg-blurple" />}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="text-[15px] text-[#dbdee1] block">{opt.label}</span>
                                                        {opt.id === 'mentions' && (
                                                            <p className="text-xs text-[#949ba4] mt-1 italic">We highly recommend setting this to only @mentions for a Community Server.</p>
                                                        )}
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </section>

                                    <div className="h-[1px] bg-[rgba(255,255,255,0.06)]" />

                                    {/* Inactive Channel */}
                                    <section>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-[12px] font-bold text-[#949ba4] uppercase tracking-wide mb-2">Inactive Channel</label>
                                                <div className="relative group">
                                                    <select
                                                        value={afkChannelId}
                                                        onChange={(e) => setAfkChannelId(e.target.value)}
                                                        className="w-full bg-[#1e1f22] text-[#dbdee1] text-[15px] px-3 py-2.5 rounded-[4px] border border-transparent focus:outline-none appearance-none cursor-pointer hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                                                    >
                                                        <option value="">No Inactive Channel</option>
                                                        {channels.filter(c => c.type === 'voice').map(ch => (
                                                            <option key={ch._id} value={ch._id}>{ch.name}</option>
                                                        ))}
                                                    </select>
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#b5bac1]">
                                                        <MoreVertical className="w-4 h-4 rotate-90" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[12px] font-bold text-[#949ba4] uppercase tracking-wide mb-2">Inactive Time-out</label>
                                                <div className="relative group">
                                                    <select
                                                        value={afkTimeout}
                                                        onChange={(e) => setAfkTimeout(Number(e.target.value))}
                                                        className="w-full bg-[#1e1f22] text-[#dbdee1] text-[15px] px-3 py-2.5 rounded-[4px] border border-transparent focus:outline-none appearance-none cursor-pointer hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                                                    >
                                                        <option value={60}>1 minute</option>
                                                        <option value={300}>5 minutes</option>
                                                        <option value={900}>15 minutes</option>
                                                        <option value={1800}>30 minutes</option>
                                                        <option value={3600}>1 hour</option>
                                                    </select>
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#b5bac1]">
                                                        <MoreVertical className="w-4 h-4 rotate-90" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-xs text-[#949ba4] mt-4">Automatically move members to this channel and mute them when they have been idle for longer than the inactive time-out. This does not affect browsers.</p>
                                    </section>
                                </div>
                            ) : activeSettingsTab === 'emoji' ? (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <header>
                                        <h2 className="text-[12px] font-bold text-[#949ba4] uppercase tracking-wide mb-4">Emoji</h2>
                                        <p className="text-sm text-[#b5bac1]">
                                            Add up to 50 custom emojis that anyone can use in this server. Animated GIF emojis may be used by members with Discord Nitro.
                                        </p>
                                    </header>

                                    <div className="flex flex-col items-start gap-4">
                                        <label className="px-4 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white text-[14px] font-medium rounded-[3px] cursor-pointer transition-colors disabled:opacity-50">
                                            {isEmojiUploading ? 'Uploading...' : 'Upload Emoji'}
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                disabled={isEmojiUploading}
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) {
                                                        handleUploadEmoji(e.target.files[0]);
                                                    }
                                                }}
                                            />
                                        </label>
                                        <p className="text-[12px] text-[#949ba4] leading-normal max-w-lg">
                                            If you want to upload multiple emojis or skip the editor, drag and drop the file(s) onto this page. The emojis will be named using the file name.
                                        </p>
                                    </div>

                                    <div className="h-[1px] bg-[rgba(255,255,255,0.06)] my-8" />

                                    {emojis.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-center">
                                            <div className="w-[240px] h-[160px] mb-8 relative flex items-center justify-center">
                                                <Smile className="w-24 h-24 text-[#4e5058] opacity-20" />
                                                <div className="absolute inset-0 border-2 border-dashed border-[#4e5058] opacity-10 rounded-2xl" />
                                            </div>
                                            <h3 className="text-[17px] font-bold text-[#949ba4] uppercase tracking-wide">No Emoji</h3>
                                            <p className="text-sm text-[#949ba4] mt-1">Get the party started by uploading an emoji</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-[64px_1fr_120px_48px] gap-4 px-2 text-[12px] font-bold text-[#949ba4] uppercase tracking-wide">
                                                <div>Emoji</div>
                                                <div>Name</div>
                                                <div className="text-right">Action</div>
                                            </div>
                                            <div className="space-y-1">
                                                {emojis.map((emoji) => (
                                                    <div key={emoji._id} className="grid grid-cols-[64px_1fr_120px_48px] gap-4 items-center px-2 py-2.5 rounded-md hover:bg-[rgba(78,80,88,0.3)] group transition-colors">
                                                        <div className="w-10 h-10 flex items-center justify-center bg-[#1e1f22] rounded-md overflow-hidden">
                                                            <img src={emoji.url} alt={emoji.name} className="max-w-full max-h-full object-contain" />
                                                        </div>
                                                        <div className="flex-1">
                                                            {editingEmojiId === emoji._id ? (
                                                                <input
                                                                    autoFocus
                                                                    value={newEmojiName}
                                                                    onChange={(e) => setNewEmojiName(e.target.value)}
                                                                    onBlur={() => handleRenameEmoji(emoji._id)}
                                                                    onKeyDown={(e) => e.key === 'Enter' && handleRenameEmoji(emoji._id)}
                                                                    className="w-full max-w-[200px] bg-[#1e1f22] text-discord-white px-3 py-1.5 rounded border border-[#5865f2] text-sm focus:outline-none"
                                                                />
                                                            ) : (
                                                                <div className="flex items-center gap-2 group/name">
                                                                    <span className="text-sm text-[#dbdee1] font-medium truncate">{emoji.name}</span>
                                                                    <button 
                                                                        onClick={() => {
                                                                            setEditingEmojiId(emoji._id);
                                                                            setNewEmojiName(emoji.name);
                                                                        }}
                                                                        className="opacity-0 group-hover/name:opacity-100 p-1 text-[#b5bac1] hover:text-[#dbdee1] transition-opacity"
                                                                    >
                                                                        <Pencil className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="text-right pr-2">
                                                            <button
                                                                onClick={() => handleDeleteEmoji(emoji._id)}
                                                                className="p-2 text-[#b5bac1] hover:text-[#f23f42] opacity-0 group-hover:opacity-100 transition-all"
                                                                title="Delete Emoji"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : activeSettingsTab === 'access' ? (
                                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <section>
                                        <header className="mb-6">
                                            <h2 className="text-[17px] font-bold text-white mb-1">How can people join your server?</h2>
                                            <p className="text-sm text-[#b5bac1]">
                                                Keep your server private or open it up for more people to join. <span className="text-[#00a8fc] cursor-pointer hover:underline">Learn More.</span>
                                            </p>
                                        </header>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#2b2d31] p-4 rounded-lg">
                                            {[
                                                { id: 'invite', title: 'Invite Only', desc: 'People can join your server directly with an invite', icon: Lock },
                                                { id: 'apply', title: 'Apply to Join', desc: 'People must submit an application and be approved to join', icon: Mail },
                                                { id: 'discoverable', title: 'Discoverable', desc: 'Anyone can join your server directly through Server Discovery', icon: Globe },
                                            ].map((method) => (
                                                <button
                                                    key={method.id}
                                                    onClick={() => setJoinMethod(method.id)}
                                                    className={`flex flex-col items-center text-center p-6 rounded-lg border-2 transition-all group ${joinMethod === method.id 
                                                        ? 'bg-[#313338] border-white shadow-xl scale-[1.02]' 
                                                        : 'bg-transparent border-transparent hover:bg-[rgba(78,80,88,0.2)] hover:border-[#4e5058]'}`}
                                                >
                                                    <div className={`w-12 h-12 flex items-center justify-center rounded-full mb-4 transition-colors ${joinMethod === method.id ? 'text-white' : 'text-[#b5bac1] group-hover:text-[#dbdee1]'}`}>
                                                        <method.icon className="w-6 h-6" />
                                                    </div>
                                                    <h3 className={`text-[15px] font-bold mb-1 transition-colors ${joinMethod === method.id ? 'text-white' : 'text-[#b5bac1] group-hover:text-[#dbdee1]'}`}>
                                                        {method.title}
                                                    </h3>
                                                    <p className={`text-[13px] leading-tight px-2 transition-colors ${joinMethod === method.id ? 'text-[#dbdee1]' : 'text-[#949ba4]'}`}>
                                                        {method.desc}
                                                    </p>
                                                </button>
                                            ))}
                                        </div>
                                    </section>

                                    <div className="h-[1px] bg-[rgba(255,255,255,0.06)]" />

                                    <section>
                                        <div className="flex items-center justify-between mb-2">
                                            <div>
                                                <h3 className="text-[15px] font-bold text-white">Age-Restricted Server</h3>
                                                <p className="text-[13px] text-[#b5bac1] mt-1 leading-normal">
                                                    Users will need to confirm that they are over the legal age to view the content in this server. <span className="text-[#00a8fc] cursor-pointer hover:underline">Learn more.</span>
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => setIsAgeRestricted(!isAgeRestricted)}
                                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${isAgeRestricted ? 'bg-[#23a559]' : 'bg-[#80848e]'}`}
                                            >
                                                <span className={`pointer-events-none block h-[18px] w-[18px] rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${isAgeRestricted ? 'translate-x-[22px]' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    </section>

                                    <div className="h-[1px] bg-[rgba(255,255,255,0.06)]" />

                                    <section className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-[15px] font-bold text-white">Server Rules</h3>
                                                <p className="text-[13px] text-[#b5bac1] mt-1 leading-normal">
                                                    Members must agree to rules before they can chat or interact in the server.
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => setRulesEnabled(!rulesEnabled)}
                                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${rulesEnabled ? 'bg-[#23a559]' : 'bg-[#80848e]'}`}
                                            >
                                                <span className={`pointer-events-none block h-[18px] w-[18px] rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${rulesEnabled ? 'translate-x-[22px]' : 'translate-x-1'}`} />
                                            </button>
                                        </div>

                                        {rulesEnabled && (
                                            <div className="bg-[#2b2d31] rounded-lg p-6 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="space-y-4">
                                                    <label className="block text-[12px] font-bold text-[#949ba4] uppercase tracking-wide">Rules</label>
                                                    <div className="space-y-2">
                                                        {rulesList.map((rule, idx) => (
                                                            <div key={idx} className="flex items-center justify-between bg-[#1e1f22] p-3 rounded group">
                                                                <span className="text-[14px] text-[#dbdee1] flex-1 pr-4">{idx + 1}. {rule}</span>
                                                                <button 
                                                                    onClick={() => handleRemoveRule(idx)}
                                                                    className="p-1.5 text-[#b5bac1] hover:text-[#f23f42] opacity-0 group-hover:opacity-100 transition-all"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    
                                                    <div className="relative group">
                                                        <textarea
                                                            value={newRule}
                                                            onChange={(e) => setNewRule(e.target.value)}
                                                            placeholder="Enter a rule"
                                                            className="w-full bg-[#1e1f22] text-[#dbdee1] text-[14px] px-3 py-3 rounded border border-transparent focus:border-blurple focus:outline-none transition-all resize-none min-h-[44px]"
                                                            rows={1}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                    e.preventDefault();
                                                                    handleAddRule();
                                                                }
                                                            }}
                                                        />
                                                    </div>

                                                    <button
                                                        onClick={handleAddRule}
                                                        className="flex items-center gap-2 text-[#dbdee1] hover:text-white text-[14px] font-medium py-2 px-4 rounded border-2 border-dashed border-[#4e5058] hover:border-[#b5bac1] w-full justify-center transition-all"
                                                    >
                                                        <Sparkles className="w-4 h-4" />
                                                        Add a rule
                                                    </button>
                                                </div>

                                                <div className="space-y-3">
                                                    <label className="block text-[12px] font-bold text-[#949ba4] uppercase tracking-wide">Example Rules</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {[
                                                            'Be civil and respectful',
                                                            'No spam or self-promotion',
                                                            'No age-restricted or obscene content',
                                                            'Help keep things safe'
                                                        ].map((example) => (
                                                            <button
                                                                key={example}
                                                                onClick={() => handleAddExampleRule(example)}
                                                                className="px-3 py-1.5 bg-[#1e1f22] hover:bg-[#35373c] text-[#dbdee1] text-[13px] rounded-full transition-colors border border-transparent hover:border-[#4e5058]"
                                                            >
                                                                {example}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </section>
                                </div>
                            ) : activeSettingsTab === 'safety' ? (
                                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <section>
                                        <header className="mb-6">
                                            <h2 className="text-[17px] font-bold text-white mb-1">Verification Level</h2>
                                            <p className="text-sm text-[#b5bac1]">
                                                Members of the server must meet the following criteria before they can send messages in text channels or start a direct message with another member. This does not apply to members who have been assigned a role.
                                            </p>
                                        </header>

                                        <div className="space-y-2">
                                            {[
                                                { id: 'none', title: 'None', desc: 'Unrestricted' },
                                                { id: 'low', title: 'Low', desc: 'Must have a verified email on their account.' },
                                                { id: 'medium', title: 'Medium', desc: 'Must also be registered on CircleCore for longer than 5 minutes.' },
                                                { id: 'high', title: 'High', desc: 'Must also be a member of this server for longer than 10 minutes.' },
                                                { id: 'highest', title: 'Highest', desc: 'Must have a verified phone number on their account.' },
                                            ].map((level) => (
                                                <div
                                                    key={level.id}
                                                    onClick={() => setVerificationLevel(level.id)}
                                                    className={`flex items-center justify-between p-4 rounded-[4px] border cursor-pointer transition-all ${verificationLevel === level.id 
                                                        ? 'bg-[#313338] border-blurple' 
                                                        : 'bg-[#2b2d31] border-transparent hover:bg-[rgba(78,80,88,0.2)]'}`}
                                                >
                                                    <div className="flex-1">
                                                        <h3 className="text-[14px] font-semibold text-[#dbdee1]">{level.title}</h3>
                                                        <p className="text-[13px] text-[#949ba4] mt-0.5">{level.desc}</p>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${verificationLevel === level.id ? 'border-blurple' : 'border-[#b5bac1]'}`}>
                                                        {verificationLevel === level.id && <div className="w-2.5 h-2.5 rounded-full bg-blurple" />}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    <div className="h-[1px] bg-[rgba(255,255,255,0.06)]" />

                                    <section>
                                        <header className="mb-6">
                                            <h2 className="text-[17px] font-bold text-white mb-1">Explicit Media Content Filter</h2>
                                            <p className="text-sm text-[#b5bac1]">
                                                Automatically scan and delete media sent in this server that contains explicit content.
                                            </p>
                                        </header>

                                        <div className="space-y-2">
                                            {[
                                                { id: 'disabled', title: "Don't scan any media content", desc: "I'm living on the edge.", color: 'bg-[#80848e]' },
                                                { id: 'members_without_roles', title: 'Scan media content from members without a role', desc: 'Recommended for servers that use roles for trusted members.', color: 'bg-[#f57731]' },
                                                { id: 'all_members', title: 'Scan media content from all members', desc: 'Recommended for when you want that extra layer of protection.', color: 'bg-[#ed4245]' },
                                            ].map((filter) => (
                                                <div
                                                    key={filter.id}
                                                    onClick={() => setExplicitContentFilter(filter.id)}
                                                    className={`flex items-center gap-4 p-4 rounded-[4px] border cursor-pointer transition-all ${explicitContentFilter === filter.id 
                                                        ? 'bg-[#313338] border-blurple' 
                                                        : 'bg-[#2b2d31] border-transparent hover:bg-[rgba(78,80,88,0.2)]'}`}
                                                >
                                                    <div className={`w-1 h-full min-h-[40px] rounded-full ${filter.color}`} />
                                                    <div className="flex-1">
                                                        <h3 className="text-[14px] font-semibold text-[#dbdee1]">{filter.title}</h3>
                                                        <p className="text-[13px] text-[#949ba4] mt-0.5">{filter.desc}</p>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${explicitContentFilter === filter.id ? 'border-blurple' : 'border-[#b5bac1]'}`}>
                                                        {explicitContentFilter === filter.id && <div className="w-2.5 h-2.5 rounded-full bg-blurple" />}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    <div className="h-[1px] bg-[rgba(255,255,255,0.06)]" />

                                    <section className="flex items-center justify-between p-4 bg-[#2b2d31] rounded-lg">
                                        <div className="flex-1 pr-8">
                                            <h3 className="text-[15px] font-bold text-white flex items-center gap-2">
                                                2FA Requirement for Moderation
                                                <span className="px-1.5 py-0.5 bg-[#5865f2] text-[10px] font-bold text-white rounded uppercase tracking-wider">Premium</span>
                                            </h3>
                                            <p className="text-[13px] text-[#b5bac1] mt-1 leading-normal">
                                                When enabled, all moderators and admins in this server must have Two-Factor Authentication enabled on their accounts in order to perform any moderation actions.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setTwoFactorModeration(!twoFactorModeration)}
                                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${twoFactorModeration ? 'bg-[#23a559]' : 'bg-[#80848e]'}`}
                                        >
                                            <span className={`pointer-events-none block h-[18px] w-[18px] rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${twoFactorModeration ? 'translate-x-[22px]' : 'translate-x-1'}`} />
                                        </button>
                                    </section>
                                </div>
                            ) : activeSettingsTab === 'overview' ? (
                                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <header className="mb-6">
                                        <h2 className="text-[17px] font-bold text-white mb-1">Community Overview</h2>
                                        <p className="text-sm text-[#b5bac1]">
                                            Set up your community's identity and communication channels.
                                        </p>
                                    </header>

                                    <div className="space-y-8">
                                        <div className="space-y-4">
                                            <div>
                                                <h3 className="text-[14px] font-bold text-[#dbdee1] uppercase tracking-wide">Rules or guidelines channel</h3>
                                                <p className="text-[13px] text-[#949ba4] mt-1">Please select the channel that hosts your rules. This channel will by default start from the top and will feature a special header.</p>
                                            </div>
                                            <div className="relative group">
                                                <select
                                                    value={rulesChannelId}
                                                    onChange={(e) => setRulesChannelId(e.target.value)}
                                                    className="w-full bg-[#1e1f22] text-[#dbdee1] text-[15px] px-3 py-2.5 rounded border border-transparent focus:border-blurple focus:outline-none transition-all appearance-none cursor-pointer"
                                                >
                                                    <option value="">Select a channel</option>
                                                    {channels.map(ch => (
                                                        <option key={ch._id} value={ch._id}># {ch.name}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#949ba4] pointer-events-none group-hover:text-[#dbdee1] transition-colors" />
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <h3 className="text-[14px] font-bold text-[#dbdee1] uppercase tracking-wide">Community Updates Channel</h3>
                                                <p className="text-[13px] text-[#949ba4] mt-1">This is the channel where CircleCore will send relevant updates for Community admins and moderators.</p>
                                            </div>
                                            <div className="relative group">
                                                <select
                                                    value={updatesChannelId}
                                                    onChange={(e) => setUpdatesChannelId(e.target.value)}
                                                    className="w-full bg-[#1e1f22] text-[#dbdee1] text-[15px] px-3 py-2.5 rounded border border-transparent focus:border-blurple focus:outline-none transition-all appearance-none cursor-pointer"
                                                >
                                                    <option value="">Select a channel</option>
                                                    {channels.map(ch => (
                                                        <option key={ch._id} value={ch._id}># {ch.name}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#949ba4] pointer-events-none group-hover:text-[#dbdee1] transition-colors" />
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <h3 className="text-[14px] font-bold text-[#dbdee1] uppercase tracking-wide">Safety Notifications Channel</h3>
                                                <p className="text-[13px] text-[#949ba4] mt-1">Important safety updates about your server will be sent here.</p>
                                            </div>
                                            <div className="relative group">
                                                <select
                                                    value={safetyChannelId}
                                                    onChange={(e) => setSafetyChannelId(e.target.value)}
                                                    className="w-full bg-[#1e1f22] text-[#dbdee1] text-[15px] px-3 py-2.5 rounded border border-transparent focus:border-blurple focus:outline-none transition-all appearance-none cursor-pointer"
                                                >
                                                    <option value="">Select a channel</option>
                                                    {channels.map(ch => (
                                                        <option key={ch._id} value={ch._id}># {ch.name}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#949ba4] pointer-events-none group-hover:text-[#dbdee1] transition-colors" />
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <h3 className="text-[14px] font-bold text-[#dbdee1] uppercase tracking-wide">Server Primary Language</h3>
                                                <p className="text-[13px] text-[#949ba4] mt-1">This helps us customize features for you and your members.</p>
                                            </div>
                                            <div className="relative group">
                                                <select
                                                    value={primaryLanguage}
                                                    onChange={(e) => setPrimaryLanguage(e.target.value)}
                                                    className="w-full bg-[#1e1f22] text-[#dbdee1] text-[15px] px-3 py-2.5 rounded border border-transparent focus:border-blurple focus:outline-none transition-all appearance-none cursor-pointer"
                                                >
                                                    <option value="English">English</option>
                                                    <option value="Spanish">Spanish</option>
                                                    <option value="French">French</option>
                                                    <option value="German">German</option>
                                                    <option value="Hindi">Hindi</option>
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#949ba4] pointer-events-none group-hover:text-[#dbdee1] transition-colors" />
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <h3 className="text-[14px] font-bold text-[#dbdee1] uppercase tracking-wide">Server Description</h3>
                                                <p className="text-[13px] text-[#949ba4] mt-1">Describe your community. This description will be displayed in external embeds of this server's invite link.</p>
                                            </div>
                                            <textarea
                                                value={serverDescription}
                                                onChange={(e) => setServerDescription(e.target.value)}
                                                placeholder="Tell the world a bit about this server."
                                                rows={4}
                                                className="w-full bg-[#1e1f22] text-[#dbdee1] text-[15px] px-4 py-3 rounded border border-transparent focus:border-blurple focus:outline-none transition-all resize-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="h-[1px] bg-[rgba(255,255,255,0.06)]" />

                                    <section className="bg-[rgba(237,66,69,0.05)] border border-[rgba(237,66,69,0.2)] rounded-lg p-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-[15px] font-bold text-[#ed4245]">Disable Community</h3>
                                                <p className="text-[13px] text-[#b5bac1] mt-1 leading-normal max-w-lg">
                                                    This will remove specific features for Community Servers, like Server Discovery and Server Insights.
                                                </p>
                                            </div>
                                            <button 
                                                onClick={() => setCommunityEnabled(false)}
                                                className="px-6 py-2 bg-[#ed4245] hover:bg-[#c03537] text-white text-[14px] font-medium rounded transition-colors shadow-lg"
                                            >
                                                Disable Community
                                            </button>
                                        </div>
                                    </section>
                                </div>
                            ) : activeSettingsTab === 'onboarding' ? (
                                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <header className="mb-6">
                                        <h2 className="text-[17px] font-bold text-white mb-1">Server Onboarding</h2>
                                        <p className="text-sm text-[#b5bac1]">
                                            Guide new members through your server and help them find their way.
                                        </p>
                                    </header>

                                    <div className="flex items-center justify-between p-6 bg-[#2b2d31] rounded-lg">
                                        <div>
                                            <h3 className="text-[15px] font-bold text-white">Enable Onboarding</h3>
                                            <p className="text-[13px] text-[#949ba4] mt-1">Show a welcome screen to new members when they join.</p>
                                        </div>
                                        <button
                                            onClick={() => setOnboardingEnabled(!onboardingEnabled)}
                                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${onboardingEnabled ? 'bg-[#23a559]' : 'bg-[#80848e]'}`}
                                        >
                                            <span className={`pointer-events-none block h-[18px] w-[18px] rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${onboardingEnabled ? 'translate-x-[22px]' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    {onboardingEnabled && (
                                        <div className="space-y-10 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <section className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-[14px] font-bold text-[#dbdee1] uppercase tracking-wide">Onboarding Steps</h3>
                                                    <button 
                                                        onClick={handleAddOnboardingStep}
                                                        className="text-[13px] font-medium text-[#00a8fc] hover:underline"
                                                    >
                                                        + Add Step
                                                    </button>
                                                </div>
                                                <div className="space-y-3">
                                                    {onboardingSteps.map((step, idx) => (
                                                        <div key={idx} className="bg-[#1e1f22] p-4 rounded-lg border border-transparent hover:border-[#4e5058] transition-all group">
                                                            <div className="flex items-start gap-4">
                                                                <div className="w-10 h-10 bg-[#313338] rounded-md flex items-center justify-center text-xl">
                                                                    {step.icon || '👋'}
                                                                </div>
                                                                <div className="flex-1 space-y-3">
                                                                    <div className="flex items-center justify-between">
                                                                        <input 
                                                                            value={step.title}
                                                                            onChange={(e) => handleUpdateOnboardingStep(idx, 'title', e.target.value)}
                                                                            className="bg-transparent text-[15px] font-bold text-white focus:outline-none w-full"
                                                                            placeholder="Step Title"
                                                                        />
                                                                        <button 
                                                                            onClick={() => handleRemoveOnboardingStep(idx)}
                                                                            className="p-1 text-[#949ba4] hover:text-[#ed4245] opacity-0 group-hover:opacity-100 transition-all"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                    <textarea 
                                                                        value={step.description}
                                                                        onChange={(e) => handleUpdateOnboardingStep(idx, 'description', e.target.value)}
                                                                        className="bg-transparent text-[13px] text-[#dbdee1] focus:outline-none w-full resize-none"
                                                                        placeholder="What should they do?"
                                                                        rows={2}
                                                                    />
                                                                    <div className="relative group/select">
                                                                        <select
                                                                            value={step.channelId}
                                                                            onChange={(e) => handleUpdateOnboardingStep(idx, 'channelId', e.target.value)}
                                                                            className="w-full bg-[#313338] text-[#dbdee1] text-[13px] px-2 py-1.5 rounded border border-transparent focus:border-blurple focus:outline-none transition-all appearance-none cursor-pointer"
                                                                        >
                                                                            <option value="">Select a channel</option>
                                                                            {channels.map(ch => (
                                                                                <option key={ch._id} value={ch._id}># {ch.name}</option>
                                                                            ))}
                                                                        </select>
                                                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#949ba4] pointer-events-none" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {onboardingSteps.length === 0 && (
                                                        <div className="py-10 text-center border-2 border-dashed border-[#4e5058] rounded-lg">
                                                            <Info className="w-8 h-8 text-[#4e5058] mx-auto mb-2" />
                                                            <p className="text-[14px] text-[#949ba4]">No onboarding steps added yet.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </section>

                                            <section className="space-y-4">
                                                <h3 className="text-[14px] font-bold text-[#dbdee1] uppercase tracking-wide">Member Tags</h3>
                                                <p className="text-[13px] text-[#949ba4]">Tags that members can select during onboarding to personalize their experience.</p>
                                                <div className="bg-[#1e1f22] p-4 rounded-lg space-y-4">
                                                    <div className="flex flex-wrap gap-2">
                                                        {memberTags.map((tag, idx) => (
                                                            <div key={idx} className="flex items-center gap-1.5 px-3 py-1 bg-[#313338] text-[#dbdee1] text-[13px] rounded-full group">
                                                                {tag}
                                                                <button onClick={() => handleRemoveMemberTag(idx)} className="hover:text-white">
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <input 
                                                            placeholder="Add a tag..."
                                                            className="flex-1 bg-[#313338] text-[13px] text-[#dbdee1] px-3 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-blurple"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    handleAddMemberTag(e.target.value);
                                                                    e.target.value = '';
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </section>
                                        </div>
                                    )}
                                </div>
                            ) : activeSettingsTab === 'insights' ? (
                                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <header className="mb-6">
                                        <h2 className="text-[17px] font-bold text-white mb-1">Server Insights</h2>
                                        <p className="text-sm text-[#b5bac1]">
                                            See how your server is performing and growing.
                                        </p>
                                    </header>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-[#2b2d31] p-6 rounded-lg space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-[14px] font-bold text-[#949ba4] uppercase tracking-wide">Total Members</h3>
                                                <TrendingUp className="w-5 h-5 text-[#23a559]" />
                                            </div>
                                            <div className="text-4xl font-bold text-white">{communityProfile?.membersCount || 0}</div>
                                            <div className="text-[13px] text-[#23a559] flex items-center gap-1">
                                                <TrendingUp className="w-3.5 h-3.5" />
                                                <span>+12% from last week</span>
                                            </div>
                                        </div>

                                        <div className="bg-[#2b2d31] p-6 rounded-lg space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-[14px] font-bold text-[#949ba4] uppercase tracking-wide">Active Members</h3>
                                                <Users className="w-5 h-5 text-blurple" />
                                            </div>
                                            <div className="text-4xl font-bold text-white">{Math.floor((communityProfile?.membersCount || 0) * 0.4)}</div>
                                            <div className="text-[13px] text-[#949ba4]">Average daily active members</div>
                                        </div>
                                    </div>

                                    <div className="bg-[#2b2d31] p-8 rounded-lg flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-[#4e5058]">
                                        <BarChart2 className="w-16 h-16 text-[#4e5058] mb-4 opacity-20" />
                                        <h3 className="text-[17px] font-bold text-[#949ba4] uppercase tracking-widest">More Data Incoming</h3>
                                        <p className="text-[14px] text-[#949ba4] mt-2 text-center max-w-sm">
                                            Insights require at least 50 members to display detailed growth and engagement metrics.
                                        </p>
                                        <button className="mt-6 px-8 py-2.5 bg-blurple hover:bg-[#4752c4] text-white text-[14px] font-medium rounded transition-all shadow-lg">
                                            Learn More
                                        </button>
                                    </div>
                                </div>
                            ) : activeSettingsTab === 'members' ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="relative w-full max-w-md">
                                            <input
                                                value={memberQuery}
                                                onChange={(e) => setMemberQuery(e.target.value)}
                                                placeholder="Search by username or email"
                                                className="w-full bg-discord-darkest/70 border border-discord-border/50 rounded-lg px-3 py-2 text-sm text-discord-white placeholder:text-discord-faint/60 focus:outline-none focus:ring-2 focus:ring-blurple"
                                            />
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-discord-border/40 overflow-visible">
                                        <div className="hidden md:grid grid-cols-[2fr_1.2fr_1.2fr_1fr_0.4fr] gap-4 px-4 py-3 bg-discord-darkest/80 text-[11px] font-semibold uppercase tracking-[0.12em] text-discord-faint">
                                            <div>Name</div>
                                            <div>Member Since</div>
                                            <div>Joined CircleCore</div>
                                            <div>Role</div>
                                            <div className="text-right">Actions</div>
                                        </div>
                                        <div className="divide-y divide-discord-border/30">
                                            {isMembersLoading && (
                                                <div className="px-4 py-6 text-xs text-discord-faint">Loading members...</div>
                                            )}
                                            {!isMembersLoading && filteredMembers.length === 0 && (
                                                <div className="px-4 py-6 text-xs text-discord-faint">No members found.</div>
                                            )}
                                            {!isMembersLoading && filteredMembers.map((member) => (
                                                <div key={member._id} className="grid md:grid-cols-[2fr_1.2fr_1.2fr_1fr_0.4fr] gap-2 md:gap-4 px-4 py-3 items-center bg-discord-darker/40 relative overflow-visible">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-discord-darkest flex items-center justify-center overflow-hidden text-sm font-semibold">
                                                            {member.avatar ? (
                                                                <img src={member.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                                                            ) : (
                                                                (member.name || 'M').charAt(0).toUpperCase()
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-discord-white">{member.name}</p>
                                                            <p className="text-[11px] text-discord-faint">{member.email}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-[11px] text-discord-faint md:text-sm md:text-discord-light">
                                                        <span className="md:hidden">Member since </span>
                                                        {formatDate(member.joinedAt)}
                                                    </div>
                                                    <div className="text-[11px] text-discord-faint md:text-sm md:text-discord-light">
                                                        <span className="md:hidden">Joined CircleCore · </span>
                                                        {formatDate(member.joinedAt)}
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5 min-w-0">
                                                        {member.communityRole && member.communityRole !== 'member' && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-discord-border-light/25 text-[10px] font-bold text-discord-white uppercase tracking-wider">
                                                                {member.communityRole}
                                                            </span>
                                                        )}
                                                        {(member.roleIds || [])
                                                            .map((id) => roleMap.get(id?.toString?.() || String(id)))
                                                            .filter(Boolean)
                                                            .sort((a, b) => (b.position || 0) - (a.position || 0))
                                                            .map((role) => (
                                                                <span
                                                                    key={`${member._id}-${role._id}`}
                                                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#232428] border border-[#1e1f22] text-[11px] font-medium text-[#dbdee1]"
                                                                >
                                                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color || '#99aab5' }} />
                                                                    {role.name}
                                                                </span>
                                                            ))}
                                                        {(!member.roleIds || member.roleIds.length === 0) && member.communityRole === 'member' && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#232428] border border-[#1e1f22] text-[11px] font-medium text-[#949ba4]">
                                                                @everyone
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex justify-end md:justify-end md:col-span-1">
                                                        {member._id !== user?._id && (
                                                            <div className="relative">
                                                                <button
                                                                    onClick={() => setOpenMemberMenuId((prev) => prev === member._id ? null : member._id)}
                                                                    className="w-8 h-8 rounded-md bg-discord-darkest flex items-center justify-center hover:bg-discord-border-light/40"
                                                                    title="Member actions"
                                                                >
                                                                    <MoreVertical className="w-4 h-4 text-discord-faint" />
                                                                </button>
                                                                {openMemberMenuId === member._id && (
                                                                    <div className="absolute right-0 mt-2 w-36 rounded-xl bg-discord-darker border border-discord-border/60 shadow-2xl overflow-hidden z-[60]">
                                                                        {canManageRoles && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    openAssignRoles(member);
                                                                                    setOpenMemberMenuId(null);
                                                                                }}
                                                                                className="w-full text-left px-3 py-2 text-sm text-discord-white hover:bg-discord-border-light/15"
                                                                            >
                                                                                Assign Roles
                                                                            </button>
                                                                        )}
                                                                        {canManage && member.communityRole !== 'admin' && (
                                                                            <button
                                                                                onClick={async () => {
                                                                                    try {
                                                                                        const nextRole = member.communityRole === 'moderator' ? 'member' : 'moderator';
                                                                                        await updateRole(activeCommunityId, member._id, nextRole);
                                                                                    } catch { }
                                                                                    setOpenMemberMenuId(null);
                                                                                }}
                                                                                className="w-full text-left px-3 py-2 text-sm text-discord-white hover:bg-discord-border-light/15"
                                                                            >
                                                                                {member.communityRole === 'moderator' ? 'Remove Moderator' : 'Make Moderator'}
                                                                            </button>
                                                                        )}
                                                                        {canManage && member.communityRole !== 'admin' && (
                                                                            <button
                                                                                onClick={async () => {
                                                                                    setPendingKickMember(member);
                                                                                    setOpenMemberMenuId(null);
                                                                                }}
                                                                                className="w-full text-left px-3 py-2 text-sm text-[#f2f3f5] hover:bg-discord-border-light/15"
                                                                            >
                                                                                Kick
                                                                            </button>
                                                                        )}
                                                                        {canModerateTab && member.communityRole !== 'admin' && (
                                                                            <button
                                                                                onClick={async () => {
                                                                                    try {
                                                                                        await banMember(activeCommunityId, member._id);
                                                                                        setOpenMemberMenuId(null);
                                                                                    } catch (err) {
                                                                                        console.error("Ban failed:", err);
                                                                                    }
                                                                                }}
                                                                                className="w-full text-left px-3 py-2 text-sm text-discord-red hover:bg-discord-border-light/15"
                                                                            >
                                                                                Ban
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {membersError && (
                                        <div className="text-sm text-discord-red">{membersError}</div>
                                    )}
                                </div>
                            ) : activeSettingsTab === 'invites' ? (
                                <div className="space-y-4">
                                    <div className="rounded-xl border border-discord-border/40 overflow-visible">
                                        <div className="hidden md:grid grid-cols-[2fr_1.6fr_1fr_0.8fr] gap-4 px-4 py-3 bg-discord-darkest/80 text-[11px] font-semibold uppercase tracking-[0.12em] text-discord-faint">
                                            <div>Requester</div>
                                            <div>Message</div>
                                            <div>Requested</div>
                                            <div className="text-right">Actions</div>
                                        </div>
                                        <div className="divide-y divide-discord-border/30">
                                            {isInviteRequestsLoading && (
                                                <div className="px-4 py-6 text-xs text-discord-faint">Loading invite requests...</div>
                                            )}
                                            {!isInviteRequestsLoading && inviteRequests.length === 0 && (
                                                <div className="px-4 py-6 text-xs text-discord-faint">No invite requests yet.</div>
                                            )}
                                            {!isInviteRequestsLoading && inviteRequests.map((request) => (
                                                <div key={request._id} className="grid md:grid-cols-[2fr_1.6fr_1fr_0.8fr] gap-2 md:gap-4 px-4 py-3 items-center bg-discord-darker/40">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-discord-darkest flex items-center justify-center overflow-hidden text-sm font-semibold">
                                                            {(request.requesterName || 'U').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-discord-white">{request.requesterName || 'Member'}</p>
                                                            <p className="text-[11px] text-discord-faint">{request.requesterEmail}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-[11px] text-discord-faint md:text-sm md:text-discord-light">
                                                        {request.message ? request.message : '—'}
                                                    </div>
                                                    <div className="text-[11px] text-discord-faint md:text-sm md:text-discord-light">
                                                        {formatDate(request.createdAt)}
                                                    </div>
                                                    <div className="flex justify-end items-center gap-2">
                                                        {request.status === 'pending' ? (
                                                            <>
                                                                <button
                                                                    onClick={async () => {
                                                                        try { await approveRequest(activeCommunityId, request._id); } catch { }
                                                                    }}
                                                                    disabled={isInviteRequestsLoading}
                                                                    className="px-3 py-1.5 rounded-md bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                                                                >
                                                                    Approve
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        try { await rejectRequest(activeCommunityId, request._id); } catch { }
                                                                    }}
                                                                    disabled={isInviteRequestsLoading}
                                                                    className="px-3 py-1.5 rounded-md bg-discord-darkest text-xs font-semibold text-discord-light hover:bg-discord-border-light/30 disabled:opacity-60"
                                                                >
                                                                    Reject
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${request.status === 'approved' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
                                                                }`}>
                                                                {request.status}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {inviteRequestsError && (
                                        <div className="text-sm text-discord-red">{inviteRequestsError}</div>
                                    )}
                                </div>
                            ) : activeSettingsTab === 'bans' ? (
                                <div className="space-y-4">
                                    <div className="rounded-xl border border-discord-border/40 overflow-visible">
                                        <div className="hidden md:grid grid-cols-[2fr_1.6fr_1fr] gap-4 px-4 py-3 bg-discord-darkest/80 text-[11px] font-semibold uppercase tracking-[0.12em] text-discord-faint">
                                            <div>User</div>
                                            <div>Reason</div>
                                            <div className="text-right">Actions</div>
                                        </div>
                                        <div className="divide-y divide-discord-border/30">
                                            {/* I'll need a state for banned users list */}
                                            {bannedUsers.length === 0 && (
                                                <div className="px-4 py-6 text-xs text-discord-faint text-center">No banned users found.</div>
                                            )}
                                            {bannedUsers.map((ban) => (
                                                <div key={ban.userId?._id} className="grid md:grid-cols-[2fr_1.6fr_1fr] gap-2 md:gap-4 px-4 py-3 items-center bg-discord-darker/40">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-discord-darkest flex items-center justify-center overflow-hidden">
                                                            {(ban.userId?.name || 'U').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-discord-white">{ban.userId?.name || 'User'}</p>
                                                            <p className="text-[10px] text-discord-faint">Banned by {ban.executor?.name || 'Admin'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-discord-light">
                                                        {ban.reason || 'No reason provided'}
                                                    </div>
                                                    <div className="flex justify-end">
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    await unbanMember(activeCommunityId, ban.userId?._id);
                                                                    setBannedUsers(prev => prev.filter(b => b.userId?._id !== ban.userId?._id));
                                                                } catch (err) { }
                                                            }}
                                                            className="px-3 py-1.5 rounded-md bg-discord-darkest text-xs font-semibold text-discord-white hover:bg-discord-border-light/30 transition"
                                                        >
                                                            Revoke Ban
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : activeSettingsTab === 'auditLog' ? (
                                <div className="-mt-2">
                                    {isLogsLoading ? (
                                        <div className="text-sm text-discord-faint px-4 py-8 text-center bg-discord-darkest/30 rounded-lg border border-discord-border/30 border-dashed">
                                            Loading audit logs...
                                        </div>
                                    ) : auditLogs.length === 0 ? (
                                        <div className="text-sm text-discord-faint px-4 py-8 text-center bg-discord-darkest/30 rounded-lg border border-discord-border/30 border-dashed">
                                            No recent actions found.
                                        </div>
                                    ) : (
                                        <div className="border border-[#3f4147] rounded-lg overflow-hidden divide-y divide-[#3f4147]">
                                            {auditLogs.map((log) => (
                                                <div key={log._id} className="flex gap-4 px-4 py-4 bg-[#2b2d31] items-center">
                                                    <div className="shrink-0 relative mt-0.5">
                                                        {log.moderatorId?.avatar ? (
                                                            <img src={log.moderatorId.avatar} alt="avatar" className="w-8 h-8 rounded-full" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-[#1e1f22] flex items-center justify-center text-[10px] font-bold text-white uppercase">
                                                                {(log.moderatorId?.name || 'M')[0]}
                                                            </div>
                                                        )}
                                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#1e1f22] flex items-center justify-center shadow-md">
                                                            <Users className="w-2.5 h-2.5 text-[#f23f42]" />
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                        <div className="text-[13.5px] text-[#dbdee1] leading-tight flex flex-wrap gap-1">
                                                            {formatAuditLog(log)}
                                                        </div>
                                                        <div className="text-[11px] text-[#949ba4] mt-0.5">
                                                            {new Date(log.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : activeSettingsTab === 'roles' ? (
                                <div className="space-y-6">
                                    <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex items-center justify-between">
                                        <span className="font-semibold">Messaging permissions have changed</span>
                                    </div>

                                    <div className="rounded-xl border border-discord-border/40 bg-discord-darkest/60 px-4 py-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-sm font-semibold text-discord-white">Default Permissions</h3>
                                                <p className="text-xs text-discord-faint">@everyone • applies to all server members</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="relative w-full max-w-md">
                                            <input
                                                value={roleQuery}
                                                onChange={(e) => setRoleQuery(e.target.value)}
                                                placeholder="Search Roles"
                                                className="w-full bg-discord-darkest/70 border border-discord-border/50 rounded-lg px-3 py-2 text-sm text-discord-white placeholder:text-discord-faint/60 focus:outline-none focus:ring-2 focus:ring-blurple"
                                            />
                                        </div>
                                        <button
                                            onClick={openCreateRole}
                                            className="px-4 py-2 rounded-md bg-blurple text-white text-sm font-semibold hover:bg-blurple/90 transition"
                                        >
                                            Create Role
                                        </button>
                                    </div>
                                    <p className="text-xs text-discord-faint">
                                        Members use the color of the highest role they have on this list. Drag roles to reorder them.
                                    </p>

                                    <div className="rounded-xl border border-discord-border/40 overflow-visible">
                                        <div className="grid grid-cols-[2fr_0.8fr_0.6fr] gap-4 px-4 py-3 bg-discord-darkest/80 text-[11px] font-semibold uppercase tracking-[0.12em] text-discord-faint">
                                            <div>Roles - {roles.length}</div>
                                            <div>Members</div>
                                            <div className="text-right">Actions</div>
                                        </div>
                                        <div className="divide-y divide-discord-border/30">
                                            {isRolesLoading && (
                                                <div className="px-4 py-6 text-xs text-discord-faint">Loading roles...</div>
                                            )}
                                            {!isRolesLoading && filteredRoles.length === 0 && (
                                                <div className="px-4 py-6 text-xs text-discord-faint">No roles found.</div>
                                            )}
                                            {!isRolesLoading && filteredRoles.map((role) => (
                                                <div key={role._id} className="grid grid-cols-[2fr_0.8fr_0.6fr] gap-4 px-4 py-3 items-center bg-discord-darker/40 overflow-visible">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-discord-darkest flex items-center justify-center text-sm font-semibold">
                                                            {(role.name || 'R').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-discord-white">{role.name}</p>
                                                            <p className="text-[11px] text-discord-faint">Custom role</p>
                                                            <div className="flex items-center gap-2">
                                                                <div
                                                                    className="w-3 h-3 rounded-full border border-discord-border/50 shadow-sm"
                                                                    style={{ backgroundColor: role.color || '#99aab5' }}
                                                                />
                                                                <span className="text-sm font-semibold text-discord-white truncate" style={{ color: role.color || '#f2f3f5' }}>
                                                                    {role.name}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-sm text-discord-light flex items-center gap-2">
                                                        <span>{role.memberCount ?? 0}</span>
                                                    </div>
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => openEditRole(role)}
                                                            className="p-1.5 rounded-md text-discord-faint hover:bg-discord-border-light/15 hover:text-discord-white transition"
                                                            title="Edit Role"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                            </svg>
                                                        </button>
                                                        <div className="flex flex-col">
                                                            <button
                                                                onClick={async () => {
                                                                    const idx = roles.findIndex(r => r._id === role._id);
                                                                    if (idx === 0) return;
                                                                    const newRoles = [...roles];
                                                                    const temp = newRoles[idx - 1].position;
                                                                    newRoles[idx - 1].position = newRoles[idx].position;
                                                                    newRoles[idx].position = temp;
                                                                    const updates = newRoles.map(r => ({ _id: r._id, position: r.position }));
                                                                    await reorderRoles(activeCommunityId, updates);
                                                                }}
                                                                className="p-1 rounded-md text-discord-faint hover:text-discord-white transition"
                                                                title="Move Up"
                                                            >
                                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    const idx = roles.findIndex(r => r._id === role._id);
                                                                    if (idx === roles.length - 1) return;
                                                                    const newRoles = [...roles];
                                                                    const temp = newRoles[idx + 1].position;
                                                                    newRoles[idx + 1].position = newRoles[idx].position;
                                                                    newRoles[idx].position = temp;
                                                                    const updates = newRoles.map(r => ({ _id: r._id, position: r.position }));
                                                                    await reorderRoles(activeCommunityId, updates);
                                                                }}
                                                                className="p-1 rounded-md text-discord-faint hover:text-discord-white transition"
                                                                title="Move Down"
                                                            >
                                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                        <div className="relative">
                                                            <button
                                                                onClick={() => setOpenRoleMenuId((prev) => prev === role._id ? null : role._id)}
                                                                className="w-9 h-9 rounded-md bg-discord-darkest flex items-center justify-center hover:bg-discord-border-light/40"
                                                                title="Role actions"
                                                            >
                                                                <MoreVertical className="w-4 h-4 text-discord-faint" />
                                                            </button>
                                                            {openRoleMenuId === role._id && (
                                                                <div className="absolute right-0 mt-2 w-36 rounded-xl bg-discord-darker border border-discord-border/60 shadow-2xl overflow-hidden z-[60]">
                                                                    <button
                                                                        onClick={() => {
                                                                            handleDeleteRole(role._id);
                                                                            setOpenRoleMenuId(null);
                                                                        }}
                                                                        className="w-full text-left px-3 py-2 text-sm text-discord-red hover:bg-discord-border-light/15"
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-12">
                                    {/* Form */}
                                    <div className="space-y-0 pb-32">
                                        <div className="mb-8">
                                            <h2 className="text-[20px] font-bold text-white mb-2">Server Profile</h2>
                                            <p className="text-[14px] text-[#b5bac1] leading-relaxed">
                                                Customize how your server appears in invite links and, if enabled, in Server Discovery and Announcement Channel messages
                                            </p>
                                        </div>

                                        <section>
                                            <label className="block text-[12px] font-bold uppercase tracking-wider text-[#949ba4] mb-3">Name</label>
                                            <input
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="w-full bg-[#1e1f22] border border-transparent rounded-[4px] px-3 py-2.5 text-[15px] text-[#dbdee1] focus:outline-none focus:border-[#5865f2] transition-colors"
                                                placeholder="Enter server name"
                                                disabled={!canManage}
                                            />
                                        </section>

                                        <div className="h-[1px] bg-[rgba(255,255,255,0.06)] my-8" />

                                        <section>
                                            <label className="block text-[12px] font-bold uppercase tracking-wider text-[#949ba4] mb-2">Icon</label>
                                            <p className="text-[12px] text-[#949ba4] mb-4">We recommend an image of at least 512x512.</p>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={handlePickIcon}
                                                    disabled={!canManage}
                                                    className="px-4 py-2 rounded-[3px] bg-[#5865f2] text-white text-[14px] font-medium hover:bg-[#4752c4] transition-colors disabled:opacity-50"
                                                >
                                                    Change Server Icon
                                                </button>
                                                {icon && (
                                                    <button
                                                        onClick={() => setIcon('')}
                                                        className="text-[14px] text-[#dbdee1] hover:text-white hover:underline transition-colors"
                                                    >
                                                        Remove Icon
                                                    </button>
                                                )}
                                                <input ref={fileRef} type="file" accept="image/*" onChange={handleIconChange} className="hidden" />
                                            </div>
                                        </section>

                                        <div className="h-[1px] bg-[rgba(255,255,255,0.06)] my-8" />

                                        <section>
                                            <label className="block text-[12px] font-bold uppercase tracking-wider text-[#949ba4] mb-4">Banner</label>
                                            <div className="grid grid-cols-5 gap-2.5">
                                                {bannerOptions.map((opt) => (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => setBannerColor(opt.value)}
                                                        disabled={!canManage}
                                                        className={`w-full aspect-[2/1] rounded-[8px] border-2 ${bannerColor === opt.value ? 'border-white' : 'border-transparent'} transition-all shadow-md`}
                                                        style={{ background: opt.value }}
                                                        title={opt.label}
                                                    />
                                                ))}
                                                {/* Filler to match image's 2x5 grid if needed, though we have 7 options */}
                                                {[...Array(3)].map((_, i) => (
                                                    <div key={i} className="w-full aspect-[2/1] rounded-[8px] bg-[#2b2d31] opacity-50" />
                                                ))}
                                            </div>
                                        </section>

                                        <div className="h-[1px] bg-[rgba(255,255,255,0.06)] my-8" />

                                        <section>
                                            <label className="block text-[12px] font-bold uppercase tracking-wider text-[#949ba4] mb-2">Traits</label>
                                            <p className="text-[13px] text-[#949ba4] mb-5">Add up to 5 traits to show off your server's interests and personality.</p>
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-3 gap-3">
                                                    {[0, 1, 2].map((idx) => (
                                                        <div key={idx} className="relative group">
                                                            <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                                                <Smile className="w-4 h-4 text-[#b5bac1] opacity-70" />
                                                            </div>
                                                            <input
                                                                value={traits[idx] || ''}
                                                                onChange={(e) => {
                                                                    const newTraits = [...traits];
                                                                    newTraits[idx] = e.target.value;
                                                                    setTraits(newTraits);
                                                                }}
                                                                className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-[8px] pl-10 pr-3 py-2.5 text-[14px] text-[#dbdee1] focus:outline-none focus:border-[#5865f2] transition-colors"
                                                                disabled={!canManage}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="grid grid-cols-2 gap-3 w-2/3">
                                                    {[3, 4].map((idx) => (
                                                        <div key={idx} className="relative group">
                                                            <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                                                <Smile className="w-4 h-4 text-[#b5bac1] opacity-70" />
                                                            </div>
                                                            <input
                                                                value={traits[idx] || ''}
                                                                onChange={(e) => {
                                                                    const newTraits = [...traits];
                                                                    newTraits[idx] = e.target.value;
                                                                    setTraits(newTraits);
                                                                }}
                                                                className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-[8px] pl-10 pr-3 py-2.5 text-[14px] text-[#dbdee1] focus:outline-none focus:border-[#5865f2] transition-colors"
                                                                disabled={!canManage}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </section>

                                        <div className="h-[1px] bg-[rgba(255,255,255,0.06)] my-8" />

                                        <section>
                                            <label className="block text-[12px] font-bold uppercase tracking-wider text-[#949ba4] mb-2">Description</label>
                                            <p className="text-[13px] text-[#949ba4] mb-4">How did your server get started? Why should people join?</p>
                                            <textarea
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                rows={5}
                                                className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-[8px] px-4 py-3 text-[15px] text-[#dbdee1] focus:outline-none focus:border-[#5865f2] transition-colors resize-none"
                                                placeholder="Tell the world a bit about this server."
                                                disabled={!canManage}
                                            />
                                        </section>
                                    </div>

                                    {/* Preview Card */}
                                    <div className="relative hidden lg:block">
                                        <div className="sticky top-12 flex justify-center">
                                            <div className="w-[300px] bg-[#111214] rounded-2xl overflow-hidden shadow-2xl border border-[#ffffff08]">
                                                {/* Card Header/Banner */}
                                                <div className="h-[100px] relative" style={{ background: previewBanner }}>
                                                    <div className="absolute -bottom-6 left-4">
                                                        <div className="w-[70px] h-[70px] rounded-[18px] bg-[#111214] border-[4px] border-[#111214] flex items-center justify-center overflow-hidden shadow-xl">
                                                            {icon ? (
                                                                <img src={icon} alt="Preview icon" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full bg-[#2b2d31] flex items-center justify-center text-xl font-bold text-white uppercase">
                                                                    {(name || 'S').charAt(0)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Card Body */}
                                                <div className="pt-8 px-4 pb-5">
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <h3 className="text-[15px] font-bold text-white truncate">
                                                            {name || 'Server Name'}
                                                        </h3>
                                                        <Globe className="w-3.5 h-3.5 text-white opacity-90" />
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-1 text-[11px] font-semibold text-[#b5bac1] mb-3">
                                                        <div className="w-[6px] h-[6px] rounded-full bg-[#23a559]" />
                                                        <span>1 Online</span>
                                                        <div className="w-[3px] h-[3px] rounded-full bg-[#949ba4] mx-0.5" />
                                                        <span>{communityProfile?.membersCount || 18} Members</span>
                                                    </div>

                                                    <div className="text-[11px] font-bold text-[#949ba4] uppercase tracking-wider mt-4">
                                                        {estLabel}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Floating Save Bar */}
                        {isDirty && (
                            <div className="fixed bottom-0 left-0 right-0 md:left-auto md:right-[50%] md:translate-x-[50%] z-[100] px-4 pb-4 animate-slide-up">
                                <div className="max-w-[740px] w-full bg-[#111214] rounded-lg shadow-2xl border border-[#ffffff08] p-4 flex items-center justify-between">
                                    <p className="text-[15px] font-medium text-white">Careful — you have unsaved changes!</p>
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={handleReset}
                                            className="text-[14px] font-medium text-[#dbdee1] hover:underline"
                                        >
                                            Reset
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={isSaving}
                                            className="px-4 py-2 bg-[#23a559] hover:bg-[#1a7a42] text-white text-[14px] font-medium rounded-[3px] transition-colors disabled:opacity-50"
                                        >
                                            {isSaving ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </main>
                </div>
            </div>
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)}>
                    <div
                        className="w-[520px] max-w-[92vw] rounded-2xl bg-[#2b2d31] border border-discord-border/50 shadow-2xl p-6 animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-white">Delete '{communityProfile?.name}'</h2>
                                <p className="text-sm text-discord-muted mt-2">
                                    Are you sure you want to delete {communityProfile?.name}? This action cannot be undone.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="w-8 h-8 rounded-full bg-discord-darkest flex items-center justify-center hover:bg-discord-border-light/40 cursor-pointer"
                            >
                                <X className="w-4 h-4 text-discord-faint" />
                            </button>
                        </div>

                        <div className="mt-5">
                            <label className="block text-sm font-semibold mb-2">Enter server name</label>
                            <input
                                value={deleteName}
                                onChange={(e) => setDeleteName(e.target.value)}
                                className="w-full bg-discord-darkest/70 border border-discord-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                placeholder={communityProfile?.name || 'Server name'}
                            />
                        </div>

                        <div className="mt-6 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="px-5 py-2 rounded-lg bg-discord-border-light/30 text-sm font-semibold text-discord-white hover:bg-discord-border-light/50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteServer}
                                disabled={deleteName.trim() !== communityProfile?.name || isDeleting}
                                className="px-5 py-2 rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                            >
                                {isDeleting ? 'Deleting...' : 'Delete Server'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {pendingKickMember && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPendingKickMember(null)}>
                    <div
                        className="w-[520px] max-w-[92vw] rounded-2xl bg-[#2b2d31] border border-discord-border/50 shadow-2xl p-6 animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-white">Kick {pendingKickMember.name}?</h2>
                                <p className="text-sm text-discord-muted mt-2">
                                    Are you sure you want to remove {pendingKickMember.name} from this server?
                                </p>
                            </div>
                            <button
                                onClick={() => setPendingKickMember(null)}
                                className="w-8 h-8 rounded-full bg-discord-darkest flex items-center justify-center hover:bg-discord-border-light/40 cursor-pointer"
                            >
                                <X className="w-4 h-4 text-discord-faint" />
                            </button>
                        </div>

                        <div className="mt-6 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setPendingKickMember(null)}
                                className="px-5 py-2 rounded-lg bg-discord-border-light/30 text-sm font-semibold text-discord-white hover:bg-discord-border-light/50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmKick}
                                disabled={isKicking}
                                className="px-5 py-2 rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                            >
                                {isKicking ? 'Kicking...' : 'Kick Member'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showRoleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowRoleModal(false)}>
                    <div
                        className="w-[920px] max-w-[95vw] max-h-[90vh] overflow-hidden rounded-2xl bg-[#2b2d31] border border-discord-border/50 shadow-2xl animate-scale-in flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-discord-border/40">
                            <div>
                                <h2 className="text-lg font-bold text-white">
                                    {editingRole ? `Edit Role — ${editingRole.name}` : 'Edit Role — New Role'}
                                </h2>
                                <p className="text-xs text-discord-faint mt-1">Use roles to group members and assign permissions.</p>
                            </div>
                            <button
                                onClick={() => setShowRoleModal(false)}
                                className="w-8 h-8 rounded-full bg-discord-darkest flex items-center justify-center hover:bg-discord-border-light/40"
                            >
                                <X className="w-4 h-4 text-discord-faint" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-5">
                            <div className="flex items-center gap-6 border-b border-discord-border/40 mb-6 sticky top-0 bg-[#2b2d31] z-10">
                                <button
                                    onClick={() => setRoleTab('display')}
                                    className={`pb-3 text-sm font-semibold transition-colors ${roleTab === 'display' ? 'text-white border-b-2 border-white' : 'text-discord-faint hover:text-[#dbdee1]'
                                        }`}
                                >
                                    Display
                                </button>
                                <button
                                    onClick={() => setRoleTab('permissions')}
                                    className={`pb-3 text-sm font-semibold transition-colors ${roleTab === 'permissions' ? 'text-white border-b-2 border-white' : 'text-discord-faint hover:text-[#dbdee1]'
                                        }`}
                                >
                                    Permissions
                                </button>
                                {editingRole && (
                                    <button
                                        onClick={() => setRoleTab('members')}
                                        className={`pb-3 text-sm font-semibold transition-colors ${roleTab === 'members' ? 'text-white border-b-2 border-white' : 'text-discord-faint hover:text-[#dbdee1]'
                                            }`}
                                    >
                                        Manage Members
                                    </button>
                                )}
                            </div>

                            {roleTab === 'display' && (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-semibold mb-2">Role Name</label>
                                        <input
                                            value={roleName}
                                            onChange={(e) => setRoleName(e.target.value)}
                                            className="w-full bg-discord-darkest/70 border border-discord-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blurple"
                                            placeholder="Enter role name"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold mb-3">Role Color</label>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {['#99aab5', '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#e91e63', '#f1c40f', '#e67e22', '#e74c3c', '#95a5a6', '#607d8b'].map(c => (
                                                <button
                                                    key={c}
                                                    onClick={() => setRoleColor(c)}
                                                    className={`w-10 h-10 rounded-lg border-2 transition ${roleColor === c ? 'border-white' : 'border-transparent'}`}
                                                    style={{ backgroundColor: c }}
                                                />
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="relative flex-1">
                                                <input
                                                    value={roleColor}
                                                    onChange={(e) => setRoleColor(e.target.value)}
                                                    className="w-full bg-discord-darkest/70 border border-discord-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blurple"
                                                    placeholder="#HEX"
                                                />
                                            </div>
                                            <div className="w-10 h-10 rounded-lg border border-discord-border/50" style={{ backgroundColor: roleColor }} />
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-4 border-t border-discord-border/30">
                                        <div className="flex items-start justify-between gap-6">
                                            <div>
                                                <h3 className="text-sm font-semibold text-discord-white">Display role members separately from online members</h3>
                                                <p className="text-xs text-discord-faint mt-1">Discord calls this "Hoist". It helps visualize hierarchy in the sidebar.</p>
                                            </div>
                                            <label className="inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={roleHoist}
                                                    onChange={() => setRoleHoist(!roleHoist)}
                                                    className="sr-only"
                                                />
                                                <span className={`w-12 h-6 rounded-full transition ${roleHoist ? 'bg-blurple' : 'bg-discord-border/60'} relative`}>
                                                    <span className={`absolute top-0.5 ${roleHoist ? 'left-6' : 'left-1'} w-5 h-5 rounded-full bg-white transition`} />
                                                </span>
                                            </label>
                                        </div>

                                        <div className="flex items-start justify-between gap-6">
                                            <div>
                                                <h3 className="text-sm font-semibold text-discord-white">Allow anyone to @mention this role</h3>
                                                <p className="text-xs text-discord-faint mt-1">If enabled, any member can alert all people with this role.</p>
                                            </div>
                                            <label className="inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={roleMentionable}
                                                    onChange={() => setRoleMentionable(!roleMentionable)}
                                                    className="sr-only"
                                                />
                                                <span className={`w-12 h-6 rounded-full transition ${roleMentionable ? 'bg-blurple' : 'bg-discord-border/60'} relative`}>
                                                    <span className={`absolute top-0.5 ${roleMentionable ? 'left-6' : 'left-1'} w-5 h-5 rounded-full bg-white transition`} />
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {roleTab === 'permissions' && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="relative w-full max-w-md">
                                            <input
                                                value={permissionQuery}
                                                onChange={(e) => setPermissionQuery(e.target.value)}
                                                placeholder="Search permissions"
                                                className="w-full bg-discord-darkest/70 border border-discord-border/50 rounded-lg px-3 py-2 text-sm text-discord-white placeholder:text-discord-faint/60 focus:outline-none focus:ring-2 focus:ring-blurple"
                                            />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => {
                                                    const preset = {};
                                                    rolePermissionOptions.forEach((perm) => {
                                                        preset[perm.key] = true;
                                                    });
                                                    setRolePerms(preset);
                                                }}
                                                className="text-sm text-discord-light font-semibold hover:text-discord-white"
                                            >
                                                Moderator preset
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const cleared = {};
                                                    rolePermissionOptions.forEach((perm) => {
                                                        cleared[perm.key] = false;
                                                    });
                                                    setRolePerms(cleared);
                                                }}
                                                className="text-sm text-blurple font-semibold hover:underline"
                                            >
                                                Clear permissions
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        {filteredPermissionOptions.map((perm) => (
                                            <div key={perm.key} className="flex items-start justify-between gap-6 border-b border-discord-border/40 pb-4">
                                                <div>
                                                    <h3 className="text-sm font-semibold text-discord-white">{perm.label}</h3>
                                                    <p className="text-xs text-discord-faint mt-1">{perm.description}</p>
                                                </div>
                                                <label className="inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!rolePerms[perm.key]}
                                                        onChange={() => setRolePerms((prev) => ({ ...prev, [perm.key]: !prev[perm.key] }))}
                                                        className="sr-only"
                                                    />
                                                    <span className={`w-12 h-6 rounded-full transition ${rolePerms[perm.key] ? 'bg-blurple' : 'bg-discord-border/60'} relative`}>
                                                        <span className={`absolute top-0.5 ${rolePerms[perm.key] ? 'left-6' : 'left-1'} w-5 h-5 rounded-full bg-white transition`} />
                                                    </span>
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {roleTab === 'members' && editingRole && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Members With This Role</h3>
                                        <span className="text-xs text-discord-faint uppercase font-bold">
                                            {members.filter(m => m.roleIds?.includes(editingRole._id)).length} Members
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        {members.filter(m => m.roleIds?.includes(editingRole._id)).map(m => (
                                            <div key={m._id} className="flex items-center justify-between p-2 rounded-md hover:bg-white/5 group transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-discord-darkest flex items-center justify-center overflow-hidden">
                                                        {m.avatar ? <img src={m.avatar} alt="" className="w-full h-full object-cover" /> : (m.name || 'U').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-[#dbdee1]">{m.name}</p>
                                                        <p className="text-[10px] text-discord-faint">{m.email}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        const newRoles = m.roleIds.filter(id => id !== editingRole._id);
                                                        await updateRoles(activeCommunityId, m._id, newRoles);
                                                    }}
                                                    className="p-1 rounded-md text-discord-faint hover:bg-red-500/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                                    title="Remove Role"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                        {members.filter(m => m.roleIds?.includes(editingRole._id)).length === 0 && (
                                            <div className="py-12 text-center flex flex-col items-center gap-4">
                                                <div className="w-16 h-16 rounded-full bg-discord-darkest flex items-center justify-center">
                                                    <Users className="w-8 h-8 text-discord-faint opacity-50" />
                                                </div>
                                                <div className="max-w-[200px]">
                                                    <p className="text-sm font-semibold text-[#949ba4]">No members joined this role yet.</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-discord-border/40 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setShowRoleModal(false)}
                                className="px-5 py-2 rounded-lg bg-discord-border-light/30 text-sm font-semibold text-discord-white hover:bg-discord-border-light/50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveRole}
                                className="px-5 py-2 rounded-lg bg-blurple text-sm font-semibold text-white hover:bg-blurple/90"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showAssignModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAssignModal(false)}>
                    <div
                        className="w-[520px] max-w-[92vw] rounded-2xl bg-[#2b2d31] border border-discord-border/50 shadow-2xl p-6 animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-white">Assign roles</h2>
                                <p className="text-sm text-discord-muted mt-2">
                                    Choose roles for {assignMember?.name || 'member'}.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowAssignModal(false)}
                                className="w-8 h-8 rounded-full bg-discord-darkest flex items-center justify-center hover:bg-discord-border-light/40 cursor-pointer"
                            >
                                <X className="w-4 h-4 text-discord-faint" />
                            </button>
                        </div>

                        <div className="mt-5 space-y-3 max-h-[40vh] overflow-y-auto pr-2">
                            {roles.length === 0 && (
                                <div className="text-sm text-discord-faint">No roles available yet.</div>
                            )}
                            {roles.map((role) => (
                                <label key={role._id} className="flex items-center justify-between gap-4 px-3 py-2 rounded-lg bg-discord-darkest/70 border border-discord-border/40">
                                    <div className="text-sm font-semibold text-discord-white">{role.name}</div>
                                    <input
                                        type="checkbox"
                                        checked={assignRoleIds.includes(role._id?.toString?.() || String(role._id))}
                                        onChange={() => {
                                            const roleIdValue = role._id?.toString?.() || String(role._id);
                                            setAssignRoleIds((prev) => (
                                                prev.includes(roleIdValue)
                                                    ? prev.filter((id) => id !== roleIdValue)
                                                    : [...prev, roleIdValue]
                                            ));
                                        }}
                                        className="w-4 h-4 accent-blurple"
                                    />
                                </label>
                            ))}
                        </div>

                        <div className="mt-6 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setShowAssignModal(false)}
                                className="px-5 py-2 rounded-lg bg-discord-border-light/30 text-sm font-semibold text-discord-white hover:bg-discord-border-light/50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAssignRoles}
                                className="px-5 py-2 rounded-lg bg-blurple text-sm font-semibold text-white hover:bg-blurple/90"
                            >
                                Save Roles
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {actionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setActionModal(null)}>
                    <div
                        className="w-[520px] max-w-[92vw] rounded-2xl bg-[#2b2d31] border border-discord-border/50 shadow-2xl p-6 animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-2xl font-bold text-white">
                                    {actionModal.type === 'dismiss' ? 'Dismiss Report' :
                                        actionModal.type === 'delete_post' ? 'Delete Post' :
                                            actionModal.type === 'delete_message' ? 'Delete Message' :
                                                actionModal.type === 'blocklist' ? 'Add to Blocklist' :
                                                    actionModal.type === 'warn' ? 'Warn Member' :
                                                        actionModal.type === 'suspend' ? 'Suspend Member' :
                                                            actionModal.type === 'ban' ? 'Ban Member' :
                                                                'Kick Member'}
                                </h2>
                                <p className="text-sm text-discord-muted mt-2">
                                    {actionModal.type === 'dismiss'
                                        ? 'This will remove the report from the queue.'
                                        : actionModal.type === 'blocklist'
                                            ? 'Add the selected value to the server blocklist.'
                                            : 'Add an optional reason for this action.'}
                                </p>
                            </div>
                            <button
                                onClick={() => setActionModal(null)}
                                className="w-8 h-8 rounded-full bg-discord-darkest flex items-center justify-center hover:bg-discord-border-light/40 cursor-pointer"
                            >
                                <X className="w-4 h-4 text-discord-faint" />
                            </button>
                        </div>

                        {actionModal.type === 'suspend' && (
                            <div className="mt-4">
                                <label className="block text-sm font-semibold mb-2">Duration</label>
                                <select
                                    value={actionDuration}
                                    onChange={(e) => setActionDuration(e.target.value)}
                                    className="w-full bg-discord-darkest/70 border border-discord-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blurple"
                                >
                                    <option value="24h">24 hours</option>
                                    <option value="7d">7 days</option>
                                    <option value="30d">30 days</option>
                                </select>
                            </div>
                        )}

                        {actionModal.type === 'blocklist' && (
                            <div className="mt-4">
                                <label className="block text-sm font-semibold mb-2">Blocklist entry</label>
                                <input
                                    value={blocklistValue}
                                    onChange={(e) => setBlocklistValue(e.target.value)}
                                    className="w-full bg-discord-darkest/70 border border-discord-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blurple"
                                    placeholder="Text or URL to block"
                                />
                            </div>
                        )}

                        {actionModal.type !== 'dismiss' && (
                            <div className="mt-4">
                                <label className="block text-sm font-semibold mb-2">Reason (optional)</label>
                                <textarea
                                    value={actionReason}
                                    onChange={(e) => setActionReason(e.target.value)}
                                    rows={3}
                                    className="w-full bg-discord-darkest/70 border border-discord-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blurple resize-none"
                                    placeholder="Add a note for the moderation log"
                                />
                            </div>
                        )}

                        <div className="mt-6 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setActionModal(null)}
                                className="px-5 py-2 rounded-lg bg-discord-border-light/30 text-sm font-semibold text-discord-white hover:bg-discord-border-light/50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleModerationAction}
                                disabled={isActionBusy || (actionModal.type === 'blocklist' && !blocklistValue.trim())}
                                className={`px-5 py-2 rounded-lg text-sm font-semibold text-white ${actionModal.type === 'ban' ? 'bg-red-600 hover:bg-red-500' : 'bg-blurple hover:bg-blurple/90'} disabled:opacity-50`}
                            >
                                {isActionBusy ? 'Working...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ServerSettingsPage;

