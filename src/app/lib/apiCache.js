import axios from "axios";

// In-memory cache store
const memoryCache = new Map();
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function fetchWithCache(url, ttlMs = DEFAULT_TTL_MS) {
  const now = Date.now();
  const cached = memoryCache.get(url);

  if (cached && now - cached.timestamp < ttlMs) {
    return cached.data;
  }

  try {
    const { data } = await axios.get(url, { timeout: 8000 });
    memoryCache.set(url, {
      timestamp: now,
      data: data
    });
    return data;
  } catch (err) {
    // If request fails but stale cache exists, return stale cache gracefully
    if (cached) {
      console.warn(`[apiCache] Fetch failed for ${url}, returning stale cache.`);
      return cached.data;
    }
    throw err;
  }
}
