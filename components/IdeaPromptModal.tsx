"use client";

import { useState } from "react";
import { X, Lightbulb } from "lucide-react";
import { createIdea } from "@/app/actions/ideas";
import { useRouter } from "next/navigation";
import { invalidateCache, CACHE_TYPES } from "@/lib/cache";

interface IdeaPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  habitId: string;
  habitName: string;
}

export default function IdeaPromptModal({
  isOpen,
  onClose,
  habitId,
  habitName,
}: IdeaPromptModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ideaText, setIdeaText] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.append("text", ideaText);
    formData.append("habitId", habitId);
    formData.append("priority", "normal");

    const result = await createIdea(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      // Invalidate cache after creating idea
      invalidateCache(CACHE_TYPES.IDEAS);
      invalidateCache(CACHE_TYPES.IDEAS_TREE);
      invalidateCache(CACHE_TYPES.TOPICS); // Topics might be created/updated
      
      router.refresh();
      onClose();
      setIdeaText("");
      setLoading(false);
    }
  }

  function handleSkip() {
    onClose();
    setIdeaText("");
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md md:max-w-lg bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl md:rounded-3xl shadow-2xl border border-slate-200/50 dark:border-slate-800/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 md:p-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-6 h-6 md:w-7 md:h-7 text-amber-500 dark:text-amber-400" />
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">Capture an Idea</h2>
            </div>
            <button
              onClick={handleSkip}
              className="tap-target p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors touch-active"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </button>
          </div>

          <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-4 font-medium">
            You completed <span className="font-semibold text-indigo-600 dark:text-indigo-400">{habitName}</span>. Any thoughts or ideas?
          </p>

          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-medium shadow-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              value={ideaText}
              onChange={(e) => setIdeaText(e.target.value)}
              autoFocus
              rows={4}
              className="w-full px-4 py-3 md:py-4 text-base border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 backdrop-blur-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
              placeholder="What's on your mind?"
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSkip}
                className="tap-target flex-1 py-3 md:py-3.5 px-4 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors touch-active no-select min-h-[48px]"
              >
                Skip
              </button>
              <button
                type="submit"
                disabled={loading || !ideaText.trim()}
                className="tap-target flex-1 py-3 md:py-3.5 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg active:shadow-xl active:scale-[0.98] touch-active no-select min-h-[48px]"
              >
                {loading ? "Saving..." : "Save Idea"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
