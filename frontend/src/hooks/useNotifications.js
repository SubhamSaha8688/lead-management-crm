import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { getCachedLeads, fetchLeadsOptimized } from "../utils/leadsCache";

export default function useNotifications(refreshTrigger) {
  const [leads, setLeads] = useState(() => getCachedLeads());
  const [conflicts, setConflicts] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [todayFollowUps, setTodayFollowUps] = useState([]);
  const [totalBadgeCount, setTotalBadgeCount] = useState(0);

  // Request browser notification permission once
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Helper to format date string to YYYY-MM-DD
  const toDateKey = (d) => {
    if (!d) return "";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // Convert lead followUpDate + followUpTime into local Date object
  const getFollowUpDateTime = (lead) => {
    if (!lead.followUpDate) return null;
    const baseDate = new Date(lead.followUpDate);
    if (isNaN(baseDate.getTime())) return null;

    let hours = 0;
    let minutes = 0;

    if (lead.followUpTime && lead.followUpTime.includes(":")) {
      const parts = lead.followUpTime.split(":");
      hours = parseInt(parts[0], 10) || 0;
      minutes = parseInt(parts[1], 10) || 0;
    }

    return new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      hours,
      minutes,
      0,
      0
    );
  };

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
    const scheduleMap = {};

    leadsList.forEach((lead) => {
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
      scheduleMap[slotKey].leads.push(lead);

      // 2. Overdue vs Today Follow-up
      if (diffMs < 0) {
        // Follow-up time has passed
        overdueList.push(lead);
      } else if (fDateStr === todayStr) {
        // Scheduled today in future
        todayList.push(lead);
      }

      // 3. Browser notification triggers
      // Only for pending leads (not already lost or closed if not needed)
      if (lead.stage !== "Converted" && lead.stage !== "Lost") {
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

    // Total actionable badge count
    setTotalBadgeCount(overdueList.length + conflictList.length + todayList.length);
  }, []);

  // Evaluate cached leads immediately on initial mount for instant badge rendering
  useEffect(() => {
    const initial = getCachedLeads();
    if (initial && initial.length > 0) {
      evaluateFollowUps(initial);
    }
  }, [evaluateFollowUps]);

  // Fetch leads and evaluate immediately
  const fetchAndCheck = useCallback(async (forceFresh = false) => {
    try {
      const fetchedLeads = await fetchLeadsOptimized(forceFresh);
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
    fetchAndCheck();
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
    totalBadgeCount,
    refreshNotifications: fetchAndCheck
  };
}
