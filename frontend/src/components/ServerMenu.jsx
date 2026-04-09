import { CalendarPlus, Lock, Plus, Settings, UserPlus } from 'lucide-react';

const ServerMenu = ({ isOpen, onClose, onInvite, onCreateChannel, onCreateEvent, onServerSettings, hideInvite = false, hideEvent = false, hideSettings = false, hideCreateChannel = false }) => {
    if (!isOpen) return null;
    const hasActions = !hideInvite || !hideSettings || !hideCreateChannel || !hideEvent;

    return (
        <div
            className="absolute left-2 right-2 top-[calc(100%+8px)] z-[120] min-w-[220px] rounded-xl bg-discord-darker border border-discord-border/60 shadow-2xl overflow-hidden animate-slide-down"
            role="menu"
        >
            {!hideInvite && (
                <button onClick={() => { onInvite?.(); onClose?.(); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-discord-light hover:bg-discord-border-light/15 cursor-pointer">
                    Invite to Server
                    <UserPlus className="w-4 h-4 text-discord-faint" />
                </button>
            )}
            {!hideSettings && (
                <button onClick={() => { onServerSettings?.(); onClose?.(); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-discord-light hover:bg-discord-border-light/15 cursor-pointer">
                    Server Settings
                    <Settings className="w-4 h-4 text-discord-faint" />
                </button>
            )}
            {!hideCreateChannel && (
                <button onClick={() => { onCreateChannel?.(); onClose?.(); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-discord-light hover:bg-discord-border-light/15 cursor-pointer">
                    Create Channel
                    <Plus className="w-4 h-4 text-discord-faint" />
                </button>
            )}
            {!hideEvent && (
                <button onClick={() => { onCreateEvent?.(); onClose?.(); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-discord-light hover:bg-discord-border-light/15 cursor-pointer">
                    Create Event
                    <CalendarPlus className="w-4 h-4 text-discord-faint" />
                </button>
            )}
            {!hasActions && (
                <div className="px-3 py-3 text-xs text-discord-faint flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-discord-darkest flex items-center justify-center">
                        <Lock className="w-3.5 h-3.5 text-discord-faint" />
                    </span>
                    You don’t have permissions to manage this server.
                </div>
            )}
        </div>
    );
};

export default ServerMenu;
