"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getCalendarEvents, deleteCalendarEvent, updateCalendarEvent } from "@/app/actions/calendar";
import { getHabitsForDateRange, getHabitStatusesForDate, logHabit } from "@/app/actions/habits";
import { getUserProfile } from "@/app/actions/profile";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Check, Clock, X, Cake, ListTodo, Calendar as CalendarIcon, Target, Trash2, Edit } from "lucide-react";
import Navigation from "@/components/Navigation";
import AddModal from "@/components/AddModal";
import CalendarEventModal from "@/components/CalendarEventModal";
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

// Parse API date string (YYYY-MM-DD or ISO) to local YYYY-MM-DD — avoids timezone shift
function parseToLocalDateString(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  const part = dateStr.split("T")[0];
  const parts = part.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Compact layout: min block height so content is clear
const MIN_BLOCK_HEIGHT_BASE = 88;
const MIN_BLOCK_HEIGHT_PER_HABIT = 52;

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [habits, setHabits] = useState<Record<string, any[]>>({});
  const [timeCategories, setTimeCategories] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventModalType, setEventModalType] = useState<"meeting" | "todo" | "birthday">("todo");
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
  const [eventToEdit, setEventToEdit] = useState<any | null>(null);
  const monthTimelineRef = useRef<HTMLDivElement>(null);
  const currentMonthPillRef = useRef<HTMLButtonElement>(null);
  const hasScrolledTimelineOnceRef = useRef(false);

  useEffect(() => {
    loadData();
  }, [currentDate, selectedDate]);

  // Scroll the month timeline to current month only once when the page first loads (not on date/month click)
  useEffect(() => {
    if (loading || hasScrolledTimelineOnceRef.current) return;
    hasScrolledTimelineOnceRef.current = true;
    currentMonthPillRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [loading]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (showAddMenu && !target.closest(".add-menu-container")) {
        setShowAddMenu(false);
      }
    }
    if (showAddMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showAddMenu]);

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
    // Normalize date to local midnight to avoid timezone issues
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    setSelectedDate(normalizedDate);
  }

  function navigateMonth(direction: "prev" | "next") {
    setCurrentDate((prev) => (direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1)));
  }

  // Helper function to get local date string (YYYY-MM-DD) without timezone issues
  function getLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Get habits for selected date grouped by category
  const habitsForSelectedDate = useMemo(() => {
    const normalizedSelectedDate = new Date(selectedDate);
    normalizedSelectedDate.setHours(0, 0, 0, 0);
    const dateStr = getLocalDateString(normalizedSelectedDate);
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

  // Get all events (birthdays, todos, meetings) for selected date - combined list (includes yearly recurring)
  const allEventsForSelectedDate = useMemo(() => {
    const normalizedSelectedDate = new Date(selectedDate);
    normalizedSelectedDate.setHours(0, 0, 0, 0);
    const selectedDateStr = getLocalDateString(normalizedSelectedDate);
    
    const allEvents: any[] = [];
    
    // Get birthdays (including yearly recurring)
    const birthdays = (events || []).filter((event) => {
      if (event.type !== "birthday") return false;
      return eventOccursOnDate(event, normalizedSelectedDate);
    });
    allEvents.push(...birthdays);
    
    // Get todos: show if selected date is within [start, deadline], or same month/day if yearly
    const todos = (events || []).filter((event) => {
      if (event.type !== "todo") return false;
      if (event.recurring?.enabled && event.recurring?.frequency === "yearly") {
        return eventOccursOnDate(event, normalizedSelectedDate);
      }
      const startDateStr = parseToLocalDateString(event.date);
      if (!startDateStr) return false;
      if (!event.deadline) return startDateStr === selectedDateStr;
      const deadlineDateStr = parseToLocalDateString(event.deadline);
      if (!deadlineDateStr) return startDateStr === selectedDateStr;
      return selectedDateStr >= startDateStr && selectedDateStr <= deadlineDateStr;
    });
    allEvents.push(...todos);
    
    // Get meetings (including yearly recurring)
    const meetings = (events || []).filter((event) => {
      if (event.type !== "meeting") return false;
      return eventOccursOnDate(event, normalizedSelectedDate);
    });
    allEvents.push(...meetings);
    
    // Sort by time if available, otherwise by type
    return allEvents.sort((a, b) => {
      if (a.time && b.time) {
        return a.time.localeCompare(b.time);
      }
      if (a.time) return -1;
      if (b.time) return 1;
      return 0;
    });
  }, [events, selectedDate]);
  
  // Check if selected date is today
  const isSelectedDateToday = useMemo(() => {
    return isSameDay(selectedDate, new Date());
  }, [selectedDate]);

  // Get pending tasks count
  const pendingTasksCount = useMemo(() => {
    const normalizedSelectedDate = new Date(selectedDate);
    normalizedSelectedDate.setHours(0, 0, 0, 0);
    const dateStr = getLocalDateString(normalizedSelectedDate);
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

  // Scrollable month timeline: 2026 Jan Feb ... Dec 2027 Jan Feb ... (continuous across years)
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const timelineItems = useMemo(() => {
    const items: Array<{ type: "year"; year: number } | { type: "month"; month: number; year: number }> = [];
    const startYear = currentDate.getFullYear() - 2;
    const endYear = currentDate.getFullYear() + 2;
    for (let y = startYear; y <= endYear; y++) {
      items.push({ type: "year", year: y });
      for (let m = 0; m < 12; m++) {
        items.push({ type: "month", month: m, year: y });
      }
    }
    return items;
  }, [currentDate.getFullYear()]);

  // Helper: does this event occur on the given date? (handles yearly recurring)
  function eventOccursOnDate(event: any, checkDate: Date): boolean {
    const d = new Date(checkDate);
    d.setHours(0, 0, 0, 0);
    const eventDate = new Date(event.date);
    eventDate.setHours(0, 0, 0, 0);
    if (event.recurring?.enabled && event.recurring?.frequency === "yearly") {
      return eventDate.getMonth() === d.getMonth() && eventDate.getDate() === d.getDate();
    }
    return getLocalDateString(eventDate) === getLocalDateString(d);
  }

  // Get events by type for a date (including todos with date ranges and yearly recurring)
  function getEventsByTypeForDate(date: Date): {
    birthday: number;
    meeting: number;
    todo: number;
  } {
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    const checkDateStr = getLocalDateString(checkDate);
    
    // Get birthdays that occur on this date (including yearly recurring)
    const birthdays = (events || []).filter((event) => {
      if (event.type !== "birthday") return false;
      return eventOccursOnDate(event, date);
    });
    
    // Get meetings that occur on this date (including yearly recurring)
    const meetings = (events || []).filter((event) => {
      if (event.type !== "meeting") return false;
      return eventOccursOnDate(event, date);
    });
    
    // Get todos: date range, or same month/day if yearly recurring
    const todos = (events || []).filter((event) => {
      if (event.type !== "todo") return false;
      if (event.recurring?.enabled && event.recurring?.frequency === "yearly") {
        return eventOccursOnDate(event, date);
      }
      const startDateStr = parseToLocalDateString(event.date);
      if (!startDateStr) return false;
      if (!event.deadline) return startDateStr === checkDateStr;
      const deadlineDateStr = parseToLocalDateString(event.deadline);
      if (!deadlineDateStr) return startDateStr === checkDateStr;
      return checkDateStr >= startDateStr && checkDateStr <= deadlineDateStr;
    });
    
    return {
      birthday: birthdays.length,
      meeting: meetings.length,
      todo: todos.length,
    };
  }

  // Get events count for a date (for backward compatibility)
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

  // Minimum height for a block so content is clear (compact layout)
  function getBlockMinHeight(habitCount: number = 0) {
    return Math.max(MIN_BLOCK_HEIGHT_BASE, MIN_BLOCK_HEIGHT_BASE + habitCount * MIN_BLOCK_HEIGHT_PER_HABIT);
  }

  // Check if current time falls within a block's range (for "Now" badge when viewing today)
  function isBlockCurrentTime(range: { startTime: string; endTime: string }): boolean {
    if (!isSameDay(selectedDate, new Date())) return false;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = timeToMinutes(range.startTime);
    const endMinutes = timeToMinutes(range.endTime);
    if (endMinutes > startMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  if (loading) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32 sm:pb-28 md:pb-6 md:pl-20 lg:pl-64 safe-bottom">
          <div className="flex items-center justify-center py-20">
            <div className="animate-pulse text-slate-400">Loading calendar...</div>
          </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32 sm:pb-28 md:pb-6 md:pl-20 lg:pl-64 safe-bottom">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto px-2 sm:px-4 md:px-6 pt-3 sm:pt-6 md:pt-8 pb-6 sm:pb-6 md:pb-8">
        {/* Top Header - Laptop View Only (no Add button, just title) */}
        <div className="hidden lg:flex items-center justify-start mb-4 lg:mb-6">
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-slate-100">
            Calendar
          </h1>
        </div>

        {/* TOP SECTION: Monthly Calendar */}
        <div className="mb-4 sm:mb-6">
          {/* Month Header */}
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              {format(currentDate, "MMMM yyyy")}
            </h2>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => navigateMonth("prev")}
                className="tap-target min-h-[44px] min-w-[44px] p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="tap-target min-h-[44px] px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => navigateMonth("next")}
                className="tap-target min-h-[44px] min-w-[44px] p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-400" />
              </button>
            </div>
            </div>

            {/* Calendar Grid */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-2 sm:p-4 shadow-lg border border-slate-200/50 dark:border-slate-700/50">
              {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
                  <div
                  key={`${day}-${index}`}
                  className="text-center text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 py-2"
                  >
                  {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {calendarDays.map((day, idx) => {
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isToday = isSameDay(day, new Date());
                const isSelected = isSameDay(day, selectedDate);
                const eventsByType = getEventsByTypeForDate(day);
                const hasEvents = eventsByType.birthday > 0 || eventsByType.meeting > 0 || eventsByType.todo > 0;
                const normalizedDay = new Date(day);
                normalizedDay.setHours(0, 0, 0, 0);
                const dateStr = getLocalDateString(normalizedDay);
                const dateHabits = habits[dateStr] || [];
                const hasHabits = dateHabits.length > 0;

                  return (
                  <button
                      key={idx}
                    onClick={() => handleDateClick(day)}
                    className={`relative flex flex-col items-center justify-start min-h-[60px] sm:min-h-[80px] md:min-h-[100px] p-2 rounded-lg transition-all tap-target border ${
                      isToday
                        ? "bg-blue-100 dark:bg-blue-900/60 border-blue-300 dark:border-blue-700 shadow-sm"
                        : isCurrentMonth
                        ? "bg-transparent dark:bg-transparent border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        : "bg-slate-50/30 dark:bg-slate-800/20 border-slate-100 dark:border-slate-700/50 opacity-60"
                    } ${
                      isSelected && !isToday
                        ? "ring-2 ring-indigo-500 dark:ring-indigo-400 ring-inset border-indigo-400 dark:border-indigo-500"
                        : isSelected && isToday
                        ? "ring-2 ring-indigo-500 dark:ring-indigo-400 ring-inset"
                        : ""
                    }`}
                  >
                    {/* Date Number */}
                    <div
                      className={`text-sm sm:text-base font-semibold mb-1 ${
                        isSelected
                          ? "text-indigo-600 dark:text-indigo-400"
                          : isToday
                          ? "text-blue-700 dark:text-blue-300"
                            : isCurrentMonth
                            ? "text-slate-900 dark:text-slate-100"
                            : "text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        {format(day, "d")}
                    </div>
                    
                    {/* Dots below date number */}
                    {(hasEvents || hasHabits) && (
                      <div className="flex items-center justify-center gap-1 flex-wrap mt-auto">
                        {/* Birthday dots (pink) */}
                        {eventsByType.birthday > 0 && (
                          <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-pink-500 dark:bg-pink-400 shadow-sm" title="Birthday" />
                        )}
                        {/* Todo dots (blue) */}
                        {eventsByType.todo > 0 && (
                          <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-blue-500 dark:bg-blue-400 shadow-sm" title="Todo" />
                        )}
                        {/* Meeting dots (amber) */}
                        {eventsByType.meeting > 0 && (
                          <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-amber-500 dark:bg-amber-400 shadow-sm" title="Meeting" />
                        )}
                        {/* Habit dots (green) - always show if there are habits */}
                        {hasHabits && (
                          <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-green-500 dark:bg-green-400 shadow-sm" title="Habit" />
                        )}
                      </div>
                    )}
                      </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable Month Timeline: 2026 Jan Feb ... Dec 2027 Jan Feb ... */}
          <div
            ref={monthTimelineRef}
            className="mt-3 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent"
          >
            <div className="flex items-center gap-1.5 pb-2 min-w-max">
              {timelineItems.map((item, idx) => {
                if (item.type === "year") {
                  return (
                    <span
                      key={`y-${item.year}`}
                      className="flex-shrink-0 px-2.5 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-400"
                    >
                      {item.year}
                    </span>
                  );
                }
                const { month, year } = item;
                const isCurrent = currentDate.getFullYear() === year && currentDate.getMonth() === month;
                return (
                  <button
                    key={`m-${year}-${month}`}
                    ref={isCurrent ? currentMonthPillRef : null}
                    type="button"
                    onClick={() => setCurrentDate(new Date(year, month, 1))}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors tap-target ${
                      isCurrent
                        ? "bg-indigo-500 text-white dark:bg-indigo-400 dark:text-slate-900"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {MONTH_NAMES[month]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Add Button - Mobile: Below Calendar, Desktop: Fixed Bottom Right */}
        <div className="md:fixed md:bottom-8 md:right-8 relative md:z-50 add-menu-container mb-4 md:mb-0 flex justify-center md:justify-end">
          {/* Dropup Menu */}
          {showAddMenu && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-0 mb-2 w-48 sm:w-56 md:w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-fade-in z-50">
              <button
                onClick={() => {
                  setEventModalType("birthday");
                  setShowEventModal(true);
                  setShowAddMenu(false);
                }}
                className="w-full px-4 py-3 sm:py-3.5 flex items-center justify-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors tap-target min-h-[44px]"
              >
                <Cake className="w-5 h-5 text-red-400 dark:text-red-400" />
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Add Birthday</span>
              </button>
              <button
                onClick={() => {
                  setEventModalType("todo");
                  setShowEventModal(true);
                  setShowAddMenu(false);
                }}
                className="w-full px-4 py-3 flex items-center justify-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-t border-slate-200 dark:border-slate-700 tap-target min-h-[44px]"
              >
                <ListTodo className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Add Todo</span>
              </button>
              <button
                onClick={() => {
                  setEventModalType("meeting");
                  setShowEventModal(true);
                  setShowAddMenu(false);
                }}
                className="w-full px-4 py-3 flex items-center justify-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-t border-slate-200 dark:border-slate-700 tap-target min-h-[44px]"
              >
                <CalendarIcon className="w-5 h-5 text-indigo-500" />
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Add Meeting</span>
              </button>
              <button
                onClick={() => {
                  setSelectedCategoryForAdd(null);
                  setHabitToEdit(null);
                  setShowAddModal(true);
                  setShowAddMenu(false);
                }}
                className="w-full px-4 py-3 flex items-center justify-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-t border-slate-200 dark:border-slate-700 tap-target min-h-[44px]"
              >
                <Target className="w-5 h-5 text-green-500" />
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Add Habit</span>
              </button>
            </div>
          )}

          {/* Add Button - Floating + Button */}
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className={`min-h-[56px] min-w-[56px] sm:min-h-[64px] sm:min-w-[64px] md:min-h-[72px] md:min-w-[72px] w-14 h-14 sm:w-16 sm:h-16 md:w-[72px] md:h-[72px] bg-gradient-to-br from-red-400 via-red-500 to-red-600 hover:from-red-500 hover:via-red-600 hover:to-red-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center tap-target ${
              showAddMenu ? "rotate-45" : ""
            }`}
            aria-label="Add new item"
          >
            <Plus className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
          </button>
        </div>

        {/* MIDDLE SECTION: All Events (Birthdays, Todos, Meetings) */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm sm:text-base font-semibold text-slate-700 dark:text-slate-300">
              {format(selectedDate, "EEE")}
            </span>
            <span className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              {format(selectedDate, "d")}
            </span>
          </div>
          
          {/* All Events List */}
          {allEventsForSelectedDate.length > 0 ? (
            <div className="space-y-2 sm:space-y-2.5">
              {allEventsForSelectedDate.map((event, idx) => {
                const getEventColor = (type: string) => {
                  switch (type) {
                    case "birthday":
                      return {
                        bg: "bg-pink-100 dark:bg-pink-900/30",
                        text: "text-pink-800 dark:text-pink-200",
                        accent: "text-pink-600 dark:text-pink-300",
                        dot: "bg-pink-500 dark:bg-pink-400",
                      };
                    case "todo":
                      return {
                        bg: "bg-blue-100 dark:bg-blue-900/30",
                        text: "text-blue-800 dark:text-blue-200",
                        accent: "text-blue-600 dark:text-blue-300",
                        dot: "bg-blue-500 dark:bg-blue-400",
                      };
                    case "meeting":
                      return {
                        bg: "bg-amber-100 dark:bg-amber-900/30",
                        text: "text-amber-800 dark:text-amber-200",
                        accent: "text-amber-600 dark:text-amber-300",
                        dot: "bg-amber-500 dark:bg-amber-400",
                      };
                    default:
                      return {
                        bg: "bg-slate-100 dark:bg-slate-800",
                        text: "text-slate-800 dark:text-slate-200",
                        accent: "text-slate-600 dark:text-slate-300",
                        dot: "bg-slate-500 dark:bg-slate-400",
                      };
                  }
                };
                
                const getEventIcon = (type: string) => {
                  switch (type) {
                    case "birthday":
                      return <Cake className="w-4 h-4" />;
                    case "todo":
                      return <ListTodo className="w-4 h-4" />;
                    case "meeting":
                      return <CalendarIcon className="w-4 h-4" />;
                    default:
                      return null;
                  }
                };
                
                const colors = getEventColor(event.type);
                const eventDate = new Date(event.date);
                const eventDateStr = eventDate.toISOString().split("T")[0];
                const selectedDateStr = selectedDate.toISOString().split("T")[0];
                const isDeadlineDate = event.deadline && 
                  new Date(event.deadline).toISOString().split("T")[0] === selectedDateStr &&
                  eventDateStr !== selectedDateStr;
                
                // Handle complete event
                const handleComplete = async () => {
                  // For now, complete means delete the event
                  const result = await deleteCalendarEvent(event._id);
                  if (result.success) {
                    invalidateCache(CACHE_TYPES.CALENDAR_EVENTS);
                    loadData();
                  }
                };
                
                // Handle reschedule (edit)
                const handleReschedule = () => {
                  setEventToEdit(event);
                  setEventModalType(event.type as "meeting" | "todo" | "birthday");
                  setShowEventModal(true);
                };
                
                // Handle delete
                const handleDelete = async () => {
                  if (confirm(`Are you sure you want to delete "${event.title}"?`)) {
                    const result = await deleteCalendarEvent(event._id);
                    if (result.success) {
                      invalidateCache(CACHE_TYPES.CALENDAR_EVENTS);
                      loadData();
                    }
                  }
                };
                
                return (
                  <div
                    key={event._id || idx}
                    className={`${colors.bg} ${colors.text} rounded-lg p-2.5 sm:p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0 w-full sm:w-auto">
                      {getEventIcon(event.type)}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium break-words">{event.title}</span>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {event.time && !isDeadlineDate && (
                            <span className={`text-xs ${colors.accent}`}>
                              {formatTimeForDisplay(event.time)}
                            </span>
                          )}
                          {event.deadline && event.type === "todo" && (
                            <span className={`text-xs ${colors.accent}`}>
                              {isDeadlineDate ? "Deadline: " : "Due: "}{format(new Date(event.deadline), "MMM d")}
                            </span>
                          )}
                          {event.location && event.type === "meeting" && (
                            <span className={`text-xs ${colors.accent}`}>
                              @ {event.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                      {/* Complete button - only for current date */}
                      {isSelectedDateToday && (
                        <button
                          onClick={handleComplete}
                          className="tap-target min-h-[44px] min-w-[44px] px-2 sm:px-3 py-2 sm:py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                          title="Complete"
                        >
                          <Check className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                          <span className="hidden sm:inline">Complete</span>
                        </button>
                      )}
                      
                      {/* Reschedule button */}
                      <button
                        onClick={handleReschedule}
                        className="tap-target min-h-[44px] min-w-[44px] px-2 sm:px-3 py-2 sm:py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                        title="Reschedule"
                      >
                        <Edit className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                        <span className="hidden sm:inline">Reschedule</span>
                      </button>
                      
                      {/* Delete button - icon only */}
                      <button
                        onClick={handleDelete}
                        className="tap-target min-h-[44px] min-w-[44px] p-2 sm:p-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors flex items-center justify-center"
                        title="Delete"
                        aria-label="Delete event"
                      >
                        <Trash2 className="w-4 h-4 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-slate-500 dark:text-slate-400 italic">
              No events scheduled for this date
            </div>
          )}
        </div>

        {/* MAIN SECTION: Timeline Planner - Compact stacked layout */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 md:p-6 shadow-lg border border-slate-200/50 dark:border-slate-700/50 overflow-x-auto -mx-2 sm:mx-0 mb-24 sm:mb-8 md:mb-0">
          {categoryBlocks.length === 0 ? (
            <div className="flex items-center justify-center py-12 sm:py-16">
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
            <div className="space-y-3 sm:space-y-4">
              {categoryBlocks.map((block) => {
                const range = block.ranges[0];
                const colors = categoryColors[block.categoryKey] || categoryColors.personalWork;
                const isToday = isSameDay(selectedDate, new Date());
                const isCurrentBlock = isBlockCurrentTime(range);
                const minHeight = getBlockMinHeight(block.habits.length);

                return (
                  <div
                    key={block.key}
                    className="flex gap-3 sm:gap-4 items-stretch"
                  >
                    {/* Time label - aligns block with time slot */}
                    <div className="flex-shrink-0 w-20 sm:w-24 pt-4 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium leading-tight">
                      {formatTimeForDisplay(range.startTime)}
                      <span className="block text-slate-400 dark:text-slate-500 font-normal mt-0.5">
                        – {formatTimeForDisplay(range.endTime)}
                      </span>
                    </div>

                    {/* Category block card - gap from space-y above creates separation */}
                    <div
                      className={`flex-1 min-w-0 rounded-xl border-2 ${colors.bg} ${colors.border} ${colors.text} shadow-md hover:shadow-lg transition-shadow cursor-pointer tap-target flex flex-col overflow-hidden`}
                      style={{ minHeight: `${minHeight}px` }}
                      onClick={() => {
                        setSelectedBlockForPopup({
                          categoryKey: block.categoryKey,
                          name: block.name,
                          range,
                          habits: block.habits || [],
                        });
                        setShowHabitPopup(true);
                      }}
                    >
                      <div className="p-4 sm:p-5 md:p-5 flex flex-col flex-1 min-h-0">
                        {/* Header with optional Now badge */}
                        <div className="flex-shrink-0 flex items-start justify-between gap-2 mb-3 sm:mb-4">
                          <div>
                            <div className="font-bold text-base sm:text-lg md:text-xl text-white break-words leading-tight">
                              {block.name}
                            </div>
                            <div className="text-xs sm:text-sm text-white/90 font-medium mt-1">
                              {formatTimeForDisplay(range.startTime)} – {formatTimeForDisplay(range.endTime)}
                            </div>
                          </div>
                          {isCurrentBlock && (
                            <span className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/25 text-white border border-white/40">
                              Now
                            </span>
                          )}
                        </div>

                        {/* Habits list */}
                        {block.habits.length > 0 ? (
                          <div className="flex-1 space-y-2.5 sm:space-y-3 min-h-0">
                            {block.habits.map((habit) => {
                              const habitStatus = isToday ? todayHabitStatuses[habit._id] : null;
                              const isCompleted = habitStatus === "done";
                              const isSkipped = habitStatus === "skipped";
                              const isHighPriority = habit.priority === "high";
                              const isLowPriority = habit.priority === "low";

                              return (
                                <div
                                  key={habit._id}
                                  className={`p-2.5 sm:p-3 md:p-3.5 rounded-lg border ${
                                    isHighPriority
                                      ? "bg-white/20 dark:bg-white/15 border-white/30 shadow-sm"
                                      : "bg-white/10 dark:bg-white/5 border-white/10 dark:border-white/5"
                                  } ${isCompleted || isSkipped ? "opacity-75" : ""}`}
                                >
                                  <div className="flex items-start justify-between gap-2 sm:gap-3">
                                    <div className="flex items-start gap-2 flex-1 min-w-0">
                                      <span className={`text-sm sm:text-base ${isHighPriority ? "font-bold text-white" : "font-medium text-white/95"} ${isCompleted || isSkipped ? "line-through opacity-60" : ""} break-words leading-relaxed`}>
                                        {habit.name}
                                      </span>
                                      {(habitStatus === "done" || habitStatus === "skipped") && (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold flex-shrink-0 mt-0.5 ${
                                          habitStatus === "done"
                                            ? "bg-emerald-500/90 text-white"
                                            : "bg-slate-600/80 text-white"
                                        }`}>
                                          {habitStatus === "done" ? "Done" : "Skipped"}
                                        </span>
                                      )}
                                    </div>
                                    {isToday && !isCompleted && (
                                      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            await handleHabitComplete(habit._id);
                                          }}
                                          className="tap-target min-h-[40px] sm:min-h-[44px] min-w-[40px] sm:min-w-[44px] px-2.5 sm:px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-xs sm:text-sm font-semibold flex items-center justify-center shadow-sm hover:shadow transition-all"
                                          title="Complete"
                                        >
                                          <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                                        </button>
                                        {isLowPriority && !isSkipped && (
                                          <button
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              await handleHabitSkip(habit._id);
                                            }}
                                            className="tap-target min-h-[40px] sm:min-h-[44px] min-w-[40px] sm:min-w-[44px] px-2.5 sm:px-3 py-2 rounded-lg bg-slate-600/90 hover:bg-slate-500/90 active:bg-slate-400/90 text-white text-xs sm:text-sm font-semibold flex items-center justify-center shadow-sm hover:shadow transition-all"
                                            title="Skip"
                                          >
                                            <X className="w-4 h-4 sm:w-5 sm:h-5" />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-center min-h-[2.5rem]">
                            <div className="text-sm sm:text-base text-white/60 italic text-center">
                              No habits scheduled
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
                {selectedBlockForPopup.habits.length === 0 ? (
                  <div className="text-center py-4 text-slate-400 text-sm">
                    No habits scheduled in this time block
                  </div>
                ) : (
                  selectedBlockForPopup.habits.map((habit) => {
                  const status = todayHabitStatuses[habit._id];
                  const isCompleted = status === "done";
                  const isSkipped = status === "skipped";
                  const isLowPriority = habit.priority === "low";

                    return (
                      <div
                      key={habit._id}
                      className="border border-slate-700 rounded-xl p-3 bg-slate-800/60"
                    >
                      <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
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
                        
                        {/* Buttons on the right side */}
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap">
                          {!isCompleted && (
                          <button
                              onClick={async () => {
                                await handleHabitComplete(habit._id);
                              }}
                              className="tap-target min-h-[44px] px-3 py-2 sm:py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5"
                            >
                              <Check className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                              <span>Complete</span>
                            </button>
                          )}
                          {isLowPriority && !isCompleted && !isSkipped && (
                            <button
                              onClick={async () => {
                                await handleHabitSkip(habit._id);
                              }}
                              className="tap-target min-h-[44px] px-3 py-2 sm:py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-xs font-semibold flex items-center gap-1.5"
                            >
                              <X className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                              <span>Skip</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setHabitToEdit(habit);
                              setShowHabitPopup(false);
                              setShowAddModal(true);
                            }}
                            className="tap-target min-h-[44px] px-3 py-2 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold flex items-center gap-1.5 border border-slate-600"
                          >
                            <span>Edit</span>
                          </button>
                        </div>
                      </div>
                </div>
                  );
                })
                              )}
                            </div>
                                </div>
                            </div>
        )}


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

        {/* Calendar Event Modal */}
        <CalendarEventModal
          isOpen={showEventModal}
          onClose={() => {
            setShowEventModal(false);
            setEventToEdit(null);
            invalidateCache(CACHE_TYPES.CALENDAR_EVENTS);
            loadData();
          }}
          selectedDate={selectedDate}
          defaultType={eventModalType}
          event={eventToEdit}
        />
          </div>
      <Navigation />
    </div>
  );
}
