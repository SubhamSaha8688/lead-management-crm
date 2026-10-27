import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useCallStatus } from "../context/CallStatusContext";

const TARGET_PRESETS = [60, 90, 120, 150, 180];

const OUTCOME_OPTIONS = [
  { label: "Interested", icon: "🟢", outcome: "Connected — Interested", stage: "Interested", color: "#16a34a" },
  { label: "Call Back", icon: "📞", outcome: "Connected — Call Back", stage: "Follow-up Scheduled", color: "#2563eb" },
  { label: "Voicemail", icon: "🎙️", outcome: "Voicemail Connected", isVoicemailPool: true, color: "#9333ea" },
  { label: "Said No (30d)", icon: "🚫", outcome: "Not Interested", snoozeDays: 30, color: "#ea580c" },
  { label: "Said No (45d)", icon: "🚫", outcome: "Not Interested", snoozeDays: 45, color: "#dc2626" },
  { label: "No Answer", icon: "❌", outcome: "No Answer", color: "#64748b" },
  { label: "Switched Off", icon: "🔴", outcome: "Switched Off", color: "#b91c1c" },
  { label: "Not Interested", icon: "⚠️", outcome: "Not Interested", color: "#e11d48" }
];

export default function ManualTimerModal({ isOpen, onClose, onLeadUpdated }) {
  const {
    startManualCall,
    initiateCall,
    dailyTargetMinutes,
    setDailyTargetMinutes,
    todayTalkTimeSeconds,
    todayCallsCount,
    fetchTodayStats
  } = useCallStatus();

  // Search lead
  const [searchTerm, setSearchTerm] = useState("");
  const [allLeads, setAllLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  // Standalone Timer
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [customNote, setCustomNote] = useState("");
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [successToast, setSuccessToast] = useState("");

  const intervalRef = useRef(null);

  useEffect(() => {
    if (isTimerRunning) {
      intervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isTimerRunning]);

  // Load leads for search
  useEffect(() => {
    if (isOpen) {
      const fetchLeads = async () => {
        try {
          setLoadingLeads(true);
          const res = await axios.get("/api/leads");
          if (res.data && res.data.success) {
            setAllLeads(res.data.data || []);
          }
        } catch (err) {
          console.warn("Failed to fetch leads for timer search:", err);
        } finally {
          setLoadingLeads(false);
        }
      };
      fetchLeads();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = (secs) => {
    const s = Math.max(0, parseInt(secs, 10) || 0);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const remainder = s % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  };

  const goalSecs = (dailyTargetMinutes || 90) * 60;
  const currentTotalToday = todayTalkTimeSeconds + (isTimerRunning ? timerSeconds : 0);
  const progressPercent = Math.min(100, Math.round((currentTotalToday / goalSecs) * 100));

  // Filtered leads list
  const filteredLeads = searchTerm.trim()
    ? allLeads
        .filter(
          (l) =>
            (l.name && l.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (l.phone && l.phone.includes(searchTerm)) ||
            (l.leadId && l.leadId.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        .slice(0, 10)
    : [];

  const handleStartTimer = () => setIsTimerRunning(true);
  const handlePauseTimer = () => setIsTimerRunning(false);
  const handleResetTimer = () => {
    setTimerSeconds(0);
    setIsTimerRunning(false);
  };
  const handleAddSeconds = (secs) => setTimerSeconds((prev) => Math.max(0, prev + secs));

  const handleLogOutcome = async (opt) => {
    if (!selectedLead) {
      alert("Please select a lead first before logging talk time.");
      return;
    }

    try {
      setSavingOutcome(true);
      setIsTimerRunning(false);

      const res = await axios.post(`/api/leads/${selectedLead._id}/call-log`, {
        duration: timerSeconds,
        outcome: opt.outcome,
        snoozeDays: opt.snoozeDays || null,
        customNote: customNote,
        stage: opt.stage || null,
        isVoicemailPool: opt.isVoicemailPool !== undefined ? opt.isVoicemailPool : undefined
      });

      if (res.data && res.data.success) {
        setSuccessToast(`✓ Logged "${opt.outcome}" (${formatTime(timerSeconds)}) to ${selectedLead.name}!`);
        if (typeof onLeadUpdated === "function") {
          onLeadUpdated(res.data.data);
        }
        fetchTodayStats();

        setTimeout(() => {
          setSuccessToast("");
          setTimerSeconds(0);
          setCustomNote("");
          setSelectedLead(null);
          setSearchTerm("");
        }, 2500);
      }
    } catch (err) {
      alert("Failed to log call: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingOutcome(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem"
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "var(--surface, #ffffff)",
          borderRadius: "14px",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.3)",
          overflow: "hidden",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
            color: "#ffffff",
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "1.3rem" }}>⏱️</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>Universal Call Timer & Stopwatch</div>
              <div style={{ fontSize: "0.75rem", opacity: 0.9 }}>
                Start timer manually when lead answers • Works for ALL leads
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "#ffffff",
              borderRadius: "6px",
              width: "28px",
              height: "28px",
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: 800
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px" }}>
          
          {/* Daily Goal Mini Banner */}
          <div
            style={{
              background: "var(--surface2, #f8fafc)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "8px",
              padding: "10px 14px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>
                🎯 Daily Talk-Time Goal: {Math.floor(currentTotalToday / 60)}m / {dailyTargetMinutes}m ({progressPercent}%)
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--text3, #64748b)" }}>
                Calls: {todayCallsCount}
              </span>
            </div>
            <div style={{ height: "6px", background: "var(--border, #e2e8f0)", borderRadius: "3px", overflow: "hidden" }}>
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: "100%",
                  background: progressPercent >= 100 ? "#059669" : "#4f46e5",
                  transition: "width 0.4s ease"
                }}
              />
            </div>
          </div>

          {/* Step 1: Select Lead */}
          {!selectedLead ? (
            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "6px" }}>
                1. Select Any Lead to Time:
              </label>
              <input
                type="text"
                placeholder="Search lead by name, phone (+91), or lead ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: "0.85rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border, #cbd5e1)",
                  background: "var(--surface, #ffffff)",
                  color: "var(--text, #0f172a)"
                }}
                autoFocus
              />

              {loadingLeads && <div style={{ fontSize: "0.75rem", color: "var(--text3)", marginTop: "4px" }}>Searching leads...</div>}

              {filteredLeads.length > 0 && (
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
                  {filteredLeads.map((l) => (
                    <div
                      key={l._id}
                      onClick={() => {
                        setSelectedLead(l);
                        setSearchTerm("");
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
                        <div style={{ fontSize: "0.72rem", color: "var(--text2)" }}>{l.course || "General"} • {l.stage}</div>
                      </div>
                      <span style={{ color: "#059669", fontWeight: 700, fontSize: "0.78rem" }}>Select →</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid #10b981",
                borderRadius: "8px",
                padding: "10px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#065f46" }}>
                  Calling: {selectedLead.name}
                </div>
                <div style={{ fontSize: "0.78rem", color: "#047857" }}>
                  📞 {selectedLead.phone} • {selectedLead.course || "General"}
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => initiateCall(selectedLead)}
                  style={{
                    background: "#4f46e5",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "5px 9px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                  title="Trigger Ozonetel CTC"
                >
                  📞 Dial Ozonetel
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLead(null)}
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

          {/* Step 2: Live Stopwatch Timer Display */}
          <div
            style={{
              background: isTimerRunning ? "rgba(16, 185, 129, 0.12)" : "var(--surface2, #f8fafc)",
              border: isTimerRunning ? "2px solid #10b981" : "1px solid var(--border, #e2e8f0)",
              borderRadius: "12px",
              padding: "16px",
              textAlign: "center"
            }}
          >
            <div
              style={{
                fontSize: "0.78rem",
                fontWeight: 800,
                color: isTimerRunning ? "#059669" : "var(--text3)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "4px"
              }}
            >
              {isTimerRunning ? "🟢 CALL CONNECTED • TIMER RUNNING" : "STANDALONE CALL STOPWATCH"}
            </div>

            <div
              style={{
                fontSize: "3rem",
                fontWeight: 900,
                fontFamily: "monospace",
                color: isTimerRunning ? "#047857" : "var(--text, #0f172a)",
                margin: "4px 0 12px 0"
              }}
            >
              {formatTime(timerSeconds)}
            </div>

            {/* Timer Controls */}
            {!isTimerRunning ? (
              <button
                type="button"
                onClick={handleStartTimer}
                style={{
                  width: "100%",
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 16px",
                  fontSize: "1rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.35)"
                }}
              >
                <span>▶</span>
                <span>{timerSeconds > 0 ? "RESUME TIMER" : "START TIMER (Person Picked Up)"}</span>
              </button>
            ) : (
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={handlePauseTimer}
                  style={{
                    flex: 1,
                    background: "#f59e0b",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px",
                    fontSize: "0.9rem",
                    fontWeight: 800,
                    cursor: "pointer"
                  }}
                >
                  ⏸️ Pause Timer
                </button>
                <button
                  type="button"
                  onClick={handleResetTimer}
                  style={{
                    background: "var(--surface)",
                    color: "var(--text2)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  🔄 Reset
                </button>
              </div>
            )}

            {/* Quick Adjust Buttons */}
            <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginTop: "10px" }}>
              {[
                { label: "+30s", secs: 30 },
                { label: "+1m", secs: 60 },
                { label: "+2m", secs: 120 },
                { label: "+3m", secs: 180 },
                { label: "+5m", secs: 300 }
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleAddSeconds(p.secs)}
                  style={{
                    background: "var(--surface, #ffffff)",
                    border: "1px solid var(--border, #cbd5e1)",
                    borderRadius: "4px",
                    padding: "3px 8px",
                    fontSize: "0.72rem",
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

          {/* Success Toast */}
          {successToast && (
            <div
              style={{
                background: "#059669",
                color: "#ffffff",
                padding: "8px 14px",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.85rem",
                textAlign: "center"
              }}
            >
              {successToast}
            </div>
          )}

          {/* Step 3: 1-Click Outcome Logging with Duration */}
          <div>
            <div style={{ fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "8px" }}>
              Log Outcome with Duration ({formatTime(timerSeconds)}):
            </div>

            <input
              type="text"
              placeholder="Add optional note..."
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px",
                fontSize: "0.78rem",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                marginBottom: "8px"
              }}
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
              {OUTCOME_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  disabled={savingOutcome}
                  onClick={() => handleLogOutcome(opt)}
                  style={{
                    background: "var(--surface2, #f8fafc)",
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: "6px",
                    padding: "7px 4px",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    cursor: savingOutcome ? "not-allowed" : "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "2px"
                  }}
                >
                  <span style={{ fontSize: "0.95rem" }}>{opt.icon}</span>
                  <span style={{ textAlign: "center", lineHeight: 1.1 }}>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
