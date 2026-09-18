import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useCallStatus } from "../context/CallStatusContext";
import { useWhatsAppBar } from "../context/WhatsAppBarContext";
import { fetchLeadsWithCache } from "../utils/leadCache";

export default function GlobalSearch({ isMobile = false }) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [allLeads, setAllLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const { initiateCall } = useCallStatus();
  const { openWhatsAppBar } = useWhatsAppBar();

  // Fetch leads for instant local searching (using shared in-memory cache)
  const loadLeads = async () => {
    if (allLeads.length > 0) return;
    try {
      setLoading(true);
      const data = await fetchLeadsWithCache();
      if (Array.isArray(data)) {
        setAllLeads(data);
      }
    } catch (err) {
      console.error("Global search leads fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // Keyboard shortcut: Ctrl+K or / to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
      const isInputActive = activeTag === "input" || activeTag === "textarea" || activeTag === "select";

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
        loadLeads();
      } else if (e.key === "/" && !isInputActive) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
        loadLeads();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [allLeads.length]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync with URL search param if on dashboard
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchParam = params.get("search");
    if (searchParam && searchParam !== query) {
      setQuery(searchParam);
    }
  }, [location.search]);

  // Filter leads based on query
  const filteredLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const digitsOnly = q.replace(/[^0-9]/g, "");

    return allLeads.filter((lead) => {
      const name = (lead.name || "").toLowerCase();
      const email = (lead.email || "").toLowerCase();
      const leadId = (lead.leadId || "").toLowerCase();
      const mongoId = (lead._id || "").toLowerCase();
      const course = (lead.courseInterested || lead.course || "").toLowerCase();
      const notes = (lead.notes || "").toLowerCase();

      const nameMatch = name.includes(q);
      const emailMatch = email.includes(q);
      const idMatch = leadId.includes(q) || mongoId.includes(q);
      const courseMatch = course.includes(q);
      const notesMatch = notes.includes(q);

      let phoneMatch = false;
      if (digitsOnly.length > 0) {
        const leadPhone = (lead.phone || "").replace(/[^0-9]/g, "");
        const leadAltPhone = (lead.alternatePhone || "").replace(/[^0-9]/g, "");
        phoneMatch = leadPhone.includes(digitsOnly) || leadAltPhone.includes(digitsOnly);
      }

      return nameMatch || emailMatch || idMatch || courseMatch || notesMatch || phoneMatch;
    });
  }, [query, allLeads]);

  // Display top 6 results
  const previewResults = useMemo(() => {
    return filteredLeads.slice(0, 6);
  }, [filteredLeads]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setSelectedIndex(-1);
    setIsOpen(true);
    if (allLeads.length === 0) {
      loadLeads();
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    if (allLeads.length === 0) {
      loadLeads();
    }
  };

  const handleClear = () => {
    setQuery("");
    setSelectedIndex(-1);
    inputRef.current?.focus();
    if (location.pathname === "/") {
      navigate("/");
    }
  };

  const handleSelectLead = (lead) => {
    setIsOpen(false);
    navigate(`/leads/${lead._id}`);
  };

  const handleViewAllOnDashboard = () => {
    setIsOpen(false);
    const targetUrl = query.trim() ? `/?search=${encodeURIComponent(query.trim())}` : "/";
    navigate(targetUrl);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "ArrowDown") {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < previewResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : previewResults.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && previewResults[selectedIndex]) {
        handleSelectLead(previewResults[selectedIndex]);
      } else {
        handleViewAllOnDashboard();
      }
    }
  };

  const getQualityBadgeStyle = (quality) => {
    switch (quality) {
      case "Hot Lead":
        return { bg: "rgba(220, 38, 38, 0.15)", color: "#dc2626", border: "rgba(220, 38, 38, 0.3)" };
      case "Warm Lead":
        return { bg: "rgba(217, 119, 6, 0.15)", color: "#d97706", border: "rgba(217, 119, 6, 0.3)" };
      case "Cold Lead":
        return { bg: "rgba(59, 130, 246, 0.15)", color: "#2563eb", border: "rgba(59, 130, 246, 0.3)" };
      default:
        return { bg: "var(--surface2)", color: "var(--text2)", border: "var(--border)" };
    }
  };

  return (
    <div className={`global-search-container ${isMobile ? "is-mobile-search" : ""}`} ref={containerRef}>
      {/* Search Input Box */}
      <div className={`global-search-input-wrap ${isOpen ? "is-focused" : ""}`}>
        <span className="global-search-icon" onClick={() => inputRef.current?.focus()}>
          🔍
        </span>
        <input
          ref={inputRef}
          type="text"
          className="global-search-input"
          placeholder="Search leads, phone, ID..."
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          aria-label="Global Search Leads"
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            className="global-search-clear-btn"
            onClick={handleClear}
            title="Clear search"
          >
            ✕
          </button>
        ) : (
          <kbd className="global-search-kbd" title="Shortcut to search">
            /
          </kbd>
        )}
      </div>

      {/* Live Instant Results Dropdown */}
      {isOpen && query.trim().length > 0 && (
        <div className="global-search-dropdown">
          {/* Header */}
          <div className="global-search-header">
            <span className="global-search-count">
              {loading
                ? "Searching leads..."
                : filteredLeads.length === 0
                ? "No matching leads found"
                : `Found ${filteredLeads.length} lead${filteredLeads.length === 1 ? "" : "s"}`}
            </span>
            {filteredLeads.length > 0 && (
              <span className="global-search-hint">↑↓ to navigate • Enter to select</span>
            )}
          </div>

          {/* Results List */}
          <div className="global-search-list">
            {previewResults.map((lead, idx) => {
              const qualityStyle = getQualityBadgeStyle(lead.quality);
              const isSelected = selectedIndex === idx;

              return (
                <div
                  key={lead._id || idx}
                  className={`global-search-item ${isSelected ? "selected" : ""}`}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => handleSelectLead(lead)}
                >
                  <div className="global-search-lead-main">
                    {/* Initial Avatar */}
                    <div className="global-search-avatar">
                      {(lead.name || "L").charAt(0).toUpperCase()}
                    </div>

                    {/* Lead Info */}
                    <div className="global-search-info">
                      <div className="global-search-name-row">
                        <span className="global-search-name">{lead.name || "Unknown Lead"}</span>
                        {lead.leadId && (
                          <span className="global-search-id-badge">#{lead.leadId}</span>
                        )}
                        {lead.quality && (
                          <span
                            className="global-search-quality-pill"
                            style={{
                              background: qualityStyle.bg,
                              color: qualityStyle.color,
                              borderColor: qualityStyle.border
                            }}
                          >
                            {lead.quality}
                          </span>
                        )}
                      </div>

                      <div className="global-search-meta-row">
                        <span className="global-search-phone">📞 {lead.phone || "No phone"}</span>
                        {lead.courseInterested && (
                          <span className="global-search-course">
                            • 📚 {lead.courseInterested}
                          </span>
                        )}
                        {lead.stage && (
                          <span className="global-search-stage">
                            • <span style={{ color: "var(--accent)", fontWeight: 600 }}>{lead.stage}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 1-Click Action Buttons */}
                  <div
                    className="global-search-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* 📞 Call */}
                    <button
                      type="button"
                      className="btn btn-primary btn-sm global-search-action-btn"
                      onClick={() => {
                        setIsOpen(false);
                        initiateCall(lead);
                      }}
                      title={`Call ${lead.name || lead.phone}`}
                    >
                      📞 Call
                    </button>

                    {/* 💬 WhatsApp */}
                    <button
                      type="button"
                      className="btn btn-success btn-sm global-search-action-btn"
                      onClick={() => {
                        setIsOpen(false);
                        openWhatsAppBar(lead);
                      }}
                      title="Open WhatsApp templates"
                    >
                      💬 WA
                    </button>

                    {/* 📧 Email */}
                    <button
                      type="button"
                      className="btn btn-sm global-search-action-btn"
                      style={{
                        background: "rgba(59, 130, 246, 0.12)",
                        color: "#2563eb",
                        border: "1px solid rgba(59, 130, 246, 0.35)",
                        fontWeight: 600
                      }}
                      onClick={() => {
                        setIsOpen(false);
                        navigate(`/emails?leadId=${lead._id}`);
                      }}
                      title="Compose email in Outlook Web"
                    >
                      📧 Email
                    </button>

                    {/* Open Lead */}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm global-search-action-btn"
                      onClick={() => {
                        setIsOpen(false);
                        navigate(`/leads/${lead._id}`);
                      }}
                      title="Open full lead details"
                    >
                      Open →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer - View All On Dashboard */}
          {filteredLeads.length > 0 && (
            <div className="global-search-footer" onClick={handleViewAllOnDashboard}>
              <span>
                View all <strong>{filteredLeads.length}</strong> matching leads on Dashboard
              </span>
              <span className="global-search-footer-arrow">↵</span>
            </div>
          )}
        </div>
      )}

      {/* Embedded CSS for Global Search */}
      <style>{`
        .global-search-container {
          position: relative;
          display: flex;
          align-items: center;
        }
        .global-search-input-wrap {
          display: flex;
          align-items: center;
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 0 0.55rem;
          height: 36px;
          width: 230px;
          transition: all 0.2s ease;
        }
        .global-search-input-wrap.is-focused {
          width: 310px;
          border-color: var(--accent);
          background: var(--surface);
          box-shadow: 0 0 0 2px var(--accent-bg);
        }
        .global-search-icon {
          font-size: 0.85rem;
          color: var(--text3);
          margin-right: 0.45rem;
          cursor: pointer;
          user-select: none;
        }
        .global-search-input {
          flex: 1;
          border: none;
          background: transparent;
          color: var(--text);
          font-size: 0.82rem;
          font-weight: 500;
          outline: none;
          width: 100%;
        }
        .global-search-input::placeholder {
          color: var(--text3);
          font-size: 0.8rem;
        }
        .global-search-clear-btn {
          background: transparent;
          border: none;
          color: var(--text3);
          font-size: 0.75rem;
          cursor: pointer;
          padding: 0.2rem 0.35rem;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .global-search-clear-btn:hover {
          color: var(--text);
          background: var(--surface2);
        }
        .global-search-kbd {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 0.1rem 0.35rem;
          font-size: 0.68rem;
          font-weight: 700;
          color: var(--text3);
          line-height: 1;
          user-select: none;
        }
        .global-search-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 450px;
          max-width: 90vw;
          background: var(--surface);
          border: 1px solid var(--border2);
          border-radius: var(--radius);
          box-shadow: 0 12px 30px -4px rgba(0, 0, 0, 0.35), 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1200;
          overflow: hidden;
          animation: globalSearchFadeIn 0.15s ease-out;
        }
        @keyframes globalSearchFadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .global-search-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.6rem 0.85rem;
          background: var(--surface2);
          border-bottom: 1px solid var(--border);
        }
        .global-search-count {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text2);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .global-search-hint {
          font-size: 0.7rem;
          color: var(--text3);
        }
        .global-search-list {
          max-height: 380px;
          overflow-y: auto;
        }
        .global-search-item {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 0.75rem 0.85rem;
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          transition: background 0.12s ease;
        }
        .global-search-item:last-child {
          border-bottom: none;
        }
        .global-search-item:hover,
        .global-search-item.selected {
          background: var(--surface2);
        }
        .global-search-lead-main {
          display: flex;
          align-items: flex-start;
          gap: 0.65rem;
        }
        .global-search-avatar {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--accent-bg);
          color: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 0.85rem;
          flex-shrink: 0;
        }
        .global-search-info {
          flex: 1;
          min-width: 0;
        }
        .global-search-name-row {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          flex-wrap: wrap;
        }
        .global-search-name {
          font-weight: 700;
          font-size: 0.88rem;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .global-search-id-badge {
          font-size: 0.68rem;
          font-weight: 700;
          background: var(--surface2);
          color: var(--text3);
          padding: 0.1rem 0.35rem;
          border-radius: 4px;
          border: 1px solid var(--border);
        }
        .global-search-quality-pill {
          font-size: 0.68rem;
          font-weight: 700;
          padding: 0.1rem 0.4rem;
          border-radius: 9999px;
          border-width: 1px;
          border-style: solid;
        }
        .global-search-meta-row {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.74rem;
          color: var(--text2);
          margin-top: 0.2rem;
          flex-wrap: wrap;
        }
        .global-search-phone {
          font-weight: 600;
          color: var(--text);
        }
        .global-search-actions {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding-left: 2.65rem;
        }
        .global-search-action-btn {
          height: 26px !important;
          padding: 0 0.55rem !important;
          font-size: 0.72rem !important;
        }
        .global-search-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.65rem 0.85rem;
          background: var(--surface2);
          border-top: 1px solid var(--border);
          font-size: 0.78rem;
          color: var(--accent);
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .global-search-footer:hover {
          background: var(--accent-bg);
        }
        .global-search-footer-arrow {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 0.05rem 0.35rem;
          font-size: 0.7rem;
          color: var(--text2);
        }

        @media (max-width: 1100px) {
          .global-search-input-wrap {
            width: 180px;
          }
          .global-search-input-wrap.is-focused {
            width: 220px;
          }
          .global-search-dropdown {
            width: 380px;
          }
        }
        @media (max-width: 768px) {
          .global-search-container:not(.is-mobile-search) {
            display: none;
          }
          .global-search-container.is-mobile-search {
            display: flex;
            width: 100%;
            margin-bottom: 0.5rem;
          }
          .global-search-container.is-mobile-search .global-search-input-wrap {
            width: 100% !important;
          }
          .global-search-container.is-mobile-search .global-search-dropdown {
            position: static;
            width: 100% !important;
            max-width: 100% !important;
            margin-top: 0.5rem;
            box-shadow: var(--shadow);
          }
        }
      `}</style>
    </div>
  );
}
