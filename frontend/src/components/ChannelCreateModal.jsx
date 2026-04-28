import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Hash, Volume2, Megaphone, X, Smile } from 'lucide-react';

const CHANNEL_TYPES = [
    {
        id: 'text',
        label: 'Text',
        icon: Hash,
        desc: 'Send messages, images, GIFs, emoji, opinions, and puns',
        enabled: true,
    },
    {
        id: 'voice',
        label: 'Voice',
        icon: Volume2,
        desc: 'Hang out together with voice, video, and screen share',
        enabled: true,
    },
    {
        id: 'announcement',
        label: 'Announcement',
        icon: Megaphone,
        desc: 'Broadcast updates to your community',
        enabled: true,
    },
];

const ChannelCreateModal = ({ isOpen, onClose, onCreate, isLoading, categories = [], initialCategoryId = null }) => {
    const [type, setType] = useState('text');
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState(initialCategoryId);
    const [isPrivate, setIsPrivate] = useState(false);
    const [isPremium, setIsPremium] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setCategoryId(initialCategoryId);
        }
    }, [isOpen, initialCategoryId]);

    const typeConfig = useMemo(() => CHANNEL_TYPES.find((t) => t.id === type) || CHANNEL_TYPES[0], [type]);

    const handleCreate = async () => {
        if (!name.trim()) {
            setError('Channel name is required');
            return;
        }
        setError('');
        await onCreate?.({ name: name.trim(), type, isPrivate, isPremium, categoryId });
        setName('');
        setIsPrivate(false);
        setIsPremium(false);
        setType('text');
        setCategoryId(null);
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div
                className="w-[520px] max-w-[92vw] rounded-2xl bg-[#2b2d31] border border-discord-border/50 shadow-2xl p-6 animate-scale-in flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Create Channel</h2>
                        <p className="text-sm text-discord-faint mt-1">in {categories.find(c => c._id === categoryId)?.name || 'Uncategorized'}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-discord-darkest flex items-center justify-center hover:bg-discord-border-light/40 cursor-pointer"
                    >
                        <X className="w-4 h-4 text-discord-faint" />
                    </button>
                </div>

                <div className="mt-6 overflow-y-auto pr-1">
                    <p className="text-sm font-semibold text-discord-light mb-3">Channel Type</p>
                    <div className="space-y-2">
                        {CHANNEL_TYPES.map((t) => {
                            const Icon = t.icon;
                            const selected = type === t.id;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => t.enabled && setType(t.id)}
                                    className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border transition-all text-left cursor-pointer
                                        ${selected ? 'border-blurple bg-discord-darkest/70' : 'border-discord-border/50 bg-discord-darkest/40 hover:bg-discord-darkest/60'}
                                        ${t.enabled ? '' : 'opacity-50 cursor-not-allowed'}`}
                                >
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${selected ? 'border-blurple' : 'border-discord-faint'}`}>
                                        {selected && <span className="w-2.5 h-2.5 rounded-full bg-blurple" />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <Icon className="w-5 h-5 text-discord-faint" />
                                            <span className="text-sm font-semibold text-white">{t.label}</span>
                                        </div>
                                        <p className="text-xs text-discord-faint mt-1">{t.desc}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-6">
                        <p className="text-sm font-semibold text-discord-light mb-2">Category (Optional)</p>
                        <select
                            value={categoryId || ''}
                            onChange={(e) => setCategoryId(e.target.value || null)}
                            className="w-full bg-discord-darkest border border-discord-border/50 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blurple transition-colors"
                        >
                            <option value="">Uncategorized</option>
                            {categories.map(cat => (
                                <option key={cat._id} value={cat._id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="mt-6">
                        <p className="text-sm font-semibold text-discord-light mb-2">Channel Name</p>
                        <div className="flex items-center gap-2 rounded-lg bg-discord-darkest border border-discord-border/50 px-3 py-2">
                            <Hash className="w-4 h-4 text-discord-faint" />
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="name"
                                className="flex-1 bg-transparent text-sm text-white placeholder:text-discord-faint/60 outline-none"
                            />
                            <Smile className="w-4 h-4 text-discord-faint" />
                        </div>
                        {error && <p className="text-xs text-discord-red mt-2">{error}</p>}
                    </div>

                    <div className="mt-5 flex items-start justify-between gap-4">
                        <div className="flex items-start gap-2">
                            <div className="w-8 h-8 rounded-full bg-discord-darkest flex items-center justify-center">
                                <Hash className="w-4 h-4 text-discord-faint" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-white">Private Channel</p>
                                <p className="text-xs text-discord-faint">
                                    Only selected members and roles will be able to view this channel.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsPrivate((v) => !v)}
                            className={`w-12 h-6 rounded-full relative transition-colors shrink-0 ${isPrivate ? 'bg-blurple' : 'bg-discord-border/40'}`}
                        >
                            <span
                                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${isPrivate ? 'left-6' : 'left-0.5'}`}
                            />
                        </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-discord-border/60 bg-discord-darkest/60 px-4 py-3">
                        <div>
                            <p className="text-sm font-semibold text-white">Premium-only Channel</p>
                            <p className="text-xs text-discord-faint">Only subscribers can access this channel.</p>
                        </div>
                        <button
                            onClick={() => setIsPremium((prev) => !prev)}
                            className={`w-12 h-7 rounded-full border transition-all shrink-0 ${
                                isPremium ? 'bg-amber-500/20 border-amber-500/50' : 'bg-discord-darkest border-discord-border/60'
                            }`}
                            type="button"
                        >
                            <span
                                className={`block w-5 h-5 rounded-full transform transition-all ${
                                    isPremium ? 'translate-x-5 bg-amber-400' : 'translate-x-1 bg-discord-faint'
                                }`}
                            />
                        </button>
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-discord-darkest text-sm font-semibold text-discord-light hover:bg-discord-border-light/30 cursor-pointer">
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={isLoading}
                        className="px-5 py-2 rounded-lg bg-blurple text-sm font-semibold text-white hover:bg-blurple-hover disabled:opacity-60 cursor-pointer"
                    >
                        Create Channel
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ChannelCreateModal;
