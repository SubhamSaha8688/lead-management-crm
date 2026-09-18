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
import { AuthProvider } from "./context/AuthContext";
import LoginModal from "./components/LoginModal";
import { invalidateLeadsCache } from "./utils/leadCache";

function FloatingWhatsAppButton() {
  return (
    <Link
      to="/whatsapp"
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        width: "50px",
        height: "50px",
        borderRadius: "50%",
        background: "#25D366",
        color: "#ffffff",
        border: "none",
        fontSize: "1.5rem",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 4px 16px rgba(37, 211, 102, 0.4)",
        zIndex: 900,
        textDecoration: "none",
        transition: "transform 0.2s ease"
      }}
      title="Open WhatsApp Hub & Message Templates"
      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
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
    invalidateLeadsCache();
    setRefreshTrigger((prev) => prev + 1);
  };

  const {
    conflicts,
    overdue,
    todayFollowUps,
    staleLeads,
    totalBadgeCount,
    dismissNotification,
    clearAllNotifications
  } = useNotifications(refreshTrigger);

  return (
    <AuthProvider>
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
                <LoginModal />

                {showNotifs && (
                  <NotificationPanel
                    conflicts={conflicts}
                    overdue={overdue}
                    todayFollowUps={todayFollowUps}
                    staleLeads={staleLeads}
                    onDismiss={dismissNotification}
                    onClearAll={clearAllNotifications}
                    onClose={() => setShowNotifs(false)}
                  />
                )}

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
              </div>
            </CallStatusProvider>
          </EmailBarProvider>
        </WhatsAppBarProvider>
      </Router>
    </AuthProvider>
  );
}
