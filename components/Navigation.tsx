"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, Lightbulb, User, Calendar, BarChart3, Menu, X } from "lucide-react";
import AddModal from "./AddModal";

export default function Navigation() {
  const pathname = usePathname();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const navItems = [
    { href: "/dashboard", icon: Home, label: "Home" },
    { href: "/ideas", icon: Lightbulb, label: "Ideas" },
    { href: "/calendar", icon: Calendar, label: "Calendar" },
    { href: "/analysis", icon: BarChart3, label: "Analysis" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  // Menu items for hamburger menu (Ideas, Calendar, Analysis, Profile)
  const menuItems = [
    { href: "/ideas", icon: Lightbulb, label: "Ideas" },
    { href: "/calendar", icon: Calendar, label: "Calendar" },
    { href: "/analysis", icon: BarChart3, label: "Analysis" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  // Close menu when route changes
  useEffect(() => {
    setShowMenu(false);
  }, [pathname]);

  // Hide navigation on profile-setup page
  const hideNav = pathname === "/profile-setup";

  return (
    <>
      {/* Mobile Navigation - Bottom */}
      {!hideNav && (
      <>
        {/* Hamburger Menu Overlay */}
        {showMenu && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setShowMenu(false)}
          />
        )}
        
        {/* Hamburger Menu Drawer */}
        <div className={`fixed bottom-20 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-800/60 z-50 shadow-premium-xl md:hidden transition-transform duration-300 ease-in-out safe-bottom ${
          showMenu ? "translate-y-0" : "translate-y-full"
        }`}>
          <div className="max-w-md mx-auto px-5 py-5 pb-safe">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-heading-3 text-contrast-high font-bold">Menu</h3>
              <button
                onClick={() => setShowMenu(false)}
                className="tap-target p-2 rounded-lg active:bg-slate-100 dark:active:bg-slate-800 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMenu(false)}
                    className={`tap-target flex items-center gap-3 p-4 rounded-xl transition-all duration-200 touch-active no-select focus-visible-premium ${
                      isActive
                        ? "text-white bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 shadow-premium-lg scale-[1.02]"
                        : "text-contrast-high bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 active:bg-slate-200 dark:active:bg-slate-700 border border-slate-200/50 dark:border-slate-700/50"
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-semibold text-sm">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-800/60 z-50 shadow-premium-xl safe-bottom md:hidden">
          <div className="max-w-md mx-auto flex items-center justify-between h-20 px-3 sm:px-4 pb-safe">
            {/* Left side: Hamburger menu icon */}
            <div className="flex items-center justify-start flex-1 flex-shrink-0">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="tap-target flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 transition-all duration-200 touch-active no-select active:scale-95"
                aria-label="Open menu"
              >
                <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all duration-200 active:bg-slate-100 dark:active:bg-slate-800">
                  <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600 dark:text-slate-400" />
                </div>
              </button>
            </div>

            {/* Middle: Home (Dashboard) button */}
            <div className="flex items-center justify-center mx-1 sm:mx-2 flex-shrink-0">
              <Link
                href="/dashboard"
                className={`tap-target flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 transition-all duration-200 touch-active no-select focus-visible-premium ${
                  pathname === "/dashboard"
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-contrast-medium active:text-contrast-high"
                }`}
                aria-label="Home"
              >
                <div className={`p-2 sm:p-2.5 rounded-xl transition-all duration-200 ${pathname === "/dashboard" ? "bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 shadow-premium-lg scale-105" : "active:bg-slate-100/80 dark:active:bg-slate-800/80"}`}>
                  <Home className={`w-5 h-5 sm:w-6 sm:h-6 ${pathname === "/dashboard" ? "text-white" : ""}`} />
                </div>
              </Link>
            </div>

            {/* Right side: Add button */}
            <div className="flex items-center justify-end flex-1 flex-shrink-0">
              <button
                onClick={() => setShowAddModal(true)}
                className="tap-target flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 transition-all duration-200 touch-active no-select active:scale-95"
                aria-label="Add new item"
              >
                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-premium-lg hover:shadow-glow-sm active:shadow-premium transition-all duration-200 hover:scale-105 active:scale-95">
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
              </button>
            </div>
          </div>
        </nav>
      </>
      )}

      {/* Desktop/Tablet Navigation - Sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-20 lg:w-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-r border-slate-200/60 dark:border-slate-700/60 z-50 shadow-premium-xl flex-col items-center lg:items-start py-6 px-4 lg:px-6 safe-top overflow-y-auto">
        <div className="w-full flex flex-col items-center lg:items-start gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`tap-target w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 touch-active no-select focus-visible-premium ${
                  isActive
                    ? "text-white bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 shadow-premium-lg scale-[1.02]"
                    : "text-contrast-medium hover:text-contrast-high hover:bg-slate-100/80 dark:hover:bg-slate-800/80 border border-transparent hover:border-slate-200/50 dark:hover:border-slate-700/50"
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
            onClick={() => {
              setShowAddModal(true);
            }}
            className="tap-target w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 text-white shadow-premium-lg hover:shadow-glow-sm transition-all duration-200 touch-active no-select focus-visible-premium active:scale-95 hover:scale-[1.02]"
            aria-label="Add new habit"
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <span className="hidden lg:block text-sm font-semibold tracking-tight">Add New</span>
          </button>
        </div>
      </nav>
      <AddModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        defaultTab="habit"
      />
    </>
  );
}
