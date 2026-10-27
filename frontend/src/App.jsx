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
import VoicemailHub from "./pages/VoicemailHub";
import useNotifications from "./hooks/useNotifications";
import { WhatsAppBarProvider } from "./context/WhatsAppBarContext";
import WhatsAppBar from "./components/WhatsAppBar";
import { EmailBarProvider } from "./context/EmailBarContext";
import { CallStatusProvider, useCallStatus } from "./context/CallStatusContext";
import CallStatusWidget from "./components/CallStatusWidget";
import ManualTimerModal from "./components/ManualTimerModal";

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


function CallTimerLauncher({ onLeadUpdated }) {
  const {
    activeCall,
    isMinimized,
    toggleMinimize,
    showManualTimerModal,
    setShowManualTimerModal,
    isTimerRunning,
    timerSeconds
  } = useCallStatus();

  const handleFloatingClick = () => {
    if (activeCall && isMinimized) {
      toggleMinimize();
    } else {
      setShowManualTimerModal(true);
    }
  };

  const formatSecs = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <>
      <button
        type="button"
        className="floating-timer-btn"
        onClick={handleFloatingClick}
        title={
          isTimerRunning
            ? `Call Timer Active: ${formatSecs(timerSeconds)} (Click to view)`
            : "Open Manual Call Timer & Stopwatch"
        }
        style={{
          background: isTimerRunning ? "#10b981" : "#059669",
          boxShadow: isTimerRunning
            ? "0 0 15px rgba(16, 185, 129, 0.7)"
            : "0 4px 16px rgba(5, 150, 105, 0.4)"
        }}
      >
        {isTimerRunning ? "⏱️" : "⏱️"}
      </button>

      <ManualTimerModal
        isOpen={showManualTimerModal}
        onClose={() => setShowManualTimerModal(false)}
        onLeadUpdated={onLeadUpdated}
      />
    </>
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
              <CallTimerLauncher onLeadUpdated={triggerGlobalRefresh} />

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
                    <Route path="/voicemail" element={<VoicemailHub onDataChange={triggerGlobalRefresh} />} />
                    <Route path="/whatsapp"
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
