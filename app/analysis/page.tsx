"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAnalysisData } from "@/app/actions/analysis";
import { getTodayJournalCount } from "@/app/actions/journal";
import Navigation from "@/components/Navigation";
import { format, isSameDay } from "date-fns";
import {
  Calendar,
  Target,
  CheckCircle2,
  Clock,
  TrendingUp,
  Lightbulb,
  BarChart3,
  Flame,
} from "lucide-react";

export default function AnalysisPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const result = await getAnalysisData();
    if (result.success) {
      setData(result.data);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 sm:pb-24 md:pb-6 md:pl-20 lg:pl-64 safe-bottom">
        <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8">
          <div className="flex items-center justify-center py-20">
            <div className="animate-pulse text-slate-400">Loading analysis...</div>
          </div>
        </div>
        <Navigation />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 sm:pb-24 md:pb-6 md:pl-20 lg:pl-64 safe-bottom">
        <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8">
          <div className="text-center py-20">
            <p className="text-slate-600 dark:text-slate-400">Failed to load analysis data</p>
          </div>
        </div>
        <Navigation />
      </div>
    );
  }

  const {
    todayTasks,
    tomorrowTasks,
    pendingTasks,
    completedTasks,
    futureTasks,
    habitConsistency,
    bestIdeas,
    repetitionPatterns,
  } = data;

  function getTaskTypeColor(type: string) {
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

  function getConsistencyColor(consistency: number) {
    if (consistency >= 80) return "text-green-600 dark:text-green-400";
    if (consistency >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 sm:pb-24 md:pb-6 md:pl-20 lg:pl-64 safe-bottom">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400 mb-1 sm:mb-2 tracking-tight">
            Analysis
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm md:text-base font-semibold">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>

        {/* Today's Tasks */}
        <div className="mb-4 sm:mb-6 pb-2">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              Today&apos;s Tasks <span className="text-sm sm:text-base font-semibold text-slate-500 dark:text-slate-400">({todayTasks.length})</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {todayTasks.length === 0 ? (
              <div className="col-span-full p-4 sm:p-6 bg-slate-50 dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 text-center text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                No tasks for today
              </div>
            ) : (
              todayTasks.map((task: any) => (
                <div
                  key={task._id || task.id}
                  className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div
                      className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${getTaskTypeColor(
                        task.type === "habit" ? "habit" : task.type
                      )} mt-1 sm:mt-1.5 flex-shrink-0`}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100 mb-1 truncate">
                        {task.name || task.title}
                      </h3>
                      {task.time && (
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                          {task.time}
                        </p>
                      )}
                      {task.location && (
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 truncate">
                          📍 {task.location}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Tomorrow's Tasks */}
        <div className="mb-4 sm:mb-6 pb-2">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              Tomorrow&apos;s Tasks <span className="text-sm sm:text-base font-semibold text-slate-500 dark:text-slate-400">({tomorrowTasks.length})</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {tomorrowTasks.length === 0 ? (
              <div className="col-span-full p-4 sm:p-6 bg-slate-50 dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 text-center text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                No tasks for tomorrow
              </div>
            ) : (
              tomorrowTasks.map((task: any) => (
                <div
                  key={task._id}
                  className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div
                      className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${getTaskTypeColor(task.type)} mt-1 sm:mt-1.5 flex-shrink-0`}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100 mb-1 truncate">
                        {task.title}
                      </h3>
                      {task.time && (
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                          {task.time}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending Tasks */}
        <div className="mb-4 sm:mb-6 pb-2">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              Pending Tasks <span className="text-sm sm:text-base font-semibold text-slate-500 dark:text-slate-400">({pendingTasks.length})</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {pendingTasks.length === 0 ? (
              <div className="col-span-full p-4 sm:p-6 bg-slate-50 dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 text-center text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                No pending tasks
              </div>
            ) : (
              pendingTasks.map((task: any) => (
                <div
                  key={task._id || task.id}
                  className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div
                      className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${getTaskTypeColor(
                        task.type === "habit" ? "habit" : task.type
                      )} mt-1 sm:mt-1.5 flex-shrink-0`}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
                        {task.name || task.title}
                      </h3>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Completed Tasks */}
        <div className="mb-4 sm:mb-6 pb-2">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              Completed Tasks <span className="text-sm sm:text-base font-semibold text-slate-500 dark:text-slate-400">({completedTasks.length})</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {completedTasks.length === 0 ? (
              <div className="col-span-full p-4 sm:p-6 bg-slate-50 dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 text-center text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                No completed tasks today
              </div>
            ) : (
              completedTasks.map((task: any) => (
                <div
                  key={task._id || task.id}
                  className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 opacity-75"
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100 line-through truncate">
                        {task.name || task.title}
                      </h3>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Future Tasks */}
        <div className="mb-4 sm:mb-6 pb-2">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              Future Tasks <span className="text-sm sm:text-base font-semibold text-slate-500 dark:text-slate-400">({futureTasks.length})</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {futureTasks.length === 0 ? (
              <div className="col-span-full p-4 sm:p-6 bg-slate-50 dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 text-center text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                No future tasks
              </div>
            ) : (
              futureTasks.slice(0, 10).map((task: any) => (
                <div
                  key={task._id}
                  className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div
                      className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${getTaskTypeColor(task.type)} mt-1 sm:mt-1.5 flex-shrink-0`}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100 mb-1 truncate">
                        {task.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                        {format(new Date(task.date), "MMM d, yyyy")}
                        {task.time && ` • ${task.time}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Habit Consistency */}
        <div className="mb-4 sm:mb-6 pb-2">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              Habit Consistency
            </h2>
          </div>
          <div className="space-y-2 sm:space-y-3">
            {habitConsistency.length === 0 ? (
              <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 text-center text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                No habit data available
              </div>
            ) : (
              habitConsistency.map((habit: any) => (
                <div
                  key={habit.habitId}
                  className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-2">
                    <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
                      {habit.habitName}
                    </h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {habit.streak > 0 && (
                        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Flame className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="text-xs sm:text-sm font-bold">{habit.streak}</span>
                        </div>
                      )}
                      <span
                        className={`text-base sm:text-lg font-bold ${getConsistencyColor(
                          habit.consistency
                        )}`}
                      >
                        {habit.consistency}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 sm:h-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        habit.consistency >= 80
                          ? "bg-gradient-to-r from-green-500 to-emerald-600"
                          : habit.consistency >= 50
                          ? "bg-gradient-to-r from-yellow-500 to-orange-600"
                          : "bg-gradient-to-r from-red-500 to-pink-600"
                      }`}
                      style={{ width: `${habit.consistency}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                    {habit.completedDays} of {habit.totalDays} days completed
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Best Ideas */}
        <div className="mb-4 sm:mb-6 pb-32 sm:pb-6 md:pb-4">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div className="p-2 sm:p-2.5 bg-gradient-to-br from-amber-400 to-amber-500 dark:from-amber-500 dark:to-amber-600 rounded-xl shadow-lg">
              <Lightbulb className="w-5 h-5 sm:w-6 sm:h-6 text-white flex-shrink-0" />
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
              Best Ideas Suggestions
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {bestIdeas.length === 0 ? (
              <div className="col-span-full p-6 sm:p-8 bg-slate-50 dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 text-center">
                <Lightbulb className="w-12 h-12 sm:w-16 sm:h-16 text-slate-400 dark:text-slate-500 mx-auto mb-3 sm:mb-4" />
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-medium">
                  No ideas available yet
                </p>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-500 mt-1">
                  Start adding ideas to see suggestions here
                </p>
              </div>
            ) : (
              bestIdeas.map((idea: any) => (
                <div
                  key={idea._id}
                  className="group relative overflow-hidden p-4 sm:p-5 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-900/30 dark:via-orange-900/20 dark:to-yellow-900/20 rounded-xl sm:rounded-2xl border-2 border-amber-200/60 dark:border-amber-800/60 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-lg transition-all duration-300"
                >
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-amber-200/20 to-orange-200/20 dark:from-amber-500/10 dark:to-orange-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                  <div className="relative z-10">
                    <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
                      <div className="p-2 sm:p-2.5 bg-gradient-to-br from-amber-400 to-amber-500 dark:from-amber-500 dark:to-amber-600 rounded-lg shadow-md flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                        <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-base md:text-lg text-slate-900 dark:text-slate-100 font-semibold mb-2 sm:mb-3 line-clamp-3 break-words leading-relaxed">
                          {idea.text || idea.description || idea.subTopic || "No description"}
                        </p>
                        {(idea.subTopic || idea.description) && idea.text && (
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-2 line-clamp-2">
                            {idea.subTopic || idea.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                      {idea.priority && idea.priority !== "normal" && (
                        <span className="px-2.5 py-1 sm:py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 dark:from-amber-500 dark:to-amber-600 text-white rounded-lg text-xs font-bold shadow-sm">
                          {idea.priority.charAt(0).toUpperCase() + idea.priority.slice(1)}
                        </span>
                      )}
                      {idea.tags &&
                        idea.tags.slice(0, 2).map((tag: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 sm:py-1.5 bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium truncate max-w-[120px] sm:max-w-none"
                          >
                            {tag}
                          </span>
                        ))}
                      {idea.tags && idea.tags.length > 2 && (
                        <span className="px-2.5 py-1 sm:py-1.5 bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium">
                          +{idea.tags.length - 2}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-2 sm:pt-3 border-t border-amber-200/50 dark:border-amber-800/50">
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                        {format(new Date(idea.createdAt), "MMM d, yyyy")}
                      </p>
                      {idea.topicId && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                          📌 Topic
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <Navigation />
    </div>
  );
}
