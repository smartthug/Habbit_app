"use client";

import { useState, useEffect } from "react";

interface TimeAllocation {
  personalWork?: { startTime?: string; endTime?: string; totalHours?: number; minAllocation?: number };
  workBlock?: { startTime?: string; endTime?: string; totalHours?: number; minAllocation?: number };
  productive?: { startTime?: string; endTime?: string; totalHours?: number; minAllocation?: number };
  familyTime?: { startTime?: string; endTime?: string; totalHours?: number; minAllocation?: number };
  journaling?: { startTime?: string; endTime?: string; totalHours?: number };
}

interface DynamicQuoteProps {
  timeAllocation: TimeAllocation | null;
}

// Quote collections for each category
const QUOTES = {
  personalWork: [
    "Invest in yourself. It pays the best interest.",
    "Self-care is not selfish. It's essential.",
    "The best investment you can make is in yourself.",
    "Growth begins at the end of your comfort zone.",
    "Take time to do what makes your soul happy.",
    "Your personal development is your greatest asset.",
    "Self-discipline is the bridge between goals and accomplishment.",
    "The only person you should try to be better than is the person you were yesterday.",
  ],
  workBlock: [
    "Deep focus today creates freedom tomorrow.",
    "Productivity is not about being busy, it's about being effective.",
    "The way to get started is to quit talking and begin doing.",
    "Focus on being productive, not busy.",
    "Work hard in silence, let success make the noise.",
    "Excellence is not a skill, it's an attitude.",
    "The future depends on what you do today.",
    "Success is the sum of small efforts repeated day in and day out.",
  ],
  productive: [
    "Action is the foundational key to all success.",
    "Efficiency is doing things right; effectiveness is doing the right things.",
    "Productivity is never an accident. It is always the result of commitment to excellence.",
    "The secret of getting ahead is getting started.",
    "Don't watch the clock; do what it does. Keep going.",
    "Productivity is about making smart choices, not just working harder.",
    "Do something today that your future self will thank you for.",
    "The way to get started is to quit talking and begin doing.",
  ],
  familyTime: [
    "Success means nothing if you have no one to share it with.",
    "Family is not an important thing, it's everything.",
    "The love of a family is life's greatest blessing.",
    "In family life, love is the oil that eases friction, the cement that binds closer together.",
    "Family: where life begins and love never ends.",
    "The memories we make with our family is everything.",
    "Family is the heart of a home.",
    "Time spent with family is worth every second.",
  ],
  journal: [
    "Reflect daily. Growth follows awareness.",
    "Journaling is a way to talk to yourself and discover who you are.",
    "Writing is thinking on paper.",
    "The act of writing is the act of discovering what you believe.",
    "Journaling is like whispering to one's self and listening at the same time.",
    "Write it down. Make it happen.",
    "Your journal is your private space for self-discovery.",
    "Reflection is the key to growth and understanding.",
  ],
  default: [
    "Every day is a fresh start.",
    "Make today amazing!",
    "You are capable of amazing things.",
    "Believe you can and you're halfway there.",
    "The only way to do great work is to love what you do.",
    "Your limitation—it's only your imagination.",
    "Push yourself, because no one else is going to do it for you.",
    "Great things never come from comfort zones.",
  ],
};

// Helper function to convert time string (HH:MM) to minutes
function timeToMinutes(time: string): number {
  if (!time) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Helper function to check if current time falls within a time range
function isTimeInRange(
  currentMinutes: number,
  startTime: string,
  endTime: string
): boolean {
  if (!startTime || !endTime) return false;
  
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  
  // Handle case where time range wraps around midnight (e.g., 23:00 to 01:00)
  if (end < start) {
    return currentMinutes >= start || currentMinutes < end;
  }
  
  return currentMinutes >= start && currentMinutes < end;
}

// Determine which time slot the current time falls into
function getCurrentTimeSlot(
  currentTime: Date,
  timeAllocation: TimeAllocation | null
): keyof typeof QUOTES {
  if (!timeAllocation) return "default";
  
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  
  // Check each time slot in priority order
  // Journal time is usually shorter, so check it first
  if (
    timeAllocation.journaling?.startTime &&
    timeAllocation.journaling?.endTime &&
    isTimeInRange(
      currentMinutes,
      timeAllocation.journaling.startTime,
      timeAllocation.journaling.endTime
    )
  ) {
    return "journal";
  }
  
  if (
    timeAllocation.personalWork?.startTime &&
    timeAllocation.personalWork?.endTime &&
    isTimeInRange(
      currentMinutes,
      timeAllocation.personalWork.startTime,
      timeAllocation.personalWork.endTime
    )
  ) {
    return "personalWork";
  }
  
  if (
    timeAllocation.workBlock?.startTime &&
    timeAllocation.workBlock?.endTime &&
    isTimeInRange(
      currentMinutes,
      timeAllocation.workBlock.startTime,
      timeAllocation.workBlock.endTime
    )
  ) {
    return "workBlock";
  }
  
  if (
    timeAllocation.productive?.startTime &&
    timeAllocation.productive?.endTime &&
    isTimeInRange(
      currentMinutes,
      timeAllocation.productive.startTime,
      timeAllocation.productive.endTime
    )
  ) {
    return "productive";
  }
  
  if (
    timeAllocation.familyTime?.startTime &&
    timeAllocation.familyTime?.endTime &&
    isTimeInRange(
      currentMinutes,
      timeAllocation.familyTime.startTime,
      timeAllocation.familyTime.endTime
    )
  ) {
    return "familyTime";
  }
  
  return "default";
}

// Get a random quote from a category
function getRandomQuote(category: keyof typeof QUOTES): string {
  const quotes = QUOTES[category];
  return quotes[Math.floor(Math.random() * quotes.length)];
}

export default function DynamicQuote({ timeAllocation }: DynamicQuoteProps) {
  const [currentQuote, setCurrentQuote] = useState<string>("");
  const [currentCategory, setCurrentCategory] = useState<string>("");

  useEffect(() => {
    // Function to update quote based on current time
    const updateQuote = () => {
      const now = new Date();
      const timeSlot = getCurrentTimeSlot(now, timeAllocation);
      const quote = getRandomQuote(timeSlot);
      
      setCurrentQuote(quote);
      setCurrentCategory(timeSlot);
    };

    // Update immediately
    updateQuote();

    // Update every minute to check if time slot changed
    const interval = setInterval(updateQuote, 60000); // 60 seconds

    // Also update quote every 5 minutes to get a fresh quote (optional)
    const quoteRefreshInterval = setInterval(() => {
      const now = new Date();
      const timeSlot = getCurrentTimeSlot(now, timeAllocation);
      setCurrentQuote(getRandomQuote(timeSlot));
    }, 300000); // 5 minutes

    return () => {
      clearInterval(interval);
      clearInterval(quoteRefreshInterval);
    };
  }, [timeAllocation]);

  if (!currentQuote) {
    return null;
  }

  // Category display names
  const categoryNames: Record<string, string> = {
    personalWork: "Personal Time",
    workBlock: "Work Block",
    productive: "Productivity",
    familyTime: "Family Time",
    journal: "Journal",
    default: "General",
  };

  return (
    <div className="mt-4 md:mt-6">
      <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/30 dark:via-purple-950/30 dark:to-pink-950/30 rounded-2xl p-6 md:p-8 border border-indigo-200/50 dark:border-indigo-800/50 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <div className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse"></div>
          </div>
          <div className="flex-1">
            {currentCategory !== "default" && (
              <p className="text-xs md:text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-2 uppercase tracking-wide">
                {categoryNames[currentCategory] || currentCategory}
              </p>
            )}
            <p className="text-base md:text-lg lg:text-xl font-medium text-slate-800 dark:text-slate-200 leading-relaxed italic">
              &ldquo;{currentQuote}&rdquo;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
