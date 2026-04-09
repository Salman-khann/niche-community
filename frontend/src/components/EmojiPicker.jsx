import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import EmojiArt from './EmojiArt';
import { EMOJI_CATALOG } from '../utils/emojiShortcodes';

const EmojiPicker = ({ onSelect, onClose }) => {
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase().replace(/^:|:$/g, '');
        if (!q) return EMOJI_CATALOG;
        return EMOJI_CATALOG.filter((item) => item.shortcodes.some((name) => name.includes(q)));
    }, [query]);

    return (
        <div className="absolute right-2 bottom-12 w-72 rounded-xl bg-discord-darkest border border-discord-border/60 shadow-xl p-3 z-40 animate-scale-in">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-discord-faint">Emojis</span>
                <button
                    onClick={onClose}
                    className="w-6 h-6 rounded-md hover:bg-discord-border/50 flex items-center justify-center"
                >
                    <X className="w-3.5 h-3.5 text-discord-faint" />
                </button>
            </div>

            <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-discord-faint" />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Find emoji"
                    className="w-full h-8 rounded-md border border-discord-border/60 bg-[#17191f] pl-8 pr-2 text-xs text-discord-light placeholder:text-discord-faint/70 outline-none"
                />
            </div>

            <div className="max-h-56 overflow-y-auto pr-1 space-y-1">
                {filtered.map((item) => (
                    <button
                        key={`${item.emoji}-${item.shortcodes[0]}`}
                        onClick={() => onSelect?.(item.emoji)}
                        className="w-full rounded-md hover:bg-discord-border/40 px-2 py-1.5 flex items-center gap-2 text-left"
                        title={`:${item.shortcodes[0]}:`}
                    >
                        <EmojiArt emoji={item.emoji} className="w-[18px] h-[18px]" />
                        <span className="text-xs text-discord-light">:{item.shortcodes[0]}:</span>
                    </button>
                ))}
                {filtered.length === 0 && (
                    <div className="text-xs text-discord-faint px-2 py-2">No emoji found.</div>
                )}
            </div>
        </div>
    );
};

export default EmojiPicker;
