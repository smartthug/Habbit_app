"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCalendarEvents, deleteCalendarEvent } from "@/app/actions/calendar";
import { getTodayJournalCount } from "@/app/actions/journal";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Trash2, Calendar as CalendarIcon, Clock, MapPin, Bell, Repeat } from "lucide-react";
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
    setLoading(false);
  }

  function handleDateClick(date: Date) {
    setSelectedDate(date);
    setSelectedEvent(null);
    setShowEventModal(true);
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
    return events.filter((event) => {
      const eventDate = new Date(event.date);
      return isSameDay(eventDate, date);
    });
  }

  function getEventTypeColor(type: string) {
    switch (type) {
      case "meeting":
        return "bg-blue-500";
      case "event":
        return "bg-purple-500";
      case "birthday":
        return "bg-pink-500";
      default:
        return "bg-slate-500";
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 sm:pb-20 md:pb-6 md:pl-20 lg:pl-64 safe-bottom">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6 md:mb-8 space-y-3 sm:space-y-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400 mb-1 sm:mb-2 tracking-tight">
                Calendar
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm md:text-base font-semibold">
                {format(currentDate, "MMMM yyyy")}
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedDate(new Date());
                setSelectedEvent(null);
                setShowEventModal(true);
              }}
              className="tap-target w-full sm:w-auto px-4 py-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 min-h-[44px]"
            >
              <Plus className="w-5 h-5" />
              <span className="text-sm sm:text-base">New Event</span>
            </button>
          </div>
          <div className="flex items-center justify-center sm:justify-start">
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
              <button
                onClick={() => setViewMode("month")}
                className={`tap-target px-3 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all min-h-[40px] ${
                  viewMode === "month"
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`tap-target px-3 sm:px-4 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all min-h-[40px] ${
                  viewMode === "list"
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                List
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
                className="tap-target p-2.5 sm:p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600 dark:text-slate-400" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="tap-target px-4 sm:px-5 py-2.5 sm:py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-semibold text-xs sm:text-sm text-slate-700 dark:text-slate-300 transition-colors min-h-[44px]"
              >
                Today
              </button>
              <button
                onClick={() => navigateMonth("next")}
                className="tap-target p-2.5 sm:p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600 dark:text-slate-400" />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl sm:rounded-3xl p-2 sm:p-4 md:p-6 shadow-premium-lg border border-slate-200/50 dark:border-slate-700/50">
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1 sm:mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 py-1.5 sm:py-2"
                  >
                    {day.substring(0, 3)}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2 auto-rows-fr">
                {calendarDays.map((day, idx) => {
                  const dayEvents = getEventsForDate(day);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isToday = isSameDay(day, new Date());
                  const hasEvents = dayEvents.length > 0;

                  return (
                    <div
                      key={idx}
                      className={`w-full aspect-square p-1 sm:p-2 rounded-lg sm:rounded-xl border transition-all flex flex-col ${
                        isCurrentMonth
                          ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                          : "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 opacity-50"
                      } ${isToday ? "ring-2 ring-indigo-500 dark:ring-indigo-400" : ""}`}
                    >
                      <button
                        onClick={() => handleDateClick(day)}
                        className={`w-full text-left text-xs sm:text-sm md:text-base flex-1 flex items-start justify-start ${
                          isToday
                            ? "font-bold text-indigo-600 dark:text-indigo-400"
                            : isCurrentMonth
                            ? "text-slate-900 dark:text-slate-100"
                            : "text-slate-400 dark:text-slate-600"
                        }`}
                      >
                        {format(day, "d")}
                      </button>
                      
                      {/* Mobile/Tablet: Show task count only */}
                      {hasEvents && (
                        <button
                          onClick={() => handleDateClick(day)}
                          className="flex items-center justify-center mt-auto md:hidden"
                        >
                          <span className="text-xs sm:text-sm font-bold text-white bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center shadow-lg">
                            {dayEvents.length}
                          </span>
                        </button>
                      )}

                      {/* Desktop/Laptop: Show event names */}
                      <div className="hidden md:block space-y-1 mt-auto">
                        {dayEvents.slice(0, 2).map((event) => (
                          <button
                            key={event._id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEventClick(event);
                            }}
                            className={`w-full text-left px-2 py-1 rounded text-xs font-semibold text-white ${getEventTypeColor(
                              event.type
                            )} truncate hover:opacity-80 transition-opacity`}
                            title={event.title}
                          >
                            {event.time ? `${event.time} ` : ""}
                            {event.title}
                          </button>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 px-2">
                            +{dayEvents.length - 2} more
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
          <div className="space-y-3 sm:space-y-4">
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-8 sm:py-12 bg-slate-50 dark:bg-slate-800 rounded-2xl sm:rounded-3xl border border-slate-200/50 dark:border-slate-700/50">
                <CalendarIcon className="w-10 h-10 sm:w-12 sm:h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3 sm:mb-4" />
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-semibold">
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
                    className="relative overflow-hidden bg-slate-50 dark:bg-slate-800 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-premium-lg border border-slate-200/50 dark:border-slate-700/50 hover:shadow-premium-xl transition-all cursor-pointer group"
                    onClick={() => handleEventClick(event)}
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-600"></div>
                    <div className="pl-3 sm:pl-4 flex items-start justify-between gap-3 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                          <span
                            className={`px-2 sm:px-3 py-1 rounded-full text-xs font-bold text-white ${getEventTypeColor(
                              event.type
                            )}`}
                          >
                            {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                          </span>
                          {event.recurring?.enabled && (
                            <Repeat className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 dark:text-slate-400" />
                          )}
                          {event.reminder?.enabled && (
                            <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 dark:text-slate-400" />
                          )}
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 truncate">
                          {event.title}
                        </h3>
                        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                            <span className={isToday ? "font-bold text-indigo-600 dark:text-indigo-400" : ""}>
                              {format(eventDate, "EEE, MMM d, yyyy")}
                            </span>
                          </div>
                          {event.time && (
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                              <span>{event.time}</span>
                            </div>
                          )}
                          {event.location && (
                            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                              <span className="truncate">{event.location}</span>
                            </div>
                          )}
                        </div>
                        {event.description && (
                          <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                            {event.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(event._id);
                        }}
                        className="tap-target p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                        aria-label="Delete event"
                      >
                        <Trash2 className="w-5 h-5" />
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
    </div>
  );
}
