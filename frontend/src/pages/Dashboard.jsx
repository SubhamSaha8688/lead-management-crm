import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { exportLeadsToExcel } from "../utils/exportExcel";
import { getWhatsAppUrl, generateWhatsAppMessage } from "../utils/whatsapp";
import { useWhatsAppBar } from "../context/WhatsAppBarContext";
import { useEmailBar } from "../context/EmailBarContext";
import { useCallStatus } from "../context/CallStatusContext";

export default function Dashboard({ onDataChange }) {
  const { openWhatsAppBar } = useWhatsAppBar();
  const { openEmailBar } = useEmailBar();
  const { initiateCall } = useCallStatus();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [activePreset, setActivePreset] = useState("all");
  const [qualityFilter, setQualityFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [enquiryFrom, setEnquiryFrom] = useState("");
  const [enquiryTo, setEnquiryTo] = useState("");
  const [followUpFrom, setFollowUpFrom] = useState("");
  const [followUpTo, setFollowUpTo] = useState("");

  // Sorting
  const [sortField, setSortField] = useState("createdAt");
  const [sortAsc, setSortAsc] = useState(false);

  // Quick Reschedule Popover State
  const [rescheduleLead, setRescheduleLead] = useState(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [savingQuick, setSavingQuick] = useState(false);

  // Quality dropdown inline popover
  const [activeQualityMenuLeadId, setActiveQualityMenuLeadId] = useState(null);

  // Delete Lead Modal State
  const [leadToDelete, setLeadToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkRescheduling, setBulkRescheduling] = useState(false);

  // Success notification toast
  const [toastMessage, setToastMessage] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  // Sync searchTerm with URL query parameter ?search= (from Global Navbar Search)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchParam = params.get("search");
    if (searchParam !== null) {
      setSearchTerm(searchParam);
      if (searchParam.trim()) {
        setTimeout(() => {
          const tableEl = document.querySelector(".filter-bar");
          if (tableEl) {
            tableEl.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 150);
      }
    }
  }, [location.search]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const fetchLeads = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get("/api/leads");
      if (res.data && res.data.success) {
        setLeads(res.data.data);
      }
    } catch (err) {
      setError("Unable to load leads. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  // Format Helpers
  const formatDateDisplay = (dateVal) => {
    if (!dateVal) return "—";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
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

  const cleanPhone = (phone) => {
    if (!phone) return "";
    return phone.replace(/[^0-9]/g, "");
  };

  // Convert followUpDate + followUpTime to local Date
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

  // Status calculation: OVERDUE, DUE SOON, UPCOMING
  const getFollowUpStatus = (lead) => {
    if (!lead.followUpDate) return null;
    const dt = getFollowUpDateTime(lead);
    if (!dt) return null;

    const now = new Date();
    const diffMs = dt.getTime() - now.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMs < 0) {
      return { type: "overdue", label: "OVERDUE", color: "var(--danger)" };
    } else if (diffMinutes <= 15) {
      return { type: "duesoon", label: "DUE SOON", color: "var(--warn)" };
    } else {
      return { type: "upcoming", label: "UPCOMING", color: "var(--success)" };
    }
  };

  const toDateKey = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "";
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // Compute Today's Calling Queue
  const now = new Date();
  const todayKey = toDateKey(now);

  const callingQueue = useMemo(() => {
    const queue = leads.filter((lead) => {
      if (!lead.followUpDate) return false;
      if (lead.stage === "Converted" || lead.stage === "Lost") return false;

      const fKey = toDateKey(lead.followUpDate);
      const dt = getFollowUpDateTime(lead);
      if (!dt) return false;

      // Include if scheduled for today OR if overdue from previous days
      const isOverdue = dt.getTime() < now.getTime();
      const isToday = fKey === todayKey;

      return isToday || isOverdue;
    });

    // Sort chronologically by exact follow-up datetime
    queue.sort((a, b) => {
      const dtA = getFollowUpDateTime(a);
      const dtB = getFollowUpDateTime(b);
      return dtA - dtB;
    });

    return queue;
  }, [leads, todayKey, now]);

  // Compute Overdue Leads currently in the queue for bulk actions
  const overdueQueueLeads = useMemo(() => {
    return callingQueue.filter((lead) => {
      const dt = getFollowUpDateTime(lead);
      return dt && dt.getTime() < now.getTime();
    });
  }, [callingQueue, now]);

  // Compute Next Upcoming Call
  const nextCall = useMemo(() => {
    const upcoming = leads.filter((lead) => {
      if (!lead.followUpDate) return false;
      if (lead.stage === "Converted" || lead.stage === "Lost") return false;
      const dt = getFollowUpDateTime(lead);
      if (!dt) return false;
      return dt.getTime() >= now.getTime();
    });

    upcoming.sort((a, b) => getFollowUpDateTime(a) - getFollowUpDateTime(b));
    return upcoming.length > 0 ? upcoming[0] : null;
  }, [leads, now]);

  // Handle Call Action: triggers silent Ozonetel call, displays in-app side card & logs call
  const handleCallClick = async (lead) => {
    if (!lead || !lead.phone) {
      alert("No phone number available for this lead.");
      return;
    }

    try {
      const updated = await initiateCall(lead, (updatedLead) => {
        setLeads((prev) =>
          prev.map((l) => (l._id === updatedLead._id ? updatedLead : l))
        );
        if (onDataChange) onDataChange();
      });

      if (updated && updated.callCount) {
        showToast(`📞 Dialing ${lead.name} via Ozonetel... (Call #${updated.callCount})`);
      } else {
        showToast(`📞 Dialing ${lead.name} via Ozonetel...`);
      }
    } catch (err) {
      console.error("Failed to initiate call:", err);
      showToast(`📞 Calling ${lead.name} via Ozonetel...`);
    }
  };

  // Handle Quick Reschedule Save
  const handleSaveReschedule = async () => {
    if (!rescheduleLead) return;
    try {
      setSavingQuick(true);
      const res = await axios.patch(`/api/leads/${rescheduleLead._id}/quick`, {
        followUpDate: newDate ? new Date(newDate) : null,
        followUpTime: newTime ? newTime.trim() : ""
      });

      if (res.data && res.data.success) {
        setLeads((prev) =>
          prev.map((l) => (l._id === rescheduleLead._id ? res.data.data : l))
        );
        showToast("Follow-up rescheduled.");
        setRescheduleLead(null);
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      alert("Failed to reschedule: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingQuick(false);
    }
  };

  // Handle Inline Quality Change
  const handleQualityChange = async (leadId, newQuality) => {
    try {
      const res = await axios.patch(`/api/leads/${leadId}/quick`, {
        quality: newQuality
      });
      if (res.data && res.data.success) {
        setLeads((prev) =>
          prev.map((l) => (l._id === leadId ? { ...l, quality: newQuality } : l))
        );
        setActiveQualityMenuLeadId(null);
        showToast(`Quality updated to ${newQuality}`);
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      alert("Failed to update quality: " + (err.response?.data?.message || err.message));
    }
  };

  // Handle Lead Deletion
  const confirmDeleteLead = async () => {
    if (!leadToDelete) return;
    try {
      setDeleting(true);
      const res = await axios.delete(`/api/leads/${leadToDelete._id}`);
      if (res.data && res.data.success) {
        setLeads((prev) => prev.filter((l) => l._id !== leadToDelete._id));
        showToast(`Lead ${leadToDelete.name} deleted successfully.`);
        setLeadToDelete(null);
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      alert("Failed to delete lead: " + (err.response?.data?.message || err.message));
    } finally {
      setDeleting(false);
    }
  };

  // Handle Bulk Reschedule for Overdue Leads
  const handleBulkReschedule = async (leadIds, target) => {
    if (!leadIds || leadIds.length === 0) return;
    try {
      setBulkRescheduling(true);
      const targetDate = new Date();
      let targetTime = "11:00";
      if (target === "tomorrow") {
        targetDate.setDate(targetDate.getDate() + 1);
        targetTime = "10:00";
      }
      const dateStr = toDateKey(targetDate);
      const res = await axios.post("/api/leads/bulk-reschedule", {
        leadIds,
        targetDate: dateStr,
        targetTime
      });
      if (res.data && res.data.success) {
        showToast(`Rescheduled ${leadIds.length} leads to ${target === "tomorrow" ? "Tomorrow" : "Today"}!`);
        setLeads((prev) =>
          prev.map((l) =>
            leadIds.includes(l._id)
              ? { ...l, followUpDate: targetDate, followUpTime: targetTime }
              : l
          )
        );
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      alert("Failed to bulk reschedule: " + (err.response?.data?.message || err.message));
    } finally {
      setBulkRescheduling(false);
    }
  };

  // Handle 1-Click Call Outcomes
  const handleQuickOutcome = async (lead, outcome) => {
    try {
      const stageMap = {
        "Connected — Interested": "Interested",
        "Connected — Call Back": "Contacted",
        "Not Connected": "Contacted",
        "Not Interested": "Lost"
      };
      const qualityMap = {
        "Connected — Interested": "Hot Lead",
        "Connected — Call Back": "Warm Lead",
        "Not Connected": "Cold Lead",
        "Not Interested": "Not Interested"
      };

      const newStage = stageMap[outcome] || lead.stage;
      const newQuality = qualityMap[outcome] || lead.quality;

      const res = await axios.post(`/api/leads/${lead._id}/comments`, {
        text: `Quick Call Outcome: ${outcome}`,
        outcome,
        stage: newStage,
        quality: newQuality
      });

      if (res.data && res.data.success && res.data.data) {
        const updated = res.data.data;
        setLeads((prev) => prev.map((l) => (l._id === lead._id ? updated : l)));
        showToast(`Logged "${outcome}" for ${lead.name}`);
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      showToast(`Failed to log outcome: ${err.message}`);
    }
  };

  // Lost Reason Analytics aggregation
  const lostReasonStats = useMemo(() => {
    const counts = {};
    leads.forEach((l) => {
      if (l.stage === "Lost" || l.quality === "Not Interested") {
        const reason = (l.lostReason && l.lostReason.trim()) || "Unspecified / General";
        counts[reason] = (counts[reason] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  // Filter & Search Logic
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // 1. Search filter
      if (searchTerm.trim() !== "") {
        const term = searchTerm.toLowerCase();
        const matches =
          (lead.name && lead.name.toLowerCase().includes(term)) ||
          (lead.phone && lead.phone.includes(term)) ||
          (lead.email && lead.email.toLowerCase().includes(term)) ||
          (lead.leadId && lead.leadId.toLowerCase().includes(term)) ||
          (lead.courseInterested && lead.courseInterested.toLowerCase().includes(term)) ||
          (lead.lostReason && lead.lostReason.toLowerCase().includes(term));
        if (!matches) return false;
      }

      // 2. Preset Filter Chips
      if (activePreset === "today") {
        if (!lead.followUpDate) return false;
        if (toDateKey(lead.followUpDate) !== todayKey) return false;
      } else if (activePreset === "hot") {
        if (lead.quality !== "Hot Lead") return false;
      } else if (activePreset === "p1") {
        if (lead.priority !== 1) return false;
      } else if (activePreset === "converted") {
        if (lead.stage !== "Converted" && lead.quality !== "Converted/Customer") return false;
      } else if (activePreset === "overdue") {
        const dt = getFollowUpDateTime(lead);
        if (!dt || dt.getTime() >= now.getTime()) return false;
      } else if (activePreset === "stale") {
        if (lead.stage === "Converted" || lead.stage === "Lost") return false;
        const lastAct = lead.comments && lead.comments.length > 0
          ? new Date(lead.comments[lead.comments.length - 1].addedAt || lead.updatedAt || lead.createdAt)
          : new Date(lead.updatedAt || lead.createdAt || 0);
        const timeSince = now.getTime() - lastAct.getTime();
        if (timeSince <= 7 * 24 * 60 * 60 * 1000) return false;
      }

      // 3. Dropdown filters
      if (qualityFilter !== "all" && lead.quality !== qualityFilter) return false;
      if (priorityFilter !== "all" && lead.priority !== Number(priorityFilter)) return false;
      if (stageFilter !== "all" && lead.stage !== stageFilter) return false;
      if (sourceFilter !== "all" && lead.source !== sourceFilter) return false;

      // 4. Advanced Date filters
      if (enquiryFrom) {
        if (!lead.enquiryDate || toDateKey(lead.enquiryDate) < enquiryFrom) return false;
      }
      if (enquiryTo) {
        if (!lead.enquiryDate || toDateKey(lead.enquiryDate) > enquiryTo) return false;
      }
      if (followUpFrom) {
        if (!lead.followUpDate || toDateKey(lead.followUpDate) < followUpFrom) return false;
      }
      if (followUpTo) {
        if (!lead.followUpDate || toDateKey(lead.followUpDate) > followUpTo) return false;
      }

      return true;
    });
  }, [
    leads,
    searchTerm,
    activePreset,
    qualityFilter,
    priorityFilter,
    stageFilter,
    sourceFilter,
    enquiryFrom,
    enquiryTo,
    followUpFrom,
    followUpTo,
    todayKey,
    now
  ]);

  // Sort Filtered Leads
  const sortedLeads = useMemo(() => {
    const list = [...filteredLeads];
    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === "followUp") {
        valA = getFollowUpDateTime(a) ? getFollowUpDateTime(a).getTime() : 0;
        valB = getFollowUpDateTime(b) ? getFollowUpDateTime(b).getTime() : 0;
      } else if (sortField === "enquiry") {
        valA = a.enquiryDate ? new Date(a.enquiryDate).getTime() : 0;
        valB = b.enquiryDate ? new Date(b.enquiryDate).getTime() : 0;
      } else if (typeof valA === "string") {
        valA = valA.toLowerCase();
        valB = (valB || "").toLowerCase();
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredLeads, sortField, sortAsc]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setActivePreset("all");
    setQualityFilter("all");
    setPriorityFilter("all");
    setStageFilter("all");
    setSourceFilter("all");
    setEnquiryFrom("");
    setEnquiryTo("");
    setFollowUpFrom("");
    setFollowUpTo("");
  };

  // Badge class helpers
  const getQualityBadgeClass = (q) => {
    switch (q) {
      case "Hot Lead": return "badge-hot";
      case "Warm Lead": return "badge-warm";
      case "Cold Lead": return "badge-cold";
      case "Call Again": return "badge-callagain";
      case "Converted/Customer": return "badge-converted";
      case "Not Interested": return "badge-notinterested";
      case "Wrong number": return "badge-wrongnumber";
      case "Wrong Mail": return "badge-wrongmail";
      default: return "badge-warm";
    }
  };

  const getPriorityBadgeClass = (p) => {
    switch (Number(p)) {
      case 1: return "badge-p1";
      case 2: return "badge-p2";
      case 3: return "badge-p3";
      case 4: return "badge-p4";
      case 5: return "badge-p5";
      default: return "badge-p3";
    }
  };

  const qualityOptions = [
    "Hot Lead",
    "Warm Lead",
    "Cold Lead",
    "Call Again",
    "Converted/Customer",
    "Not Interested",
    "Wrong number",
    "Wrong Mail"
  ];

  // Stats Calculations
  const totalCount = leads.length;
  const hotCount = leads.filter((l) => l.quality === "Hot Lead").length;
  const convertedCount = leads.filter(
    (l) => l.stage === "Converted" || l.quality === "Converted/Customer"
  ).length;
  const dueOrOverdueCount = leads.filter((l) => {
    const dt = getFollowUpDateTime(l);
    if (!dt) return false;
    const fDate = toDateKey(l.followUpDate);
    return fDate === todayKey || dt.getTime() < now.getTime();
  }).length;

  return (
    <div className="page">
      {/* Toast message */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "1.5rem",
            right: "1.5rem",
            background: "#059669",
            color: "#ffffff",
            padding: "0.75rem 1.25rem",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-lg)",
            fontWeight: 600,
            zIndex: 1200,
            animation: "fadeIn 0.2s ease"
          }}
        >
          ✓ {toastMessage}
        </div>
      )}

      {/* TOP NEXT CALL CARD & HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem"
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text)" }}>
            📋 Lead Manager
          </h1>
          <p style={{ color: "var(--text2)", fontSize: "0.9rem" }}>
            Real-time sales follow-up and interaction tracking dashboard
          </p>
        </div>

        {/* Next Call Banner */}
        <div
          className="card"
          style={{
            padding: "0.75rem 1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            background: "var(--surface2)",
            borderLeft: nextCall ? "4px solid #4f46e5" : "4px solid #059669"
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--text3)"
              }}
            >
              NEXT CALL
            </div>
            {nextCall ? (
              <div>
                <span style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text)" }}>
                  {formatTime12(nextCall.followUpTime)}
                </span>
                <span style={{ margin: "0 0.4rem", color: "var(--text3)" }}>—</span>
                <span style={{ fontWeight: 700, color: "#4f46e5" }}>{nextCall.name}</span>
                <span style={{ fontSize: "0.82rem", color: "var(--text2)", marginLeft: "0.5rem" }}>
                  ({nextCall.phone})
                </span>
              </div>
            ) : (
              <div style={{ fontWeight: 700, color: "#059669", fontSize: "0.95rem" }}>
                No upcoming calls 🎉
              </div>
            )}
          </div>
          {nextCall && (
            <Link to={`/leads/${nextCall._id}`} className="btn btn-primary btn-sm">
              Open
            </Link>
          )}
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-title">Total Leads</div>
          <div className="stat-card-value">{totalCount}</div>
          <div className="stat-card-sub">All registered leads in database</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-title" style={{ color: "#b91c1c" }}>
            Hot Leads
          </div>
          <div className="stat-card-value" style={{ color: "#dc2626" }}>
            {hotCount}
          </div>
          <div className="stat-card-sub">High purchase intent</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-title" style={{ color: "#047857" }}>
            Converted
          </div>
          <div className="stat-card-value" style={{ color: "#059669" }}>
            {convertedCount}
          </div>
          <div className="stat-card-sub">Successful admissions & sales</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-title" style={{ color: "#b45309" }}>
            Due / Overdue
          </div>
          <div className="stat-card-value" style={{ color: "#d97706" }}>
            {dueOrOverdueCount}
          </div>
          <div className="stat-card-sub">Action required today</div>
        </div>
      </div>

      {/* 📞 TODAY'S CALLING QUEUE (PROMINENT SECTION) */}
      <div style={{ marginBottom: "2rem" }}>
        <div
          className="section-title"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.5rem"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>📞</span>
            <span>TODAY'S CALLING QUEUE</span>
            <span
              style={{
                fontSize: "0.8rem",
                background: callingQueue.length > 0 ? "var(--accent)" : "var(--border)",
                color: "#ffffff",
                padding: "0.15rem 0.55rem",
                borderRadius: "9999px",
                fontWeight: 700
              }}
            >
              {callingQueue.length}
            </span>
          </div>

          {/* Bulk Reschedule Action if there are overdue calls */}
          {overdueQueueLeads.length > 0 && (
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--danger)", fontWeight: 700 }}>
                ⚠️ {overdueQueueLeads.length} overdue
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ fontSize: "0.72rem", padding: "0.2rem 0.55rem" }}
                onClick={() => handleBulkReschedule(overdueQueueLeads.map((l) => l._id), "today")}
                disabled={bulkRescheduling}
                title="Reschedule all overdue leads to Today at 11:00 AM"
              >
                {bulkRescheduling ? "Rescheduling..." : "📅 All to Today (11 AM)"}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ fontSize: "0.72rem", padding: "0.2rem 0.55rem" }}
                onClick={() => handleBulkReschedule(overdueQueueLeads.map((l) => l._id), "tomorrow")}
                disabled={bulkRescheduling}
                title="Reschedule all overdue leads to Tomorrow at 10:00 AM"
              >
                {bulkRescheduling ? "Rescheduling..." : "📅 All to Tomorrow (10 AM)"}
              </button>
            </div>
          )}
        </div>

        {callingQueue.length === 0 ? (
          <div
            className="card"
            style={{
              padding: "2rem",
              textAlign: "center",
              color: "var(--text2)",
              background: "var(--surface)"
            }}
          >
            <span style={{ fontSize: "1.75rem", display: "block", marginBottom: "0.5rem" }}>
              🎉
            </span>
            <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text)" }}>
              No follow-ups due right now!
            </span>
            <p style={{ fontSize: "0.85rem", color: "var(--text3)", marginTop: "0.25rem" }}>
              You are all caught up on your calling queue. Check upcoming calls or add new leads.
            </p>
          </div>
        ) : (
          <div className="calling-queue">
            {callingQueue.map((lead) => {
              const statusObj = getFollowUpStatus(lead);
              const isOverdue = statusObj?.type === "overdue";
              const isDueSoon = statusObj?.type === "duesoon";
              const cleaned = cleanPhone(lead.phone);

              return (
                <div
                  key={lead._id}
                  className={`queue-card ${
                    isOverdue ? "overdue" : isDueSoon ? "duesoon" : "upcoming"
                  }`}
                >
                  <div className="queue-meta">
                    <div className="queue-time-badge">
                      <span
                        className={
                          isOverdue
                            ? "status-overdue"
                            : isDueSoon
                            ? "status-duesoon"
                            : "status-upcoming"
                        }
                      >
                        {isOverdue ? "🔴" : isDueSoon ? "🟠" : "🟢"} {statusObj?.label} —{" "}
                        {formatTime12(lead.followUpTime) || "Anytime"}
                      </span>
                      <span className={`badge ${getQualityBadgeClass(lead.quality)}`}>
                        {lead.quality}
                      </span>
                      <span className={`badge ${getPriorityBadgeClass(lead.priority)}`}>
                        P{lead.priority}
                      </span>
                    </div>

                    <div className="queue-lead-name">{lead.name}</div>
                    <div className="queue-lead-phone">
                      📞 {lead.phone || "No phone provided"}
                      {lead.reminderNote && (
                        <span style={{ marginLeft: "0.75rem", color: "var(--text3)" }}>
                          • 📌 {lead.reminderNote}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="queue-actions">
                    {/* Call Button (Ozonetel) */}
                    <button
                      type="button"
                      onClick={() => handleCallClick(lead)}
                      className="btn btn-primary btn-sm"
                      title="Click to trigger Ozonetel call (auto-logged in CRM)"
                    >
                      📞 Call ({lead.callCount || 0})
                    </button>
                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        className="btn btn-outline btn-sm"
                        title="Direct SIM dial (mobile phone)"
                        style={{ padding: "0.25rem 0.5rem" }}
                      >
                        📱
                      </a>
                    )}

                    {/* WhatsApp Button */}
                    {lead.phone ? (
                      <div style={{ display: "inline-flex" }}>
                        <a
                          href={getWhatsAppUrl(lead.phone, generateWhatsAppMessage(lead, "greeting"))}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-success btn-sm"
                          style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                          title="Directly opens WhatsApp Web with pre-typed greeting"
                        >
                          💬 WhatsApp
                        </a>
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          style={{
                            borderTopLeftRadius: 0,
                            borderBottomLeftRadius: 0,
                            borderLeft: "1px solid rgba(255,255,255,0.3)",
                            padding: "0 0.4rem"
                          }}
                          onClick={() => openWhatsAppBar(lead)}
                          title="Choose message from WhatsApp Messages Bar"
                        >
                          ▾
                        </button>
                      </div>
                    ) : (
                      <button className="btn btn-secondary btn-sm" disabled>
                        💬 WhatsApp
                      </button>
                    )}

                    {/* Email Button */}
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        background: "rgba(59, 130, 246, 0.1)",
                        color: "#2563eb",
                        border: "1px solid rgba(59, 130, 246, 0.35)",
                        fontWeight: 600
                      }}
                      onClick={() => navigate(`/emails?leadId=${lead._id}`)}
                      title="Open Email Hub to compose via Outlook Web (subham.saha@henryharvin.in)"
                    >
                      📧 Email
                    </button>

                    {/* Open Lead */}
                    <Link to={`/leads/${lead._id}`} className="btn btn-secondary btn-sm">
                      Open Lead
                    </Link>

                    {/* Reschedule Button */}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setRescheduleLead(lead);
                        setNewDate(toDateKey(lead.followUpDate));
                        setNewTime(lead.followUpTime || "10:00");
                      }}
                    >
                      ✏️ Reschedule
                    </button>
                  </div>

                  {/* 1-Click Quick Call Outcome Row */}
                  <div
                    style={{
                      display: "flex",
                      gap: "0.35rem",
                      marginTop: "0.6rem",
                      paddingTop: "0.5rem",
                      borderTop: "1px dashed var(--border)",
                      flexWrap: "wrap",
                      alignItems: "center"
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        color: "var(--text3)",
                        textTransform: "uppercase",
                        letterSpacing: "0.03em"
                      }}
                    >
                      1-Click Outcome:
                    </span>
                    <button
                      type="button"
                      className="pill-btn"
                      style={{ fontSize: "0.72rem", padding: "0.15rem 0.5rem", cursor: "pointer" }}
                      onClick={() => handleQuickOutcome(lead, "Connected — Interested")}
                      title="Log outcome as Interested and move stage to Interested"
                    >
                      🟢 Interested
                    </button>
                    <button
                      type="button"
                      className="pill-btn"
                      style={{ fontSize: "0.72rem", padding: "0.15rem 0.5rem", cursor: "pointer" }}
                      onClick={() => handleQuickOutcome(lead, "Connected — Call Back")}
                      title="Log outcome as Call Back"
                    >
                      📞 Call Back
                    </button>
                    <button
                      type="button"
                      className="pill-btn"
                      style={{ fontSize: "0.72rem", padding: "0.15rem 0.5rem", cursor: "pointer" }}
                      onClick={() => handleQuickOutcome(lead, "Not Connected")}
                      title="Log outcome as No Answer / Not Connected"
                    >
                      ❌ No Answer
                    </button>
                    <button
                      type="button"
                      className="pill-btn"
                      style={{ fontSize: "0.72rem", padding: "0.15rem 0.5rem", cursor: "pointer" }}
                      onClick={() => handleQuickOutcome(lead, "Not Interested")}
                      title="Log outcome as Not Interested"
                    >
                      ⚠️ Not Interested
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* LOST REASON ANALYTICS (When lost leads exist) */}
      {lostReasonStats.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: "1.25rem",
            padding: "0.85rem 1.25rem",
            background: "var(--surface)",
            borderLeft: "4px solid #ef4444"
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
            <span
              style={{
                fontSize: "0.8rem",
                fontWeight: 800,
                color: "var(--text)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem"
              }}
            >
              <span>📉</span> Lost Reason Breakdown ({lostReasonStats.reduce((sum, item) => sum + item[1], 0)} Total)
            </span>
            <span style={{ fontSize: "0.72rem", color: "var(--text3)" }}>
              Click any reason tag to filter leads
            </span>
          </div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {lostReasonStats.map(([reason, count]) => (
              <button
                key={reason}
                type="button"
                onClick={() => setSearchTerm(reason === "Unspecified / General" ? "" : reason)}
                className="pill-btn"
                style={{
                  fontSize: "0.74rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  cursor: "pointer"
                }}
                title={`Filter leads with lost reason: ${reason}`}
              >
                <span>{reason}</span>
                <span
                  style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    color: "#ef4444",
                    padding: "0.05rem 0.35rem",
                    borderRadius: "999px",
                    fontWeight: 800
                  }}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FILTER & SEARCH BAR */}
      <div className="filter-bar">
        {/* Presets Chips Row */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text2)" }}>
            Presets:
          </span>
          {[
            { id: "all", label: "All Leads" },
            { id: "today", label: "Today's Follow-ups" },
            { id: "hot", label: "Hot Leads" },
            { id: "p1", label: "Urgent P1" },
            { id: "converted", label: "Converted" },
            { id: "overdue", label: "Overdue" },
            { id: "stale", label: "⏳ Stale (>7d)" }
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`pill-btn ${activePreset === preset.id ? "active" : ""}`}
              onClick={() => setActivePreset(preset.id)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Search and Excel Export Row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem"
          }}
        >
          <div style={{ flex: 1, minWidth: "260px", position: "relative", display: "flex", alignItems: "center" }}>
            <input
              type="text"
              placeholder="🔍 Search name, phone, email, or Lead ID..."
              value={searchTerm}
              onChange={(e) => {
                const val = e.target.value;
                setSearchTerm(val);
                if (!val && location.search.includes("search=")) {
                  navigate("/", { replace: true });
                }
              }}
              style={{
                width: "100%",
                padding: "0.55rem 2.2rem 0.55rem 0.85rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--surface)"
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  if (location.search.includes("search=")) {
                    navigate("/", { replace: true });
                  }
                }}
                style={{
                  position: "absolute",
                  right: "8px",
                  background: "transparent",
                  border: "none",
                  color: "var(--text3)",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  padding: "4px"
                }}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => exportLeadsToExcel(sortedLeads, `leads-filtered-${todayKey}.xlsx`)}
            >
              📊 Export Filtered ({sortedLeads.length})
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => exportLeadsToExcel(leads, `leads-all-${todayKey}.xlsx`)}
            >
              📥 Export All ({leads.length})
            </button>
          </div>
        </div>

        {/* Advanced Filters: Dropdowns */}
        <div className="form-row" style={{ marginBottom: 0 }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: "150px" }}>
            <label>Quality</label>
            <select
              value={qualityFilter}
              onChange={(e) => setQualityFilter(e.target.value)}
            >
              <option value="all">All Qualities</option>
              {qualityOptions.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0, minWidth: "130px" }}>
            <label>Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="1">P1 Urgent</option>
              <option value="2">P2 High</option>
              <option value="3">P3 Medium</option>
              <option value="4">P4 Low</option>
              <option value="5">P5 Minimal</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0, minWidth: "140px" }}>
            <label>Stage</label>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              <option value="all">All Stages</option>
              {["New", "Contacted", "Interested", "Negotiation", "Converted", "Lost"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0, minWidth: "140px" }}>
            <label>Source</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <option value="all">All Sources</option>
              {[
                "Instagram",
                "WhatsApp",
                "Facebook",
                "Google Ads",
                "Website",
                "Reference / Referral",
                "Cold Call",
                "Walk-in",
                "Email Campaign",
                "Other"
              ].map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0, minWidth: "130px" }}>
            <label>Enquiry From</label>
            <input
              type="date"
              value={enquiryFrom}
              onChange={(e) => setEnquiryFrom(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0, minWidth: "130px" }}>
            <label>Enquiry To</label>
            <input
              type="date"
              value={enquiryTo}
              onChange={(e) => setEnquiryTo(e.target.value)}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              paddingBottom: "0.2rem"
            }}
          >
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={clearAllFilters}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* LEADS LIST CONTENT */}
      {loading ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--text2)" }}>
          Loading leads...
        </div>
      ) : error ? (
        <div
          className="card-padded"
          style={{ textAlign: "center", borderColor: "var(--danger)" }}
        >
          <p style={{ color: "var(--danger)", fontWeight: 700, marginBottom: "0.75rem" }}>
            ⚠️ {error}
          </p>
          <button type="button" className="btn btn-primary btn-sm" onClick={fetchLeads}>
            Retry
          </button>
        </div>
      ) : sortedLeads.length === 0 ? (
        <div
          className="card"
          style={{
            padding: "3rem 1.5rem",
            textAlign: "center",
            color: "var(--text2)",
            background: "var(--surface)"
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📭</div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text)" }}>
            No leads found.
          </div>
          <p style={{ fontSize: "0.88rem", color: "var(--text3)", margin: "0.5rem 0 1rem 0" }}>
            {leads.length === 0
              ? "Your CRM database is empty. Add your first sales lead to start tracking!"
              : "No leads match the filters you have selected."}
          </p>
          {leads.length === 0 ? (
            <Link to="/add" className="btn btn-primary">
              + Add First Lead
            </Link>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearAllFilters}>
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE VIEW */}
          <div className="table-wrap">
            <table className="leads-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort("leadId")}>
                    ID {sortField === "leadId" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th onClick={() => handleSort("name")}>
                    Name {sortField === "name" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th onClick={() => handleSort("phone")}>
                    Phone {sortField === "phone" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th onClick={() => handleSort("quality")}>
                    Quality {sortField === "quality" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th onClick={() => handleSort("enquiry")}>
                    Enquiry {sortField === "enquiry" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th onClick={() => handleSort("followUp")}>
                    Follow-up {sortField === "followUp" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th onClick={() => handleSort("priority")}>
                    Priority {sortField === "priority" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th>Notes</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedLeads.map((lead) => {
                  const cleaned = cleanPhone(lead.phone);
                  const followUpStatus = getFollowUpStatus(lead);
                  const isQualityMenuOpen = activeQualityMenuLeadId === lead._id;

                  return (
                    <tr key={lead._id}>
                      {/* ID */}
                      <td style={{ fontWeight: 700 }}>
                        <Link
                          to={`/leads/${lead._id}`}
                          style={{ color: "var(--accent)", textDecoration: "none" }}
                        >
                          {lead.leadId}
                        </Link>
                      </td>

                      {/* Name */}
                      <td>
                        <Link
                          to={`/leads/${lead._id}`}
                          style={{ fontWeight: 600, color: "var(--text)" }}
                        >
                          {lead.name}
                        </Link>
                        {lead.stage && (
                          <div style={{ fontSize: "0.75rem", color: "var(--text3)" }}>
                            {lead.stage}
                          </div>
                        )}
                      </td>

                      {/* Phone + Action Links */}
                      <td>
                        <div style={{ fontWeight: 500 }}>{lead.phone || "—"}</div>
                        <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.2rem" }}>
                          <button
                            type="button"
                            onClick={() => handleCallClick(lead)}
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              cursor: "pointer",
                              fontSize: "0.75rem",
                              color: "var(--accent)",
                              fontWeight: 600
                            }}
                            title="Call via Ozonetel (auto-logged in CRM)"
                          >
                            📞 Call ({lead.callCount || 0})
                          </button>
                          {lead.phone && (
                            <a
                              href={`tel:${lead.phone}`}
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--text3)",
                                textDecoration: "none"
                              }}
                              title="Direct dial (tel:)"
                            >
                              📱
                            </a>
                          )}
                          {lead.phone && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
                              <a
                                href={getWhatsAppUrl(lead.phone, generateWhatsAppMessage(lead, "greeting"))}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#059669",
                                  fontWeight: 600
                                }}
                                title="Directly opens WhatsApp Web with pre-typed greeting"
                              >
                                💬 WhatsApp
                              </a>
                              <button
                                type="button"
                                onClick={() => openWhatsAppBar(lead)}
                                title="Choose message from WhatsApp Messages Bar"
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#059669",
                                  cursor: "pointer",
                                  padding: "0 2px",
                                  fontSize: "0.72rem",
                                  fontWeight: 700
                                }}
                              >
                                ▾
                              </button>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => navigate(`/emails?leadId=${lead._id}`)}
                            title="Open Email Hub to compose via Outlook Web (subham.saha@henryharvin.in)"
                            style={{
                              background: "none",
                              border: "none",
                              color: "#2563eb",
                              cursor: "pointer",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              padding: "0 2px",
                              display: "inline-flex",
                              alignItems: "center"
                            }}
                          >
                            📧 Email
                          </button>
                        </div>
                      </td>

                      {/* Clickable Quality Badge with Dropdown */}
                      <td style={{ position: "relative" }}>
                        <button
                          type="button"
                          className={`badge ${getQualityBadgeClass(lead.quality)}`}
                          style={{ cursor: "pointer", border: "none" }}
                          onClick={() =>
                            setActiveQualityMenuLeadId(
                              isQualityMenuOpen ? null : lead._id
                            )
                          }
                          title="Click to change quality directly"
                        >
                          {lead.quality} ▾
                        </button>

                        {isQualityMenuOpen && (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              zIndex: 100,
                              background: "var(--surface)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius)",
                              boxShadow: "var(--shadow-lg)",
                              padding: "0.35rem 0",
                              width: "160px"
                            }}
                          >
                            {qualityOptions.map((q) => (
                              <div
                                key={q}
                                style={{
                                  padding: "0.35rem 0.75rem",
                                  fontSize: "0.8rem",
                                  cursor: "pointer",
                                  color: "var(--text)",
                                  background: lead.quality === q ? "var(--surface2)" : "transparent"
                                }}
                                onClick={() => handleQualityChange(lead._id, q)}
                              >
                                {q}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Enquiry Date */}
                      <td style={{ fontSize: "0.82rem", color: "var(--text2)" }}>
                        {formatDateDisplay(lead.enquiryDate)}
                      </td>

                      {/* Follow-up Date/Time with ✏️ quick reschedule */}
                      <td>
                        {lead.followUpDate ? (
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                              <span style={{ fontWeight: 600 }}>
                                {formatDateDisplay(lead.followUpDate)}
                              </span>
                              <button
                                type="button"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: "0.75rem"
                                }}
                                title="Quick reschedule"
                                onClick={() => {
                                  setRescheduleLead(lead);
                                  setNewDate(toDateKey(lead.followUpDate));
                                  setNewTime(lead.followUpTime || "10:00");
                                }}
                              >
                                ✏️
                              </button>
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text2)" }}>
                              {formatTime12(lead.followUpTime) || "No time"}
                            </div>
                            {followUpStatus && (
                              <div style={{ marginTop: "0.15rem" }}>
                                <span
                                  className={
                                    followUpStatus.type === "overdue"
                                      ? "status-overdue"
                                      : followUpStatus.type === "duesoon"
                                      ? "status-duesoon"
                                      : "status-upcoming"
                                  }
                                >
                                  {followUpStatus.label}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.4rem" }}
                            onClick={() => {
                              setRescheduleLead(lead);
                              setNewDate(todayKey);
                              setNewTime("10:00");
                            }}
                          >
                            + Set Follow-up
                          </button>
                        )}
                      </td>

                      {/* Priority */}
                      <td>
                        <span className={`badge ${getPriorityBadgeClass(lead.priority)}`}>
                          P{lead.priority}
                        </span>
                      </td>

                      {/* Sticky Reminder / Notes */}
                      <td style={{ maxWidth: "200px" }}>
                        {lead.reminderNote ? (
                          <div
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--text2)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis"
                            }}
                            title={lead.reminderNote}
                          >
                            📌 {lead.reminderNote}
                          </div>
                        ) : lead.lastOutcome ? (
                          <div style={{ fontSize: "0.78rem", color: "var(--text3)" }}>
                            {lead.lastOutcome}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text3)", fontSize: "0.8rem" }}>—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: "right" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            gap: "0.35rem",
                            alignItems: "center"
                          }}
                        >
                          <Link
                            to={`/leads/${lead._id}`}
                            className="btn btn-secondary btn-sm"
                            title="View lead details"
                          >
                            View
                          </Link>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ color: "var(--danger)" }}
                            title="Delete lead"
                            onClick={() => setLeadToDelete(lead)}
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARDS VIEW */}
          <div className="mobile-cards">
            {sortedLeads.map((lead) => {
              const cleaned = cleanPhone(lead.phone);
              const followUpStatus = getFollowUpStatus(lead);

              return (
                <div key={lead._id} className="card-padded">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "0.5rem"
                    }}
                  >
                    <div>
                      <Link
                        to={`/leads/${lead._id}`}
                        style={{
                          fontWeight: 700,
                          fontSize: "1.05rem",
                          color: "var(--text)"
                        }}
                      >
                        {lead.name}
                      </Link>
                      <div style={{ fontSize: "0.75rem", color: "var(--text3)" }}>
                        {lead.leadId} • {lead.stage}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.3rem" }}>
                      <span className={`badge ${getQualityBadgeClass(lead.quality)}`}>
                        {lead.quality}
                      </span>
                      <span className={`badge ${getPriorityBadgeClass(lead.priority)}`}>
                        P{lead.priority}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: "0.88rem", marginBottom: "0.5rem" }}>
                    📞 {lead.phone || "No phone"}
                  </div>

                  {lead.followUpDate && (
                    <div
                      style={{
                        background: "var(--surface2)",
                        padding: "0.5rem",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.82rem",
                        marginBottom: "0.75rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      <div>
                        <strong>Follow-up:</strong> {formatDateDisplay(lead.followUpDate)} at{" "}
                        {formatTime12(lead.followUpTime)}
                      </div>
                      {followUpStatus && (
                        <span
                          className={
                            followUpStatus.type === "overdue"
                              ? "status-overdue"
                              : followUpStatus.type === "duesoon"
                              ? "status-duesoon"
                              : "status-upcoming"
                          }
                        >
                          {followUpStatus.label}
                        </span>
                      )}
                    </div>
                  )}

                  {lead.reminderNote && (
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--text2)",
                        marginBottom: "0.75rem",
                        fontStyle: "italic"
                      }}
                    >
                      📌 {lead.reminderNote}
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      gap: "0.4rem",
                      flexWrap: "wrap",
                      paddingTop: "0.5rem",
                      borderTop: "1px solid var(--border)"
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleCallClick(lead)}
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1 }}
                      title="Call via Ozonetel (auto-logged in CRM)"
                    >
                      📞 Call ({lead.callCount || 0})
                    </button>

                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        className="btn btn-outline btn-sm"
                        title="Direct SIM dial"
                        style={{ padding: "0.25rem 0.6rem" }}
                      >
                        📱
                      </a>
                    )}

                    {lead.phone && (
                      <div style={{ display: "inline-flex", flex: 1 }}>
                        <a
                          href={getWhatsAppUrl(lead.phone, generateWhatsAppMessage(lead, "greeting"))}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-success btn-sm"
                          style={{ flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                          title="Directly opens WhatsApp Web with pre-typed greeting"
                        >
                          💬 WhatsApp
                        </a>
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          style={{
                            borderTopLeftRadius: 0,
                            borderBottomLeftRadius: 0,
                            borderLeft: "1px solid rgba(255,255,255,0.3)",
                            padding: "0 0.45rem"
                          }}
                          onClick={() => openWhatsAppBar(lead)}
                          title="Choose message from WhatsApp Messages Bar"
                        >
                          ▾
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        background: "rgba(59, 130, 246, 0.1)",
                        color: "#2563eb",
                        border: "1px solid rgba(59, 130, 246, 0.35)",
                        fontWeight: 600,
                        padding: "0 0.5rem"
                      }}
                      onClick={() => navigate(`/emails?leadId=${lead._id}`)}
                      title="Open Email Hub to compose via Outlook Web (subham.saha@henryharvin.in)"
                    >
                      📧 Email
                    </button>

                    <Link
                      to={`/leads/${lead._id}`}
                      className="btn btn-secondary btn-sm"
                    >
                      View
                    </Link>

                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setRescheduleLead(lead);
                        setNewDate(toDateKey(lead.followUpDate));
                        setNewTime(lead.followUpTime || "10:00");
                      }}
                    >
                      ✏️
                    </button>

                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ color: "var(--danger)" }}
                      onClick={() => setLeadToDelete(lead)}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

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
                disabled={savingQuick}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveReschedule}
                disabled={savingQuick}
              >
                {savingQuick ? "Saving..." : "Save Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {leadToDelete && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--danger)" }}>
              🗑 Confirm Lead Deletion
            </h3>
            <p style={{ fontSize: "0.9rem", color: "var(--text)", marginBottom: "1rem", lineHeight: 1.4 }}>
              Delete <strong>{leadToDelete.name}</strong> ({leadToDelete.leadId}) and all associated interaction history permanently?
            </p>
            <div
              style={{
                background: "var(--danger-bg)",
                color: "var(--danger)",
                padding: "0.75rem",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.8rem",
                marginBottom: "1.25rem"
              }}
            >
              ⚠️ Warning: This action cannot be undone. All comments and historical records will be permanently removed.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setLeadToDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmDeleteLead}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Lead"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
