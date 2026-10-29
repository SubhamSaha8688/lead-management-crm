import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCallStatus } from "../context/CallStatusContext";
import { useWhatsAppBar } from "../context/WhatsAppBarContext";
import { useEmailBar } from "../context/EmailBarContext";
import { triggerOzonetelCall } from "../utils/ozonetel";

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

const TARGET_PRESETS = [60, 90, 120, 150, 180];

export default function CallStatusWidget() {
  const {
    activeCall,
    isMinimized,
    isSavingOutcome,
    lastSavedOutcome,
    timerSeconds,
    isTimerRunning,
    startTimer,
    pauseTimer,
    resetTimer,
    addTimerSeconds,
    dailyTargetMinutes,
    setDailyTargetMinutes,
    todayTalkTimeSeconds,
    todayCallsCount,
    logOutcome,
    dismissCall,
    toggleMinimize,
    settings
  } = useCallStatus();

  const navigate = useNavigate();
  const { openWhatsAppBar } = useWhatsAppBar();
  const { openEmailBar } = useEmailBar();

  const [copied, setCopied] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const [customNote, setCustomNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [customTargetInput, setCustomTargetInput] = useState("");
  const [showCustomSnooze, setShowCustomSnooze] = useState(false);
  const [widgetCustomDays, setWidgetCustomDays] = useState(30);

  // Dynamic Settings (Snooze Days & Timer Buttons)
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

  const outcomeOptions = useMemo(() => [
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

  if (!activeCall) return null;

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

  // Daily target calculation
  const goalSecs = (dailyTargetMinutes || 90) * 60;
  const currentTotalToday = todayTalkTimeSeconds + (isTimerRunning ? timerSeconds : 0);
  const progressPercent = Math.min(100, Math.round((currentTotalToday / goalSecs) * 100));
  const remainingMins = Math.max(0, Math.ceil((goalSecs - currentTotalToday) / 60));

  const handleCopyPhone = () => {
    if (activeCall.cleanPhone) {
      navigator.clipboard.writeText(activeCall.cleanPhone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenWhatsApp = () => {
    if (activeCall.lead) {
      openWhatsAppBar(activeCall.lead);
    }
  };

  const handleSelectOutcome = async (opt) => {
    await logOutcome(opt.outcome, {
      duration: timerSeconds,
      snoozeDays: opt.snoozeDays || null,
      customNote: customNote,
      stage: opt.stage || null,
      isVoicemailPool: opt.isVoicemailPool !== undefined ? opt.isVoicemailPool : undefined
    });
    setCustomNote("");
    setShowNoteInput(false);
  };

  const handleApplyCustomTarget = (e) => {
    e.preventDefault();
    const val = parseInt(customTargetInput, 10);
    if (!isNaN(val) && val > 0) {
      setDailyTargetMinutes(val);
      setShowTargetPicker(false);
      setCustomTargetInput("");
    }
  };

  // Minimized floating pill
  if (isMinimized) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: "1.5rem",
          right: "5.5rem",
          zIndex: 950,
          background: isTimerRunning ? "#064e3b" : "var(--surface, #ffffff)",
          color: isTimerRunning ? "#ffffff" : "var(--text, #0f172a)",
          border: isTimerRunning ? "1px solid #059669" : "1px solid var(--border, #e2e8f0)",
          borderRadius: "30px",
          padding: "8px 16px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "0.85rem",
          fontWeight: 700,
          cursor: "pointer",
          animation: "fadeIn 0.2s ease"
        }}
        onClick={toggleMinimize}
        title="Click to expand call timer"
      >
        <span
          style={{
            display: "inline-block",
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            background: isTimerRunning ? "#34d399" : "#f59e0b",
            boxShadow: isTimerRunning ? "0 0 8px #34d399" : "0 0 8px #f59e0b",
            animation: isTimerRunning ? "pulse 1.2s infinite" : "none"
          }}
        />
        <span>
          ⏱️ {formatTime(timerSeconds)} • {activeCall.name}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            dismissCall();
          }}
          style={{
            background: "none",
            border: "none",
            color: isTimerRunning ? "#a7f3d0" : "var(--text3, #94a3b8)",
            cursor: "pointer",
            fontSize: "1rem",
            marginLeft: "4px",
            padding: "0 4px",
            lineHeight: 1
          }}
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    );
  }

  // Full floating card on the bottom-right
  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        width: "400px",
        maxWidth: "calc(100vw - 2rem)",
        zIndex: 960,
        background: "var(--surface, #ffffff)",
        color: "var(--text, #0f172a)",
        borderRadius: "var(--radius-lg, 14px)",
        border: "1px solid var(--border, #e2e8f0)",
        boxShadow: "0 14px 40px rgba(0, 0, 0, 0.22), 0 3px 10px rgba(0, 0, 0, 0.1)",
        overflow: "hidden",
        animation: "slideInUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        display: "flex",
        flexDirection: "column"
      }}
    >
      {/* Top Header */}
      <div
        style={{
          background: isTimerRunning
            ? "linear-gradient(135deg, #059669 0%, #047857 100%)"
            : "linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)",
          color: "#ffffff",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          transition: "background 0.3s ease"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.1rem"
            }}
          >
            {isTimerRunning ? "⏱️" : "📞"}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.95rem", lineHeight: 1.2 }}>
              {activeCall.name}
            </div>
            <div style={{ fontSize: "0.75rem", opacity: 0.9 }}>
              {activeCall.status === "connecting"
                ? "Contacting Ozonetel..."
                : activeCall.status === "queued"
                ? "Call Queued with Ozonetel"
                : "Manual Call Session"} • Call #{activeCall.callCount || 1}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            type="button"
            onClick={toggleMinimize}
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              border: "none",
              color: "#ffffff",
              borderRadius: "4px",
              width: "26px",
              height: "26px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.9rem"
            }}
            title="Minimize"
          >
            —
          </button>
          <button
            type="button"
            onClick={dismissCall}
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              border: "none",
              color: "#ffffff",
              borderRadius: "4px",
              width: "26px",
              height: "26px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.9rem"
            }}
            title="Dismiss Call"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px", maxHeight: "80vh", overflowY: "auto" }}>
        
        {/* ======================================================== */}
        {/* 1. DEDICATED IN-CALL STOPWATCH TIMER (STARTS ON PICKUP)   */}
        {/* ======================================================== */}
        <div
          style={{
            background: isTimerRunning
              ? "rgba(16, 185, 129, 0.08)"
              : "var(--surface2, #f8fafc)",
            border: isTimerRunning
              ? "2px solid #10b981"
              : "1px solid var(--border, #e2e8f0)",
            borderRadius: "10px",
            padding: "12px",
            textAlign: "center",
            position: "relative",
            transition: "all 0.25s ease"
          }}
        >
          {/* Status Label */}
          <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "4px",
              color: isTimerRunning ? "#059669" : "var(--text3, #64748b)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px"
            }}
          >
            {isTimerRunning ? (
              <>
                <span
                  style={{
                    display: "inline-block",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#10b981",
                    boxShadow: "0 0 6px #10b981",
                    animation: "pulse 1s infinite"
                  }}
                />
                <span>Call Connected • Timer Running</span>
              </>
            ) : timerSeconds > 0 ? (
              <span>⏸️ Timer Paused</span>
            ) : (
              <span>⏳ Dialing / Ringing... (Tap below when person answers)</span>
            )}
          </div>

          {/* Big Digital Stopwatch */}
          <div
            style={{
              fontSize: "2.4rem",
              fontWeight: 900,
              fontFamily: "monospace",
              letterSpacing: "0.06em",
              lineHeight: 1.1,
              color: isTimerRunning
                ? "#047857"
                : timerSeconds > 0
                ? "var(--text, #0f172a)"
                : "var(--text3, #94a3b8)",
              margin: "4px 0 10px 0"
            }}
          >
            {formatTime(timerSeconds)}
          </div>

          {/* Main Action Button */}
          {!isTimerRunning ? (
            <button
              type="button"
              onClick={startTimer}
              style={{
                width: "100%",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "0.95rem",
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(16, 185, 129, 0.35)",
                transition: "transform 0.1s ease"
              }}
              title="Click the exact moment the lead answers or voicemail starts"
            >
              <span style={{ fontSize: "1.1rem" }}>▶</span>
              <span>{timerSeconds > 0 ? "RESUME TIMER" : "START TIMER (Person Picked Up)"}</span>
            </button>
          ) : (
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                onClick={pauseTimer}
                style={{
                  flex: 1,
                  background: "#f59e0b",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px"
                }}
              >
                <span>⏸️</span> Pause
              </button>
              <button
                type="button"
                onClick={resetTimer}
                style={{
                  background: "var(--surface2, #f1f5f9)",
                  color: "var(--text2, #475569)",
                  border: "1px solid var(--border, #cbd5e1)",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
                title="Reset call stopwatch back to 0"
              >
                🔄 Reset
              </button>
            </div>
          )}

          {/* Quick Duration Adjuster Presets */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "5px",
              marginTop: "8px",
              flexWrap: "wrap"
            }}
          >
            {timerIncrements.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => addTimerSeconds(p.secs)}
                style={{
                  background: "var(--surface, #ffffff)",
                  border: "1px solid var(--border, #cbd5e1)",
                  borderRadius: "4px",
                  padding: "3px 8px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: "var(--text2, #475569)",
                  cursor: "pointer"
                }}
                title={`Add ${p.label} to this call`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. DAILY TALK-TIME TARGET PROGRESS SECTION              */}
        {/* ======================================================== */}
        <div
          style={{
            background: "var(--surface2, #f8fafc)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "8px",
            padding: "9px 12px"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.78rem",
              fontWeight: 700,
              color: "var(--text, #0f172a)",
              marginBottom: "5px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span>🎯 Daily Goal:</span>
              <span style={{ color: "var(--accent, #4f46e5)" }}>
                {Math.floor(currentTotalToday / 60)}m / {dailyTargetMinutes}m ({progressPercent}%)
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowTargetPicker((prev) => !prev)}
              style={{
                background: "none",
                border: "none",
                color: "var(--accent, #4f46e5)",
                fontSize: "0.72rem",
                cursor: "pointer",
                fontWeight: 700,
                textDecoration: "underline"
              }}
            >
              ⚙️ Change Goal
            </button>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              height: "7px",
              background: "var(--border, #e2e8f0)",
              borderRadius: "4px",
              overflow: "hidden"
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                background:
                  progressPercent >= 100
                    ? "linear-gradient(90deg, #10b981 0%, #059669 100%)"
                    : "linear-gradient(90deg, #4f46e5 0%, #3b82f6 100%)",
                transition: "width 0.4s ease"
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.72rem",
              color: "var(--text3, #64748b)",
              marginTop: "4px"
            }}
          >
            <span>Calls Today: {todayCallsCount + 1}</span>
            <span>
              {progressPercent >= 100
                ? "🎉 Target Achieved!"
                : `${remainingMins}m remaining to hit goal`}
            </span>
          </div>

          {/* Collapsible Target Selector */}
          {showTargetPicker && (
            <div
              style={{
                marginTop: "8px",
                paddingTop: "8px",
                borderTop: "1px dashed var(--border, #cbd5e1)"
              }}
            >
              <div style={{ fontSize: "0.72rem", fontWeight: 700, marginBottom: "4px" }}>
                Select or Type Target Minutes:
              </div>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "6px" }}>
                {TARGET_PRESETS.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      setDailyTargetMinutes(mins);
                      setShowTargetPicker(false);
                    }}
                    style={{
                      background:
                        dailyTargetMinutes === mins
                          ? "var(--accent, #4f46e5)"
                          : "var(--surface, #ffffff)",
                      color: dailyTargetMinutes === mins ? "#ffffff" : "var(--text, #0f172a)",
                      border: "1px solid var(--border, #cbd5e1)",
                      borderRadius: "4px",
                      padding: "3px 8px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    {mins}m ({mins >= 60 ? `${(mins / 60).toFixed(1)}h` : `${mins}m`})
                  </button>
                ))}
              </div>
              <form onSubmit={handleApplyCustomTarget} style={{ display: "flex", gap: "4px" }}>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  placeholder="Custom minutes..."
                  value={customTargetInput}
                  onChange={(e) => setCustomTargetInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "4px 8px",
                    fontSize: "0.75rem",
                    borderRadius: "4px",
                    border: "1px solid var(--border, #cbd5e1)"
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: "var(--accent, #4f46e5)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "4px",
                    padding: "4px 10px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  Set
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Lead details summary row */}
        <div
          style={{
            background: "var(--surface2, #f8fafc)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "8px",
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.82rem"
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: "var(--text, #0f172a)" }}>
              +91 {activeCall.cleanPhone}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text3, #94a3b8)", marginTop: "2px" }}>
              {activeCall.course} • <span style={{ textTransform: "capitalize" }}>{activeCall.stage}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              onClick={handleCopyPhone}
              style={{
                background: "var(--surface, #ffffff)",
                border: "1px solid var(--border, #cbd5e1)",
                borderRadius: "4px",
                padding: "4px 8px",
                fontSize: "0.72rem",
                color: "var(--text2, #475569)",
                cursor: "pointer",
                fontWeight: 600
              }}
              title="Copy phone number"
            >
              {copied ? "✓ Copied" : "📋 Copy"}
            </button>
            <a
              href={`tel:+91${activeCall.cleanPhone}`}
              style={{
                background: "var(--accent-bg, #eef2ff)",
                border: "1px solid var(--accent, #6366f1)",
                borderRadius: "4px",
                padding: "4px 8px",
                fontSize: "0.72rem",
                color: "var(--accent, #4f46e5)",
                textDecoration: "none",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center"
              }}
              title="Direct SIM Dial"
            >
              📱 Direct Dial
            </a>
          </div>
        </div>

        {/* Quick Actions Row: WhatsApp, Email & Portal Status Hint */}
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            style={{
              flex: 1,
              background: "#25D366",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "7px 6px",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px"
            }}
            title="Open WhatsApp Messages Bar"
          >
            💬 WhatsApp
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeCall.lead) {
                const leadId = activeCall.lead._id || activeCall.lead.leadId;
                navigate(`/emails?leadId=${leadId}`);
              } else {
                navigate("/emails");
              }
            }}
            style={{
              flex: 1,
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "7px 6px",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px"
            }}
            title="Open Email Hub"
          >
            📧 Email
          </button>
          <button
            type="button"
            onClick={() => setShowTroubleshoot((prev) => !prev)}
            style={{
              background: "var(--surface2, #f8fafc)",
              color: "var(--text2, #475569)",
              border: "1px solid var(--border, #cbd5e1)",
              borderRadius: "6px",
              padding: "7px 8px",
              fontSize: "0.75rem",
              cursor: "pointer",
              fontWeight: 600
            }}
            title="Troubleshooting tips for Ozonetel"
          >
            💡 Help
          </button>
        </div>

        {/* Troubleshooting collapse */}
        {showTroubleshoot && (
          <div
            style={{
              background: "var(--surface2, #f8fafc)",
              border: "1px dashed var(--border, #cbd5e1)",
              borderRadius: "8px",
              padding: "10px",
              fontSize: "0.75rem",
              color: "var(--text2, #475569)",
              lineHeight: 1.4
            }}
          >
            <div style={{ fontWeight: 700, color: "var(--text, #0f172a)", marginBottom: "4px" }}>
              💡 Phone didn't ring or got "Agent not available"?
            </div>
            <ul style={{ paddingLeft: "16px", margin: 0 }}>
              <li>
                Ensure you are logged into the{" "}
                <a
                  href="https://crm.henryharvin.com/portal-new"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--accent, #4f46e5)", textDecoration: "underline" }}
                >
                  Henry Harvin Agent Portal
                </a>
                .
              </li>
              <li>Set status to <strong>Ready / Available</strong>.</li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      triggerOzonetelCall(activeCall.phone);
                    } catch (e) {
                      console.warn("Re-trigger error:", e);
                    }
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "var(--accent, #4f46e5)",
                    fontWeight: 700,
                    cursor: "pointer",
                    textDecoration: "underline",
                    font: "inherit"
                  }}
                >
                  Click here to re-trigger CTC
                </button>{" "}
                (silently in background) if needed.
              </li>
            </ul>
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. LOG OUTCOME WITH EXACT TALK-TIME DURATION             */}
        {/* ======================================================== */}
        <div style={{ borderTop: "1px solid var(--border, #e2e8f0)", paddingTop: "10px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px"
            }}
          >
            <span
              style={{
                fontSize: "0.78rem",
                fontWeight: 800,
                color: "var(--text2, #475569)",
                textTransform: "uppercase",
                letterSpacing: "0.03em"
              }}
            >
              End Call & Log Outcome ({formatTime(timerSeconds)}):
            </span>
            <button
              type="button"
              onClick={() => setShowNoteInput((prev) => !prev)}
              style={{
                background: "none",
                border: "none",
                color: "var(--accent, #4f46e5)",
                fontSize: "0.72rem",
                cursor: "pointer",
                fontWeight: 700
              }}
            >
              {showNoteInput ? "— Hide Note" : "+ Add Note"}
            </button>
          </div>

          {lastSavedOutcome && (
            <div
              style={{
                background: "var(--success-bg, #ecfdf5)",
                color: "var(--success, #059669)",
                border: "1px solid var(--success, #10b981)",
                borderRadius: "6px",
                padding: "8px 12px",
                fontSize: "0.82rem",
                fontWeight: 700,
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <span>✓</span>
              <span>Logged "{lastSavedOutcome}" with {formatTime(timerSeconds)} talk-time!</span>
            </div>
          )}

          {showNoteInput && (
            <input
              type="text"
              placeholder="Add optional note (e.g. Discussed fee discount)..."
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px",
                fontSize: "0.78rem",
                borderRadius: "6px",
                border: "1px solid var(--border, #cbd5e1)",
                background: "var(--surface, #ffffff)",
                color: "var(--text, #0f172a)",
                marginBottom: "8px"
              }}
            />
          )}

          {/* Outcome Buttons Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(78px, 1fr))",
              gap: "6px"
            }}
          >
            {outcomeOptions.map((opt) => (
              <button
                key={opt.label}
                type="button"
                disabled={isSavingOutcome}
                onClick={() => handleSelectOutcome(opt)}
                style={{
                  background:
                    lastSavedOutcome === opt.outcome
                      ? "var(--accent-bg, #eef2ff)"
                      : "var(--surface2, #f8fafc)",
                  border:
                    lastSavedOutcome === opt.outcome
                      ? "1px solid var(--accent, #4f46e5)"
                      : "1px solid var(--border, #e2e8f0)",
                  borderRadius: "6px",
                  padding: "7px 4px",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  color: "var(--text, #0f172a)",
                  cursor: isSavingOutcome ? "not-allowed" : "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "2px",
                  transition: "all 0.15s ease",
                  opacity: isSavingOutcome ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isSavingOutcome) e.currentTarget.style.borderColor = opt.color || "var(--accent, #4f46e5)";
                }}
                onMouseLeave={(e) => {
                  if (!isSavingOutcome && lastSavedOutcome !== opt.outcome) {
                    e.currentTarget.style.borderColor = "var(--border, #e2e8f0)";
                  }
                }}
                title={`Log "${opt.outcome}" with ${formatTime(timerSeconds)} talk-time`}
              >
                <span style={{ fontSize: "0.95rem" }}>{opt.icon}</span>
                <span style={{ textAlign: "center", lineHeight: 1.1 }}>{opt.label}</span>
              </button>
            ))}

            {/* Custom Snooze Action Button */}
            <button
              type="button"
              disabled={isSavingOutcome}
              onClick={() => setShowCustomSnooze((prev) => !prev)}
              style={{
                background: showCustomSnooze ? "var(--accent-bg, #eef2ff)" : "var(--surface2, #f8fafc)",
                border: showCustomSnooze ? "1px solid var(--accent, #4f46e5)" : "1px solid var(--border, #e2e8f0)",
                borderRadius: "6px",
                padding: "7px 4px",
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "var(--text, #0f172a)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2px"
              }}
              title="Set custom days cooldown / snooze timeout"
            >
              <span style={{ fontSize: "0.95rem" }}>⏱️</span>
              <span style={{ textAlign: "center", lineHeight: 1.1 }}>Custom Snooze</span>
            </button>
          </div>

          {/* Floating Widget Custom Snooze Panel */}
          {showCustomSnooze && (
            <div
              style={{
                marginTop: "8px",
                padding: "8px 10px",
                background: "var(--surface2, #f8fafc)",
                border: "1px solid var(--accent, #4f46e5)",
                borderRadius: "6px",
                display: "flex",
                flexDirection: "column",
                gap: "6px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text)" }}>
                  💤 Custom Snooze Days:
                </span>
                <button
                  type="button"
                  onClick={() => setShowCustomSnooze(false)}
                  style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "0.8rem" }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={widgetCustomDays}
                  onChange={(e) => setWidgetCustomDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  style={{
                    width: "60px",
                    padding: "4px 6px",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    borderRadius: "4px",
                    border: "1px solid var(--border)"
                  }}
                />
                <span style={{ fontSize: "0.75rem", color: "var(--text2)" }}>days</span>

                <button
                  type="button"
                  disabled={isSavingOutcome}
                  onClick={() => {
                    handleSelectOutcome({
                      outcome: `Custom Snooze (${widgetCustomDays} Days)`,
                      snoozeDays: widgetCustomDays,
                      color: "#6366f1"
                    });
                    setShowCustomSnooze(false);
                  }}
                  className="btn btn-primary btn-sm"
                  style={{
                    padding: "4px 10px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    marginLeft: "auto"
                  }}
                >
                  Confirm Snooze
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
