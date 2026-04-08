import { useEffect, useState } from 'react';
import { Check, ChevronRight, Copy, Pencil, Sparkles, Smile, X } from 'lucide-react';

const STATUS_OPTIONS = [
    { id: 'online', label: 'Online', dot: 'bg-discord-green' },
    { id: 'idle', label: 'Idle', dot: 'bg-yellow-400' },
    { id: 'dnd', label: 'Do Not Disturb', dot: 'bg-red-500', desc: 'You will not receive desktop notifications' },
    { id: 'offline', label: 'Invisible', dot: 'bg-discord-faint/60', desc: 'You will appear offline' },
];

const ProfilePopout = ({ isOpen, onClose, anchorClassName = '', profile, user, onUpdatePresence, onUpdateStatus, onEditProfile }) => {
    const [showStatusMenu, setShowStatusMenu] = useState(false);
    const [showCustomStatus, setShowCustomStatus] = useState(false);
    const [customStatusText, setCustomStatusText] = useState('');
    const [copied, setCopied] = useState(false);
    const [isBioExpanded, setIsBioExpanded] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsBioExpanded(false);
            setCustomStatusText(profile?.status || '');
            setShowStatusMenu(false);
            setShowCustomStatus(false);
        }
    }, [isOpen, profile?._id, user?._id]);

    if (!isOpen) return null;

    const displayName = profile?.displayName || user?.name || 'User';
    const username = user?._id || user?.username || (user?.email ? user.email.split('@')[0] : 'user');
    const statusText = (profile?.status || '').trim() || 'Set a custom status';
    const presence = profile?.presence || 'online';
    const isPremium = ['premium', 'enterprise'].includes(profile?.tier || user?.tier || 'free');
    const showBioToggle = statusText.length > 140;

    const handleCopyId = async () => {
        try {
            await navigator.clipboard.writeText(user?._id || '');
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch {
            // no-op
        }
    };

    return (
        <div className="fixed inset-0 z-[70]" onClick={onClose}>
            <div
                className={`absolute bottom-20 left-1/2 -translate-x-1/2 w-[92vw] max-w-[360px] md:w-[360px] md:left-auto md:translate-x-0 rounded-2xl bg-discord-darker border border-discord-border shadow-2xl overflow-hidden animate-scale-in ${anchorClassName}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="h-24 bg-gradient-to-r from-[#2f3136] via-[#35393f] to-[#3b3f46] relative">
                    <div className="absolute -bottom-10 left-5">
                        {profile?.avatar ? (
                            <img
                                src={profile.avatar}
                                alt=""
                                className="w-20 h-20 rounded-full object-cover border-4 border-discord-darker shadow-lg"
                            />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-discord-darkest flex items-center justify-center text-xl font-bold border-4 border-discord-darker shadow-lg">
                                {displayName.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span className={`absolute bottom-2 right-2 w-4 h-4 rounded-full border-4 border-discord-darker ${
                            presence === 'dnd' ? 'bg-red-500' : presence === 'idle' ? 'bg-yellow-400' : presence === 'offline' ? 'bg-discord-faint/60' : 'bg-discord-green'
                        }`} />
                    </div>
                </div>

                <div className="pt-12 px-5 pb-4">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-lg font-semibold text-discord-white">{displayName}</p>
                            <div className="flex items-center gap-2 text-sm text-discord-faint">
                                <span>{username}</span>
                                <button
                                    onClick={handleCopyId}
                                    className="flex items-center gap-1 text-xs text-discord-faint hover:text-white"
                                >
                                    <Copy className="w-3 h-3" />
                                    {copied ? 'Copied' : 'Copy ID'}
                                </button>
                            </div>
                            {isPremium && (
                                <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-500/15 to-yellow-500/15 border border-amber-500/25 text-[11px] font-semibold text-amber-200">
                                    <Sparkles className="w-3 h-3" />
                                    Premium
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-2xl bg-discord-darkest text-sm text-discord-light">
                        <span className={`mt-1 w-2.5 h-2.5 shrink-0 rounded-full ${
                            presence === 'dnd' ? 'bg-red-500' : presence === 'idle' ? 'bg-yellow-400' : presence === 'offline' ? 'bg-discord-faint/60' : 'bg-discord-green'
                        }`} />
                        <div className="flex-1 min-w-0">
                            <p className={`leading-snug break-words ${isBioExpanded ? '' : 'line-clamp-3'}`}>
                                {statusText}
                            </p>
                            {showBioToggle && (
                                <button
                                    onClick={() => setIsBioExpanded((v) => !v)}
                                    className="mt-1 text-[11px] font-semibold text-blurple hover:text-blurple-hover"
                                >
                                    {isBioExpanded ? 'Show less' : 'Read more'}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 rounded-xl bg-discord-darkest/70 border border-discord-border/60 divide-y divide-discord-border/50 text-sm text-discord-light">
                        <button
                            onClick={() => { onEditProfile?.(); onClose?.(); }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-discord-border-light/20 cursor-pointer"
                        >
                            <Pencil className="w-4 h-4 text-discord-faint" />
                            <span>Edit Profile</span>
                        </button>
                        <button
                            onClick={() => setShowStatusMenu((v) => !v)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-discord-border-light/20 cursor-pointer"
                        >
                            <div className="flex items-center gap-3">
                                <span className={`w-3 h-3 rounded-full ${
                                    presence === 'dnd' ? 'bg-red-500' : presence === 'idle' ? 'bg-yellow-400' : presence === 'offline' ? 'bg-discord-faint/60' : 'bg-discord-green'
                                }`} />
                                <span>{STATUS_OPTIONS.find((s) => s.id === presence)?.label || 'Online'}</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-discord-faint" />
                        </button>
                        <button
                            onClick={() => setShowCustomStatus(true)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-discord-border-light/20 cursor-pointer"
                        >
                            <div className="flex items-center gap-3">
                                <Smile className="w-4 h-4 text-discord-faint" />
                                <span>Set Custom Status</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-discord-faint" />
                        </button>
                    </div>
                </div>
            </div>

            {showStatusMenu && (
                <div className={`absolute bottom-24 left-1/2 -translate-x-1/2 w-[92vw] max-w-[320px] md:w-[300px] md:left-auto md:translate-x-[380px] rounded-2xl bg-discord-darker border border-discord-border shadow-2xl overflow-hidden animate-slide-right ${anchorClassName}`}>
                    {STATUS_OPTIONS.map((s) => {
                        return (
                            <button
                                key={s.id}
                                onClick={() => { onUpdatePresence?.(s.id); setShowStatusMenu(false); }}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-discord-border-light/20 cursor-pointer text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`w-3 h-3 rounded-full ${s.dot}`} />
                                    <div className="flex flex-col items-start">
                                        <p className="text-sm font-semibold text-white text-left">{s.label}</p>
                                        {s.desc && <p className="text-[11px] text-discord-faint text-left">{s.desc}</p>}
                                    </div>
                                </div>
                                {presence === s.id && <Check className="w-4 h-4 text-discord-green" />}
                            </button>
                        );
                    })}
                </div>
            )}

            {showCustomStatus && (
                <div className={`absolute bottom-24 left-1/2 -translate-x-1/2 w-[92vw] max-w-[340px] md:w-[320px] md:left-auto md:translate-x-[380px] rounded-2xl bg-discord-darker border border-discord-border shadow-2xl overflow-hidden animate-slide-right ${anchorClassName}`}>
                    <div className="px-4 py-3 border-b border-discord-border/60 flex items-center justify-between">
                        <p className="text-sm font-semibold text-white">Custom Status</p>
                        <button
                            onClick={() => setShowCustomStatus(false)}
                            className="w-7 h-7 rounded-md hover:bg-discord-border-light/20 flex items-center justify-center"
                        >
                            <X className="w-4 h-4 text-discord-faint" />
                        </button>
                    </div>
                    <div className="p-4 space-y-3">
                        <input
                            type="text"
                            maxLength={120}
                            value={customStatusText}
                            onChange={(e) => setCustomStatusText(e.target.value)}
                            placeholder="What's your status?"
                            className="w-full rounded-md bg-discord-darkest border border-discord-border/60 text-discord-white text-sm px-3 py-2 outline-none focus:border-blurple"
                        />
                        <div className="flex items-center justify-end gap-2">
                            <button
                                onClick={async () => {
                                    await onUpdateStatus?.('');
                                    setCustomStatusText('');
                                    setShowCustomStatus(false);
                                }}
                                className="px-3 py-1.5 rounded-md text-xs font-semibold text-discord-faint hover:bg-discord-border-light/20"
                            >
                                Clear
                            </button>
                            <button
                                onClick={async () => {
                                    await onUpdateStatus?.(customStatusText.trim());
                                    setShowCustomStatus(false);
                                }}
                                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-blurple text-white hover:bg-blurple-hover"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfilePopout;
