import { useMemo, useState } from 'react';

const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg';

const emojiToCodepoint = (emoji = '') => (
    Array.from(String(emoji))
        .map((char) => char.codePointAt(0).toString(16).toLowerCase())
        .filter((code) => code !== 'fe0f')
        .join('-')
);

const EmojiArt = ({ emoji, className = 'w-4 h-4', title = '' }) => {
    const [failed, setFailed] = useState(false);

    const src = useMemo(() => {
        const codepoint = emojiToCodepoint(emoji);
        if (!codepoint) return '';
        return `${TWEMOJI_BASE}/${codepoint}.svg`;
    }, [emoji]);

    if (!emoji) return null;

    if (failed || !src) {
        return <span className={className} aria-hidden="true">{emoji}</span>;
    }

    return (
        <img
            src={src}
            alt={title || emoji}
            title={title || emoji}
            className={`inline-block align-middle select-none ${className}`}
            draggable={false}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
        />
    );
};

export default EmojiArt;
