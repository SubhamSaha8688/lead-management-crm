import React from "react";
import { Link } from "react-router-dom";

export default function NotificationPanel({ conflicts, overdue, todayFollowUps, staleLeads = [], onClose }) {
  const totalCount =
    (conflicts ? conflicts.length : 0) +
    (overdue ? overdue.length : 0) +
    (todayFollowUps ? todayFollowUps.length : 0) +
    (staleLeads ? staleLeads.length : 0);

  const formatTime12 = (timeStr) => {
    if (!timeStr) return "";
    const parts = timeStr.split(":");
    if (parts.length < 2) return timeStr;
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? "PM" : "AM";
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${formattedHours}:${minutes} ${ampm}`;
  };

  return (
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

            {/* 4. Stale Leads Section (>7 Days Inactive) */}
            {staleLeads && staleLeads.length > 0 && (
              <div style={{ marginTop: "0.75rem" }}>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    color: "#f59e0b",
                    letterSpacing: "0.05em",
                    marginBottom: "0.35rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem"
                  }}
                >
                  <span>⏳</span> Stale Leads — Need Attention ({staleLeads.length})
                </div>
                {staleLeads.slice(0, 10).map((lead) => (
                  <Link
                    key={lead._id}
                    to={`/leads/${lead._id}`}
                    onClick={onClose}
                    className="notif-item"
                    style={{ borderLeft: "4px solid #f59e0b", textDecoration: "none" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text)" }}>
                        {lead.name}
                      </span>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: "#f59e0b"
                        }}
                      >
                        {lead.stage}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text2)" }}>
                      📞 {lead.phone || "No phone"} • {lead.quality}
                    </div>
                  </Link>
                ))}
                {staleLeads.length > 10 && (
                  <div style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text3)", marginTop: "0.25rem" }}>
                    +{staleLeads.length - 10} more stale leads
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
