import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Heart, ChevronDown, ChevronUp, Send, MoreHorizontal, Flag, BarChart3, Check, Crown, Bookmark, Link2, ExternalLink, FileText, Pin, Star } from 'lucide-react';
import MentionInput from './MentionInput';
import { useFeedStore } from '../stores/feedStore';
import { useAuthStore } from '../stores/authStore';
import { useProfileStore } from '../stores/profileStore';

const PostCard = ({ post, onHashtagClick }) => {
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState('');
    const [commentMentions, setCommentMentions] = useState([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [liking, setLiking] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [flagging, setFlagging] = useState(false);
    const [flagged, setFlagged] = useState(false);
    const [saving, setSaving] = useState(false);
    const [voting, setVoting] = useState(false);
    const [pinning, setPinning] = useState(false);
    const [featuring, setFeaturing] = useState(false);
    const [isPinned, setIsPinned] = useState(!!post.pinnedAt);
    const [isFeatured, setIsFeatured] = useState(!!post.featuredAt);
    const [lightboxImg, setLightboxImg] = useState(null);
    const menuRef = useRef(null);

    const { fetchComments, addComment, reactToPost, reactToComment, flagPost, voteOnPoll, toggleSavePost, togglePinPost, toggleFeaturePost } = useFeedStore();
    const { user } = useAuthStore();
    const { profile } = useProfileStore();

    const isSaved = profile?.savedPosts?.some((id) => id === post._id || id.toString?.() === post._id) ?? false;
    const [localSaved, setLocalSaved] = useState(isSaved);

    useEffect(() => { setLocalSaved(isSaved); }, [isSaved]);
    useEffect(() => { setIsPinned(!!post.pinnedAt); }, [post.pinnedAt]);
    useEffect(() => { setIsFeatured(!!post.featuredAt); }, [post.featuredAt]);

    const postCommunityId = typeof post.communityId === 'object' ? post.communityId?._id : post.communityId;
    const communityRole = (user?.memberships || []).find((m) => {
        const id = m.communityId?._id || m.communityId;
        return id?.toString?.() === postCommunityId?.toString?.();
    })?.role;
    const canModeratePost = ['admin', 'moderator'].includes(communityRole);

    const handleSave = async () => {
        if (saving) return; setSaving(true);
        setLocalSaved((prev) => !prev);
        try {
            const result = await toggleSavePost(post._id);
            setLocalSaved(result.saved);
            // Update profile store savedPosts in place
            const store = useProfileStore.getState();
            if (store.profile) {
                const currentSaved = store.profile.savedPosts || [];
                const updated = result.saved
                    ? [...currentSaved, post._id]
                    : currentSaved.filter((id) => id !== post._id && id.toString?.() !== post._id);
                useProfileStore.setState({ profile: { ...store.profile, savedPosts: updated } });
            }
        } catch { setLocalSaved(isSaved); }
        setSaving(false);
    };

    const handleTogglePin = async () => {
        if (!canModeratePost || pinning) return;
        setPinning(true);
        const previous = isPinned;
        setIsPinned(!previous);
        try {
            const data = await togglePinPost(post._id);
            setIsPinned(!!data.pinned);
            setShowMenu(false);
        } catch {
            setIsPinned(previous);
        }
        setPinning(false);
    };

    const handleToggleFeature = async () => {
        if (!canModeratePost || featuring) return;
        setFeaturing(true);
        const previous = isFeatured;
        setIsFeatured(!previous);
        try {
            const data = await toggleFeaturePost(post._id);
            setIsFeatured(!!data.featured);
            setShowMenu(false);
        } catch {
            setIsFeatured(previous);
        }
        setFeaturing(false);
    };

    const isLiked = post.likedBy?.includes(user?._id);

    const getRoleBadge = (role) => {
        switch (role) {
            case 'admin':
                return { label: 'Admin', bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/25' };
            case 'moderator':
                return { label: 'Mod', bg: 'bg-blurple/15', text: 'text-blurple', border: 'border-blurple/25' };
            default:
                return null; // Don't show badge for regular members
        }
    };

    const roleBadge = getRoleBadge(post.author?.communityRole);

    const timeAgo = (date) => {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days}d ago`;
        return new Date(date).toLocaleDateString();
    };

    const initials = post.author?.name
        ? post.author.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '?';

    const handleLike = async () => {
        if (liking) return; setLiking(true);
        try { await reactToPost(post._id); } catch { } setLiking(false);
    };

    const toggleComments = async () => {
        if (!showComments && comments.length === 0) {
            setLoadingComments(true);
            try { const fetched = await fetchComments(post._id); setComments(fetched); } catch { }
            setLoadingComments(false);
        }
        setShowComments(!showComments);
    };

    const handleCommentChange = useCallback((val, newMentions) => {
        setCommentText(val);
        if (newMentions) setCommentMentions(newMentions);
    }, []);

    const handleSubmitComment = async (e) => {
        e.preventDefault();
        if (!commentText.trim() || submitting) return;
        setSubmitting(true);
        try {
            const mentionIds = commentMentions.map((m) => m._id);
            const data = await addComment(post._id, commentText.trim(), mentionIds);
            setComments((prev) => [...prev, data.comment]);
            setCommentText('');
            setCommentMentions([]);
            if (!showComments) setShowComments(true);
        } catch { } setSubmitting(false);
    };

    const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '👏'];

    const handleCommentReaction = async (commentId, emoji) => {
        try {
            const data = await reactToComment(post._id, commentId, emoji);
            setComments((prev) => prev.map((c) => (
                c._id === commentId ? { ...c, reactions: data.reactions || [] } : c
            )));
        } catch { }
    };

    const handleFlag = async () => {
        if (flagging) return; setFlagging(true);
        try { await flagPost(post._id); setFlagged(true); setShowMenu(false); } catch { } setFlagging(false);
    };

    const handleVote = async (optionIndex) => {
        if (voting) return; setVoting(true);
        try { await voteOnPoll(post._id, optionIndex); } catch { } setVoting(false);
    };

    useEffect(() => {
        const handleClickOutside = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
        if (showMenu) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showMenu]);

    const hasPoll = post.poll?.question && post.poll?.options?.length >= 2;
    const totalVotes = hasPoll ? post.poll.options.reduce((sum, o) => sum + (o.votes?.length || 0), 0) : 0;
    const userVotedIndex = hasPoll ? post.poll.options.findIndex((o) => o.votes?.includes(user?._id)) : -1;
    const hasVoted = userVotedIndex >= 0;

    const media = post.mediaURLs?.filter(Boolean) || [];
    const fileExtPattern = /\.(pdf|doc|docx|txt|csv|xls|xlsx|ppt|pptx)$/i;
    const imageMedia = media.filter((url) => !fileExtPattern.test(url));
    const fileMedia = media.filter((url) => fileExtPattern.test(url));
    const resourceLinks = post.resourceLinks?.filter((link) => link?.url) || [];
    const mediaGridClass = () => {
        if (imageMedia.length === 1) return 'grid-cols-1';
        if (imageMedia.length === 2) return 'grid-cols-2';
        return 'grid-cols-2';
    };

    const getRepTier = (rep) => {
        if (rep >= 100) return { label: 'Legend', color: 'text-amber-400' };
        if (rep >= 50) return { label: 'Expert', color: 'text-blurple' };
        if (rep >= 20) return { label: 'Contributor', color: 'text-emerald-400' };
        if (rep >= 5) return { label: 'Rising', color: 'text-sky-400' };
        return { label: 'Newcomer', color: 'text-discord-muted' };
    };

    const repTier = getRepTier(post.author?.reputation || 0);
    const isPremiumAuthor = ['premium', 'enterprise'].includes(post.author?.tier || 'free');

    // ── Render text with @mentions highlighted ───────────────────────────────
    const renderWithMentions = (text) => {
        if (!text) return null;
        // Split on @Name patterns (word chars + spaces up to 3 words)
        const parts = text.split(/(@[\w]+(?:\s[\w]+){0,2})/g);
        return parts.map((part, i) => {
            if (part.startsWith('@') && part.length > 1) {
                return (
                    <span key={i} className="text-blurple font-semibold hover:underline cursor-pointer">
                        {part}
                    </span>
                );
            }
            return part;
        });
    };

    return (
        <article className={`relative bg-discord-darker/80 rounded-xl p-5 sm:p-6 border border-discord-border/50 transition-all duration-300 hover:border-discord-border ${isPremiumAuthor ? 'premium-card-accent' : ''}`}>
            {/* Community name */}
            {post.communityName && (
                <div className="flex items-center gap-1.5 mb-3 pb-2.5 border-b border-discord-border/30">
                    <div className="w-4 h-4 rounded bg-gradient-to-br from-blurple to-indigo-600 flex items-center justify-center shrink-0">
                        <span className="text-[8px] font-black text-white">{post.communityName.charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="text-[11px] font-bold text-discord-muted tracking-wide">{post.communityName}</span>
                </div>
            )}

            {/* Author row */}
            <div className="flex items-center gap-3 mb-4">
                {post.author?.avatar ? (
                    <img src={post.author.avatar} alt="" className={`w-10 h-10 rounded-full object-cover shadow-sm ${isPremiumAuthor ? 'premium-ring' : 'border-2 border-discord-border'}`} />
                ) : (
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-blurple to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-sm ${isPremiumAuthor ? 'premium-ring' : ''}`}>
                        {initials}
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-discord-white truncate">{post.author?.name || 'Unknown'}</p>
                        {roleBadge && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${roleBadge.bg} ${roleBadge.text} border ${roleBadge.border}`}>
                                {roleBadge.label}
                            </span>
                        )}
                        {isPremiumAuthor && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-amber-500/15 to-yellow-500/15 border border-amber-500/25 shrink-0 animate-premium-shimmer" title="Premium member">
                                <Crown className="w-3 h-3 text-amber-400" strokeWidth={2.5} />
                                <span className="text-[10px] font-black premium-badge">PRO</span>
                            </div>
                        )}
                        {(post.author?.reputation > 0) && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-discord-darkest border border-discord-border shrink-0" title={`${repTier.label} — ${post.author.reputation} reputation`}>
                                <span className="text-[10px]">⭐</span>
                                <span className="text-[10px] font-bold text-discord-light">{post.author.reputation}</span>
                            </div>
                        )}
                        {isPinned && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/12 text-[10px] font-black uppercase tracking-wider text-amber-300 border border-amber-500/25">
                                <Pin className="w-3 h-3" strokeWidth={2.4} /> Pinned
                            </span>
                        )}
                        {isFeatured && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-500/12 text-[10px] font-black uppercase tracking-wider text-sky-300 border border-sky-500/25">
                                <Star className="w-3 h-3" strokeWidth={2.4} /> Featured
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <p className="text-xs text-discord-faint">{timeAgo(post.createdAt)}</p>
                        {(post.author?.reputation > 0) && (
                            <span className={`text-[10px] font-semibold ${repTier.color}`}>· {repTier.label}</span>
                        )}
                    </div>
                </div>

                {/* Menu */}
                <div className="relative" ref={menuRef}>
                    <button onClick={() => setShowMenu(!showMenu)}
                        className="w-8 h-8 rounded-lg hover:bg-discord-border-light/20 flex items-center justify-center transition-colors cursor-pointer">
                        <MoreHorizontal className="w-4 h-4 text-discord-faint" strokeWidth={2} />
                    </button>
                    {showMenu && (
                        <div className="absolute right-0 top-[calc(100%+4px)] w-44 bg-discord-darkest rounded-lg shadow-xl border border-discord-border overflow-hidden z-30 animate-slide-down">
                            {canModeratePost && (
                                <>
                                    <button
                                        onClick={handleTogglePin}
                                        disabled={pinning}
                                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-left transition-colors hover:bg-discord-border-light/15 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Pin className={`w-3.5 h-3.5 ${isPinned ? 'text-amber-300' : 'text-discord-muted'}`} strokeWidth={2} />
                                        <span className={isPinned ? 'text-amber-300' : 'text-discord-light'}>{isPinned ? 'Unpin post' : 'Pin post'}</span>
                                    </button>
                                    <button
                                        onClick={handleToggleFeature}
                                        disabled={featuring}
                                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-left transition-colors hover:bg-discord-border-light/15 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Star className={`w-3.5 h-3.5 ${isFeatured ? 'text-sky-300' : 'text-discord-muted'}`} strokeWidth={2} />
                                        <span className={isFeatured ? 'text-sky-300' : 'text-discord-light'}>{isFeatured ? 'Remove featured' : 'Feature post'}</span>
                                    </button>
                                </>
                            )}
                            <button onClick={handleFlag} disabled={flagging || flagged}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-left transition-colors hover:bg-discord-border-light/15 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                                <Flag className={`w-3.5 h-3.5 ${flagged ? 'text-discord-red' : 'text-discord-muted'}`} strokeWidth={2} />
                                <span className={flagged ? 'text-discord-red' : 'text-discord-light'}>{flagged ? 'Reported' : 'Report / Flag'}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            {post.content && (
                <p className="text-sm text-discord-light leading-relaxed mb-4 whitespace-pre-wrap">{renderWithMentions(post.content)}</p>
            )}

            {/* Media Grid */}
            {imageMedia.length > 0 && (
                <div className={`grid ${mediaGridClass()} gap-2 mb-4 rounded-xl overflow-hidden`}>
                    {imageMedia.map((url, i) => (
                        <div key={i}
                            className={`relative overflow-hidden rounded-xl cursor-pointer group
                                ${imageMedia.length === 3 && i === 0 ? 'row-span-2' : ''}
                                ${imageMedia.length === 1 ? 'max-h-[400px]' : 'aspect-square'}`}
                            onClick={() => setLightboxImg(url)}>
                            <img src={url} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                        </div>
                    ))}
                </div>
            )}

            {/* Uploaded documents */}
            {fileMedia.length > 0 && (
                <div className="mb-4 space-y-2">
                    {fileMedia.map((url, i) => {
                        const nameFromUrl = decodeURIComponent(url.split('/').pop() || 'document');
                        return (
                            <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-between gap-3 rounded-lg border border-discord-border/70 bg-discord-darkest/50 px-3 py-2.5 hover:border-blurple/40 transition-colors"
                            >
                                <div className="min-w-0 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-discord-faint shrink-0" strokeWidth={2} />
                                    <span className="text-xs text-discord-light truncate">{nameFromUrl}</span>
                                </div>
                                <ExternalLink className="w-3.5 h-3.5 text-discord-faint shrink-0" strokeWidth={2} />
                            </a>
                        );
                    })}
                </div>
            )}

            {/* Resource links */}
            {resourceLinks.length > 0 && (
                <div className="mb-4 space-y-2">
                    {resourceLinks.map((link, i) => (
                        <a
                            key={link._id || `${link.url}-${i}`}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between gap-3 rounded-lg border border-discord-border/70 bg-discord-darkest/50 px-3 py-2.5 hover:border-blurple/40 transition-colors"
                        >
                            <div className="min-w-0 flex items-center gap-2">
                                <Link2 className="w-4 h-4 text-blurple shrink-0" strokeWidth={2} />
                                <span className="text-xs text-discord-light truncate">{link.label || link.url}</span>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-discord-faint shrink-0" strokeWidth={2} />
                        </a>
                    ))}
                </div>
            )}

            {/* Poll */}
            {hasPoll && (
                <div className="mb-4 p-4 bg-discord-darkest/60 rounded-xl border border-discord-border/50 animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                        <BarChart3 className="w-4 h-4 text-blurple" strokeWidth={2} />
                        <p className="text-sm font-bold text-discord-white">{post.poll.question}</p>
                    </div>
                    <div className="space-y-2">
                        {post.poll.options.map((option, i) => {
                            const voteCount = option.votes?.length || 0;
                            const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                            const isMyVote = userVotedIndex === i;
                            return (
                                <button key={option._id || i} onClick={() => !hasVoted && handleVote(i)} disabled={hasVoted || voting}
                                    className={`w-full relative overflow-hidden rounded-lg px-4 py-3 text-left transition-all duration-300 cursor-pointer select-none
                                        ${hasVoted
                                            ? 'border-2 ' + (isMyVote ? 'border-blurple bg-blurple/5' : 'border-discord-border bg-discord-darker/40')
                                            : 'border-2 border-discord-border hover:border-blurple/60 hover:bg-blurple/5'
                                        } disabled:cursor-default`}>
                                    {hasVoted && (
                                        <div className={`absolute inset-y-0 left-0 rounded-lg transition-all duration-700 ease-out ${isMyVote ? 'bg-blurple/15' : 'bg-discord-border-light/20'}`}
                                            style={{ width: `${pct}%` }} />
                                    )}
                                    <div className="relative flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {hasVoted && isMyVote && (
                                                <div className="w-4 h-4 rounded-full bg-blurple flex items-center justify-center">
                                                    <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                                                </div>
                                            )}
                                            <span className={`text-xs font-semibold ${isMyVote ? 'text-discord-white' : 'text-discord-light'}`}>{option.text}</span>
                                        </div>
                                        {hasVoted && <span className="text-xs font-bold text-discord-muted ml-2">{pct}%</span>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-discord-faint mt-2.5 text-center">
                        {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}{hasVoted && ' · You voted'}
                    </p>
                </div>
            )}

            {/* Tags */}
            {post.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                    {post.tags.map((tag) => (
                        <span key={tag} className="px-2.5 py-1 rounded-lg bg-blurple/10 text-[11px] font-semibold text-blurple border border-blurple/15">
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            {post.hashtags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                    {post.hashtags.map((tag) => (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => onHashtagClick?.(tag)}
                            className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-[11px] font-semibold text-sky-300 border border-sky-500/20 hover:bg-sky-500/15 transition-colors cursor-pointer"
                        >
                            #{tag}
                        </button>
                    ))}
                </div>
            )}

            {/* Actions bar */}
            <div className="flex items-center gap-5 pt-3 border-t border-discord-border/50">
                <button onClick={handleLike} disabled={liking}
                    className={`flex items-center gap-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer select-none
                        ${isLiked ? 'text-rose-400' : 'text-discord-muted hover:text-rose-400'}`}>
                    <Heart className={`w-4 h-4 transition-transform duration-200 ${liking ? 'scale-125' : 'scale-100'}`}
                        strokeWidth={2} fill={isLiked ? 'currentColor' : 'none'} />
                    <span>{post.likesCount || 0}</span>
                </button>

                <button onClick={toggleComments}
                    className="flex items-center gap-1.5 text-xs font-semibold text-discord-muted hover:text-discord-light transition-colors cursor-pointer">
                    <MessageCircle className="w-4 h-4" strokeWidth={2} />
                    <span>{post.commentsCount || 0}</span>
                    {showComments ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                <button onClick={handleSave} disabled={saving}
                    className={`ml-auto flex items-center gap-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer select-none
                        ${localSaved ? 'text-amber-400' : 'text-discord-muted hover:text-amber-400'}`}
                    title={localSaved ? 'Unsave post' : 'Save post'}>
                    <Bookmark className={`w-4 h-4 transition-transform duration-200 ${saving ? 'scale-125' : 'scale-100'}`}
                        strokeWidth={2} fill={localSaved ? 'currentColor' : 'none'} />
                </button>
            </div>

            {/* Comments section */}
            {showComments && (
                <div className="mt-4 space-y-3 animate-fade-in">
                    {loadingComments ? (
                        <div className="flex items-center justify-center py-4">
                            <div className="w-5 h-5 rounded-full border-2 border-blurple border-t-transparent animate-spin" />
                        </div>
                    ) : comments.length > 0 ? (
                        comments.map((c) => {
                            const cInitials = c.author?.name
                                ? c.author.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '?';
                            return (
                                <div key={c._id} className="flex items-start gap-2.5 pl-2">
                                    {c.author?.avatar ? (
                                        <img src={c.author.avatar} alt="" className="w-7 h-7 rounded-full object-cover border border-discord-border mt-0.5" />
                                    ) : (
                                        <div className="w-7 h-7 rounded-full bg-discord-darkest flex items-center justify-center text-[10px] font-bold text-discord-muted mt-0.5">
                                            {cInitials}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-discord-white">{c.author?.name}</span>
                                            {['premium', 'enterprise'].includes(c.author?.tier || 'free') && (
                                                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                                                    <Crown className="w-2.5 h-2.5 text-amber-400" strokeWidth={2.5} />
                                                </span>
                                            )}
                                            <span className="text-[10px] text-discord-faint">{timeAgo(c.createdAt)}</span>
                                        </div>
                                        <p className="text-xs text-discord-light leading-relaxed mt-0.5">{renderWithMentions(c.content)}</p>
                                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                            {(c.reactions || []).map((r) => (
                                                <button
                                                    key={`${c._id}-${r.emoji}`}
                                                    type="button"
                                                    onClick={() => handleCommentReaction(c._id, r.emoji)}
                                                    className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${r.reacted ? 'bg-blurple/20 border-blurple/40 text-discord-white' : 'bg-discord-darkest border-discord-border text-discord-muted hover:text-discord-light'}`}
                                                >
                                                    {r.emoji} {r.count}
                                                </button>
                                            ))}
                                            {REACTION_EMOJIS.map((emoji) => {
                                                const existing = (c.reactions || []).find((r) => r.emoji === emoji);
                                                if (existing) return null;
                                                return (
                                                    <button
                                                        key={`${c._id}-add-${emoji}`}
                                                        type="button"
                                                        onClick={() => handleCommentReaction(c._id, emoji)}
                                                        className="px-2 py-0.5 rounded-full text-[11px] border bg-discord-darkest border-discord-border text-discord-faint hover:text-discord-light transition-colors"
                                                    >
                                                        {emoji}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-xs text-discord-faint text-center py-2">No comments yet. Be the first!</p>
                    )}

                    <form onSubmit={handleSubmitComment} className="flex items-center gap-2 pt-2">
                        <div className="flex-1">
                            <MentionInput
                                value={commentText}
                                onChange={handleCommentChange}
                                mentions={commentMentions}
                                placeholder="Write a reply… (type @ to mention)"
                                singleLine={true}
                            />
                        </div>
                        <button type="submit" disabled={!commentText.trim() || submitting}
                            className="w-9 h-9 rounded-lg bg-blurple flex items-center justify-center shadow-sm hover:bg-blurple-hover transition-all disabled:opacity-40 cursor-pointer shrink-0">
                            {submitting
                                ? <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                : <Send className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />}
                        </button>
                    </form>
                </div>
            )}

            {/* Lightbox */}
            {lightboxImg && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in cursor-pointer"
                    onClick={() => setLightboxImg(null)}>
                    <img src={lightboxImg} alt="" className="max-w-full max-h-[90vh] rounded-xl object-contain shadow-2xl animate-scale-in"
                        onClick={(e) => e.stopPropagation()} />
                </div>
            )}
        </article>
    );
};

export default PostCard;
