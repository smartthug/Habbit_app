"use client";

import { useState, useEffect, useRef } from "react";
import { createJournal, getTodayJournalCount, checkJournalRequirement, getRequiredJournalCategories } from "@/app/actions/journal";
import { Mic, MicOff, BookOpen, CheckCircle2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface JournalPageProps {
  onBack: () => void;
}

export default function JournalPage({ onBack }: JournalPageProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [journalCount, setJournalCount] = useState<number>(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [journalRequirement, setJournalRequirement] = useState<any>(null);
  const [requiredCategories, setRequiredCategories] = useState<string[]>([]);
  
  // Form state
  const [whatWorkedText, setWhatWorkedText] = useState("");
  const [whatWastedTimeText, setWhatWastedTimeText] = useState("");
  const [whereMoneyGeneratedAnswer, setWhereMoneyGeneratedAnswer] = useState<"yes" | "no" | "">("");
  const [whereMoneyGeneratedText, setWhereMoneyGeneratedText] = useState("");
  const [whereLostEnergy, setWhereLostEnergy] = useState("");
  const [howYouFeel, setHowYouFeel] = useState<"sad" | "neutral" | "good" | "">("");

  // Voice recognition state
  const [isListening, setIsListening] = useState<string | null>(null);
  const recognitionRefs = useRef<{ [key: string]: any }>({});

  useEffect(() => {
    loadJournalCount();
    loadJournalRequirement();
    loadRequiredCategories();
    initializeSpeechRecognition();
  }, []);

  async function loadJournalCount() {
    const result = await getTodayJournalCount();
    if (result.success) {
      setJournalCount(result.count);
    }
  }

  async function loadJournalRequirement() {
    const result = await checkJournalRequirement();
    if (result.success) {
      setJournalRequirement(result);
    }
  }

  async function loadRequiredCategories() {
    const result = await getRequiredJournalCategories();
    if (result.success && result.requiredCategories) {
      setRequiredCategories(result.requiredCategories);
    }
  }




  function initializeSpeechRecognition() {
    if (typeof window === "undefined") return;

    // Check for browser support
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported");
      return;
    }

    // Initialize recognition for each field
    const fields = ["whatWorked", "whatWastedTime", "whereMoneyGenerated", "whereLostEnergy"];
    fields.forEach((field) => {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          handleVoiceResult(field, transcript);
          setIsListening(null);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          if (event.error === "not-allowed") {
            alert("Microphone permission denied. Please allow microphone access and try again.");
          }
          setIsListening(null);
        };

        recognition.onend = () => {
          setIsListening(null);
        };

        recognitionRefs.current[field] = recognition;
      } catch (error) {
        console.error(`Error initializing recognition for ${field}:`, error);
      }
    });
  }

  function handleVoiceResult(field: string, transcript: string) {
    switch (field) {
      case "whatWorked":
        setWhatWorkedText((prev) => prev + (prev ? " " : "") + transcript);
        break;
      case "whatWastedTime":
        setWhatWastedTimeText((prev) => prev + (prev ? " " : "") + transcript);
        break;
      case "whereMoneyGenerated":
        setWhereMoneyGeneratedText((prev) => prev + (prev ? " " : "") + transcript);
        break;
      case "whereLostEnergy":
        setWhereLostEnergy((prev) => prev + (prev ? " " : "") + transcript);
        break;
    }
  }

  function startListening(field: string) {
    if (typeof window === "undefined") return;

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (!recognitionRefs.current[field]) {
      // Try to initialize on the fly
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          handleVoiceResult(field, transcript);
          setIsListening(null);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          if (event.error === "not-allowed") {
            alert("Microphone permission denied. Please allow microphone access in your browser settings.");
          } else if (event.error === "no-speech") {
            alert("No speech detected. Please try again.");
          }
          setIsListening(null);
        };

        recognition.onend = () => {
          setIsListening(null);
        };

        recognitionRefs.current[field] = recognition;
      } catch (error) {
        console.error("Error creating recognition:", error);
        alert("Failed to initialize speech recognition. Please refresh the page.");
        return;
      }
    }

    try {
      // Stop any other active recognition
      Object.keys(recognitionRefs.current).forEach((key) => {
        if (key !== field && isListening === key) {
          try {
            recognitionRefs.current[key].stop();
          } catch (e) {
            // Ignore
          }
        }
      });
      
      recognitionRefs.current[field].start();
      setIsListening(field);
    } catch (error: any) {
      console.error("Error starting recognition:", error);
      if (error.message && error.message.includes("already started")) {
        // Recognition already running, just update state
        setIsListening(field);
      } else {
        alert("Failed to start voice input. Please try again.");
        setIsListening(null);
      }
    }
  }

  function stopListening() {
    Object.values(recognitionRefs.current).forEach((recognition: any) => {
      try {
        recognition.stop();
      } catch (error) {
        // Ignore errors when stopping
      }
    });
    setIsListening(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    // Check time restriction
    // Only question 3 requires Yes/No answer
    if (!whereMoneyGeneratedAnswer) {
      setError("Please answer the 'Where was money generated?' question with Yes or No");
      return;
    }

    if (!selectedCategory) {
      setError("Please select a category");
      return;
    }

    // Check if selected category is in required categories (if requirements exist)
    if (requiredCategories.length > 0 && !requiredCategories.includes(selectedCategory)) {
      setError(`Please select one of the required categories: ${requiredCategories.join(", ")}`);
      return;
    }

    // Validate required fields
    if (!whatWorkedText || !whatWastedTimeText || !whereLostEnergy) {
      setError("Please provide answers for all required questions");
      return;
    }

    // If money generated answer is "yes", text is required
    if (whereMoneyGeneratedAnswer === "yes" && !whereMoneyGeneratedText.trim()) {
      setError("Please provide details about where money was generated");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.set("category", selectedCategory);
    // Questions 1 and 2 don't have Yes/No, so we set "no" as default (or update model to make it optional)
    formData.set("whatWorkedAnswer", "no");
    formData.set("whatWorkedText", whatWorkedText);
    formData.set("whatWastedTimeAnswer", "no");
    formData.set("whatWastedTimeText", whatWastedTimeText);
    formData.set("whereMoneyGeneratedAnswer", whereMoneyGeneratedAnswer);
    if (whereMoneyGeneratedText) {
      formData.set("whereMoneyGeneratedText", whereMoneyGeneratedText);
    }
    formData.set("whereLostEnergy", whereLostEnergy);
    if (howYouFeel) {
      formData.set("howYouFeel", howYouFeel);
    }

    const result = await createJournal(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      // Refresh journal count and requirement
      const countResult = await getTodayJournalCount();
      const newCount = countResult.success ? countResult.count : journalCount + 1;
      setJournalCount(newCount);
      
      // Reload requirement to check if all categories are completed
      await loadJournalRequirement();
      router.refresh();
      
      // Reset form for next entry
      setSelectedCategory("");
      setWhatWorkedText("");
      setWhatWastedTimeText("");
      setWhereMoneyGeneratedAnswer("");
      setWhereMoneyGeneratedText("");
      setWhereLostEnergy("");
      setHowYouFeel("");
      setLoading(false);
      
      // Show success message
      setShowSuccess(true);
      
      // If all required categories are completed, allow navigation
      const updatedRequirement = await checkJournalRequirement();
      if (updatedRequirement.success && (!updatedRequirement.isRequired || updatedRequirement.isComplete)) {
        // User can now navigate - show success and redirect to dashboard
        setTimeout(() => {
          setShowSuccess(false);
          router.push("/dashboard");
        }, 2000);
      } else {
        // Just show success, stay on page
        setTimeout(() => {
          setShowSuccess(false);
        }, 2000);
      }
    }
  }

  function VoiceInputButton({ field, label }: { field: string; label: string }) {
    const isActive = isListening === field;
    return (
      <button
        type="button"
        onClick={() => {
          if (isActive) {
            stopListening();
          } else {
            startListening(field);
          }
        }}
        className={`tap-target flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
          isActive
            ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
            : "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
        }`}
      >
        {isActive ? (
          <>
            <MicOff className="w-4 h-4" />
            <span>Stop</span>
          </>
        ) : (
          <>
            <Mic className="w-4 h-4" />
            <span>{label}</span>
          </>
        )}
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 sm:pb-20 md:pb-6 md:pl-20 lg:pl-64 safe-bottom">
      <div className="max-w-md md:max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <button
            onClick={onBack}
            className="tap-target mb-4 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium flex items-center gap-2"
          >
            ← Back to Ideas
          </button>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400">
                  Journaling
                </h1>
                <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base mt-1">Reflect on your day</p>
              </div>
            </div>
            <div className="text-right w-full sm:w-auto">
              {journalRequirement?.isRequired ? (
                <div>
                  <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400">
                    {journalRequirement.completedCategories?.length || 0}/{journalRequirement.requiredCategories?.length || 0}
                  </div>
                  <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mb-2">Categories</p>
                  {/* Progress Bar */}
                  <div className="w-20 md:w-24 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500"
                      style={{ 
                        width: `${((journalRequirement.completedCategories?.length || 0) / (journalRequirement.requiredCategories?.length || 1)) * 100}%` 
                      }}
                    ></div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400">
                    {journalCount}
                  </div>
                  <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400">Entries Today</p>
                </>
              )}
            </div>
          </div>

          {/* Category Requirement Progress with Visual Progress Bar */}
          {journalRequirement?.isRequired && !journalRequirement?.isComplete && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                      Complete journal entries to unlock full access
                    </p>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      {journalRequirement.completedCategories?.length || 0}/{journalRequirement.requiredCategories?.length || 0}
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-amber-100 dark:bg-amber-900/30 rounded-full h-2.5 mb-3 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                      style={{ 
                        width: `${((journalRequirement.completedCategories?.length || 0) / (journalRequirement.requiredCategories?.length || 1)) * 100}%` 
                      }}
                    >
                      <div className="h-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-amber-700 dark:text-amber-400">
                    <div>
                      <span className="font-semibold">Required:</span> {journalRequirement.requiredCategories?.join(", ") || "None"}
                    </div>
                    {journalRequirement.missingCategories?.length > 0 && (
                      <div>
                        <span className="font-semibold">Missing:</span> {journalRequirement.missingCategories.join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* No Habits Message */}
          {journalRequirement?.success && !journalRequirement?.isRequired && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-4">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                No journal restrictions. You can create journal entries for any category.
              </p>
            </div>
          )}
        </div>

        {/* Success Message */}
        {showSuccess && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-xl text-sm font-medium mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <span>
              {journalRequirement?.isRequired
                ? "Great! You've completed all required journal entries. Navigation is now unlocked!"
                : "Journal entry saved successfully!"}
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          {/* Category Selection */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 sm:p-6 shadow-premium-lg border border-slate-200/50 dark:border-slate-700/50">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Category *
              {requiredCategories.length > 0 && (
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                  (Required: {requiredCategories.join(", ")})
                </span>
              )}
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
            >
              <option value="">Select a category</option>
              {(() => {
                const categoriesToShow = requiredCategories.length > 0 ? requiredCategories : ["personal", "workBlock", "productive", "familyTime"];
                
                const categoryLabels: { [key: string]: string } = {
                  personal: "Personal Work",
                  workBlock: "Work Block",
                  productive: "Productivity",
                  familyTime: "Family Time",
                };
                
                return categoriesToShow.map((cat) => (
                  <option key={cat} value={cat}>
                    {categoryLabels[cat] || cat}
                  </option>
                ));
              })()}
            </select>
            {requiredCategories.length > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Only categories matching your habits are shown. Complete entries for all required categories.
              </p>
            )}
          </div>

          {/* Question 1: What worked? */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 sm:p-6 shadow-premium-lg border border-slate-200/50 dark:border-slate-700/50">
            <label className="block text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
              1. What worked? *
            </label>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Answer</label>
                <VoiceInputButton field="whatWorked" label="Voice Input" />
              </div>
              <textarea
                value={whatWorkedText}
                onChange={(e) => setWhatWorkedText(e.target.value)}
                required
                rows={3}
                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 resize-none"
                placeholder="Describe what worked..."
              />
            </div>
          </div>

          {/* Question 2: What wasted my time? */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 sm:p-6 shadow-premium-lg border border-slate-200/50 dark:border-slate-700/50">
            <label className="block text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
              2. What wasted my time? *
            </label>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Answer</label>
                <VoiceInputButton field="whatWastedTime" label="Voice Input" />
              </div>
              <textarea
                value={whatWastedTimeText}
                onChange={(e) => setWhatWastedTimeText(e.target.value)}
                required
                rows={3}
                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 resize-none"
                placeholder="Describe what wasted your time..."
              />
            </div>
          </div>

          {/* Question 3: Where was money generated? */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 sm:p-6 shadow-premium-lg border border-slate-200/50 dark:border-slate-700/50">
            <label className="block text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
              3. Where was money generated? *
            </label>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="whereMoneyGenerated"
                    value="yes"
                    checked={whereMoneyGeneratedAnswer === "yes"}
                    onChange={(e) => setWhereMoneyGeneratedAnswer(e.target.value as "yes" | "no")}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                    required
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="whereMoneyGenerated"
                    value="no"
                    checked={whereMoneyGeneratedAnswer === "no"}
                    onChange={(e) => setWhereMoneyGeneratedAnswer(e.target.value as "yes" | "no")}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                    required
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">No</span>
                </label>
              </div>
              {whereMoneyGeneratedAnswer === "yes" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Answer *</label>
                    <VoiceInputButton field="whereMoneyGenerated" label="Voice Input" />
                  </div>
                  <textarea
                    value={whereMoneyGeneratedText}
                    onChange={(e) => setWhereMoneyGeneratedText(e.target.value)}
                    required
                    rows={3}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 resize-none"
                    placeholder="Describe where money was generated..."
                  />
                </div>
              )}
            </div>
          </div>

          {/* Question 4: Where did I lose energy? */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 sm:p-6 shadow-premium-lg border border-slate-200/50 dark:border-slate-700/50">
            <label className="block text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
              4. Where did I lose energy? *
            </label>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Answer</label>
                <VoiceInputButton field="whereLostEnergy" label="Voice Input" />
              </div>
              <textarea
                value={whereLostEnergy}
                onChange={(e) => setWhereLostEnergy(e.target.value)}
                required
                rows={4}
                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 resize-none"
                placeholder="Describe where you lost energy..."
              />
            </div>
          </div>

          {/* Question 5: How you feel */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 shadow-premium-lg border border-slate-200/50 dark:border-slate-700/50">
            <label className="block text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
              5. How you feel?
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setHowYouFeel("sad")}
                className={`tap-target flex-1 flex flex-col items-center justify-center gap-2 px-4 py-4 rounded-xl font-semibold transition-all ${
                  howYouFeel === "sad"
                    ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-2 border-red-300 dark:border-red-700"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-2 border-transparent hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                <span className="text-3xl">😢</span>
                <span className="text-sm">Sad</span>
              </button>
              <button
                type="button"
                onClick={() => setHowYouFeel("neutral")}
                className={`tap-target flex-1 flex flex-col items-center justify-center gap-2 px-4 py-4 rounded-xl font-semibold transition-all ${
                  howYouFeel === "neutral"
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-2 border-amber-300 dark:border-amber-700"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-2 border-transparent hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                <span className="text-3xl">😐</span>
                <span className="text-sm">Neutral</span>
              </button>
              <button
                type="button"
                onClick={() => setHowYouFeel("good")}
                className={`tap-target flex-1 flex flex-col items-center justify-center gap-2 px-4 py-4 rounded-xl font-semibold transition-all ${
                  howYouFeel === "good"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-2 border-green-300 dark:border-green-700"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-2 border-transparent hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                <span className="text-3xl">😊</span>
                <span className="text-sm">Good</span>
              </button>
            </div>
          </div>

          {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="tap-target w-full py-4 px-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[52px] flex items-center justify-center gap-2"
                  >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Save Journal Entry</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
