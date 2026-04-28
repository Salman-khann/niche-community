import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Image as ImageIcon, Save, Shield, Trash2, MoreVertical, Pencil, Check, Users, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useCommunityStore } from '../stores/communityStore';
import { useMemberStore } from '../stores/memberStore';
import { useInviteRequestStore } from '../stores/inviteRequestStore';
import useSocket from '../hooks/useSocket';
import { useAuthStore } from '../stores/authStore';
import { useFeedStore } from '../stores/feedStore';
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
        return () => { cancelled = true; };
    }, [activeCommunityId, fetchCommunityProfile, fetchMembers, fetchInviteRequests, getBannedUsers]);

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

    const handleAddTrait = (value) => {
        const next = value.trim();
        if (!next || traits.includes(next) || traits.length >= 5) return;
        setTraits([...traits, next]);
        setTraitInput('');
    };

    const handleRemoveTrait = (value) => {
        setTraits(traits.filter((t) => t !== value));
    };

    useEffect(() => {
        if (!traitsInitRef.current) return;
    }, [traits]);

    const handleSave = async () => {
        if (!activeCommunityId || !canManage) return;
        setIsSaving(true);
        try {
            await updateCommunityProfile(activeCommunityId, {
                name,
                icon,
                bannerColor,
                traits,
                profileDescription: description,
                inviteRequestsEnabled: !!inviteRequestsEnabled
            });
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

    const previewBanner = bannerColor || bannerOptions[0].value;
    const previewTraits = traits.length > 0 ? traits : ['Community', 'Chat', 'Events'];
    const isRestricted = useMemo(() => {
        if (activeSettingsTab === 'profile') return !canEditServerProfile;
        if (activeSettingsTab === 'members') return !canManage;
        if (activeSettingsTab === 'invites') return !canReviewInvites;
        if (activeSettingsTab === 'roles') return !canManageRoles;
        if (activeSettingsTab === 'bans') return !canModerate;
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
                            <div className="flex flex-col">
                                {/* Server Name Header */}
                                <div className="px-2.5 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#949ba4] truncate">
                                    Admin Server
                                </div>
                                {canEditServerProfile && (
                                    <button
                                        onClick={() => setActiveSettingsTab('profile')}
                                        className={`w-full text-left px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium transition-colors mb-4 ${activeSettingsTab === 'profile'
                                            ? 'bg-[rgba(78,80,88,0.6)] text-white'
                                            : 'text-[#b5bac1] hover:bg-[rgba(78,80,88,0.3)] hover:text-[#dbdee1]'
                                            }`}
                                    >
                                        Server Profile
                                    </button>
                                )}

                                {/* People */}
                                <div className="px-2.5 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#949ba4]">People</div>
                                {canManage && (
                                    <button
                                        onClick={() => setActiveSettingsTab('members')}
                                        className={`w-full text-left px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium transition-colors mb-0.5 ${activeSettingsTab === 'members'
                                            ? 'bg-[rgba(78,80,88,0.6)] text-white'
                                            : 'text-[#b5bac1] hover:bg-[rgba(78,80,88,0.3)] hover:text-[#dbdee1]'
                                            }`}
                                    >
                                        Members
                                    </button>
                                )}
                                {canManageRoles && (
                                    <button
                                        onClick={() => setActiveSettingsTab('roles')}
                                        className={`w-full text-left px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium transition-colors mb-0.5 ${activeSettingsTab === 'roles'
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
                                        className={`w-full text-left px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium transition-colors mb-0.5 flex items-center justify-between ${activeSettingsTab === 'invites'
                                            ? 'bg-[rgba(78,80,88,0.6)] text-white'
                                            : 'text-[#b5bac1] hover:bg-[rgba(78,80,88,0.3)] hover:text-[#dbdee1]'
                                            }`}
                                    >
                                        <span>Invites</span>
                                        {notifications.requests > 0 && (
                                            <span className="min-w-[16px] h-[16px] px-1 rounded-full bg-[#f23f42] text-[10px] font-bold text-white flex items-center justify-center">
                                                {notifications.requests}
                                            </span>
                                        )}
                                    </button>
                                )}

                                <div className="h-[1px] bg-[rgba(255,255,255,0.06)] mx-2 mt-4 mb-2" />

                                {/* Moderation */}
                                <div className="px-2.5 pt-2 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#949ba4]">Moderation</div>
                                {canViewAuditLog && (
                                    <button
                                        onClick={() => setActiveSettingsTab('auditLog')}
                                        className={`w-full text-left px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium transition-colors mb-0.5 ${activeSettingsTab === 'auditLog'
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
                                        className={`w-full text-left px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium transition-colors mb-0.5 ${activeSettingsTab === 'bans'
                                            ? 'bg-[rgba(78,80,88,0.6)] text-white'
                                            : 'text-[#b5bac1] hover:bg-[rgba(78,80,88,0.3)] hover:text-[#dbdee1]'
                                            }`}
                                    >
                                        Bans
                                    </button>
                                )}

                                <div className="h-[1px] bg-[rgba(255,255,255,0.06)] mx-2 mt-4 mb-2" />

                                {canDeleteServer && (
                                    <button
                                        onClick={() => setShowDeleteModal(true)}
                                        className="w-full mt-1 flex items-center justify-between px-2.5 py-1.5 rounded-[4px] text-[15px] font-medium text-[#f23f42] hover:bg-[#f23f42] hover:text-white transition-colors group"
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
                                    {activeSettingsTab === 'profile' && (
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

                            {activeSettingsTab === 'members' ? (
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
                                <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8">
                                    {/* Form */}
                                    <div className="space-y-8">
                                        <div>
                                            <label className="block text-sm font-semibold mb-2">Name</label>
                                            <input
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="w-full bg-discord-darkest/70 border border-discord-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blurple"
                                                placeholder="Server name"
                                                disabled={!canManage}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold mb-2">Icon</label>
                                            <p className="text-xs text-discord-faint mb-3">We recommend an image of at least 512x512.</p>
                                            <div className="flex items-center gap-4">
                                                <div className="w-16 h-16 rounded-2xl bg-discord-darkest/70 border border-discord-border/50 flex items-center justify-center overflow-hidden">
                                                    {icon ? (
                                                        <img src={icon} alt="Server icon" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-lg font-bold">{(name || 'S').charAt(0).toUpperCase()}</span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={handlePickIcon}
                                                    disabled={!canManage}
                                                    className="px-4 py-2 rounded-md bg-blurple text-white text-sm font-semibold hover:bg-blurple/90 transition disabled:opacity-50"
                                                >
                                                    Change Server Icon
                                                </button>
                                                <input ref={fileRef} type="file" accept="image/*" onChange={handleIconChange} className="hidden" />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold mb-2">Banner</label>
                                            <div className="grid grid-cols-5 gap-3">
                                                {bannerOptions.map((opt) => (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => setBannerColor(opt.value)}
                                                        disabled={!canManage}
                                                        className={`h-12 rounded-lg border ${bannerColor === opt.value ? 'border-blurple' : 'border-discord-border/50'} transition`}
                                                        style={{ background: opt.value }}
                                                        title={opt.label}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold mb-2">Traits</label>
                                            <p className="text-xs text-discord-faint mb-3">Add up to 5 traits to show your server's personality.</p>
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                {traits.map((trait) => (
                                                    <span key={trait} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-discord-border-light/25 text-sm">
                                                        <span>{trait}</span>
                                                        {canManage && (
                                                            <button onClick={() => handleRemoveTrait(trait)} className="w-5 h-5 rounded-full bg-discord-border/50 text-discord-light hover:bg-discord-border/70">
                                                                ×
                                                            </button>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                            {canManage && (
                                                <input
                                                    value={traitInput}
                                                    onChange={(e) => setTraitInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleAddTrait(traitInput);
                                                        }
                                                    }}
                                                    className="w-full bg-discord-darkest/70 border border-discord-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blurple"
                                                    placeholder="Add a trait and press Enter"
                                                />
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold mb-2">Description</label>
                                            <textarea
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                rows={4}
                                                className="w-full bg-discord-darkest/70 border border-discord-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blurple resize-none"
                                                placeholder="How did your server get started? Why should people join?"
                                                disabled={!canManage}
                                            />
                                        </div>

                                        <div className="pt-4 border-t border-discord-border/30">
                                            <h3 className="text-sm font-semibold text-discord-white mb-3">Access Control</h3>
                                            <div className="flex items-center justify-between p-3 rounded-xl bg-discord-darkest/40 border border-discord-border/30">
                                                <div>
                                                    <p className="text-sm font-semibold text-discord-white">Enable Invite Requests</p>
                                                    <p className="text-xs text-discord-faint mt-1">Allow users to request access even if they don't have an invite code.</p>
                                                </div>
                                                <button
                                                    onClick={() => setInviteRequestsEnabled(!inviteRequestsEnabled)}
                                                    className={`w-12 h-6 rounded-full transition-colors relative ${inviteRequestsEnabled ? 'bg-discord-green' : 'bg-discord-faint/60'}`}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${inviteRequestsEnabled ? 'left-7' : 'left-1'}`} />
                                                </button>
                                            </div>
                                        </div>

                                        {(error || successMessage) && (
                                            <div className={`text-sm ${error ? 'text-discord-red' : 'text-emerald-400'}`}>
                                                {error || successMessage}
                                            </div>
                                        )}
                                    </div>

                                    {/* Preview */}
                                    <div className="bg-discord-darkest/70 border border-discord-border/50 rounded-2xl overflow-hidden">
                                        <div className="h-40" style={{ background: previewBanner }} />
                                        <div className="px-5 pb-5 -mt-8">
                                            <div className="w-16 h-16 rounded-2xl bg-discord-darkest/90 border border-discord-border/60 flex items-center justify-center overflow-hidden">
                                                {icon ? (
                                                    <img src={icon} alt="Server icon" className="w-full h-full object-cover" />
                                                ) : (
                                                    <ImageIcon className="w-6 h-6 text-discord-faint" />
                                                )}
                                            </div>
                                            <div className="mt-3">
                                                <h3 className="text-lg font-bold">{name || 'Server'}</h3>
                                                <p className="text-xs text-discord-faint mt-1">
                                                    {communityProfile?.membersCount ?? 1} Members • {estLabel}
                                                </p>
                                                <p className="text-xs text-discord-light mt-3 line-clamp-3">
                                                    {description || 'Add a description to help people discover your server.'}
                                                </p>
                                            </div>
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {previewTraits.map((t) => (
                                                    <span key={t} className="px-3 py-1 rounded-full bg-discord-border-light/25 text-xs">{t}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
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

