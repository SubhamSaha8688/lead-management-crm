import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useWhatsAppBar } from "../context/WhatsAppBarContext";
import { useEmailBar } from "../context/EmailBarContext";

export default function Navbar({ theme, toggleTheme, badgeCount, onToggleNotifs }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { openWhatsAppBar, templates } = useWhatsAppBar();
  const { openEmailBar, templates: emailTemplates } = useEmailBar();

  const isActive = (path) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  const navLinks = [
    { name: "Dashboard", path: "/", icon: "⊞" },
    { name: "Calendar", path: "/calendar", icon: "📅" },
    { name: "Courses", path: "/courses", icon: "📚" },
    { name: "Emails", path: "/emails", icon: "📧" },
    { name: "WhatsApp", path: "/whatsapp", icon: "💬" },
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

        {/* Center: Desktop Navigation Links */}
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
              </Link>
            );
          })}
        </nav>

        {/* Right: Actions (Email Hub, WhatsApp Hub, Notification Bell, Theme toggle, Mobile Menu) */}
        <div className="navbar-actions">
          {/* Email Hub Link */}
          <Link
            to="/emails"
            className="navbar-btn"
            title="Open Henry Harvin Email Hub (Outlook Web 1-Click)"
            aria-label="Open Email Hub"
            style={{
              position: "relative",
              border: "1px solid rgba(59, 130, 246, 0.4)",
              background: "rgba(59, 130, 246, 0.08)",
              color: "#2563eb",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.4rem 0.65rem",
              borderRadius: "8px",
              cursor: "pointer",
              textDecoration: "none"
            }}
          >
            <span style={{ fontSize: "1.1rem" }}>📧</span>
            <span style={{ fontSize: "0.8rem", fontWeight: 700 }} className="email-nav-text">
              Email
            </span>
            {emailTemplates && emailTemplates.length > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "-4px",
                  right: "-4px",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontSize: "0.62rem",
                  fontWeight: 800,
                  padding: "0.1rem 0.35rem",
                  borderRadius: "10px",
                  lineHeight: 1,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
                }}
              >
                {emailTemplates.length}
              </span>
            )}
          </Link>

          {/* WhatsApp Hub Link */}
          <Link
            to="/whatsapp"
            className="navbar-btn"
            title="Open WhatsApp Hub & Message Templates"
            aria-label="Open WhatsApp Hub"
            style={{
              position: "relative",
              border: "1px solid rgba(37, 211, 102, 0.4)",
              background: "rgba(37, 211, 102, 0.08)",
              color: "#16a34a",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.4rem 0.65rem",
              borderRadius: "8px",
              cursor: "pointer",
              textDecoration: "none"
            }}
          >
            <span style={{ fontSize: "1.1rem" }}>💬</span>
            <span style={{ fontSize: "0.8rem", fontWeight: 700 }} className="whatsapp-nav-text">
              WhatsApp
            </span>
            {templates && templates.length > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "-4px",
                  right: "-4px",
                  background: "#25D366",
                  color: "#ffffff",
                  fontSize: "0.62rem",
                  fontWeight: 800,
                  padding: "0.1rem 0.35rem",
                  borderRadius: "10px",
                  lineHeight: 1,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
                }}
              >
                {templates.length}
              </span>
            )}
          </Link>

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

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            className="navbar-btn mobile-toggle-btn"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="navbar-mobile-drawer">
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
                <span style={{ fontSize: "1.1rem" }}>{link.icon}</span>
                <span>{link.name}</span>
              </Link>
            );
          })}

          <Link
            to="/emails"
            className="mobile-nav-link"
            style={{
              background: "rgba(59, 130, 246, 0.1)",
              color: "#2563eb",
              fontWeight: 700,
              textDecoration: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.4rem"
            }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span style={{ fontSize: "1.1rem" }}>📧</span>
            <span>Email Hub (Outlook Web)</span>
            {emailTemplates && emailTemplates.length > 0 && (
              <span style={{ marginLeft: "auto", fontSize: "0.75rem", background: "#2563eb", color: "#fff", padding: "0.1rem 0.4rem", borderRadius: "10px" }}>
                {emailTemplates.length}
              </span>
            )}
          </Link>

          <Link
            to="/whatsapp"
            className="mobile-nav-link"
            style={{
              background: "rgba(37, 211, 102, 0.1)",
              color: "#16a34a",
              fontWeight: 700,
              textDecoration: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem"
            }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span style={{ fontSize: "1.1rem" }}>💬</span>
            <span>WhatsApp Hub</span>
            {templates && templates.length > 0 && (
              <span style={{ marginLeft: "auto", fontSize: "0.75rem", background: "#25D366", color: "#fff", padding: "0.1rem 0.4rem", borderRadius: "10px" }}>
                {templates.length}
              </span>
            )}
          </Link>
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
          max-width: 1280px;
          height: 100%;
          margin: 0 auto;
          padding: 0 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .navbar-brand {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          text-decoration: none;
        }
        .navbar-logo-icon {
          font-size: 1.6rem;
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
        }
        .navbar-subtitle {
          font-size: 0.72rem;
          color: var(--text3);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .navbar-desktop-links {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .nav-link {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.45rem 0.85rem;
          border-radius: var(--radius-sm);
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text2);
          transition: all 0.15s ease;
          text-decoration: none;
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
          gap: 0.5rem;
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
          font-size: 1.1rem;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .navbar-btn:hover {
          border-color: var(--accent);
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
        }
        .mobile-toggle-btn {
          display: none;
        }
        .navbar-mobile-drawer {
          display: none;
          flex-direction: column;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          padding: 0.75rem 1rem;
          gap: 0.4rem;
          box-shadow: var(--shadow);
        }
        .mobile-nav-link {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.65rem 0.85rem;
          border-radius: var(--radius-sm);
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text2);
          text-decoration: none;
        }
        .mobile-nav-link.active {
          color: var(--accent);
          background: var(--accent-bg);
        }
        .mobile-highlight {
          background: var(--accent);
          color: #ffffff !important;
        }
        @media (max-width: 768px) {
          .navbar-desktop-links {
            display: none;
          }
          .mobile-toggle-btn {
            display: inline-flex;
          }
          .navbar-mobile-drawer {
            display: flex;
          }
        }
      `}</style>
    </header>
  );
}
