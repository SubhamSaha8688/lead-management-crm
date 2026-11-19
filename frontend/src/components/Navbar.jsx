import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useWhatsAppBar } from "../context/WhatsAppBarContext";
import { useEmailBar } from "../context/EmailBarContext";
import GlobalSearch from "./GlobalSearch";
import CrmPortalModal from "./CrmPortalModal";

export default function Navbar({ theme, toggleTheme, badgeCount, onToggleNotifs }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCrmModalOpen, setIsCrmModalOpen] = useState(false);
  const [crmModalTab, setCrmModalTab] = useState("lead");
  const location = useLocation();
  const { openWhatsAppBar, templates } = useWhatsAppBar();
  const { openEmailBar, templates: emailTemplates } = useEmailBar();

  // Close mobile drawer whenever route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile drawer when pressing Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  const isActive = (path) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  const handleOpenCrmModal = (tab = "lead") => {
    setCrmModalTab(tab);
    setIsCrmModalOpen(true);
    setMobileMenuOpen(false);
  };

  const mobileNavLinks = [
    { name: "Dashboard", path: "/", icon: "⊞" },
    { name: "Calendar", path: "/calendar", icon: "📅" },
    { name: "Pacing", path: "/pacing", icon: "⏱️" },
    { name: "Voicemail", path: "/voicemail", icon: "🎙️" },
    {
      name: "WhatsApp",
      path: "/whatsapp",
      icon: "💬",
      badge: templates && templates.length > 0 ? templates.length : null,
      badgeColor: "#16a34a"
    },
    {
      name: "Emails",
      path: "/emails",
      icon: "📧",
      badge: emailTemplates && emailTemplates.length > 0 ? emailTemplates.length : null,
      badgeColor: "#2563eb"
    },
    { name: "Courses", path: "/courses", icon: "📚" },
    { name: "Settings", path: "/settings", icon: "⚙️" },
    { name: "+ Lead", path: "/add", icon: "➕", isHighlight: true }
  ];

  const totalCommsBadge = (templates?.length || 0) + (emailTemplates?.length || 0);

  return (
    <header className="navbar-container">
      <div className="navbar-inner">
        {/* Left: Brand / Logo with PWA / Site Icon */}
        <Link to="/" className="navbar-brand" onClick={() => setMobileMenuOpen(false)} title="Lead Manager CRM">
          <img
            src="/favicon.svg"
            alt="Lead CRM Logo"
            className="navbar-brand-img"
          />
          <div className="navbar-brand-text">
            <span className="navbar-title">Lead Manager</span>
            <span className="navbar-subtitle">CRM Dashboard</span>
          </div>
        </Link>

        {/* Center: Desktop Navigation with Clean Hover Dropdowns */}
        <nav className="navbar-desktop-links">
          {/* 1. Core Fast Links */}
          <Link to="/" className={`nav-link ${isActive("/") ? "active" : ""}`}>
            <span className="nav-icon">⊞</span>
            <span className="nav-text">Dashboard</span>
          </Link>

          <Link to="/calendar" className={`nav-link ${isActive("/calendar") ? "active" : ""}`}>
            <span className="nav-icon">📅</span>
            <span className="nav-text">Calendar</span>
          </Link>

          <Link to="/pacing" className={`nav-link ${isActive("/pacing") ? "active" : ""}`}>
            <span className="nav-icon">⏱️</span>
            <span className="nav-text">Pacing</span>
          </Link>

          <Link to="/voicemail" className={`nav-link ${isActive("/voicemail") ? "active" : ""}`}>
            <span className="nav-icon">🎙️</span>
            <span className="nav-text">Voicemail</span>
          </Link>

          {/* 2. Hover Dropdown: ⚡ CRM Hub (Lead ID Sync & Call Audio) */}
          <div className="nav-dropdown">
            <button
              type="button"
              className="nav-dropdown-trigger crm-hub-trigger"
              onClick={() => handleOpenCrmModal("lead")}
              title="Henry Harvin CRM Portal Sync & Audio Hub"
            >
              <span className="nav-icon">⚡</span>
              <span className="nav-text">CRM Hub</span>
              <span className="nav-dropdown-caret">▾</span>
            </button>
            <div className="nav-dropdown-menu">
              <button
                type="button"
                className="nav-dropdown-item"
                onClick={() => handleOpenCrmModal("lead")}
              >
                <span className="item-icon">⚡</span>
                <div className="item-body">
                  <span className="item-title">Fetch & Sync Lead ID</span>
                  <span className="item-sub">Structured JSON & auto-fee save</span>
                </div>
              </button>
              <button
                type="button"
                className="nav-dropdown-item"
                onClick={() => handleOpenCrmModal("call")}
              >
                <span className="item-icon">🎧</span>
                <div className="item-body">
                  <span className="item-title">Call Report & Audio</span>
                  <span className="item-sub">Stream & download call recordings</span>
                </div>
              </button>
              <button
                type="button"
                className="nav-dropdown-item"
                onClick={() => handleOpenCrmModal("lead")}
              >
                <span className="item-icon">📋</span>
                <div className="item-body">
                  <span className="item-title">Paste Portal JSON</span>
                  <span className="item-sub">Instant 1-click clipboard import</span>
                </div>
              </button>
            </div>
          </div>

          {/* 3. Hover Dropdown: 💬 Comms */}
          <div className={`nav-dropdown ${isActive("/whatsapp") || isActive("/emails") ? "active" : ""}`}>
            <button
              type="button"
              className={`nav-dropdown-trigger ${isActive("/whatsapp") || isActive("/emails") ? "active" : ""}`}
              onClick={openWhatsAppBar}
              title="Communications & Messaging"
            >
              <span className="nav-icon">💬</span>
              <span className="nav-text">Comms</span>
              {totalCommsBadge > 0 && (
                <span className="nav-badge" style={{ background: "var(--accent)", color: "#fff" }}>
                  {totalCommsBadge}
                </span>
              )}
              <span className="nav-dropdown-caret">▾</span>
            </button>
            <div className="nav-dropdown-menu">
              <Link to="/whatsapp" className={`nav-dropdown-item ${isActive("/whatsapp") ? "active" : ""}`}>
                <span className="item-icon">💬</span>
                <div className="item-body">
                  <span className="item-title">WhatsApp Templates</span>
                  <span className="item-sub">Quick message sequences</span>
                </div>
                {templates && templates.length > 0 && (
                  <span className="nav-badge" style={{ background: "#16a34a", color: "#fff", marginLeft: "auto" }}>
                    {templates.length}
                  </span>
                )}
              </Link>
              <Link to="/emails" className={`nav-dropdown-item ${isActive("/emails") ? "active" : ""}`}>
                <span className="item-icon">📧</span>
                <div className="item-body">
                  <span className="item-title">Email Templates</span>
                  <span className="item-sub">Email pitches & brochures</span>
                </div>
                {emailTemplates && emailTemplates.length > 0 && (
                  <span className="nav-badge" style={{ background: "#2563eb", color: "#fff", marginLeft: "auto" }}>
                    {emailTemplates.length}
                  </span>
                )}
              </Link>
            </div>
          </div>

          {/* 4. Hover Dropdown: ⚙️ Manage */}
          <div className={`nav-dropdown ${isActive("/courses") || isActive("/settings") ? "active" : ""}`}>
            <button
              type="button"
              className={`nav-dropdown-trigger ${isActive("/courses") || isActive("/settings") ? "active" : ""}`}
              title="CRM Settings & Master Catalog"
            >
              <span className="nav-icon">⚙️</span>
              <span className="nav-text">Manage</span>
              <span className="nav-dropdown-caret">▾</span>
            </button>
            <div className="nav-dropdown-menu">
              <Link to="/courses" className={`nav-dropdown-item ${isActive("/courses") ? "active" : ""}`}>
                <span className="item-icon">📚</span>
                <div className="item-body">
                  <span className="item-title">Course Catalog</span>
                  <span className="item-sub">Master fees & syllabus</span>
                </div>
              </Link>
              <Link to="/settings" className={`nav-dropdown-item ${isActive("/settings") ? "active" : ""}`}>
                <span className="item-icon">⚙️</span>
                <div className="item-body">
                  <span className="item-title">System Settings</span>
                  <span className="item-sub">Integrations & preferences</span>
                </div>
              </Link>
            </div>
          </div>

          {/* 5. Highlight Action: + Lead */}
          <Link to="/add" className="nav-link nav-link-highlight">
            <span className="nav-icon">➕</span>
            <span className="nav-text">+ Lead</span>
          </Link>
        </nav>

        {/* Right: Actions (Global Search, Notifications, Theme, Mobile Hamburger) */}
        <div className="navbar-actions">
          {/* Desktop Instant Search */}
          <div className="navbar-desktop-search">
            <GlobalSearch />
          </div>

          {/* Notification Bell Button */}
          <button
            type="button"
            className="navbar-btn notif-bell-btn"
            onClick={onToggleNotifs}
            title="Notifications & Call Alerts"
            aria-label="View notifications"
          >
            <span className="bell-icon">🔔</span>
            {badgeCount > 0 && (
              <span className="notif-badge-count">{badgeCount > 99 ? "99+" : badgeCount}</span>
            )}
          </button>

          {/* Theme Toggle Button */}
          <button
            type="button"
            className="navbar-btn theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            className="navbar-btn mobile-toggle-btn"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Backdrop overlay when mobile menu is open */}
      {mobileMenuOpen && (
        <div
          className="navbar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="navbar-mobile-drawer" role="dialog" aria-label="Mobile Navigation Menu">
          {/* Mobile Instant Search Box */}
          <div className="mobile-search-section">
            <GlobalSearch isMobile />
          </div>

          {/* Mobile CRM Hub Banner Card */}
          <button
            type="button"
            className="mobile-crm-hub-banner"
            onClick={() => handleOpenCrmModal("lead")}
          >
            <div className="mobile-crm-hub-left">
              <span className="mobile-crm-hub-badge">⚡ PORTAL SYNC</span>
              <strong className="mobile-crm-hub-title">Henry Harvin CRM Hub</strong>
              <span className="mobile-crm-hub-sub">Fetch Lead ID • Call Reports • Download Audio</span>
            </div>
            <span className="mobile-crm-hub-arrow">➔</span>
          </button>

          {/* Mobile Links Grid */}
          <div className="mobile-links-grid">
            {mobileNavLinks.map((link) => {
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`mobile-nav-link ${active ? "active" : ""} ${
                    link.isHighlight ? "mobile-highlight" : ""
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="mobile-nav-icon">{link.icon}</span>
                  <span className="mobile-nav-label">{link.name}</span>
                  {link.badge != null && (
                    <span
                      className="mobile-nav-badge"
                      style={{
                        background: link.badgeColor || "var(--accent)"
                      }}
                    >
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Portal Fetch & Call Report Modal */}
      <CrmPortalModal
        isOpen={isCrmModalOpen}
        onClose={() => setIsCrmModalOpen(false)}
        initialTab={crmModalTab}
      />

      {/* Embedded CSS for Navbar & Hover Dropdowns */}
      <style>{`
        .navbar-container {
          position: sticky;
          top: 0;
          z-index: 1000;
          height: var(--nav-h);
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          box-shadow: var(--shadow-sm);
          width: 100%;
          overflow: visible;
        }
        .navbar-inner {
          max-width: 1440px;
          height: 100%;
          margin: 0 auto;
          padding: 0 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.65rem;
          box-sizing: border-box;
          overflow: visible;
        }
        .navbar-brand {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          text-decoration: none;
          flex-shrink: 0;
        }
        .navbar-brand-img {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(79, 70, 229, 0.25);
          object-fit: cover;
          flex-shrink: 0;
        }
        .navbar-brand-text {
          display: flex;
          flex-direction: column;
          line-height: 1.15;
        }
        .navbar-title {
          font-size: 1.05rem;
          font-weight: 800;
          color: var(--text);
          letter-spacing: -0.02em;
          white-space: nowrap;
        }
        .navbar-subtitle {
          font-size: 0.64rem;
          color: var(--text3);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          white-space: nowrap;
        }

        /* Desktop Nav Links */
        .navbar-desktop-links {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          flex: 1 1 auto;
          justify-content: center;
          min-width: 0;
          overflow: visible;
          padding: 0 0.25rem;
        }
        .nav-link {
          display: inline-flex;
          align-items: center;
          gap: 0.32rem;
          padding: 0.38rem 0.62rem;
          border-radius: var(--radius-sm);
          font-size: 0.84rem;
          font-weight: 600;
          color: var(--text2);
          transition: all 0.15s ease;
          text-decoration: none;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .nav-link:hover {
          color: var(--accent);
          background: var(--surface2);
        }
        .nav-link.active {
          color: var(--accent);
          background: var(--accent-bg);
          font-weight: 700;
        }
        .nav-link-highlight {
          background: var(--accent) !important;
          color: #ffffff !important;
          font-weight: 700;
        }
        .nav-link-highlight:hover {
          background: var(--accent-hover) !important;
        }
        .nav-badge {
          font-size: 0.68rem;
          font-weight: 800;
          padding: 0.1rem 0.45rem;
          border-radius: 9999px;
          line-height: 1;
          margin-left: 0.15rem;
        }

        /* Hover Dropdowns */
        .nav-dropdown {
          position: relative;
          display: inline-flex;
          align-items: center;
        }
        .nav-dropdown::after {
          /* Invisible bridge to prevent mouse leave jitter */
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: -10px;
          height: 14px;
        }
        .nav-dropdown-trigger {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.38rem 0.62rem;
          border-radius: var(--radius-sm);
          font-size: 0.84rem;
          font-weight: 600;
          color: var(--text2);
          background: transparent;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
          font-family: inherit;
        }
        .nav-dropdown-trigger:hover,
        .nav-dropdown:hover .nav-dropdown-trigger,
        .nav-dropdown.active .nav-dropdown-trigger {
          color: var(--accent);
          background: var(--surface2);
        }
        .nav-dropdown.active .nav-dropdown-trigger {
          background: var(--accent-bg);
          font-weight: 700;
        }
        .crm-hub-trigger {
          color: var(--accent);
          font-weight: 700;
          border: 1px solid rgba(99, 102, 241, 0.25);
          background: rgba(99, 102, 241, 0.06);
        }
        .crm-hub-trigger:hover,
        .nav-dropdown:hover .crm-hub-trigger {
          background: rgba(99, 102, 241, 0.15);
          border-color: var(--accent);
          box-shadow: 0 0 10px rgba(99, 102, 241, 0.25);
        }
        .nav-dropdown-caret {
          font-size: 0.65rem;
          opacity: 0.7;
          margin-left: 0.1rem;
          transition: transform 0.2s ease;
        }
        .nav-dropdown:hover .nav-dropdown-caret {
          transform: rotate(180deg);
        }
        .nav-dropdown-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          min-width: 230px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 0.4rem;
          box-shadow: 0 14px 35px rgba(0, 0, 0, 0.3);
          display: none;
          flex-direction: column;
          gap: 0.25rem;
          z-index: 1050;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .nav-dropdown:hover .nav-dropdown-menu,
        .nav-dropdown:focus-within .nav-dropdown-menu {
          display: flex;
          animation: menuFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .nav-dropdown-item {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.55rem 0.75rem;
          border-radius: 8px;
          background: transparent;
          border: none;
          width: 100%;
          text-align: left;
          cursor: pointer;
          transition: background 0.12s ease;
          text-decoration: none;
          box-sizing: border-box;
          font-family: inherit;
        }
        .nav-dropdown-item:hover {
          background: var(--surface2);
        }
        .nav-dropdown-item .item-icon {
          font-size: 1.15rem;
          line-height: 1;
          flex-shrink: 0;
        }
        .nav-dropdown-item .item-body {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
          flex: 1;
        }
        .nav-dropdown-item .item-title {
          font-size: 0.83rem;
          font-weight: 700;
          color: var(--text);
        }
        .nav-dropdown-item .item-sub {
          font-size: 0.7rem;
          color: var(--text3);
          font-weight: 500;
        }

        /* Right Actions */
        .navbar-actions {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          flex-shrink: 0;
          margin-left: auto;
        }
        .navbar-desktop-search {
          display: block;
        }
        .navbar-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--surface2);
          color: var(--text);
          cursor: pointer;
          font-size: 1.05rem;
          transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
          flex-shrink: 0;
        }
        .navbar-btn:hover {
          border-color: var(--accent);
          background: var(--surface);
        }
        .navbar-btn:active {
          transform: scale(0.96);
        }
        .notif-badge-count {
          position: absolute;
          top: -4px;
          right: -4px;
          background: var(--danger);
          color: #ffffff;
          font-size: 0.65rem;
          font-weight: 800;
          height: 18px;
          min-width: 18px;
          padding: 0 4px;
          border-radius: 9999px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid var(--surface);
          box-shadow: var(--shadow-sm);
        }
        .mobile-toggle-btn {
          display: none;
        }

        .navbar-backdrop {
          position: fixed;
          top: var(--nav-h);
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(3px);
          -webkit-backdrop-filter: blur(3px);
          z-index: 998;
          animation: fadeIn 0.15s ease;
        }
        .navbar-mobile-drawer {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: var(--surface);
          border-bottom: 2px solid var(--border);
          padding: 0.85rem 1rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          box-shadow: 0 14px 34px rgba(0, 0, 0, 0.2);
          max-height: calc(100vh - var(--nav-h));
          overflow-y: auto;
          z-index: 999;
          animation: slideDown 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .mobile-search-section {
          padding-bottom: 0.4rem;
          border-bottom: 1px solid var(--border);
        }

        /* Mobile CRM Banner */
        .mobile-crm-hub-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.85rem 1rem;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.12));
          border: 1px solid rgba(99, 102, 241, 0.35);
          border-radius: 12px;
          cursor: pointer;
          color: var(--text);
          text-align: left;
          width: 100%;
          box-sizing: border-box;
          transition: transform 0.12s ease;
        }
        .mobile-crm-hub-banner:active {
          transform: scale(0.98);
        }
        .mobile-crm-hub-left {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }
        .mobile-crm-hub-badge {
          display: inline-block;
          font-size: 0.65rem;
          font-weight: 800;
          color: #6366f1;
          letter-spacing: 0.05em;
        }
        .mobile-crm-hub-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text);
        }
        .mobile-crm-hub-sub {
          font-size: 0.72rem;
          color: var(--text3);
        }
        .mobile-crm-hub-arrow {
          font-size: 1.15rem;
          color: var(--accent);
          font-weight: 800;
        }

        .mobile-links-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
        }
        .mobile-nav-link {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.75rem 0.85rem;
          border-radius: var(--radius-sm);
          font-size: 0.92rem;
          font-weight: 600;
          color: var(--text);
          background: var(--surface2);
          border: 1px solid var(--border);
          text-decoration: none;
          min-height: 46px;
          transition: all 0.15s ease;
        }
        .mobile-nav-link:active {
          transform: scale(0.98);
        }
        .mobile-nav-link.active {
          color: var(--accent);
          background: var(--accent-bg);
          border-color: var(--accent);
          font-weight: 700;
        }
        .mobile-highlight {
          background: var(--accent);
          color: #ffffff !important;
          border-color: var(--accent);
          font-weight: 700;
          grid-column: 1 / -1;
          justify-content: center;
        }
        .mobile-nav-icon {
          font-size: 1.15rem;
          line-height: 1;
        }
        .mobile-nav-label {
          flex: 1;
        }
        .mobile-nav-badge {
          font-size: 0.72rem;
          font-weight: 800;
          color: #ffffff;
          padding: 0.12rem 0.5rem;
          border-radius: 9999px;
          line-height: 1;
        }

        @keyframes menuFadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* Responsive Breakpoints */
        @media (max-width: 1200px) {
          .nav-link, .nav-dropdown-trigger {
            padding: 0.35rem 0.45rem;
            font-size: 0.8rem;
            gap: 0.22rem;
          }
          .navbar-subtitle {
            display: none;
          }
        }

        @media (max-width: 1040px) {
          .navbar-desktop-links {
            display: none;
          }
          .mobile-toggle-btn {
            display: inline-flex;
          }
          .navbar-desktop-search {
            display: block;
          }
        }

        @media (max-width: 768px) {
          .navbar-desktop-search {
            display: none;
          }
          .navbar-inner {
            padding: 0 0.75rem;
          }
        }

        @media (max-width: 480px) {
          .navbar-inner {
            padding: 0 0.5rem;
            gap: 0.35rem;
          }
          .navbar-brand-img {
            width: 28px;
            height: 28px;
            border-radius: 6px;
          }
          .navbar-title {
            font-size: 0.95rem;
          }
          .navbar-btn {
            width: 35px;
            height: 35px;
            font-size: 0.95rem;
          }
          .mobile-links-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 360px) {
          .navbar-title {
            font-size: 0.88rem;
          }
          .navbar-btn {
            width: 32px;
            height: 32px;
            font-size: 0.9rem;
          }
        }
      `}</style>
    </header>
  );
}
