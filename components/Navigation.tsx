"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Target, Plus, Lightbulb, User, Calendar, BarChart3 } from "lucide-react";
import AddModal from "./AddModal";

export default function Navigation() {
  const pathname = usePathname();
  const [showAddModal, setShowAddModal] = useState(false);

  const navItems = [
    { href: "/dashboard", icon: Home, label: "Home" },
    { href: "/habits", icon: Target, label: "Habits" },
    { href: "/ideas", icon: Lightbulb, label: "Ideas" },
    { href: "/calendar", icon: Calendar, label: "Calendar" },
    { href: "/analysis", icon: BarChart3, label: "Analysis" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  // Hide navigation on profile-setup page
  const hideNav = pathname === "/profile-setup";

  return (
    <>
      {/* Mobile Navigation - Bottom */}
      {!hideNav && (
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-50/95 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-800/50 z-50 shadow-premium-lg safe-bottom md:hidden">
        <div className="max-w-md mx-auto flex items-center justify-around h-20 px-2 pb-safe">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`tap-target flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 touch-active no-select ${
                  isActive
                    ? "text-indigo-600 dark:text-indigo-400 scale-110"
                    : "text-slate-500 dark:text-slate-400 active:text-slate-700 dark:active:text-slate-300"
                }`}
              >
                <div className={`p-2.5 rounded-xl transition-all duration-200 ${isActive ? "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg scale-110" : "active:bg-slate-100 dark:active:bg-slate-800"}`}>
                  <Icon className={`w-6 h-6 sm:w-7 sm:h-7 ${isActive ? "text-white" : ""}`} />
                </div>
                <span className={`text-xs sm:text-sm mt-1 font-semibold tracking-tight ${isActive ? "text-indigo-600 dark:text-indigo-400" : ""}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
          <button
            onClick={() => setShowAddModal(true)}
            className="tap-target flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 touch-active no-select active:scale-95"
            aria-label="Add new item"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-premium active:shadow-premium-lg transition-all duration-200 hover:scale-110">
              <Plus className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <span className="text-xs sm:text-sm mt-1 font-semibold text-indigo-600 dark:text-indigo-400 tracking-tight">Add</span>
          </button>
        </div>
      </nav>
      )}

      {/* Desktop/Tablet Navigation - Sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-20 lg:w-64 bg-slate-50 dark:bg-slate-900 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-700/50 z-50 shadow-premium-lg flex-col items-center lg:items-start py-6 px-4 lg:px-6 safe-top overflow-y-auto">
        <div className="w-full flex flex-col items-center lg:items-start gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`tap-target w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 touch-active no-select ${
                  isActive
                    ? "text-white bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg scale-105"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80"
                }`}
              >
                <Icon className="w-6 h-6 flex-shrink-0" />
                <span className={`hidden lg:block text-sm font-semibold tracking-tight ${isActive ? "text-white" : ""}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
          <button
            onClick={() => setShowAddModal(true)}
            className="tap-target w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 text-white shadow-premium hover:shadow-premium-lg transition-all duration-200 touch-active no-select active:scale-95"
            aria-label="Add new item"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <span className="hidden lg:block text-sm font-semibold tracking-tight">Add New</span>
          </button>
        </div>
      </nav>
      <AddModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    </>
  );
}
