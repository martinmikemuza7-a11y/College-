import React, { useEffect, useState } from 'react';
import {
  Award,
  Bell,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Flame,
  Pause,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { Course, Folder, StudyCalendarEvent, StudySessionLog, UserProgress } from '../types';

interface StudyPlannerViewProps {
  activeCourse: Course | null;
  courses: Course[];
  folders: Folder[];
}

const TIMER_PRESETS = [10, 15, 25, 30, 45, 60, 90];

export const StudyPlannerView: React.FC<StudyPlannerViewProps> = ({
  activeCourse,
  courses,
  folders,
}) => {
  // Timer State
  const [selectedMinutes, setSelectedMinutes] = useState<number>(25);
  const [customMinutes, setCustomMinutes] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(25 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [timerFinished, setTimerFinished] = useState<boolean>(false);

  // Calendar & Logs State
  const [events, setEvents] = useState<StudyCalendarEvent[]>([]);
  const [logs, setLogs] = useState<StudySessionLog[]>([]);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // New Event Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventCourseId, setEventCourseId] = useState(activeCourse?.id || courses[0]?.id || '');
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [eventTime, setEventTime] = useState('14:00');
  const [eventDuration, setEventDuration] = useState<number>(30);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<'daily' | 'weekly' | 'weekdays' | 'monthly'>('daily');
  const [reminderMinutes, setReminderMinutes] = useState(15);

  useEffect(() => {
    loadData();
  }, [activeCourse]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [calRes, logRes] = await Promise.all([
        api.getCalendarEvents(),
        api.getStudyLogs(),
      ]);
      setEvents(calRes.events || []);
      setLogs(logRes.logs || []);

      if (activeCourse) {
        const progRes = await api.getProgress(activeCourse.id);
        setProgress(progRes.progress);
      }
    } catch (err) {
      console.warn('Failed to load study planner data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Timer Tick
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning && timeLeftSeconds > 0) {
      interval = setInterval(() => {
        setTimeLeftSeconds((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            setTimerFinished(true);
            handleSessionComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeftSeconds]);

  const handleSelectPreset = (mins: number) => {
    setIsRunning(false);
    setIsCustomMode(false);
    setSelectedMinutes(mins);
    setTimeLeftSeconds(mins * 60);
    setTimerFinished(false);
  };

  const handleApplyCustomMinutes = () => {
    const parsed = parseInt(customMinutes, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 300) {
      setIsRunning(false);
      setSelectedMinutes(parsed);
      setTimeLeftSeconds(parsed * 60);
      setTimerFinished(false);
    }
  };

  const handleResetTimer = () => {
    setIsRunning(false);
    setTimeLeftSeconds(selectedMinutes * 60);
    setTimerFinished(false);
  };

  const handleSessionComplete = async () => {
    if (!activeCourse) return;
    try {
      const res = await api.logStudySession({
        courseId: activeCourse.id,
        durationMinutes: selectedMinutes,
        notes: `Completed ${selectedMinutes}m focus session`,
      });
      setLogs((prev) => [res.log, ...prev]);
    } catch (err) {
      console.warn('Failed to save study log:', err);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle || !eventCourseId) return;

    const startIso = new Date(`${eventDate}T${eventTime}:00`).toISOString();
    try {
      const res = await api.createCalendarEvent({
        courseId: eventCourseId,
        title: eventTitle,
        startTime: startIso,
        durationMinutes: eventDuration,
        isRecurring,
        recurrenceRule: isRecurring ? recurrenceRule : undefined,
        reminderMinutesBefore: reminderMinutes,
      });

      setEvents((prev) => [res.event, ...prev]);
      setShowAddModal(false);
      setEventTitle('');
    } catch (err) {
      console.warn('Failed to create event:', err);
    }
  };

  const handleToggleComplete = async (eventId: string, current: boolean) => {
    try {
      const res = await api.updateCalendarEvent(eventId, { completed: !current });
      setEvents((prev) => prev.map((e) => (e.id === eventId ? res.event : e)));
    } catch (err) {
      console.warn('Failed to update event:', err);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await api.deleteCalendarEvent(eventId);
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch (err) {
      console.warn('Failed to delete event:', err);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalMinutesStudied = logs.reduce((acc, l) => acc + l.durationMinutes, 0);
  const totalHours = (totalMinutesStudied / 60).toFixed(1);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner */}
      <div className="sb-card p-6 border-t-4 border-t-emerald-600 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Study Tools & Habit Calendar</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Build consistent study retention with interval focus countdowns, scheduled recurring reviews, and revision tracking.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2 flex items-center gap-2.5">
            <Flame className="w-5 h-5 text-amber-500" />
            <div>
              <span className="text-[10px] font-bold text-amber-800 uppercase block leading-none">Streak</span>
              <span className="text-sm font-bold text-amber-900">{progress?.streakDays || 1} day(s)</span>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2 flex items-center gap-2.5">
            <Award className="w-5 h-5 text-emerald-500" />
            <div>
              <span className="text-[10px] font-bold text-emerald-800 uppercase block leading-none">Logged</span>
              <span className="text-sm font-bold text-emerald-900">{totalHours} hrs</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Focus Timer */}
        <div className="lg:col-span-5 space-y-6">
          <div className="sb-card p-6 border-t-4 border-t-emerald-500 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" />
                <h2 className="font-bold text-slate-900 text-sm sm:text-base">Focus Timer</h2>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {selectedMinutes} Minutes
              </span>
            </div>

            {/* Countdown Display */}
            <div className="py-8 text-center bg-emerald-50/40 rounded-2xl border border-emerald-100/80">
              <span className="text-5xl sm:text-6xl font-black font-mono tracking-tight text-slate-900 tabular-nums">
                {formatTimer(timeLeftSeconds)}
              </span>
              <p className="text-[11px] font-bold text-slate-400 mt-2 uppercase tracking-widest">
                {isRunning ? 'Session in Progress' : timerFinished ? 'Completed! Session Logged 🎉' : 'Timer Ready'}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setIsRunning(!isRunning)}
                className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow transition cursor-pointer ${
                  isRunning
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" /> Start Study Timer
                  </>
                )}
              </button>

              <button
                onClick={handleResetTimer}
                title="Reset timer"
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Interval Presets */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Interval Presets
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {TIMER_PRESETS.map((m) => (
                  <button
                    key={m}
                    onClick={() => handleSelectPreset(m)}
                    className={`py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${
                      !isCustomMode && selectedMinutes === m
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 hover:bg-emerald-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
                <button
                  onClick={() => setIsCustomMode(true)}
                  className={`py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${
                    isCustomMode
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 hover:bg-emerald-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Custom
                </button>
              </div>

              {isCustomMode && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="number"
                    min="1"
                    max="300"
                    placeholder="Minutes (e.g. 50)"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    onClick={handleApplyCustomMinutes}
                    className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg transition cursor-pointer"
                  >
                    Set
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Recent Logs */}
          <div className="sb-card p-5 space-y-3">
            <h3 className="font-bold text-slate-800 text-sm">Recent Completed Focus Sessions</h3>
            {logs.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">No completed study sessions recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {logs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div>
                        <span className="font-semibold text-slate-800 block">{log.notes || 'Study Session'}</span>
                        <span className="text-[10px] text-slate-400 block">
                          {new Date(log.completedAt).toLocaleDateString()} at{' '}
                          {new Date(log.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      +{log.durationMinutes}m
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Calendar & Scheduled Sessions */}
        <div className="lg:col-span-7 space-y-6">
          <div className="sb-card p-6 border-t-4 border-t-teal-500 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-teal-600" />
                <h2 className="font-bold text-slate-900 text-sm sm:text-base">Study Calendar & Scheduled Sessions</h2>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Schedule Session
              </button>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-slate-400 text-xs">Loading calendar events…</div>
            ) : events.length === 0 ? (
              <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-2">
                <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                <h4 className="font-bold text-slate-700 text-sm">No Scheduled Study Sessions</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Schedule recurring study blocks, set review reminders, and plan exam revision checkpoints.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition cursor-pointer mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add First Session
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((evt) => {
                  const courseObj = courses.find((c) => c.id === evt.courseId);
                  const dateStr = new Date(evt.startTime).toLocaleDateString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  });
                  const timeStr = new Date(evt.startTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={evt.id}
                      className={`p-4 rounded-xl border transition flex items-start justify-between gap-3 ${
                        evt.completed
                          ? 'bg-slate-50 border-slate-200 opacity-60'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => handleToggleComplete(evt.id, evt.completed)}
                          className="mt-0.5 text-slate-400 hover:text-emerald-600 transition cursor-pointer"
                        >
                          <CheckCircle2
                            className={`w-5 h-5 ${evt.completed ? 'text-emerald-600 fill-emerald-50' : ''}`}
                          />
                        </button>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4
                              className={`text-sm font-bold ${
                                evt.completed ? 'line-through text-slate-500' : 'text-slate-900'
                              }`}
                            >
                              {evt.title}
                            </h4>
                            {courseObj && (
                              <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-700">
                                {courseObj.code}
                              </span>
                            )}
                            {evt.isRecurring && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                <Repeat className="w-2.5 h-2.5" /> {evt.recurrenceRule}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                              {dateStr} at {timeStr}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {evt.durationMinutes} mins
                            </span>
                            {evt.reminderMinutesBefore && (
                              <span className="inline-flex items-center gap-1 text-amber-600">
                                <Bell className="w-3.5 h-3.5" />
                                {evt.reminderMinutesBefore}m reminder
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteEvent(evt.id)}
                        className="text-slate-300 hover:text-red-600 p-1.5 rounded-lg transition cursor-pointer"
                        title="Delete event"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">Schedule Study Session</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Session Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Transformers Review & Past Papers"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Course</label>
                <select
                  value={eventCourseId}
                  onChange={(e) => setEventCourseId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Time</label>
                  <input
                    type="time"
                    required
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Duration</label>
                  <select
                    value={eventDuration}
                    onChange={(e) => setEventDuration(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value={15}>15 Minutes</option>
                    <option value={25}>25 Minutes (Pomodoro)</option>
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes</option>
                    <option value={60}>60 Minutes</option>
                    <option value={90}>90 Minutes</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Reminder</label>
                  <select
                    value={reminderMinutes}
                    onChange={(e) => setReminderMinutes(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value={5}>5 mins before</option>
                    <option value={15}>15 mins before</option>
                    <option value={30}>30 mins before</option>
                    <option value={60}>1 hour before</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="font-medium text-slate-700">Recurring Study Block</span>
                </label>

                {isRecurring && (
                  <div className="mt-2 pl-6">
                    <select
                      value={recurrenceRule}
                      onChange={(e) => setRecurrenceRule(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekdays">Weekdays (Mon-Fri)</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow transition"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
