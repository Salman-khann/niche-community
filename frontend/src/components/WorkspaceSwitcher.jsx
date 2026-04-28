import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, ChevronRight, Users, Gamepad2, Heart, GraduationCap, BookOpen, Sparkles, ImagePlus, Command, Compass, Search } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useFeedStore } from '../stores/feedStore';
import { useChannelStore } from '../stores/channelStore';
import { useEventStore } from '../stores/eventStore';
import { useCommunityStore } from '../stores/communityStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useInviteRequestStore } from '../stores/inviteRequestStore';

const WorkspaceSwitcher = ({ onHomeClick, onServerSelect, openDirectorySignal = 0 }) => {
    const navigate = useNavigate();
    const { user, setUser } = useAuthStore();
    const { activeCommunityId, setActiveCommunity } = useWorkspaceStore();
    const { fetchFeed, uploadFile } = useFeedStore();
    const { fetchChannels, setActiveChannel, clearChannels } = useChannelStore();
    const { fetchEvents } = useEventStore();
    const { createCommunity, fetchAllCommunities, allCommunities, isLoading: isCreating } = useCommunityStore();
    const { notifications } = useNotificationStore();
    const { requestInvite, isLoading: isRequestingInvite, error: inviteRequestError, clearError: clearInviteRequestError } = useInviteRequestStore();

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [step, setStep] = useState('template');
    const [selectedTemplate, setSelectedTemplate] = useState('custom');
    const [serverKind, setServerKind] = useState(null);
    const [serverName, setServerName] = useState('');
    const [serverIcon, setServerIcon] = useState('');
    const [uploading, setUploading] = useState(false);
    const [createError, setCreateError] = useState('');
    const [hoveredServer, setHoveredServer] = useState(null);
    const [showDirectory, setShowDirectory] = useState(false);
    const [directoryQuery, setDirectoryQuery] = useState('');
    const [directoryCategory, setDirectoryCategory] = useState('all');
    const [requestTarget, setRequestTarget] = useState(null);
    const [requestNote, setRequestNote] = useState('');
    const [requestSuccess, setRequestSuccess] = useState('');
    const [requestedIds, setRequestedIds] = useState([]);

    const memberships = user?.memberships || [];
    const membershipIds = useMemo(() => new Set((memberships || []).map((m) => {
        const id = m.communityId?._id || m.communityId;
        return id?.toString?.() || String(id);
    })), [memberships]);

    const unreadByCommunity = useMemo(() => {
        const map = new Map();
        notifications.forEach((notif) => {
            if (notif.readAt) return;
            const communityId = notif.meta?.communityId;
            if (!communityId) return;
            const key = communityId?.toString?.() || String(communityId);
            map.set(key, (map.get(key) || 0) + 1);
        });
        return map;
    }, [notifications]);

    const handleSwitch = (communityId) => {
        if (communityId === activeCommunityId) {
            onServerSelect?.(communityId);
            return;
        }
        clearChannels();
        setActiveCommunity(communityId);
        setActiveChannel(null);
        onServerSelect?.(communityId);
        setTimeout(() => {
            fetchFeed(1, null, null);
            fetchChannels();
            fetchEvents();
        }, 0);
    };

    const getInitial = (membership) => {
        const community = membership.communityId;
        const name = community?.name || community?.slug || '?';
        return name.charAt(0).toUpperCase();
    };

    const getName = (membership) => {
        const community = membership.communityId;
        return community?.name || community?.slug || 'Community';
    };

    const getIcon = (membership) => {
        const community = membership.communityId;
        return community?.icon || '';
    };

    const getId = (membership) => {
        const community = membership.communityId;
        return community?._id || community;
    };

    const directoryCategories = useMemo(() => ([
        { key: 'all', label: 'All' },
        { key: 'gaming', label: 'Gaming' },
        { key: 'friends', label: 'Friends' },
        { key: 'study', label: 'Study Group' },
        { key: 'school', label: 'School Club' },
    ]), []);

    const categoryLabels = useMemo(() => ({
        gaming: 'Gaming',
        friends: 'Friends',
        study: 'Study Group',
        school: 'School Club',
    }), []);

    const getCommunityCategory = (community) => {
        const template = (community?.template || '').toLowerCase();
        if (categoryLabels[template]) return template;
        const kind = (community?.kind || '').toLowerCase();
        if (kind === 'friends') return 'friends';
        return '';
    };

    const filteredCommunities = useMemo(() => {
        const q = directoryQuery.trim().toLowerCase();
        const list = allCommunities || [];
        return list.filter((c) => {
            const category = getCommunityCategory(c);
            if (directoryCategory !== 'all' && category !== directoryCategory) return false;
            if (!q) return true;
            const name = (c.name || '').toLowerCase();
            const slug = (c.slug || '').toLowerCase();
            const description = (c.description || '').toLowerCase();
            const traits = Array.isArray(c.traits) ? c.traits.join(' ').toLowerCase() : '';
            return name.includes(q) || slug.includes(q) || description.includes(q) || traits.includes(q);
        });
    }, [allCommunities, directoryQuery, directoryCategory]);

    useEffect(() => {
        if (!showDirectory) return;
        fetchAllCommunities().catch(() => {});
    }, [showDirectory, fetchAllCommunities]);

    useEffect(() => {
        if (!showDirectory) {
            setRequestTarget(null);
            setRequestNote('');
            setRequestSuccess('');
            clearInviteRequestError();
        }
    }, [showDirectory, clearInviteRequestError]);

    useEffect(() => {
        if (openDirectorySignal > 0) setShowDirectory(true);
    }, [openDirectorySignal]);

    const handleUploadIcon = async (file) => {
        if (!file) return;
        setCreateError('');
        setUploading(true);
        try {
            const url = await uploadFile(file);
            setServerIcon(url);
        } catch (err) {
            setCreateError(err?.message || 'Failed to upload icon');
        } finally {
            setUploading(false);
        }
    };

    const handleCreate = async () => {
        const name = serverName.trim();
        if (!name) {
            setCreateError('Server name is required');
            return;
        }
        setCreateError('');
        try {
            const slug = name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');
            const data = await createCommunity(name, '', slug, serverIcon, serverKind, selectedTemplate);
            if (data?.user) setUser(data.user);
            const newId = data?.community?._id || data?.community?.id;
            if (newId) {
                setActiveCommunity(newId);
                onServerSelect?.(newId);
            }
            setShowCreateModal(false);
            setStep('template');
            setSelectedTemplate('custom');
            setServerKind(null);
            setServerName('');
            setServerIcon('');
            fetchFeed?.(1, null, null);
        } catch (err) {
            setCreateError(err?.message || 'Failed to create server');
        }
    };

    return (
        <>
            <aside className="workspace-switcher hidden md:flex flex-col items-center w-16 shrink-0 bg-[#0f1117] border-r border-discord-darkest/80 py-3 gap-3 overflow-y-auto">
                <button
                    onClick={() => {
                        onHomeClick?.();
                        navigate('/feed');
                    }}
                    className={`w-11 h-11 rounded-3xl flex items-center justify-center transition-all duration-300 cursor-pointer group/home shadow-md active:translate-y-px ${
                        location.pathname === '/feed' && !activeCommunityId 
                        ? 'bg-blurple text-white rounded-2xl' 
                        : 'bg-discord-darker text-discord-light hover:bg-blurple hover:text-white hover:rounded-2xl'
                    }`}
                    title="Home"
                >
                    <Command className="w-6 h-6" strokeWidth={2.5} />
                </button>
                <div className="w-8 h-[2px] bg-discord-border-light/60 rounded-full my-1" />
                <div className="relative group flex items-center justify-center">
                    <button
                        onClick={() => setShowDirectory(true)}
                        className={`w-11 h-11 rounded-3xl bg-discord-darker flex items-center justify-center text-discord-light
                            transition-all duration-300 cursor-pointer hover:rounded-2xl hover:bg-discord-darkest ${showDirectory ? 'rounded-2xl bg-discord-darkest' : ''}`}
                        title="Server Directory"
                    >
                        <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-inner">
                            <Compass className="w-3.5 h-3.5 text-discord-darkest" strokeWidth={2.2} />
                        </div>
                    </button>
                    <div className="absolute left-full ml-3 px-3 py-1.5 bg-discord-darkest text-white text-xs font-semibold rounded-lg
                        whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible
                        transition-all duration-200 pointer-events-none z-50 shadow-xl border border-discord-border">
                        Server Directory
                        <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0
                            border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent
                            border-r-[6px] border-r-discord-darkest" />
                    </div>
                </div>
                {memberships.map((m, i) => {
                    const id = getId(m);
                    const isActive = id === activeCommunityId;
                    const unreadCount = unreadByCommunity.get(id?.toString?.() || String(id)) || 0;
                    const isMuted = m.notificationSettings?.serverMuted === true;
                    const hasUnread = unreadCount > 0 && !isMuted;

                    return (
                        <div
                            key={id}
                            className={`relative group flex items-center justify-center ${isMuted && !isActive ? 'opacity-50 hover:opacity-100' : ''}`}
                            onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredServer({
                                    id,
                                    name: getName(m),
                                    role: m.role,
                                    top: rect.top + rect.height / 2,
                                });
                            }}
                            onMouseLeave={() => setHoveredServer(null)}
                        >
                            {/* Discord-like left indicator: full pill for active, white dot for unread */}
                            <div
                                className={`absolute left-0 bg-white transition-all duration-200
                                    ${isActive
                                        ? 'w-1 h-10 rounded-r-full'
                                        : hasUnread
                                            ? 'w-2 h-2 rounded-full'
                                            : 'w-0 h-0 group-hover:w-1 group-hover:h-5 group-hover:rounded-r-full'
                                    }`}
                            />

                            <button onClick={() => handleSwitch(id)}
                                className={`w-11 h-11 flex items-center justify-center text-xs font-bold text-discord-light
                                    transition-all duration-300 cursor-pointer select-none
                                    ${isActive
                                        ? 'bg-blurple text-white rounded-2xl shadow-lg'
                                        : 'bg-discord-darker rounded-3xl hover:rounded-2xl hover:bg-blurple/80 hover:text-white'
                                    }`}
                                title={getName(m)}>
                                {getIcon(m) ? (
                                    <img src={getIcon(m)} alt="" className="w-full h-full rounded-2xl object-cover" />
                                ) : (
                                    getInitial(m)
                                )}
                            </button>
                        </div>
                    );
                })}

                {/* Create / Join community */}
                <div className="relative group flex items-center justify-center">
                    <button onClick={() => {
                        setShowCreateModal(true);
                        setStep('template');
                        setSelectedTemplate('custom');
                        setServerKind(null);
                        setServerName('');
                        setServerIcon('');
                        setCreateError('');
                    }}
                        className="w-11 h-11 rounded-3xl bg-discord-darker flex items-center justify-center text-discord-light
                            transition-all duration-300 cursor-pointer hover:rounded-2xl hover:bg-discord-darkest"
                        title="Create a server">
                        <Plus className="w-5 h-5 text-discord-faint" strokeWidth={2} />
                    </button>

                    <div className="absolute left-full ml-3 px-3 py-1.5 bg-discord-darkest text-white text-xs font-semibold rounded-lg
                        whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible
                        transition-all duration-200 pointer-events-none z-50 shadow-xl border border-discord-border">
                        Create a Server
                        <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0
                            border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent
                            border-r-[6px] border-r-discord-darkest" />
                    </div>
                </div>
            </aside>

            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in-fast" onClick={() => setShowCreateModal(false)}>
                    <div
                        className={`max-w-[96vw] rounded-2xl bg-[#2b2d31] border border-discord-border/50 shadow-2xl animate-pop-in-fast ${
                            step === 'template' ? 'w-[920px]' : 'w-[460px]'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {step === 'template' ? (
                            <div className="flex min-h-[520px] overflow-hidden rounded-2xl">
                                <div className="hidden md:block w-[340px] bg-[#181A20]">
                                    <div className="h-full w-full">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 1000" width="100%" height="100%">
                                            <rect width="600" height="1000" fill="#181A20" />
                                            <path d="M 460 140 A 45 45 0 1 1 530 80 A 55 55 0 1 0 460 140 Z" fill="#E2E4EC" />
                                            <circle cx="120" cy="180" r="2.5" fill="#FFFFFF" opacity="0.6" />
                                            <circle cx="80" cy="350" r="1.5" fill="#FFFFFF" opacity="0.4" />
                                            <circle cx="520" cy="260" r="2" fill="#FFFFFF" opacity="0.7" />
                                            <circle cx="350" cy="100" r="1.5" fill="#FFFFFF" opacity="0.5" />
                                            <path d="M 280 220 L 285 228 L 293 230 L 285 232 L 280 240 L 275 232 L 267 230 L 275 228 Z" fill="#E2E4EC" opacity="0.8" />
                                            <path d="M 500 400 L 503 405 L 508 406 L 503 407 L 500 412 L 497 407 L 492 406 L 497 405 Z" fill="#E2E4EC" opacity="0.5" />
                                            <g transform="translate(180, 110) scale(0.65)">
                                                <path d="M 10 20 Q 50 0 90 20 Q 50 40 10 20 Z" fill="#2A2D3A" />
                                                <polygon points="5,20 20,10 15,30" fill="#20222D" />
                                                <rect x="40" y="25" width="20" height="8" rx="2" fill="#13141A" />
                                                <path d="M -15 20 L 5 20" stroke="#2A2D3A" strokeWidth="2" strokeLinecap="round" />
                                            </g>
                                            <path d="M -50 220 Q 30 180 100 230 Q 180 200 250 250 Q 350 230 420 300 L -50 300 Z" fill="#21232E" />
                                            <path d="M 280 340 Q 380 290 450 340 Q 550 300 650 380 L 650 450 L 280 450 Z" fill="#1C1E26" />
                                            <path d="M -50 400 Q 80 340 180 420 Q 280 380 380 450 L -50 450 Z" fill="#252835" />
                                            <polygon points="0,650 180,450 380,650" fill="#1F212B" />
                                            <polygon points="180,450 240,530 380,650" fill="#191B24" />
                                            <path d="M 600 320 L 460 480 L 520 540 L 420 720 L 380 850 L 600 900 Z" fill="#282B38" />
                                            <path d="M 600 320 L 460 480 L 520 540 L 600 580 Z" fill="#303444" />
                                            <path d="M 600 580 L 520 540 L 420 720 L 580 780 Z" fill="#232631" />
                                            <g transform="translate(480, 410) scale(1.1)">
                                                <polygon points="20,0 40,35 30,35 50,70 10,70 30,35 0,35" fill="#16181F" />
                                            </g>
                                            <g transform="translate(420, 630) scale(1.6)">
                                                <path d="M 20 40 Q 5 20 30 0 Q 55 20 40 40 Z" fill="#1A1C25" />
                                                <path d="M 30 40 Q 25 25 40 10 Q 55 25 45 40 Z" fill="#212430" />
                                            </g>
                                            <path d="M 0 880 L 160 840 L 320 880 L 480 840 L 600 890 L 600 1000 L 0 1000 Z" fill="#191B24" />
                                            <path d="M 0 880 L 160 840 L 320 880 L 480 840 L 600 890 L 600 910 L 480 860 L 320 900 L 160 860 L 0 900 Z" fill="#2A2E3B" />
                                            <path d="M 0 940 Q 150 900 250 960 Q 400 930 600 980 L 600 1000 L 0 1000 Z" fill="#101217" />
                                            <path d="M 0 940 Q 150 900 250 960 Q 400 930 600 980 L 600 1000 L 400 950 Q 250 980 150 920 Q 50 940 0 960 Z" fill="#1D202A" />
                                            <g transform="translate(430, 750)">
                                                <rect width="90" height="90" fill="#2E3242" />
                                                <polygon points="0,0 90,0 80,10 10,10" fill="#3D4255" />
                                                <polygon points="0,0 10,10 10,80 0,90" fill="#232633" />
                                                <polygon points="80,10 90,0 90,90 80,80" fill="#1C1E28" />
                                                <polygon points="10,10 15,10 80,80 75,80" fill="#232633" />
                                                <polygon points="75,10 80,10 15,80 10,80" fill="#232633" />
                                                <rect x="10" y="40" width="70" height="10" fill="#1C1E28" />
                                                <path d="M 30 -30 L 55 -45 L 80 -15 L 45 0 Z" fill="#5E6582" />
                                                <path d="M 10 -10 L 30 -30 L 45 0 L 25 15 Z" fill="#4B5168" />
                                                <path d="M 45 0 L 80 -15 L 70 20 L 25 15 Z" fill="#393E50" />
                                                <path d="M 45 0 L 70 20 L 45 15 Z" fill="#2D3141" />
                                            </g>
                                            <path d="M 400 810 A 45 45 0 0 1 490 820 A 45 45 0 0 1 590 810 L 600 900 L 400 900 Z" fill="#1C1F28" />
                                            <polygon points="160,860 190,790 260,810 280,870" fill="#34384A" />
                                            <polygon points="160,860 190,790 210,850" fill="#464C63" />
                                            <polygon points="260,810 280,870 250,860" fill="#272A38" />
                                            <g id="explorer_owl">
                                                <polygon points="170,830 180,830 100,280 90,280" fill="#393D50" />
                                                <path d="M 95 300 Q 170 260 200 320 Q 160 350 110 375 Z" fill="#7C84A3" />
                                                <path d="M 200 320 Q 240 280 220 240 Q 170 250 95 300 Z" fill="#5F6580" />
                                                <path d="M 120 330 Q 170 300 190 340 Q 160 360 130 370 Z" fill="#919ABF" opacity="0.6" />
                                                <polygon points="245,740 260,820 235,820" fill="#0C0D11" />
                                                <path d="M 235 820 L 280 820 L 280 830 L 235 830 Z" fill="#0C0D11" />
                                                <path d="M 250 710 Q 330 730 310 780 Q 270 750 240 730 Z" fill="#6A718C" />
                                                <path d="M 260 720 Q 320 740 300 770 Q 270 750 250 735 Z" fill="#545970" />
                                                <path d="M 175 720 Q 220 780 270 710 L 260 670 L 195 670 Z" fill="#4B5168" />
                                                <path d="M 175 720 Q 195 750 215 730 Q 205 690 195 670 Z" fill="#3A3E50" />
                                                <polygon points="195,740 185,800 210,800" fill="#0C0D11" />
                                                <path d="M 175 800 L 220 800 L 220 810 L 175 810 Z" fill="#0C0D11" />
                                                <path d="M 250 590 C 295 590 305 650 270 680 C 260 630 250 620 250 590 Z" fill="#14161C" />
                                                <rect x="250" y="580" width="35" height="20" rx="10" fill="#20232E" transform="rotate(15 250 580)" />
                                                <path d="M 195 590 C 170 650 185 690 230 690 C 275 690 280 640 255 590 Z" fill="#1A1C25" />
                                                <path d="M 205 590 C 190 640 205 680 230 680 C 250 680 260 630 245 590 Z" fill="#C5C9DB" />
                                                <path d="M 225 585 Q 250 630 270 680" stroke="#2D3141" strokeWidth="7" fill="none" />
                                                <path d="M 225 680 Q 260 680 280 655" stroke="#2D3141" strokeWidth="7" fill="none" />
                                                <circle cx="225" cy="680" r="11" fill="#4B5168" />
                                                <path d="M 245 600 Q 330 530 380 540 Q 330 610 255 640 Z" fill="#B0B5CC" />
                                                <path d="M 345 535 Q 380 495 400 520 Q 365 565 355 555 Z" fill="#D6DAE8" />
                                                <path d="M 360 545 Q 400 525 410 550 Q 375 585 365 565 Z" fill="#E2E5F0" />
                                                <path d="M 365 565 Q 400 555 395 575 Q 365 600 355 585 Z" fill="#C5C9DB" />
                                                <path d="M 195 610 Q 140 640 120 560 Q 150 550 205 580 Z" fill="#919ABF" />
                                                <circle cx="120" cy="565" r="24" fill="#E2E5F0" />
                                                <path d="M 190 575 Q 225 610 260 575 Q 225 555 190 575 Z" fill="#3D4255" />
                                                <path d="M 195 585 Q 180 620 165 640 L 195 645 Q 200 615 205 595 Z" fill="#2E3242" />
                                                <ellipse cx="225" cy="535" rx="38" ry="42" fill="#B0B5CC" />
                                                <path d="M 225 495 C 175 495 180 570 225 570 C 270 570 275 495 225 495 Z" fill="#E8EAFA" />
                                                <path d="M 195 500 L 165 460 Q 195 480 215 495 Z" fill="#B0B5CC" />
                                                <path d="M 255 500 L 285 460 Q 255 480 235 495 Z" fill="#B0B5CC" />
                                                <path d="M 185 490 C 200 465 220 490 225 490 C 230 490 250 465 265 490 C 275 515 250 515 225 505 C 200 515 175 515 185 490 Z" fill="#20222D" />
                                                <ellipse cx="205" cy="492" rx="10" ry="7" fill="#13141A" />
                                                <ellipse cx="245" cy="492" rx="10" ry="7" fill="#13141A" />
                                                <path d="M 198 488 L 210 490" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />
                                                <path d="M 238 488 L 250 490" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />
                                                <path d="M 195 525 Q 207 510 215 530" stroke="#13141A" strokeWidth="4.5" strokeLinecap="round" fill="none" />
                                                <path d="M 255 525 Q 243 510 235 530" stroke="#13141A" strokeWidth="4.5" strokeLinecap="round" fill="none" />
                                                <path d="M 215 540 L 235 540 L 225 565 Z" fill="#13141A" />
                                            </g>
                                        </svg>
                                    </div>
                                </div>
                                <div className="flex-1 p-6 md:p-8">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h2 className="text-2xl font-bold text-white">Create Your Server</h2>
                                            <p className="text-sm text-discord-muted mt-2">
                                                Your server is where you and your friends hang out. Make yours and start talking.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setShowCreateModal(false)}
                                            className="w-8 h-8 rounded-full bg-discord-darkest flex items-center justify-center hover:bg-discord-border-light/40 cursor-pointer"
                                        >
                                            <X className="w-4 h-4 text-discord-faint" />
                                        </button>
                                    </div>

                                    <div className="mt-6 space-y-3">
                                        <button
                                            onClick={() => { setSelectedTemplate('custom'); setStep('purpose'); }}
                                            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-discord-darkest/70 border border-discord-border/50 hover:bg-discord-darkest cursor-pointer"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Sparkles className="w-5 h-5 text-blurple" />
                                                <span className="text-sm font-semibold text-white">Create My Own</span>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-discord-faint" />
                                        </button>

                                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-discord-faint">Start from a template</div>

                                        {[{ key: 'gaming', label: 'Gaming', icon: Gamepad2 }, { key: 'friends', label: 'Friends', icon: Heart }, { key: 'study', label: 'Study Group', icon: GraduationCap }, { key: 'school', label: 'School Club', icon: BookOpen }].map((t) => (
                                            <button
                                                key={t.key}
                                                onClick={() => { setSelectedTemplate(t.key); setStep('purpose'); }}
                                                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-discord-darkest/70 border border-discord-border/50 hover:bg-discord-darkest cursor-pointer"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <t.icon className="w-5 h-5 text-discord-faint" />
                                                    <span className="text-sm font-semibold text-white">{t.label}</span>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-discord-faint" />
                                            </button>
                                        ))}

                                        <div className="pt-3 border-t border-discord-border/40">
                                            <p className="text-sm text-discord-faint mb-2">Have an invite already?</p>
                                            <button
                                                onClick={() => { setShowCreateModal(false); navigate('/join-community'); }}
                                                className="w-full px-4 py-2 rounded-xl bg-discord-darkest text-sm font-semibold text-discord-white hover:bg-discord-border-light/30 cursor-pointer"
                                            >
                                                Join a Server
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h2 className="text-2xl font-bold text-white">
                                            {step === 'purpose' && 'Tell Us More About Your Server'}
                                            {step === 'customize' && 'Customize Your Server'}
                                        </h2>
                                        {step === 'purpose' && (
                                            <p className="text-sm text-discord-muted mt-2">
                                                Is your new server for just a few friends or a larger community?
                                            </p>
                                        )}
                                        {step === 'customize' && (
                                            <p className="text-sm text-discord-muted mt-2">
                                                Give your new server a personality with a name and an icon. You can always change it later.
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setShowCreateModal(false)}
                                        className="w-8 h-8 rounded-full bg-discord-darkest flex items-center justify-center hover:bg-discord-border-light/40 cursor-pointer"
                                    >
                                        <X className="w-4 h-4 text-discord-faint" />
                                    </button>
                                </div>
                                {step === 'purpose' && (
                                    <div className="mt-6 space-y-3">
                                        <button
                                            onClick={() => { setServerKind('friends'); setStep('customize'); }}
                                            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-discord-darkest/70 border border-discord-border/50 hover:bg-discord-darkest cursor-pointer"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Users className="w-5 h-5 text-discord-faint" />
                                                <span className="text-sm font-semibold text-white">For me and my friends</span>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-discord-faint" />
                                        </button>
                                        <button
                                            onClick={() => { setServerKind('community'); setStep('customize'); }}
                                            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-discord-darkest/70 border border-discord-border/50 hover:bg-discord-darkest cursor-pointer"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Users className="w-5 h-5 text-discord-faint" />
                                                <span className="text-sm font-semibold text-white">For a club or community</span>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-discord-faint" />
                                        </button>
                                        <button onClick={() => setStep('template')} className="text-sm text-discord-faint hover:text-white cursor-pointer">Back</button>
                                    </div>
                                )}
                                {step === 'customize' && (
                                    <div className="mt-6">
                                        <div className="flex items-center gap-4">
                                            <label className="relative w-20 h-20 rounded-full border-2 border-dashed border-discord-border/60 flex items-center justify-center cursor-pointer hover:border-blurple">
                                                {serverIcon ? (
                                                    <img src={serverIcon} alt="" className="w-20 h-20 rounded-full object-cover" />
                                                ) : (
                                                    <ImagePlus className="w-6 h-6 text-discord-faint" />
                                                )}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    onChange={(e) => handleUploadIcon(e.target.files?.[0])}
                                                />
                                            </label>
                                            <div>
                                                <p className="text-sm font-semibold text-white">Upload an icon</p>
                                                <p className="text-xs text-discord-faint mt-1">Recommended 512x512.</p>
                                            </div>
                                        </div>
                                        <div className="mt-4">
                                            <label className="text-xs font-semibold text-discord-faint uppercase tracking-[0.12em]">Server Name</label>
                                            <input
                                                value={serverName}
                                                onChange={(e) => setServerName(e.target.value)}
                                                className="mt-2 w-full px-3 py-2 rounded-lg bg-discord-darkest/70 border border-discord-border/60 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blurple"
                                            />
                                            <p className="mt-2 text-[11px] text-discord-faint">
                                                Your server name must be unique.
                                            </p>
                                        </div>
                                        {createError && <p className="text-xs text-red-400 mt-3">{createError}</p>}
                                        <div className="mt-6 flex items-center gap-3">
                                            <button
                                                onClick={() => setStep('purpose')}
                                                className="px-4 py-2 rounded-lg bg-discord-darkest/70 text-sm font-semibold text-discord-faint hover:text-white"
                                            >
                                                Back
                                            </button>
                                            <button
                                                onClick={() => handleCreate()}
                                                disabled={isCreating || uploading || !serverName.trim()}
                                                className="px-4 py-2 rounded-lg bg-blurple text-sm font-semibold text-white hover:bg-blurple/90 disabled:opacity-60"
                                            >
                                                {isCreating ? 'Creating...' : uploading ? 'Uploading...' : 'Create Server'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showDirectory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in-fast" onClick={() => setShowDirectory(false)}>
                    <div
                        className="w-full h-full md:w-[980px] md:max-w-[96vw] md:max-h-[90vh] overflow-y-auto md:rounded-2xl rounded-none bg-gradient-to-b from-[#2b2f45] via-[#26283b] to-[#1f2232] border border-discord-border/40 shadow-2xl p-4 md:p-6 animate-pop-in-fast"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="rounded-2xl overflow-hidden border border-white/10 shadow-[0_16px_32px_rgba(18,20,40,0.3)] mb-5">
                            <div className="w-full h-[180px] md:h-[220px] bg-[#1f1f2f]">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
                                    <defs>
                                    <linearGradient id="skyGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#2D1B6B" />
                                        <stop offset="35%" stopColor="#8B2E8B" />
                                        <stop offset="70%" stopColor="#E94F64" />
                                        <stop offset="100%" stopColor="#F9A03F" />
                                    </linearGradient>
                                    <radialGradient id="artifactGlow" cx="50%" cy="50%" r="50%">
                                        <stop offset="0%" stopColor="#00FFFF" stopOpacity="0.8" />
                                        <stop offset="30%" stopColor="#00D0FF" stopOpacity="0.4" />
                                        <stop offset="100%" stopColor="#0055FF" stopOpacity="0" />
                                    </radialGradient>
                                    <linearGradient id="beamGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
                                        <stop offset="20%" stopColor="#00FFFF" stopOpacity="0.6" />
                                        <stop offset="80%" stopColor="#00FFFF" stopOpacity="0.6" />
                                        <stop offset="100%" stopColor="#00FFFF" stopOpacity="0" />
                                    </linearGradient>
                                    <g id="star">
                                        <polygon points="0,-4 1,-1 4,0 1,1 0,4 -1,1 -4,0 -1,-1" fill="#FFFFFF" opacity="0.8" />
                                    </g>
                                </defs>
                                <rect width="1200" height="800" fill="url(#skyGradient)" />
                                <use href="#star" x="150" y="80" transform="scale(1.5)" />
                                <use href="#star" x="350" y="150" transform="scale(0.8)" />
                                <use href="#star" x="800" y="90" transform="scale(2)" />
                                <use href="#star" x="1050" y="180" transform="scale(1.2)" />
                                <use href="#star" x="550" y="60" transform="scale(1)" />
                                <path d="M -50 200 Q 150 180 300 220 Q 500 250 700 200 Q 900 150 1250 250 L 1250 280 Q 850 180 500 280 Q 200 350 -50 230 Z" fill="#5A2E8B" opacity="0.4" />
                                <path d="M 200 100 Q 400 80 600 120 Q 800 150 1000 90 L 1250 150 L 1250 170 Q 950 130 650 180 Q 400 220 150 130 Z" fill="#91338A" opacity="0.3" />
                                <polygon points="0,550 80,480 150,520 280,420 400,500 550,450 700,580 0,580" fill="#4B205D" opacity="0.6" />
                                <polygon points="500,580 650,490 780,550 900,430 1050,520 1200,460 1200,580 500,580" fill="#4B205D" opacity="0.5" />
                                <g id="epic_monolith" transform="translate(850, 380)">
                                    <circle cx="0" cy="0" r="350" fill="url(#artifactGlow)" />
                                    <rect x="-8" y="-400" width="16" height="800" fill="url(#beamGradient)" />
                                    <rect x="-2" y="-400" width="4" height="800" fill="#FFFFFF" />
                                    <ellipse cx="0" cy="0" rx="180" ry="40" fill="none" stroke="#00FFFF" strokeWidth="2" transform="rotate(-15)" opacity="0.6" />
                                    <ellipse cx="0" cy="0" rx="240" ry="60" fill="none" stroke="#00D0FF" strokeWidth="1" transform="rotate(25)" strokeDasharray="15 10" opacity="0.5" />
                                    <ellipse cx="0" cy="0" rx="120" ry="20" fill="none" stroke="#FFFFFF" strokeWidth="3" transform="rotate(-5)" opacity="0.8" />
                                    <polygon points="-220,-80 -200,-90 -190,-70 -210,-60" fill="#00FFFF" opacity="0.7" />
                                    <polygon points="180,-150 200,-160 210,-130" fill="#00D0FF" opacity="0.8" />
                                    <polygon points="150,120 180,110 170,140 140,150" fill="#00FFFF" opacity="0.6" />
                                    <polygon points="-160,160 -140,140 -130,170" fill="#FFFFFF" opacity="0.9" />
                                    <polygon points="-80,-250 -60,-270 -50,-240" fill="#00FFFF" opacity="0.8" />
                                    <polygon points="-20,-180 0,-260 20,-180 0,-160" fill="#130C25" />
                                    <polygon points="0,-260 20,-180 0,-160" fill="#251744" />
                                    <path d="M 0,-260 L 0,-160 M -10,-220 L 5,-200" stroke="#00FFFF" strokeWidth="2" fill="none" />
                                    <polygon points="-80,-50 -120,-10 -60,80 -20,20" fill="#0F091D" />
                                    <polygon points="-60,80 -20,20 -10,120" fill="#1B1133" />
                                    <polygon points="80,-70 110,-20 50,100 20,10" fill="#160E2A" />
                                    <polygon points="50,100 20,10 0,140" fill="#2A1A4A" />
                                    <polygon points="0,-80 -40,0 0,80 40,0" fill="#00FFFF" opacity="0.9" />
                                    <polygon points="0,-80 40,0 0,80" fill="#FFFFFF" opacity="0.8" />
                                    <polygon points="-20,0 0,-40 20,0 0,40" fill="#0088FF" />
                                    <path d="M -80,-50 L -60,-20 L -30,-30" stroke="#00FFFF" strokeWidth="2" fill="none" opacity="0.8" />
                                    <path d="M 80,-70 L 60,-40 L 40,-60" stroke="#00FFFF" strokeWidth="2" fill="none" opacity="0.8" />
                                    <path d="M -60,80 L -40,50 L -15,70" stroke="#00FFFF" strokeWidth="2" fill="none" opacity="0.8" />
                                    <path d="M 50,100 L 30,60 L 10,90" stroke="#00FFFF" strokeWidth="2" fill="none" opacity="0.8" />
                                    <polygon points="-15,180 0,250 15,180 0,160" fill="#1A1030" />
                                    <polygon points="0,250 15,180 0,160" fill="#2D1C50" />
                                    <path d="M 0,250 L 0,160 M -5,210 L 8,190" stroke="#00FFFF" strokeWidth="2" fill="none" />
                                </g>
                                <path d="M -100 650 Q 200 580 500 680 T 1300 600 L 1300 850 L -100 850 Z" fill="#6B2956" />
                                <path d="M -100 700 Q 350 620 750 720 T 1300 650 L 1300 850 L -100 850 Z" fill="#4B1E4D" />
                                <path d="M 0 680 Q 400 600 800 700 T 1200 650 L 1200 800 L 0 800 Z" fill="#F9A03F" opacity="0.15" />
                                <polygon points="-50,850 -50,550 150,520 300,580 480,560 680,680 900,690 1250,850" fill="#241442" />
                                <polygon points="-50,850 150,620 350,680 550,650 780,780 1250,850" fill="#1A0E30" />
                                <path d="M 150 520 L 300 580 L 480 560 L 680 680 L 900 690" fill="none" stroke="#00FFFF" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
                                <path d="M 150 520 L 300 580 L 480 560 L 680 680 L 900 690" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
                                <path d="M -50 550 L 150 520" fill="none" stroke="#F9A03F" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
                                <path d="M 200 650 L 350 600 L 420 620" fill="none" stroke="#E94F64" strokeWidth="3" strokeLinecap="round" />
                                <circle cx="420" cy="620" r="4" fill="#E94F64" />
                                <path d="M 450 750 L 550 700 L 620 730" fill="none" stroke="#00FFFF" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
                                <g id="char_scout" transform="translate(300, 520)">
                                    <ellipse cx="10" cy="85" rx="40" ry="10" fill="#0A0515" opacity="0.6" />
                                    <polygon points="-20,30 -40,70 -10,80 5,45" fill="#1C2331" />
                                    <polygon points="-40,70 -55,75 -45,85 -10,80" fill="#0F131A" />
                                    <polygon points="15,40 30,75 20,85 5,45" fill="#2C3A51" />
                                    <polygon points="30,75 50,80 40,90 20,85" fill="#0F131A" />
                                    <path d="M 15,40 L 25,60" stroke="#00FFFF" strokeWidth="2" fill="none" />
                                    <polygon points="-15,0 20,10 15,45 -10,35" fill="#1C2331" />
                                    <polygon points="-5,0 20,10 15,45 0,35" fill="#3A4B66" />
                                    <polygon points="-35,5 -15,-5 -5,25 -25,35" fill="#0F131A" />
                                    <line x1="-25" y1="5" x2="-40" y2="-20" stroke="#4A5B7A" strokeWidth="3" strokeLinecap="round" />
                                    <circle cx="-40" cy="-20" r="3" fill="#E94F64" />
                                    <polygon points="10,15 35,40 25,50 0,25" fill="#1C2331" />
                                    <polygon points="-5,15 30,0 35,10 0,25" fill="#2C3A51" />
                                    <circle cx="35" cy="5" r="6" fill="#0F131A" />
                                    <ellipse cx="60" cy="-10" rx="30" ry="10" fill="none" stroke="#00FFFF" strokeWidth="1.5" transform="rotate(-15 60 -10)" />
                                    <ellipse cx="60" cy="-10" rx="15" ry="5" fill="none" stroke="#00D0FF" strokeWidth="1" transform="rotate(25 60 -10)" />
                                    <circle cx="60" cy="-10" r="3" fill="#FFFFFF" />
                                    <line x1="35" y1="5" x2="50" y2="-5" stroke="#00FFFF" strokeWidth="1.5" opacity="0.6" />
                                    <polygon points="-5,-25 15,-30 25,-10 0,-5" fill="#2C3A51" />
                                    <polygon points="10,-25 22,-22 20,-12 8,-15" fill="#000000" />
                                    <line x1="12" y1="-18" x2="20" y2="-17" stroke="#00FFFF" strokeWidth="2" strokeLinecap="round" />
                                </g>
                                <g id="char_leader" transform="translate(520, 420)">
                                    <ellipse cx="10" cy="145" rx="45" ry="12" fill="#0A0515" opacity="0.6" />
                                    <path d="M -15,-10 Q -80,40 -120,120 Q -60,110 -20,130 Q -40,80 -5,20 Z" fill="#B32441" />
                                    <path d="M -5,-10 Q -40,50 0,140 Q 30,90 10,20 Z" fill="#E94F64" />
                                    <polygon points="-15,60 -25,110 -10,140 10,65" fill="#1C2331" />
                                    <polygon points="-25,110 -40,140 -20,145 -10,140" fill="#0F131A" />
                                    <polygon points="15,60 30,100 20,140 5,65" fill="#2C3A51" />
                                    <polygon points="30,100 50,145 30,150 20,140" fill="#0F131A" />
                                    <path d="M 15,60 L 25,95" stroke="#00FFFF" strokeWidth="2.5" fill="none" opacity="0.8" />
                                    <polygon points="-15,0 25,0 15,65 -10,60" fill="#1C2331" />
                                    <polygon points="-5,0 25,0 15,65 5,60" fill="#4A5B7A" />
                                    <circle cx="10" cy="20" r="4" fill="#00FFFF" />
                                    <path d="M -5,20 L 25,20" stroke="#00FFFF" strokeWidth="1" opacity="0.5" />
                                    <polygon points="15,5 60,-15 65,-5 20,15" fill="#3A4B66" />
                                    <polygon points="60,-15 80,-30 85,-20 65,-5" fill="#2C3A51" />
                                    <circle cx="82" cy="-25" r="6" fill="#0F131A" />
                                    <path d="M 85,-25 Q 150,-40 250,-20" fill="none" stroke="#00FFFF" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 10" opacity="0.8" />
                                    <polygon points="-10,5 -30,30 -20,40 0,15" fill="#1C2331" />
                                    <circle cx="-25" cy="35" r="7" fill="#0F131A" />
                                    <line x1="-15" y1="-40" x2="-40" y2="150" stroke="#4A5B7A" strokeWidth="4" strokeLinecap="round" />
                                    <polygon points="-25,-30 -5,-50 -15,-60 -35,-40" fill="#00FFFF" opacity="0.9" />
                                    <polygon points="-5,-50 10,-60 -5,-70 -20,-60" fill="#FFFFFF" />
                                    <circle cx="-15" cy="-55" r="20" fill="url(#artifactGlow)" opacity="0.5" />
                                    <polygon points="-10,-35 15,-40 30,-10 0,0" fill="#2C3A51" />
                                    <polygon points="10,-30 35,-25 30,-15 5,-20" fill="#000000" />
                                    <path d="M 12,-25 L 32,-20" stroke="#00FFFF" strokeWidth="3" strokeLinecap="round" />
                                </g>
                                <g id="char_heavy" transform="translate(680, 500)">
                                    <ellipse cx="15" cy="110" rx="40" ry="11" fill="#0A0515" opacity="0.6" />
                                    <polygon points="-10,50 -20,90 0,110 10,55" fill="#1C2331" />
                                    <polygon points="-20,90 -40,110 -20,115 0,110" fill="#0F131A" />
                                    <polygon points="20,50 40,90 20,110 5,55" fill="#2C3A51" />
                                    <polygon points="40,90 55,110 35,115 20,110" fill="#0F131A" />
                                    <polygon points="-20,0 30,-5 25,55 -10,50" fill="#1C2331" />
                                    <polygon points="0,0 30,-5 25,55 5,50" fill="#3A4B66" />
                                    <polygon points="-30,0 0,-15 -5,15 -25,20" fill="#2C3A51" />
                                    <polygon points="20,-5 45,0 40,25 15,20" fill="#4A5B7A" />
                                    <polygon points="-15,15 -10,40 5,45 0,20" fill="#1C2331" />
                                    <polygon points="30,15 25,45 10,50 15,20" fill="#2C3A51" />
                                    <circle cx="10" cy="45" r="8" fill="#0F131A" />
                                    <rect x="-5" y="45" width="20" height="60" fill="#0F131A" />
                                    <polygon points="-10,105 30,105 20,110 0,110" fill="#2C3A51" />
                                    <rect x="0" y="55" width="10" height="30" fill="#00FFFF" opacity="0.8" />
                                    <polygon points="-10,-30 25,-40 35,-5 0,0" fill="#2C3A51" />
                                    <circle cx="15" cy="-25" r="4" fill="#E94F64" />
                                    <circle cx="25" cy="-20" r="3" fill="#E94F64" />
                                    <circle cx="18" cy="-15" r="5" fill="#00FFFF" />
                                </g>
                                </svg>
                            </div>
                        </div>

                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-2xl md:text-2xl font-bold text-white">Find Your Community</h2>
                                <p className="text-sm text-white/70 mt-1">Browse the servers available to you.</p>
                            </div>
                            <button
                                onClick={() => setShowDirectory(false)}
                                className="w-8 h-8 rounded-full bg-discord-darkest flex items-center justify-center hover:bg-discord-border-light/40 cursor-pointer"
                            >
                                <X className="w-4 h-4 text-discord-faint" />
                            </button>
                        </div>

                        <div className="mt-5 rounded-2xl bg-[#23263a]/90 border border-white/10 p-4 md:p-5">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div>
                                    <h3 className="text-xl md:text-2xl font-bold text-white tracking-wide">FIND YOUR COMMUNITY</h3>
                                    <p className="text-sm text-white/75 mt-1">From gaming to music to learning, there&apos;s a place for you.</p>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
                                    Discover
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-discord-faint" />
                                <input
                                    value={directoryQuery}
                                    onChange={(e) => setDirectoryQuery(e.target.value)}
                                    placeholder="Search servers"
                                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-discord-darkest text-sm text-discord-white placeholder:text-discord-faint/60 border border-discord-border/60 focus:outline-none focus:border-blurple"
                                />
                            </div>
                            <button
                                onClick={() => {
                                    setShowDirectory(false);
                                    navigate('/join-community');
                                }}
                                className="px-4 py-2.5 rounded-lg bg-discord-darkest text-sm font-semibold text-discord-light hover:bg-discord-border-light/30 cursor-pointer w-full sm:w-auto"
                            >
                                Join a Server
                            </button>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                            {directoryCategories.map((category) => {
                                const isActive = directoryCategory === category.key;
                                return (
                                    <button
                                        key={category.key}
                                        onClick={() => setDirectoryCategory(category.key)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                                            isActive
                                                ? 'bg-blurple text-white border-blurple/60'
                                                : 'bg-discord-darkest/70 text-discord-faint border-discord-border/50 hover:bg-discord-border-light/30'
                                        }`}
                                    >
                                        {category.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-6">
                            <div className="text-sm font-semibold text-discord-light mb-3">
                                Servers ({filteredCommunities.length})
                            </div>
                            {filteredCommunities.length === 0 ? (
                                <div className="text-sm text-discord-faint">No servers match your search.</div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredCommunities.map((community) => {
                                        const id = community?._id;
                                        const name = community?.name || 'Community';
                                        const icon = community?.icon || '';
                                        const description = community?.description || community?.profileDescription || community?.slug || 'Community';
                                        const categoryKey = getCommunityCategory(community);
                                        const categoryLabel = categoryLabels[categoryKey];
                                        const isMember = membershipIds.has(id?.toString?.() || String(id));
                                        const isRequested = requestedIds.includes(id?.toString?.() || String(id));
                                        return (
                                            <div
                                                key={id}
                                                onClick={() => {
                                                    if (isMember) {
                                                        handleSwitch(id);
                                                        setShowDirectory(false);
                                                    }
                                                }}
                                                className={`text-left rounded-xl border border-discord-border/50 bg-discord-darkest/60 hover:bg-discord-darkest transition-colors p-4 ${isMember ? 'cursor-pointer' : ''}`}
                                            >
                                                <div className="h-24 w-full rounded-lg bg-discord-darker/80 border border-discord-border/40 flex items-center justify-center overflow-hidden">
                                                    {icon ? (
                                                        <img src={icon} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-2xl bg-discord-border/40 flex items-center justify-center text-lg font-bold text-discord-light">
                                                            {(name || 'C').charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="mt-3">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <h4 className="text-sm font-semibold text-white truncate">{name}</h4>
                                                        <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
                                                            isMember ? 'bg-discord-border/40 text-discord-faint' : isRequested ? 'bg-emerald-500/15 text-emerald-300' : 'bg-blurple/20 text-blurple'
                                                        }`}>
                                                            {isMember ? 'Member' : isRequested ? 'Requested' : 'Invite'}
                                                        </span>
                                                    </div>
                                                    {description && (
                                                        <p className="text-xs text-discord-faint mt-1">{description}</p>
                                                    )}
                                                    {(typeof community?.membersCount === 'number' || categoryLabel) && (
                                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                                            {typeof community?.membersCount === 'number' && (
                                                                <span className="text-[11px] text-discord-faint">{community.membersCount} members</span>
                                                            )}
                                                            {categoryLabel && (
                                                                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/5 text-discord-light border border-white/10">
                                                                    {categoryLabel}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    {!isMember && (
                                                        <div className="mt-3">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setRequestTarget(community);
                                                                    setRequestNote('');
                                                                    setRequestSuccess('');
                                                                    clearInviteRequestError();
                                                                }}
                                                                className="px-3 py-1.5 rounded-md bg-blurple text-xs font-semibold text-white hover:bg-blurple-hover cursor-pointer"
                                                            >
                                                                Request Invite
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showDirectory && requestTarget && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setRequestTarget(null)}>
                    <div
                        className="w-[420px] max-w-[92vw] rounded-2xl bg-[#2b2d31] border border-discord-border/60 shadow-2xl p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-bold text-white">Request Invite</h3>
                                <p className="text-sm text-discord-faint mt-1">Ask to join <span className="text-discord-light font-semibold">{requestTarget.name}</span>.</p>
                            </div>
                            <button
                                onClick={() => setRequestTarget(null)}
                                className="w-8 h-8 rounded-full bg-discord-darkest flex items-center justify-center hover:bg-discord-border-light/40 cursor-pointer"
                            >
                                <X className="w-4 h-4 text-discord-faint" />
                            </button>
                        </div>

                        <div className="mt-4">
                            <label className="text-xs font-semibold text-discord-faint">Message (optional)</label>
                            <textarea
                                value={requestNote}
                                onChange={(e) => setRequestNote(e.target.value)}
                                rows={3}
                                placeholder="Tell the admins why you want to join."
                                className="mt-2 w-full rounded-lg bg-discord-darkest border border-discord-border/60 px-3 py-2 text-sm text-white outline-none placeholder:text-discord-faint/60 resize-none"
                            />
                        </div>

                        {inviteRequestError && (
                            <div className="mt-3 text-xs text-discord-red">{inviteRequestError}</div>
                        )}
                        {requestSuccess && (
                            <div className="mt-3 text-xs text-emerald-300">{requestSuccess}</div>
                        )}

                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                onClick={() => setRequestTarget(null)}
                                className="px-4 py-2 rounded-lg bg-discord-darkest text-sm font-semibold text-discord-light hover:bg-discord-border-light/40 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        const created = await requestInvite(requestTarget._id, requestNote);
                                        const id = created?.communityId?.toString?.() || String(requestTarget._id);
                                        setRequestedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
                                        setRequestSuccess('Request sent. An admin will review it soon.');
                                    } catch { }
                                }}
                                disabled={isRequestingInvite}
                                className="px-4 py-2 rounded-lg bg-blurple text-sm font-semibold text-white hover:bg-blurple-hover disabled:opacity-60 cursor-pointer"
                            >
                                {isRequestingInvite ? 'Sending...' : 'Send Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {hoveredServer && (
                <div
                    className="fixed left-[76px] px-3 py-1.5 bg-discord-darkest text-white text-xs font-semibold rounded-lg
                        whitespace-nowrap transition-all duration-150 pointer-events-none z-[9999] shadow-xl border border-discord-border
                        opacity-100 translate-x-0 scale-100 animate-tooltip-in"
                    style={{ top: hoveredServer.top, transform: 'translateY(-50%)' }}
                >
                    {hoveredServer.name}
                    {hoveredServer.role === 'admin' && (
                        <span className="ml-1.5 text-[10px] text-blurple font-bold uppercase">Admin</span>
                    )}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0
                        border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent
                        border-r-[6px] border-r-discord-darkest" />
                </div>
            )}
        </>
    );
};

export default WorkspaceSwitcher;
