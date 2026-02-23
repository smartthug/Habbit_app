"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getHabits, deleteHabit, logHabit, getHabitStreak } from "@/app/actions/habits";
import { getIdeas } from "@/app/actions/ideas";
import { Check, X, Trash2, Flame, Lightbulb, Target, Clock } from "lucide-react";
import Navigation from "@/components/Navigation";
import AddModal from "@/components/AddModal";
import IdeaPromptModal from "@/components/IdeaPromptModal";

export default function HabitsPage() {
  const router = useRouter();
  const [habits, setHabits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [ideaCounts, setIdeaCounts] = useState<Record<string, number>>({});
  const [showIdeaPrompt, setShowIdeaPrompt] = useState(false);
  const [promptHabit, setPromptHabit] = useState<{ id: string; name: string } | null>(null);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    loadHabits();
  }, []);

  // Update current time every minute to refresh habit status
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  async function loadHabits() {
    setLoading(true);
    const result = await getHabits();
    if (result.success) {
      // Set habits immediately to show UI faster
      setHabits(result.habits);
      setLoading(false);
      
      // Load streaks and idea counts in background (non-blocking)
      loadAdditionalData(result.habits);
    } else {
      setLoading(false);
    }
  }

  // Load streaks and idea counts in background without blocking UI
  async function loadAdditionalData(habitsList: any[]) {
    // Load streaks and idea counts in parallel
    const [streakResults, ideaResults] = await Promise.all([
      // Load all streaks in parallel
      Promise.all(
        habitsList.map(async (habit: any) => {
          const streakResult = await getHabitStreak(habit._id);
          return { id: habit._id, streak: streakResult.success ? streakResult.streak : 0 };
        })
      ),
      // Load all idea counts in parallel
      Promise.all(
        habitsList.map(async (habit: any) => {
          const ideasResult = await getIdeas({ habitId: habit._id });
          return {
            id: habit._id,
            count: ideasResult.success ? ideasResult.ideas.length : 0,
          };
        })
      ),
    ]);

    // Update streaks
    const streakMap: Record<string, number> = {};
    streakResults.forEach(({ id, streak }) => {
      streakMap[id] = streak;
    });
    setStreaks(streakMap);

    // Update idea counts
    const ideaCountMap: Record<string, number> = {};
    ideaResults.forEach(({ id, count }) => {
      ideaCountMap[id] = count;
    });
    setIdeaCounts(ideaCountMap);
  }

  const handleLog = useCallback(async (habitId: string, status: "done" | "skipped") => {
    const result = await logHabit(habitId, status);
    if (result.success) {
      // If habit is marked as idea generating and was completed, prompt for idea
      if (status === "done") {
        const habit = habits.find((h) => h._id === habitId);
        if (habit?.ideaGenerating) {
          setPromptHabit({ id: habitId, name: habit.name });
          setShowIdeaPrompt(true);
        }
      }
      // Only reload habits, not the full data (streaks/ideas will update on next load)
      const habitsResult = await getHabits();
      if (habitsResult.success) {
        setHabits(habitsResult.habits);
      }
    }
  }, [habits]);

  const handleDelete = useCallback(async (habitId: string) => {
    if (confirm("Are you sure you want to delete this habit?")) {
      const result = await deleteHabit(habitId);
      if (result.success) {
        // Remove from local state immediately for instant feedback
        setHabits(prev => prev.filter(h => h._id !== habitId));
        setStreaks(prev => {
          const next = { ...prev };
          delete next[habitId];
          return next;
        });
        setIdeaCounts(prev => {
          const next = { ...prev };
          delete next[habitId];
          return next;
        });
        // Reload in background to ensure consistency
        loadHabits();
      }
    }
  }, []);

  // Memoized helper functions for better performance
  const timeToMinutes = useCallback((time: string): number => {
    if (!time) return Infinity;
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }, []);

  const formatTimeForDisplay = useCallback((time: string): string => {
    if (!time) return "";
    const [hours, minutes] = time.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  }, []);

  const getCurrentTimeInMinutes = useCallback((): number => {
    return currentTime.getHours() * 60 + currentTime.getMinutes();
  }, [currentTime]);

  // Memoized habit status calculation
  const getHabitStatus = useCallback((habit: any): "current" | "upcoming" | "past" | "no-time" => {
    if (!habit.startTime || !habit.endTime) {
      return "no-time";
    }

    const currentMinutes = getCurrentTimeInMinutes();
    const startMinutes = timeToMinutes(habit.startTime);
    const endMinutes = timeToMinutes(habit.endTime);

    // Handle overnight time slots (e.g., 23:00 to 01:00)
    if (endMinutes < startMinutes) {
      if (currentMinutes >= startMinutes || currentMinutes < endMinutes) {
        return "current";
      } else {
        if (currentMinutes >= endMinutes && currentMinutes < startMinutes) {
          return "upcoming";
        } else {
          return "past";
        }
      }
    } else {
      // Normal time slot
      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        return "current";
      } else if (currentMinutes < startMinutes) {
        return "upcoming";
      } else {
        return "past";
      }
    }
  }, [getCurrentTimeInMinutes, timeToMinutes]);

  // Memoized sorted habits - only recalculate when habits or currentTime changes
  const sortedHabits = useMemo(() => {
    return [...habits].sort((a, b) => {
      const aHasTime = a.startTime && a.endTime;
      const bHasTime = b.startTime && b.endTime;

      if (aHasTime && !bHasTime) return -1;
      if (!aHasTime && bHasTime) return 1;
      
      if (aHasTime && bHasTime) {
        return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
      }
      
      return 0;
    });
  }, [habits, timeToMinutes]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 sm:pb-24 md:pb-6 md:pl-20 lg:pl-64 safe-bottom flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-200 dark:border-indigo-800 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading habits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 sm:pb-24 md:pb-6 md:pl-20 lg:pl-64 safe-bottom">
        <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 md:pt-8 pb-8 sm:pb-6 md:pb-8">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400 tracking-tight">
              Habits
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base mt-1 font-medium">Track your daily progress</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="tap-target w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg active:shadow-xl active:scale-95 transition-all duration-200 flex items-center justify-center touch-active no-select"
            aria-label="Add new habit"
          >
            <span className="text-2xl sm:text-3xl font-bold">+</span>
          </button>
        </div>

        {habits.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center">
              <Target className="w-10 h-10 text-indigo-500 dark:text-indigo-400" />
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-6 font-medium">No habits yet</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
            >
              Create your first habit
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 pb-8 sm:pb-6 md:pb-0">
            {sortedHabits.map((habit) => {
              const habitStatus = getHabitStatus(habit);
              const isCurrent = habitStatus === "current";
              const isUpcoming = habitStatus === "upcoming";
              const isPast = habitStatus === "past";
              
              return (
              <div
                key={habit._id}
                className={`group relative overflow-hidden backdrop-blur-xl rounded-3xl p-6 md:p-7 shadow-premium-lg border transition-all duration-300 h-full flex flex-col ${
                  isCurrent
                    ? "bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 border-indigo-300 dark:border-indigo-600 ring-2 ring-indigo-400 dark:ring-indigo-500 shadow-indigo-200 dark:shadow-indigo-900/50"
                    : isUpcoming
                    ? "bg-slate-50 dark:bg-slate-800 border-slate-200/50 dark:border-slate-700/50"
                    : isPast
                    ? "bg-slate-50 dark:bg-slate-800 border-slate-200/50 dark:border-slate-700/50 opacity-75"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-200/50 dark:border-slate-700/50"
                } hover:shadow-premium-xl hover:scale-[1.02]`}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-400/0 to-purple-400/0 dark:from-indigo-400/0 dark:to-purple-400/0 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500"></div>
                {isCurrent && (
                  <div className="absolute top-4 right-4 z-20">
                    <span className="px-3 py-1 bg-indigo-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">
                      NOW
                    </span>
                  </div>
                )}
                <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-extrabold text-xl md:text-2xl text-slate-900 dark:text-slate-100 mb-3 tracking-tight">
                      {habit.name}
                    </h3>
                    {habit.startTime && habit.endTime && (
                      <div className="flex items-center gap-1.5 mb-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                        <Clock className="w-4 h-4" />
                        <span>{formatTimeForDisplay(habit.startTime)} - {formatTimeForDisplay(habit.endTime)}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full font-medium capitalize">
                        {habit.category}
                      </span>
                      <span className="px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full font-medium capitalize">
                        {habit.frequency}
                      </span>
                      {streaks[habit._id] > 0 && (
                        <span className="flex items-center gap-1 px-2.5 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full font-medium">
                          <Flame className="w-3.5 h-3.5" />
                          {streaks[habit._id]} day{streaks[habit._id] !== 1 ? "s" : ""}
                        </span>
                      )}
                      {ideaCounts[habit._id] > 0 && (
                        <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full font-medium">
                          <Lightbulb className="w-3.5 h-3.5" />
                          {ideaCounts[habit._id]} idea{ideaCounts[habit._id] !== 1 ? "s" : ""}
                        </span>
                      )}
                      {habit.ideaGenerating && (
                        <span className="px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full text-xs font-medium">
                          💡 Idea Gen
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(habit._id)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ml-2"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex gap-3 mt-auto relative z-10">
                  <button
                    onClick={() => handleLog(habit._id, "done")}
                    className="tap-target flex-1 flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-green-500 via-emerald-600 to-teal-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 touch-active no-select min-h-[48px] hover:scale-[1.02]"
                  >
                    <Check className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="text-sm sm:text-base">Done</span>
                  </button>
                  <button
                    onClick={() => handleLog(habit._id, "skipped")}
                    className="tap-target flex-1 flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold active:scale-95 transition-all duration-200 touch-active no-select min-h-[48px] hover:scale-[1.02] shadow-md hover:shadow-lg"
                  >
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="text-sm sm:text-base">Skip</span>
                  </button>
                </div>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>

      <AddModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        defaultTab="habit"
        onHabitCreated={loadHabits}
      />
      {promptHabit && (
        <IdeaPromptModal
          isOpen={showIdeaPrompt}
          onClose={() => {
            setShowIdeaPrompt(false);
            setPromptHabit(null);
          }}
          habitId={promptHabit.id}
          habitName={promptHabit.name}
        />
      )}
      <Navigation />
    </div>
  );
}
