"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getCalendarEvents } from "@/app/actions/calendar";
import { getHabitsForDateRange, getHabitStatusesForDate, logHabit } from "@/app/actions/habits";
import { getUserProfile } from "@/app/actions/profile";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Check, Clock, X } from "lucide-react";
import Navigation from "@/components/Navigation";
import AddModal from "@/components/AddModal";
import { fetchWithCache, invalidateCache, CACHE_TYPES } from "@/lib/cache";

// Category color mapping - vibrant solid colors like in screenshot
const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
  personal: {
    bg: "bg-blue-500 dark:bg-blue-600",
    border: "border-blue-600 dark:border-blue-700",
    text: "text-white",
  },
  personalWork: {
    bg: "bg-blue-500 dark:bg-blue-600",
    border: "border-blue-600 dark:border-blue-700",
    text: "text-white",
  },
  productive: {
    bg: "bg-yellow-500 dark:bg-yellow-600",
    border: "border-yellow-600 dark:border-yellow-700",
    text: "text-white",
  },
  productivity: {
    bg: "bg-yellow-500 dark:bg-yellow-600",
    border: "border-yellow-600 dark:border-yellow-700",
    text: "text-white",
  },
  familyTime: {
    bg: "bg-green-500 dark:bg-green-600",
    border: "border-green-600 dark:border-green-700",
    text: "text-white",
  },
  family: {
    bg: "bg-green-500 dark:bg-green-600",
    border: "border-green-600 dark:border-green-700",
    text: "text-white",
  },
  journaling: {
    bg: "bg-purple-500 dark:bg-purple-600",
    border: "border-purple-600 dark:border-purple-700",
    text: "text-white",
  },
  journal: {
    bg: "bg-purple-500 dark:bg-purple-600",
    border: "border-purple-600 dark:border-purple-700",
    text: "text-white",
  },
  workBlock: {
    // Tomato color for Work Block
    bg: "bg-[#ff6347] dark:bg-[#ff7043]",
    border: "border-[#ff6347] dark:border-[#ff7043]",
    text: "text-white",
  },
  work: {
    bg: "bg-[#ff6347] dark:bg-[#ff7043]",
    border: "border-[#ff6347] dark:border-[#ff7043]",
    text: "text-white",
  },
};

// Category display names
const categoryDisplayNames: Record<string, string> = {
  personalWork: "Personal",
  personal: "Personal",
  productive: "Productivity",
  productivity: "Productivity",
  familyTime: "Family",
  family: "Family",
  journaling: "Journaling",
  journal: "Journaling",
  workBlock: "Work",
  work: "Work",
};

// Map habit category to time allocation key
function mapHabitCategoryToTimeAllocation(category: string): string {
  const mapping: Record<string, string> = {
    personal: "personalWork",
    personalWork: "personalWork",
    work: "workBlock",
    workBlock: "workBlock",
    productive: "productive",
    productivity: "productive",
    familyTime: "familyTime",
    family: "familyTime",
    journal: "journaling",
    journaling: "journaling",
  };
  return mapping[category] || "personalWork";
}

// Format time for display (HH:MM to 12-hour format)
function formatTimeForDisplay(time: string): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

// Convert time to minutes for positioning
function timeToMinutes(time: string): number {
  if (!time) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Timeline layout constants (in hours and pixels)
const TIMELINE_START_HOUR = 4; // 4 AM
const TIMELINE_END_HOUR = 23;  // 11 PM
const PIXELS_PER_HOUR = 80;    // vertical pixels per hour
const PIXELS_PER_MINUTE = PIXELS_PER_HOUR / 60;

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [habits, setHabits] = useState<Record<string, any[]>>({});
  const [timeCategories, setTimeCategories] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCategoryForAdd, setSelectedCategoryForAdd] = useState<string | null>(null);
  const [todayHabitStatuses, setTodayHabitStatuses] = useState<Record<string, "done" | "skipped" | null>>({});
  const [selectedBlockForPopup, setSelectedBlockForPopup] = useState<{
    categoryKey: string;
    name: string;
    range: { startTime: string; endTime: string };
    habits: any[];
  } | null>(null);
  const [showHabitPopup, setShowHabitPopup] = useState(false);
  const [habitToEdit, setHabitToEdit] = useState<any | null>(null);

  useEffect(() => {
    loadData();
  }, [currentDate, selectedDate]);

  async function loadData() {
    setLoading(true);
    
    // Load user profile to get time categories - THIS IS CRITICAL for blocks to appear
    const profileResult = await getUserProfile();
    if (profileResult.success && profileResult.profile) {
      console.log("[Calendar] Full profile data:", profileResult.profile);
      if (profileResult.profile.timeCategories) {
        setTimeCategories(profileResult.profile.timeCategories);
        console.log("[Calendar] Loaded time categories:", profileResult.profile.timeCategories);
        console.log("[Calendar] Time categories keys:", Object.keys(profileResult.profile.timeCategories));
      } else {
        console.warn("[Calendar] Profile exists but no timeCategories field");
        console.warn("[Calendar] Profile keys:", Object.keys(profileResult.profile));
      }
    } else {
      console.error("[Calendar] Failed to load profile:", profileResult);
    }

    // Load calendar events (these are NOT displayed as blocks, only for summary cards)
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const rangeStart = startOfWeek(monthStart);
    const rangeEnd = endOfWeek(monthEnd);
    
    const eventsResult = await getCalendarEvents(
      rangeStart.toISOString(),
      rangeEnd.toISOString()
    );
    if (eventsResult.success) {
      setEvents(eventsResult.events || []);
    }

    // Load habits for the date range (to show inside category blocks)
    const habitsResult = await getHabitsForDateRange(
      rangeStart.toISOString(),
      rangeEnd.toISOString()
    );
    if (habitsResult.success) {
      setHabits(habitsResult.habitsByDate || {});
    }

    // Load habit statuses for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isSameDay(selectedDate, today)) {
      const statusResult = await getHabitStatusesForDate(today.toISOString());
      if (statusResult.success && statusResult.statuses) {
        setTodayHabitStatuses(statusResult.statuses);
      }
    }

    setLoading(false);
  }

  function handleDateClick(date: Date) {
    setSelectedDate(date);
  }

  function navigateMonth(direction: "prev" | "next") {
    setCurrentDate((prev) => (direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1)));
  }

  // Get habits for selected date grouped by category
  const habitsForSelectedDate = useMemo(() => {
    const dateStr = selectedDate.toISOString().split("T")[0];
    const dateHabits = habits[dateStr] || [];
    
    // Group habits by category
    const grouped: Record<string, any[]> = {};
    dateHabits.forEach((habit) => {
      const category = mapHabitCategoryToTimeAllocation(habit.category || "personal");
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(habit);
    });
    
    return grouped;
  }, [habits, selectedDate]);

  // Get category time blocks for timeline
  const categoryBlocks = useMemo(() => {
    if (!timeCategories) {
      console.log("[Calendar] No timeCategories available");
      return [];
    }
    
    console.log("[Calendar] Processing timeCategories:", timeCategories);
    
    const blocks: Array<{
      key: string;
      name: string;
      categoryKey: string;
      ranges: Array<{ startTime: string; endTime: string }>;
      habits: any[];
    }> = [];

    // Process each time category from profile
    Object.entries(timeCategories).forEach(([key, category]: [string, any]) => {
      if (!category) {
        console.log(`[Calendar] Category ${key} is null/undefined`);
        return;
      }
      
      console.log(`[Calendar] Processing category ${key}:`, category);
      
      // Get ranges - support both new multi-range format and legacy single range format
      let ranges: Array<{ startTime: string; endTime: string }> = [];
      
      if (Array.isArray(category.ranges) && category.ranges.length > 0) {
        // New format: multiple ranges
        ranges = category.ranges.filter((r: any) => r.startTime && r.endTime);
        console.log(`[Calendar] Category ${key} has ${ranges.length} ranges (multi-range format)`);
      } else if (category.startTime && category.endTime) {
        // Legacy format: single range
        ranges = [{ startTime: category.startTime, endTime: category.endTime }];
        console.log(`[Calendar] Category ${key} has single range: ${category.startTime} - ${category.endTime}`);
      } else {
        console.log(`[Calendar] Category ${key} has no valid time ranges`);
      }
      
      if (ranges.length === 0) {
        console.log(`[Calendar] Skipping category ${key} - no ranges`);
        return;
      }

      const categoryKey = key;
      const habitsInCategory = habitsForSelectedDate[categoryKey] || [];
      console.log(`[Calendar] Category ${key} has ${habitsInCategory.length} habits`);
      
      // Create a block for each range - blocks appear based on profile time allocation
      ranges.forEach((range: any) => {
        if (range.startTime && range.endTime) {
          const block = {
            key: `${categoryKey}-${range.startTime}-${range.endTime}`,
            name: categoryDisplayNames[categoryKey] || categoryKey,
            categoryKey: categoryKey,
            ranges: [range],
            habits: habitsInCategory,
          };
          blocks.push(block);
          console.log(`[Calendar] Created block for ${categoryKey}: ${range.startTime} - ${range.endTime}`);
        }
      });
    });

    // Sort blocks by start time
    blocks.sort((a, b) => {
      const aStart = timeToMinutes(a.ranges[0].startTime);
      const bStart = timeToMinutes(b.ranges[0].startTime);
      return aStart - bStart;
    });

    console.log(`[Calendar] Total blocks created: ${blocks.length}`, blocks);
    return blocks;
  }, [timeCategories, habitsForSelectedDate]);

  // Get all-day events and summary cards
  const allDayEvents = useMemo(() => {
    const dateStr = selectedDate.toISOString().split("T")[0];
    return (events || []).filter((event) => {
      const eventDate = new Date(event.date);
      return eventDate.toISOString().split("T")[0] === dateStr && !event.time;
    });
  }, [events, selectedDate]);

  // Get pending tasks count
  const pendingTasksCount = useMemo(() => {
    const dateStr = selectedDate.toISOString().split("T")[0];
    const dateHabits = habits[dateStr] || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (!isSameDay(selectedDate, today)) return 0;
    
    // Count high priority habits that are not completed
    return dateHabits.filter((habit) => {
      if (habit.priority !== "high") return false;
      const status = todayHabitStatuses[habit._id];
      return status !== "done";
    }).length;
  }, [habits, selectedDate, todayHabitStatuses]);

  // Generate calendar days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = useMemo(
    () => eachDayOfInterval({ start: calendarStart, end: calendarEnd }),
    [calendarStart.getTime(), calendarEnd.getTime()]
  );

  // Get events count for a date
  function getEventsCountForDate(date: Date): number {
    const dateStr = date.toISOString().split("T")[0];
    const dateEvents = (events || []).filter((event) => {
      const eventDate = new Date(event.date);
      return eventDate.toISOString().split("T")[0] === dateStr;
    });
    const dateHabits = habits[dateStr] || [];
    return dateEvents.length + dateHabits.length;
  }

  // Handle habit completion
  async function handleHabitComplete(habitId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!isSameDay(selectedDate, today)) return;
    
    const result = await logHabit(habitId, "done", selectedDate.toISOString());
    if (result.success) {
      setTodayHabitStatuses((prev) => ({
        ...prev,
        [habitId]: "done",
      }));
      invalidateCache(CACHE_TYPES.HABITS_FOR_DATE);
      loadData();
    }
  }

  // Handle habit skip
  async function handleHabitSkip(habitId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!isSameDay(selectedDate, today)) return;
    
    const result = await logHabit(habitId, "skipped", selectedDate.toISOString());
    if (result.success) {
      setTodayHabitStatuses((prev) => ({
        ...prev,
        [habitId]: "skipped",
      }));
      invalidateCache(CACHE_TYPES.HABITS_FOR_DATE);
      loadData();
    }
  }

  // Calculate position (top) and height for a block based on time range
  function getBlockStyle(range: { startTime: string; endTime: string }, habitCount: number = 0) {
    const startMinutes = timeToMinutes(range.startTime);
    const endMinutes = timeToMinutes(range.endTime);
    const duration = endMinutes < startMinutes
      ? (24 * 60) - startMinutes + endMinutes
      : endMinutes - startMinutes;

    const timelineStartMinutes = TIMELINE_START_HOUR * 60;

    // Position from start of visible timeline
    const startOffsetMinutes = Math.max(0, startMinutes - timelineStartMinutes);
    const topPx = startOffsetMinutes * PIXELS_PER_MINUTE;

    // Height based on duration
    const rawHeightPx = duration * PIXELS_PER_MINUTE;
    const minHeightPx = Math.max(PIXELS_PER_HOUR * 0.5, 20); // at least 30–40px
    const heightPx = Math.max(minHeightPx, rawHeightPx);

    return {
      top: `${topPx}px`,
      height: `${heightPx}px`,
      zIndex: 1,
    };
  }

  // Generate hour markers (4 AM to 11 PM)
  const hourMarkers = useMemo(() => {
    const hours = [];
    for (let h = TIMELINE_START_HOUR; h <= TIMELINE_END_HOUR; h++) {
      hours.push(h);
    }
    return hours;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 sm:pb-24 md:pb-6 md:pl-20 lg:pl-64 safe-bottom">
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-slate-400">Loading calendar...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 sm:pb-24 md:pb-6 md:pl-20 lg:pl-64 safe-bottom">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto px-3 sm:px-4 md:px-6 pt-4 sm:pt-6 md:pt-8 pb-8 sm:pb-6 md:pb-8">
        {/* TOP SECTION: Monthly Calendar */}
        <div className="mb-4 sm:mb-6">
          {/* Month Header */}
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              {format(currentDate, "MMMM yyyy")}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateMonth("prev")}
                className="tap-target p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="tap-target px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => navigateMonth("next")}
                className="tap-target p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-2 sm:p-3 shadow-lg border border-slate-200/50 dark:border-slate-700/50">
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                <div
                  key={`${day}-${index}`}
                  className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400 py-1"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isToday = isSameDay(day, new Date());
                const isSelected = isSameDay(day, selectedDate);
                const eventsCount = getEventsCountForDate(day);

                return (
                  <button
                    key={idx}
                    onClick={() => handleDateClick(day)}
                    className={`relative aspect-square p-1 rounded-md transition-all ${
                      isCurrentMonth
                        ? "bg-white dark:bg-slate-900"
                        : "bg-slate-50/50 dark:bg-slate-800/30 opacity-60"
                    } ${
                      isSelected
                        ? "ring-2 ring-indigo-500 dark:ring-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                        : ""
                    } ${isToday && !isSelected ? "ring-1 ring-slate-300 dark:ring-slate-600" : ""}`}
                  >
                    <div
                      className={`text-xs font-medium ${
                        isSelected
                          ? "text-indigo-600 dark:text-indigo-400 font-bold"
                          : isToday
                          ? "text-indigo-600 dark:text-indigo-400"
                          : isCurrentMonth
                          ? "text-slate-900 dark:text-slate-100"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {format(day, "d")}
                    </div>
                    {eventsCount > 0 && (
                      <div className="flex items-center justify-center gap-0.5 mt-0.5">
                        {Array.from({ length: Math.min(3, eventsCount) }).map((_, i) => (
                          <div
                            key={i}
                            className="w-1 h-1 rounded-full bg-indigo-500 dark:bg-indigo-400"
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* MIDDLE SECTION: Summary Cards */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {format(selectedDate, "EEE")}
            </span>
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {format(selectedDate, "d")}
            </span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {allDayEvents.map((event, idx) => (
              <div
                key={event._id || idx}
                className="px-3 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs font-medium flex items-center gap-1.5"
              >
                <Check className="w-3 h-3" />
                {event.title}
              </div>
            ))}
            {pendingTasksCount > 0 && (
              <div className="px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-xs font-medium flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                {pendingTasksCount} pending task{pendingTasksCount !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>

        {/* MAIN SECTION: Timeline Planner */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 sm:p-6 shadow-lg border border-slate-200/50 dark:border-slate-700/50">
          {/* Height is based on visible hours in the timeline */}
          <div
            className="relative"
            style={{ height: `${(TIMELINE_END_HOUR - TIMELINE_START_HOUR) * PIXELS_PER_HOUR}px` }}
          >
            {/* Hour Markers */}
            <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-20">
              {hourMarkers.map((hour) => (
                <div
                  key={hour}
                  className="absolute text-xs text-slate-500 dark:text-slate-400 font-medium"
                  style={{
                    top: `${(hour - TIMELINE_START_HOUR) * PIXELS_PER_HOUR}px`,
                  }}
                >
                  {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
                </div>
              ))}
            </div>

            {/* Category Blocks */}
            <div className="ml-20 sm:ml-24 relative">
              {categoryBlocks.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center p-6">
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">
                      No time categories found
                    </p>
                    <p className="text-slate-400 dark:text-slate-500 text-xs">
                      Please set up your time allocation in the Profile page
                    </p>
                  </div>
                </div>
              ) : (
                categoryBlocks.map((block) => {
                  const range = block.ranges[0];
                  const style = getBlockStyle(range, block.habits.length);
                  const colors = categoryColors[block.categoryKey] || categoryColors.personalWork;
                  const isToday = isSameDay(selectedDate, new Date());

                  return (
                    <div
                      key={block.key}
                      className={`absolute left-0 right-0 rounded-xl border-2 ${colors.bg} ${colors.border} ${colors.text} p-4 sm:p-5 overflow-y-auto shadow-lg cursor-pointer`}
                      style={style}
                      onClick={() => {
                        if (!block.habits || block.habits.length === 0) return;
                        setSelectedBlockForPopup({
                          categoryKey: block.categoryKey,
                          name: block.name,
                          range,
                          habits: block.habits,
                        });
                        setShowHabitPopup(true);
                      }}
                    >
                    <div className="font-bold text-base sm:text-lg mb-1 text-white">
                      {block.name}
                    </div>
                    <div className="text-xs text-white/80 mb-3">
                      {formatTimeForDisplay(range.startTime)} - {formatTimeForDisplay(range.endTime)}
                    </div>
                    {/* Debug info in development */}
                    {typeof window !== 'undefined' && window.location.hostname === 'localhost' && (
                      <div className="text-xs text-white/50 mb-2 font-mono">
                        {block.categoryKey} | {range.startTime}-{range.endTime}
                      </div>
                    )}
                    {block.habits.length > 0 ? (
                      <div className="space-y-1.5 mt-3">
                        {block.habits.map((habit) => {
                          const habitStatus = isToday ? todayHabitStatuses[habit._id] : null;
                          const isCompleted = habitStatus === "done";
                          const isSkipped = habitStatus === "skipped";

                          return (
                            <div key={habit._id} className="flex items-center gap-2 text-xs sm:text-sm text-white/90">
                              <span className={`${isCompleted || isSkipped ? "line-through opacity-70" : ""}`}>
                                • {habit.name}
                              </span>
                              {habitStatus === "done" && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/80 text-[10px] ml-1">
                                  Completed
                                </span>
                              )}
                              {habitStatus === "skipped" && (
                                <span className="px-2 py-0.5 rounded-full bg-slate-700/80 text-[10px] ml-1">
                                  Skipped
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-white/70 italic mt-2">
                        No habits scheduled
                      </div>
                    )}
                  </div>
                );
              }))}
              
              {/* Current Time Indicator (only for today) */}
              {isSameDay(selectedDate, new Date()) && (() => {
                const now = new Date();
                const currentHour = now.getHours();
                const currentMinutes = now.getMinutes();
                const currentTimeMinutes = currentHour * 60 + currentMinutes;
                
                const timelineStartMinutes = TIMELINE_START_HOUR * 60;
                const timelineEndMinutes = TIMELINE_END_HOUR * 60;
                
                if (currentTimeMinutes >= timelineStartMinutes && currentTimeMinutes <= timelineEndMinutes) {
                  const offsetMinutes = currentTimeMinutes - timelineStartMinutes;
                  const topPx = offsetMinutes * PIXELS_PER_MINUTE;
                  
                  return (
                    <div
                      className="absolute left-0 right-0 h-0.5 bg-white z-20"
                      style={{ top: `${topPx}px` }}
                    >
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-900 dark:border-slate-100" />
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </div>

        {/* Habit Details Popup for a time block (shows all habits in the block) */}
        {selectedBlockForPopup && showHabitPopup && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3">
            <div className="bg-slate-900 text-white rounded-2xl shadow-2xl max-w-md w-full p-4 sm:p-6 relative">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold mb-1">
                    {selectedBlockForPopup.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300">
                    {formatTimeForDisplay(selectedBlockForPopup.range.startTime)} -{" "}
                    {formatTimeForDisplay(selectedBlockForPopup.range.endTime)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowHabitPopup(false);
                    setSelectedBlockForPopup(null);
                  }}
                  className="tap-target p-1.5 rounded-full hover:bg-slate-800 text-slate-300"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mb-4 space-y-1">
                <p className="text-xs sm:text-sm text-slate-300">
                  Date: {format(selectedDate, "EEE, d MMM yyyy")}
                </p>
              </div>

              {/* Habits inside this block */}
              <div className="space-y-3">
                {selectedBlockForPopup.habits.map((habit) => {
                  const status = todayHabitStatuses[habit._id];
                  const isCompleted = status === "done";
                  const isSkipped = status === "skipped";
                  const isLowPriority = habit.priority === "low";

                  return (
                    <div
                      key={habit._id}
                      className="border border-slate-700 rounded-xl p-3 bg-slate-800/60"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <p className={`text-sm font-semibold ${isCompleted || isSkipped ? "line-through opacity-70" : ""}`}>
                            {habit.name}
                          </p>
                          <p className="text-[11px] text-slate-300 mt-0.5">
                            Priority:{" "}
                            <span className={habit.priority === "high" ? "text-red-300" : "text-emerald-300"}>
                              {habit.priority === "high" ? "High" : "Low"}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Status:{" "}
                            {isCompleted ? "Completed" : isSkipped ? "Skipped" : "Pending"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 justify-end">
                        {!isCompleted && (
                          <button
                            onClick={async () => {
                              await handleHabitComplete(habit._id);
                            }}
                            className="tap-target px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Complete</span>
                          </button>
                        )}
                        {isLowPriority && !isCompleted && !isSkipped && (
                          <button
                            onClick={async () => {
                              await handleHabitSkip(habit._id);
                            }}
                            className="tap-target px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-xs font-semibold flex items-center gap-1.5"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Skip</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setHabitToEdit(habit);
                            setShowHabitPopup(false);
                            setShowAddModal(true);
                          }}
                          className="tap-target px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold flex items-center gap-1.5 border border-slate-600"
                        >
                          <span>Edit</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Floating Add Button */}
        <button
          onClick={() => {
            setSelectedCategoryForAdd(null);
            setHabitToEdit(null);
            setShowAddModal(true);
          }}
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 w-14 h-14 sm:w-16 sm:h-16 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-50 tap-target"
          aria-label="Add habit"
        >
          <Plus className="w-6 h-6 sm:w-7 sm:h-7" />
        </button>

        {/* Add Modal */}
        <AddModal
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setSelectedCategoryForAdd(null);
            setHabitToEdit(null);
            invalidateCache(CACHE_TYPES.HABITS_FOR_DATE);
            loadData();
          }}
          defaultTab="habit"
          defaultCategory={selectedCategoryForAdd || undefined}
          defaultDate={selectedDate}
          habitToEdit={habitToEdit}
          onHabitCreated={() => {
            invalidateCache(CACHE_TYPES.HABITS_FOR_DATE);
            loadData();
          }}
        />
      </div>
      <Navigation />
    </div>
  );
}
