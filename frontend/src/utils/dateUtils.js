/**
 * Consolidated Date & Time Utilities for Lead Management CRM
 * Centralizes toDateKey, formatDateDisplay, formatTime12, getFollowUpDateTime,
 * getFollowUpStatus, and cleanPhone across Dashboard, Calendar, LeadDetail, and Notifications.
 */

/**
 * Converts a Date object, ISO string, or timestamp to 'YYYY-MM-DD' key
 * @param {Date|string|number} d
 * @returns {string}
 */
export function toDateKey(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Checks if a given date corresponds to today
 * @param {Date|string|number} dateVal
 * @returns {boolean}
 */
export function isTodayDate(dateVal) {
  if (!dateVal) return false;
  return toDateKey(dateVal) === toDateKey(new Date());
}

/**
 * Formats a date value to 'DD MMM YYYY' (e.g. '18 Sep 2026')
 * @param {Date|string|number} dateVal
 * @returns {string}
 */
export function formatDateDisplay(dateVal) {
  if (!dateVal) return "—";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

/**
 * Formats a date & time value to 'DD MMM YYYY, hh:mm AM/PM'
 * @param {Date|string|number} dateVal
 * @returns {string}
 */
export function formatDateTimeDisplay(dateVal) {
  if (!dateVal) return "—";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

/**
 * Formats a numeric currency value to Indian Rupee symbol & commas
 * @param {number|string} amount
 * @returns {string}
 */
export function formatRupees(amount) {
  return "₹" + Number(amount || 0).toLocaleString("en-IN");
}

/**
 * Converts 24-hour 'HH:mm' time string into 12-hour 'h:mm AM/PM'
 * @param {string} timeStr
 * @returns {string}
 */
export function formatTime12(timeStr) {
  if (!timeStr) return "";
  const parts = String(timeStr).split(":");
  if (parts.length < 2) return timeStr;
  const hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? "PM" : "AM";
  const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${formattedHours}:${minutes} ${ampm}`;
}

/**
 * Builds a local JavaScript Date object combining a lead's followUpDate and followUpTime.
 * @param {Object} lead
 * @returns {Date|null}
 */
export function getFollowUpDateTime(lead) {
  if (!lead || !lead.followUpDate) return null;
  const base = new Date(lead.followUpDate);
  if (isNaN(base.getTime())) return null;

  let h = 0;
  let m = 0;
  if (lead.followUpTime && String(lead.followUpTime).includes(":")) {
    const parts = String(lead.followUpTime).split(":");
    h = parseInt(parts[0], 10) || 0;
    m = parseInt(parts[1], 10) || 0;
  }

  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
}

/**
 * Calculates whether a lead's follow-up is OVERDUE, DUE SOON (within 15 min), or UPCOMING.
 * @param {Object} lead
 * @returns {{ type: 'overdue'|'duesoon'|'upcoming', label: string, color: string } | null}
 */
export function getFollowUpStatus(lead) {
  if (!lead || !lead.followUpDate) return null;
  const dt = getFollowUpDateTime(lead);
  if (!dt) return null;

  const now = new Date();
  const diffMs = dt.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMs < 0) {
    return { type: "overdue", label: "OVERDUE", color: "var(--danger)" };
  } else if (diffMinutes <= 15) {
    return { type: "duesoon", label: "DUE SOON", color: "var(--warn)" };
  } else {
    return { type: "upcoming", label: "UPCOMING", color: "var(--success)" };
  }
}

/**
 * Strips all non-digit characters from a phone number string
 * @param {string} phone
 * @returns {string}
 */
export function cleanPhone(phone) {
  if (!phone) return "";
  return String(phone).replace(/[^0-9]/g, "");
}
