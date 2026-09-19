import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useWhatsAppBar } from "../context/WhatsAppBarContext";
import { useEmailBar } from "../context/EmailBarContext";
import GlobalSearch from "./GlobalSearch";

export default function Navbar({ theme, toggleTheme, badgeCount, onToggleNotifs }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const navLinks = [
    { name: "Dashboard", path: "/", icon: "⊞" },
    { name: "Calendar", path: "/calendar", icon: "📅" },
    { name: "Courses", path: "/courses", icon: "📚" },
    {
      name: "Emails",
      path: "/emails",
      icon: "📧",
      badge: emailTemplates && emailTemplates.length > 0 ? emailTemplates.length : null,
      badgeColor: "#2563eb"
    },
    {
      name: "WhatsApp",
      path: "/whatsapp",
      icon: "💬",
      badge: templates && templates.length > 0 ? templates.length : null,
      badgeColor: "#16a34a"
    },
    { name: "+ Lead", path: "/add", icon: "➕", isHighlight: true }
  ];

  return (
    <header className="navbar-container">
      <div className="navbar-inner">
        {/* Left: Brand / Logo */}
        <Link to="/" className="navbar-brand" onClick={() => setMobileMenuOpen(false)}>
          <span className="navbar-logo-icon">📋</span>
          <div className="navbar-brand-text">
            <span className="navbar-title">Lead Manager</span>
            <span className="navbar-subtitle">CRM Dashboard</span>
          </div>
        </Link>

        {/* Center: Desktop Navigation Links (>= 1025px) */}
        <nav className="navbar-desktop-links">
          {navLinks.map((link) => {
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`nav-link ${active ? "active" : ""} ${
                  link.isHighlight ? "nav-link-highlight" : ""
                }`}
              >
                <span className="nav-icon">{link.icon}</span>
                <span>{link.name}</span>
                {link.badge != null && (
                  <span
                    style={{
                      background: active ? (link.badgeColor || "var(--accent)") : "rgba(100, 116, 139, 0.2)",
                      color: active ? "#ffffff" : "var(--text)",
                      fontSize: "0.68rem",
                      fontWeight: 800,
                      padding: "0.1rem 0.45rem",
                      borderRadius: "10px",
                      lineHeight: 1,
                      marginLeft: "0.2rem"
                    }}
                  >
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right: Actions (Global Search, Notification Bell, Theme toggle, Mobile Menu) */}
        <div className="navbar-actions">
          {/* Global Navbar Instant Search */}
          <GlobalSearch />

          {/* Notification Bell Button */}
          <button
            type="button"
            className="navbar-btn notif-bell-btn"
            onClick={onToggleNotifs}
            title="Notifications"
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
            className="navbar-btn"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          {/* Mobile Menu Toggle Button (<= 1024px) */}
          <button
            type="button"
            className="navbar-btn mobile-toggle-btn"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle mobile menu"
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
        <div className="navbar-mobile-drawer" role="dialog" aria-label="Navigation Menu">
          <div className="mobile-search-section">
            <GlobalSearch isMobile />
          </div>
          <div className="mobile-links-grid">
            {navLinks.map((link) => {
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

      {/* Embedded CSS for Navbar */}
      <style>{`
        .navbar-container {
          position: sticky;
          top: 0;
          z-index: 999;
          height: var(--nav-h);
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          box-shadow: var(--shadow-sm);
        }
        .navbar-inner {
          max-width: 1400px;
          height: 100%;
          margin: 0 auto;
          padding: 0 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          flex-wrap: nowrap;
        }
        .navbar-brand {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          text-decoration: none;
          flex-shrink: 0;
        }
        .navbar-logo-icon {
          font-size: 1.5rem;
          line-height: 1;
        }
        .navbar-brand-text {
          display: flex;
          flex-direction: column;
        }
        .navbar-title {
          font-size: 1.05rem;
          font-weight: 800;
          color: var(--text);
          letter-spacing: -0.02em;
          line-height: 1.1;
          white-space: nowrap;
        }
        .navbar-subtitle {
          font-size: 0.68rem;
          color: var(--text3);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          white-space: nowrap;
        }
        .navbar-desktop-links {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          flex-shrink: 0;
        }
        .nav-link {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.42rem 0.75rem;
          border-radius: var(--radius-sm);
          font-size: 0.86rem;
          font-weight: 600;
          color: var(--text2);
          transition: all 0.15s ease;
          text-decoration: none;
          white-space: nowrap;
        }
        .nav-link:hover {
          color: var(--accent);
          background: var(--surface2);
        }
        .nav-link.active {
          color: var(--accent);
          background: var(--accent-bg);
        }
        .nav-link-highlight {
          background: var(--accent);
          color: #ffffff !important;
        }
        .nav-link-highlight:hover {
          background: var(--accent-hover);
        }
        .navbar-actions {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          flex-shrink: 0;
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
          padding: 0.85rem 1rem 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
          max-height: calc(100vh - var(--nav-h));
          overflow-y: auto;
          z-index: 999;
          animation: slideDown 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .mobile-search-section {
          padding-bottom: 0.35rem;
          border-bottom: 1px solid var(--border);
        }
        .mobile-links-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
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
        }
        .mobile-highlight {
          background: var(--accent);
          color: #ffffff !important;
          border-color: var(--accent);
        }
        .mobile-nav-icon {
          font-size: 1.15rem;
          line-height: 1;
        }
        .mobile-nav-label {
          flex: 1;
          font-weight: 600;
        }
        .mobile-nav-badge {
          font-size: 0.72rem;
          font-weight: 800;
          color: #ffffff;
          padding: 0.12rem 0.5rem;
          border-radius: 9999px;
          line-height: 1;
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
        @media (max-width: 1120px) {
          .nav-link {
            padding: 0.38rem 0.55rem;
            font-size: 0.82rem;
            gap: 0.25rem;
          }
          .navbar-subtitle {
            display: none;
          }
        }
        @media (max-width: 1024px) {
          .navbar-desktop-links {
            display: none;
          }
          .mobile-toggle-btn {
            display: inline-flex;
          }
        }
        @media (max-width: 480px) {
          .navbar-inner {
            padding: 0 0.65rem;
            gap: 0.4rem;
          }
          .navbar-logo-icon {
            font-size: 1.35rem;
          }
          .navbar-title {
            font-size: 0.95rem;
          }
          .navbar-subtitle {
            display: none;
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
