import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Navbar from "./components/Navbar";
import NotificationPanel from "./components/NotificationPanel";
import Dashboard from "./pages/Dashboard";
import AddLead from "./pages/AddLead";
import LeadDetail from "./pages/LeadDetail";
import EditLead from "./pages/EditLead";
import Calendar from "./pages/Calendar";
import Courses from "./pages/Courses";
import Emails from "./pages/Emails";
import WhatsAppPage from "./pages/WhatsAppPage";
import useNotifications from "./hooks/useNotifications";
import { WhatsAppBarProvider } from "./context/WhatsAppBarContext";
import WhatsAppBar from "./components/WhatsAppBar";
import { EmailBarProvider } from "./context/EmailBarContext";
import { CallStatusProvider } from "./context/CallStatusContext";
import CallStatusWidget from "./components/CallStatusWidget";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "3rem 1.5rem", maxWidth: "600px", margin: "2rem auto", textAlign: "center" }} className="card">
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⚠️</div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: "0.5rem", color: "var(--text)" }}>
            Something went wrong
          </h2>
          <p style={{ color: "var(--text2)", fontSize: "0.9rem", marginBottom: "1.25rem" }}>
            {this.state.error?.message || "An unexpected error occurred while rendering the page."}
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => window.location.reload()}
            >
              🔄 Reload Page
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = "/";
              }}
            >
              🏠 Go to Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function FloatingWhatsAppButton() {
  return (
    <Link
      to="/whatsapp"
      className="floating-wa-btn"
      title="Open WhatsApp Hub & Message Templates"
    >
      💬
    </Link>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("lead_crm_theme") || "light";
  });
  const [showNotifs, setShowNotifs] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Apply theme to html tag
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    localStorage.setItem("lead_crm_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const triggerGlobalRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const { notifications, conflicts, overdue, todayFollowUps, totalBadgeCount, markAsRead } =
    useNotifications(refreshTrigger);

  return (
    <Router>
      <WhatsAppBarProvider>
        <EmailBarProvider onLeadUpdated={triggerGlobalRefresh}>
          <CallStatusProvider onLeadUpdated={triggerGlobalRefresh}>
            <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
              <Navbar
                theme={theme}
                toggleTheme={toggleTheme}
                badgeCount={totalBadgeCount}
                onToggleNotifs={() => setShowNotifs((prev) => !prev)}
              />

              <WhatsAppBar />
              <CallStatusWidget />
              <FloatingWhatsAppButton />

              {showNotifs && (
                <NotificationPanel
                  conflicts={conflicts}
                  overdue={overdue}
                  todayFollowUps={todayFollowUps}
                  onClose={() => setShowNotifs(false)}
                />
              )}

              <ErrorBoundary>
                <main style={{ flex: 1 }}>
                  <Routes>
                    <Route
                      path="/"
                      element={<Dashboard onDataChange={triggerGlobalRefresh} />}
                    />
                    <Route
                      path="/add"
                      element={<AddLead onLeadAdded={triggerGlobalRefresh} />}
                    />
                    <Route
                      path="/leads/:id"
                      element={<LeadDetail onDataChange={triggerGlobalRefresh} />}
                    />
                    <Route
                      path="/edit/:id"
                      element={<EditLead onLeadUpdated={triggerGlobalRefresh} />}
                    />
                    <Route
                      path="/calendar"
                      element={<Calendar onDataChange={triggerGlobalRefresh} />}
                    />
                    <Route path="/courses" element={<Courses />} />
                    <Route
                      path="/emails"
                      element={<Emails onDataChange={triggerGlobalRefresh} />}
                    />
                    <Route
                      path="/whatsapp"
                      element={<WhatsAppPage onDataChange={triggerGlobalRefresh} />}
                    />
                  </Routes>
                </main>
              </ErrorBoundary>
            </div>
          </CallStatusProvider>
        </EmailBarProvider>
      </WhatsAppBarProvider>
    </Router>
  );
}
