import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { getCachedLeads, setCachedLeads, fetchLeadsOptimized } from "../utils/leadsCache";

export default function Calendar({ onDataChange }) {
  const [leads, setLeads] = useState(() => getCachedLeads());
  const [loading, setLoading] = useState(() => getCachedLeads().length === 0);
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  // Reschedule Modal
  const [rescheduleLead, setRescheduleLead] = useState(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [savingReschedule, setSavingReschedule] = useState(false);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async (forceFresh = false) => {
    try {
      if (leads.length === 0) setLoading(true);
      const data = await fetchLeadsOptimized(forceFresh);
      if (Array.isArray(data)) {
        setLeads(data);
      }
    } catch (err) {
      console.error("Failed to load leads:", err);
    } finally {
      setLoading(false);
    }
  };

  const toDateKey = (d) => {
    if (!d) return "";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

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

  const getFollowUpDateTime = (lead) => {
    if (!lead.followUpDate) return null;
    const base = new Date(lead.followUpDate);
    if (isNaN(base.getTime())) return null;

    let h = 0;
    let m = 0;
    if (lead.followUpTime && lead.followUpTime.includes(":")) {
      const parts = lead.followUpTime.split(":");
      h = parseInt(parts[0], 10) || 0;
      m = parseInt(parts[1], 10) || 0;
    }

    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
  };

  const now = new Date();
  const todayKey = toDateKey(now);

  // Group leads by followUpDate key
  const leadsByDate = useMemo(() => {
    const map = {};
    leads.forEach((l) => {
      if (!l.followUpDate) return;
      const key = toDateKey(l.followUpDate);
      if (!map[key]) map[key] = [];
      map[key].push(l);
    });

    // Sort leads inside each date by exact time
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => {
        const dtA = getFollowUpDateTime(a);
        const dtB = getFollowUpDateTime(b);
        return dtA - dtB;
      });
    });

    return map;
  }, [leads]);

  // Overdue leads calculation
  const overdueLeads = useMemo(() => {
    const list = leads.filter((l) => {
      if (!l.followUpDate) return false;
      if (l.stage === "Converted" || l.stage === "Lost") return false;
      const dt = getFollowUpDateTime(l);
      return dt && dt.getTime() < now.getTime();
    });

    list.sort((a, b) => getFollowUpDateTime(a) - getFollowUpDateTime(b));
    return list;
  }, [leads, now]);

  // Today's Follow-ups
  const todayLeads = useMemo(() => {
    return (leadsByDate[todayKey] || []).filter(
      (l) => l.stage !== "Converted" && l.stage !== "Lost"
    );
  }, [leadsByDate, todayKey]);

  // Upcoming Future Leads
  const upcomingLeads = useMemo(() => {
    return leads.filter((l) => {
      if (!l.followUpDate) return false;
      if (l.stage === "Converted" || l.stage === "Lost") return false;
      const dt = getFollowUpDateTime(l);
      return dt && dt.getTime() >= now.getTime();
    });
  }, [leads, now]);

  // Month Navigation
  const prevMonth = () => {
    setCurrentMonthDate(
      new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1)
    );
  };

  const nextMonth = () => {
    setCurrentMonthDate(
      new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1)
    );
  };

  // Build Calendar Days for Current Month
  const calendarDays = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];

    // Empty padding slots for days before 1st of month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }

    // Days of month
    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(month + 1).padStart(2, "0");
      const dayStr = String(d).padStart(2, "0");
      const dateKey = `${year}-${monthStr}-${dayStr}`;

      days.push({
        dayNumber: d,
        dateKey: dateKey,
        leads: leadsByDate[dateKey] || []
      });
    }

    return days;
  }, [currentMonthDate, leadsByDate]);

  // Generate Google Calendar Link
  const getGoogleCalendarUrl = (lead) => {
    if (!lead.followUpDate) return "#";
    const dt = getFollowUpDateTime(lead) || new Date(lead.followUpDate);

    // Format ISO string to YYYYMMDDTHHmmSSZ
    const startIso = dt.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const endDt = new Date(dt.getTime() + 30 * 60 * 1000); // 30 min duration
    const endIso = endDt.toISOString().replace(/-|:|\.\d\d\d/g, "");

    const title = encodeURIComponent(`Follow-up Call: ${lead.name} (${lead.phone || "No phone"})`);
    const details = encodeURIComponent(
      `Lead ID: ${lead.leadId}\nPhone: ${lead.phone}\nStage: ${lead.stage}\nPriority: P${lead.priority}\nReminder Note: ${lead.reminderNote || "None"}\nNext Action: ${lead.nextAction || "None"}`
    );

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}`;
  };

  // Quick Reschedule Save
  const handleSaveReschedule = async () => {
    if (!rescheduleLead) return;
    try {
      setSavingReschedule(true);
      const res = await axios.patch(`/api/leads/${rescheduleLead._id}/quick`, {
        followUpDate: newDate ? new Date(newDate) : null,
        followUpTime: newTime ? newTime.trim() : ""
      });

      if (res.data && res.data.success) {
        setLeads((prev) =>
          prev.map((l) => (l._id === rescheduleLead._id ? res.data.data : l))
        );
        setRescheduleLead(null);
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      alert("Failed to reschedule: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingReschedule(false);
    }
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const selectedDayLeads = leadsByDate[selectedDateStr] || [];

  return (
    <div className="page">
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text)" }}>
          📅 Follow-up Schedule Calendar
        </h1>
        <p style={{ color: "var(--text2)", fontSize: "0.9rem" }}>
          Monthly overview of sales call appointments, overdue alerts, and Google Calendar sync.
        </p>
      </div>

      {/* CALENDAR SUMMARY STATS */}
      <div className="stat-grid" style={{ marginBottom: "1.5rem" }}>
        <div className="stat-card">
          <div className="stat-card-title">Due Today</div>
          <div className="stat-card-value" style={{ color: "var(--accent)" }}>
            {todayLeads.length}
          </div>
          <div className="stat-card-sub">Appointments scheduled today</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-title" style={{ color: "#dc2626" }}>
            Overdue
          </div>
          <div className="stat-card-value" style={{ color: "#dc2626" }}>
            {overdueLeads.length}
          </div>
          <div className="stat-card-sub">Missed follow-up time</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-title" style={{ color: "#059669" }}>
            Upcoming
          </div>
          <div className="stat-card-value" style={{ color: "#059669" }}>
            {upcomingLeads.length}
          </div>
          <div className="stat-card-sub">Future scheduled calls</div>
        </div>
      </div>

      {/* OVERDUE CALLS ALERT PANEL (IF ANY) */}
      {overdueLeads.length > 0 && (
        <div
          className="card"
          style={{
            borderLeft: "5px solid var(--danger)",
            background: "var(--surface)",
            padding: "1.25rem",
            marginBottom: "1.5rem"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.75rem"
            }}
          >
            <div
              style={{
                fontWeight: 800,
                color: "var(--danger)",
                fontSize: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem"
              }}
            >
              <span>🔴</span> OVERDUE FOLLOW-UPS ({overdueLeads.length})
            </div>
            <span style={{ fontSize: "0.8rem", color: "var(--text3)" }}>
              Call immediately or reschedule
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {overdueLeads.slice(0, 5).map((lead) => {
              const dt = getFollowUpDateTime(lead);
              const diffHours = dt ? Math.round((now.getTime() - dt.getTime()) / (1000 * 60 * 60)) : 0;

              return (
                <div
                  key={lead._id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    padding: "0.6rem 0.85rem",
                    background: "var(--surface2)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)"
                  }}
                >
                  <div>
                    <strong style={{ color: "var(--text)" }}>{lead.name}</strong>{" "}
                    <span style={{ fontSize: "0.85rem", color: "var(--text2)" }}>
                      ({lead.phone || "No phone"})
                    </span>
                    <div style={{ fontSize: "0.75rem", color: "var(--danger)", fontWeight: 600 }}>
                      Was due: {formatTime12(lead.followUpTime)} ({diffHours > 0 ? `${diffHours}h overdue` : "Due earlier today"})
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <a
                      href={lead.phone ? `tel:${lead.phone}` : "#"}
                      className="btn btn-primary btn-sm"
                    >
                      📞 Call
                    </a>
                    <Link to={`/leads/${lead._id}`} className="btn btn-secondary btn-sm">
                      Open
                    </Link>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setRescheduleLead(lead);
                        setNewDate(todayKey);
                        setNewTime("11:00");
                      }}
                    >
                      Reschedule
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CALENDAR MAIN WORKSPACE: GRID + SIDE PANEL */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "1.5rem"
        }}
      >
        {/* Left: Monthly Calendar Grid */}
        <div className="card-padded" style={{ flex: 2 }}>
          {/* Calendar Month Navigation Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem"
            }}
          >
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text)" }}>
              {monthNames[currentMonthDate.getMonth()]} {currentMonthDate.getFullYear()}
            </h2>

            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={prevMonth}
                aria-label="Previous Month"
              >
                ◀ Prev
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentMonthDate(new Date())}
              >
                Today
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={nextMonth}
                aria-label="Next Month"
              >
                Next ▶
              </button>
            </div>
          </div>

          {/* Weekday Labels Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              textAlign: "center",
              fontWeight: 700,
              fontSize: "0.8rem",
              color: "var(--text2)",
              paddingBottom: "0.5rem",
              borderBottom: "1px solid var(--border)"
            }}
          >
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Day Grid Cells */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "4px",
              marginTop: "4px"
            }}
          >
            {calendarDays.map((cell, idx) => {
              if (!cell) {
                return (
                  <div
                    key={`empty-${idx}`}
                    style={{
                      minHeight: "75px",
                      background: "transparent"
                    }}
                  />
                );
              }

              const isToday = cell.dateKey === todayKey;
              const isSelected = cell.dateKey === selectedDateStr;

              return (
                <div
                  key={cell.dateKey}
                  onClick={() => setSelectedDateStr(cell.dateKey)}
                  style={{
                    minHeight: "85px",
                    border: isSelected
                      ? "2px solid var(--accent)"
                      : isToday
                      ? "2px solid #059669"
                      : "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "4px",
                    background: isSelected
                      ? "var(--accent-bg)"
                      : isToday
                      ? "var(--surface2)"
                      : "var(--surface)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                    overflow: "hidden"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.78rem",
                      fontWeight: isToday ? 800 : 600,
                      color: isToday ? "#059669" : "var(--text)"
                    }}
                  >
                    <span>{cell.dayNumber}</span>
                    {cell.leads.length > 0 && (
                      <span
                        style={{
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          background: isToday ? "#059669" : "var(--accent)",
                          color: "#ffffff",
                          borderRadius: "9999px",
                          padding: "0 4px"
                        }}
                      >
                        {cell.leads.length}
                      </span>
                    )}
                  </div>

                  {/* Chips for leads scheduled this day */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden" }}>
                    {cell.leads.slice(0, 3).map((lead) => (
                      <div
                        key={lead._id}
                        style={{
                          fontSize: "0.68rem",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          padding: "1px 3px",
                          borderRadius: "2px",
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          color: "var(--text)"
                        }}
                        title={`${lead.followUpTime || ""} ${lead.name}`}
                      >
                        {lead.followUpTime ? lead.followUpTime.slice(0, 5) : ""} {lead.name}
                      </div>
                    ))}
                    {cell.leads.length > 3 && (
                      <div style={{ fontSize: "0.65rem", color: "var(--text3)", textAlign: "center" }}>
                        +{cell.leads.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Date Side Panel */}
        <div className="card-padded" style={{ flex: 1, minWidth: "300px" }}>
          <h3 className="section-title">
            <span>📅</span>
            <span>{selectedDateStr === todayKey ? "Today's Follow-ups" : `Schedule for ${selectedDateStr}`}</span>
          </h3>

          {selectedDayLeads.length === 0 ? (
            <div
              style={{
                padding: "2rem 1rem",
                textAlign: "center",
                color: "var(--text3)",
                fontSize: "0.88rem"
              }}
            >
              No follow-ups scheduled for this date.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {selectedDayLeads.map((lead) => {
                const googleCalUrl = getGoogleCalendarUrl(lead);

                return (
                  <div
                    key={lead._id}
                    style={{
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      padding: "0.85rem"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "0.35rem"
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "0.95rem", color: "var(--text)" }}>
                          {lead.name}
                        </strong>
                        <div style={{ fontSize: "0.78rem", color: "var(--text2)" }}>
                          📞 {lead.phone || "No phone"} • {lead.quality}
                        </div>
                      </div>

                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: "0.82rem",
                          color: "var(--accent)"
                        }}
                      >
                        {formatTime12(lead.followUpTime) || "Anytime"}
                      </span>
                    </div>

                    {lead.reminderNote && (
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text2)",
                          marginBottom: "0.6rem",
                          fontStyle: "italic"
                        }}
                      >
                        📌 {lead.reminderNote}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                      <Link to={`/leads/${lead._id}`} className="btn btn-secondary btn-sm">
                        View Lead
                      </Link>

                      <a
                        href={googleCalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-outline btn-sm"
                        title="Add this follow-up call to your Google Calendar"
                      >
                        📅 Add to Google Cal
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* QUICK RESCHEDULE MODAL */}
      {rescheduleLead && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              ✏️ Reschedule Follow-up
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text2)", marginBottom: "1rem" }}>
              Update follow-up appointment for <strong>{rescheduleLead.name}</strong>
            </p>

            <div className="form-group">
              <label>Follow-up Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Follow-up Time</label>
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRescheduleLead(null)}
                disabled={savingReschedule}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveReschedule}
                disabled={savingReschedule}
              >
                {savingReschedule ? "Saving..." : "Save Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
