import { Gamepad2, Headphones, Mic, PhoneOff, Radio, ScreenShare, Settings } from 'lucide-react';

const VoiceConnectedBar = ({
    channelName,
    isMuted,
    isDeafened,
    isSharing,
    memberCount = 0,
    connectedCount = 0,
    onToggleMute,
    onToggleDeafen,
    onToggleShare,
    onOpenCallView,
    onLeave,
    onProfileClick,
    onSettingsClick,
    displayName,
    avatar,
}) => {
    const totalMembers = Math.max(1, memberCount || 1);
    const others = Math.max(0, totalMembers - 1);
    let connectionLabel = '';
    if (others > 0 && connectedCount >= others) {
        connectionLabel = `Connected to ${others}`;
    } else if (others > 0) {
        connectionLabel = `Connecting (${connectedCount}/${others})`;
    }

    return (
        <div className="relative z-30 -ml-14 mr-2 mb-2 w-[calc(100%+3rem)] rounded-xl border border-discord-border/70 bg-gradient-to-b from-[#232833] to-[#1a1f2a] pl-10 pr-3.5 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.42)] flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-discord-green/10 border border-discord-green/20 flex items-center justify-center text-discord-green">
                    <Radio className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm leading-none font-semibold text-discord-green whitespace-nowrap">Voice Connected</p>
                    <button
                        onClick={onOpenCallView}
                        className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-discord-faint truncate hover:text-discord-light text-left"
                        title="Open call view"
                    >
                        <Gamepad2 className="w-3 h-3 shrink-0" />
                        <span className="truncate">{channelName}</span>
                    </button>
                    {connectionLabel && (
                        <p className="text-[10px] text-discord-faint mt-0.5">{connectionLabel}</p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onLeave}
                        className="w-8 h-8 rounded-full bg-red-500/15 text-red-300 flex items-center justify-center hover:bg-red-500/30"
                        title="Disconnect"
                    >
                        <PhoneOff className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <div className={`grid gap-2.5 ${onToggleShare ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <button
                    onClick={onToggleMute}
                    className={`h-9 rounded-lg border flex items-center justify-center transition-colors ${
                        isMuted
                            ? 'bg-red-500/18 border-red-400/25 text-red-300'
                            : 'bg-[#262d3a] border-[#364055] text-discord-light hover:bg-[#30384a]'
                    }`}
                    title={isMuted ? 'Unmute mic' : 'Mute mic'}
                >
                    <Mic className="w-4 h-4" />
                </button>
                <button
                    onClick={onToggleDeafen}
                    className={`h-9 rounded-lg border flex items-center justify-center transition-colors ${
                        isDeafened
                            ? 'bg-amber-500/18 border-amber-300/25 text-amber-200'
                            : 'bg-[#262d3a] border-[#364055] text-discord-light hover:bg-[#30384a]'
                    }`}
                    title={isDeafened ? 'Undeafen' : 'Deafen'}
                >
                    <Headphones className="w-4 h-4" />
                </button>
                {onToggleShare && (
                    <button
                        onClick={onToggleShare}
                        className={`h-9 rounded-lg border flex items-center justify-center transition-colors ${
                            isSharing
                                ? 'bg-discord-green/18 border-discord-green/25 text-discord-green'
                                : 'bg-[#262d3a] border-[#364055] text-discord-light hover:bg-[#30384a]'
                        }`}
                        title={isSharing ? 'Stop sharing' : 'Share screen'}
                    >
                        <ScreenShare className="w-4 h-4" />
                    </button>
                )}
            </div>

            {displayName && (
            <div className="flex items-center gap-2.5 rounded-lg border border-discord-border/60 bg-[#1d2330] px-2.5 py-2">
                <button
                    type="button"
                    onClick={onProfileClick}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                    title="Open profile"
                >
                    <div className="relative w-8 h-8 rounded-full bg-discord-darkest flex items-center justify-center text-xs font-semibold">
                        {avatar ? (
                            <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                            (displayName || 'U').charAt(0).toUpperCase()
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-discord-darkest bg-discord-green" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-discord-white uppercase tracking-[0.02em] leading-tight">{displayName || 'User'}</p>
                        <p className="text-[11px] text-discord-faint">Online</p>
                    </div>
                </button>
                <div className="ml-auto flex items-center gap-1">
                    <button
                        onClick={onSettingsClick}
                        className="h-7 w-7 rounded-md text-discord-faint hover:text-discord-light hover:bg-discord-border-light/20 flex items-center justify-center"
                        title="Voice settings"
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                </div>
            </div>
            )}
        </div>
    );
};

export default VoiceConnectedBar;
