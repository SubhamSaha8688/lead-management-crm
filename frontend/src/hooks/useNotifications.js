import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { fetchLeadsWithCache } from "../utils/leadCache";
import { toDateKey, getFollowUpDateTime } from "../utils/dateUtils";

export default function useNotifications(refreshTrigger) {
  const [leads, setLeads] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [todayFollowUps, setTodayFollowUps] = useState([]);
  const [staleLeads, setStaleLeads] = useState([]);
  const [totalBadgeCount, setTotalBadgeCount] = useState(0);

  // Dismissed notification tracking in localStorage
  const [dismissedMap, setDismissedMap] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("crm_dismissed_notifs") || "{}");
    } catch {
      return {};
    }
  });

  const dismissNotification = useCallback((id) => {
    setDismissedMap((prev) => {
      const updated = { ...prev, [id]: Date.now() };
      try {
        localStorage.setItem("crm_dismissed_notifs", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  }, []);

  const clearAllNotifications = useCallback((ids = []) => {
    setDismissedMap((prev) => {
      const updated = { ...prev };
      ids.forEach((id) => {
        updated[id] = Date.now();
      });
      try {
        localStorage.setItem("crm_dismissed_notifs", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  }, []);

  // Request browser notification permission once
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Trigger browser notification with deduplication
  const sendBrowserNotification = (title, body, key) => {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    const sentKey = `notif_sent_${key}`;
    if (localStorage.getItem(sentKey)) {
      return; // Already notified for this exact schedule key
    }

    try {
      new Notification(title, {
        body: body,
        icon: "/vite.svg"
      });
      localStorage.setItem(sentKey, Date.now().toString());
    } catch (e) {
      console.warn("Could not dispatch notification:", e);
    }
  };

  // Process leads and categorize
  const evaluateFollowUps = useCallback((leadsList) => {
    const now = new Date();
    const todayStr = toDateKey(now);

    const overdueList = [];
    const todayList = [];
    const staleList = [];
    const scheduleMap = {};

    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

    leadsList.forEach((lead) => {
      // Ignore deleted or closed/terminal leads
      if (lead.isDeleted || lead.stage === "Converted" || lead.stage === "Lost") return;

      // Check if dismissed recently
      const dismissedTime = dismissedMap[lead._id];
      const isDismissed = dismissedTime && now.getTime() - dismissedTime < TWELVE_HOURS_MS;

      // Detect Stale Leads: active leads with no updates or calls in > 7 days
      const lastActivityDate = lead.comments && lead.comments.length > 0
        ? new Date(lead.comments[lead.comments.length - 1].addedAt || lead.updatedAt || lead.createdAt)
        : new Date(lead.updatedAt || lead.createdAt || 0);

      const timeSinceActivity = now.getTime() - lastActivityDate.getTime();
      if (timeSinceActivity > SEVEN_DAYS_MS && !isDismissed) {
        staleList.push(lead);
      }

      // Check follow-ups
      if (!lead.followUpDate) return;

      const fDateStr = toDateKey(lead.followUpDate);
      const fDateTime = getFollowUpDateTime(lead);

      if (!fDateTime) return;

      const diffMs = fDateTime.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));

      // 1. Conflict tracking (grouped by date and time)
      const timeSlot = lead.followUpTime || "00:00";
      const slotKey = `${fDateStr}_${timeSlot}`;
      if (!scheduleMap[slotKey]) {
        scheduleMap[slotKey] = {
          date: fDateStr,
          time: timeSlot,
          leads: []
        };
      }
      if (!isDismissed) {
        scheduleMap[slotKey].leads.push(lead);
      }

      // 2. Overdue vs Today Follow-up (skip if dismissed)
      if (!isDismissed) {
        if (fDateStr < todayStr) {
          // Date was in previous days -> Overdue
          overdueList.push(lead);
        } else if (fDateStr === todayStr) {
          if (diffMs < 0) {
            // Scheduled today, but time has passed -> Overdue
            overdueList.push(lead);
          } else {
            // Scheduled today in future -> Today's follow-up
            todayList.push(lead);
          }
        }
      }

      // 3. Browser notification triggers for upcoming follow-ups
      const leadKeyBase = `${lead.leadId || lead._id}-${fDateStr}-${lead.followUpTime || "00:00"}`;

      // Exactly due now (within -1 to 2 minutes)
      if (diffMinutes <= 0 && diffMinutes >= -2) {
        sendBrowserNotification(
          "Follow-up due now",
          `${lead.name} (${lead.phone || "No phone"})`,
          `${leadKeyBase}-exact`
        );
      }
      // 15 minutes before (between 13 and 16 minutes remaining)
      else if (diffMinutes <= 15 && diffMinutes >= 12) {
        sendBrowserNotification(
          "Follow-up in 15 minutes",
          `${lead.name} (${lead.phone || "No phone"})`,
          `${leadKeyBase}-before15`
        );
      }
    });

    // Extract conflicts (2 or more leads on the same date/time)
    const conflictList = [];
    Object.keys(scheduleMap).forEach((key) => {
      const entry = scheduleMap[key];
      // Only care about today or future conflicts
      if (entry.leads.length >= 2 && entry.date >= todayStr) {
        conflictList.push({
          date: entry.date,
          time: entry.time,
          count: entry.leads.length,
          leads: entry.leads
        });
      }
    });

    // Sort overdue by how overdue (most overdue first)
    overdueList.sort((a, b) => {
      const dtA = getFollowUpDateTime(a);
      const dtB = getFollowUpDateTime(b);
      return dtA - dtB;
    });

    // Sort today's upcoming by time (soonest first)
    todayList.sort((a, b) => {
      const dtA = getFollowUpDateTime(a);
      const dtB = getFollowUpDateTime(b);
      return dtA - dtB;
    });

    setOverdue(overdueList);
    setTodayFollowUps(todayList);
    setConflicts(conflictList);
    setStaleLeads(staleList);

    // Total actionable badge count
    setTotalBadgeCount(overdueList.length + conflictList.length + todayList.length);
  }, []);

  // Fetch leads and evaluate immediately (using shared cache)
  const fetchAndCheck = useCallback(async (force = false) => {
    try {
      const fetchedLeads = await fetchLeadsWithCache(force);
      if (Array.isArray(fetchedLeads)) {
        setLeads(fetchedLeads);
        evaluateFollowUps(fetchedLeads);
      }
    } catch (err) {
      console.error("Error checking follow-up notifications:", err);
    }
  }, [evaluateFollowUps]);

  // Initial load and whenever refreshTrigger changes
  useEffect(() => {
    fetchAndCheck(true);
  }, [fetchAndCheck, refreshTrigger]);

  // 30-second periodic heartbeat check
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAndCheck();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [fetchAndCheck]);

  return {
    leads,
    conflicts,
    overdue,
    todayFollowUps,
    staleLeads,
    totalBadgeCount,
    dismissNotification,
    clearAllNotifications,
    refreshNotifications: fetchAndCheck
  };
}
