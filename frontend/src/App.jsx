import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import NotificationPanel from "./components/NotificationPanel";
import Dashboard from "./pages/Dashboard";
import AddLead from "./pages/AddLead";
import LeadDetail from "./pages/LeadDetail";
import EditLead from "./pages/EditLead";
import Calendar from "./pages/Calendar";
import Courses from "./pages/Courses";
import useNotifications from "./hooks/useNotifications";

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
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Navbar
          theme={theme}
          toggleTheme={toggleTheme}
          badgeCount={totalBadgeCount}
          onToggleNotifs={() => setShowNotifs((prev) => !prev)}
        />

        {showNotifs && (
          <NotificationPanel
            conflicts={conflicts}
            overdue={overdue}
            todayFollowUps={todayFollowUps}
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
          </Routes>
        </main>
      </div>
    </Router>
  );
}
