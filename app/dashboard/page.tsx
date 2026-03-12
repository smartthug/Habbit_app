import { getCurrentUser } from "@/lib/auth";
import { getTodayHabits, checkHabitRequirements, getUserStreak } from "@/app/actions/habits";
import { getAnalysisData } from "@/app/actions/analysis";
import { getIdeas } from "@/app/actions/ideas";
import { format } from "date-fns";
import Link from "next/link";
import {
  Target,
  Lightbulb,
  TrendingUp,
  Flame,
  Calendar,
  CheckCircle2,
  Clock,
  BarChart3,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import DynamicQuote from "@/components/DynamicQuote";
import { debugAuth } from "@/lib/auth-debug";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { redirect } from "next/navigation";

// Mark as dynamic since we use cookies
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Debug in development only
  await debugAuth("/dashboard");

  // Middleware already handles auth, but we still need user for display
  const tokenUser = await getCurrentUser();
  if (!tokenUser) {
    // If no valid user, redirect to login (cookies may be invalid/expired)
    // This handles cases where middleware passed but tokens are invalid
    redirect("/auth/login");
  }

  // Fetch full user data from database to get the name and check profile setup
  let user;
  try {
    await connectDB();
    const dbUser = await User.findById(tokenUser.userId).select("name email timeCategories profileSetupCompleted");
    if (!dbUser) {
      // User not found in database - invalid token, redirect to login
      redirect("/auth/login");
    }

    // Check if profile setup is completed
    if (!dbUser.profileSetupCompleted) {
      redirect("/profile-setup");
    }

    // Convert timeCategories to plain object to avoid Next.js serialization warning
    const timeCategories = dbUser.timeCategories 
      ? JSON.parse(JSON.stringify(dbUser.timeCategories))
      : null;

    user = {
      name: dbUser.name,
      email: dbUser.email,
      timeCategories: timeCategories,
    };
  } catch (error) {
    console.error("Error fetching user:", error);
    // Fallback to email if database fetch fails
    user = {
      name: tokenUser.email.split("@")[0],
      email: tokenUser.email,
      timeCategories: null,
    };
  }

  let todayHabitsResult;
  let analysisResult;
  let recentIdeasResult;

  try {
    [todayHabitsResult, analysisResult, recentIdeasResult] = await Promise.all([
      getTodayHabits(),
      getAnalysisData(),
      getIdeas({}),
    ]);
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    todayHabitsResult = { success: false, habits: [] };
    analysisResult = { success: false, data: null };
    recentIdeasResult = { success: false, ideas: [] };
  }

  const todayHabits = todayHabitsResult.success ? todayHabitsResult.habits : [];
  const analysis = analysisResult.success && analysisResult.data ? analysisResult.data : null;
  const allIdeasResult = recentIdeasResult.success ? recentIdeasResult.ideas : [];
  const totalIdeasCount = allIdeasResult.length;

  const todayTasks = analysis?.todayTasks ?? [];
  const todayHabitsFromAnalysis = todayTasks.filter((t: any) => t.type === "habit");
  const pendingTasks = analysis?.pendingTasks ?? [];
  const completedTasks = analysis?.completedTasks ?? [];
  const futureTasks = analysis?.futureTasks ?? [];
  const habitConsistency = analysis?.habitConsistency ?? [];
  const bestIdeas = analysis?.bestIdeas ?? [];

  const userStreakResult = await getUserStreak();
  const currentStreak = userStreakResult.success ? userStreakResult.streak : 0;

  const habitRequirementsResult = await checkHabitRequirements();
  const habitRequirements = habitRequirementsResult.success ? habitRequirementsResult : null;

  const coreCategoryNames: Record<string, string> = {
    personal: "Personal Work",
    workBlock: "Work Block",
    productive: "Productive",
    familyTime: "Family Time",
    journal: "Journal",
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-28 sm:pb-24 md:pb-6 md:pl-20 lg:pl-64 safe-bottom">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6 md:py-8 lg:py-10">
        <div className="mb-8 md:mb-10 lg:mb-12 animate-fade-in">
          <h1 className="text-display font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 tracking-tight leading-tight">
            {greeting()},<br className="hidden md:block" /> <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">{user.name}</span>
          </h1>
          <p className="text-contrast-medium mt-4 md:mt-5 text-body-large font-semibold tracking-wide">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
          <DynamicQuote timeAllocation={user.timeCategories} />
        </div>

        {/* Habit Requirements Status - Show warning if any category is missing */}
        {habitRequirements && habitRequirements.missingCategories && habitRequirements.missingCategories.length > 0 && (
          <div className="card-premium bg-amber-50/90 dark:bg-amber-900/30 border-amber-200/60 dark:border-amber-800/60 p-6 md:p-7 mb-6">
            <h3 className="text-heading-3 font-bold text-amber-900 dark:text-amber-100 mb-5 flex items-center gap-2.5">
              <Target className="w-5 h-5 md:w-6 md:h-6" />
              Habit Requirements
            </h3>
            <div className="space-y-3 text-sm">
              {/* Missing categories warning */}
              <div>
                <p className="text-amber-800 dark:text-amber-200 font-semibold mb-3">
                  ⚠️ Missing Required Categories:
                </p>
                <div className="space-y-2">
                  {habitRequirements.missingCategories.map((cat: string) => (
                    <div key={cat} className="flex items-center gap-2 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800">
                      <span className="text-amber-800 dark:text-amber-200 font-medium">
                        You missed the habit in <span className="font-bold">{coreCategoryNames[cat] || cat}</span>.
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-amber-800 dark:text-amber-200 text-xs mt-3 pt-3 border-t border-amber-200 dark:border-amber-800">
                  You must have at least one habit in each of the 5 required categories: Personal Work, Work Block, Productive, Family Time, and Journal.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Today's Habits */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              Today&apos;s Habits <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">({todayHabitsFromAnalysis.length})</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {todayHabitsFromAnalysis.length === 0 ? (
              <div className="col-span-full p-4 sm:p-6 bg-slate-50 dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-slate-700/50 text-center text-sm text-slate-600 dark:text-slate-400">
                No habits for today
              </div>
            ) : (
              todayHabitsFromAnalysis.map((task: any) => (
                <div key={task._id} className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/50 dark:border-slate-700/50 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">{task.name || task.title}</h3>
                      {task.startTime && task.endTime && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">{task.startTime} – {task.endTime}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Pending Priority Events */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              Pending Priority Events <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">({pendingTasks.length})</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {pendingTasks.length === 0 ? (
              <div className="col-span-full p-4 sm:p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/50 dark:border-slate-700/50 text-center text-sm text-slate-600 dark:text-slate-400">
                No pending priority events
              </div>
            ) : (
              pendingTasks.map((task: any) => (
                <div key={task._id || task.id} className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/50 dark:border-slate-700/50 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${task.type === "habit" ? "bg-indigo-500" : task.type === "meeting" ? "bg-blue-500" : task.type === "birthday" ? "bg-pink-500" : "bg-purple-500"} mt-1.5 flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">{task.name || task.title}</h3>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Completed Tasks */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              Completed Tasks <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">({completedTasks.length})</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {completedTasks.length === 0 ? (
              <div className="col-span-full p-4 sm:p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/50 dark:border-slate-700/50 text-center text-sm text-slate-600 dark:text-slate-400">
                No completed tasks today
              </div>
            ) : (
              completedTasks.map((task: any) => (
                <div key={task._id || task.id} className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/50 dark:border-slate-700/50 opacity-75">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100 line-through truncate">{task.name || task.title}</h3>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Future Tasks */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              Future Tasks <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">({futureTasks.length})</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {futureTasks.length === 0 ? (
              <div className="col-span-full p-4 sm:p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/50 dark:border-slate-700/50 text-center text-sm text-slate-600 dark:text-slate-400">
                No future tasks
              </div>
            ) : (
              futureTasks.slice(0, 6).map((task: any) => (
                <div key={task._id} className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/50 dark:border-slate-700/50 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${task.type === "meeting" ? "bg-blue-500" : task.type === "birthday" ? "bg-pink-500" : "bg-purple-500"} mt-1.5 flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">{task.title}</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{format(new Date(task.date), "MMM d, yyyy")}{task.time ? ` • ${task.time}` : ""}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Habit Consistency */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">Habit Consistency</h2>
          </div>
          <div className="space-y-2 sm:space-y-3">
            {habitConsistency.length === 0 ? (
              <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/50 dark:border-slate-700/50 text-center text-sm text-slate-600 dark:text-slate-400">
                No habit data available
              </div>
            ) : (
              habitConsistency.map((habit: any) => (
                <div key={habit.habitId} className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/50 dark:border-slate-700/50 hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">{habit.habitName}</h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {habit.streak > 0 && (
                        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Flame className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="text-xs sm:text-sm font-bold">{habit.streak}</span>
                        </div>
                      )}
                      <span className={`text-base font-bold ${habit.consistency >= 80 ? "text-green-600 dark:text-green-400" : habit.consistency >= 50 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}>
                        {habit.consistency}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${habit.consistency >= 80 ? "bg-gradient-to-r from-green-500 to-emerald-600" : habit.consistency >= 50 ? "bg-gradient-to-r from-yellow-500 to-orange-600" : "bg-gradient-to-r from-red-500 to-pink-600"}`}
                      style={{ width: `${habit.consistency}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">{habit.completedDays} of {habit.totalDays} days completed</p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Best Idea Suggestions */}
        <section className="mb-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-4">
            <div className="p-2 sm:p-2.5 bg-gradient-to-br from-amber-400 to-amber-500 dark:from-amber-500 dark:to-amber-600 rounded-xl shadow-lg">
              <Lightbulb className="w-5 h-5 sm:w-6 sm:h-6 text-white flex-shrink-0" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">Best Idea Suggestions</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {bestIdeas.length === 0 ? (
              <div className="col-span-full p-6 sm:p-8 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/50 dark:border-slate-700/50 text-center">
                <Lightbulb className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-3" />
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">No ideas available yet</p>
                <p className="text-xs text-slate-500 mt-1">Start adding ideas to see suggestions here</p>
              </div>
            ) : (
              bestIdeas.slice(0, 6).map((idea: any) => (
                <div key={idea._id} className="p-4 sm:p-5 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-900/30 dark:via-orange-900/20 dark:to-yellow-900/20 rounded-xl border-2 border-amber-200/60 dark:border-amber-800/60 hover:shadow-lg transition-all">
                  <p className="text-sm sm:text-base text-slate-900 dark:text-slate-100 font-semibold line-clamp-3 break-words">{idea.text || idea.description || idea.subTopic || "No description"}</p>
                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-amber-200/50 dark:border-amber-800/50">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{format(new Date(idea.createdAt), "MMM d, yyyy")}</p>
                    {idea.priority && idea.priority !== "normal" && (
                      <span className="px-2.5 py-1 bg-amber-400/80 dark:bg-amber-600 text-white rounded-lg text-xs font-bold capitalize">{idea.priority}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Streaks */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">Streaks</h2>
          </div>
          <div className="relative overflow-hidden rounded-2xl p-6 md:p-8 text-white shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-500 dark:via-purple-500 dark:to-pink-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6 z-10">
              <div>
                <p className="text-sm md:text-base font-bold tracking-wide text-white/95 mb-2">Current Streak</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <Flame className="w-8 h-8 md:w-10 md:h-10 text-orange-300" />
                  <p className="text-4xl md:text-5xl lg:text-6xl font-extrabold">{currentStreak}</p>
                </div>
                <p className="text-base font-bold text-white/95">{currentStreak === 1 ? "day" : "days"} in a row</p>
                <p className="text-sm font-semibold text-white/90 mt-2">{currentStreak > 0 ? "Keep it going! 💪" : "Start your streak today! 🚀"}</p>
              </div>
              <TrendingUp className="w-16 h-16 md:w-20 md:h-20 text-white/90 flex-shrink-0" />
            </div>
          </div>
        </section>

        {/* Quick Actions - Premium Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
          <Link
            href="/calendar"
            className="card-premium group relative overflow-hidden tap-target p-6 md:p-8 transition-all duration-300 touch-active active:scale-[0.97] hover:scale-[1.02] hover:shadow-glow-sm animate-fade-in focus-visible-premium"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-400/0 to-purple-400/0 dark:from-indigo-400/0 dark:to-purple-400/0 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative z-10">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 flex items-center justify-center mb-4 group-active:scale-110 transition-transform shadow-lg group-hover:shadow-xl">
                <Target className="w-7 h-7 md:w-8 md:h-8 text-white" />
              </div>
              <h3 className="font-bold text-contrast-high mb-2 text-heading-3">Habits</h3>
              <p className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent mb-1">
                {todayHabits.length}
              </p>
              <p className="text-body-small text-contrast-medium font-medium">
                {todayHabits.length === 1 ? "Habit today" : "Habits today"}
              </p>
            </div>
          </Link>
          <Link
            href="/ideas"
            className="card-premium group relative overflow-hidden tap-target p-6 md:p-8 transition-all duration-300 touch-active active:scale-[0.97] hover:scale-[1.02] hover:shadow-glow-sm animate-fade-in focus-visible-premium"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-400/0 to-orange-400/0 dark:from-amber-400/0 dark:to-orange-400/0 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative z-10">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 flex items-center justify-center mb-4 group-active:scale-110 transition-transform shadow-lg group-hover:shadow-xl">
                <Lightbulb className="w-7 h-7 md:w-8 md:h-8 text-white" />
              </div>
              <h3 className="font-bold text-contrast-high mb-2 text-heading-3">Ideas</h3>
              <p className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent mb-1">
                {totalIdeasCount}
              </p>
              <p className="text-body-small text-contrast-medium font-medium">
                {totalIdeasCount === 1 ? "Captured idea" : "Captured ideas"}
              </p>
            </div>
          </Link>
        </div>

        <div className="pb-32 md:pb-8" />
      </div>

      <Navigation />
    </div>
  );
}
