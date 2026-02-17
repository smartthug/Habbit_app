import { getCurrentUser } from "@/lib/auth";
import { getTodayHabits, checkHabitRequirements } from "@/app/actions/habits";
import { getIdeas } from "@/app/actions/ideas";
import { getTodayJournalCount } from "@/app/actions/journal";
import { format } from "date-fns";
import Link from "next/link";
import { Plus, Target, Lightbulb, TrendingUp } from "lucide-react";
import Navigation from "@/components/Navigation";
import AddModal from "@/components/AddModal";
import DynamicQuote from "@/components/DynamicQuote";
import { debugAuth } from "@/lib/auth-debug";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  // Debug in development only
  await debugAuth("/dashboard");

  // Middleware already handles auth, but we still need user for display
  const tokenUser = await getCurrentUser();
  if (!tokenUser) {
    // This shouldn't happen if middleware works correctly
    return null;
  }

  // Fetch full user data from database to get the name and check profile setup
  let user;
  try {
    await connectDB();
    const dbUser = await User.findById(tokenUser.userId).select("name email timeCategories profileSetupCompleted");
    if (!dbUser) {
      return null;
    }

    // Check if profile setup is completed
    if (!dbUser.profileSetupCompleted) {
      redirect("/profile-setup");
    }

    user = {
      name: dbUser.name,
      email: dbUser.email,
      timeCategories: dbUser.timeCategories || null,
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
  let recentIdeasResult;
  
  try {
    todayHabitsResult = await getTodayHabits();
    recentIdeasResult = await getIdeas({});
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    // Return empty results if there's an error
    todayHabitsResult = { success: false, habits: [] };
    recentIdeasResult = { success: false, ideas: [] };
  }

  const todayHabits = todayHabitsResult.success ? todayHabitsResult.habits : [];
  const habitsByCategory = todayHabitsResult.success && todayHabitsResult.habitsByCategory 
    ? todayHabitsResult.habitsByCategory 
    : {};
  const allIdeasResult = recentIdeasResult.success ? recentIdeasResult.ideas : [];
  const totalIdeasCount = allIdeasResult.length;

  const completedCount = todayHabits.filter((h: any) => h.todayStatus === "done").length;
  const totalCount = todayHabits.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Check habit requirements
  const habitRequirementsResult = await checkHabitRequirements();
  const habitRequirements = habitRequirementsResult.success ? habitRequirementsResult : null;

  // Check journal entries requirement (for display purposes only)
  const journalCountResult = await getTodayJournalCount();
  const journalCount = journalCountResult.success ? journalCountResult.count : 0;

  // Category display names
  const categoryNames: Record<string, string> = {
    personal: "Personal",
    work: "Work",
    family: "Family",
    business: "Business",
    journal: "Journal",
    custom: "Custom",
  };

  const coreCategoryNames: Record<string, string> = {
    personal: "Personal",
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 sm:pb-20 md:pb-6 md:pl-20 lg:pl-64 safe-bottom">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8">
        <div className="mb-8 md:mb-10 lg:mb-12 animate-fade-in">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 tracking-tight leading-tight">
            {greeting()},<br className="hidden md:block" /> <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">{user.name}</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-3 md:mt-4 text-base md:text-lg lg:text-xl font-semibold tracking-wide">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
          <DynamicQuote timeAllocation={user.timeCategories} />
        </div>

        {/* Habit Requirements Status */}
        {habitRequirements && !habitRequirements.isComplete && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 mb-6 shadow-premium-lg">
            <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Habit Requirements
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-amber-800 dark:text-amber-200">Minimum 5 habits:</span>
                <span className={`font-semibold ${habitRequirements.hasMinimumHabits ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {habitRequirements.totalHabits}/{habitRequirements.requiredHabits}
                </span>
              </div>
              {habitRequirements.missingCategories && habitRequirements.missingCategories.length > 0 && (
                <div>
                  <span className="text-amber-800 dark:text-amber-200">Missing categories:</span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {habitRequirements.missingCategories.map((cat: string) => (
                      <span key={cat} className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-800 dark:text-amber-200 font-medium text-xs">
                        {coreCategoryNames[cat] || cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {!habitRequirements.journalExists && (
                <div className="text-amber-800 dark:text-amber-200">
                  <span className="font-semibold">⚠️ Journal habit is required</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Today's Summary - Premium Card */}
        <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-800 backdrop-blur-xl rounded-3xl p-6 md:p-8 lg:p-10 mb-6 shadow-premium-lg border border-slate-200/50 dark:border-slate-700/50 animate-scale-in">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-400/0 to-purple-400/0 dark:from-indigo-400/0 dark:to-purple-400/0 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative z-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">Today&apos;s Progress</h2>
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full">
              {completedCount}/{totalCount}
            </span>
          </div>
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm md:text-base mb-4">
              <span className="text-slate-600 dark:text-slate-400 font-semibold">Completion Rate</span>
              <span className="font-extrabold text-2xl md:text-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">{completionRate}%</span>
            </div>
            <div className="w-full bg-slate-200/80 dark:bg-slate-700/80 rounded-full h-4 md:h-5 overflow-hidden shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-700 ease-out shadow-glow-sm relative overflow-hidden"
                style={{ width: `${completionRate}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-100/40 to-transparent animate-shimmer"></div>
              </div>
            </div>
          </div>
          {totalCount === 0 && (
            <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 text-center py-6 md:py-8 bg-slate-100 dark:from-slate-700/30 dark:to-indigo-950/20 dark:bg-gradient-to-r rounded-2xl font-medium border border-slate-200/50 dark:border-slate-700/30">
              No habits for today. Create one to get started! 🚀
            </p>
          )}
          </div>
        </div>

        {/* Habits by Category */}
        {totalCount > 0 && Object.keys(habitsByCategory).length > 0 && (
          <div className="space-y-6 mb-6">
            {Object.entries(habitsByCategory).map(([category, habits]: [string, any[]]) => (
              <div
                key={category}
                className="relative overflow-hidden bg-slate-50 dark:bg-slate-800 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-premium-lg border border-slate-200/50 dark:border-slate-700/50"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-400/0 to-purple-400/0 dark:from-indigo-400/0 dark:to-purple-400/0 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10">
                  <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100 mb-4 capitalize">
                    {categoryNames[category] || category}
                  </h3>
                  <div className="space-y-3">
                    {habits.map((habit: any) => {
                      const habitCompletion = habit.completionPercentage || 0;
                      const isDone = habit.todayStatus === "done";
                      return (
                        <div
                          key={habit._id}
                          className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/50 dark:border-slate-700/50"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                                {habit.name}
                              </h4>
                              {habit.startTime && habit.endTime && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {habit.startTime} - {habit.endTime}
                                </p>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                {habitCompletion}%
                              </div>
                              <div className={`text-xs ${isDone ? "text-green-600 dark:text-green-400" : "text-slate-500 dark:text-slate-400"}`}>
                                {isDone ? "Done" : "Pending"}
                              </div>
                            </div>
                          </div>
                          <div className="w-full bg-slate-200/80 dark:bg-slate-700/80 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isDone
                                  ? "bg-gradient-to-r from-green-500 to-emerald-600"
                                  : "bg-gradient-to-r from-indigo-500 to-purple-600"
                              }`}
                              style={{ width: `${habitCompletion}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions - Premium Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
          <Link
            href="/habits"
            className="group relative overflow-hidden tap-target bg-slate-50 dark:bg-slate-800 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-premium-lg active:shadow-premium-xl border border-slate-200/50 dark:border-slate-700/50 transition-all duration-300 touch-active active:scale-[0.97] hover:scale-[1.02] hover:shadow-glow animate-fade-in"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-400/0 to-purple-400/0 dark:from-indigo-400/0 dark:to-purple-400/0 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative z-10">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 flex items-center justify-center mb-4 group-active:scale-110 transition-transform shadow-lg group-hover:shadow-xl">
                <Target className="w-7 h-7 md:w-8 md:h-8 text-white" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-2 text-lg md:text-xl">Habits</h3>
              <p className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent mb-1">
                {totalCount}
              </p>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 font-medium">
                {totalCount === 1 ? "Active habit" : "Active habits"}
              </p>
            </div>
          </Link>
          <Link
            href="/ideas"
            className="group relative overflow-hidden tap-target bg-slate-50 dark:bg-slate-800 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-premium-lg active:shadow-premium-xl border border-slate-200/50 dark:border-slate-700/50 transition-all duration-300 touch-active active:scale-[0.97] hover:scale-[1.02] hover:shadow-glow animate-fade-in"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-400/0 to-orange-400/0 dark:from-amber-400/0 dark:to-orange-400/0 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative z-10">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 flex items-center justify-center mb-4 group-active:scale-110 transition-transform shadow-lg group-hover:shadow-xl">
                <Lightbulb className="w-7 h-7 md:w-8 md:h-8 text-white" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-2 text-lg md:text-xl">Ideas</h3>
              <p className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent mb-1">
                {totalIdeasCount}
              </p>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 font-medium">
                {totalIdeasCount === 1 ? "Captured idea" : "Captured ideas"}
              </p>
            </div>
          </Link>
        </div>

        {/* Streak Indicator - Premium */}
        {totalCount > 0 && (
          <div className="relative overflow-hidden rounded-3xl p-6 md:p-8 lg:p-10 text-white shadow-premium-xl animate-scale-in mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-500 dark:via-purple-500 dark:to-pink-500"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }}></div>
            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6 z-10">
              <div>
                <p className="text-sm md:text-base opacity-100 mb-2 font-bold tracking-wide text-white drop-shadow-lg">Current Streak</p>
                <p className="text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold mb-2 drop-shadow-2xl">🔥 {completionRate > 0 ? "1" : "0"}</p>
                <p className="text-base md:text-lg font-bold mb-1 text-white drop-shadow-lg">days</p>
                <p className="text-xs md:text-sm opacity-100 mt-2 font-semibold text-white drop-shadow">Keep it going! 💪</p>
              </div>
              <TrendingUp className="w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 opacity-100 text-white drop-shadow-lg animate-pulse flex-shrink-0" />
            </div>
          </div>
        )}
      </div>

      <Navigation />
    </div>
  );
}
