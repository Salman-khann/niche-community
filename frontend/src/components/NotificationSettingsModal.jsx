import { X, ChevronDown } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useAuthStore } from '../stores/authStore';
import { useChannelStore } from '../stores/channelStore';
import { apiFetch } from '../stores/apiFetch';

export default function NotificationSettingsModal({ isOpen, onClose }) {
    const { activeCommunityId } = useWorkspaceStore();
    const { user, checkAuth } = useAuthStore();
    const { channels } = useChannelStore();
    
    const membership = user?.memberships?.find(m => {
        const id = typeof m.communityId === 'string' ? m.communityId : m.communityId?._id;
        return id === activeCommunityId;
    });
    
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
        channelOverrides: prefs.channelOverrides || []
    });
    
    const [isSaving, setIsSaving] = useState(false);
    const [selectedChannelId, setSelectedChannelId] = useState('');

    useEffect(() => {
        if (isOpen && membership) {
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
                channelOverrides: p.channelOverrides || []
            });
        }
    }, [isOpen, membership]);

    if (!isOpen) return null;

    const handleToggle = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));

    const handleChannelSettingChange = (chId, newSetting) => {
        setSettings(prev => {
            const overrides = [...(prev.channelOverrides || [])];
            const idx = overrides.findIndex(o => {
                const oid = typeof o.channelId === 'string' ? o.channelId : o.channelId?._id;
                return oid === chId;
            });
            if (idx >= 0) {
                if (newSetting === 'default') overrides.splice(idx, 1);
                else overrides[idx] = { channelId: chId, setting: newSetting };
            } else if (newSetting !== 'default') {
                overrides.push({ channelId: chId, setting: newSetting });
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
                body: JSON.stringify(settings)
            });
            await checkAuth(); // Refresh user object
            onClose();
        } catch (err) {
            console.error('Failed to save settings', err);
        } finally {
            setIsSaving(false);
        }
    };

    const channelMap = new Map((channels || []).map(c => [c._id, c]));

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-[440px] max-h-[85vh] rounded-lg bg-[#313338] shadow-2xl animate-scale-in flex flex-col" onClick={e => e.stopPropagation()}>
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
                            <RadioOption label="All Messages" checked={settings.serverSetting === 'all'} onChange={() => setSettings({...settings, serverSetting: 'all'})} />
                            <RadioOption label="Only @mentions" checked={settings.serverSetting === 'mentions'} onChange={() => setSettings({...settings, serverSetting: 'mentions'})} />
                            <RadioOption label="Nothing" checked={settings.serverSetting === 'nothing'} onChange={() => setSettings({...settings, serverSetting: 'nothing'})} />
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
                                    if(e.target.value) {
                                        handleChannelSettingChange(e.target.value, 'muted');
                                        setSelectedChannelId('');
                                    }
                                }}
                                className="w-full bg-[#1e1f22] border border-[#1e1f22] rounded p-2 text-sm text-[#b5bac1] appearance-none"
                            >
                                <option value="" disabled hidden>Select a channel or category...</option>
                                {(channels || []).map(ch => (
                                    <option key={ch._id} value={ch._id}>{ch.name}</option>
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
                                
                                {settings.channelOverrides.map((o) => {
                                    const oid = typeof o.channelId === 'string' ? o.channelId : o.channelId?._id;
                                    const channel = channelMap.get(oid);
                                    if (!channel) return null;
                                    return (
                                        <div key={oid} className="grid grid-cols-5 items-center py-2 relative group hover:bg-[#3f4147] -mx-2 px-2 rounded">
                                            <div className="col-span-2 text-[#f2f3f5] font-medium truncate pr-2">
                                                <button onClick={() => handleChannelSettingChange(oid, 'default')} className="text-red-400 opacity-0 group-hover:opacity-100 mr-2">X</button>
                                                # {channel.name}
                                            </div>
                                            <div className="flex justify-center">
                                                <input type="radio" checked={o.setting === 'all'} onChange={() => handleChannelSettingChange(oid, 'all')} />
                                            </div>
                                            <div className="flex justify-center">
                                                <input type="radio" checked={o.setting === 'mentions'} onChange={() => handleChannelSettingChange(oid, 'mentions')} />
                                            </div>
                                            <div className="flex justify-center">
                                                <input type="radio" checked={o.setting === 'nothing'} onChange={() => handleChannelSettingChange(oid, 'nothing')} />
                                            </div>
                                            <div className="flex justify-center">
                                                <input type="radio" checked={o.setting === 'muted'} onChange={() => handleChannelSettingChange(oid, 'muted')} />
                                            </div>
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
            <div className={`w-10 h-6 rounded-full peer ${checked ? 'bg-[#23a559]' : 'bg-[#80848e]'} after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all ${checked ? 'after:translate-x-[16px]' : ''}`}></div>
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
            <span className={`text-sm ${checked ? 'text-[#f2f3f5]' : 'text-[#b5bac1] group-hover:text-[#dbdee1]'} transition-colors`}>
                {label}
            </span>
        </label>
    );
}
import { X, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useAuthStore } from '../stores/authStore';
import { apiFetch } from '../stores/apiFetch';

export default function NotificationSettingsModal({ isOpen, onClose }) {
    const { activeCommunityId } = useWorkspaceStore();
    const { user, checkAuth } = useAuthStore();
    
    const membership = user?.memberships?.find(m => {
        const id = typeof m.communityId === 'string' ? m.communityId : m.communityId?._id;
        return id === activeCommunityId;
    });
    
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
    });
    
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && membership) {
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
            });
        }
    }, [isOpen, membership]);

    if (!isOpen) return null;

    const handleToggle = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await apiFetch(`/api/communities/${activeCommunityId}/notifications`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            await checkAuth(); // Refresh user object
            onClose();
        } catch (err) {
            console.error('Failed to save settings', err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-[440px] max-h-[85vh] rounded-lg bg-[#313338] shadow-2xl animate-scale-in flex flex-col" onClick={e => e.stopPropagation()}>
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
                                <div className="font-semibold text-sm text-[#f2f3f5]">Mute •{communityName}•</div>
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
                            <RadioOption label="All Messages" checked={settings.serverSetting === 'all'} onChange={() => setSettings({...settings, serverSetting: 'all'})} />
                            <RadioOption label="Only @mentions" checked={settings.serverSetting === 'mentions'} onChange={() => setSettings({...settings, serverSetting: 'mentions'})} />
                            <RadioOption label="Nothing" checked={settings.serverSetting OOH	ۛ�[���Hې�[��O^�
HO��]�][���ˋ���][����\��\��][�Έ	ۛ�[���J_Hς��]����]����]��\�Ә[YOH�M�ܙ\�]�ܙ\�V��YLY���H���]��\�Ә[YOH��۝\�[ZX��^^�^V�؍X�X�WH\\��\�H�X��[��]�YHX�LH����[][�]HX�]�]H[\���]���]��\�Ә[YOH�^^�^V�؍X�X�WHX�L�XY[��\۝Yȏ��X�Z]�H��Y�X�][ۜ��܈H܈��[�X�]�]H]^�YY�\�X[�[X�\���܈[�\��\��\���]����]��\�Ә[YOH��X�K^KM���]��\�Ә[YOH��^][\�X�[�\��\�Y�KX�]�Y[����]���]��\�Ә[YOH��۝\�[ZX��^\�H^V�ٌ��ٍWH��[�X\[\���]���]��\�Ә[YOH�^^�^V�؍X�X�WH]LH�MXY[��\۝Yȏ��H�ؘ[�\�]\X\��Xܛ���H�و\��ܙ�[�[�H\�H\�[��]�Y�\�\��و�]�[��[܈�\��\�[�IܙH[�]H[YK���]����]������H�X��Y^��][��˚[�\[\��Hې�[��O^�
HO�[�U���J	�[�\[\���_Hς��]���]��\�Ә[YOH��^][\�X�[�\��\�Y�KX�]�Y[����]���]��\�Ә[YOH��۝\�[ZX��^\�H^V�ٌ��ٍWH��\���Y�X�][ۜ��]���]��\�Ә[YOH�^^�^V�؍X�X�WH]LH�MXY[��\۝Yȏ���[���[ؚ[H܈\���]�X�\��[�[�H\�H��\�[��\��ܙ���]����]������H�X��Y^��][��˜\���Y�X�][ۜ�Hې�[��O^�
HO�[�U���J	�\���Y�X�][ۜ��_Hς��]����]����]����]��\�Ә[YOH�M�ܙ\�]�ܙ\�V��YLY���H�X�K^KM���]��\�Ә[YOH��^][\�X�[�\��\�Y�KX�]�Y[����]��\�Ә[YOH��۝\�[ZX��^\�H^V�ٌ��ٍWH���\�\��]�\�[ۙH[�\�O�]������H�X��Y^��][��˜�\�\��]�\�[ۙ_Hې�[��O^�
HO�[�U���J	��\�\��]�\�[ۙI�_Hς��]���]��\�Ә[YOH��^][\�X�[�\��\�Y�KX�]�Y[����]��\�Ә[YOH��۝\�[ZX��^\�H^V�ٌ��ٍWH���\�\��[��HY[�[ۜ��]������H�X��Y^��][��˜�\�\�ԛ�\�Hې�[��O^�
HO�[�U���J	��\�\�ԛ�\��_Hς��]���]��\�Ә[YOH��^][\�X�[�\��\�Y�KX�]�Y[����]���]��\�Ә[YOH��۝\�[ZX��^\�H^V�ٌ��ٍWH���\�\��Y�Y���]���]��\�Ә[YOH�^^�^V�؍X�X�WH]LH�MXY[��\۝Yȏ��Y�Y���ݚYH���\�[ۘ[\]\��[�[�\���Y[��\�H�][��[��\�H�\��\��[�[ܙK���[��\�Ә[YOH�����]LH^V���܎��N��Hݙ\��[�\�[�H�\��܋\�[�\���X\��[ܙHX��]Y�Y����[����]����]������H�X��Y^��][��˜�\�\��Y�Y��Hې�[��O^�
HO�[�U���J	��\�\��Y�Y���J_Hς��]���]��\�Ә[YOH��^][\�X�[�\��\�Y�KX�]�Y[����]��\�Ә[YOH��۝\�[ZX��^\�H^V�ٌ��ٍWH��]]H�]�]�[���]������H�X��Y^��][��˛]]S�]�]�[��Hې�[��O^�
HO�[�U���J	�]]S�]�]�[���_Hς��]���]��\�Ә[YOH��^][\�X�[�\��\�Y�KX�]�Y[����]��\�Ә[YOH��۝\�[ZX��^\�H^V�ٌ��ٍWH��[ؚ[H\���Y�X�][ۜ��]������H�X��Y^��][��˛[ؚ[T\�Hې�[��O^�
HO�[�U���J	�[ؚ[T\�	�_Hς��]����]����]��\�Ә[YOH�M�ܙ\�]�ܙ\�V��YLY���H�M����]��\�Ә[YOH��۝\�[ZX��^\�H^V�ٌ��ٍWHX�LH���[X�H�[��[܈�]Y�ܞK����]���]��\�Ә[YOH�^^�^V�؍X�X�WHX�L���YH�[��[�ݙ\��YH]�Y�][��Y�X�][ۈ�][����]�����]ۈ�\�Ә[YOH��Y�[�^][\�X�[�\��\�Y�KX�]�Y[���V��YLY���H�ܙ\��ܙ\�V��YLY���H��[�YL�^\�H^V�؍X�X�WHݙ\��^V���YLWH�[��][ۈ����[���[X�H�[��[܈�]Y�ܞK�����[����]��ۑ�ۈ�\�Ә[YOH��MM�ς�؝]ۏ���]��\�Ә[YOH�]ML��L�L��ܙ\�]�ܙ\�X��ܙ\�Y\�Y�ܙ\�V��YLY���H^X�[�\�^^�^V�؍X�X�WH���]��\�Ә[YOH�ܚYܚYX���MH^V�؍X�X�WH�۝\�[ZX��^V�LHX�L��X��[��]�YH\\��\�H���]��\�Ә[YOH���\�[�L�^[Y����[��[܈�]Y�ܞO�]���]��[�]���]��Y[�[ۜ��]���]����[���]���]��]]O�]����]���]��\�Ә[YOH�KL�^V�L\H��V��YLY���K�L�ܙ\��ܙ\�Y\�Y�ܙ\�V��ML
NK�L��[�Y^X�[�\����YH�[��[�ݙ\��YH]�Y�][��Y�X�][ۈ�][���]����]����]����]����]��\�Ә[YOH�M��V�̘���WH��[�YX�[��^�\�Y�KY[�����]ۈې�X��^�[�T�]�_H\�X�Y]\��]�[��H�\�Ә[YOH��Y�[KLL��V��N
�Y��Hݙ\����V��
�L��H^]�]H�۝[YY][H��[�YKL�^\�H�[��][ۈ\�X�Y��X�]KML����\��]�[���	��]�[�ˋ����	�ۙI�B�؝]ۏ���]����]����]���
NB���[��[ۈ���J��X��Yې�[��HJH�]\��
�X�[�\�Ә[YOH��[]]�H[�[�KY�^][\�X�[�\��\��܋\�[�\��^\��[��L���[�]\OH��X�؛���\�Ә[YOH�܋[ۛHY\���X��Y^��X��YHې�[��O^�ې�[��_Hς�]��\�Ә[YO^��LLM���[�YY�[Y\�	��X��Y�	ؙ�V�̌�MMNWI��	ؙ�V��
WI�HY�\���۝[�V��I�HY�\��X���]HY�\���V̜HY�\��Y�V̜HY�\����]�]HY�\����[�YY�[Y�\��MHY�\���MHY�\���[��][ۋX[	��X��Y�	�Y�\���[��]K^V�M�I��	��XO��]����X�[��
NB���[��[ۈ�Y[��[ۊ�X�[�X��Yې�[��HJH�]\��
�X�[�\�Ә[YOH��^][\�X�[�\��\L��\��܋\�[�\�ܛ�\���]��\�Ә[YOH��[]]�H���[�]\OH��Y[Ȉ�\�Ә[YOH�܋[ۛH��X��Y^��X��YHې�[��O^�ې�[��_Hς�]��\�Ә[YO^�MHMH��[�YY�[�ܙ\�L��^][\�X�[�\��\�Y�KX�[�\��[��][ۋX��ܜ�	��X��Y�	؛ܙ\�V��N
�Y��I��	؛ܙ\�V�؍X�X�WHܛ�\Zݙ\���ܙ\�V���YLWI�XO����X��Y	��]��\�Ә[YOH��L��HL��H��V��N
�Y��H��[�YY�[�ϟB��]����]����[��\�Ә[YO^�^\�H	��X��Y�	�^V�ٌ��ٍWI��	�^V�؍X�X�WHܛ�\Zݙ\��^V���YLWI�H�[��][ۋX��ܜ�O���X�[B���[����X�[��
NB