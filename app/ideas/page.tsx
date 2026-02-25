"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getIdeas, deleteIdea, getIdeasTree } from "@/app/actions/ideas";
import { getTopics } from "@/app/actions/topics";
import { getHabits } from "@/app/actions/habits";
import { Search, Filter, X, Trash2, Lightbulb, Star, BookOpen, List, Network } from "lucide-react";
import Navigation from "@/components/Navigation";
import AddModal from "@/components/AddModal";
import JournalPage from "@/components/JournalPage";
import IdeaTree from "@/components/IdeaTree";
import IdeaGraph from "@/components/IdeaGraph";
import { format } from "date-fns";
import { fetchWithCache, invalidateCache, CACHE_TYPES } from "@/lib/cache";

function IdeasPageContent() {
  const searchParams = useSearchParams();
  const [showJournal, setShowJournal] = useState(false);
  const [ideas, setIdeas] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [habits, setHabits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [selectedHabit, setSelectedHabit] = useState<string>("");
  const [selectedPriority, setSelectedPriority] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedIdeas, setExpandedIdeas] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "tree" | "graph">("list");
  const [treeData, setTreeData] = useState<any[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);

  useEffect(() => {
    loadData();
    // Check if journal query parameter is set
    if (searchParams?.get("journal") === "true") {
      setShowJournal(true);
    }
  }, [searchParams]);

  const loadIdeas = useCallback(async (forceReload = false) => {
    const filters: any = {};
    // If forceReload is true, don't apply filters (show all ideas)
    if (!forceReload) {
      if (searchQuery) filters.search = searchQuery;
      if (selectedTopic) filters.topicId = selectedTopic;
      if (selectedHabit) filters.habitId = selectedHabit;
      if (selectedPriority) filters.priority = selectedPriority;
    }

    // Use cache for faster loading
    const result = await fetchWithCache(
      CACHE_TYPES.IDEAS,
      async () => {
        const freshResult = await getIdeas(filters);
        return freshResult.success ? freshResult.ideas : [];
      },
      filters
    );
    
    setIdeas(result);
  }, [searchQuery, selectedTopic, selectedHabit, selectedPriority]);

  // Separate function to reload all ideas (used when creating new idea)
  const reloadAllIdeas = useCallback(async () => {
    // Invalidate cache and fetch fresh data
    invalidateCache(CACHE_TYPES.IDEAS);
    const result = await getIdeas({});
    if (result.success) {
      setIdeas(result.ideas);
    }
  }, []);

  useEffect(() => {
    loadIdeas();
  }, [loadIdeas]);

  useEffect(() => {
    if (viewMode === "tree" || viewMode === "graph") {
      loadTreeData();
    }
  }, [viewMode]);

  async function loadTreeData() {
    setLoadingTree(true);
    // Use cache for faster loading
    const result = await fetchWithCache(
      CACHE_TYPES.IDEAS_TREE,
      async () => {
        const freshResult = await getIdeasTree();
        return freshResult.success ? freshResult.tree : [];
      }
    );
    setTreeData(result);
    setLoadingTree(false);
  }

  async function loadData() {
    setLoading(true);
    
    // Use cache for faster initial load, then refresh in background
    const [ideasResult, topicsResult, habitsResult] = await Promise.all([
      fetchWithCache(
        CACHE_TYPES.IDEAS,
        async () => {
          const result = await getIdeas({});
          return result.success ? result.ideas : [];
        }
      ),
      fetchWithCache(
        CACHE_TYPES.TOPICS,
        async () => {
          const result = await getTopics();
          return result.success ? result.topics : [];
        }
      ),
      fetchWithCache(
        CACHE_TYPES.HABITS,
        async () => {
          const result = await getHabits();
          return result.success ? result.habits.filter((h: any) => h && h.name) : [];
        }
      ),
    ]);

    setIdeas(ideasResult);
    setTopics(topicsResult);
    setHabits(habitsResult);
    setLoading(false);
  }

  async function handleDelete(ideaId: string) {
    if (confirm("Are you sure you want to delete this idea?")) {
      const result = await deleteIdea(ideaId);
      if (result.success) {
        // Invalidate cache after deletion
        invalidateCache(CACHE_TYPES.IDEAS);
        invalidateCache(CACHE_TYPES.IDEAS_TREE);
        loadIdeas();
      }
    }
  }

  function toggleExpand(ideaId: string) {
    const newExpanded = new Set(expandedIdeas);
    if (newExpanded.has(ideaId)) {
      newExpanded.delete(ideaId);
    } else {
      newExpanded.add(ideaId);
    }
    setExpandedIdeas(newExpanded);
  }

  const filteredIdeas = ideas.filter((idea) => {
    if (searchQuery && !idea.text.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (selectedTopic && idea.topicId?.toString() !== selectedTopic) {
      return false;
    }
    if (selectedHabit && idea.habitId?.toString() !== selectedHabit) {
      return false;
    }
    if (selectedPriority && idea.priority !== selectedPriority) {
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 sm:pb-24 md:pb-6 md:pl-20 lg:pl-64 safe-bottom flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-200 dark:border-amber-800 border-t-amber-600 dark:border-t-amber-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading ideas...</p>
        </div>
      </div>
    );
  }

  if (showJournal) {
    return <JournalPage onBack={() => setShowJournal(false)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-44 sm:pb-32 md:pb-6 md:pl-20 lg:pl-64 safe-bottom">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6 md:mb-8">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent dark:from-amber-400 dark:to-orange-500 tracking-tight">
              Idea Vault
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm md:text-base mt-1 font-medium">Capture and organize your thoughts</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
            <button
              onClick={() => setShowJournal(true)}
              className="tap-target px-3 py-2 sm:px-4 md:px-5 sm:py-2 md:py-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg active:shadow-xl active:scale-95 transition-all duration-200 flex items-center gap-1.5 sm:gap-2 touch-active no-select text-xs sm:text-sm md:text-base font-semibold min-h-[44px]"
              aria-label="Open Journal"
            >
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="hidden sm:inline">Journal</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="tap-target w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg active:shadow-xl active:scale-95 transition-all duration-200 flex items-center justify-center touch-active no-select flex-shrink-0"
              aria-label="Add new idea"
            >
              <span className="text-xl sm:text-2xl md:text-3xl font-bold">+</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ideas..."
            className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-3.5 text-sm sm:text-base border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/90 dark:bg-slate-800/80 backdrop-blur-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 shadow-sm transition-all min-h-[48px]"
          />
        </div>

        {/* View Mode Toggle */}
        <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2">
          <div className="flex items-center gap-1 sm:gap-2 bg-slate-50/90 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-xl p-1 flex-1 sm:flex-initial">
            <button
              onClick={() => setViewMode("list")}
              className={`tap-target flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 min-h-[44px] ${
                viewMode === "list"
                  ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <List className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span>List</span>
            </button>
            <button
              onClick={() => setViewMode("tree")}
              className={`tap-target flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 min-h-[44px] ${
                viewMode === "tree"
                  ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <Network className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span>Tree</span>
            </button>
            <button
              onClick={() => setViewMode("graph")}
              className={`tap-target flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 min-h-[44px] ${
                viewMode === "graph"
                  ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <Network className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span>Graph</span>
            </button>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="tap-target flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50/90 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm md:text-base font-semibold text-slate-700 dark:text-slate-300 active:bg-slate-100 dark:active:bg-slate-800 transition-colors shadow-sm touch-active no-select min-h-[44px] hover:scale-[1.02] active:scale-[0.98]"
          >
            <Filter className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <span>Filters</span>
          </button>
        </div>

        {/* Filters */}
        <div className="mb-4">

          {showFilters && (
            <div className="mt-3 p-3 sm:p-4 md:p-5 bg-slate-50/90 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 sm:space-y-4 shadow-lg md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-4 md:space-y-0">
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Topic</label>
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="w-full px-3 py-2.5 sm:py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-700 rounded-lg bg-slate-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                >
                  <option value="">All topics</option>
                  {topics.map((topic) => (
                    <option key={topic._id} value={topic._id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Habit</label>
                <select
                  value={selectedHabit}
                  onChange={(e) => setSelectedHabit(e.target.value)}
                  className="w-full px-3 py-2.5 sm:py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-700 rounded-lg bg-slate-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                >
                  <option value="">All habits</option>
                  {habits.map((habit) => (
                    <option key={habit._id} value={habit._id}>
                      {habit.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Priority</label>
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="w-full px-3 py-2.5 sm:py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-700 rounded-lg bg-slate-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                >
                  <option value="">All priorities</option>
                  <option value="normal">Normal</option>
                  <option value="important">Important</option>
                </select>
              </div>
              {(selectedTopic || selectedHabit || selectedPriority) && (
                <button
                  onClick={() => {
                    setSelectedTopic("");
                    setSelectedHabit("");
                    setSelectedPriority("");
                  }}
                  className="w-full md:col-span-2 lg:col-span-4 py-2.5 sm:py-2 px-4 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 active:scale-95 transition-transform min-h-[44px] touch-active"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Ideas Display */}
        {viewMode === "tree" ? (
          loadingTree ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 border-4 border-amber-200 dark:border-amber-800 border-t-amber-600 dark:border-t-amber-400 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-600 dark:text-slate-400 font-medium">Loading tree...</p>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 border border-slate-200 dark:border-slate-700 overflow-x-auto overflow-y-visible max-w-full mb-24 sm:mb-20 md:mb-4">
              <div className="min-w-0">
                <IdeaTree ideas={treeData} onIdeaClick={(ideaId) => {
                  // Visual feedback is handled by IdeaTree component's selectedNodeId state
                  // Clicking a node highlights it and allows navigation between related ideas
                }} />
              </div>
            </div>
          )
        ) : viewMode === "graph" ? (
          loadingTree ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 border-4 border-amber-200 dark:border-amber-800 border-t-amber-600 dark:border-t-amber-400 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-600 dark:text-slate-400 font-medium">Loading graph...</p>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl sm:rounded-2xl p-2 sm:p-4 md:p-6 border border-slate-200 dark:border-slate-700 overflow-hidden mb-24 sm:mb-20 md:mb-4">
              <IdeaGraph ideas={treeData} onIdeaClick={(ideaId) => {
                // Visual feedback is handled by IdeaGraph component's selectedNodeId state
              }} />
            </div>
          )
        ) : filteredIdeas.length === 0 ? (
          <div className="text-center py-16 pb-24 sm:pb-20 md:pb-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center">
              <Lightbulb className="w-10 h-10 text-amber-500 dark:text-amber-400" />
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-6 font-medium">
              {searchQuery || selectedTopic || selectedHabit || selectedPriority
                ? "No ideas match your filters"
                : "No ideas yet"}
            </p>
            {!searchQuery && !selectedTopic && !selectedHabit && !selectedPriority && (
              <button
                onClick={() => setShowAddModal(true)}
                className="tap-target px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold shadow-lg active:shadow-xl active:scale-95 transition-all duration-200 touch-active no-select min-h-[48px]"
              >
                Capture your first idea
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 pb-40 sm:pb-28 md:pb-4">
            {filteredIdeas.map((idea) => {
              const isExpanded = expandedIdeas.has(idea._id);
              return (
                <div
                  key={idea._id}
                  className={`group relative overflow-hidden bg-slate-50 dark:bg-slate-800 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 lg:p-7 shadow-premium-lg border-l-4 hover:shadow-premium-xl hover:scale-[1.02] transition-all duration-300 h-full flex flex-col ${
                    idea.priority === "important"
                      ? "border-amber-500"
                      : "border-indigo-500"
                  }`}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-400/0 to-purple-400/0 dark:from-indigo-400/0 dark:to-purple-400/0 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="relative z-10">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      {idea.priority === "important" && (
                        <div className="flex items-center gap-2 mb-2">
                          <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Important</span>
                        </div>
                      )}
                      <p
                        className={`text-slate-900 dark:text-slate-100 font-semibold text-sm sm:text-base md:text-lg leading-relaxed ${
                          isExpanded ? "" : "line-clamp-2"
                        }`}
                      >
                        {idea.text}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(idea._id)}
                      className="ml-2 sm:ml-3 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors touch-active min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
                      aria-label="Delete idea"
                    >
                      <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-auto pt-4">
                    <div className="flex flex-wrap gap-2 flex-1">
                      {idea.habitId && (
                        <span className="text-xs px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-medium">
                          🔗 {habits.find((h) => h._id === idea.habitId)?.name || "Habit"}
                        </span>
                      )}
                      {idea.tags && idea.tags.length > 0 && (
                        <>
                          {idea.tags.map((tag: string, idx: number) => (
                            <span
                              key={idx}
                              className="text-xs px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full font-medium"
                            >
                              {tag}
                            </span>
                          ))}
                        </>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium ml-2 flex-shrink-0">
                      {format(new Date(idea.createdAt), "MMM d")}
                    </span>
                  </div>

                  {idea.text.length > 100 && (
                    <button
                      onClick={() => toggleExpand(idea._id)}
                      className="mt-3 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors relative z-10"
                    >
                      {isExpanded ? "Show less" : "Show more →"}
                    </button>
                  )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddModal 
        isOpen={showAddModal} 
        onClose={() => {
          setShowAddModal(false);
          if (viewMode === "tree") {
            loadTreeData();
          }
        }} 
        defaultTab="idea"
        onIdeaCreated={async () => {
          // Invalidate cache after creating new idea
          invalidateCache(CACHE_TYPES.IDEAS);
          invalidateCache(CACHE_TYPES.IDEAS_TREE);
          // Reload all ideas without filters to show the new idea immediately
          await reloadAllIdeas();
          // Also reload tree/graph data if in those views
          if (viewMode === "tree" || viewMode === "graph") {
            loadTreeData();
          }
        }}
      />
      <Navigation />
    </div>
  );
}

export default function IdeasPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 sm:pb-24 md:pb-6 md:pl-20 lg:pl-64 safe-bottom flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-200 dark:border-amber-800 border-t-amber-600 dark:border-t-amber-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading ideas...</p>
        </div>
      </div>
    }>
      <IdeasPageContent />
    </Suspense>
  );
}
