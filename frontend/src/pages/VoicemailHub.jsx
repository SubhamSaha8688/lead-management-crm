import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useCallStatus } from "../context/CallStatusContext";
import { openWhatsAppChat } from "../utils/whatsapp";

const TARGET_PRESETS = [60, 90, 120, 150, 180];

const MANUAL_OUTCOMES = [
  { label: "Interested", icon: "🟢", outcome: "Connected — Interested", stage: "Interested", color: "#16a34a" },
  { label: "Call Back", icon: "📞", outcome: "Connected — Call Back", stage: "Follow-up Scheduled", color: "#2563eb" },
  { label: "Voicemail", icon: "🎙️", outcome: "Voicemail Connected", isVoicemailPool: true, color: "#9333ea" },
  { label: "Said No (30d)", icon: "🚫", outcome: "Not Interested", snoozeDays: 30, color: "#ea580c" },
  { label: "Said No (45d)", icon: "🚫", outcome: "Not Interested", snoozeDays: 45, color: "#dc2626" },
  { label: "No Answer", icon: "❌", outcome: "No Answer", color: "#64748b" },
  { label: "Switched Off", icon: "🔴", outcome: "Switched Off", color: "#b91c1c" },
  { label: "Not Interested", icon: "⚠️", outcome: "Not Interested", color: "#e11d48" }
];

export default function VoicemailHub({ onDataChange }) {
  const {
    initiateCall,
    dailyTargetMinutes,
    setDailyTargetMinutes,
    todayTalkTimeSeconds: ctxTalkTime,
    todayCallsCount: ctxCallCount,
    fetchTodayStats,
    settings,
    fetchSettings
  } = useCallStatus();

  // Dynamic Settings (Snooze Days & Stopwatch quick buttons)
  const disconnectDays = settings?.voicemailDisconnectSnoozeDays || 2;
  const saidNoDays = settings?.voicemailDefaultSnoozeDays || 30;
  const extendedDays = settings?.voicemailExtendedSnoozeDays || 45;

  const timerIncrements = useMemo(() => {
    const list = settings?.timerQuickIncrements;
    if (Array.isArray(list) && list.length > 0) {
      return list.map((s) => ({
        label: s < 60 ? `+${s}s` : `+${Math.floor(s / 60)}m${s % 60 ? ` ${s % 60}s` : ""}`,
        secs: s
      }));
    }
    return [
      { label: "+30s", secs: 30 },
      { label: "+1m", secs: 60 },
      { label: "+2m", secs: 120 },
      { label: "+3m", secs: 180 },
      { label: "+5m", secs: 300 }
    ];
  }, [settings?.timerQuickIncrements]);

  const dynamicManualOutcomes = useMemo(() => [
    { label: "Interested", icon: "🟢", outcome: "Connected — Interested", stage: "Interested", color: "#16a34a" },
    { label: "Call Back", icon: "📞", outcome: "Connected — Call Back", stage: "Follow-up Scheduled", color: "#2563eb" },
    { label: "Voicemail", icon: "🎙️", outcome: "Voicemail Connected", isVoicemailPool: true, color: "#9333ea" },
    { label: `Picked & Cut (${disconnectDays}d)`, icon: "📴", outcome: "Picked & Disconnected", snoozeDays: disconnectDays, color: "#d97706" },
    { label: `Said No (${saidNoDays}d)`, icon: "🚫", outcome: "Not Interested", snoozeDays: saidNoDays, color: "#ea580c" },
    { label: `Said No (${extendedDays}d)`, icon: "🚫", outcome: "Not Interested", snoozeDays: extendedDays, color: "#dc2626" },
    { label: "No Answer", icon: "❌", outcome: "No Answer", color: "#64748b" },
    { label: "Switched Off", icon: "🔴", outcome: "Switched Off", color: "#b91c1c" },
    { label: "Not Interested", icon: "⚠️", outcome: "Not Interested", color: "#e11d48" }
  ], [disconnectDays, saidNoDays, extendedDays]);

  // State
  const [activeLeads, setActiveLeads] = useState([]);
  const [snoozedLeads, setSnoozedLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("queue"); // "queue" | "manual_timer" | "snoozed" | "history"

  // Custom Snooze State for Active Queue & Manual Timer
  const [customSnoozeLeadId, setCustomSnoozeLeadId] = useState(null);
  const [customSnoozeDays, setCustomSnoozeDays] = useState(30);
  const [customSnoozeNote, setCustomSnoozeNote] = useState("");

  // Search, filter & sort for Voicemail Queue
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("All");
  const [sortOrder, setSortOrder] = useState("oldest_first"); // "oldest_first" | "least_calls" | "recent_first" | "name"

  // Talk time & stats
  const [todayTalkTimeSeconds, setTodayTalkTimeSeconds] = useState(0);
  const [todayCallCount, setTodayCallCount] = useState(0);
  const [todayCallHistory, setTodayCallHistory] = useState([]);

  // Active in-app stopwatch state for Voicemail Queue
  const [inCallLeadId, setInCallLeadId] = useState(null);
  const [callStopwatch, setCallStopwatch] = useState(0);
  const [isCallTimerRunning, setIsCallTimerRunning] = useState(false);
  const [manualDurationInput, setManualDurationInput] = useState({});
  const stopwatchIntervalRef = useRef(null);

  // Manual Call Timer Sub-Tab State
  const [manualSearch, setManualSearch] = useState("");
  const [allLeadsList, setAllLeadsList] = useState([]);
  const [loadingAllLeads, setLoadingAllLeads] = useState(false);
  const [selectedManualLead, setSelectedManualLead] = useState(null);
  const [manualTimerSecs, setManualTimerSecs] = useState(0);
  const [isManualRunning, setIsManualRunning] = useState(false);
  const [manualNote, setManualNote] = useState("");
  const [savingManualOutcome, setSavingManualOutcome] = useState(false);
  const manualTimerIntervalRef = useRef(null);

  // Target customization
  const [showTargetCustomInput, setShowTargetCustomInput] = useState(false);
  const [customTargetMins, setCustomTargetMins] = useState("");

  // Outcome logging modal/drawer
  const [loggingLead, setLoggingLead] = useState(null);
  const [customNote, setCustomNote] = useState("");
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Add lead to voicemail modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLeadSearch, setAddLeadSearch] = useState("");

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4000);
  };

  // 1. Fetch Voicemail Pool data and today's total stats
  const fetchVoicemailData = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get("/api/leads/voicemail-pool");
      if (res.data && res.data.success) {
        setActiveLeads(res.data.activeLeads || []);
        setSnoozedLeads(res.data.snoozedLeads || []);
        setTodayTalkTimeSeconds(res.data.todayTalkTimeSeconds || 0);
        setTodayCallCount(res.data.todayCallCount || 0);

        if (res.data.callLogs && Array.isArray(res.data.callLogs)) {
          setTodayCallHistory(res.data.callLogs);
        }
      }
    } catch (err) {
      console.error("Failed to load voicemail pool:", err);
      setError("Could not load Voicemail Hub. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch all leads for Manual Timer tab & Add to Pool modal
  const fetchAllLeads = async () => {
    try {
      setLoadingAllLeads(true);
      const res = await axios.get("/api/leads");
      if (res.data && res.data.success) {
        setAllLeadsList(res.data.data || []);
      }
    } catch (err) {
      console.warn("Failed to fetch all leads:", err);
    } finally {
      setLoadingAllLeads(false);
    }
  };

  useEffect(() => {
    fetchVoicemailData();
    fetchAllLeads();
  }, []);

  // In-Queue Stopwatch timer management
  useEffect(() => {
    if (inCallLeadId && isCallTimerRunning) {
      stopwatchIntervalRef.current = setInterval(() => {
        setCallStopwatch((prev) => prev + 1);
      }, 1000);
    } else {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
        stopwatchIntervalRef.current = null;
      }
    }
    return () => {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
      }
    };
  }, [inCallLeadId, isCallTimerRunning]);

  // Manual Tab Stopwatch timer management
  useEffect(() => {
    if (isManualRunning) {
      manualTimerIntervalRef.current = setInterval(() => {
        setManualTimerSecs((prev) => prev + 1);
      }, 1000);
    } else {
      if (manualTimerIntervalRef.current) {
        clearInterval(manualTimerIntervalRef.current);
        manualTimerIntervalRef.current = null;
      }
    }
    return () => {
      if (manualTimerIntervalRef.current) {
        clearInterval(manualTimerIntervalRef.current);
      }
    };
  }, [isManualRunning]);

  // Helper formatting functions
  const formatSecondsToMinutes = (seconds) => {
    const s = Math.max(0, Number(seconds) || 0);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
  };

  const formatDigitalTime = (seconds) => {
    const s = Math.max(0, Number(seconds) || 0);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const getTimeAgo = (dateStr) => {
    if (!dateStr) return "Never called";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Never called";

    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
  };

  const isCalledToday = (dateStr) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    return (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  };

  const getRemainingDays = (dateStr) => {
    if (!dateStr) return 0;
    const target = new Date(dateStr);
    const now = new Date();
    const diff = target - now;
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Distinct courses for filter
  const distinctCourses = useMemo(() => {
    const set = new Set(["All"]);
    [...activeLeads, ...snoozedLeads].forEach((l) => {
      const c = l.enrolledCourses?.[0]?.courseName || l.courseName;
      if (c) set.add(c);
    });
    return Array.from(set);
  }, [activeLeads, snoozedLeads]);

  // Filtered & Sorted Active Leads
  const filteredActiveLeads = useMemo(() => {
    let list = activeLeads.filter((lead) => {
      const q = searchTerm.toLowerCase().trim();
      const nameMatch = !q || (lead.name && lead.name.toLowerCase().includes(q));
      const phoneMatch = !q || (lead.phone && String(lead.phone).includes(q));
      const idMatch = !q || (lead.leadId && lead.leadId.toLowerCase().includes(q));
      const course = lead.enrolledCourses?.[0]?.courseName || lead.courseName || "";
      const courseMatch =
        selectedCourse === "All" ||
        (course && course.toLowerCase().includes(selectedCourse.toLowerCase()));

      return (nameMatch || phoneMatch || idMatch) && courseMatch;
    });

    list.sort((a, b) => {
      if (sortOrder === "oldest_first") {
        const aTime = a.lastCallDate ? new Date(a.lastCallDate).getTime() : 0;
        const bTime = b.lastCallDate ? new Date(b.lastCallDate).getTime() : 0;
        return aTime - bTime;
      }
      if (sortOrder === "least_calls") {
        return (a.callCount || 0) - (b.callCount || 0);
      }
      if (sortOrder === "recent_first") {
        const aTime = a.lastCallDate ? new Date(a.lastCallDate).getTime() : 0;
        const bTime = b.lastCallDate ? new Date(b.lastCallDate).getTime() : 0;
        return bTime - aTime;
      }
      if (sortOrder === "name") {
        return (a.name || "").localeCompare(b.name || "");
      }
      return 0;
    });

    return list;
  }, [activeLeads, searchTerm, selectedCourse, sortOrder]);

  // Start Call Handler in Active Queue: Starts paused so agent starts when person picks up!
  const handleStartCall = (lead) => {
    if (!lead || !lead.phone) {
      alert("No phone number for this lead");
      return;
    }

    setInCallLeadId(lead._id);
    setCallStopwatch(0);
    setIsCallTimerRunning(false); // DO NOT auto-run; wait until person answers
    setLoggingLead(lead);

    // Trigger Ozonetel CTC
    initiateCall(lead, () => {
      if (onDataChange) onDataChange();
    });

    showToast(`📞 Dialing ${lead.name}... Tap "Start Timer" when answered!`);
  };

  const handleStartQueueTimer = () => setIsCallTimerRunning(true);
  const handlePauseQueueTimer = () => setIsCallTimerRunning(false);
  const handleResetQueueTimer = () => {
    setCallStopwatch(0);
    setIsCallTimerRunning(false);
  };

  const handleAddQuickDuration = (leadId, seconds) => {
    setCallStopwatch((prev) => prev + seconds);
    setManualDurationInput((prev) => {
      const current = prev[leadId] || callStopwatch || 0;
      return { ...prev, [leadId]: current + seconds };
    });
  };

  // Log Call Outcome in Active Queue
  const handleLogCallOutcome = async (lead, outcome, snoozeDays = null, explicitReason = null) => {
    try {
      setSavingOutcome(true);
      setIsCallTimerRunning(false);

      const durationSecs = manualDurationInput[lead._id] || callStopwatch || 0;

      const payload = {
        duration: durationSecs,
        outcome: outcome,
        snoozeDays: snoozeDays,
        customNote: explicitReason || customNote,
        isVoicemailPool: true
      };

      if (outcome === "Picked - Interested!") {
        payload.stage = "Interested";
        payload.quality = "Warm Lead";
      }

      const res = await axios.post(`/api/leads/${lead._id}/call-log`, payload);

      if (res.data && res.data.success) {
        showToast(
          `✓ Logged ${outcome} (${formatSecondsToMinutes(durationSecs)})! ${
            snoozeDays ? `Snoozed for ${snoozeDays} days.` : ""
          }`
        );

        setInCallLeadId(null);
        setCallStopwatch(0);
        setIsCallTimerRunning(false);
        setLoggingLead(null);
        setCustomNote("");
        setCustomSnoozeLeadId(null);
        setCustomSnoozeNote("");
        setManualDurationInput((prev) => {
          const next = { ...prev };
          delete next[lead._id];
          return next;
        });

        await fetchVoicemailData();
        fetchTodayStats();
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      alert("Failed to log call outcome: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingOutcome(false);
    }
  };

  // Log Outcome for Manual Timer Tab
  const handleLogManualOutcome = async (opt) => {
    if (!selectedManualLead) {
      alert("Please select a lead first.");
      return;
    }

    try {
      setSavingManualOutcome(true);
      setIsManualRunning(false);

      const res = await axios.post(`/api/leads/${selectedManualLead._id}/call-log`, {
        duration: manualTimerSecs,
        outcome: opt.outcome,
        snoozeDays: opt.snoozeDays || null,
        customNote: manualNote,
        stage: opt.stage || null,
        isVoicemailPool: opt.isVoicemailPool !== undefined ? opt.isVoicemailPool : undefined
      });

      if (res.data && res.data.success) {
        showToast(`✓ Logged "${opt.outcome}" (${formatSecondsToMinutes(manualTimerSecs)}) to ${selectedManualLead.name}!`);
        setManualTimerSecs(0);
        setManualNote("");
        setSelectedManualLead(null);
        setManualSearch("");
        await fetchVoicemailData();
        fetchTodayStats();
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      alert("Failed to save call log: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingManualOutcome(false);
    }
  };

  // Unsnooze a lead
  const handleUnsnooze = async (lead) => {
    try {
      const res = await axios.post(`/api/leads/${lead._id}/snooze`, { unsnooze: true });
      if (res.data && res.data.success) {
        showToast(`✓ Unsnoozed ${lead.name} and moved back to active dialer queue.`);
        await fetchVoicemailData();
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      alert("Failed to unsnooze: " + (err.response?.data?.message || err.message));
    }
  };

  // Remove lead from Voicemail Pool
  const handleRemoveFromPool = async (lead) => {
    if (!window.confirm(`Remove ${lead.name} from Voicemail Hub?`)) return;
    try {
      await axios.post(`/api/leads/${lead._id}/voicemail-toggle`, { status: false });
      showToast(`Removed ${lead.name} from Voicemail Hub.`);
      await fetchVoicemailData();
      if (onDataChange) onDataChange();
    } catch (err) {
      alert("Failed to remove: " + err.message);
    }
  };

  // Add lead from modal
  const handleAddLeadToVoicemail = async (lead) => {
    try {
      await axios.post(`/api/leads/${lead._id}/voicemail-toggle`, { status: true });
      showToast(`✓ Added ${lead.name} to Voicemail Hub!`);
      await fetchVoicemailData();
      if (onDataChange) onDataChange();
    } catch (err) {
      alert("Failed to add: " + err.message);
    }
  };

  // "Call Next Available Lead" action
  const handleCallNextAvailable = () => {
    if (filteredActiveLeads.length === 0) {
      showToast("No ready leads in the queue right now.");
      return;
    }
    const nextLead = filteredActiveLeads[0];
    handleStartCall(nextLead);
  };

  // Dynamic Goal calculations
  const effectiveGoalMinutes = dailyTargetMinutes || 90;
  const effectiveGoalSecs = effectiveGoalMinutes * 60;
  const effectiveTodayTalkTime = Math.max(todayTalkTimeSeconds, ctxTalkTime || 0);
  const progressPercent = Math.min(
    100,
    Math.round((effectiveTodayTalkTime / effectiveGoalSecs) * 100)
  );
  const remainingSeconds = Math.max(0, effectiveGoalSecs - effectiveTodayTalkTime);
  const isGoalAchieved = effectiveTodayTalkTime >= effectiveGoalSecs;

  const handleCustomGoalSubmit = (e) => {
    e.preventDefault();
    const val = parseInt(customTargetMins, 10);
    if (!isNaN(val) && val > 0) {
      setDailyTargetMinutes(val);
      setShowTargetCustomInput(false);
      setCustomTargetMins("");
      showToast(`Daily goal updated to ${val} minutes (${(val / 60).toFixed(1)} hrs)!`);
    }
  };

  // Filtered leads for the manual call timer search
  const manualFilteredLeads = manualSearch.trim()
    ? allLeadsList
        .filter(
          (l) =>
            (l.name && l.name.toLowerCase().includes(manualSearch.toLowerCase())) ||
            (l.phone && String(l.phone).includes(manualSearch)) ||
            (l.leadId && l.leadId.toLowerCase().includes(manualSearch.toLowerCase()))
        )
        .slice(0, 10)
    : [];

  return (
    <div
      style={{
        minHeight: "calc(100vh - var(--nav-h, 62px))",
        backgroundColor: "var(--bg, #f8fafc)",
        color: "var(--text, #0f172a)",
        padding: "1.25rem 1.5rem"
      }}
    >
      {/* Toast Alert */}
      {toastMsg && (
        <div
          style={{
            position: "fixed",
            top: "1.2rem",
            right: "1.5rem",
            background: "#10b981",
            color: "#ffffff",
            padding: "0.75rem 1.25rem",
            borderRadius: "8px",
            fontWeight: 700,
            fontSize: "0.88rem",
            boxShadow: "0 6px 20px rgba(16, 185, 129, 0.35)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <span>✨</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. Header Banner & Daily Talk-Time Goal Card */}
      <div
        style={{
          background: isGoalAchieved
            ? "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.1) 100%)"
            : "var(--surface, #ffffff)",
          border: isGoalAchieved ? "2px solid #10b981" : "1px solid var(--border, #e2e8f0)",
          borderRadius: "14px",
          padding: "1.4rem 1.6rem",
          marginBottom: "1.5rem",
          boxShadow: "var(--shadow, 0 4px 14px rgba(15, 23, 42, 0.08))"
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "1rem"
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span style={{ fontSize: "1.6rem" }}>🎙️</span>
              <div>
                <h1
                  style={{
                    fontSize: "1.35rem",
                    fontWeight: 800,
                    margin: 0,
                    color: "var(--text, #0f172a)"
                  }}
                >
                  Voicemail Hub & Daily Talk-Time Station
                </h1>
                <p
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--text3, #64748b)",
                    margin: "2px 0 0 0"
                  }}
                >
                  Customizable Daily Goal, Manual Stopwatch Timer on Call Pickup & Anti-Repeat System
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setActiveTab("manual_timer")}
              style={{
                background: "var(--accent-bg, #eef2ff)",
                border: "1px solid var(--accent, #6366f1)",
                borderRadius: "8px",
                padding: "0.55rem 0.95rem",
                fontSize: "0.82rem",
                fontWeight: 700,
                color: "var(--accent, #4f46e5)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px"
              }}
            >
              <span>⏱️</span>
              <span>Manual Call Timer</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              style={{
                background: "var(--surface2, #f8fafc)",
                border: "1px solid var(--border, #cbd5e1)",
                borderRadius: "8px",
                padding: "0.55rem 0.95rem",
                fontSize: "0.82rem",
                fontWeight: 700,
                color: "var(--text, #0f172a)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px"
              }}
            >
              <span>➕</span>
              <span>Add Leads to Pool</span>
            </button>

            <button
              type="button"
              onClick={handleCallNextAvailable}
              disabled={filteredActiveLeads.length === 0}
              style={{
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "0.6rem 1.25rem",
                fontSize: "0.88rem",
                fontWeight: 800,
                cursor: filteredActiveLeads.length === 0 ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "7px",
                boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
                opacity: filteredActiveLeads.length === 0 ? 0.6 : 1
              }}
              title="Automatically calls the top ready lead waiting the longest"
            >
              <span>⚡</span>
              <span>Call Next Lead</span>
            </button>
          </div>
        </div>

        {/* Daily Progress Bar & Target Customization Controls */}
        <div
          style={{
            marginTop: "1.2rem",
            paddingTop: "1.1rem",
            borderTop: "1px solid var(--border, #e2e8f0)"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.6rem",
              flexWrap: "wrap",
              gap: "0.6rem"
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text3)" }}>
                TODAY'S TALK-TIME:
              </span>
              <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "#10b981" }}>
                {formatSecondsToMinutes(effectiveTodayTalkTime)}
              </span>
              <span style={{ fontSize: "0.85rem", color: "var(--text3)" }}>
                / {effectiveGoalMinutes >= 60 ? `${(effectiveGoalMinutes / 60).toFixed(1)}h` : `${effectiveGoalMinutes}m`} Goal
              </span>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  padding: "0.15rem 0.5rem",
                  borderRadius: "12px",
                  background: isGoalAchieved ? "#10b981" : "rgba(16, 185, 129, 0.15)",
                  color: isGoalAchieved ? "#ffffff" : "#059669",
                  marginLeft: "0.4rem"
                }}
              >
                {progressPercent}% Complete
              </span>
            </div>

            {/* Target Preset Selector Buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text3)" }}>
                Change Target:
              </span>
              {TARGET_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDailyTargetMinutes(m)}
                  style={{
                    background:
                      effectiveGoalMinutes === m
                        ? "var(--accent, #4f46e5)"
                        : "var(--surface2, #f8fafc)",
                    color: effectiveGoalMinutes === m ? "#ffffff" : "var(--text)",
                    border: "1px solid var(--border, #cbd5e1)",
                    borderRadius: "4px",
                    padding: "3px 8px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  {m}m ({m >= 60 ? `${(m / 60).toFixed(1)}h` : `${m}m`})
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowTargetCustomInput((prev) => !prev)}
                style={{
                  background: "none",
                  border: "1px dashed var(--border)",
                  borderRadius: "4px",
                  padding: "3px 8px",
                  fontSize: "0.72rem",
                  color: "var(--accent)",
                  cursor: "pointer",
                  fontWeight: 700
                }}
              >
                Custom ⚙️
              </button>
            </div>
          </div>

          {/* Custom Target Input Row */}
          {showTargetCustomInput && (
            <form
              onSubmit={handleCustomGoalSubmit}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
                padding: "8px",
                background: "var(--surface2, #f1f5f9)",
                borderRadius: "6px"
              }}
            >
              <span style={{ fontSize: "0.78rem", fontWeight: 700 }}>Custom Target (in minutes):</span>
              <input
                type="number"
                min="1"
                max="1440"
                placeholder="e.g. 100"
                value={customTargetMins}
                onChange={(e) => setCustomTargetMins(e.target.value)}
                style={{
                  width: "100px",
                  padding: "4px 8px",
                  fontSize: "0.78rem",
                  borderRadius: "4px",
                  border: "1px solid var(--border)"
                }}
              />
              <button
                type="submit"
                style={{
                  background: "#4f46e5",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "4px",
                  padding: "4px 10px",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                Set Goal
              </button>
            </form>
          )}

          {/* Progress Bar Container */}
          <div
            style={{
              height: "10px",
              width: "100%",
              background: "var(--surface2, #f1f5f9)",
              borderRadius: "6px",
              overflow: "hidden",
              border: "1px solid var(--border, #cbd5e1)"
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPercent}%`,
                background: isGoalAchieved
                  ? "linear-gradient(90deg, #10b981 0%, #059669 100%)"
                  : "linear-gradient(90deg, #3b82f6 0%, #10b981 100%)",
                transition: "width 0.4s ease",
                borderRadius: "6px"
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.75rem",
              color: "var(--text3, #64748b)",
              marginTop: "5px"
            }}
          >
            <span>Calls Today: <strong>{todayCallCount}</strong></span>
            <span>
              {isGoalAchieved ? (
                <strong style={{ color: "#10b981" }}>🎉 Daily Target Achieved!</strong>
              ) : (
                <span>⏱️ {formatSecondsToMinutes(remainingSeconds)} remaining to hit target</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Controls & Tabs Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          marginBottom: "1rem"
        }}
      >
        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setActiveTab("queue")}
            style={{
              padding: "0.55rem 1.1rem",
              borderRadius: "8px",
              border: "1px solid",
              borderColor: activeTab === "queue" ? "#10b981" : "var(--border, #cbd5e1)",
              background: activeTab === "queue" ? "#10b981" : "var(--surface, #ffffff)",
              color: activeTab === "queue" ? "#ffffff" : "var(--text, #0f172a)",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>📞 Active Queue</span>
            <span
              style={{
                background: activeTab === "queue" ? "rgba(255,255,255,0.3)" : "var(--surface2, #e2e8f0)",
                color: activeTab === "queue" ? "#ffffff" : "var(--text3)",
                fontSize: "0.72rem",
                padding: "1px 6px",
                borderRadius: "10px"
              }}
            >
              {activeLeads.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("manual_timer")}
            style={{
              padding: "0.55rem 1.1rem",
              borderRadius: "8px",
              border: "1px solid",
              borderColor: activeTab === "manual_timer" ? "#4f46e5" : "var(--border, #cbd5e1)",
              background: activeTab === "manual_timer" ? "#4f46e5" : "var(--surface, #ffffff)",
              color: activeTab === "manual_timer" ? "#ffffff" : "var(--text, #0f172a)",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>⏱️ Manual Call Timer</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("snoozed")}
            style={{
              padding: "0.55rem 1.1rem",
              borderRadius: "8px",
              border: "1px solid",
              borderColor: activeTab === "snoozed" ? "#f59e0b" : "var(--border, #cbd5e1)",
              background: activeTab === "snoozed" ? "#f59e0b" : "var(--surface, #ffffff)",
              color: activeTab === "snoozed" ? "#ffffff" : "var(--text, #0f172a)",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>💤 Snoozed Leads</span>
            <span
              style={{
                background: activeTab === "snoozed" ? "rgba(255,255,255,0.3)" : "var(--surface2, #e2e8f0)",
                color: activeTab === "snoozed" ? "#ffffff" : "var(--text3)",
                fontSize: "0.72rem",
                padding: "1px 6px",
                borderRadius: "10px"
              }}
            >
              {snoozedLeads.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            style={{
              padding: "0.55rem 1.1rem",
              borderRadius: "8px",
              border: "1px solid",
              borderColor: activeTab === "history" ? "#2563eb" : "var(--border, #cbd5e1)",
              background: activeTab === "history" ? "#2563eb" : "var(--surface, #ffffff)",
              color: activeTab === "history" ? "#ffffff" : "var(--text, #0f172a)",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>📊 All Calls Today</span>
            <span
              style={{
                background: activeTab === "history" ? "rgba(255,255,255,0.3)" : "var(--surface2, #e2e8f0)",
                color: activeTab === "history" ? "#ffffff" : "var(--text3)",
                fontSize: "0.72rem",
                padding: "1px 6px",
                borderRadius: "10px"
              }}
            >
              {todayCallHistory.length}
            </span>
          </button>
        </div>

        {/* Search & Course filter for Queue */}
        {activeTab === "queue" && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Search name, phone, lead ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: "0.45rem 0.8rem",
                fontSize: "0.82rem",
                borderRadius: "6px",
                border: "1px solid var(--border, #cbd5e1)",
                background: "var(--surface, #ffffff)",
                color: "var(--text)",
                minWidth: "200px"
              }}
            />

            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              style={{
                padding: "0.45rem 0.8rem",
                fontSize: "0.82rem",
                borderRadius: "6px",
                border: "1px solid var(--border, #cbd5e1)",
                background: "var(--surface, #ffffff)",
                color: "var(--text)"
              }}
            >
              {distinctCourses.map((c) => (
                <option key={c} value={c}>
                  {c === "All" ? "All Courses" : c}
                </option>
              ))}
            </select>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              style={{
                padding: "0.45rem 0.8rem",
                fontSize: "0.82rem",
                borderRadius: "6px",
                border: "1px solid var(--border, #cbd5e1)",
                background: "var(--surface, #ffffff)",
                color: "var(--text)",
                fontWeight: 600
              }}
            >
              <option value="oldest_first">Anti-Repeat (Oldest Called First)</option>
              <option value="least_calls">Least Calls First</option>
              <option value="recent_first">Recently Called First</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* TAB CONTENT                                              */}
      {/* ======================================================== */}

      {/* TAB 1: ACTIVE VOICEMAIL QUEUE */}
      {activeTab === "queue" && (
        <div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--text3)" }}>
              Loading Voicemail dialing queue...
            </div>
          ) : filteredActiveLeads.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "3rem 1rem",
                background: "var(--surface, #ffffff)",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: "12px",
                color: "var(--text3)"
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📭</div>
              <p style={{ fontWeight: 600 }}>No leads in Voicemail Hub matching filter.</p>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                style={{
                  marginTop: "0.8rem",
                  background: "#10b981",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "0.6rem 1.25rem",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                + Add Leads to Voicemail Hub
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {filteredActiveLeads.map((lead, index) => {
                const calledToday = isCalledToday(lead.lastCallDate);
                const isCurrentCall = inCallLeadId === lead._id;
                const isLogging = loggingLead?._id === lead._id;

                return (
                  <div
                    key={lead._id}
                    style={{
                      background: isCurrentCall
                        ? "rgba(16, 185, 129, 0.05)"
                        : "var(--surface, #ffffff)",
                      border: isCurrentCall
                        ? "2px solid #10b981"
                        : calledToday
                        ? "1px solid #f59e0b"
                        : "1px solid var(--border, #e2e8f0)",
                      borderRadius: "12px",
                      padding: "1rem 1.25rem",
                      boxShadow: isCurrentCall
                        ? "0 4px 18px rgba(16, 185, 129, 0.2)"
                        : "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))",
                      transition: "all 0.2s ease"
                    }}
                  >
                    {/* Top Row: Lead Info & Badges */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: "0.6rem"
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <span
                            style={{
                              background: "var(--surface2, #f1f5f9)",
                              color: "var(--text3)",
                              fontSize: "0.72rem",
                              fontWeight: 800,
                              padding: "2px 7px",
                              borderRadius: "4px"
                            }}
                          >
                            #{index + 1}
                          </span>

                          <Link
                            to={`/leads/${lead._id}`}
                            style={{
                              fontWeight: 800,
                              fontSize: "1rem",
                              color: "var(--text, #0f172a)",
                              textDecoration: "none"
                            }}
                          >
                            {lead.name}
                          </Link>

                          <span style={{ fontSize: "0.78rem", color: "var(--text3)" }}>
                            ({lead.leadId})
                          </span>

                          {/* Anti-Repeat Status Badge */}
                          {calledToday ? (
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 800,
                                background: "#fef3c7",
                                color: "#b45309",
                                padding: "2px 8px",
                                borderRadius: "12px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                            >
                              <span>⚠️ Called Today:</span>
                              <span>{getTimeAgo(lead.lastCallDate)}</span>
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 800,
                                background: "#d1fae5",
                                color: "#065f46",
                                padding: "2px 8px",
                                borderRadius: "12px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                            >
                              <span>🟢 Ready to Call</span>
                              {lead.lastCallDate && <span>• Last: {getTimeAgo(lead.lastCallDate)}</span>}
                            </span>
                          )}
                        </div>

                        {/* Meta info */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.85rem",
                            marginTop: "4px",
                            fontSize: "0.8rem",
                            color: "var(--text2, #475569)",
                            flexWrap: "wrap"
                          }}
                        >
                          <span style={{ fontWeight: 700, color: "var(--text)" }}>
                            📞 +91 {lead.phone ? lead.phone.replace(/^91/, "") : "No phone"}
                          </span>
                          <span>•</span>
                          <span>
                            🎓 {lead.enrolledCourses?.[0]?.courseName || lead.courseName || "General Course"}
                          </span>
                          <span>•</span>
                          <span>Total Calls: <strong>{lead.callCount || 0}</strong></span>
                          {lead.totalTalkTime > 0 && (
                            <>
                              <span>•</span>
                              <span>
                                Cumulative Talk Time:{" "}
                                <strong style={{ color: "#10b981" }}>
                                  {formatSecondsToMinutes(lead.totalTalkTime)}
                                </strong>
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right quick actions */}
                      <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                        <a
                          href={`tel:${lead.phone}`}
                          style={{
                            background: "var(--surface2, #f8fafc)",
                            border: "1px solid var(--border, #cbd5e1)",
                            padding: "0.35rem 0.65rem",
                            borderRadius: "6px",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            color: "var(--text)",
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                          title="Direct SIM Dial"
                        >
                          📱 SIM Dial
                        </a>

                        <button
                          type="button"
                          onClick={(e) => openWhatsAppChat(lead.phone, "", e)}
                          style={{
                            background: "rgba(34, 197, 94, 0.12)",
                            border: "1px solid rgba(34, 197, 94, 0.3)",
                            color: "#15803d",
                            padding: "0.35rem 0.65rem",
                            borderRadius: "6px",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                        >
                          💬 WhatsApp
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveFromPool(lead)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--text3)",
                            fontSize: "0.85rem",
                            cursor: "pointer",
                            padding: "0.3rem"
                          }}
                          title="Remove from Voicemail Hub"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Interactive Dialing & Stopwatch Section */}
                    <div
                      style={{
                        marginTop: "0.85rem",
                        padding: "0.85rem",
                        background: "var(--surface2, #f8fafc)",
                        borderRadius: "8px",
                        border: "1px solid var(--border, #e2e8f0)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "0.8rem"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                        {!isCurrentCall ? (
                          <button
                            type="button"
                            onClick={() => handleStartCall(lead)}
                            style={{
                              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "6px",
                              padding: "0.45rem 1rem",
                              fontSize: "0.84rem",
                              fontWeight: 800,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              boxShadow: "0 2px 6px rgba(16, 185, 129, 0.3)"
                            }}
                          >
                            <span>📞</span>
                            <span>Dial via Ozonetel (Manual Timer)</span>
                          </button>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                            {/* Live Timer Display */}
                            <div
                              style={{
                                background: isCallTimerRunning ? "#059669" : "#f59e0b",
                                color: "#ffffff",
                                padding: "0.4rem 0.85rem",
                                borderRadius: "6px",
                                fontWeight: 800,
                                fontSize: "0.85rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px"
                              }}
                            >
                              <span>{isCallTimerRunning ? "⏱️ In Call:" : "⏸️ Paused:"}</span>
                              <span style={{ fontFamily: "monospace", fontSize: "1rem" }}>
                                {formatDigitalTime(callStopwatch)}
                              </span>
                            </div>

                            {/* Start/Pause Control */}
                            {!isCallTimerRunning ? (
                              <button
                                type="button"
                                onClick={handleStartQueueTimer}
                                style={{
                                  background: "#10b981",
                                  color: "#ffffff",
                                  border: "none",
                                  borderRadius: "6px",
                                  padding: "0.4rem 0.85rem",
                                  fontSize: "0.84rem",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.4)"
                                }}
                              >
                                <span>▶</span>
                                <span>START TIMER (Person Picked Up)</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={handlePauseQueueTimer}
                                style={{
                                  background: "#f59e0b",
                                  color: "#ffffff",
                                  border: "none",
                                  borderRadius: "6px",
                                  padding: "0.4rem 0.75rem",
                                  fontSize: "0.8rem",
                                  fontWeight: 700,
                                  cursor: "pointer"
                                }}
                              >
                                ⏸️ Pause
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={handleResetQueueTimer}
                              style={{
                                background: "var(--surface)",
                                border: "1px solid var(--border)",
                                borderRadius: "6px",
                                padding: "0.4rem 0.7rem",
                                fontSize: "0.78rem",
                                cursor: "pointer",
                                color: "var(--text2)"
                              }}
                            >
                              🔄 Reset
                            </button>
                          </div>
                        )}

                        {/* Quick Presets */}
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.72rem", color: "var(--text3)", fontWeight: 700 }}>
                            +Secs:
                          </span>
                          {timerIncrements.map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => handleAddQuickDuration(lead._id, preset.secs)}
                              style={{
                                background: "var(--surface, #ffffff)",
                                border: "1px solid var(--border, #cbd5e1)",
                                borderRadius: "4px",
                                padding: "2px 6px",
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                color: "var(--text2)",
                                cursor: "pointer"
                              }}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Log Outcome Toggle */}
                      <div>
                        <button
                          type="button"
                          onClick={() => setLoggingLead(isLogging ? null : lead)}
                          style={{
                            background: isLogging ? "#2563eb" : "var(--surface, #ffffff)",
                            color: isLogging ? "#ffffff" : "var(--text)",
                            border: "1px solid var(--border, #cbd5e1)",
                            borderRadius: "6px",
                            padding: "0.45rem 0.85rem",
                            fontSize: "0.82rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px"
                          }}
                        >
                          <span>{isLogging ? "▲ Close Logging" : "▼ Log Outcome & Save Talk Time"}</span>
                        </button>
                      </div>
                    </div>

                    {/* 1-Click Outcome Buttons Tray */}
                    {isLogging && (
                      <div
                        style={{
                          marginTop: "0.85rem",
                          padding: "1rem",
                          background: "var(--surface, #ffffff)",
                          border: "1px solid var(--border, #cbd5e1)",
                          borderRadius: "8px",
                          boxShadow: "var(--shadow-sm)"
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "0.6rem"
                          }}
                        >
                          <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--text)" }}>
                            Select Call Outcome (Duration to log: {formatSecondsToMinutes(manualDurationInput[lead._id] || callStopwatch || 0)}):
                          </span>
                          <input
                            type="text"
                            placeholder="Optional call notes..."
                            value={customNote}
                            onChange={(e) => setCustomNote(e.target.value)}
                            style={{
                              padding: "0.3rem 0.6rem",
                              fontSize: "0.78rem",
                              borderRadius: "4px",
                              border: "1px solid var(--border)",
                              width: "250px"
                            }}
                          />
                        </div>

                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                          {/* 🔊 Voicemail Connected */}
                          <button
                            type="button"
                            disabled={savingOutcome}
                            onClick={() => handleLogCallOutcome(lead, "Voicemail Connected")}
                            style={{
                              background: "#8b5cf6",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "6px",
                              padding: "0.5rem 0.9rem",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              cursor: "pointer"
                            }}
                          >
                            🔊 Voicemail Connected
                          </button>

                          {/* 📴 Picked & Disconnected (Default 2 Days Snooze, Dynamic from Settings) */}
                          <button
                            type="button"
                            disabled={savingOutcome}
                            onClick={() => handleLogCallOutcome(lead, "Picked & Disconnected", disconnectDays)}
                            style={{
                              background: "#d97706",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "6px",
                              padding: "0.5rem 0.9rem",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              cursor: "pointer"
                            }}
                            title={`Customer answered and disconnected. Snooze for ${disconnectDays} days`}
                          >
                            📴 Disconnected ({disconnectDays}d Snooze)
                          </button>

                          {/* 🚫 Said No (Default 30 Days Snooze, Dynamic from Settings) */}
                          <button
                            type="button"
                            disabled={savingOutcome}
                            onClick={() => handleLogCallOutcome(lead, `Said No (${saidNoDays} Days Snooze)`, saidNoDays)}
                            style={{
                              background: "#ea580c",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "6px",
                              padding: "0.5rem 0.9rem",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              cursor: "pointer"
                            }}
                            title={`Hide this lead from dialer queue for ${saidNoDays} days`}
                          >
                            🚫 Said No ({saidNoDays}d Snooze)
                          </button>

                          {/* 🚫 Said No (Extended 45 Days Snooze, Dynamic from Settings) */}
                          <button
                            type="button"
                            disabled={savingOutcome}
                            onClick={() => handleLogCallOutcome(lead, `Said No (${extendedDays} Days Snooze)`, extendedDays)}
                            style={{
                              background: "#dc2626",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "6px",
                              padding: "0.5rem 0.9rem",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              cursor: "pointer"
                            }}
                            title={`Hide this lead from dialer queue for ${extendedDays} days`}
                          >
                            🚫 Said No ({extendedDays}d Snooze)
                          </button>

                          {/* ⏱️ Custom Snooze Dropdown / Trigger */}
                          <button
                            type="button"
                            disabled={savingOutcome}
                            onClick={() => {
                              setCustomSnoozeLeadId(customSnoozeLeadId === lead._id ? null : lead._id);
                              setCustomSnoozeDays(saidNoDays || 30);
                            }}
                            style={{
                              background: customSnoozeLeadId === lead._id ? "var(--accent)" : "var(--surface2, #f1f5f9)",
                              color: customSnoozeLeadId === lead._id ? "#ffffff" : "var(--text)",
                              border: "1px solid var(--border)",
                              borderRadius: "6px",
                              padding: "0.5rem 0.9rem",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              cursor: "pointer"
                            }}
                            title="Set your own custom snooze / timeout duration in days for this lead"
                          >
                            ⏱️ Custom Snooze...
                          </button>

                          {/* 🟢 Picked - Interested! */}
                          <button
                            type="button"
                            disabled={savingOutcome}
                            onClick={() => handleLogCallOutcome(lead, "Picked - Interested!")}
                            style={{
                              background: "#059669",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "6px",
                              padding: "0.5rem 0.9rem",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              cursor: "pointer"
                            }}
                          >
                            🟢 Picked: Interested!
                          </button>

                          {/* 📵 No Answer */}
                          <button
                            type="button"
                            disabled={savingOutcome}
                            onClick={() => handleLogCallOutcome(lead, "No Answer / Ringing")}
                            style={{
                              background: "var(--surface2, #f1f5f9)",
                              color: "var(--text2)",
                              border: "1px solid var(--border)",
                              borderRadius: "6px",
                              padding: "0.5rem 0.9rem",
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              cursor: "pointer"
                            }}
                          >
                            📵 No Answer
                          </button>
                        </div>

                        {/* Inline Custom Snooze Configuration Panel */}
                        {customSnoozeLeadId === lead._id && (
                          <div
                            style={{
                              marginTop: "0.75rem",
                              padding: "0.85rem 1rem",
                              background: "var(--surface2, #f8fafc)",
                              border: "1px solid var(--accent)",
                              borderRadius: "8px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.6rem",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.06)"
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--text)" }}>
                                💤 Custom Snooze Timeout for {lead.name}:
                              </span>
                              <button
                                type="button"
                                onClick={() => setCustomSnoozeLeadId(null)}
                                style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "0.9rem", padding: "2px 6px" }}
                                title="Close"
                              >
                                ✕
                              </button>
                            </div>

                            {/* Quick Day Chips */}
                            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
                              <span style={{ fontSize: "0.72rem", color: "var(--text3)", fontWeight: 700 }}>Presets:</span>
                              {[1, 2, 7, 14, 21, 30, 45, 60, 90, 180].map((d) => (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => setCustomSnoozeDays(d)}
                                  style={{
                                    padding: "2px 8px",
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                    borderRadius: "4px",
                                    border: "1px solid",
                                    borderColor: customSnoozeDays === d ? "var(--accent)" : "var(--border)",
                                    background: customSnoozeDays === d ? "var(--accent)" : "var(--surface, #ffffff)",
                                    color: customSnoozeDays === d ? "#ffffff" : "var(--text2)",
                                    cursor: "pointer"
                                  }}
                                >
                                  {d}d
                                </button>
                              ))}
                            </div>

                            {/* Custom number input + reason input + Confirm button */}
                            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <input
                                  type="number"
                                  min="1"
                                  max="365"
                                  value={customSnoozeDays}
                                  onChange={(e) => setCustomSnoozeDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                  style={{
                                    width: "75px",
                                    padding: "0.38rem 0.5rem",
                                    fontSize: "0.85rem",
                                    fontWeight: 700,
                                    borderRadius: "4px",
                                    border: "1px solid var(--border)"
                                  }}
                                />
                                <span style={{ fontSize: "0.78rem", color: "var(--text2)", fontWeight: 600 }}>Days</span>
                              </div>

                              <input
                                type="text"
                                placeholder="Snooze reason (e.g. Asked to call after exams, traveling)..."
                                value={customSnoozeNote}
                                onChange={(e) => setCustomSnoozeNote(e.target.value)}
                                style={{
                                  flex: 1,
                                  minWidth: "220px",
                                  padding: "0.38rem 0.65rem",
                                  fontSize: "0.78rem",
                                  borderRadius: "4px",
                                  border: "1px solid var(--border)"
                                }}
                              />

                              <button
                                type="button"
                                disabled={savingOutcome}
                                onClick={() => {
                                  const reason = customSnoozeNote.trim() ? customSnoozeNote.trim() : null;
                                  handleLogCallOutcome(lead, `Custom Snooze (${customSnoozeDays} Days)`, customSnoozeDays, reason);
                                }}
                                style={{
                                  background: "var(--accent, #4f46e5)",
                                  color: "#ffffff",
                                  border: "none",
                                  borderRadius: "6px",
                                  padding: "0.45rem 1rem",
                                  fontSize: "0.78rem",
                                  fontWeight: 700,
                                  cursor: "pointer"
                                }}
                              >
                                💤 Confirm {customSnoozeDays}d Snooze
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: MANUAL CALL TIMER STATION                        */}
      {/* ======================================================== */}
      {activeTab === "manual_timer" && (
        <div style={{ maxWidth: "700px", margin: "0 auto" }}>
          <div
            style={{
              background: "var(--surface, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "14px",
              padding: "1.5rem",
              boxShadow: "var(--shadow, 0 4px 14px rgba(15, 23, 42, 0.08))"
            }}
          >
            <div style={{ textAlign: "center", marginBottom: "1.2rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0 }}>
                ⏱️ Manual Call Timer & Talk-Time Logger
              </h2>
              <p style={{ fontSize: "0.82rem", color: "var(--text3)", margin: "4px 0 0 0" }}>
                Select ANY lead in the CRM • Start timer on call pickup • Count toward your daily target
              </p>
            </div>

            {/* Lead Selection */}
            {!selectedManualLead ? (
              <div style={{ marginBottom: "1.2rem" }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "6px" }}>
                  1. Search Any Lead in CRM:
                </label>
                <input
                  type="text"
                  placeholder="Type name, phone number, or lead ID..."
                  value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.55rem 0.9rem",
                    fontSize: "0.85rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border, #cbd5e1)",
                    background: "var(--surface, #ffffff)",
                    color: "var(--text)"
                  }}
                />

                {manualFilteredLeads.length > 0 && (
                  <div
                    style={{
                      maxHeight: "180px",
                      overflowY: "auto",
                      border: "1px solid var(--border, #cbd5e1)",
                      borderRadius: "8px",
                      marginTop: "6px",
                      background: "var(--surface, #ffffff)"
                    }}
                  >
                    {manualFilteredLeads.map((l) => (
                      <div
                        key={l._id}
                        onClick={() => {
                          setSelectedManualLead(l);
                          setManualSearch("");
                        }}
                        style={{
                          padding: "8px 12px",
                          borderBottom: "1px solid var(--border, #f1f5f9)",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "0.82rem"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2, #f8fafc)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <div>
                          <strong>{l.name}</strong> <span style={{ color: "var(--text3)" }}>({l.phone})</span>
                          <div style={{ fontSize: "0.72rem", color: "var(--text2)" }}>
                            {l.course || (l.enrolledCourses?.[0]?.courseName || "General")} • {l.stage}
                          </div>
                        </div>
                        <span style={{ color: "#4f46e5", fontWeight: 700, fontSize: "0.78rem" }}>Select →</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  background: "rgba(79, 70, 229, 0.08)",
                  border: "1px solid #4f46e5",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1.2rem"
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#3730a3" }}>
                    Selected: {selectedManualLead.name}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#4338ca" }}>
                    📞 {selectedManualLead.phone} • {selectedManualLead.course || "General"} • {selectedManualLead.stage}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => initiateCall(selectedManualLead)}
                    style={{
                      background: "#10b981",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "5px 10px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    📞 Dial Ozonetel
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedManualLead(null)}
                    style={{
                      background: "none",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      padding: "5px 8px",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      color: "var(--text2)"
                    }}
                  >
                    Change Lead
                  </button>
                </div>
              </div>
            )}

            {/* Stopwatch Section */}
            <div
              style={{
                background: isManualRunning ? "rgba(16, 185, 129, 0.12)" : "var(--surface2, #f8fafc)",
                border: isManualRunning ? "2px solid #10b981" : "1px solid var(--border, #e2e8f0)",
                borderRadius: "12px",
                padding: "20px",
                textAlign: "center",
                marginBottom: "1.2rem"
              }}
            >
              <div
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  color: isManualRunning ? "#059669" : "var(--text3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "4px"
                }}
              >
                {isManualRunning ? "🟢 CALL CONNECTED • TIMER RUNNING" : "STOPWATCH TIMER"}
              </div>

              <div
                style={{
                  fontSize: "3.2rem",
                  fontWeight: 900,
                  fontFamily: "monospace",
                  color: isManualRunning ? "#047857" : "var(--text, #0f172a)",
                  margin: "6px 0 14px 0"
                }}
              >
                {formatDigitalTime(manualTimerSecs)}
              </div>

              {/* Action Buttons */}
              {!isManualRunning ? (
                <button
                  type="button"
                  onClick={() => setIsManualRunning(true)}
                  style={{
                    width: "100%",
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "12px 18px",
                    fontSize: "1.05rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)"
                  }}
                >
                  <span>▶</span>
                  <span>{manualTimerSecs > 0 ? "RESUME TIMER" : "START TIMER (Person Picked Up)"}</span>
                </button>
              ) : (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setIsManualRunning(false)}
                    style={{
                      flex: 1,
                      background: "#f59e0b",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "10px",
                      fontSize: "0.95rem",
                      fontWeight: 800,
                      cursor: "pointer"
                    }}
                  >
                    ⏸️ Pause Timer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setManualTimerSecs(0);
                      setIsManualRunning(false);
                    }}
                    style={{
                      background: "var(--surface)",
                      color: "var(--text2)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "10px 16px",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    🔄 Reset
                  </button>
                </div>
              )}

              {/* Preset Add Buttons */}
              <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginTop: "12px", flexWrap: "wrap" }}>
                {timerIncrements.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setManualTimerSecs((prev) => prev + p.secs)}
                    style={{
                      background: "var(--surface, #ffffff)",
                      border: "1px solid var(--border, #cbd5e1)",
                      borderRadius: "4px",
                      padding: "4px 9px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "var(--text2)",
                      cursor: "pointer"
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Outcome Logger */}
            <div>
              <div style={{ fontSize: "0.82rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "8px" }}>
                End Call & Log Outcome ({formatSecondsToMinutes(manualTimerSecs)}):
              </div>

              <input
                type="text"
                placeholder="Optional call notes (e.g. Discussed fee concession)..."
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: "0.82rem",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  marginBottom: "10px"
                }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "8px" }}>
                {dynamicManualOutcomes.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    disabled={savingManualOutcome}
                    onClick={() => handleLogManualOutcome(opt)}
                    style={{
                      background: "var(--surface2, #f8fafc)",
                      border: "1px solid var(--border, #e2e8f0)",
                      borderRadius: "8px",
                      padding: "8px 6px",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      cursor: savingManualOutcome ? "not-allowed" : "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "3px"
                    }}
                  >
                    <span style={{ fontSize: "1rem" }}>{opt.icon}</span>
                    <span style={{ textAlign: "center", lineHeight: 1.1 }}>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: SNOOZED LEADS (30-45 DAYS COOLDOWN)              */}
      {/* ======================================================== */}
      {activeTab === "snoozed" && (
        <div>
          {snoozedLeads.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "3rem 1rem",
                background: "var(--surface, #ffffff)",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: "12px",
                color: "var(--text3)"
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🌿</div>
              <p style={{ fontWeight: 600 }}>No leads are currently snoozed.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {snoozedLeads.map((lead) => {
                const daysLeft = getRemainingDays(lead.snoozedUntil);
                return (
                  <div
                    key={lead._id}
                    style={{
                      background: "var(--surface, #ffffff)",
                      border: "1px solid var(--border, #e2e8f0)",
                      borderRadius: "10px",
                      padding: "0.9rem 1.2rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "0.75rem"
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <Link
                          to={`/leads/${lead._id}`}
                          style={{
                            fontWeight: 800,
                            fontSize: "0.95rem",
                            color: "var(--text)",
                            textDecoration: "none"
                          }}
                        >
                          {lead.name}
                        </Link>
                        <span style={{ fontSize: "0.78rem", color: "var(--text3)" }}>
                          ({lead.leadId})
                        </span>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 800,
                            background: "#fef3c7",
                            color: "#b45309",
                            padding: "2px 8px",
                            borderRadius: "10px"
                          }}
                        >
                          💤 {daysLeft} Days Remaining
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text3)",
                          marginTop: "3px"
                        }}
                      >
                        📞 +91 {lead.phone} • Reason: {lead.snoozeReason || "Picked - Not Interested"}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUnsnooze(lead)}
                      style={{
                        background: "var(--surface2, #f8fafc)",
                        border: "1px solid var(--border, #cbd5e1)",
                        borderRadius: "6px",
                        padding: "0.4rem 0.85rem",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        color: "var(--text)"
                      }}
                      title="Return this lead to the active dialer queue immediately"
                    >
                      🔄 Unsnooze (Return to Queue)
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: TODAY'S CALL HISTORY ACROSS ALL LEADS             */}
      {/* ======================================================== */}
      {activeTab === "history" && (
        <div>
          {todayCallHistory.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "3rem 1rem",
                background: "var(--surface, #ffffff)",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: "12px",
                color: "var(--text3)"
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📞</div>
              <p style={{ fontWeight: 600 }}>No calls logged yet today.</p>
              <p style={{ fontSize: "0.82rem" }}>
                Calls made via Ozonetel or the Manual Timer will appear here with exact duration and timestamp.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {todayCallHistory.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "var(--surface, #ffffff)",
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: "8px",
                    padding: "0.8rem 1.1rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.6rem"
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <strong style={{ fontSize: "0.9rem" }}>{item.name || item.leadName}</strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--text3)" }}>
                        ({item.leadCustomId || item.customId})
                      </span>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: item.outcome?.includes("Voicemail")
                            ? "rgba(139, 92, 246, 0.15)"
                            : item.outcome?.includes("Interested")
                            ? "rgba(16, 185, 129, 0.15)"
                            : "var(--surface2)",
                          color: item.outcome?.includes("Voicemail")
                            ? "#7c3aed"
                            : item.outcome?.includes("Interested")
                            ? "#059669"
                            : "var(--text)"
                        }}
                      >
                        {item.outcome}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text3)", marginTop: "2px" }}>
                      {new Date(item.addedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{" "}
                      • {item.course} • +91 {item.phone}
                      {item.note && <span style={{ marginLeft: "8px", color: "var(--text2)" }}>"{item.note.split('\n')[1] || item.note}"</span>}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span
                      style={{
                        fontSize: "0.88rem",
                        fontWeight: 800,
                        color: item.duration > 0 ? "#10b981" : "var(--text3)",
                        background: "var(--surface2)",
                        padding: "3px 10px",
                        borderRadius: "6px"
                      }}
                    >
                      ⏱️ {formatSecondsToMinutes(item.duration)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD LEADS TO VOICEMAIL POOL */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem"
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div
            style={{
              background: "var(--surface, #ffffff)",
              borderRadius: "12px",
              padding: "1.5rem",
              width: "100%",
              maxWidth: "520px",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>
                ➕ Add Leads to Voicemail Hub
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  color: "var(--text3)"
                }}
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              placeholder="Search leads by name, phone, or ID..."
              value={addLeadSearch}
              onChange={(e) => setAddLeadSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "0.55rem 0.85rem",
                fontSize: "0.85rem",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                marginBottom: "0.75rem"
              }}
            />

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {loadingAllLeads ? (
                <div style={{ textAlign: "center", padding: "1.5rem", color: "var(--text3)" }}>
                  Loading leads...
                </div>
              ) : (
                allLeadsList
                  .filter((l) => {
                    const q = addLeadSearch.toLowerCase().trim();
                    if (!q) return true;
                    return (
                      (l.name && l.name.toLowerCase().includes(q)) ||
                      (l.phone && String(l.phone).includes(q)) ||
                      (l.leadId && l.leadId.toLowerCase().includes(q))
                    );
                  })
                  .slice(0, 25)
                  .map((lead) => {
                    const inPool = lead.isVoicemailPool || lead.quality === "Voicemail";
                    return (
                      <div
                        key={lead._id}
                        style={{
                          padding: "0.6rem 0.8rem",
                          borderRadius: "6px",
                          border: "1px solid var(--border)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "0.82rem"
                        }}
                      >
                        <div>
                          <strong>{lead.name}</strong> <span style={{ color: "var(--text3)" }}>({lead.leadId})</span>
                          <div style={{ fontSize: "0.75rem", color: "var(--text2)" }}>
                            📞 {lead.phone} • {lead.stage}
                          </div>
                        </div>

                        {inPool ? (
                          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#10b981" }}>
                            ✓ In Pool
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddLeadToVoicemail(lead)}
                            style={{
                              background: "#10b981",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "4px",
                              padding: "0.3rem 0.75rem",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              cursor: "pointer"
                            }}
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
