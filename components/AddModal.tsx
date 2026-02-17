"use client";

import { useState, useEffect } from "react";
import { X, Lightbulb, Target, FileText } from "lucide-react";
import { createIdea } from "@/app/actions/ideas";
import { createHabit } from "@/app/actions/habits";
import { createOrUpdateDailyLog } from "@/app/actions/dailyLog";
import { getTopics } from "@/app/actions/topics";
import { getHabits } from "@/app/actions/habits";
import { getUserProfile } from "@/app/actions/profile";
import { useRouter } from "next/navigation";

interface AddModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "idea" | "habit" | "note";
}

export default function AddModal({ isOpen, onClose, defaultTab = "idea" }: AddModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"idea" | "habit" | "note">(defaultTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [topics, setTopics] = useState<any[]>([]);
  const [habits, setHabits] = useState<any[]>([]);
  const [selectedHabitId, setSelectedHabitId] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [timeAllocation, setTimeAllocation] = useState<any>(null);
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [timelineType, setTimelineType] = useState<"preset" | "custom">("preset");
  const [customMonths, setCustomMonths] = useState<number>(0);
  const [customDays, setCustomDays] = useState<number>(0);
  const [timeValidationError, setTimeValidationError] = useState<string>("");

  useEffect(() => {
    setActiveTab(defaultTab);
    if (isOpen) {
      loadData();
    } else {
      // Reset form state when modal closes
      setSelectedHabitId("");
      setSelectedCategory("");
    }
  }, [defaultTab, isOpen]);

  async function loadData() {
    const [topicsResult, habitsResult, profileResult] = await Promise.all([
      getTopics(),
      getHabits(),
      getUserProfile(),
    ]);
    if (topicsResult.success) {
      setTopics(topicsResult.topics);
    }
    if (habitsResult.success) {
      setHabits(habitsResult.habits);
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

  const TIME_LIMITS = {
    personal: { min: 75, max: 150 }, // 1h15min - 2h30min
    work: { min: 120, max: 240 }, // 2h - 4h (using workBlock limits)
    workBlock: { min: 120, max: 240 }, // 2h - 4h
    productive: { min: 105, max: 210 }, // 1h45min - 3h30min
    familyTime: { min: 60, max: 120 }, // 1h - 2h
    journal: { min: 30, max: 60 }, // 30min - 1h
  };

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

  // Handle category change - auto-fill times
  function handleCategoryChange(category: string) {
    setSelectedCategory(category);
    setTimeValidationError("");
    
    if (category && timeAllocation) {
      const timeKey = categoryToTimeKey[category];
      console.log("[AddModal] Category selected:", category, "Mapping to:", timeKey);
      console.log("[AddModal] Available time allocation keys:", Object.keys(timeAllocation));
      
      if (timeKey && timeAllocation[timeKey]) {
        const timeSlot = timeAllocation[timeKey];
        console.log("[AddModal] Time slot found:", timeSlot);
        
        if (timeSlot.startTime && timeSlot.endTime) {
          const newStart = timeSlot.startTime;
          const newEnd = timeSlot.endTime;
          console.log("[AddModal] Auto-filling times:", newStart, "-", newEnd);
          setStartTime(newStart);
          setEndTime(newEnd);
          // Validate after setting times
          setTimeout(() => {
            validateTimeSlot(newStart, newEnd, category);
          }, 100);
        } else {
          console.warn("[AddModal] Time slot missing startTime or endTime:", timeSlot);
          setStartTime("");
          setEndTime("");
        }
      } else {
        console.warn("[AddModal] No time allocation found for key:", timeKey, "Available:", Object.keys(timeAllocation));
        setStartTime("");
        setEndTime("");
      }
    } else {
      console.warn("[AddModal] No category or timeAllocation:", { category, hasTimeAllocation: !!timeAllocation });
      setStartTime("");
      setEndTime("");
    }
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
  function validateTimeSlot(checkStartTime?: string, checkEndTime?: string, checkCategory?: string) {
    const checkStart = checkStartTime ?? startTime;
    const checkEnd = checkEndTime ?? endTime;
    const checkCat = checkCategory ?? selectedCategory;
    
    if (!checkCat || !checkStart || !checkEnd) {
      setTimeValidationError("");
      return true;
    }

    // FIRST: Check if habit time slot is within category's allocated time range
    // This is the most important validation - the time must be within the profile range
    if (timeAllocation) {
      const timeAllocationKey = mapCategoryToTimeAllocation(checkCat);
      if (timeAllocationKey && timeAllocation[timeAllocationKey]) {
        const timeCategory = timeAllocation[timeAllocationKey];
        if (timeCategory.startTime && timeCategory.endTime) {
          if (!isTimeRangeWithin(checkStart, checkEnd, timeCategory.startTime, timeCategory.endTime)) {
            setTimeValidationError(
              `${getCategoryDisplayName(checkCat)} habit time (${formatTimeForDisplay(checkStart)} - ${formatTimeForDisplay(checkEnd)}) is outside the allocated ${getCategoryDisplayName(checkCat)} Time range (${formatTimeForDisplay(timeCategory.startTime)} - ${formatTimeForDisplay(timeCategory.endTime)}) in your profile. Please choose a time within this range.`
            );
            return false;
          }
        }
      }
    }

    // SECOND: Check individual habit min/max duration limits
    const duration = calculateDuration(checkStart, checkEnd);
    const limits = TIME_LIMITS[checkCat as keyof typeof TIME_LIMITS];
    
    if (limits) {
      if (duration < limits.min) {
        const minHours = Math.floor(limits.min / 60);
        const minMins = limits.min % 60;
        setTimeValidationError(`Duration is less than minimum required time of ${minHours}h ${minMins}min`);
        return false;
      }

      if (duration > limits.max) {
        const maxHours = Math.floor(limits.max / 60);
        const maxMins = limits.max % 60;
        setTimeValidationError(`Duration exceeds maximum allowed time of ${maxHours}h ${maxMins}min`);
        return false;
      }
    }

    // Check for overlaps with existing habits in the same category
    const overlappingHabit = habits.find((habit: any) => {
      if (!habit.startTime || !habit.endTime || !habit.category) return false;
      // Check if same category or related categories
      const habitCategory = habit.category;
      const isSameCategory = habitCategory === checkCat || 
        (checkCat === "work" && habitCategory === "workBlock") ||
        (checkCat === "workBlock" && habitCategory === "work");
      if (!isSameCategory) return false;
      return timeRangesOverlap(checkStart, checkEnd, habit.startTime, habit.endTime);
    });

    if (overlappingHabit) {
      setTimeValidationError(`Time slot overlaps with existing habit: ${overlappingHabit.name}`);
      return false;
    }

    // Check total category time against profile allocation
    if (timeAllocation) {
      const timeAllocationKey = mapCategoryToTimeAllocation(checkCat);
      if (timeAllocationKey && timeAllocation[timeAllocationKey]) {
        const timeCategory = timeAllocation[timeAllocationKey];
        if (timeCategory.totalHours) {
          // Get all existing habits in the same category
          const existingHabitsInCategory = habits.filter((habit: any) => {
            if (!habit.startTime || !habit.endTime || !habit.category) return false;
            const habitCategory = habit.category;
            return habitCategory === checkCat || 
              (checkCat === "work" && habitCategory === "workBlock") ||
              (checkCat === "workBlock" && habitCategory === "work");
          });

          // Calculate total duration of existing habits
          let totalExistingMinutes = 0;
          existingHabitsInCategory.forEach((habit: any) => {
            if (habit.startTime && habit.endTime) {
              totalExistingMinutes += calculateDuration(habit.startTime, habit.endTime);
            }
          });

          // Add new habit duration
          const totalMinutes = totalExistingMinutes + duration;
          const allocatedMinutes = timeCategory.totalHours * 60;

          if (totalMinutes > allocatedMinutes) {
            const totalHours = Math.floor(totalMinutes / 60);
            const totalMins = totalMinutes % 60;
            const allocatedHours = Math.floor(allocatedMinutes / 60);
            const allocatedMins = allocatedMinutes % 60;
            
            setTimeValidationError(
              `Total ${getCategoryDisplayName(checkCat)} habit time (${totalHours}h ${totalMins}min) exceeds allocated ${getCategoryDisplayName(checkCat)} Time (${allocatedHours}h ${allocatedMins}min) in your profile. Please reduce the duration or adjust your profile allocation.`
            );
            return false;
          }
        }
      }
    }

    setTimeValidationError("");
    return true;
  }

  // Handle time change
  function handleTimeChange(type: "start" | "end", value: string) {
    const newStartTime = type === "start" ? value : startTime;
    const newEndTime = type === "end" ? value : endTime;
    
    if (type === "start") {
      setStartTime(value);
    } else {
      setEndTime(value);
    }
    
    // Validate after a short delay to avoid too many validations
    setTimeout(() => {
      if (newStartTime && newEndTime && selectedCategory) {
        validateTimeSlot(newStartTime, newEndTime, selectedCategory);
      } else {
        setTimeValidationError("");
      }
    }, 300);
  }

  if (!isOpen) return null;

  async function handleIdeaSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await createIdea(formData);

    if (result.success) {
      setSelectedHabitId("");
      onClose();
      router.refresh();
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
    if (startTime && endTime && selectedCategory) {
      if (!validateTimeSlot(startTime, endTime, selectedCategory)) {
        setError(timeValidationError);
        setLoading(false);
        return;
      }
    }

    const formData = new FormData(e.currentTarget);
    
    // Add start and end times if provided
    if (startTime) formData.set("startTime", startTime);
    if (endTime) formData.set("endTime", endTime);

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

    const result = await createHabit(formData);

    if (result.success) {
      setSelectedCategory("");
      setStartTime("");
      setEndTime("");
      setTimelineType("preset");
      setCustomMonths(0);
      setCustomDays(0);
      onClose();
      router.refresh();
    } else {
      setError(result.error || "Failed to create habit");
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
      onClose();
      router.refresh();
    } else {
      setError(result.error || "Failed to save note");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in md:backdrop-blur-none">
      <div className="relative w-full h-full md:h-auto md:max-w-2xl bg-slate-50 dark:bg-slate-900 rounded-3xl md:rounded-3xl shadow-premium-xl border border-slate-200/50 dark:border-slate-800/50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200/50 dark:border-slate-800/50">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Add New</h2>
          <button
            onClick={onClose}
            className="tap-target p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200/50 dark:border-slate-800/50">
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
                className={`flex-1 flex items-center justify-center gap-2 py-4 px-4 font-semibold transition-all ${
                  activeTab === tab.id
                    ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Idea Form */}
          {activeTab === "idea" && (
            <form onSubmit={handleIdeaSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Topic
                </label>
                <select
                  name="habitId"
                  value={selectedHabitId}
                  onChange={(e) => {
                    setSelectedHabitId(e.target.value);
                  }}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100"
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
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Sub Topic
                </label>
                <input
                  type="text"
                  name="subTopic"
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100"
                  placeholder="Enter sub topic..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={4}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100 resize-none"
                  placeholder="Add a description..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Priority
                </label>
                <select
                  name="priority"
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100"
                >
                  <option value="normal">Normal</option>
                  <option value="important">Important</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Create Idea"}
              </button>
            </form>
          )}

          {/* Habit Form */}
          {activeTab === "habit" && (
            <form onSubmit={handleHabitSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Routine Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100"
                  placeholder="e.g., Morning Exercise"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Category *
                </label>
                <select
                  name="category"
                  id="category"
                  required
                  value={selectedCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100"
                >
                  <option value="">Select a category</option>
                  <option value="personal">Personal Work</option>
                  <option value="workBlock">Work Block</option>
                  <option value="productive">Productive</option>
                  <option value="familyTime">Family Time</option>
                  <option value="journal">Journal</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    From (Start Time) {selectedCategory && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="time"
                    name="startTime"
                    value={startTime}
                    onChange={(e) => handleTimeChange("start", e.target.value)}
                    required={!!selectedCategory}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    To (End Time) {selectedCategory && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="time"
                    name="endTime"
                    value={endTime}
                    onChange={(e) => handleTimeChange("end", e.target.value)}
                    required={!!selectedCategory}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              {startTime && endTime && (
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Duration: {Math.floor(calculateDuration(startTime, endTime) / 60)}h {calculateDuration(startTime, endTime) % 60}min
                </div>
              )}
              {timeValidationError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-600 dark:text-red-400">
                  {timeValidationError}
                </div>
              )}
              {selectedCategory && timeAllocation && (() => {
                const timeKey = categoryToTimeKey[selectedCategory];
                if (timeKey && timeAllocation[timeKey] && timeAllocation[timeKey].startTime && timeAllocation[timeKey].endTime) {
                  const timeSlot = timeAllocation[timeKey];
                  return (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-sm text-blue-800 dark:text-blue-300">
                      <p className="font-semibold mb-1">ℹ️ Allowed Time Range:</p>
                      <p>
                        Your {getCategoryDisplayName(selectedCategory)} Time is set to{" "}
                        <span className="font-semibold">
                          {formatTimeForDisplay(timeSlot.startTime)} - {formatTimeForDisplay(timeSlot.endTime)}
                        </span>
                        . You can choose any time within this range.
                      </p>
                    </div>
                  );
                }
                return null;
              })()}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Timeline (Duration of Habit) *
                </label>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTimelineType("preset")}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
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
                      className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
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
                      className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100"
                    >
                      <option value="">Select timeline</option>
                      <option value="30">1 Month</option>
                      <option value="90">3 Months</option>
                      <option value="180">6 Months</option>
                      <option value="365">1 Year</option>
                    </select>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Months
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={customMonths || ""}
                          onChange={(e) => setCustomMonths(parseInt(e.target.value) || 0)}
                          className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100"
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
                          className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}
                  {timelineType === "custom" && (customMonths > 0 || customDays > 0) && (
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Total: {customMonths} Month{customMonths !== 1 ? "s" : ""} {customDays} Day{customDays !== 1 ? "s" : ""} ({customMonths * 30 + customDays} days)
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  A day-wise schedule will be created for the selected timeline
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Priority
                  </label>
                  <select
                    name="priority"
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100"
                  >
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Frequency
                  </label>
                  <select
                    name="frequency"
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Create Habit"}
              </button>
            </form>
          )}

          {/* Note Form */}
          {activeTab === "note" && (
            <form onSubmit={handleNoteSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Daily Note
                </label>
                <textarea
                  name="note"
                  rows={6}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-slate-100 resize-none"
                  placeholder="Write your daily note..."
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
