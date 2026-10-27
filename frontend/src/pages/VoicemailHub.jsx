import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useCallStatus } from "../context/CallStatusContext";
import { openWhatsAppChat, WHATSAPP_TAB_NAME } from "../utils/whatsapp";

const DAILY_GOAL_SECONDS = 5400; // 90 minutes (1 Hour 30 Minutes)

export default function VoicemailHub({ onDataChange }) {
  const { initiateCall } = useCallStatus();

  // State
  const [activeLeads, setActiveLeads] = useState([]);
  const [snoozedLeads, setSnoozedLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("queue"); // "queue" | "snoozed" | "history"

  // Search, filter & sort
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("All");
  const [sortOrder, setSortOrder] = useState("oldest_first"); // "oldest_first" | "least_calls" | "recent_first" | "name"

  // Talk time & stats
  const [todayTalkTimeSeconds, setTodayTalkTimeSeconds] = useState(0);
  const [todayCallCount, setTodayCallCount] = useState(0);
  const [todayCallHistory, setTodayCallHistory] = useState([]);

  // Active in-app stopwatch state
  const [inCallLeadId, setInCallLeadId] = useState(null);
  const [callStopwatch, setCallStopwatch] = useState(0);
  const [manualDurationInput, setManualDurationInput] = useState({});
  const stopwatchIntervalRef = useRef(null);

  // Outcome logging modal/drawer
  const [loggingLead, setLoggingLead] = useState(null);
  const [customNote, setCustomNote] = useState("");
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Add lead to voicemail modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [allLeadsList, setAllLeadsList] = useState([]);
  const [addLeadSearch, setAddLeadSearch] = useState("");
  const [loadingAllLeads, setLoadingAllLeads] = useState(false);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4000);
  };

  // 1. Fetch Voicemail Pool data
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

        // Extract today's calls for the history tab
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const history = [];

        [...(res.data.activeLeads || []), ...(res.data.snoozedLeads || [])].forEach((lead) => {
          if (lead.comments && Array.isArray(lead.comments)) {
            lead.comments.forEach((c) => {
              if (c.addedAt && new Date(c.addedAt) >= startOfToday && (c.outcome || c.text?.includes("Call"))) {
                const match = c.text && c.text.match(/Duration:\s*(\d+)s/i);
                history.push({
                  leadId: lead._id,
                  customId: lead.leadId,
                  leadName: lead.name,
                  phone: lead.phone,
                  course: lead.enrolledCourses?.[0]?.courseName || lead.courseName || "General",
                  addedAt: c.addedAt,
                  outcome: c.outcome || "Call Logged",
                  text: c.text,
                  duration: match ? parseInt(match[1], 10) : 0
                });
              }
            });
          }
        });

        history.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
        setTodayCallHistory(history);
      }
    } catch (err) {
      console.error("Failed to load voicemail pool:", err);
      setError("Could not load Voicemail Hub. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVoicemailData();
  }, []);

  // Stopwatch timer management
  useEffect(() => {
    if (inCallLeadId) {
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
  }, [inCallLeadId]);

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

    // Sort order
    list.sort((a, b) => {
      if (sortOrder === "oldest_first") {
        // Anti-repeat: Never called comes first, then oldest lastCallDate
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

  // Start Call Handler
  const handleStartCall = (lead) => {
    if (!lead || !lead.phone) {
      alert("No phone number for this lead");
      return;
    }

    setInCallLeadId(lead._id);
    setCallStopwatch(0);
    setLoggingLead(lead);

    // Trigger Ozonetel CTC
    initiateCall(lead, () => {
      if (onDataChange) onDataChange();
    });

    showToast(`📞 Dialing ${lead.name}... Stopwatch started!`);
  };

  // Stop Stopwatch
  const handleStopCall = () => {
    if (inCallLeadId) {
      setInCallLeadId(null);
    }
  };

  // Add quick duration seconds
  const handleAddQuickDuration = (leadId, seconds) => {
    setManualDurationInput((prev) => {
      const current = prev[leadId] || callStopwatch || 0;
      return { ...prev, [leadId]: current + seconds };
    });
  };

  // Log Call Outcome
  const handleLogCallOutcome = async (lead, outcome, snoozeDays = null) => {
    try {
      setSavingOutcome(true);

      const durationSecs = manualDurationInput[lead._id] || callStopwatch || 30; // default 30s if not specified

      const payload = {
        duration: durationSecs,
        outcome: outcome,
        snoozeDays: snoozeDays,
        customNote: customNote,
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

        // Reset call state
        setInCallLeadId(null);
        setCallStopwatch(0);
        setLoggingLead(null);
        setCustomNote("");
        setManualDurationInput((prev) => {
          const next = { ...prev };
          delete next[lead._id];
          return next;
        });

        // Refresh data
        await fetchVoicemailData();
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      alert("Failed to log call outcome: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingOutcome(false);
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

  // Fetch all leads for "Add to Voicemail" modal
  const openAddLeadsModal = async () => {
    setShowAddModal(true);
    setLoadingAllLeads(true);
    try {
      const res = await axios.get("/api/leads");
      if (res.data && res.data.success) {
        setAllLeadsList(res.data.data || []);
      }
    } catch (err) {
      console.warn("Could not fetch leads for add modal:", err);
    } finally {
      setLoadingAllLeads(false);
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

  // Daily Progress Calculation
  const progressPercent = Math.min(
    100,
    Math.round((todayTalkTimeSeconds / DAILY_GOAL_SECONDS) * 100)
  );
  const remainingSeconds = Math.max(0, DAILY_GOAL_SECONDS - todayTalkTimeSeconds);
  const isGoalAchieved = todayTalkTimeSeconds >= DAILY_GOAL_SECONDS;

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
                  Voicemail Hub & Daily Talk-Time Booster
                </h1>
                <p
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--text3, #64748b)",
                    margin: "2px 0 0 0"
                  }}
                >
                  Systematic dialer queue with smart anti-repeat sorting and 30–45 day snooze
                  protection.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <button
              type="button"
              onClick={openAddLeadsModal}
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
              <span>Call Next Available Lead</span>
            </button>
          </div>
        </div>

        {/* 1h 30m Daily Progress Bar & Stat Metrics */}
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
              marginBottom: "0.5rem",
              flexWrap: "wrap",
              gap: "0.5rem"
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text3)" }}>
                TODAY'S TALK-TIME TARGET:
              </span>
              <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "#10b981" }}>
                {formatSecondsToMinutes(todayTalkTimeSeconds)}
              </span>
              <span style={{ fontSize: "0.85rem", color: "var(--text3)" }}>/ 1h 30m Goal</span>
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

            <div style={{ fontSize: "0.82rem", color: "var(--text2, #475569)", fontWeight: 600 }}>
              {isGoalAchieved ? (
                <span style={{ color: "#10b981", fontWeight: 800 }}>
                  🎉 1h 30m Goal Completed for Today!
                </span>
              ) : (
                <span>⏱️ {formatSecondsToMinutes(remainingSeconds)} remaining to hit target</span>
              )}
            </div>
          </div>

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

          {/* Metric Badges */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "0.75rem",
              marginTop: "0.9rem"
            }}
          >
            <div
              style={{
                padding: "0.6rem 0.8rem",
                borderRadius: "8px",
                background: "var(--surface2, #f8fafc)",
                border: "1px solid var(--border, #e2e8f0)"
              }}
            >
              <div style={{ fontSize: "0.7rem", color: "var(--text3)", fontWeight: 700 }}>
                TODAY'S CALLS
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text)" }}>
                {todayCallCount} calls
              </div>
            </div>

            <div
              style={{
                padding: "0.6rem 0.8rem",
                borderRadius: "8px",
                background: "var(--surface2, #f8fafc)",
                border: "1px solid var(--border, #e2e8f0)"
              }}
            >
              <div style={{ fontSize: "0.7rem", color: "var(--text3)", fontWeight: 700 }}>
                ACTIVE IN QUEUE
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#10b981" }}>
                {activeLeads.length} leads
              </div>
            </div>

            <div
              style={{
                padding: "0.6rem 0.8rem",
                borderRadius: "8px",
                background: "var(--surface2, #f8fafc)",
                border: "1px solid var(--border, #e2e8f0)"
              }}
            >
              <div style={{ fontSize: "0.7rem", color: "var(--text3)", fontWeight: 700 }}>
                SNOOZED (COOLDOWN)
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#f59e0b" }}>
                {snoozedLeads.length} leads
              </div>
            </div>

            <div
              style={{
                padding: "0.6rem 0.8rem",
                borderRadius: "8px",
                background: "var(--surface2, #f8fafc)",
                border: "1px solid var(--border, #e2e8f0)"
              }}
            >
              <div style={{ fontSize: "0.7rem", color: "var(--text3)", fontWeight: 700 }}>
                ANTI-REPEAT ORDER
              </div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text2)", marginTop: "2px" }}>
                Oldest Called First
              </div>
            </div>
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
        <div style={{ display: "flex", gap: "0.4rem" }}>
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
            <span>💤 Snoozed (30-45 Days)</span>
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
              borderColor: activeTab === "history" ? "#3b82f6" : "var(--border, #cbd5e1)",
              background: activeTab === "history" ? "#3b82f6" : "var(--surface, #ffffff)",
              color: activeTab === "history" ? "#ffffff" : "var(--text, #0f172a)",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>📊 Today's Calls</span>
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

        {/* Search, Course & Sort Filter Controls */}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="🔍 Search name, phone, lead ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: "0.5rem 0.85rem",
              fontSize: "0.82rem",
              borderRadius: "8px",
              border: "1px solid var(--border, #cbd5e1)",
              background: "var(--surface, #ffffff)",
              color: "var(--text, #0f172a)",
              minWidth: "220px"
            }}
          />

          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            style={{
              padding: "0.5rem 0.75rem",
              fontSize: "0.82rem",
              borderRadius: "8px",
              border: "1px solid var(--border, #cbd5e1)",
              background: "var(--surface, #ffffff)",
              color: "var(--text, #0f172a)"
            }}
          >
            {distinctCourses.map((c) => (
              <option key={c} value={c}>
                {c === "All" ? "All Courses" : c}
              </option>
            ))}
          </select>

          {activeTab === "queue" && (
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              style={{
                padding: "0.5rem 0.75rem",
                fontSize: "0.82rem",
                borderRadius: "8px",
                border: "1px solid var(--border, #cbd5e1)",
                background: "var(--surface, #ffffff)",
                color: "var(--text, #0f172a)",
                fontWeight: 600
              }}
              title="Sorting order for dialing"
            >
              <option value="oldest_first">🕒 Oldest Called / Never First (Anti-Repeat)</option>
              <option value="least_calls">⚡ Least Calls First (Call Count)</option>
              <option value="recent_first">⏱️ Recently Called First</option>
              <option value="name">🔤 Name (A-Z)</option>
            </select>
          )}

          <button
            type="button"
            onClick={fetchVoicemailData}
            style={{
              padding: "0.5rem 0.75rem",
              fontSize: "0.82rem",
              borderRadius: "8px",
              border: "1px solid var(--border, #cbd5e1)",
              background: "var(--surface, #ffffff)",
              cursor: "pointer"
            }}
            title="Refresh list"
          >
            🔄
          </button>
        </div>
      </div>

      {/* 3. Main Content Area */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--text3)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⏳</div>
          <p>Loading Voicemail Dialer Queue...</p>
        </div>
      ) : error ? (
        <div
          style={{
            padding: "1rem",
            background: "var(--danger-bg, #fef2f2)",
            color: "var(--danger, #dc2626)",
            borderRadius: "8px",
            textAlign: "center"
          }}
        >
          {error}
        </div>
      ) : activeTab === "queue" ? (
        /* TAB 1: ACTIVE DIALER QUEUE */
        <div>
          {filteredActiveLeads.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "3.5rem 1rem",
                background: "var(--surface, #ffffff)",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: "12px",
                color: "var(--text3)"
              }}
            >
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📭</div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "var(--text)" }}>
                No leads in active queue
              </h3>
              <p style={{ fontSize: "0.85rem", maxWidth: "450px", margin: "0 auto 1.25rem auto" }}>
                Add leads whose numbers connect to voicemail or set lead quality to "Voicemail" to
                build your talk-time list.
              </p>
              <button
                type="button"
                onClick={openAddLeadsModal}
                style={{
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
                const currentDuration = manualDurationInput[lead._id] || (isCurrentCall ? callStopwatch : 0);

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
                        {/* Direct SIM Dial */}
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
                          title="Direct SIM Dial (from mobile/phone)"
                        >
                          📱 SIM Dial
                        </a>

                        {/* WhatsApp Single-Tab */}
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
                          title="Open in existing WhatsApp Web tab"
                        >
                          💬 WhatsApp
                        </button>

                        {/* Remove from Voicemail Pool */}
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
                        {/* Dial / End Button */}
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
                            <span>Start Call (Live Timer)</span>
                          </button>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div
                              style={{
                                background: "#dc2626",
                                color: "#ffffff",
                                padding: "0.4rem 0.85rem",
                                borderRadius: "6px",
                                fontWeight: 800,
                                fontSize: "0.85rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                animation: "pulse 1.5s infinite"
                              }}
                            >
                              <span>🔴 In Call:</span>
                              <span style={{ fontFamily: "monospace", fontSize: "0.95rem" }}>
                                {formatSecondsToMinutes(callStopwatch)}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={handleStopCall}
                              style={{
                                background: "var(--surface, #ffffff)",
                                border: "1px solid #dc2626",
                                color: "#dc2626",
                                padding: "0.4rem 0.75rem",
                                borderRadius: "6px",
                                fontSize: "0.8rem",
                                fontWeight: 700,
                                cursor: "pointer"
                              }}
                            >
                              ⏹️ Stop Timer
                            </button>
                          </div>
                        )}

                        {/* Quick Duration Preset Chips */}
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ fontSize: "0.72rem", color: "var(--text3)", fontWeight: 700 }}>
                            Duration:
                          </span>
                          {[
                            { label: "+30s", secs: 30 },
                            { label: "+1m", secs: 60 },
                            { label: "+2m", secs: 120 },
                            { label: "+3m", secs: 180 }
                          ].map((chip) => (
                            <button
                              key={chip.label}
                              type="button"
                              onClick={() => handleAddQuickDuration(lead._id, chip.secs)}
                              style={{
                                background: "var(--surface, #ffffff)",
                                border: "1px solid var(--border, #cbd5e1)",
                                borderRadius: "4px",
                                padding: "2px 6px",
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                color: "var(--text)"
                              }}
                              title={`Add ${chip.label} to call duration`}
                            >
                              {chip.label}
                            </button>
                          ))}

                          {currentDuration > 0 && (
                            <span
                              style={{
                                fontSize: "0.78rem",
                                fontWeight: 800,
                                color: "#10b981",
                                marginLeft: "4px"
                              }}
                            >
                              = {formatSecondsToMinutes(currentDuration)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 1-Click Outcome Buttons */}
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                        {/* 1. Voicemail Connected (Goal booster!) */}
                        <button
                          type="button"
                          onClick={() => handleLogCallOutcome(lead, "Voicemail Connected")}
                          disabled={savingOutcome}
                          style={{
                            background: "#10b981",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "6px",
                            padding: "0.4rem 0.8rem",
                            fontSize: "0.78rem",
                            fontWeight: 800,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px"
                          }}
                          title="Logged Voicemail: Adds talk time & rotates lead to bottom"
                        >
                          <span>🔊</span>
                          <span>Voicemail Connected</span>
                        </button>

                        {/* 2. Picked: Said No (30 Days Snooze) */}
                        <button
                          type="button"
                          onClick={() => handleLogCallOutcome(lead, "Picked - Not Interested (30 Days)", 30)}
                          disabled={savingOutcome}
                          style={{
                            background: "var(--surface, #ffffff)",
                            border: "1px solid #f59e0b",
                            color: "#b45309",
                            borderRadius: "6px",
                            padding: "0.4rem 0.75rem",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                          title="Picked and said No: Snooze for 30 days so they are not called again"
                        >
                          <span>🚫</span>
                          <span>Said No (30d Snooze)</span>
                        </button>

                        {/* 3. Picked: Said No (45 Days Snooze) */}
                        <button
                          type="button"
                          onClick={() => handleLogCallOutcome(lead, "Picked - Not Interested (45 Days)", 45)}
                          disabled={savingOutcome}
                          style={{
                            background: "var(--surface, #ffffff)",
                            border: "1px solid #f59e0b",
                            color: "#b45309",
                            borderRadius: "6px",
                            padding: "0.4rem 0.75rem",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                          title="Picked and said No: Snooze for 45 days (1.5 months)"
                        >
                          <span>🚫</span>
                          <span>Said No (45d Snooze)</span>
                        </button>

                        {/* 4. Picked: Interested */}
                        <button
                          type="button"
                          onClick={() => handleLogCallOutcome(lead, "Picked - Interested!")}
                          disabled={savingOutcome}
                          style={{
                            background: "rgba(59, 130, 246, 0.12)",
                            border: "1px solid #3b82f6",
                            color: "#2563eb",
                            borderRadius: "6px",
                            padding: "0.4rem 0.75rem",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            cursor: "pointer"
                          }}
                          title="Picked and interested: Promotes to Interested pipeline"
                        >
                          <span>🟢</span>
                          <span>Interested!</span>
                        </button>

                        {/* 5. Ringing / No Answer */}
                        <button
                          type="button"
                          onClick={() => handleLogCallOutcome(lead, "Ringing / No Answer")}
                          disabled={savingOutcome}
                          style={{
                            background: "var(--surface, #ffffff)",
                            border: "1px solid var(--border, #cbd5e1)",
                            color: "var(--text3)",
                            borderRadius: "6px",
                            padding: "0.4rem 0.65rem",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            cursor: "pointer"
                          }}
                          title="Rang out with no answer"
                        >
                          <span>📵</span>
                          <span>No Answer</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === "snoozed" ? (
        /* TAB 2: SNOOZED LEADS (30-45 DAYS COOLDOWN) */
        <div>
          <div
            style={{
              padding: "0.9rem 1.25rem",
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: "10px",
              marginBottom: "1rem",
              fontSize: "0.84rem",
              color: "#92400e",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <span>🛡️</span>
            <span>
              <strong>Cooldown Protection:</strong> These {snoozedLeads.length} leads picked up and
              said No. They are automatically hidden from your dialer queue until their cooldown
              period expires. You can click <strong>"Unsnooze"</strong> anytime if someone calls
              back.
            </span>
          </div>

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
                        📞 +91 {lead.phone} • {lead.snoozeReason || "Snoozed"} • Snoozed until{" "}
                        {lead.snoozedUntil ? new Date(lead.snoozedUntil).toLocaleDateString() : ""}
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
      ) : (
        /* TAB 3: TODAY'S CALL HISTORY */
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
                Calls you log in Voicemail Hub will appear here with exact duration and timestamp.
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
                      <strong style={{ fontSize: "0.9rem" }}>{item.leadName}</strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--text3)" }}>
                        ({item.customId})
                      </span>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: "4px",
                          background: item.outcome.includes("Voicemail")
                            ? "rgba(16, 185, 129, 0.15)"
                            : "var(--surface2)",
                          color: item.outcome.includes("Voicemail") ? "#059669" : "var(--text)"
                        }}
                      >
                        {item.outcome}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text3)", marginTop: "2px" }}>
                      {new Date(item.addedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{" "}
                      • {item.course} • +91 {item.phone}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "1rem", fontWeight: 800, color: "#10b981" }}>
                      +{formatSecondsToMinutes(item.duration)}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text3)" }}>logged talk time</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Modal: Add Leads to Voicemail Hub */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: "1rem"
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              background: "var(--surface, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "14px",
              maxWidth: "600px",
              width: "100%",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "1.2rem 1.4rem",
                borderBottom: "1px solid var(--border, #e2e8f0)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>
                  ➕ Add Leads to Voicemail Hub
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.78rem", color: "var(--text3)" }}>
                  Search any student lead to add them into your talk-time booster queue.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {/* Modal Search */}
            <div style={{ padding: "0.85rem 1.4rem", borderBottom: "1px solid var(--border, #e2e8f0)" }}>
              <input
                type="text"
                placeholder="Search leads by name, phone, course..."
                value={addLeadSearch}
                onChange={(e) => setAddLeadSearch(e.target.value)}
                autoFocus
                style={{
                  width: "100%",
                  padding: "0.55rem 0.85rem",
                  fontSize: "0.85rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border, #cbd5e1)",
                  background: "var(--surface2, #f8fafc)",
                  color: "var(--text)"
                }}
              />
            </div>

            {/* Modal Lead List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem 1.4rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {loadingAllLeads ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text3)" }}>
                  Loading leads...
                </div>
              ) : (
                allLeadsList
                  .filter((l) => {
                    const q = addLeadSearch.toLowerCase();
                    if (!q) return true;
                    return (
                      (l.name && l.name.toLowerCase().includes(q)) ||
                      (l.phone && String(l.phone).includes(q)) ||
                      (l.leadId && l.leadId.toLowerCase().includes(q)) ||
                      (l.courseName && l.courseName.toLowerCase().includes(q))
                    );
                  })
                  .slice(0, 50)
                  .map((lead) => {
                    const isInPool =
                      activeLeads.some((al) => al._id === lead._id) ||
                      snoozedLeads.some((sl) => sl._id === lead._id);

                    return (
                      <div
                        key={lead._id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.6rem 0.8rem",
                          border: "1px solid var(--border, #e2e8f0)",
                          borderRadius: "8px",
                          background: isInPool ? "var(--surface2, #f1f5f9)" : "var(--surface, #ffffff)"
                        }}
                      >
                        <div>
                          <strong>{lead.name}</strong>{" "}
                          <span style={{ fontSize: "0.75rem", color: "var(--text3)" }}>
                            ({lead.leadId})
                          </span>
                          <div style={{ fontSize: "0.75rem", color: "var(--text3)" }}>
                            +91 {lead.phone} • {lead.enrolledCourses?.[0]?.courseName || lead.courseName || "General"}
                          </div>
                        </div>

                        {isInPool ? (
                          <span style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: 700 }}>
                            ✓ In Voicemail Hub
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddLeadToVoicemail(lead)}
                            style={{
                              background: "#10b981",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "6px",
                              padding: "0.35rem 0.75rem",
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

            {/* Modal Footer */}
            <div style={{ padding: "0.85rem 1.4rem", borderTop: "1px solid var(--border, #e2e8f0)", textAlign: "right" }}>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{
                  background: "var(--surface2, #f8fafc)",
                  border: "1px solid var(--border, #cbd5e1)",
                  borderRadius: "6px",
                  padding: "0.45rem 1rem",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
