export const EMOJI_CATALOG = [
    { emoji: '😀', shortcodes: ['grinning', 'smile'] },
    { emoji: '😃', shortcodes: ['smiley', 'happy'] },
    { emoji: '😄', shortcodes: ['grin'] },
    { emoji: '😁', shortcodes: ['beaming'] },
    { emoji: '😅', shortcodes: ['sweat_smile'] },
    { emoji: '😂', shortcodes: ['joy', 'lol'] },
    { emoji: '🤣', shortcodes: ['rofl'] },
    { emoji: '😊', shortcodes: ['blush'] },
    { emoji: '😉', shortcodes: ['wink'] },
    { emoji: '🙂', shortcodes: ['slight_smile'] },
    { emoji: '🙃', shortcodes: ['upside_down'] },
    { emoji: '😍', shortcodes: ['heart_eyes'] },
    { emoji: '😘', shortcodes: ['kissing_heart'] },
    { emoji: '😎', shortcodes: ['sunglasses', 'cool'] },
    { emoji: '🤩', shortcodes: ['star_struck'] },
    { emoji: '🥳', shortcodes: ['partying_face', 'celebrate'] },
    { emoji: '🤔', shortcodes: ['thinking'] },
    { emoji: '😴', shortcodes: ['sleeping'] },
    { emoji: '😭', shortcodes: ['sob', 'cry'] },
    { emoji: '😡', shortcodes: ['rage', 'angry'] },
    { emoji: '😱', shortcodes: ['scream'] },
    { emoji: '🤯', shortcodes: ['mind_blown'] },
    { emoji: '👍', shortcodes: ['thumbsup', '+1'] },
    { emoji: '👎', shortcodes: ['thumbsdown', '-1'] },
    { emoji: '👏', shortcodes: ['clap'] },
    { emoji: '🙏', shortcodes: ['pray', 'thanks'] },
    { emoji: '🙌', shortcodes: ['raised_hands'] },
    { emoji: '👀', shortcodes: ['eyes'] },
    { emoji: '🤝', shortcodes: ['handshake'] },
    { emoji: '🔥', shortcodes: ['fire', 'lit'] },
    { emoji: '💯', shortcodes: ['100'] },
    { emoji: '✨', shortcodes: ['sparkles'] },
    { emoji: '⭐', shortcodes: ['star'] },
    { emoji: '🎉', shortcodes: ['tada', 'party'] },
    { emoji: '🎊', shortcodes: ['confetti_ball'] },
    { emoji: '✅', shortcodes: ['white_check_mark', 'check'] },
    { emoji: '❌', shortcodes: ['x', 'cross_mark'] },
    { emoji: '⚠️', shortcodes: ['warning'] },
    { emoji: '🚀', shortcodes: ['rocket'] },
    { emoji: '💡', shortcodes: ['bulb', 'idea'] },
    { emoji: '❤️', shortcodes: ['heart', 'love'] },
    { emoji: '🧡', shortcodes: ['orange_heart'] },
    { emoji: '💛', shortcodes: ['yellow_heart'] },
    { emoji: '💚', shortcodes: ['green_heart'] },
    { emoji: '💙', shortcodes: ['blue_heart'] },
    { emoji: '💜', shortcodes: ['purple_heart'] },
    { emoji: '🖤', shortcodes: ['black_heart'] },
    { emoji: '🤍', shortcodes: ['white_heart'] },
    { emoji: '🤎', shortcodes: ['brown_heart'] },
    { emoji: '💔', shortcodes: ['broken_heart'] },
    { emoji: '😮‍💨', shortcodes: ['relieved', 'exhale'] },
    { emoji: '🤗', shortcodes: ['hugging', 'hugs'] },
    { emoji: '🤝', shortcodes: ['deal'] },
    { emoji: '🫡', shortcodes: ['saluting_face', 'salute'] },
];

export const CHAT_REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '👏'];

const SHORTCODE_MAP = EMOJI_CATALOG.reduce((map, item) => {
    item.shortcodes.forEach((name) => {
        map[name.toLowerCase()] = item.emoji;
    });
    return map;
}, {});

export const normalizeEmojiShortcodes = (value = '') => {
    if (!value || !value.includes(':')) return value;
    return value.replace(/:([a-z0-9_+\-]+):/gi, (full, name) => {
        const normalized = String(name || '').toLowerCase();
        return SHORTCODE_MAP[normalized] || full;
    });
};
