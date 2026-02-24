"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCalendarEvents, deleteCalendarEvent } from "@/app/actions/calendar";
import { getTodayJournalCount } from "@/app/actions/journal";
import { getHabitsForDate } from "@/app/actions/habits";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Trash2, Calendar as CalendarIcon, Clock, MapPin, Bell, Repeat, X } from "lucide-react";
import Navigation from "@/components/Navigation";
import CalendarEventModal from "@/components/CalendarEventModal";

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<"month" | "list">("month");
  const [showDateEventsModal, setShowDateEventsModal] = useState(false);
  const [dateEvents, setDateEvents] = useState<any[]>([]);
  const [modalDate, setModalDate] = useState<Date | null>(null);
  const [habits, setHabits] = useState<Record<string, any[]>>({});

  useEffect(() => {
    loadEvents();
  }, [currentDate]);

  async function loadEvents() {
    setLoading(true);
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const result = await getCalendarEvents(
      start.toISOString(),
      end.toISOString()
    );
    if (result.success) {
      setEvents(result.events);
    }
    
    // Load habits for all days in the month
    const habitsMap: Record<string, any[]> = {};
    const daysInMonth = eachDayOfInterval({ start, end });
    
    await Promise.all(
      daysInMonth.map(async (day) => {
        const dateStr = day.toISOString().split('T')[0];
        const habitsResult = await getHabitsForDate(dateStr);
        if (habitsResult.success) {
          habitsMap[dateStr] = habitsResult.habits || [];
        }
      })
    );
    
    setHabits(habitsMap);
    setLoading(false);
  }

  function handleDateClick(date: Date) {
    const eventsForDate = getEventsForDate(date);
    if (eventsForDate.length > 0) {
      // Show events list modal
      setDateEvents(eventsForDate);
      setModalDate(date);
      setShowDateEventsModal(true);
    } else {
      // No events, open create event modal
      setSelectedDate(date);
      setSelectedEvent(null);
      setShowEventModal(true);
    }
  }

  function handleEventClick(event: any) {
    setSelectedEvent(event);
    setSelectedDate(undefined);
    setShowEventModal(true);
  }

  async function handleDelete(eventId: string) {
    if (confirm("Are you sure you want to delete this event?")) {
      const result = await deleteCalendarEvent(eventId);
      if (result.success) {
        loadEvents();
      }
    }
  }

  function getEventsForDate(date: Date) {
    const calendarEvents = events.filter((event) => {
      const eventDate = new Date(event.date);
      return isSameDay(eventDate, date);
    });
    
    // Get habits for this date
    const dateStr = date.toISOString().split('T')[0];
    const habitsForDate = habits[dateStr] || [];
    
    // Convert habits to calendar event format and combine with other events
    const habitEvents = habitsForDate.map((habit: any) => ({
      _id: `habit-${habit._id}-${dateStr}`,
      title: habit.name,
      type: "habit",
      date: date,
      time: habit.startTime || undefined,
      description: `${habit.name} - ${habit.category}`,
      habitId: habit._id,
    }));
    
    // Combine and sort by time
    const allEvents = [...calendarEvents, ...habitEvents].sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });
    
    return allEvents;
  }

  function getEventTypeColor(type: string) {
    switch (type) {
      case "meeting":
        return "bg-blue-500";
      case "event":
        return "bg-purple-500";
      case "birthday":
        return "bg-pink-500";
      case "habit":
        return "bg-indigo-500";
      default:
        return "bg-slate-500";
    }
  }

  function getEventTypeDotColor(type: string) {
    switch (type) {
      case "meeting":
        return "bg-blue-500";
      case "event":
        return "bg-purple-500";
      case "birthday":
        return "bg-pink-500";
      case "habit":
        return "bg-indigo-500";
      default:
        return "bg-slate-500";
    }
  }

  function getEventTypeLabel(type: string) {
    switch (type) {
      case "meeting":
        return "Meeting";
      case "event":
        return "Event";
      case "birthday":
        return "Birthday";
      case "habit":
        return "Habit";
      default:
        return "Event";
    }
  }

  function getUniqueEventTypesForDate(date: Date) {
    const dayEvents = getEventsForDate(date);
    const types = new Set(dayEvents.map(event => event.type));
    return Array.from(types);
  }
  
  function getEventTypeIcon(type: string) {
    switch (type) {
      case "habit":
        return "🎯";
      case "meeting":
        return "📅";
      case "birthday":
        return "🎂";
      default:
        return "📌";
    }
  }

  function navigateMonth(direction: "prev" | "next") {
    setCurrentDate((prev) => (direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1)));
  }

  // Generate calendar days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Get upcoming events for list view
  const upcomingEvents = [...events]
    .filter((event) => {
      const eventDate = new Date(event.date);
      return eventDate >= new Date(new Date().setHours(0, 0, 0, 0));
    })
    .sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (dateA.getTime() === dateB.getTime()) {
        return (a.time || "").localeCompare(b.time || "");
      }
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, 20);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 sm:pb-24 md:pb-6 md:pl-20 lg:pl-64 safe-bottom">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto px-3 sm:px-4 md:px-6 pt-4 sm:pt-6 md:pt-8 pb-8 sm:pb-6 md:pb-8">
        {/* Header */}
        <div className="mb-4 sm:mb-5 md:mb-6 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400 mb-1 tracking-tight">
                Calendar
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base font-medium">
                {format(currentDate, "MMMM yyyy")}
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 flex-1 sm:flex-initial">
                <button
                  onClick={() => setViewMode("month")}
                  className={`tap-target px-3 py-1.5 rounded-md font-semibold text-xs sm:text-sm transition-all min-h-[36px] flex-1 sm:flex-initial ${
                    viewMode === "month"
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`tap-target px-3 py-1.5 rounded-md font-semibold text-xs sm:text-sm transition-all min-h-[36px] flex-1 sm:flex-initial ${
                    viewMode === "list"
                      ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  List
                </button>
              </div>
              <button
                onClick={() => {
                  setSelectedDate(new Date());
                  setSelectedEvent(null);
                  setShowEventModal(true);
                }}
                className="tap-target px-3 sm:px-4 py-2 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 min-h-[36px] sm:min-h-[44px]"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-xs sm:text-sm md:text-base hidden sm:inline">New Event</span>
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-pulse text-slate-400">Loading calendar...</div>
          </div>
        ) : viewMode === "month" ? (
          <>
            {/* Month Navigation */}
            <div className="mb-3 sm:mb-4 flex items-center justify-between gap-2">
              <button
                onClick={() => navigateMonth("prev")}
                className="tap-target p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="tap-target px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-semibold text-xs sm:text-sm text-slate-700 dark:text-slate-300 transition-colors min-h-[40px]"
              >
                Today
              </button>
              <button
                onClick={() => navigateMonth("next")}
                className="tap-target p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl p-2 sm:p-3 md:p-4 lg:p-6 shadow-lg border border-slate-200/50 dark:border-slate-700/50">
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-0.5 sm:gap-1 md:gap-2 mb-1 sm:mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 py-1.5 sm:py-2"
                  >
                    <span className="hidden sm:inline">{day}</span>
                    <span className="sm:hidden">{day.substring(0, 1)}</span>
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-0.5 sm:gap-1 md:gap-2 auto-rows-fr">
                {calendarDays.map((day, idx) => {
                  const dayEvents = getEventsForDate(day);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isToday = isSameDay(day, new Date());
                  const hasEvents = dayEvents.length > 0;

                  return (
                    <div
                      key={idx}
                      className={`relative w-full min-h-[60px] sm:min-h-[80px] md:min-h-[100px] lg:min-h-[120px] aspect-square p-1 sm:p-1.5 md:p-2 rounded-md sm:rounded-lg border transition-all flex flex-col ${
                        isCurrentMonth
                          ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                          : "bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800/50 opacity-60"
                      } ${isToday ? "ring-2 ring-indigo-500 dark:ring-indigo-400 ring-offset-1" : ""}`}
                    >
                      <button
                        onClick={() => handleDateClick(day)}
                        className={`w-full text-left text-xs sm:text-sm md:text-base font-medium flex-shrink-0 ${
                          isToday
                            ? "font-bold text-indigo-600 dark:text-indigo-400"
                            : isCurrentMonth
                            ? "text-slate-900 dark:text-slate-100"
                            : "text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        {format(day, "d")}
                      </button>
                      
                      {/* Mobile: Show colored dots inside the date box at the bottom */}
                      {hasEvents && (
                        <div className="flex items-center gap-0.5 flex-wrap justify-center mt-auto md:hidden">
                          {getUniqueEventTypesForDate(day).slice(0, 3).map((type, typeIdx) => (
                            <div
                              key={typeIdx}
                              className={`w-2 h-2 rounded-full ${getEventTypeDotColor(type)}`}
                              title={getEventTypeLabel(type)}
                            />
                          ))}
                          {getUniqueEventTypesForDate(day).length > 3 && (
                            <div className="w-2 h-2 rounded-full bg-slate-400" />
                          )}
                        </div>
                      )}

                      {/* Desktop/Laptop: Show colored dots in top-right corner */}
                      {hasEvents && (
                        <div className="hidden md:flex items-center gap-0.5 absolute top-1 right-1">
                          {getUniqueEventTypesForDate(day).slice(0, 3).map((type, typeIdx) => (
                            <div
                              key={typeIdx}
                              className={`w-2 h-2 rounded-full ${getEventTypeDotColor(type)}`}
                              title={getEventTypeLabel(type)}
                            />
                          ))}
                          {getUniqueEventTypesForDate(day).length > 3 && (
                            <div className="w-2 h-2 rounded-full bg-slate-400" />
                          )}
                        </div>
                      )}

                      {/* Desktop/Laptop: Show event names */}
                      <div className="hidden md:block space-y-0.5 mt-1 flex-1 overflow-hidden">
                        {dayEvents.slice(0, 3).map((event) => (
                          <button
                            key={event._id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!event.habitId) {
                                handleEventClick(event);
                              } else {
                                handleDateClick(day);
                              }
                            }}
                            className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] lg:text-xs font-medium text-white ${getEventTypeColor(
                              event.type
                            )} truncate hover:opacity-90 transition-opacity flex items-center gap-1`}
                            title={`${event.time ? event.time + " - " : ""}${event.title}`}
                          >
                            <span className="text-[8px]">{getEventTypeIcon(event.type)}</span>
                            {event.time ? `${event.time.substring(0, 5)} ` : ""}
                            {event.title}
                          </button>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] lg:text-xs text-slate-500 dark:text-slate-400 px-1.5 font-medium">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          /* List View */
          <div className="space-y-2 sm:space-y-3">
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-12 sm:py-16 bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
                <CalendarIcon className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-medium">
                  No upcoming events
                </p>
              </div>
            ) : (
              upcomingEvents.map((event) => {
                const eventDate = new Date(event.date);
                const isToday = isSameDay(eventDate, new Date());

                return (
                  <div
                    key={event._id}
                    className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 shadow-md border border-slate-200/50 dark:border-slate-700/50 hover:shadow-lg transition-all cursor-pointer group"
                    onClick={() => handleEventClick(event)}
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-600"></div>
                    <div className="pl-3 sm:pl-4 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-semibold text-white ${getEventTypeColor(
                              event.type
                            )}`}
                          >
                            {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                          </span>
                          {event.recurring?.enabled && (
                            <Repeat className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                          )}
                          {event.reminder?.enabled && (
                            <Bell className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                          )}
                        </div>
                        <h3 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 mb-1.5 sm:mb-2 line-clamp-1">
                          {event.title}
                        </h3>
                        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-1.5 sm:gap-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <CalendarIcon className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className={isToday ? "font-semibold text-indigo-600 dark:text-indigo-400" : ""}>
                              {format(eventDate, "EEE, MMM d, yyyy")}
                            </span>
                          </div>
                          {event.time && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>{event.time}</span>
                            </div>
                          )}
                          {event.location && (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{event.location}</span>
                            </div>
                          )}
                        </div>
                        {event.description && (
                          <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                            {event.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(event._id);
                        }}
                        className="tap-target p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
                        aria-label="Delete event"
                      >
                        <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <Navigation />
      <CalendarEventModal
        isOpen={showEventModal}
        onClose={() => {
          setShowEventModal(false);
          setSelectedDate(undefined);
          setSelectedEvent(null);
          loadEvents();
        }}
        selectedDate={selectedDate}
        event={selectedEvent}
      />
      
      {/* Date Events List Modal */}
      {showDateEventsModal && modalDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200/50 dark:border-slate-700/50">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                  {format(modalDate, "EEEE, MMMM d, yyyy")}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {dateEvents.length} {dateEvents.length === 1 ? "event" : "events"}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDateEventsModal(false);
                  setDateEvents([]);
                  setModalDate(null);
                }}
                className="tap-target p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
            </div>

            {/* Events List */}
            <div className="max-h-[60vh] overflow-y-auto p-4 sm:p-5">
              {dateEvents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-500 dark:text-slate-400">No events</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Show all events sorted by time */}
                  <div className="space-y-3">
                    {dateEvents.map((event) => (
                      <div
                        key={event._id}
                        onClick={() => {
                          if (!event.habitId) {
                            setShowDateEventsModal(false);
                            setSelectedEvent(event);
                            setSelectedDate(undefined);
                            setShowEventModal(true);
                          }
                        }}
                        className={`p-3 rounded-lg border cursor-pointer hover:opacity-90 transition-all ${
                          event.type === "habit"
                            ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800"
                            : "bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{getEventTypeIcon(event.type)}</span>
                              <span className={`px-2 py-0.5 rounded-md text-xs font-semibold text-white ${getEventTypeColor(event.type)}`}>
                                {getEventTypeLabel(event.type)}
                              </span>
                              {event.time && (
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                  {event.time}
                                </span>
                              )}
                            </div>
                            <h4 className={`text-sm font-semibold mb-1 ${
                              event.type === "habit"
                                ? "text-indigo-900 dark:text-indigo-100"
                                : "text-slate-900 dark:text-slate-100"
                            }`}>
                              {event.title}
                            </h4>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                              {event.location && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  <span className="truncate">{event.location}</span>
                                </div>
                              )}
                            </div>
                            {event.description && (
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                                {event.description}
                              </p>
                            )}
                          </div>
                          {!event.habitId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(event._id);
                              }}
                              className="tap-target p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors flex-shrink-0"
                              aria-label="Delete event"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Add Event Button */}
                  <button
                    onClick={() => {
                      setShowDateEventsModal(false);
                      setSelectedDate(modalDate);
                      setSelectedEvent(null);
                      setShowEventModal(true);
                    }}
                    className="w-full mt-4 p-3 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Event</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
