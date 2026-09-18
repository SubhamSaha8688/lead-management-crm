import axios from "axios";

/**
 * In-memory client cache for CRM leads.
 * Deduplicates concurrent network requests across Dashboard, GlobalSearch, and useNotifications,
 * and caches results for 20 seconds to prevent unnecessary API & MongoDB load.
 */

let cachedLeads = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 20000; // 20 seconds
let activeFetchPromise = null;

export async function fetchLeadsWithCache(forceRefresh = false) {
  const now = Date.now();

  // Return cached data if valid and fresh
  if (!forceRefresh && cachedLeads && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedLeads;
  }

  // Deduplicate inflight network requests
  if (activeFetchPromise && !forceRefresh) {
    return activeFetchPromise;
  }

  activeFetchPromise = (async () => {
    try {
      const res = await axios.get("/api/leads");
      if (res.data && res.data.success && Array.isArray(res.data.data)) {
        cachedLeads = res.data.data;
        lastFetchTime = Date.now();
        return cachedLeads;
      }
      return cachedLeads || [];
    } catch (err) {
      if (cachedLeads) return cachedLeads;
      throw err;
    } finally {
      activeFetchPromise = null;
    }
  })();

  return activeFetchPromise;
}

export function invalidateLeadsCache() {
  cachedLeads = null;
  lastFetchTime = 0;
  activeFetchPromise = null;
}
