"use client";

import { useState } from "react";
import Link from "next/link";
import { signup } from "@/app/actions/auth";
import { UserPlus, User, Mail, Lock, Sparkles, Eye, EyeOff } from "lucide-react";

export default function SignupPage() {
  const [error, setError] = useState<string>("");
  const [isPending, setIsPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setIsPending(true);

    try {
      const formData = new FormData(e.currentTarget);
      const result = await signup(formData);

      if (result?.error) {
        setError(result.error);
        setIsPending(false);
      } else if (result?.success) {
        // Cookies are set, now redirect to profile setup
        window.location.href = "/profile-setup";
      }
    } catch (err: any) {
      console.error("Signup error:", err);
      setError("An unexpected error occurred. Please try again.");
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 sm:px-6 py-8 sm:py-12">
      <div className="w-full max-w-md mx-auto">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 shadow-lg mb-4 sm:mb-6">
            <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent mb-2 sm:mb-3">
            Get Started
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Create your account to start tracking
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl sm:rounded-3xl shadow-premium-lg border border-slate-200/50 dark:border-slate-700/50 p-6 sm:p-8 md:p-10">
          <form className="space-y-5 sm:space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}

            <div className="space-y-4 sm:space-y-5">
              {/* Name Input */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    className="block w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-3.5 text-base border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              {/* Email Input */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="block w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-3.5 text-base border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    className="block w-full pl-10 sm:pl-12 pr-12 py-3 sm:py-3.5 text-base border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    placeholder="Min. 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors tap-target"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Password must be at least 6 characters long
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isPending}
              className="tap-target w-full flex items-center justify-center gap-2 py-3 sm:py-3.5 px-6 bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-600 hover:via-purple-700 hover:to-pink-700 active:from-indigo-700 active:via-purple-800 active:to-pink-800 text-white rounded-lg font-semibold shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 min-h-[48px] sm:min-h-[52px] text-base sm:text-lg"
            >
              <UserPlus className="w-5 h-5" />
              <span>{isPending ? "Creating account..." : "Create Account"}</span>
            </button>

            {/* Sign In Link */}
            <div className="text-center pt-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Already have an account?{" "}
                <Link
                  href="/auth/login"
                  className="font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent hover:from-indigo-700 hover:to-purple-700 dark:hover:from-indigo-300 dark:hover:to-purple-300 transition-all"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
