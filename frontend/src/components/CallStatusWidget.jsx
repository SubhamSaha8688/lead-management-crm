import React, { useState } from "react";
import { useCallStatus } from "../context/CallStatusContext";
import { useWhatsAppBar } from "../context/WhatsAppBarContext";

const OUTCOME_OPTIONS = [
  { label: "Interested", icon: "🟢", outcome: "Connected — Interested" },
  { label: "Call Back", icon: "📞", outcome: "Connected — Call Back" },
  { label: "Voicemail", icon: "🎙️", outcome: "Voicemail" },
  { label: "No Answer", icon: "❌", outcome: "Not Connected" },
  { label: "Switched Off", icon: "🔴", outcome: "Switched Off" },
  { label: "Not Interested", icon: "⚠️", outcome: "Not Interested" }
];

export default function CallStatusWidget() {
  const {
    activeCall,
    isMinimized,
    isSavingOutcome,
    lastSavedOutcome,
    logOutcome,
    dismissCall,
    toggleMinimize
  } = useCallStatus();

  const { openWhatsAppBar } = useWhatsAppBar();

  const [copied, setCopied] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const [customNote, setCustomNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);

  if (!activeCall) return null;

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

  const handleSelectOutcome = async (outcome) => {
    await logOutcome(outcome, customNote);
    setCustomNote("");
    setShowNoteInput(false);
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
          background: "var(--surface, #ffffff)",
          color: "var(--text, #0f172a)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "30px",
          padding: "8px 16px",
          boxShadow: "var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.15))",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "0.85rem",
          fontWeight: 600,
          cursor: "pointer",
          animation: "fadeIn 0.2s ease"
        }}
        onClick={toggleMinimize}
        title="Click to expand call details"
      >
        <span
          style={{
            display: "inline-block",
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            background: activeCall.status === "queued" ? "#10b981" : "#f59e0b",
            boxShadow: activeCall.status === "queued" ? "0 0 8px #10b981" : "0 0 8px #f59e0b"
          }}
        />
        <span>
          📞 {activeCall.name}: {activeCall.status === "queued" ? "Call Queued" : "Connecting..."}
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
            color: "var(--text3, #94a3b8)",
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
        width: "380px",
        maxWidth: "calc(100vw - 2rem)",
        zIndex: 960,
        background: "var(--surface, #ffffff)",
        color: "var(--text, #0f172a)",
        borderRadius: "var(--radius-lg, 12px)",
        border: "1px solid var(--border, #e2e8f0)",
        boxShadow: "0 12px 36px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08)",
        overflow: "hidden",
        animation: "slideInUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        display: "flex",
        flexDirection: "column"
      }}
    >
      {/* Top Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)",
          color: "#ffffff",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1rem"
            }}
          >
            📞
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.2 }}>
              Calling {activeCall.name}
            </div>
            <div style={{ fontSize: "0.75rem", opacity: 0.85 }}>
              Ozonetel CTC • Call #{activeCall.callCount}
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
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* Status indicator banner */}
        {activeCall.status === "connecting" ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "var(--warn-bg, #fffbeb)",
              border: "1px solid var(--warn, #f59e0b)",
              borderRadius: "8px",
              padding: "9px 12px",
              color: "var(--text, #0f172a)",
              fontSize: "0.82rem"
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                border: "2px solid #f59e0b",
                borderTopColor: "transparent",
                animation: "spin 0.8s linear infinite"
              }}
            />
            <div>
              <strong>Contacting Ozonetel...</strong>
              <div style={{ fontSize: "0.75rem", color: "var(--text2, #475569)" }}>
                Sending CTC request securely in background.
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              background: "var(--success-bg, #ecfdf5)",
              border: "1px solid var(--success, #10b981)",
              borderRadius: "8px",
              padding: "9px 12px",
              color: "var(--text, #0f172a)",
              fontSize: "0.82rem"
            }}
          >
            <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>✅</span>
            <div>
              <strong style={{ color: "var(--success, #059669)" }}>
                Call Queued with Ozonetel!
              </strong>
              <div style={{ fontSize: "0.75rem", color: "var(--text2, #475569)", marginTop: "2px" }}>
                Your phone will ring shortly. Answer to bridge to {activeCall.name}.
              </div>
            </div>
          </div>
        )}

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
            <div style={{ fontWeight: 600, color: "var(--text, #0f172a)" }}>
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
                fontWeight: 500
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
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center"
              }}
              title="Direct SIM Dial"
            >
              📱 Direct Dial
            </a>
          </div>
        </div>

        {/* Quick Actions Row: WhatsApp & Portal Status Hint */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            style={{
              flex: 1,
              background: "#25D366",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "7px 10px",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px"
            }}
          >
            💬 Open WhatsApp
          </button>
          <button
            type="button"
            onClick={() => setShowTroubleshoot((prev) => !prev)}
            style={{
              background: "var(--surface2, #f8fafc)",
              color: "var(--text2, #475569)",
              border: "1px solid var(--border, #cbd5e1)",
              borderRadius: "6px",
              padding: "7px 10px",
              fontSize: "0.78rem",
              cursor: "pointer",
              fontWeight: 500
            }}
            title="Troubleshooting tips for Ozonetel"
          >
            💡 Need Help?
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
            <div style={{ fontWeight: 600, color: "var(--text, #0f172a)", marginBottom: "4px" }}>
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
              <li>Set your agent status to <strong>Ready / Available</strong>.</li>
              <li>
                <a
                  href={activeCall.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--accent, #4f46e5)", fontWeight: 600 }}
                >
                  Click here to re-trigger CTC directly
                </a>{" "}
                if needed.
              </li>
            </ul>
          </div>
        )}

        {/* 1-Click Quick Outcome Logger */}
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
                fontWeight: 700,
                color: "var(--text2, #475569)",
                textTransform: "uppercase",
                letterSpacing: "0.03em"
              }}
            >
              Log Call Outcome:
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
                fontWeight: 600
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
                padding: "6px 10px",
                fontSize: "0.78rem",
                fontWeight: 600,
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <span>✓</span>
              <span>Saved outcome: "{lastSavedOutcome}"</span>
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
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "6px"
            }}
          >
            {OUTCOME_OPTIONS.map((opt) => (
              <button
                key={opt.outcome}
                type="button"
                disabled={isSavingOutcome}
                onClick={() => handleSelectOutcome(opt.outcome)}
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
                  padding: "6px 4px",
                  fontSize: "0.72rem",
                  fontWeight: 600,
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
                  if (!isSavingOutcome) e.currentTarget.style.borderColor = "var(--accent, #4f46e5)";
                }}
                onMouseLeave={(e) => {
                  if (!isSavingOutcome && lastSavedOutcome !== opt.outcome) {
                    e.currentTarget.style.borderColor = "var(--border, #e2e8f0)";
                  }
                }}
              >
                <span style={{ fontSize: "0.85rem" }}>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
