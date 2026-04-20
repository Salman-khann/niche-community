import { CalendarPlus, Lock, Plus, Settings, UserPlus, FolderPlus, Bell, Shield, CheckSquare, Square } from 'lucide-react';

const ServerMenu = ({ isOpen, onClose, onInvite, onCreateChannel, onCreateCategory, onCreateEvent, onServerSettings, onNotificationSettings, onPrivacySettings, hideMutedChannels, onToggleHideMuted, hideInvite = false, hideEvent = false, hideSettings = false, hideCreateChannel = false }) => {
    if (!isOpen) return null;
    const hasActions = !hideInvite || !hideSettings || !hideCreateChannel || !hideEvent;

    return (
        <div
            className="absolute left-2 right-2 top-[calc(100%+8px)] z-[120] min-w-[220px] rounded-md bg-[#111214] border border-[#1e1f22] shadow-xl overflow-hidden py-2"
            role="menu"
        >
            {!hideInvite && (
                <button onClick={() => { onInvite?.(); onClose?.(); }}
                    className="w-[calc(100%-16px)] mx-2 flex items-center justify-between px-2 py-1.5 mb-1 text-sm text-[#5865f2] hover:bg-[#5865f2] hover:text-white rounded-sm cursor-pointer transition-colors group">
                    <span className="font-medium">Invite to Server</span>
                    <UserPlus className="w-[18px] h-[18px] group-hover:text-white" />
                </button>
            )}
            {!hideSettings && (
                <button onClick={() => { onServerSettings?.(); onClose?.(); }}
                    className="w-[calc(100%-16px)] mx-2 flex items-center justify-between px-2 py-1.5 text-sm text-[#b5bac1] hover:bg-[#5865F2] hover:text-white rounded-sm cursor-pointer transition-colors group">
                    <span className="font-medium">Server Settings</span>
                    <Settings className="w-[18px] h-[18px]" />
                </button>
            )}
            {!hideCreateChannel && (
                <button onClick={() => { onCreateChannel?.(); onClose?.(); }}
                    className="w-[calc(100%-16px)] mx-2 flex items-center justify-between px-2 py-1.5 text-sm text-[#b5bac1] hover:bg-[#5865F2] hover:text-white rounded-sm cursor-pointer transition-colors group">
                    <span className="font-medium">Create Channel</span>
                    <Plus className="w-[18px] h-[18px]" />
                </button>
            )}
            {!hideEvent && (
                <button onClick={() => { onCreateEvent?.(); onClose?.(); }}
                    className="w-[calc(100%-16px)] mx-2 flex items-center justify-between px-2 py-1.5 text-sm text-[#b5bac1] hover:bg-[#5865F2] hover:text-white rounded-sm cursor-pointer transition-colors group">
                    <span className="font-medium">Create Event</span>
                    <CalendarPlus className="w-[18px] h-[18px]" />
                </button>
            )}

            <div className="h-[1px] bg-[#1e1f22] my-1 mx-2" />
            
            <button onClick={() => { onNotificationSettings?.(); onClose?.(); }}
                className="w-[calc(100%-16px)] mx-2 flex items-center justify-between px-2 py-1.5 text-sm text-[#b5bac1] hover:bg-[#5865F2] hover:text-white rounded-sm cursor-pointer transition-colors group">
                <span className="font-medium">Notification Settings</span>
                <Bell className="w-[18px] h-[18px]" />
            </button>
            <button onClick={() => { onPrivacySettings?.(); onClose?.(); }}
                className="w-[calc(100%-16px)] mx-2 flex items-center justify-between px-2 py-1.5 text-sm text-[#b5bac1] hover:bg-[#5865F2] hover:text-white rounded-sm cursor-pointer transition-colors group">
                <span className="font-medium">Privacy Settings</span>
                <Shield className="w-[18px] h-[18px]" />
            </button>
            
            <div className="h-[1px] bg-[#1e1f22] my-1 mx-2" />
            
            <button onClick={() => { onToggleHideMuted?.(); }}
                className="w-[calc(100%-16px)] mx-2 flex items-center justify-between px-2 py-1.5 text-sm text-[#b5bac1] hover:bg-[#5865F2] hover:text-white rounded-sm cursor-pointer transition-colors group">
                <span className="font-medium">Hide Muted Channels</span>
                {hideMutedChannels ? <CheckSquare className="w-[18px] h-[18px]" /> : <Square className="w-[18px] h-[18px]" />}
            </button>

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
