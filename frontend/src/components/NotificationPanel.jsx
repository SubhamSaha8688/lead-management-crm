import React, { useEffect } from "react";
import { Link } from "react-router-dom";

export default function NotificationPanel({ conflicts, overdue, todayFollowUps, onClose }) {
  const totalCount =
    (conflicts ? conflicts.length : 0) +
    (overdue ? overdue.length : 0) +
    (todayFollowUps ? todayFollowUps.length : 0);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const formatTime12 = (timeStr) => {
    if (!timeStr) return "";
    if (timeStr instanceof Date && !isNaN(timeStr.getTime())) {
      let h = timeStr.getHours();
      const m = String(timeStr.getMinutes()).padStart(2, "0");
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h}:${m} ${ampm}`;
    }

    let clean = String(timeStr).trim();
    if (!clean) return "";

    if (clean.includes("T") || (clean.includes("-") && clean.includes(":"))) {
      const parsedDate = new Date(clean);
      if (!isNaN(parsedDate.getTime())) {
        let h = parsedDate.getHours();
        const m = String(parsedDate.getMinutes()).padStart(2, "0");
        const ampm = h >= 12 ? "PM" : "AM";
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
      }
    }

    clean = clean.replace(/\b(am|pm)\s*(am|pm)\b/gi, "$1");

    const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (match12) {
      let h = parseInt(match12[1], 10);
      const m = match12[2];
      const ampm = match12[3].toUpperCase();
      if (h === 0) h = 12;
      else if (h > 12) h = h % 12;
      return `${h}:${m} ${ampm}`;
    }

    const parts = clean.split(":");
    if (parts.length >= 2) {
      const hours = parseInt(parts[0], 10);
      if (!isNaN(hours)) {
        const minutes = (parts[1] || "").replace(/[^0-9]/g, "").padStart(2, "0").slice(0, 2) || "00";
        const ampm = hours >= 12 ? "PM" : "AM";
        const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
        return `${formattedHours}:${minutes} ${ampm}`;
      }
    }

    return clean;
  };

  return (
    <>
      <div
        className="notif-backdrop"
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999,
          background: "rgba(0,0,0,0.15)"
        }}
        aria-hidden="true"
      />
      <div className="notif-panel" role="dialog" aria-label="Notifications panel">
        {/* Panel Header */}
        <div className="notif-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>🔔 Notifications</span>
          {totalCount > 0 && (
            <span
              style={{
                fontSize: "0.75rem",
                padding: "0.15rem 0.5rem",
                background: "#fee2e2",
                color: "#b91c1c",
                borderRadius: "9999px",
                fontWeight: 700
              }}
            >
              {totalCount}
            </span>
          )}
        </div>
        <button
          type="button"
          className="btn-icon"
          onClick={onClose}
          aria-label="Close notifications"
          style={{ width: "28px", height: "28px", padding: 0 }}
        >
          ✕
        </button>
      </div>

      {/* Panel Content */}
      <div className="notif-body">
        {totalCount === 0 ? (
          <div
            style={{
              padding: "2.5rem 1rem",
              textAlign: "center",
              color: "var(--text3)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.5rem"
            }}
          >
            <span style={{ fontSize: "2rem" }}>🎉</span>
            <span style={{ fontWeight: 700, color: "var(--text)" }}>All clear!</span>
            <span style={{ fontSize: "0.85rem" }}>No overdue calls or conflicts right now.</span>
          </div>
        ) : (
          <>
            {/* 1. Conflicts Section */}
            {conflicts && conflicts.length > 0 && (
              <div style={{ marginBottom: "0.5rem" }}>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    color: "var(--warn)",
                    letterSpacing: "0.05em",
                    marginBottom: "0.35rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem"
                  }}
                >
                  <span>⚠️</span> Schedule Conflicts ({conflicts.length})
                </div>
                {conflicts.map((conf, idx) => (
                  <div
                    key={`conf-${idx}`}
                    className="notif-item"
                    style={{ borderLeft: "4px solid var(--warn)" }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text)" }}>
                      {conf.count} leads scheduled at {formatTime12(conf.time)}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text2)" }}>
                      {conf.leads.map((l) => l.name).join(", ")}
                    </div>
                    <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.35rem" }}>
                      {conf.leads.map((l) => (
                        <Link
                          key={l._id}
                          to={`/leads/${l._id}`}
                          onClick={onClose}
                          style={{
                            fontSize: "0.72rem",
                            color: "#4f46e5",
                            textDecoration: "underline",
                            fontWeight: 600
                          }}
                        >
                          {l.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 2. Overdue Section */}
            {overdue && overdue.length > 0 && (
              <div style={{ marginBottom: "0.5rem" }}>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    color: "var(--danger)",
                    letterSpacing: "0.05em",
                    marginBottom: "0.35rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem"
                  }}
                >
                  <span>🔴</span> Overdue Follow-ups ({overdue.length})
                </div>
                {overdue.map((lead) => (
                  <Link
                    key={lead._id}
                    to={`/leads/${lead._id}`}
                    onClick={onClose}
                    className="notif-item"
                    style={{ borderLeft: "4px solid var(--danger)", textDecoration: "none" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text)" }}>
                        {lead.name}
                      </span>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: "var(--danger)"
                        }}
                      >
                        {formatTime12(lead.followUpTime)}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text2)" }}>
                      📞 {lead.phone || "No phone"} • {lead.quality}
                    </div>
                    {lead.reminderNote && (
                      <div
                        style={{
                          fontSize: "0.74rem",
                          color: "var(--text3)",
                          fontStyle: "italic"
                        }}
                      >
                        "{lead.reminderNote.slice(0, 50)}..."
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}

            {/* 3. Today's Upcoming Follow-ups */}
            {todayFollowUps && todayFollowUps.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    color: "var(--success)",
                    letterSpacing: "0.05em",
                    marginBottom: "0.35rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem"
                  }}
                >
                  <span>📅</span> Today's Follow-ups ({todayFollowUps.length})
                </div>
                {todayFollowUps.map((lead) => (
                  <Link
                    key={lead._id}
                    to={`/leads/${lead._id}`}
                    onClick={onClose}
                    className="notif-item"
                    style={{ borderLeft: "4px solid var(--success)", textDecoration: "none" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text)" }}>
                        {lead.name}
                      </span>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: "var(--success)"
                        }}
                      >
                        {formatTime12(lead.followUpTime)}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text2)" }}>
                      📞 {lead.phone || "No phone"} • P{lead.priority}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
    </>
  );
}
