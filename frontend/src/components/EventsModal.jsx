import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, MapPin, MoreHorizontal, CalendarPlus, Bell } from 'lucide-react';
import { useEventStore } from '../stores/eventStore';
import { useAuthStore } from '../stores/authStore';

const formatWhen = (event) => {
    const date = event.startDate || event.date;
    if (!date) return 'Upcoming';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return 'Upcoming';
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const EventsModal = ({ isOpen, onClose, onCreate, canCreate, onDelete, onEdit, onStart, onEnd }) => {
    const { events, fetchEvents, toggleRsvp, getCalendarLinks, downloadEventIcs, setEventReminder, isLoading } = useEventStore();
    const { user } = useAuthStore();
    const [openMenuId, setOpenMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState(null);
    const [settingReminderId, setSettingReminderId] = useState(null);
    const [reminderFeedback, setReminderFeedback] = useState({});
    const menuRef = useRef(null);

    const openGoogleCalendar = async (event) => {
        try {
            const links = event.calendarLinks || await getCalendarLinks(event._id);
            if (links?.google) window.open(links.google, '_blank', 'noopener,noreferrer');
        } catch {
            // no-op
        }
    };

    const saveIcsFile = async (event) => {
        try {
            const content = await downloadEventIcs(event._id);
            const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
            const href = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = href;
            anchor.download = `${(event.title || 'event').replace(/\s+/g, '-').toLowerCase()}.ics`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(href);
        } catch {
            // no-op
        }
    };

    const applyReminder = async (eventId, minutesBefore) => {
        if (settingReminderId) return;
        setSettingReminderId(eventId);
        setReminderFeedback((prev) => ({ ...prev, [eventId]: '' }));
        try {
            const data = await setEventReminder(eventId, minutesBefore);
            setReminderFeedback((prev) => ({
                ...prev,
                [eventId]: data?.message || (minutesBefore === null ? 'Reminder removed' : 'Reminder set'),
            }));
        } catch (error) {
            setReminderFeedback((prev) => ({
                ...prev,
                [eventId]: error.message || 'Could not set reminder',
            }));
        }
        setSettingReminderId(null);
    };

    useEffect(() => {
        if (!isOpen) return;
        fetchEvents();
    }, [isOpen, fetchEvents]);

    useEffect(() => {
        if (!openMenuId) return;
        const handleClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpenMenuId(null);
                setMenuPos(null);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [openMenuId]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-[94vw] max-w-[720px] max-h-[90vh] overflow-y-auto rounded-2xl bg-[#2b2d31] border border-discord-border/60 shadow-2xl animate-scale-in">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-discord-border/40">
                    <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-discord-faint" />
                        <span className="text-sm font-semibold text-discord-light">{events.length} Events</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {canCreate && (
                            <button
                                onClick={onCreate}
                                className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-blurple text-xs font-semibold text-white hover:bg-blurple-hover cursor-pointer"
                            >
                                Create Event
                            </button>
                        )}
                        <button onClick={onClose} className="w-9 h-9 rounded-full bg-discord-darkest flex items-center justify-center hover:bg-discord-border-light/40 cursor-pointer">
                            <X className="w-4 h-4 text-discord-faint" />
                        </button>
                    </div>
                </div>

                <div className="p-4 sm:p-6 space-y-4">
                    {isLoading && events.length === 0 && (
                        <div className="text-sm text-discord-faint">Loading events…</div>
                    )}
                    {!isLoading && events.length === 0 && (
                        <div className="text-sm text-discord-faint">No upcoming events yet.</div>
                    )}
                    {events.map((event) => {
                        const isInterested = event.rsvpList?.includes(user?._id);
                        const canManage = canCreate || event.creator?._id === user?._id;
                        return (
                            <div key={event._id} className="rounded-2xl border border-discord-border/50 bg-discord-darkest/70">
                                {event.coverImage && (
                                    <div className="h-36 w-full">
                                        <img src={event.coverImage} alt="" className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <div className="p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-xs text-discord-faint">
                                            <Calendar className="w-3.5 h-3.5" />
                                            <span>{formatWhen(event)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-discord-border/40 flex items-center justify-center overflow-hidden">
                                                {event.creator?.avatar ? (
                                                    <img src={event.creator.avatar} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-xs font-semibold text-discord-light">
                                                        {(event.creator?.name || 'U').charAt(0).toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="px-2.5 py-1 rounded-full bg-discord-darkest text-xs font-semibold text-discord-light flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-discord-green" />
                                                {event.rsvpList?.length || 0}
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-semibold text-white">{event.title}</h3>
                                        {event.description && (
                                            <p className="text-sm text-discord-faint mt-1">{event.description}</p>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-xs text-discord-faint">
                                            <MapPin className="w-3.5 h-3.5" />
                                            <span>{event.location || 'Somewhere else'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (openMenuId === event._id) {
                                                        setOpenMenuId(null);
                                                        setMenuPos(null);
                                                        return;
                                                    }
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setOpenMenuId(event._id);
                                                    setMenuPos({ top: rect.bottom + 8, left: rect.right - 160 });
                                                }}
                                                className="w-9 h-9 rounded-lg bg-discord-border/30 flex items-center justify-center text-discord-faint hover:bg-discord-border/50 cursor-pointer"
                                            >
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => toggleRsvp(event._id, user?._id)}
                                                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                                    isInterested ? 'bg-discord-green text-white' : 'bg-discord-border/30 text-discord-light hover:bg-discord-border/50'
                                                }`}
                                            >
                                                {isInterested ? 'Interested' : 'Interested'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                        <button
                                            onClick={() => openGoogleCalendar(event)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-discord-border text-discord-muted hover:text-discord-light hover:border-discord-border-light"
                                        >
                                            <CalendarPlus className="w-3.5 h-3.5" />
                                            Google Calendar
                                        </button>
                                        <button
                                            onClick={() => saveIcsFile(event)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-discord-border text-discord-muted hover:text-discord-light hover:border-discord-border-light"
                                        >
                                            <Calendar className="w-3.5 h-3.5" />
                                            Download .ics
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-discord-faint pr-1">
                                            <Bell className="w-3.5 h-3.5" />
                                            Reminder
                                        </div>
                                        {[10, 30, 60, 1440].map((mins) => (
                                            <button
                                                key={mins}
                                                onClick={() => applyReminder(event._id, mins)}
                                                disabled={!isInterested || settingReminderId === event._id}
                                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border ${!isInterested ? 'border-discord-border/40 text-discord-faint/70 cursor-not-allowed' : 'border-discord-border text-discord-muted hover:text-discord-light hover:border-discord-border-light cursor-pointer'}`}
                                            >
                                                {mins >= 1440 ? '1d' : mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => applyReminder(event._id, null)}
                                            disabled={!isInterested || settingReminderId === event._id}
                                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border ${!isInterested ? 'border-discord-border/40 text-discord-faint/70 cursor-not-allowed' : 'border-discord-border text-discord-faint hover:text-discord-light hover:border-discord-border-light cursor-pointer'}`}
                                        >
                                            Off
                                        </button>
                                    </div>

                                    {reminderFeedback[event._id] && (
                                        <div className="text-[11px] text-discord-faint">
                                            {reminderFeedback[event._id]}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            {openMenuId && menuPos && createPortal(
                <div
                    ref={menuRef}
                    className="fixed w-40 rounded-lg bg-discord-darker border border-discord-border/60 shadow-xl overflow-hidden z-[9999] animate-slide-down"
                    style={{ top: menuPos.top, left: menuPos.left }}
                >
                    {(() => {
                        const active = events.find((e) => e._id === openMenuId);
                        if (!active) return null;
                        const canManageActive = canCreate || active.creator?._id === user?._id;
                        return (
                            <>
                                {canManageActive && (
                                    <>
                                        {active.status === 'live' ? (
                                            <button
                                                onClick={() => { setOpenMenuId(null); setMenuPos(null); onEnd?.(active); }}
                                                className="w-full px-3 py-2 text-left text-sm text-discord-light hover:bg-discord-border-light/15 cursor-pointer"
                                            >
                                                End Event
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => { setOpenMenuId(null); setMenuPos(null); onStart?.(active); }}
                                                className="w-full px-3 py-2 text-left text-sm text-discord-light hover:bg-discord-border-light/15 cursor-pointer"
                                            >
                                                Start Event
                                            </button>
                                        )}
                                        <button
                                            onClick={() => { setOpenMenuId(null); setMenuPos(null); onEdit?.(active); }}
                                            className="w-full px-3 py-2 text-left text-sm text-discord-light hover:bg-discord-border-light/15 cursor-pointer"
                                        >
                                            Edit Event
                                        </button>
                                    </>
                                )}
                                {canCreate && (
                                    <button
                                        onClick={() => { setOpenMenuId(null); setMenuPos(null); onDelete?.(active._id); }}
                                        className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-discord-border-light/15 cursor-pointer"
                                    >
                                        Cancel Event
                                    </button>
                                )}
                            </>
                        );
                    })()}
                </div>,
                document.body
            )}
        </div>,
        document.body
    );
};

export default EventsModal;
