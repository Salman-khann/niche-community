import { useState, useEffect, useRef } from 'react';
import { Search, X, User as UserIcon, FileText, Loader2 } from 'lucide-react';
import { apiFetch } from '../stores/apiFetch';
import { apiUrl } from '../config/urls';

const SEARCH_URL = apiUrl('/api/search');

const SearchBar = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const containerRef = useRef(null);
    const debounceRef = useRef(null);
    const abortRef = useRef(null);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (abortRef.current) abortRef.current.abort();
        if (query.trim().length < 2) { setResults(null); setIsOpen(false); return; }
        setIsLoading(true);
        debounceRef.current = setTimeout(async () => {
            const controller = new AbortController();
            abortRef.current = controller;
            try {
                const params = new URLSearchParams({ q: query.trim(), limit: '10' });
                const res = await apiFetch(`${SEARCH_URL}?${params.toString()}`, {
                    credentials: 'include',
                    signal: controller.signal,
                });
                const data = await res.json();
                if (data.success) { setResults(data); setIsOpen(true); }
            } catch (error) {
                if (error?.name !== 'AbortError') {
                    // silently fail on non-abort network errors
                }
            }
            finally { setIsLoading(false); }
        }, 300);
        return () => {
            clearTimeout(debounceRef.current);
            if (abortRef.current) abortRef.current.abort();
        };
    }, [query]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const handleEsc = (e) => { if (e.key === 'Escape') { setIsOpen(false); setQuery(''); } };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, []);

    const clear = () => { setQuery(''); setResults(null); setIsOpen(false); };

    const hasUsers = results?.users?.length > 0;
    const hasPosts = results?.posts?.length > 0;
    const hasResults = hasUsers || hasPosts;

    return (
        <div ref={containerRef} className="relative w-full max-w-xs sm:max-w-sm">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-discord-faint pointer-events-none" strokeWidth={2} />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => { if (results) setIsOpen(true); }}
                    placeholder="Search people & posts…"
                    className="w-full pl-9 pr-8 py-2 rounded-lg bg-discord-darkest text-xs text-discord-white font-medium placeholder:text-discord-faint/50 outline-none border border-discord-darkest transition-all duration-200 focus:border-blurple focus:ring-2 focus:ring-blurple/30"
                />
                {query && (
                    <button onClick={clear}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full hover:bg-discord-border-light/30 flex items-center justify-center transition-colors cursor-pointer">
                        {isLoading
                            ? <Loader2 className="w-3 h-3 text-discord-muted animate-spin" strokeWidth={2} />
                            : <X className="w-3 h-3 text-discord-muted" strokeWidth={2.5} />}
                    </button>
                )}
            </div>

            {isOpen && results && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-discord-darker rounded-xl shadow-2xl border border-discord-border overflow-hidden z-50 animate-slide-down max-h-80 overflow-y-auto">
                    {!hasResults && (
                        <div className="px-4 py-6 text-center">
                            <p className="text-xs font-semibold text-discord-light">No results for &ldquo;{query}&rdquo;</p>
                            <p className="text-[10px] text-discord-faint mt-0.5">Try a different search term</p>
                        </div>
                    )}

                    {hasUsers && (
                        <div>
                            <div className="px-4 pt-3 pb-1.5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-discord-faint">People</p>
                            </div>
                            {results.users.map((u) => (
                                <div key={u._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-discord-border-light/15 transition-colors cursor-pointer">
                                    {u.avatar ? (
                                        <img src={u.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-discord-border shrink-0" />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blurple to-indigo-600 flex items-center justify-center shrink-0">
                                            <UserIcon className="w-3.5 h-3.5 text-white" strokeWidth={2} />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-discord-white truncate">{u.name}</p>
                                        <p className="text-[10px] text-discord-faint truncate">{u.email}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {hasUsers && hasPosts && <div className="border-t border-discord-border mx-3" />}

                    {hasPosts && (
                        <div>
                            <div className="px-4 pt-3 pb-1.5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-discord-faint">Posts</p>
                            </div>
                            {results.posts.map((p) => (
                                <div key={p._id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-discord-border-light/15 transition-colors cursor-pointer">
                                    <div className="w-8 h-8 rounded-lg bg-discord-darkest flex items-center justify-center shrink-0 mt-0.5">
                                        <FileText className="w-3.5 h-3.5 text-discord-muted" strokeWidth={1.5} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold text-discord-light line-clamp-2 leading-snug">
                                            {p.content.length > 120 ? p.content.slice(0, 120) + '…' : p.content}
                                        </p>
                                        <p className="text-[10px] text-discord-faint mt-0.5">by {p.author?.name || 'Unknown'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchBar;
