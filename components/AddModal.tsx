"use client";

import { useState, useEffect } from "react";
import { X, Lightbulb, Target, FileText } from "lucide-react";
import { createIdea, getIdeas } from "@/app/actions/ideas";
import { createHabit, updateHabit } from "@/app/actions/habits";
import { createOrUpdateDailyLog } from "@/app/actions/dailyLog";
import { getTopics } from "@/app/actions/topics";
import { getHabits } from "@/app/actions/habits";
import { getUserProfile } from "@/app/actions/profile";
import { useRouter } from "next/navigation";
import { invalidateCache, CACHE_TYPES } from "@/lib/cache";

interface AddModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "idea" | "habit" | "note";
  onHabitCreated?: () => void;
  onIdeaCreated?: () => void;
  habitToEdit?: any | null;
  defaultCategory?: string;
  defaultDate?: Date;
}

export default function AddModal({ isOpen, onClose, defaultTab = "idea", onHabitCreated, onIdeaCreated, habitToEdit, defaultCategory, defaultDate }: AddModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"idea" | "habit" | "note">(defaultTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [topics, setTopics] = useState<any[]>([]);
  const [habits, setHabits] = useState<any[]>([]);
  const [ideas, setIdeas] = useState<any[]>([]);
  const [selectedHabitId, setSelectedHabitId] = useState<string>("");
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [timeAllocation, setTimeAllocation] = useState<any>(null);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [timelineType, setTimelineType] = useState<"preset" | "custom">("preset");
  const [customMonths, setCustomMonths] = useState<number>(0);
  const [customDays, setCustomDays] = useState<number>(0);
  const [timeValidationError, setTimeValidationError] = useState<string>("");
  const [priority, setPriority] = useState<string>("low");
  const [frequency, setFrequency] = useState<string>("daily");
  const [dayOfWeek, setDayOfWeek] = useState<number>(1); // Monday by default
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [month, setMonth] = useState<number>(0); // January by default

  useEffect(() => {
    setActiveTab(defaultTab);
    if (isOpen) {
      loadData();
      // Reset loading and error states when modal opens
      setLoading(false);
      setError("");
      
      // Pre-fill form if editing a habit
      if (habitToEdit) {
        setSelectedCategory(habitToEdit.category || "");
        setStartTime(habitToEdit.startTime || "");
        setEndTime(habitToEdit.endTime || "");
        setPriority(habitToEdit.priority || "low");
        setFrequency(habitToEdit.frequency || "daily");
        setDayOfWeek(habitToEdit.dayOfWeek !== undefined ? habitToEdit.dayOfWeek : 1);
        setDayOfMonth(habitToEdit.dayOfMonth !== undefined ? habitToEdit.dayOfMonth : 1);
        setMonth(habitToEdit.month !== undefined ? habitToEdit.month : 0);
        
        // Handle timeline
        if (habitToEdit.timeline) {
          const days = habitToEdit.timeline;
          if (days === 30 || days === 90 || days === 180 || days === 365) {
            setTimelineType("preset");
            setCustomMonths(0);
            setCustomDays(0);
          } else {
            setTimelineType("custom");
            setCustomMonths(Math.floor(days / 30));
            setCustomDays(days % 30);
          }
        } else {
          setTimelineType("preset");
          setCustomMonths(0);
          setCustomDays(0);
        }
      } else if (defaultCategory) {
        // Pre-fill category if provided
        setSelectedCategory(defaultCategory);
        setActiveTab("habit");
      }
    } else {
      // Reset form state when modal closes
      setSelectedHabitId("");
      setSelectedParentId("");
      setSelectedCategory("");
      setSelectedSlotIndex(null);
      setStartTime("");
      setEndTime("");
      setFrequency("daily");
      setDayOfWeek(1);
      setDayOfMonth(1);
      setMonth(0);
      setTimelineType("preset");
      setCustomMonths(0);
      setCustomDays(0);
      setLoading(false);
      setError("");
    }
  }, [defaultTab, isOpen, habitToEdit, defaultCategory]);

  async function loadData() {
    const [topicsResult, habitsResult, profileResult, ideasResult] = await Promise.all([
      getTopics(),
      getHabits(),
      getUserProfile(),
      getIdeas({}),
    ]);
    if (topicsResult.success) {
      setTopics(topicsResult.topics);
    }
    if (habitsResult.success) {
      setHabits(habitsResult.habits);
    }
    if (ideasResult.success) {
      setIdeas(ideasResult.ideas);
    }
    if (profileResult.success && profileResult.profile) {
      const timeCategories = profileResult.profile.timeCategories;
      console.log("[AddModal] Loaded time allocation:", timeCategories);
      setTimeAllocation(timeCategories);
    } else {
      console.warn("[AddModal] Failed to load profile or timeCategories:", profileResult);
    }
  }

  // Helper functions for time validation
  function timeToMinutes(time: string): number {
    if (!time) return 0;
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  function calculateDuration(startTime: string, endTime: string): number {
    if (!startTime || !endTime) return 0;
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    if (end < start) {
      return (24 * 60) - start + end;
    }
    return end - start;
  }

  function timeRangesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    if (!start1 || !end1 || !start2 || !end2) return false;
    const s1 = timeToMinutes(start1);
    const e1 = timeToMinutes(end1);
    const s2 = timeToMinutes(start2);
    const e2 = timeToMinutes(end2);
    
    const wraps1 = e1 < s1;
    const wraps2 = e2 < s2;
    
    if (wraps1 && wraps2) return true;
    if (wraps1) return (s2 >= s1 && s2 < 24 * 60) || (e2 > 0 && e2 <= e1) || (s2 < e1);
    if (wraps2) return (s1 >= s2 && s1 < 24 * 60) || (e1 > 0 && e1 <= e2) || (s1 < e2);
    return !(e1 <= s2 || e2 <= s1);
  }

  // Check if a time range is completely within another time range
  function isTimeRangeWithin(
    innerStart: string,
    innerEnd: string,
    outerStart: string,
    outerEnd: string
  ): boolean {
    if (!innerStart || !innerEnd || !outerStart || !outerEnd) return false;

    const innerStartMin = timeToMinutes(innerStart);
    const innerEndMin = timeToMinutes(innerEnd);
    const outerStartMin = timeToMinutes(outerStart);
    const outerEndMin = timeToMinutes(outerEnd);

    // Handle overnight ranges for outer range
    const outerWraps = outerEndMin < outerStartMin;
    const innerWraps = innerEndMin < innerStartMin;

    if (outerWraps) {
      // Outer range wraps (e.g., 23:00 to 06:00)
      // Inner range must be either:
      // 1. Completely within the first part (outerStart to 24:00)
      // 2. Completely within the second part (00:00 to outerEnd)
      // 3. Or wrap itself but still be within
      if (innerWraps) {
        // Both wrap - inner must be within outer
        return innerStartMin >= outerStartMin && innerEndMin <= outerEndMin;
      } else {
        // Inner doesn't wrap, outer does
        // Inner must be in first part OR second part
        return (innerStartMin >= outerStartMin && innerEndMin <= 24 * 60) ||
               (innerStartMin >= 0 && innerEndMin <= outerEndMin);
      }
    } else {
      // Outer range doesn't wrap (normal case)
      if (innerWraps) {
        // Inner wraps but outer doesn't - not possible to be within
        return false;
      } else {
        // Neither wraps - simple check
        return innerStartMin >= outerStartMin && innerEndMin <= outerEndMin;
      }
    }
  }

  // TIME_LIMITS removed - duration validation is handled in profile setup
  // Only range check is needed here (overlap validation removed - multiple habits allowed in same block)

  // Format time for display (HH:MM to 12-hour format)
  function formatTimeForDisplay(time: string): string {
    if (!time) return "";
    const [hours, minutes] = time.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  }

  // Category to time allocation mapping
  const categoryToTimeKey: { [key: string]: string } = {
    personal: "personalWork",
    work: "workBlock", // Map "work" to "workBlock" time allocation
    workBlock: "workBlock",
    productive: "productive",
    familyTime: "familyTime",
    journal: "journaling", // Map "journal" to "journaling" time allocation
  };

  // Get all ranges for a given category from time allocation (supports legacy single range)
  function getCategoryRanges(category: string | null, allocation?: any) {
    const source = allocation || timeAllocation;
    if (!category || !source) return [];
    const timeKey = categoryToTimeKey[category];
    if (!timeKey || !source[timeKey]) return [];
    const cat = source[timeKey];
    if (Array.isArray(cat.ranges) && cat.ranges.length > 0) return cat.ranges;
    if (cat.startTime && cat.endTime) {
      return [{ startTime: cat.startTime, endTime: cat.endTime }];
    }
    return [];
  }

  // Apply category time from allocation without changing selectedCategory
  function applyCategoryTime(category: string, allocation?: any) {
    const ranges = getCategoryRanges(category, allocation);
    if (!ranges.length) {
      setStartTime("");
      setEndTime("");
      return;
    }

    // Default to the first slot for this category
    const index = 0;
    const slot = ranges[index];
    setSelectedSlotIndex(index);
    setStartTime(slot.startTime || "");
    setEndTime(slot.endTime || "");

    // Validate the auto-selected slot
    if (slot.startTime && slot.endTime && category) {
      validateTimeSlot(slot.startTime, slot.endTime, category);
    }
  }

  // Handle category change - auto-fill times with allocated range
  function handleCategoryChange(category: string) {
    setSelectedCategory(category);
    setSelectedSlotIndex(null);
    setTimeValidationError("");

    if (!category) {
      setStartTime("");
      setEndTime("");
      return;
    }

    applyCategoryTime(category);
  }

  // When time allocation loads/changes, re-apply times for currently selected category
  useEffect(() => {
    if (selectedCategory && timeAllocation) {
      applyCategoryTime(selectedCategory, timeAllocation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeAllocation]);

  // Helper to convert minutes to time string
  function minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  }

  // Get allocated time range for selected category
  function getAllocatedTimeRange() {
    if (!selectedCategory) return null;
    const ranges = getCategoryRanges(selectedCategory);
    if (!ranges.length) return null;
    const idx = selectedSlotIndex != null ? selectedSlotIndex : 0;
    const slot = ranges[idx];
    if (!slot || !slot.startTime || !slot.endTime) return null;
    return { start: slot.startTime, end: slot.endTime };
  }

  // Map habit category to profile time allocation category
  function mapCategoryToTimeAllocation(category: string): string | null {
    const mapping: { [key: string]: string } = {
      personal: "personalWork",
      work: "workBlock",
      workBlock: "workBlock",
      productive: "productive",
      familyTime: "familyTime",
      family: "familyTime",
      business: "workBlock",
      journal: "journaling",
    };
    return mapping[category] || null;
  }

  // Get category display name
  function getCategoryDisplayName(category: string): string {
    const names: { [key: string]: string } = {
      personal: "Personal Work",
      work: "Work",
      workBlock: "Work Block",
      productive: "Productive",
      familyTime: "Family Time",
      family: "Family Time",
      business: "Business",
      journal: "Journal",
    };
    return names[category] || category;
  }

  // Validate time slot
  // Only validates:
  // 1. Time is within the allocated range from profile setup
  // Overlap validation is REMOVED - multiple habits can exist in the same time block
  function validateTimeSlot(checkStartTime?: string, checkEndTime?: string, checkCategory?: string) {
    const checkStart = checkStartTime ?? startTime;
    const checkEnd = checkEndTime ?? endTime;
    const checkCat = checkCategory ?? selectedCategory;
    
    if (!checkCat || !checkStart || !checkEnd) {
      setTimeValidationError("");
      return true;
    }

    // Clear previous errors
    setTimeValidationError("");

    // Check if habit time slot is within category's allocated time range
    // This is CRITICAL - the time MUST be within ONE of the profile ranges
    if (timeAllocation) {
      const timeAllocationKey = mapCategoryToTimeAllocation(checkCat);
      if (timeAllocationKey && timeAllocation[timeAllocationKey]) {
        const timeCategory = timeAllocation[timeAllocationKey];
        const ranges = getCategoryRanges(checkCat, timeAllocation);
        
        if (ranges.length === 0) {
            setTimeValidationError(
            `❌ No time allocation found for ${getCategoryDisplayName(checkCat)}. Please set up time allocation in your profile first.`
            );
            return false;
          }

        // Check if the habit time is within ANY of the allocated ranges
        const isWithinAnyRange = ranges.some((range: any) => {
          if (!range.startTime || !range.endTime) return false;
          return isTimeRangeWithin(checkStart, checkEnd, range.startTime, range.endTime);
        });
        
        if (!isWithinAnyRange) {
          const rangesText = ranges.map((r: any) => 
            `${formatTimeForDisplay(r.startTime)} - ${formatTimeForDisplay(r.endTime)}`
          ).join(", ");
      setTimeValidationError(
            `❌ Time slot (${formatTimeForDisplay(checkStart)} - ${formatTimeForDisplay(checkEnd)}) is outside the allocated ${getCategoryDisplayName(checkCat)} Time range(s): ${rangesText}. Please choose a time within one of these ranges.`
      );
      return false;
        }
      }
    }

    // All validations passed
    // NOTE: Overlap validation removed - multiple habits can exist in the same time block
    return true;
  }

  if (!isOpen) return null;

  async function handleIdeaSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    if (selectedParentId) {
      formData.set("parentId", selectedParentId);
    }
    const result = await createIdea(formData);

    if (result.success) {
      // Invalidate cache after creating idea
      invalidateCache(CACHE_TYPES.IDEAS);
      invalidateCache(CACHE_TYPES.IDEAS_TREE);
      invalidateCache(CACHE_TYPES.TOPICS); // Topics might be created/updated
      
      setLoading(false);
      setSelectedHabitId("");
      setSelectedParentId("");
      setError("");
      // Reset form if available
      const form = e.currentTarget;
      if (form) {
        form.reset();
      }
      onClose();
      router.refresh();
      // Notify parent component to reload ideas
      if (onIdeaCreated) {
        onIdeaCreated();
      }
    } else {
      setError(result.error || "Failed to create idea");
      setLoading(false);
    }
  }

  async function handleHabitSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setTimeValidationError("");
    setLoading(true);

    // Validate time slot if times are provided
    // Only validates: time within allocated range (overlap validation removed)
    if (startTime && endTime && selectedCategory) {
      if (!validateTimeSlot(startTime, endTime, selectedCategory)) {
        // Don't set top error - timeValidationError is already displayed below the time fields
        setLoading(false);
        return;
      }
    }

    const formData = new FormData(e.currentTarget);
    
    // Add start and end times if provided
    if (startTime) formData.set("startTime", startTime);
    if (endTime) formData.set("endTime", endTime);

    // Add frequency-specific fields
    if (frequency === "weekly") {
      formData.set("dayOfWeek", dayOfWeek.toString());
    } else if (frequency === "monthly") {
      formData.set("dayOfMonth", dayOfMonth.toString());
    } else if (frequency === "yearly") {
      formData.set("month", month.toString());
      formData.set("dayOfMonth", dayOfMonth.toString());
    }

    // Handle timeline - convert custom duration to days
    let timelineDays = 0;
    if (timelineType === "custom") {
      timelineDays = customMonths * 30 + customDays;
      if (timelineDays > 0) {
        formData.set("timeline", timelineDays.toString());
      }
    } else {
      const timelineValue = formData.get("timeline");
      if (timelineValue) {
        formData.set("timeline", timelineValue.toString());
      }
    }

    let result;
    if (habitToEdit) {
      // Update existing habit
      result = await updateHabit(habitToEdit._id, formData);
    } else {
      // Create new habit
      result = await createHabit(formData);
    }

    if (result.success) {
      // Invalidate cache after creating/updating habit
      invalidateCache(CACHE_TYPES.HABITS);
      invalidateCache(CACHE_TYPES.CALENDAR_EVENTS); // Habits create calendar events
      invalidateCache(CACHE_TYPES.HABITS_FOR_DATE); // Habits for date cache
      
      setLoading(false);
      setError("");
      setSelectedCategory("");
      setStartTime("");
      setEndTime("");
      setTimelineType("preset");
      setCustomMonths(0);
      setCustomDays(0);
      setFrequency("daily");
      setDayOfWeek(1);
      setDayOfMonth(1);
      setMonth(0);
      // Reset form if available
      const form = e.currentTarget;
      if (form) {
        form.reset();
      }
      onClose();
      router.refresh();
      // Notify parent component to reload habits
      if (onHabitCreated) {
        onHabitCreated();
      }
    } else {
      setError(result.error || (habitToEdit ? "Failed to update habit" : "Failed to create habit"));
      setLoading(false);
    }
  }

  async function handleNoteSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await createOrUpdateDailyLog(formData);

    if (result.success) {
      setLoading(false);
      setError("");
      // Reset form if available
      const form = e.currentTarget;
      if (form) {
        form.reset();
      }
      onClose();
      router.refresh();
    } else {
      setError(result.error || "Failed to save note");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl lg:max-w-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-premium-xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden flex flex-col pb-safe">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 lg:p-7 border-b border-slate-200/60 dark:border-slate-800/60 flex-shrink-0 bg-gradient-to-r from-slate-50/50 to-white/50 dark:from-slate-900/50 dark:to-slate-800/50">
          <h2 className="text-heading-2 font-bold text-contrast-high">
            {habitToEdit ? "Edit Habit" : "Add New"}
          </h2>
          <button
            onClick={onClose}
            className="tap-target p-2 sm:p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
            aria-label="Close"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200/50 dark:border-slate-800/50 flex-shrink-0">
          {[
            { id: "idea" as const, label: "Idea", icon: Lightbulb },
            { id: "habit" as const, label: "Habit", icon: Target },
            { id: "note" as const, label: "Note", icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-3 sm:py-4 px-2 sm:px-4 text-sm sm:text-base font-semibold transition-all active:scale-95 ${
                  activeTab === tab.id
                    ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
          {error && (
            <div className="mb-4 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg sm:rounded-xl text-red-600 dark:text-red-400 text-xs sm:text-sm">
              {error}
            </div>
          )}

          {/* Idea Form */}
          {activeTab === "idea" && (
            <form onSubmit={handleIdeaSubmit} className="space-y-3 sm:space-y-4 pb-4">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 sm:mb-2">
                  Topic
                </label>
                <select
                  name="habitId"
                  value={selectedHabitId}
                  onChange={(e) => {
                    setSelectedHabitId(e.target.value);
                  }}
                  className="input-premium w-full text-contrast-high focus-visible-premium"
                  autoFocus
                >
                  <option value="">Select a topic (optional)</option>
                  {habits.filter((h: any) => h && h.name).map((habit) => (
                    <option key={habit._id} value={habit._id}>
                      {habit.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Select a habit routine name to use as the topic. A topic will be automatically created if it doesn't exist.
                </p>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 sm:mb-2">
                  Sub Topic
                </label>
                <input
                  type="text"
                  name="subTopic"
                  className="input-premium w-full text-contrast-high focus-visible-premium"
                  placeholder="Enter sub topic..."
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 sm:mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={4}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100 resize-none"
                  placeholder="Add a description..."
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 sm:mb-2">
                  Link to Parent Idea (Optional)
                </label>
                <select
                  name="parentId"
                  value={selectedParentId}
                  onChange={(e) => setSelectedParentId(e.target.value)}
                  className="input-premium w-full text-contrast-high focus-visible-premium"
                >
                  <option value="">No parent (root idea)</option>
                  {ideas
                    .filter((idea: any) => {
                      // Only show ideas that have less than 2 children
                      // We'll check this on the server side, but filter here for better UX
                      return idea.text;
                    })
                    .map((idea: any) => (
                      <option key={idea._id} value={idea._id}>
                        {idea.text?.substring(0, 50) || "Untitled Idea"}
                        {idea.text && idea.text.length > 50 ? "..." : ""}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Link this idea to an existing idea to create a tree structure. Each idea can have up to 2 child ideas.
                </p>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 sm:mb-2">
                  Priority
                </label>
                <select
                  name="priority"
                  className="input-premium w-full text-contrast-high focus-visible-premium"
                >
                  <option value="normal">Normal</option>
                  <option value="important">Important</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-premium w-full bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 text-white font-semibold hover:shadow-glow-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible-premium"
              >
                {loading ? "Creating..." : "Create Idea"}
              </button>
            </form>
          )}

          {/* Habit Form */}
          {activeTab === "habit" && (
            <form onSubmit={handleHabitSubmit} className="space-y-3 sm:space-y-4 pb-4">
              <div>
                <label className="block text-sm font-semibold text-contrast-high mb-2">
                  Routine Name *
                </label>
                  <input
                  type="text"
                  name="name"
                  required
                  defaultValue={habitToEdit?.name || ""}
                  className="input-premium w-full text-contrast-high placeholder:text-contrast-low focus-visible-premium"
                  placeholder="e.g., Morning Exercise"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 sm:mb-2">
                  Category *
                </label>
                <select
                  name="category"
                  id="category"
                  required
                  value={selectedCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="input-premium w-full text-contrast-high focus-visible-premium"
                >
                  <option value="">Select a category</option>
                  <option value="personal">Personal Work</option>
                  <option value="workBlock">Work Block</option>
                  <option value="productive">Productive</option>
                  <option value="familyTime">Family Time</option>
                  <option value="journal">Journal</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 sm:mb-2">
                    From (Start Time) {selectedCategory && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="time"
                    name="startTime"
                    value={startTime}
                    required={!!selectedCategory}
                    readOnly
                    className="input-premium w-full text-contrast-high focus-visible-premium bg-slate-50 dark:bg-slate-800"
                  />
                  {selectedCategory && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Auto-filled from category time block
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 sm:mb-2">
                    To (End Time) {selectedCategory && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="time"
                    name="endTime"
                    value={endTime}
                    required={!!selectedCategory}
                    readOnly
                    className="input-premium w-full text-contrast-high focus-visible-premium bg-slate-50 dark:bg-slate-800"
                  />
                  {selectedCategory && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Auto-filled from category time block
                    </p>
                  )}
                </div>
              </div>
              {/* Time slot selector when category has multiple slots */}
              {selectedCategory && timeAllocation && (() => {
                const ranges = getCategoryRanges(selectedCategory);
                if (ranges.length <= 1) return null;
                const currentIndex = selectedSlotIndex != null ? selectedSlotIndex : 0;
                return (
                  <div className="mb-2">
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 sm:mb-2">
                      Time Slot
                    </label>
                    <select
                      value={currentIndex}
                      onChange={(e) => {
                        const idx = Number(e.target.value);
                        setSelectedSlotIndex(idx);
                        const slot = ranges[idx];
                        if (slot) {
                          setStartTime(slot.startTime || "");
                          setEndTime(slot.endTime || "");
                          if (slot.startTime && slot.endTime && selectedCategory) {
                            validateTimeSlot(slot.startTime, slot.endTime, selectedCategory);
                          }
                        }
                      }}
                      className="input-premium w-full text-contrast-high focus-visible-premium"
                    >
                      {ranges.map((slot: any, idx: number) => (
                        <option key={idx} value={idx}>
                          {`Slot ${idx + 1}: ${formatTimeForDisplay(slot.startTime)} - ${formatTimeForDisplay(slot.endTime)}`}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Choose which predefined time slot this habit should use.
                    </p>
                  </div>
                );
              })()}
              {startTime && endTime && (
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Duration: {Math.floor(calculateDuration(startTime, endTime) / 60)}h {calculateDuration(startTime, endTime) % 60}min
                </div>
              )}
              {timeValidationError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-xs sm:text-sm text-red-600 dark:text-red-400">
                  {timeValidationError}
                </div>
              )}
              {selectedCategory && timeAllocation && (() => {
                const timeKey = categoryToTimeKey[selectedCategory];
                const timeCategory = timeKey ? timeAllocation[timeKey] : null;
                const ranges = timeCategory?.ranges || (timeCategory?.startTime && timeCategory?.endTime
                  ? [{ startTime: timeCategory.startTime, endTime: timeCategory.endTime }]
                  : []);

                if (!ranges.length) return null;

                const slotIdx = selectedSlotIndex != null ? selectedSlotIndex : 0;
                const timeSlot = ranges[slotIdx];

                if (timeSlot && timeSlot.startTime && timeSlot.endTime) {
                  // Get existing habits in this category
                  const existingHabitsInCategory = habits.filter((habit: any) => {
                    if (!habit.category) return false;
                    const habitCategory = habit.category;
                    return habitCategory === selectedCategory || 
                      (selectedCategory === "work" && habitCategory === "workBlock") ||
                      (selectedCategory === "workBlock" && habitCategory === "work");
                  });
                  
                  return (
                    <div className="space-y-2 sm:space-y-3">
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-xs sm:text-sm text-blue-800 dark:text-blue-300">
                        <p className="font-semibold mb-1">ℹ️ Category Time Block:</p>
                        <p className="break-words">
                          Your {getCategoryDisplayName(selectedCategory)} Time is set to{" "}
                          <span className="font-semibold">
                            {formatTimeForDisplay(timeSlot.startTime)} - {formatTimeForDisplay(timeSlot.endTime)}
                          </span>
                          . This time range is automatically applied to your habit.
                        </p>
                        <p className="mt-2 text-xs">
                          💡 Multiple habits can be created within this time block. You just need to complete them within this time range.
                        </p>
                      </div>
                      {existingHabitsInCategory.length > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-xs sm:text-sm">
                          <p className="font-semibold mb-2 text-slate-700 dark:text-slate-300">📋 Existing Habits in {getCategoryDisplayName(selectedCategory)} (for reference):</p>
                          <div className="space-y-1">
                            {existingHabitsInCategory.map((habit: any) => (
                              <div key={habit._id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-slate-600 dark:text-slate-400">
                                <span className="font-medium break-words">{habit.name}</span>
                                {habit.startTime && habit.endTime && (
                                  <span className="whitespace-nowrap">
                                    {formatTimeForDisplay(habit.startTime)} - {formatTimeForDisplay(habit.endTime)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })()}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 sm:mb-2">
                  Timeline (Duration of Habit) *
                </label>
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTimelineType("preset")}
                      className={`flex-1 px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all active:scale-95 ${
                        timelineType === "preset"
                          ? "bg-indigo-500 text-white"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      Preset
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimelineType("custom")}
                      className={`flex-1 px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all active:scale-95 ${
                        timelineType === "custom"
                          ? "bg-indigo-500 text-white"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                  {timelineType === "preset" ? (
                    <select
                      name="timeline"
                      required={timelineType === "preset"}
                      defaultValue={habitToEdit?.timeline && [30, 90, 180, 365].includes(habitToEdit.timeline) ? habitToEdit.timeline.toString() : ""}
                      className="input-premium w-full text-contrast-high focus-visible-premium"
                    >
                      <option value="">Select timeline</option>
                      <option value="30">1 Month</option>
                      <option value="90">3 Months</option>
                      <option value="180">6 Months</option>
                      <option value="365">1 Year</option>
                    </select>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Months
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={customMonths || ""}
                          onChange={(e) => setCustomMonths(parseInt(e.target.value) || 0)}
                          className="input-premium w-full text-contrast-high focus-visible-premium"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Days
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={customDays || ""}
                          onChange={(e) => setCustomDays(parseInt(e.target.value) || 0)}
                          className="input-premium w-full text-contrast-high focus-visible-premium"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}
                  {timelineType === "custom" && (customMonths > 0 || customDays > 0) && (
                    <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                      Total: {customMonths} Month{customMonths !== 1 ? "s" : ""} {customDays} Day{customDays !== 1 ? "s" : ""} ({customMonths * 30 + customDays} days)
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 sm:mt-2">
                  A day-wise schedule will be created for the selected timeline
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 sm:mb-2">
                    Priority
                  </label>
                  <select
                    name="priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="input-premium w-full text-contrast-high focus-visible-premium"
                  >
                    <option value="low">Low Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {priority === "high" ? (
                      <>High Priority: If not completed, will be added to Pending Tasks</>
                    ) : (
                      <>Low Priority: Can be skipped and edited later from Calendar</>
                    )}
                  </p>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 sm:mb-2">
                    Frequency
                  </label>
                  <select
                    name="frequency"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="input-premium w-full text-contrast-high focus-visible-premium"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
              
              {/* Frequency-specific options */}
              {frequency === "weekly" && (
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 sm:mb-2">
                    Day of Week
                  </label>
                  <select
                    name="dayOfWeek"
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                    className="input-premium w-full text-contrast-high focus-visible-premium"
                  >
                    <option value="0">Sunday</option>
                    <option value="1">Monday</option>
                    <option value="2">Tuesday</option>
                    <option value="3">Wednesday</option>
                    <option value="4">Thursday</option>
                    <option value="5">Friday</option>
                    <option value="6">Saturday</option>
                  </select>
                </div>
              )}
              
              {frequency === "monthly" && (
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 sm:mb-2">
                    Day of Month
                  </label>
                  <select
                    name="dayOfMonth"
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
                    className="input-premium w-full text-contrast-high focus-visible-premium"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {frequency === "yearly" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 sm:mb-2">
                      Month
                    </label>
                    <select
                      name="month"
                      value={month}
                      onChange={(e) => setMonth(parseInt(e.target.value))}
                      className="input-premium w-full text-contrast-high focus-visible-premium"
                    >
                      <option value="0">January</option>
                      <option value="1">February</option>
                      <option value="2">March</option>
                      <option value="3">April</option>
                      <option value="4">May</option>
                      <option value="5">June</option>
                      <option value="6">July</option>
                      <option value="7">August</option>
                      <option value="8">September</option>
                      <option value="9">October</option>
                      <option value="10">November</option>
                      <option value="11">December</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 sm:mb-2">
                      Day of Month
                    </label>
                    <select
                      name="dayOfMonth"
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
                      className="input-premium w-full text-contrast-high focus-visible-premium"
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="btn-premium w-full bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 text-white font-semibold hover:shadow-glow-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible-premium"
              >
                {loading ? (habitToEdit ? "Updating..." : "Creating...") : (habitToEdit ? "Update Habit" : "Create Habit")}
              </button>
            </form>
          )}

          {/* Note Form */}
          {activeTab === "note" && (
            <form onSubmit={handleNoteSubmit} className="space-y-3 sm:space-y-4 pb-4">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 sm:mb-2">
                  Daily Note
                </label>
                <textarea
                  name="note"
                  rows={6}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100 resize-none"
                  placeholder="Write your daily note..."
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-premium w-full bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 text-white font-semibold hover:shadow-glow-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible-premium"
              >
                {loading ? "Saving..." : "Save Note"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
