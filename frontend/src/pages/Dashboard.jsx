import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { exportLeadsToExcel } from "../utils/exportExcel";
import { getWhatsAppUrl, generateWhatsAppMessage } from "../utils/whatsapp";
import { useWhatsAppBar } from "../context/WhatsAppBarContext";
import { useEmailBar } from "../context/EmailBarContext";
import { useCallStatus } from "../context/CallStatusContext";
import { getCachedLeads, setCachedLeads, fetchLeadsOptimized } from "../utils/leadsCache";

export default function Dashboard({ onDataChange }) {
  const { openWhatsAppBar } = useWhatsAppBar();
  const { openEmailBar } = useEmailBar();
  const { initiateCall } = useCallStatus();

  // Instant SWR cache initialization (0ms UI render on page load/refresh)
  const [leads, setLeads] = useState(() => getCachedLeads());
  const [loading, setLoading] = useState(() => getCachedLeads().length === 0);
  const [isSyncing, setIsSyncing] = useState(false);
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

  // 1-Click Dropdown Menus: activeQualityLeadId, activeStageLeadId, activePriorityLeadId, activeSnoozeLeadId
  const [activeQualityLeadId, setActiveQualityLeadId] = useState(null);
  const [activeStageLeadId, setActiveStageLeadId] = useState(null);
  const [activePriorityLeadId, setActivePriorityLeadId] = useState(null);
  const [activeSnoozeLeadId, setActiveSnoozeLeadId] = useState(null);
  const [activeQualityMenuLeadId, setActiveQualityMenuLeadId] = useState(null);

  // Compact Queue View Mode (persisted in localStorage, default true)
  const [compactQueue, setCompactQueue] = useState(() => {
    const saved = localStorage.getItem("lead_crm_queue_compact");
    return saved === null ? true : saved === "true";
  });

  const toggleCompactQueue = () => {
    setCompactQueue((prev) => {
      const next = !prev;
      localStorage.setItem("lead_crm_queue_compact", String(next));
      return next;
    });
  };

  // Collapsible Advanced Filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Delete Lead Modal State
  const [leadToDelete, setLeadToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

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

  // Dismiss any open popover/menu when clicking outside
  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (
        e.target.closest(".one-click-dropdown-wrap") ||
        e.target.closest(".quick-snooze-wrap") ||
        e.target.closest(".one-click-popover") ||
        e.target.closest(".quick-snooze-menu")
      ) {
        return;
      }
      setActiveQualityLeadId(null);
      setActiveStageLeadId(null);
      setActivePriorityLeadId(null);
      setActiveSnoozeLeadId(null);
      setActiveQualityMenuLeadId(null);
    };

    document.addEventListener("mousedown", handleGlobalClick);
    return () => document.removeEventListener("mousedown", handleGlobalClick);
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const fetchLeads = async (forceFresh = false) => {
    try {
      // If we don't have any cached leads yet, show full loader. Otherwise, sync silently in background.
      if (leads.length === 0) {
        setLoading(true);
      } else {
        setIsSyncing(true);
      }
      setError("");

      const data = await fetchLeadsOptimized(forceFresh);
      if (Array.isArray(data) && data.length >= 0) {
        setLeads(data);
      }
    } catch (err) {
      if (leads.length === 0) {
        setError("Unable to load leads. Please check your connection and try again.");
      }
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  // Synchronize localStorage cache whenever local state changes
  useEffect(() => {
    if (leads && leads.length > 0) {
      setCachedLeads(leads);
    }
  }, [leads]);

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

  const now = new Date();
  const todayKey = toDateKey(now);

  // Compute Overdue Calls (Scheduled in past, not converted/lost) - Most overdue first
  const overdueQueue = useMemo(() => {
    return leads
      .filter((lead) => {
        if (!lead.followUpDate) return false;
        if (lead.stage === "Converted" || lead.stage === "Lost") return false;
        const dt = getFollowUpDateTime(lead);
        if (!dt) return false;
        return dt.getTime() < now.getTime();
      })
      .sort((a, b) => getFollowUpDateTime(a) - getFollowUpDateTime(b));
  }, [leads, now]);

  // Compute Today's Upcoming Calls (Scheduled for today, after current time) - Chronological
  const todayQueue = useMemo(() => {
    return leads
      .filter((lead) => {
        if (!lead.followUpDate) return false;
        if (lead.stage === "Converted" || lead.stage === "Lost") return false;
        const fKey = toDateKey(lead.followUpDate);
        const dt = getFollowUpDateTime(lead);
        if (!dt) return false;
        return fKey === todayKey && dt.getTime() >= now.getTime();
      })
      .sort((a, b) => getFollowUpDateTime(a) - getFollowUpDateTime(b));
  }, [leads, todayKey, now]);

  // Combined calling queue
  const callingQueue = useMemo(() => {
    return [...overdueQueue, ...todayQueue];
  }, [overdueQueue, todayQueue]);

  // Compute Today's Calling Progress Stats
  const callsCompletedToday = useMemo(() => {
    return leads.filter((l) => {
      if (!l.lastCallDate) return false;
      return toDateKey(l.lastCallDate) === todayKey;
    }).length;
  }, [leads, todayKey]);

  const totalTargetToday = overdueQueue.length + todayQueue.length + callsCompletedToday;
  const progressPercentage =
    totalTargetToday > 0
      ? Math.min(100, Math.round((callsCompletedToday / totalTargetToday) * 100))
      : 100;

  // Relative Time Countdown Formatter
  const formatRelativeTime = (lead) => {
    if (!lead.followUpDate) return null;
    const dt = getFollowUpDateTime(lead);
    if (!dt) return null;

    const diffMs = dt.getTime() - now.getTime();
    if (diffMs < 0) {
      const totalMins = Math.floor(-diffMs / (1000 * 60));
      if (totalMins < 60) {
        return {
          type: "overdue",
          badgeText: `Overdue by ${totalMins}m`,
          subText: `Scheduled ${formatTime12(lead.followUpTime) || "earlier"}`
        };
      }
      const hours = Math.floor(totalMins / 60);
      const remMins = totalMins % 60;
      if (hours < 24) {
        return {
          type: "overdue",
          badgeText: `Overdue by ${hours}h ${remMins > 0 ? `${remMins}m` : ""}`,
          subText: `Scheduled ${formatTime12(lead.followUpTime) || "earlier"}`
        };
      }
      const days = Math.floor(hours / 24);
      return {
        type: "overdue",
        badgeText: `Overdue by ${days}d`,
        subText: `Scheduled ${formatDateDisplay(lead.followUpDate)}`
      };
    } else {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes <= 15) {
        return {
          type: "duesoon",
          badgeText: `Due in ${diffMinutes}m`,
          subText: `At ${formatTime12(lead.followUpTime)}`
        };
      }
      if (diffMinutes < 60) {
        return {
          type: "duesoon",
          badgeText: `In ${diffMinutes} mins`,
          subText: `At ${formatTime12(lead.followUpTime)}`
        };
      }
      const hours = Math.floor(diffMinutes / 60);
      const fKey = toDateKey(lead.followUpDate);
      if (fKey === todayKey) {
        return {
          type: "upcoming",
          badgeText: `Today at ${formatTime12(lead.followUpTime)}`,
          subText: `In ~${hours} hr${hours > 1 ? "s" : ""}`
        };
      }
      return {
        type: "upcoming",
        badgeText: `${formatDateDisplay(lead.followUpDate)}`,
        subText: `At ${formatTime12(lead.followUpTime)}`
      };
    }
  };

  // 1-Click Quick Reschedule Preset Handler
  const handleQuickSnoozePreset = async (lead, preset) => {
    let targetDate = new Date();
    let targetTime = "10:00";
    let presetLabel = "";

    if (preset === "+2h") {
      const in2h = new Date(Date.now() + 2 * 60 * 60 * 1000);
      targetDate = in2h;
      const h = String(in2h.getHours()).padStart(2, "0");
      const m = String(in2h.getMinutes()).padStart(2, "0");
      targetTime = `${h}:${m}`;
      presetLabel = "2 hours from now";
    } else if (preset === "tomorrow_10am") {
      targetDate.setDate(targetDate.getDate() + 1);
      targetTime = "10:00";
      presetLabel = "Tomorrow at 10:00 AM";
    } else if (preset === "tomorrow_2pm") {
      targetDate.setDate(targetDate.getDate() + 1);
      targetTime = "14:00";
      presetLabel = "Tomorrow at 2:00 PM";
    } else if (preset === "next_monday") {
      const day = targetDate.getDay();
      const diff = day === 0 ? 1 : 8 - day;
      targetDate.setDate(targetDate.getDate() + diff);
      targetTime = "10:00";
      presetLabel = "Next Monday at 10:00 AM";
    }

    try {
      const res = await axios.patch(`/api/leads/${lead._id}/quick`, {
        followUpDate: targetDate,
        followUpTime: targetTime
      });

      if (res.data && res.data.success) {
        setLeads((prev) =>
          prev.map((l) => (l._id === lead._id ? res.data.data : l))
        );
        setActiveSnoozeLeadId(null);
        showToast(`Follow-up rescheduled for ${lead.name} (${presetLabel})`);
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      alert("Failed to reschedule: " + (err.response?.data?.message || err.message));
    }
  };

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
        setActiveQualityLeadId(null);
        showToast(`Quality updated to ${newQuality}`);
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      alert("Failed to update quality: " + (err.response?.data?.message || err.message));
    }
  };

  // Handle 1-Click Inline Stage Change
  const handleStageChange = async (leadId, newStage) => {
    try {
      const res = await axios.patch(`/api/leads/${leadId}/quick`, { stage: newStage });
      if (res.data && res.data.success) {
        setLeads((prev) =>
          prev.map((l) => (l._id === leadId ? { ...l, stage: newStage } : l))
        );
        setActiveStageLeadId(null);
        showToast(`Stage updated to "${newStage}"`);
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      alert("Failed to update stage: " + (err.response?.data?.message || err.message));
    }
  };

  // Handle 1-Click Priority Change
  const handlePriorityChange = async (leadId, newPriority) => {
    try {
      const res = await axios.patch(`/api/leads/${leadId}/quick`, { priority: Number(newPriority) });
      if (res.data && res.data.success) {
        setLeads((prev) =>
          prev.map((l) => (l._id === leadId ? { ...l, priority: Number(newPriority) } : l))
        );
        setActivePriorityLeadId(null);
        showToast(`Priority set to P${newPriority}`);
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      alert("Failed to update priority: " + (err.response?.data?.message || err.message));
    }
  };

  // Handle 1-Click Mark Done / Completed Follow-up
  const handleMarkDone = async (lead) => {
    try {
      const res = await axios.patch(`/api/leads/${lead._id}/quick`, { markDone: true });
      if (res.data && res.data.success) {
        setLeads((prev) =>
          prev.map((l) => (l._id === lead._id ? res.data.data : l))
        );
        showToast(`✓ Marked follow-up for ${lead.name} as completed!`);
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      alert("Failed to complete follow-up: " + (err.response?.data?.message || err.message));
    }
  };

  // Handle 1-Click Quick Note Prompt
  const handleQuickNote = async (lead) => {
    const current = lead.reminderNote || "";
    const updated = prompt(`Quick note for ${lead.name}:`, current);
    if (updated === null || updated === current) return;
    try {
      const res = await axios.patch(`/api/leads/${lead._id}/quick`, { reminderNote: updated });
      if (res.data && res.data.success) {
        setLeads((prev) =>
          prev.map((l) => (l._id === lead._id ? { ...l, reminderNote: updated } : l))
        );
        showToast(`Note updated for ${lead.name}`);
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      alert("Failed to update note: " + (err.response?.data?.message || err.message));
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
          (lead.leadId && lead.leadId.toLowerCase().includes(term));
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

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (qualityFilter !== "all") count++;
    if (priorityFilter !== "all") count++;
    if (stageFilter !== "all") count++;
    if (sourceFilter !== "all") count++;
    if (enquiryFrom) count++;
    if (enquiryTo) count++;
    if (followUpFrom) count++;
    if (followUpTo) count++;
    return count;
  }, [
    qualityFilter,
    priorityFilter,
    stageFilter,
    sourceFilter,
    enquiryFrom,
    enquiryTo,
    followUpFrom,
    followUpTo
  ]);

  // Badge class helpers
  const getQualityBadgeClass = (q) => {
    switch (q) {
      case "Hot Lead": return "badge-hot";
      case "Warm Lead": return "badge-warm";
      case "Cold Lead": return "badge-cold";
      case "Call Again": return "badge-callagain";
      case "Voicemail": return "badge-voicemail";
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
    "Voicemail",
    "Converted/Customer",
    "Not Interested",
    "Wrong number",
    "Wrong Mail"
  ];

  const stageOptions = [
    "New",
    "Contacted",
    "Interested",
    "Negotiation",
    "Converted",
    "Lost"
  ];

  const priorityOptions = [1, 2, 3, 4, 5];

  const getStageBadgeClass = (s) => {
    switch (s) {
      case "New": return "badge-stage-new";
      case "Contacted": return "badge-stage-contacted";
      case "Interested": return "badge-stage-interested";
      case "Negotiation": return "badge-stage-negotiation";
      case "Converted": return "badge-converted";
      case "Lost": return "badge-lost";
      default: return "badge-stage-contacted";
    }
  };

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

  const renderQueueCard = (lead, isOverdueMode = false) => {
    const rel = formatRelativeTime(lead);
    const statusObj = getFollowUpStatus(lead);
    const isOverdue = rel?.type === "overdue" || statusObj?.type === "overdue";
    const isDueSoon = rel?.type === "duesoon" || statusObj?.type === "duesoon";
    const isSnoozeOpen = activeSnoozeLeadId === lead._id;
    const isQualityOpen = activeQualityLeadId === lead._id;
    const isStageOpen = activeStageLeadId === lead._id;
    const isPriorityOpen = activePriorityLeadId === lead._id;

    if (compactQueue) {
      return (
        <div
          key={lead._id}
          className={`queue-card-compact ${
            isOverdue ? "overdue" : isDueSoon ? "duesoon" : "upcoming"
          }`}
        >
          <div className="compact-left">
            {/* Relative Badge */}
            {rel && (
              <span
                className={`relative-badge ${
                  rel.type === "overdue"
                    ? "relative-badge-overdue"
                    : rel.type === "duesoon"
                    ? "relative-badge-duesoon"
                    : "relative-badge-upcoming"
                }`}
                style={{ fontSize: "0.72rem", padding: "0.15rem 0.45rem" }}
              >
                {rel.type === "overdue" ? "🔴" : rel.type === "duesoon" ? "🟠" : "🟢"}{" "}
                {rel.badgeText}
              </span>
            )}

            {/* Name */}
            <Link
              to={`/leads/${lead._id}`}
              className="compact-lead-title"
              title={lead.name}
            >
              {lead.name}
            </Link>

            {/* Phone */}
            <span className="compact-phone phone-mono">
              📞 {lead.phone || "No phone"}
            </span>

            {/* 1-Click Quality Dropdown */}
            <div className="one-click-dropdown-wrap">
              <button
                type="button"
                className={`one-click-pill ${getQualityBadgeClass(lead.quality)}`}
                onClick={() => {
                  setActiveQualityLeadId(isQualityOpen ? null : lead._id);
                  setActiveStageLeadId(null);
                  setActivePriorityLeadId(null);
                  setActiveSnoozeLeadId(null);
                }}
                title="Change Quality in 1 Click"
              >
                {lead.quality || "Quality"} ▾
              </button>
              {isQualityOpen && (
                <div className="one-click-popover">
                  {qualityOptions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={`one-click-popover-item ${lead.quality === q ? "active" : ""}`}
                      onClick={() => handleQualityChange(lead._id, q)}
                    >
                      <span>{q}</span>
                      {lead.quality === q && <span>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 1-Click Stage Dropdown */}
            <div className="one-click-dropdown-wrap">
              <button
                type="button"
                className={`one-click-pill ${getStageBadgeClass(lead.stage)}`}
                onClick={() => {
                  setActiveStageLeadId(isStageOpen ? null : lead._id);
                  setActiveQualityLeadId(null);
                  setActivePriorityLeadId(null);
                  setActiveSnoozeLeadId(null);
                }}
                title="Change Stage in 1 Click"
              >
                {lead.stage || "Stage"} ▾
              </button>
              {isStageOpen && (
                <div className="one-click-popover">
                  {stageOptions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`one-click-popover-item ${lead.stage === s ? "active" : ""}`}
                      onClick={() => handleStageChange(lead._id, s)}
                    >
                      <span>{s}</span>
                      {lead.stage === s && <span>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 1-Click Priority Dropdown */}
            <div className="one-click-dropdown-wrap">
              <button
                type="button"
                className={`one-click-pill ${getPriorityBadgeClass(lead.priority)}`}
                onClick={() => {
                  setActivePriorityLeadId(isPriorityOpen ? null : lead._id);
                  setActiveQualityLeadId(null);
                  setActiveStageLeadId(null);
                  setActiveSnoozeLeadId(null);
                }}
                title="Change Priority in 1 Click"
              >
                P{lead.priority || 3} ▾
              </button>
              {isPriorityOpen && (
                <div className="one-click-popover" style={{ minWidth: "120px" }}>
                  {priorityOptions.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`one-click-popover-item ${lead.priority === p ? "active" : ""}`}
                      onClick={() => handlePriorityChange(lead._id, p)}
                    >
                      <span>P{p} Priority</span>
                      {lead.priority === p && <span>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 1-Click Note */}
            <button
              type="button"
              className="btn-note-inline"
              onClick={() => handleQuickNote(lead)}
              title={lead.reminderNote ? `Note: ${lead.reminderNote} (click to edit)` : "Add quick note"}
            >
              📌 {lead.reminderNote ? (lead.reminderNote.length > 20 ? lead.reminderNote.substring(0, 20) + "..." : lead.reminderNote) : "+ Note"}
            </button>
          </div>

          {/* Compact Right Actions */}
          <div className="compact-right-actions">
            {/* Call Button (Ozonetel) */}
            <button
              type="button"
              onClick={() => handleCallClick(lead)}
              className="btn btn-primary btn-sm"
              style={{ padding: "0.2rem 0.5rem", fontSize: "0.78rem" }}
              title="Click to trigger Ozonetel call (auto-logged in CRM)"
            >
              📞 Call ({lead.callCount || 0})
            </button>

            {/* SIM dial */}
            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                className="btn btn-outline btn-sm"
                title="Direct SIM dial"
                style={{ padding: "0.2rem 0.45rem", fontSize: "0.78rem" }}
              >
                📱
              </a>
            )}

            {/* WhatsApp */}
            {lead.phone && (
              <div style={{ display: "inline-flex" }}>
                <a
                  href={getWhatsAppUrl(
                    lead.phone,
                    generateWhatsAppMessage(lead, "greeting")
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-success btn-sm"
                  style={{
                    padding: "0.2rem 0.5rem",
                    fontSize: "0.78rem",
                    borderTopRightRadius: 0,
                    borderBottomRightRadius: 0
                  }}
                  title="Directly opens WhatsApp Web with greeting"
                >
                  💬 WA
                </a>
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  style={{
                    padding: "0.2rem 0.35rem",
                    fontSize: "0.75rem",
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                    borderLeft: "1px solid rgba(255,255,255,0.3)"
                  }}
                  onClick={() => openWhatsAppBar(lead)}
                  title="Choose message from WhatsApp Messages Bar"
                >
                  ▾
                </button>
              </div>
            )}

            {/* Email */}
            <button
              type="button"
              className="btn btn-sm"
              style={{
                background: "rgba(59, 130, 246, 0.1)",
                color: "#2563eb",
                border: "1px solid rgba(59, 130, 246, 0.35)",
                fontWeight: 600,
                padding: "0.2rem 0.45rem",
                fontSize: "0.78rem"
              }}
              onClick={() => navigate(`/emails?leadId=${lead._id}`)}
              title="Open Email Hub"
            >
              📧
            </button>

            {/* 1-Click Snooze Presets */}
            <div className="quick-snooze-wrap">
              <button
                type="button"
                className="quick-snooze-btn"
                style={{ padding: "0.2rem 0.45rem", fontSize: "0.78rem" }}
                onClick={() => {
                  setActiveSnoozeLeadId(isSnoozeOpen ? null : lead._id);
                  setActiveQualityLeadId(null);
                  setActiveStageLeadId(null);
                  setActivePriorityLeadId(null);
                }}
                title="1-Click Quick Reschedule Presets"
              >
                ⚡ Snooze ▾
              </button>
              {isSnoozeOpen && (
                <div className="quick-snooze-menu">
                  <button
                    type="button"
                    className="quick-snooze-item"
                    onClick={() => handleQuickSnoozePreset(lead, "+2h")}
                  >
                    ⏱️ +2 Hours
                  </button>
                  <button
                    type="button"
                    className="quick-snooze-item"
                    onClick={() => handleQuickSnoozePreset(lead, "tomorrow_10am")}
                  >
                    🌅 Tomorrow 10:00 AM
                  </button>
                  <button
                    type="button"
                    className="quick-snooze-item"
                    onClick={() => handleQuickSnoozePreset(lead, "tomorrow_2pm")}
                  >
                    ☀️ Tomorrow 2:00 PM
                  </button>
                  <button
                    type="button"
                    className="quick-snooze-item"
                    onClick={() => handleQuickSnoozePreset(lead, "next_monday")}
                  >
                    📅 Next Monday 10:00 AM
                  </button>
                  <button
                    type="button"
                    className="quick-snooze-item"
                    style={{
                      borderTop: "1px solid var(--border)",
                      color: "var(--accent)"
                    }}
                    onClick={() => {
                      setActiveSnoozeLeadId(null);
                      setRescheduleLead(lead);
                      setNewDate(toDateKey(lead.followUpDate));
                      setNewTime(lead.followUpTime || "10:00");
                    }}
                  >
                    ✏️ Custom Date...
                  </button>
                </div>
              )}
            </div>

            {/* 1-Click Done */}
            <button
              type="button"
              className="btn-done-pill"
              onClick={() => handleMarkDone(lead)}
              title="1-Click Mark Follow-up Completed & Clear From Queue"
            >
              ✓ Done
            </button>

            {/* Open Lead */}
            <Link
              to={`/leads/${lead._id}`}
              className="btn btn-secondary btn-sm"
              style={{ padding: "0.2rem 0.45rem", fontSize: "0.78rem" }}
              title="View full lead details"
            >
              Open ↗
            </Link>
          </div>
        </div>
      );
    }

    // Comfortable Card View Mode
    return (
      <div
        key={lead._id}
        className={`queue-card ${
          isOverdue ? "overdue" : isDueSoon ? "duesoon" : "upcoming"
        }`}
      >
        <div className="queue-meta">
          <div
            className="queue-time-badge"
            style={{
              display: "flex",
              gap: "0.45rem",
              alignItems: "center",
              flexWrap: "wrap"
            }}
          >
            {rel && (
              <span
                className={`relative-badge ${
                  rel.type === "overdue"
                    ? "relative-badge-overdue"
                    : rel.type === "duesoon"
                    ? "relative-badge-duesoon"
                    : "relative-badge-upcoming"
                }`}
              >
                {rel.type === "overdue" ? "🔴" : rel.type === "duesoon" ? "🟠" : "🟢"}{" "}
                {rel.badgeText}
              </span>
            )}

            {/* 1-Click Quality Dropdown */}
            <div className="one-click-dropdown-wrap">
              <button
                type="button"
                className={`one-click-pill ${getQualityBadgeClass(lead.quality)}`}
                onClick={() => {
                  setActiveQualityLeadId(isQualityOpen ? null : lead._id);
                  setActiveStageLeadId(null);
                  setActivePriorityLeadId(null);
                  setActiveSnoozeLeadId(null);
                }}
                title="Click to change quality in 1 click"
              >
                {lead.quality || "Quality"} ▾
              </button>
              {isQualityOpen && (
                <div className="one-click-popover">
                  {qualityOptions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={`one-click-popover-item ${lead.quality === q ? "active" : ""}`}
                      onClick={() => handleQualityChange(lead._id, q)}
                    >
                      <span>{q}</span>
                      {lead.quality === q && <span>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 1-Click Stage Dropdown */}
            <div className="one-click-dropdown-wrap">
              <button
                type="button"
                className={`one-click-pill ${getStageBadgeClass(lead.stage)}`}
                onClick={() => {
                  setActiveStageLeadId(isStageOpen ? null : lead._id);
                  setActiveQualityLeadId(null);
                  setActivePriorityLeadId(null);
                  setActiveSnoozeLeadId(null);
                }}
                title="Click to change stage in 1 click"
              >
                {lead.stage || "Stage"} ▾
              </button>
              {isStageOpen && (
                <div className="one-click-popover">
                  {stageOptions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`one-click-popover-item ${lead.stage === s ? "active" : ""}`}
                      onClick={() => handleStageChange(lead._id, s)}
                    >
                      <span>{s}</span>
                      {lead.stage === s && <span>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 1-Click Priority Dropdown */}
            <div className="one-click-dropdown-wrap">
              <button
                type="button"
                className={`one-click-pill ${getPriorityBadgeClass(lead.priority)}`}
                onClick={() => {
                  setActivePriorityLeadId(isPriorityOpen ? null : lead._id);
                  setActiveQualityLeadId(null);
                  setActiveStageLeadId(null);
                  setActiveSnoozeLeadId(null);
                }}
                title="Click to change priority in 1 click"
              >
                P{lead.priority || 3} ▾
              </button>
              {isPriorityOpen && (
                <div className="one-click-popover" style={{ minWidth: "120px" }}>
                  {priorityOptions.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`one-click-popover-item ${lead.priority === p ? "active" : ""}`}
                      onClick={() => handlePriorityChange(lead._id, p)}
                    >
                      <span>P{p} Priority</span>
                      {lead.priority === p && <span>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {rel?.subText && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text3)",
                  fontWeight: 500
                }}
              >
                {rel.subText}
              </span>
            )}
          </div>

          <div className="queue-lead-name" style={{ marginTop: "0.35rem" }}>
            <Link to={`/leads/${lead._id}`} style={{ color: "var(--text)", textDecoration: "none" }}>
              {lead.name}
            </Link>
          </div>
          <div className="queue-lead-phone">
            📞 <span className="phone-mono">{lead.phone || "No phone provided"}</span>
            <button
              type="button"
              className="btn-note-inline"
              style={{ marginLeft: "0.75rem" }}
              onClick={() => handleQuickNote(lead)}
              title="Click to edit sticky note"
            >
              📌 {lead.reminderNote || "+ Add Note"}
            </button>
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
                href={getWhatsAppUrl(
                  lead.phone,
                  generateWhatsAppMessage(lead, "greeting")
                )}
                target="_blank"
                rel="noreferrer"
                className="btn btn-success btn-sm"
                style={{
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0
                }}
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

          {/* 1-Click Quick Reschedule Preset Button */}
          <div className="quick-snooze-wrap">
            <button
              type="button"
              className="quick-snooze-btn"
              onClick={() => {
                setActiveSnoozeLeadId(isSnoozeOpen ? null : lead._id);
                setActiveQualityLeadId(null);
                setActiveStageLeadId(null);
                setActivePriorityLeadId(null);
              }}
              title="1-Click Quick Reschedule Presets"
            >
              ⚡ Snooze ▾
            </button>
            {isSnoozeOpen && (
              <div className="quick-snooze-menu">
                <button
                  type="button"
                  className="quick-snooze-item"
                  onClick={() => handleQuickSnoozePreset(lead, "+2h")}
                >
                  ⏱️ +2 Hours
                </button>
                <button
                  type="button"
                  className="quick-snooze-item"
                  onClick={() => handleQuickSnoozePreset(lead, "tomorrow_10am")}
                >
                  🌅 Tomorrow 10:00 AM
                </button>
                <button
                  type="button"
                  className="quick-snooze-item"
                  onClick={() => handleQuickSnoozePreset(lead, "tomorrow_2pm")}
                >
                  ☀️ Tomorrow 2:00 PM
                </button>
                <button
                  type="button"
                  className="quick-snooze-item"
                  onClick={() => handleQuickSnoozePreset(lead, "next_monday")}
                >
                  📅 Next Monday 10:00 AM
                </button>
                <button
                  type="button"
                  className="quick-snooze-item"
                  style={{
                    borderTop: "1px solid var(--border)",
                    color: "var(--accent)"
                  }}
                  onClick={() => {
                    setActiveSnoozeLeadId(null);
                    setRescheduleLead(lead);
                    setNewDate(toDateKey(lead.followUpDate));
                    setNewTime(lead.followUpTime || "10:00");
                  }}
                >
                  ✏️ Custom Date...
                </button>
              </div>
            )}
          </div>

          {/* 1-Click Done */}
          <button
            type="button"
            className="btn-done-pill"
            onClick={() => handleMarkDone(lead)}
            title="1-Click Mark Follow-up Completed & Clear From Queue"
          >
            ✓ Done
          </button>

          {/* Open Lead */}
          <Link to={`/leads/${lead._id}`} className="btn btn-secondary btn-sm">
            Open Lead
          </Link>
        </div>
      </div>
    );
  };

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
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            📋 Lead Manager
            {isSyncing && (
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  color: "var(--text3)",
                  background: "var(--surface2)",
                  padding: "0.2rem 0.55rem",
                  borderRadius: "999px",
                  border: "1px solid var(--border)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem"
                }}
                title="Syncing fresh data with database in background..."
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "8px",
                    height: "8px",
                    border: "2px solid var(--border)",
                    borderTopColor: "var(--primary)",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite"
                  }}
                />
                Syncing...
              </span>
            )}
          </h1>
          <p style={{ color: "var(--text2)", fontSize: "0.9rem" }}>
            Real-time sales follow-up and interaction tracking dashboard
          </p>
        </div>

        {/* Next Call Banner */}
        <div
          className="card next-call-banner"
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

      {/* 🚨 OVERDUE CALLS (High Priority / Urgent Alert Section) */}
      {overdueQueue.length > 0 && (
        <div className="urgency-section">
          <div className="urgency-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <div className="urgency-header-title" style={{ color: "#dc2626" }}>
                <span>🚨</span>
                <span>OVERDUE CALLS</span>
                <span className="badge-count-overdue">{overdueQueue.length}</span>
              </div>
              <span style={{ fontSize: "0.82rem", color: "#dc2626", fontWeight: 600 }}>
                Action required — missed follow-up schedule
              </span>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={toggleCompactQueue}
              title="Toggle between Compact Strip View and Detailed View"
              style={{
                fontSize: "0.78rem",
                padding: "0.22rem 0.65rem",
                fontWeight: 700,
                borderRadius: "9999px",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem"
              }}
            >
              {compactQueue ? "⊟ Expanded View" : "⊞ Compact View"}
            </button>
          </div>
          <div className="calling-queue">
            {overdueQueue.map((lead) => renderQueueCard(lead, true))}
          </div>
        </div>
      )}

      {/* ⏰ TODAY'S SCHEDULED CALLS (Chronological Timeline) */}
      <div className="urgency-section">
        <div className="urgency-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <div className="urgency-header-title">
              <span>⏰</span>
              <span>TODAY'S SCHEDULED CALLS</span>
              <span className="badge-count-today">{todayQueue.length}</span>
            </div>
            <span style={{ fontSize: "0.82rem", color: "var(--text3)" }}>
              Upcoming follow-ups for today
            </span>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={toggleCompactQueue}
            title="Toggle between Compact Strip View and Detailed View"
            style={{
              fontSize: "0.78rem",
              padding: "0.22rem 0.65rem",
              fontWeight: 700,
              borderRadius: "9999px",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem"
            }}
          >
            {compactQueue ? "⊟ Expanded View" : "⊞ Compact View"}
          </button>
        </div>

        {todayQueue.length === 0 ? (
          <div
            className="card"
            style={{
              padding: "1.75rem 1.5rem",
              textAlign: "center",
              color: "var(--text2)",
              background: "var(--surface)"
            }}
          >
            {overdueQueue.length === 0 ? (
              <>
                <span style={{ fontSize: "1.75rem", display: "block", marginBottom: "0.5rem" }}>
                  🎉
                </span>
                <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text)" }}>
                  No follow-ups due right now!
                </span>
                <p style={{ fontSize: "0.85rem", color: "var(--text3)", marginTop: "0.25rem" }}>
                  You are completely caught up on your calling queue.
                </p>
              </>
            ) : (
              <>
                <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)" }}>
                  No more calls scheduled for today.
                </span>
                <p style={{ fontSize: "0.82rem", color: "var(--text3)", marginTop: "0.25rem" }}>
                  Please focus on clearing the {overdueQueue.length} overdue call{overdueQueue.length > 1 ? "s" : ""} listed above!
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="calling-queue">
            {todayQueue.map((lead) => renderQueueCard(lead, false))}
          </div>
        )}
      </div>

      {/* STREAMLINED FILTER & SEARCH BAR */}
      <div className="filter-bar">
        {/* Presets Chips Row */}
        <div className="presets-scroll-wrap">
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text2)", flexShrink: 0 }}>
            Presets:
          </span>
          {[
            { id: "all", label: "All Leads" },
            { id: "today", label: "Today's Follow-ups" },
            { id: "hot", label: "Hot Leads" },
            { id: "p1", label: "Urgent P1" },
            { id: "converted", label: "Converted" },
            { id: "overdue", label: "Overdue" }
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`pill-btn ${activePreset === preset.id ? "active" : ""}`}
              onClick={() => setActivePreset(preset.id)}
              style={{ flexShrink: 0 }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Search, Filter Toggle, and Excel Export Row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem"
          }}
        >
          <div style={{ flex: 1, minWidth: "240px", position: "relative", display: "flex", alignItems: "center" }}>
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

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            {/* Collapsible Advanced Filters Toggle Button */}
            <button
              type="button"
              className={`btn btn-sm ${showAdvancedFilters || activeFilterCount > 0 ? "btn-primary" : "btn-outline"}`}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
              title="Toggle advanced filters dropdown panel"
            >
              <span>⚙️ Filters</span>
              {activeFilterCount > 0 && (
                <span
                  style={{
                    background: "#ffffff",
                    color: "var(--accent)",
                    fontSize: "0.7rem",
                    fontWeight: 800,
                    padding: "0.1rem 0.45rem",
                    borderRadius: "9999px"
                  }}
                >
                  {activeFilterCount}
                </span>
              )}
              <span style={{ fontSize: "0.75rem" }}>{showAdvancedFilters ? "▲" : "▼"}</span>
            </button>

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

        {/* Collapsible Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="filter-collapsible-panel">
            <div className="filter-grid">
              <div className="form-group" style={{ marginBottom: 0 }}>
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

              <div className="form-group" style={{ marginBottom: 0 }}>
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

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Stage</label>
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                >
                  <option value="all">All Stages</option>
                  {stageOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
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

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Enquiry From</label>
                <input
                  type="date"
                  value={enquiryFrom}
                  onChange={(e) => setEnquiryFrom(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Enquiry To</label>
                <input
                  type="date"
                  value={enquiryTo}
                  onChange={(e) => setEnquiryTo(e.target.value)}
                />
              </div>
            </div>

            {/* Filter Panel Footer Action Bar */}
            <div className="filter-panel-footer">
              <div style={{ fontSize: "0.82rem", color: "var(--text2)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                {activeFilterCount > 0 ? (
                  <span>
                    🎯 <strong>{activeFilterCount}</strong> active filter{activeFilterCount > 1 ? "s" : ""} applied
                  </span>
                ) : (
                  <span>All filters at default</span>
                )}
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ color: "var(--danger)", borderColor: "var(--border)" }}
                onClick={clearAllFilters}
                disabled={activeFilterCount === 0 && !searchTerm}
              >
                ✕ Clear All Filters
              </button>
            </div>
          </div>
        )}
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
                {sortedLeads.map((lead, index) => {
                  const cleaned = cleanPhone(lead.phone);
                  const followUpStatus = getFollowUpStatus(lead);
                  const isNearBottom = sortedLeads.length > 3 && index >= sortedLeads.length - 2;
                  const isQualityMenuOpen = activeQualityMenuLeadId === lead._id;
                  const isStageMenuOpen = activeStageLeadId === `tbl-${lead._id}`;
                  const isPriorityMenuOpen = activePriorityLeadId === `tbl-${lead._id}`;
                  const isSnoozeMenuOpen = activeSnoozeLeadId === `tbl-${lead._id}`;

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

                      {/* Name & 1-Click Stage */}
                      <td>
                        <Link
                          to={`/leads/${lead._id}`}
                          style={{ fontWeight: 700, color: "var(--text)", textDecoration: "none" }}
                        >
                          {lead.name}
                        </Link>
                        <div style={{ marginTop: "0.25rem" }}>
                          <div className="one-click-dropdown-wrap">
                            <button
                              type="button"
                              className={`one-click-pill ${getStageBadgeClass(lead.stage)}`}
                              style={{ fontSize: "0.72rem", padding: "0.15rem 0.45rem" }}
                              onClick={() => {
                                setActiveStageLeadId(isStageMenuOpen ? null : `tbl-${lead._id}`);
                                setActiveQualityMenuLeadId(null);
                                setActivePriorityLeadId(null);
                                setActiveSnoozeLeadId(null);
                              }}
                              title="1-Click Change Stage"
                            >
                              {lead.stage || "New"} ▾
                            </button>
                            {isStageMenuOpen && (
                              <div
                                className="one-click-popover"
                                style={{
                                  minWidth: "150px",
                                  zIndex: 1100,
                                  ...(isNearBottom
                                    ? { bottom: "calc(100% + 4px)", top: "auto" }
                                    : { top: "calc(100% + 4px)" })
                                }}
                              >
                                {stageOptions.map((s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    className={`one-click-popover-item ${lead.stage === s ? "active" : ""}`}
                                    onClick={() => {
                                      handleStageChange(lead._id, s);
                                      setActiveStageLeadId(null);
                                    }}
                                  >
                                    <span>{s}</span>
                                    {lead.stage === s && (
                                      <span style={{ color: "var(--accent)", fontWeight: 800 }}>✓</span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Phone + Action Links */}
                      <td>
                        <div style={{ fontWeight: 500 }} className="phone-mono">
                          {lead.phone || "—"}
                        </div>
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

                      {/* 1-Click Quality Dropdown */}
                      <td style={{ position: "relative" }}>
                        <div className="one-click-dropdown-wrap">
                          <button
                            type="button"
                            className={`one-click-pill ${getQualityBadgeClass(lead.quality)}`}
                            style={{ fontSize: "0.78rem", padding: "0.22rem 0.55rem" }}
                            onClick={() => {
                              setActiveQualityMenuLeadId(isQualityMenuOpen ? null : lead._id);
                              setActiveStageLeadId(null);
                              setActivePriorityLeadId(null);
                              setActiveSnoozeLeadId(null);
                            }}
                            title="1-Click Change Quality"
                          >
                            {lead.quality || "Quality"} ▾
                          </button>

                          {isQualityMenuOpen && (
                            <div
                              className="one-click-popover"
                              style={{
                                minWidth: "175px",
                                zIndex: 1100,
                                ...(isNearBottom
                                  ? { bottom: "calc(100% + 4px)", top: "auto" }
                                  : { top: "calc(100% + 4px)" })
                              }}
                            >
                              {qualityOptions.map((q) => (
                                <button
                                  key={q}
                                  type="button"
                                  className={`one-click-popover-item ${lead.quality === q ? "active" : ""}`}
                                  onClick={() => {
                                    handleQualityChange(lead._id, q);
                                    setActiveQualityMenuLeadId(null);
                                  }}
                                >
                                  <span>{q}</span>
                                  {lead.quality === q && (
                                    <span style={{ color: "var(--accent)", fontWeight: 800 }}>✓</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Enquiry Date */}
                      <td style={{ fontSize: "0.82rem", color: "var(--text2)" }}>
                        {formatDateDisplay(lead.enquiryDate)}
                      </td>

                      {/* Follow-up Date/Time with ⚡ quick presets & ✏️ custom modal */}
                      <td>
                        {lead.followUpDate ? (
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                              <span style={{ fontWeight: 600 }}>
                                {formatDateDisplay(lead.followUpDate)}
                              </span>
                              <div className="quick-snooze-wrap">
                                <button
                                  type="button"
                                  className="quick-snooze-btn"
                                  style={{ padding: "0.1rem 0.35rem", fontSize: "0.72rem" }}
                                  title="1-Click Quick Reschedule Presets"
                                  onClick={() => {
                                    setActiveSnoozeLeadId(isSnoozeMenuOpen ? null : `tbl-${lead._id}`);
                                    setActiveQualityMenuLeadId(null);
                                    setActiveStageLeadId(null);
                                    setActivePriorityLeadId(null);
                                  }}
                                >
                                  ⚡
                                </button>
                                {isSnoozeMenuOpen && (
                                  <div
                                    className="quick-snooze-menu"
                                    style={isNearBottom ? { bottom: "calc(100% + 4px)", top: "auto" } : { top: "calc(100% + 4px)" }}
                                  >
                                    <button
                                      type="button"
                                      className="quick-snooze-item"
                                      onClick={() => handleQuickSnoozePreset(lead, "+2h")}
                                    >
                                      ⏱️ +2 Hours
                                    </button>
                                    <button
                                      type="button"
                                      className="quick-snooze-item"
                                      onClick={() => handleQuickSnoozePreset(lead, "tomorrow_10am")}
                                    >
                                      🌅 Tomorrow 10:00 AM
                                    </button>
                                    <button
                                      type="button"
                                      className="quick-snooze-item"
                                      onClick={() => handleQuickSnoozePreset(lead, "tomorrow_2pm")}
                                    >
                                      ☀️ Tomorrow 2:00 PM
                                    </button>
                                    <button
                                      type="button"
                                      className="quick-snooze-item"
                                      onClick={() => handleQuickSnoozePreset(lead, "next_monday")}
                                    >
                                      📅 Next Monday 10:00 AM
                                    </button>
                                    <button
                                      type="button"
                                      className="quick-snooze-item"
                                      style={{
                                        borderTop: "1px solid var(--border)",
                                        color: "var(--accent)"
                                      }}
                                      onClick={() => {
                                        setActiveSnoozeLeadId(null);
                                        setRescheduleLead(lead);
                                        setNewDate(toDateKey(lead.followUpDate));
                                        setNewTime(lead.followUpTime || "10:00");
                                      }}
                                    >
                                      ✏️ Custom Date...
                                    </button>
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: "0.75rem",
                                  padding: "2px"
                                }}
                                title="Custom reschedule date & time"
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
                              <div style={{ marginTop: "0.2rem" }}>
                                <span
                                  className={`relative-badge ${
                                    followUpStatus.type === "overdue"
                                      ? "relative-badge-overdue"
                                      : followUpStatus.type === "duesoon"
                                      ? "relative-badge-duesoon"
                                      : "relative-badge-upcoming"
                                  }`}
                                >
                                  {followUpStatus.type === "overdue"
                                    ? "🔴"
                                    : followUpStatus.type === "duesoon"
                                    ? "🟠"
                                    : "🟢"}{" "}
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

                      {/* 1-Click Priority Dropdown */}
                      <td>
                        <div className="one-click-dropdown-wrap">
                          <button
                            type="button"
                            className={`one-click-pill ${getPriorityBadgeClass(lead.priority)}`}
                            style={{ fontSize: "0.75rem", padding: "0.18rem 0.5rem" }}
                            onClick={() => {
                              setActivePriorityLeadId(isPriorityMenuOpen ? null : `tbl-${lead._id}`);
                              setActiveQualityMenuLeadId(null);
                              setActiveStageLeadId(null);
                              setActiveSnoozeLeadId(null);
                            }}
                            title="1-Click Change Priority"
                          >
                            P{lead.priority || 3} ▾
                          </button>
                          {isPriorityMenuOpen && (
                            <div
                              className="one-click-popover"
                              style={{
                                minWidth: "125px",
                                zIndex: 1100,
                                ...(isNearBottom
                                  ? { bottom: "calc(100% + 4px)", top: "auto" }
                                  : { top: "calc(100% + 4px)" })
                              }}
                            >
                              {priorityOptions.map((p) => (
                                <button
                                  key={p}
                                  type="button"
                                  className={`one-click-popover-item ${lead.priority === p ? "active" : ""}`}
                                  onClick={() => {
                                    handlePriorityChange(lead._id, p);
                                    setActivePriorityLeadId(null);
                                  }}
                                >
                                  <span>P{p} Priority</span>
                                  {lead.priority === p && (
                                    <span style={{ color: "var(--accent)", fontWeight: 800 }}>✓</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Sticky Reminder / Notes */}
                      <td style={{ maxWidth: "220px" }}>
                        <button
                          type="button"
                          className="btn-note-inline"
                          onClick={() => handleQuickNote(lead)}
                          title={lead.reminderNote ? `Note: ${lead.reminderNote} (Click to edit)` : "Click to add a sticky note"}
                          style={{ maxWidth: "200px", textAlign: "left", display: "inline-block" }}
                        >
                          📌 {lead.reminderNote ? (lead.reminderNote.length > 22 ? lead.reminderNote.substring(0, 22) + "..." : lead.reminderNote) : "+ Add Note"}
                        </button>
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
                            to={`/edit/${lead._id}`}
                            className="btn btn-outline btn-sm"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                            title="Edit Full Lead Details"
                          >
                            ✏️ Edit
                          </Link>
                          <Link
                            to={`/leads/${lead._id}`}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                            title="View Lead Details & Timeline"
                          >
                            View
                          </Link>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{
                              fontSize: "0.75rem",
                              padding: "0.2rem 0.4rem",
                              color: "var(--danger)",
                              borderColor: "var(--border)"
                            }}
                            title="Delete Lead"
                            onClick={() => setLeadToDelete(lead)}
                          >
                            🗑️
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
                    📞 <span className="phone-mono">{lead.phone || "No phone"}</span>
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
                          className={`relative-badge ${
                            followUpStatus.type === "overdue"
                              ? "relative-badge-overdue"
                              : followUpStatus.type === "duesoon"
                              ? "relative-badge-duesoon"
                              : "relative-badge-upcoming"
                          }`}
                        >
                          {followUpStatus.type === "overdue" ? "🔴" : followUpStatus.type === "duesoon" ? "🟠" : "🟢"}{" "}
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
                      to={`/edit/${lead._id}`}
                      className="btn btn-outline btn-sm"
                      title="Edit Full Lead Details"
                    >
                      ✏️ Edit
                    </Link>

                    <Link
                      to={`/leads/${lead._id}`}
                      className="btn btn-secondary btn-sm"
                    >
                      View
                    </Link>

                    {/* 1-Click Quick Reschedule Presets on Mobile */}
                    <div className="quick-snooze-wrap">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() =>
                          setActiveSnoozeLeadId(
                            activeSnoozeLeadId === `mob-${lead._id}`
                              ? null
                              : `mob-${lead._id}`
                          )
                        }
                        title="1-Click Quick Reschedule Presets"
                      >
                        ⚡
                      </button>
                      {activeSnoozeLeadId === `mob-${lead._id}` && (
                        <div className="quick-snooze-menu">
                          <button
                            type="button"
                            className="quick-snooze-item"
                            onClick={() => handleQuickSnoozePreset(lead, "+2h")}
                          >
                            ⏱️ +2 Hours
                          </button>
                          <button
                            type="button"
                            className="quick-snooze-item"
                            onClick={() => handleQuickSnoozePreset(lead, "tomorrow_10am")}
                          >
                            🌅 Tomorrow 10:00 AM
                          </button>
                          <button
                            type="button"
                            className="quick-snooze-item"
                            onClick={() => handleQuickSnoozePreset(lead, "tomorrow_2pm")}
                          >
                            ☀️ Tomorrow 2:00 PM
                          </button>
                          <button
                            type="button"
                            className="quick-snooze-item"
                            onClick={() => handleQuickSnoozePreset(lead, "next_monday")}
                          >
                            📅 Next Monday 10:00 AM
                          </button>
                          <button
                            type="button"
                            className="quick-snooze-item"
                            style={{
                              borderTop: "1px solid var(--border)",
                              color: "var(--accent)"
                            }}
                            onClick={() => {
                              setActiveSnoozeLeadId(null);
                              setRescheduleLead(lead);
                              setNewDate(toDateKey(lead.followUpDate));
                              setNewTime(lead.followUpTime || "10:00");
                            }}
                          >
                            ✏️ Custom Date...
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      title="Custom Reschedule Date & Time"
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
