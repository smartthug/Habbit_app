"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { checkJournalRequirement } from "@/app/actions/journal";
import { BookOpen, AlertCircle } from "lucide-react";

interface JournalRequirementGuardProps {
  children: React.ReactNode;
}

export default function JournalRequirementGuard({ children }: JournalRequirementGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [requirement, setRequirement] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Routes that are always allowed
  const allowedRoutes = [
    "/ideas",
    "/auth/login",
    "/auth/signup",
    "/profile-setup",
  ];

  useEffect(() => {
    async function checkRequirements() {
      // Allow access to journal page, dashboard, and auth routes
      if (
        allowedRoutes.some((route) => pathname?.startsWith(route)) || 
        pathname?.startsWith("/dashboard")
      ) {
        // Still check requirement to update state, but don't block access
        const requirementResult = await checkJournalRequirement();
        setRequirement(requirementResult);
        setLoading(false);
        return;
      }

      // Check journal requirement
      const requirementResult = await checkJournalRequirement();
      setRequirement(requirementResult);

      // If redirect to habit setup is needed, send user to dashboard
      if (requirementResult.success && requirementResult.redirectToHabits) {
        router.push("/dashboard");
        setLoading(false);
        return;
      }

      // If journal is required and not complete, redirect to journal
      // BUT only if we're not already on the journal/ideas page or dashboard
      if (
        requirementResult.success && 
        requirementResult.isRequired && 
        !requirementResult.isComplete &&
        !pathname?.startsWith("/ideas") &&
        !pathname?.startsWith("/dashboard")
      ) {
        router.push("/ideas?journal=true");
        setLoading(false);
        return;
      }

      setLoading(false);
    }

    checkRequirements();

    // Check every 30 seconds
    const interval = setInterval(checkRequirements, 30000);
    return () => clearInterval(interval);
  }, [pathname, router]);

  // If loading, show nothing
  if (loading) {
    return null;
  }

  // If redirect to habit setup is needed, show message
  if (requirement?.success && requirement?.redirectToHabits) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-50 dark:bg-slate-800 rounded-3xl p-8 shadow-premium-lg border border-slate-200/50 dark:border-slate-700/50 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Habit Setup Required
          </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
            {requirement.reason || "Please create habits using the Add New button on your dashboard before accessing other pages."}
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full px-6 py-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <span>Go to Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  // If no restriction, allow access (either not required OR required and complete)
  if (requirement?.success && (!requirement?.isRequired || requirement?.isComplete)) {
    return <>{children}</>;
  }

  // If journal is required but not complete, show restriction message
  // BUT allow dashboard and ideas pages
  if (
    requirement?.success &&
    requirement?.isRequired &&
    !requirement?.isComplete &&
    !allowedRoutes.some((route) => pathname?.startsWith(route)) &&
    !pathname?.startsWith("/dashboard")
  ) {
    const missingCount = requirement.missingCategories?.length || 0;
    const completedCount = requirement.completedCategories?.length || 0;
    const requiredCount = requirement.requiredCategories?.length || 0;

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-50 dark:bg-slate-800 rounded-3xl p-8 shadow-premium-lg border border-slate-200/50 dark:border-slate-700/50 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Journal Entry Required
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            {requirement.reason || "Please complete journal entries for all your habit categories before accessing other pages."}
          </p>
          <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4 mb-6 text-left">
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Progress: {completedCount} of {requiredCount} categories completed
                </p>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {Math.round((completedCount / requiredCount) * 100)}%
                </span>
              </div>
              {/* Progress Bar */}
              <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500 ease-out"
                  style={{ width: `${(completedCount / requiredCount) * 100}%` }}
                >
                  <div className="h-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold">Required categories:</span>{" "}
                {requirement.requiredCategories?.join(", ") || "None"}
              </div>
              {missingCount > 0 && (
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  <span className="font-semibold">Missing:</span>{" "}
                  {requirement.missingCategories?.join(", ") || "None"}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => router.push("/ideas?journal=true")}
            className="w-full px-6 py-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <BookOpen className="w-5 h-5" />
            <span>Go to Journal</span>
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
