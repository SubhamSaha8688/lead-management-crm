import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { DEFAULT_EMAIL_TEMPLATES, DEFAULT_COUNSELOR_PROFILE } from "../utils/email";

const EmailBarContext = createContext(null);

const TEMPLATES_STORAGE_KEY = "lead_crm_email_templates";
const PROFILE_STORAGE_KEY = "lead_crm_counselor_profile";

export function EmailBarProvider({ children, onLeadUpdated }) {
  const [templates, setTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn("Failed to read email templates from localStorage:", e);
    }
    return DEFAULT_EMAIL_TEMPLATES;
  });

  const [counselorProfile, setCounselorProfile] = useState(() => {
    try {
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email) return parsed;
      }
    } catch (e) {
      console.warn("Failed to read counselor profile from localStorage:", e);
    }
    return DEFAULT_COUNSELOR_PROFILE;
  });

  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeLead, setActiveLead] = useState(null);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState("All Courses");

  // Fetch templates from backend API on mount
  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/email-templates");
      if (res.data && res.data.success && Array.isArray(res.data.data)) {
        setTemplates(res.data.data);
        localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(res.data.data));
      }
    } catch (err) {
      console.warn("Failed to fetch email templates from backend, using defaults:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openEmailBar = (lead = null, courseFilter = null) => {
    if (lead) {
      setActiveLead(lead);
      if (courseFilter) {
        setSelectedCourseFilter(courseFilter);
      } else if (lead.enrolledCourses && lead.enrolledCourses.length > 0) {
        setSelectedCourseFilter(lead.enrolledCourses[0].courseName);
      } else if (lead.courseName) {
        setSelectedCourseFilter(lead.courseName);
      }
    }
    setIsOpen(true);
  };

  const closeEmailBar = () => {
    setIsOpen(false);
  };

  const updateCounselorProfile = (newProfile) => {
    const updated = { ...counselorProfile, ...newProfile };
    setCounselorProfile(updated);
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
  };

  const createTemplate = async ({ title, category, course, subject, body }) => {
    try {
      const res = await axios.post("/api/email-templates", {
        title,
        category,
        course: course || "All Courses",
        subject,
        body
      });
      if (res.data && res.data.success) {
        const newT = res.data.data;
        setTemplates((prev) => {
          const updated = [...prev, newT];
          localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });
        return { success: true, data: newT };
      }
    } catch (err) {
      console.warn("Backend save failed, saving to local state:", err);
      const localNew = {
        _id: "email-local-" + Date.now(),
        title,
        category: category || "Custom",
        course: course || "All Courses",
        subject,
        body,
        isDefault: false,
        createdAt: new Date().toISOString()
      };
      setTemplates((prev) => {
        const updated = [...prev, localNew];
        localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
      return { success: true, data: localNew };
    }
  };

  const updateTemplate = async (id, updates) => {
    try {
      const res = await axios.put(`/api/email-templates/${id}`, updates);
      if (res.data && res.data.success) {
        const updatedT = res.data.data;
        setTemplates((prev) => {
          const updated = prev.map((t) => (t._id === id ? updatedT : t));
          localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });
        return { success: true, data: updatedT };
      }
    } catch (err) {
      console.warn("Backend update failed, updating local state:", err);
      setTemplates((prev) => {
        const updated = prev.map((t) => (t._id === id ? { ...t, ...updates } : t));
        localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
      return { success: true };
    }
  };

  const deleteTemplate = async (id) => {
    try {
      await axios.delete(`/api/email-templates/${id}`);
    } catch (err) {
      console.warn("Backend delete failed, removing locally:", err);
    }
    setTemplates((prev) => {
      const updated = prev.filter((t) => t._id !== id);
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    return { success: true };
  };

  /**
   * Log email interaction to lead comments so follow-ups are never missed
   */
  const logEmailSent = async (lead, subject, templateTitle = "") => {
    if (!lead || !lead._id) return;
    try {
      const emailTarget = lead.email || "student email";
      const noteText = `📧 Sent Email: "${subject}" to ${emailTarget}${
        templateTitle ? ` (Template: ${templateTitle})` : ""
      }`;

      const res = await axios.post(`/api/leads/${lead._id}/comments`, {
        text: noteText,
        outcome: "Email Sent"
      });

      if (res.data && res.data.success && res.data.data) {
        const updatedLead = res.data.data;
        setActiveLead(updatedLead);
        if (typeof onLeadUpdated === "function") {
          onLeadUpdated(updatedLead);
        }
        return updatedLead;
      }
    } catch (err) {
      console.warn("Failed to log email interaction to lead:", err.message);
    }
    return lead;
  };

  return (
    <EmailBarContext.Provider
      value={{
        templates,
        loading,
        isOpen,
        activeLead,
        setActiveLead,
        selectedCourseFilter,
        setSelectedCourseFilter,
        counselorProfile,
        openEmailBar,
        closeEmailBar,
        updateCounselorProfile,
        createTemplate,
        updateTemplate,
        deleteTemplate,
        logEmailSent,
        refreshTemplates: fetchTemplates
      }}
    >
      {children}
    </EmailBarContext.Provider>
  );
}

export function useEmailBar() {
  const context = useContext(EmailBarContext);
  if (!context) {
    throw new Error("useEmailBar must be used within an EmailBarProvider");
  }
  return context;
}
