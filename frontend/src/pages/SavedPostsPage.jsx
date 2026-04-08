import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bookmark, Sparkles, ArrowLeft, LogOut, Search, Hash, Pin, Star } from 'lucide-react';
import Button from '../components/Button';
import PostCard from '../components/PostCard';
import NotificationBell from '../components/NotificationBell';
import { useFeedStore } from '../stores/feedStore';
import { useAuthStore } from '../stores/authStore';

const SavedPostsPage = () => {
    const [mounted, setMounted] = useState(false);
    const [savedPosts, setSavedPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [selectedHashtag, setSelectedHashtag] = useState('');
    const [onlyPinned, setOnlyPinned] = useState(false);
    const [onlyFeatured, setOnlyFeatured] = useState(false);
    const [sortBy, setSortBy] = useState('latest');
    const [trendingHashtags, setTrendingHashtags] = useState([]);
    const navigate = useNavigate();

    const { fetchSavedPosts, fetchTrendingHashtags } = useFeedStore();
    const { user, logout } = useAuthStore();

    useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);

    useEffect(() => {
        (async () => {
            try {
                const posts = await fetchSavedPosts();
                setSavedPosts(posts);
            } catch { }
            setLoading(false);
        })();
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const tags = await fetchTrendingHashtags();
                setTrendingHashtags(tags);
            } catch {
                setTrendingHashtags([]);
            }
        })();
    }, [fetchTrendingHashtags]);

    const filteredPosts = useMemo(() => {
        const text = query.trim().toLowerCase();
        let next = [...savedPosts];

        if (text) {
            next = next.filter((post) => {
                const content = (post.content || '').toLowerCase();
                const tags = (post.tags || []).join(' ').toLowerCase();
                const hashtags = (post.hashtags || []).join(' ').toLowerCase();
                const author = (post.author?.name || '').toLowerCase();
                return content.includes(text) || tags.includes(text) || hashtags.includes(text) || author.includes(text);
            });
        }

        if (selectedHashtag) {
            next = next.filter((post) => (post.hashtags || []).includes(selectedHashtag));
        }

        if (onlyPinned) next = next.filter((post) => !!post.pinnedAt);
        if (onlyFeatured) next = next.filter((post) => !!post.featuredAt);

        next.sort((a, b) => {
            if (sortBy === 'top') {
                const aScore = (a.likesCount || 0) + (a.commentsCount || 0);
                const bScore = (b.likesCount || 0) + (b.commentsCount || 0);
                return bScore - aScore;
            }
            if (sortBy === 'featured') {
                return new Date(b.featuredAt || 0) - new Date(a.featuredAt || 0) || new Date(b.createdAt) - new Date(a.createdAt);
            }
            if (sortBy === 'pinned') {
                return new Date(b.pinnedAt || 0) - new Date(a.pinnedAt || 0) || new Date(b.createdAt) - new Date(a.createdAt);
            }
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        return next;
    }, [savedPosts, query, selectedHashtag, onlyPinned, onlyFeatured, sortBy]);

    const handleLogout = async () => { await logout(); navigate('/login'); };

    return (
        <div className="min-h-screen min-h-[100dvh] bg-discord-darkest relative overflow-hidden flex flex-col">
            {/* Ambient */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-28 -left-24 w-72 h-72 rounded-full bg-amber-500/[0.05] blur-[100px]" />
                <div className="absolute bottom-[20%] -right-20 w-56 h-56 rounded-full bg-blurple/[0.04] blur-[80px]" />
            </div>

            {/* Header */}
            <header className={`sticky top-0 z-30 bg-discord-darkest/80 backdrop-blur-xl border-b border-discord-border/30
                flex items-center justify-between px-4 sm:px-8 py-3.5
                transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'}`}>
                <div className="flex items-center gap-2 shrink-0">
                    <Link to="/feed" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blurple flex items-center justify-center shadow-md shadow-blurple/20">
                            <Sparkles className="w-4 h-4 text-white" strokeWidth={2.5} />
                        </div>
                        <span className="text-sm font-bold tracking-tight text-white hidden sm:inline">CircleCore</span>
                    </Link>
                </div>
                <div className="flex items-center gap-2">
                    <NotificationBell />
                    <Button variant="ghost" size="sm" onClick={() => navigate('/feed')}>
                        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
                        <span className="hidden sm:inline ml-1">Back to Feed</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleLogout} icon={<LogOut className="w-3.5 h-3.5" strokeWidth={2} />}>
                        <span className="hidden sm:inline">Log Out</span>
                    </Button>
                </div>
            </header>

            {/* Body */}
            <main className="relative z-10 flex-1 w-full max-w-[700px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
                {/* Title */}
                <div className={`mb-6 transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md">
                            <Bookmark className="w-5 h-5 text-white" strokeWidth={2} />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Saved Posts</h1>
                            <p className="text-sm text-discord-muted font-medium">
                                {loading ? 'Loading…' : `${filteredPosts.length} result${filteredPosts.length !== 1 ? 's' : ''} from ${savedPosts.length} saved`}
                            </p>
                        </div>
                    </div>
                </div>

                {!loading && (
                    <div className="mb-5 rounded-2xl border border-discord-border/50 bg-discord-darker/70 p-3.5 sm:p-4 space-y-3">
                        <div className="flex items-center gap-2 rounded-xl border border-discord-border/60 bg-discord-darkest/50 px-3 py-2.5">
                            <Search className="w-4 h-4 text-discord-faint shrink-0" />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search saved posts, tags, hashtags..."
                                className="bg-transparent text-sm text-discord-light placeholder:text-discord-faint w-full outline-none"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setOnlyPinned((v) => !v)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${onlyPinned ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-discord-darkest/60 text-discord-muted border-discord-border hover:text-discord-light'}`}
                            >
                                <Pin className="w-3.5 h-3.5" /> Pinned
                            </button>
                            <button
                                type="button"
                                onClick={() => setOnlyFeatured((v) => !v)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${onlyFeatured ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' : 'bg-discord-darkest/60 text-discord-muted border-discord-border hover:text-discord-light'}`}
                            >
                                <Star className="w-3.5 h-3.5" /> Featured
                            </button>

                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="ml-auto min-w-[140px] rounded-lg border border-discord-border bg-discord-darkest/60 px-2.5 py-1.5 text-xs font-semibold text-discord-light outline-none"
                            >
                                <option value="latest">Latest</option>
                                <option value="top">Top</option>
                                <option value="featured">Featured first</option>
                                <option value="pinned">Pinned first</option>
                            </select>
                        </div>

                        {trendingHashtags.length > 0 && (
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-discord-faint">
                                    <Hash className="w-3.5 h-3.5" /> Trending hashtags
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedHashtag('')}
                                        className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${!selectedHashtag ? 'bg-blurple/15 text-blurple border-blurple/35' : 'bg-discord-darkest/60 text-discord-muted border-discord-border'}`}
                                    >
                                        All
                                    </button>
                                    {trendingHashtags.slice(0, 8).map((row) => (
                                        <button
                                            key={row.tag}
                                            type="button"
                                            onClick={() => setSelectedHashtag((prev) => prev === row.tag ? '' : row.tag)}
                                            className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${selectedHashtag === row.tag ? 'bg-sky-500/15 text-sky-300 border-sky-500/35' : 'bg-discord-darkest/60 text-discord-muted border-discord-border hover:text-discord-light'}`}
                                        >
                                            #{row.tag} <span className="text-discord-faint">{row.count}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 rounded-full border-3 border-amber-400 border-t-transparent animate-spin" />
                    </div>
                )}

                {/* Empty state */}
                {!loading && filteredPosts.length === 0 && (
                    <div className={`transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        <div className="bg-discord-darker rounded-2xl border border-discord-border/50 p-10 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-5">
                                <Bookmark className="w-7 h-7 text-amber-400" strokeWidth={1.5} />
                            </div>
                            <h2 className="text-lg font-bold text-white mb-2">No posts match this view</h2>
                            <p className="text-sm text-discord-faint max-w-xs mx-auto mb-6">
                                Try clearing filters or save more posts from the feed.
                            </p>
                            <Button variant="primary" onClick={() => navigate('/feed')}>Browse Feed</Button>
                        </div>
                    </div>
                )}

                {/* Posts */}
                {!loading && filteredPosts.length > 0 && (
                    <div className="space-y-4">
                        {filteredPosts.map((post, i) => (
                            <div key={post._id}
                                className={`transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                                style={{ transitionDelay: `${200 + i * 60}ms` }}>
                                {post.communityName && (
                                    <p className="text-[10px] font-bold text-discord-faint uppercase tracking-wider mb-1.5 pl-1">
                                        from {post.communityName}
                                    </p>
                                )}
                                <PostCard post={post} onHashtagClick={setSelectedHashtag} />
                            </div>
                        ))}
                    </div>
                )}

                <div className="h-8" />
            </main>
        </div>
    );
};

export default SavedPostsPage;
