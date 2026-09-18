import axios from "axios";

const CACHE_KEY = "lead_crm_cached_leads";
const CACHE_TIME_KEY = "lead_crm_cached_leads_timestamp";

/**
 * Synchronously retrieves cached leads from localStorage for instant 0ms rendering
 */
export function getCachedLeads() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Could not read cached leads from localStorage:", err);
  }
  return [];
}

/**
 * Persists fresh leads into localStorage
 */
export function setCachedLeads(leads) {
  try {
    if (Array.isArray(leads)) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(leads));
      localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    }
  } catch (err) {
    console.warn("Could not write leads cache to localStorage:", err);
  }
}

// In-flight request deduplicator to prevent simultaneous redundant HTTP calls
let inFlightLeadsPromise = null;

/**
 * Fetch leads with in-flight deduplication and automatic cache updating
 */
export async function fetchLeadsOptimized(forceFresh = false) {
  if (inFlightLeadsPromise && !forceFresh) {
    return inFlightLeadsPromise;
  }

  inFlightLeadsPromise = (async () => {
    try {
      const res = await axios.get("/api/leads");
      if (res.data && res.data.success && Array.isArray(res.data.data)) {
        setCachedLeads(res.data.data);
        return res.data.data;
      }
      return [];
    } finally {
      // Clear after 800ms so subsequent explicit user actions fetch fresh
      setTimeout(() => {
        inFlightLeadsPromise = null;
      }, 800);
    }
  })();

  return inFlightLeadsPromise;
}
