/**
 * Client-side caching utility using localStorage
 * Caches data with timestamps and provides automatic expiration
 */

const CACHE_PREFIX = "habit_cracker_cache_";
const DEFAULT_CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours max cache age

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Get cache key for a specific data type and optional filters
 */
function getCacheKey(type: string, filters?: Record<string, any>): string {
  const filterKey = filters ? JSON.stringify(filters) : "all";
  return `${CACHE_PREFIX}${type}_${filterKey}`;
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(entry: CacheEntry<any> | null): boolean {
  if (!entry) return false;
  const now = Date.now();
  return now < entry.expiresAt && (now - entry.timestamp) < MAX_CACHE_AGE;
}

/**
 * Get cached data if available and valid
 */
export function getCachedData<T>(type: string, filters?: Record<string, any>): T | null {
  if (typeof window === "undefined") return null;
  
  try {
    const cacheKey = getCacheKey(type, filters);
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) return null;
    
    const entry: CacheEntry<T> = JSON.parse(cached);
    
    if (isCacheValid(entry)) {
      return entry.data;
    } else {
      // Remove expired cache
      localStorage.removeItem(cacheKey);
      return null;
    }
  } catch (error) {
    console.error("Error reading cache:", error);
    return null;
  }
}

/**
 * Set cached data with expiration
 */
export function setCachedData<T>(
  type: string,
  data: T,
  filters?: Record<string, any>,
  duration: number = DEFAULT_CACHE_DURATION
): void {
  if (typeof window === "undefined") return;
  
  try {
    const cacheKey = getCacheKey(type, filters);
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + duration,
    };
    
    localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch (error) {
    console.error("Error setting cache:", error);
    // If storage is full, try to clear old cache entries
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      clearExpiredCache();
    }
  }
}

/**
 * Invalidate cache for a specific type (and optionally specific filters)
 */
export function invalidateCache(type: string, filters?: Record<string, any>): void {
  if (typeof window === "undefined") return;
  
  try {
    if (filters) {
      // Invalidate specific cache entry
      const cacheKey = getCacheKey(type, filters);
      localStorage.removeItem(cacheKey);
    } else {
      // Invalidate all cache entries for this type
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${CACHE_PREFIX}${type}_`)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
  } catch (error) {
    console.error("Error invalidating cache:", error);
  }
}

/**
 * Clear all expired cache entries
 */
export function clearExpiredCache(): void {
  if (typeof window === "undefined") return;
  
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const entry: CacheEntry<any> = JSON.parse(cached);
            if (!isCacheValid(entry)) {
              keysToRemove.push(key);
            }
          }
        } catch (e) {
          // Invalid entry, remove it
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.error("Error clearing expired cache:", error);
  }
}

/**
 * Clear all cache entries
 */
export function clearAllCache(): void {
  if (typeof window === "undefined") return;
  
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.error("Error clearing all cache:", error);
  }
}

/**
 * Fetch data with caching - returns cached data immediately if available,
 * then fetches fresh data in the background
 */
export async function fetchWithCache<T>(
  type: string,
  fetchFn: () => Promise<T>,
  filters?: Record<string, any>,
  duration: number = DEFAULT_CACHE_DURATION
): Promise<T> {
  // Try to get cached data first
  const cached = getCachedData<T>(type, filters);
  
  if (cached) {
    // Return cached data immediately, then refresh in background
    fetchFn()
      .then((freshData) => {
        setCachedData(type, freshData, filters, duration);
      })
      .catch((error) => {
        console.error(`Error refreshing cache for ${type}:`, error);
      });
    
    return cached;
  }
  
  // No cache available, fetch fresh data
  const freshData = await fetchFn();
  setCachedData(type, freshData, filters, duration);
  return freshData;
}

// Cache types
export const CACHE_TYPES = {
  IDEAS: "ideas",
  IDEAS_TREE: "ideas_tree",
  TOPICS: "topics",
  HABITS: "habits",
  CALENDAR_EVENTS: "calendar_events",
  HABITS_FOR_DATE: "habits_for_date",
} as const;

// Clean up expired cache on load
if (typeof window !== "undefined") {
  clearExpiredCache();
}
