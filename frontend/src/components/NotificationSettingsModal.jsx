import { X, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useAuthStore } from '../stores/authStore';
import { useChannelStore } from '../stores/channelStore';
import { apiFetch } from '../stores/apiFetch';

export default function NotificationSettingsModal({ isOpen, onClose }) {
    const { activeCommunityId } = useWorkspaceStore();
    const { user, checkAuth } = useAuthStore();
    const { channels } = useChannelStore();

    const membership = useMemo(() => {
        return user?.memberships?.find((membershipItem) => {
            const id = typeof membershipItem.communityId === 'string' ? membershipItem.communityId : membershipItem.communityId?._id;
            return id === activeCommunityId;
        });
    }, [user, activeCommunityId]);

    const communityName = membership?.communityId?.name || membership?.communityId?.slug || 'Server';
    const prefs = membership?.notificationSettings || {};

    const [settings, setSettings] = useState({
        serverMuted: prefs.serverMuted ?? false,
        serverSetting: prefs.serverSetting || 'all',
        inAppAlerts: prefs.inAppAlerts ?? true,
        pushNotifications: prefs.pushNotifications ?? true,
        suppressEveryone: prefs.suppressEveryone ?? false,
        suppressRoles: prefs.suppressRoles ?? false,
        suppressHighlights: prefs.suppressHighlights ?? false,
        muteNewEvents: prefs.muteNewEvents ?? false,
        mobilePush: prefs.mobilePush ?? true,
        channelOverrides: prefs.channelOverrides || [],
    });
    const [isSaving, setIsSaving] = useState(false);
    const [selectedChannelId, setSelectedChannelId] = useState('');

    useEffect(() => {
        if (!isOpen || !membership) return;
        const p = membership.notificationSettings || {};
        setSettings({
            serverMuted: p.serverMuted ?? false,
            serverSetting: p.serverSetting || 'all',
            inAppAlerts: p.inAppAlerts ?? true,
            pushNotifications: p.pushNotifications ?? true,
            suppressEveryone: p.suppressEveryone ?? false,
            suppressRoles: p.suppressRoles ?? false,
            suppressHighlights: p.suppressHighlights ?? false,
            muteNewEvents: p.muteNewEvents ?? false,
            mobilePush: p.mobilePush ?? true,
            channelOverrides: p.channelOverrides || [],
        });
        setSelectedChannelId('');
    }, [isOpen, membership]);

    if (!isOpen) return null;

    const channelMap = new Map((channels || []).map((channel) => [channel._id, channel]));

    const handleToggle = (key) => setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

    const handleChannelSettingChange = (channelId, newSetting) => {
        setSettings((prev) => {
            const overrides = [...(prev.channelOverrides || [])];
            const index = overrides.findIndex((override) => {
                const overrideId = typeof override.channelId === 'string' ? override.channelId : override.channelId?._id;
                return overrideId === channelId;
            });
            if (index >= 0) {
                if (newSetting === 'default') overrides.splice(index, 1);
                else overrides[index] = { channelId, setting: newSetting };
            } else if (newSetting !== 'default') {
                overrides.push({ channelId, setting: newSetting });
            }
            return { ...prev, channelOverrides: overrides };
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await apiFetch(`/api/communities/${activeCommunityId}/notifications`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            await checkAuth();
            onClose?.();
        } catch (error) {
            console.error('Failed to save settings', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-[440px] max-h-[85vh] rounded-lg bg-[#313338] shadow-2xl animate-scale-in flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 pb-2">
                    <h2 className="text-base font-bold text-[#f2f3f5]">Notification Settings</h2>
                    <button onClick={onClose} className="text-[#b5bac1] hover:text-[#dbdee1] transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-4 pb-4 overflow-y-auto custom-scrollbar space-y-5">
                    <div className="pt-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-semibold text-sm text-[#f2f3f5]">Mute • {communityName} •</div>
                                <div className="text-xs text-[#b5bac1] mt-1 pr-4 leading-snug">
                                    Muting a server prevents unread indicators and notifications from appearing unless you are mentioned.
                                </div>
                            </div>
                            <Toggle checked={settings.serverMuted} onChange={() => handleToggle('serverMuted')} />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-[#1e1f22]">
                        <div className="font-semibold text-xs text-[#b5bac1] uppercase tracking-wide mb-3">Server Notification Settings</div>
                        <div className="space-y-3">
                            <RadioOption label="All Messages" checked={settings.serverSetting === 'all'} onChange={() => setSettings((prev) => ({ ...prev, serverSetting: 'all' }))} />
                            <RadioOption label="Only @mentions" checked={settings.serverSetting === 'mentions'} onChange={() => setSettings((prev) => ({ ...prev, serverSetting: 'mentions' }))} />
                            <RadioOption label="Nothing" checked={settings.serverSetting === 'nothing'} onChange={() => setSettings((prev) => ({ ...prev, serverSetting: 'nothing' }))} />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-[#1e1f22]">
                        <div className="font-semibold text-xs text-[#b5bac1] uppercase tracking-wide mb-1">Community Activity Alerts</div>
                        <div className="text-xs text-[#b5bac1] mb-3 leading-snug">Receive notifications for DM or join activity that exceeds usual numbers for your server.</div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-semibold text-sm text-[#f2f3f5]">In-app alerts</div>
                                    <div className="text-xs text-[#b5bac1] mt-1 pr-4 leading-snug">
                                        A global bar that appears across the top of Discord when you are using it, regardless of what channel or server you're in at the time.
                                    </div>
                                </div>
                                <Toggle checked={settings.inAppAlerts} onChange={() => handleToggle('inAppAlerts')} />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-semibold text-sm text-[#f2f3f5]">Push notifications</div>
                                    <div className="text-xs text-[#b5bac1] mt-1 pr-4 leading-snug">
                                        Sends to mobile or desktop devices when you are not using Discord.
                                    </div>
                                </div>
                                <Toggle checked={settings.pushNotifications} onChange={() => handleToggle('pushNotifications')} />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-[#1e1f22] space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="font-semibold text-sm text-[#f2f3f5]">Suppress @everyone and @here</div>
                            <Toggle checked={settings.suppressEveryone} onChange={() => handleToggle('suppressEveryone')} />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="font-semibold text-sm text-[#f2f3f5]">Suppress All Role @mentions</div>
                            <Toggle checked={settings.suppressRoles} onChange={() => handleToggle('suppressRoles')} />
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-semibold text-sm text-[#f2f3f5]">Suppress Highlights</div>
                                <div className="text-xs text-[#b5bac1] mt-1 pr-4 leading-snug">
                                    Highlights provide occasional updates when your friends are chatting in busy servers, and more.
                                    <span className="block mt-1 text-[#00a8fc] hover:underline cursor-pointer">Learn more about Highlights</span>
                                </div>
                            </div>
                            <Toggle checked={settings.suppressHighlights} onChange={() => handleToggle('suppressHighlights')} />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="font-semibold text-sm text-[#f2f3f5]">Mute New Events</div>
                            <Toggle checked={settings.muteNewEvents} onChange={() => handleToggle('muteNewEvents')} />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="font-semibold text-sm text-[#f2f3f5]">Mobile Push Notifications</div>
                            <Toggle checked={settings.mobilePush} onChange={() => handleToggle('mobilePush')} />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-[#1e1f22] pb-6">
                        <div className="font-semibold text-sm text-[#f2f3f5] mb-1">Notification Overrides</div>
                        <div className="text-xs text-[#b5bac1] mb-2">Add a channel or category to override its default notification setting</div>

                        <div className="relative mb-4">
                            <select
                                value={selectedChannelId}
                                onChange={(e) => {
                                    if (e.target.value) {
                                        handleChannelSettingChange(e.target.value, 'muted');
                                        setSelectedChannelId('');
                                    }
                                }}
                                className="w-full bg-[#1e1f22] border border-[#1e1f22] rounded p-2 text-sm text-[#b5bac1] appearance-none"
                            >
                                <option value="" disabled hidden>Select a channel or category...</option>
                                {(channels || []).map((channel) => (
                                    <option key={channel._id} value={channel._id}>{channel.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-[#b5bac1] pointer-events-none" />
                        </div>

                        {settings.channelOverrides.length > 0 && (
                            <div className="mt-4 pt-3 pb-3 px-2 border-t border-b border-dashed border-[#1e1f22] text-xs text-[#b5bac1]">
                                <div className="grid grid-cols-5 text-[#b5bac1] font-semibold text-[10px] mb-2 tracking-wide uppercase">
                                    <div className="col-span-2 text-left">Channel or Category</div>
                                    <div className="text-center">All</div>
                                    <div className="text-center">Mentions</div>
                                    <div className="text-center">Nothing</div>
                                    <div className="text-center">Mute</div>
                                </div>

                                {settings.channelOverrides.map((override) => {
                                    const overrideId = typeof override.channelId === 'string' ? override.channelId : override.channelId?._id;
                                    const channel = channelMap.get(overrideId);
                                    if (!channel) return null;

                                    return (
                                        <div key={overrideId} className="grid grid-cols-5 items-center py-2 relative group hover:bg-[#3f4147] -mx-2 px-2 rounded">
                                            <div className="col-span-2 text-[#f2f3f5] font-medium truncate pr-2">
                                                <button onClick={() => handleChannelSettingChange(overrideId, 'default')} className="text-red-400 opacity-0 group-hover:opacity-100 mr-2">X</button>
                                                # {channel.name}
                                            </div>
                                            <div className="flex justify-center"><input type="radio" checked={override.setting === 'all'} onChange={() => handleChannelSettingChange(overrideId, 'all')} /></div>
                                            <div className="flex justify-center"><input type="radio" checked={override.setting === 'mentions'} onChange={() => handleChannelSettingChange(overrideId, 'mentions')} /></div>
                                            <div className="flex justify-center"><input type="radio" checked={override.setting === 'nothing'} onChange={() => handleChannelSettingChange(overrideId, 'nothing')} /></div>
                                            <div className="flex justify-center"><input type="radio" checked={override.setting === 'muted'} onChange={() => handleChannelSettingChange(overrideId, 'muted')} /></div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {settings.channelOverrides.length === 0 && (
                            <div className="mt-4 py-2 text-[11px] bg-[#1e1f22]/50 border border-dashed border-[#4e5058]/50 rounded text-center text-[#b5bac1]">
                                No channel overrides added yet.
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 bg-[#2b2d31] rounded-b-lg flex justify-end shrink-0">
                    <button onClick={handleSave} disabled={isSaving} className="w-1/3 min-w-[100px] h-10 bg-[#5865f2] hover:bg-[#4752c4] text-white font-medium rounded py-2 text-sm transition disabled:opacity-50">
                        {isSaving ? 'Saving...' : 'Done'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Toggle({ checked, onChange }) {
    return (
        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
            <div className={`w-10 h-6 rounded-full peer ${checked ? 'bg-[#23a559]' : 'bg-[#80848e]'} after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all ${checked ? 'after:translate-x-[16px]' : ''}`} />
        </label>
    );
}

function RadioOption({ label, checked, onChange }) {
    return (
        <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative flex-shrink-0">
                <input type="radio" className="sr-only" checked={checked} onChange={onChange} />
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${checked ? 'border-[#5865f2]' : 'border-[#b5bac1] group-hover:border-[#dbdee1]'}`}>
                    {checked && <div className="w-2.5 h-2.5 bg-[#5865f2] rounded-full" />}
                </div>
            </div>
            <span className={`text-sm ${checked ? 'text-[#f2f3f5]' : 'text-[#b5bac1] group-hover:text-[#dbdee1]'} transition-colors`}>{label}</span>
        </label>
    );
}
