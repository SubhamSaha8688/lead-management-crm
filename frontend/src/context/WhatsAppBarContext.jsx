import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { DEFAULT_WHATSAPP_TEMPLATES } from "../utils/whatsapp";

const WhatsAppBarContext = createContext(null);

const STORAGE_KEY = "lead_crm_whatsapp_templates";

export function WhatsAppBarProvider({ children }) {
  const [templates, setTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn("Failed to read templates from localStorage:", e);
    }
    return DEFAULT_WHATSAPP_TEMPLATES;
  });

  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeLead, setActiveLead] = useState(null);

  // Fetch from backend API on mount
  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/whatsapp-templates");
      if (res.data && res.data.success && Array.isArray(res.data.data)) {
        setTemplates(res.data.data);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(res.data.data));
      }
    } catch (err) {
      console.warn("Failed to fetch templates from backend, using local defaults:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openWhatsAppBar = (lead = null) => {
    if (lead) {
      setActiveLead(lead);
    }
    setIsOpen(true);
  };

  const closeWhatsAppBar = () => {
    setIsOpen(false);
  };

  const createTemplate = async ({ title, category, message }) => {
    try {
      const res = await axios.post("/api/whatsapp-templates", {
        title,
        category,
        message
      });
      if (res.data && res.data.success) {
        const newT = res.data.data;
        setTemplates((prev) => {
          const updated = [...prev, newT];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });
        return { success: true, data: newT };
      }
    } catch (err) {
      console.warn("Backend save failed, saving to local state:", err);
      // Fallback local save
      const localNew = {
        _id: "local-" + Date.now(),
        title,
        category: category || "Custom",
        message,
        isDefault: false,
        createdAt: new Date().toISOString()
      };
      setTemplates((prev) => {
        const updated = [...prev, localNew];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
      return { success: true, data: localNew };
    }
  };

  const updateTemplate = async (id, updates) => {
    try {
      const res = await axios.put(`/api/whatsapp-templates/${id}`, updates);
      if (res.data && res.data.success) {
        const updatedT = res.data.data;
        setTemplates((prev) => {
          const updated = prev.map((t) => (t._id === id ? updatedT : t));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });
        return { success: true, data: updatedT };
      }
    } catch (err) {
      console.warn("Backend update failed, updating local state:", err);
      setTemplates((prev) => {
        const updated = prev.map((t) => (t._id === id ? { ...t, ...updates } : t));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
      return { success: true };
    }
  };

  const deleteTemplate = async (id) => {
    try {
      await axios.delete(`/api/whatsapp-templates/${id}`);
    } catch (err) {
      console.warn("Backend delete failed, removing locally:", err);
    }
    setTemplates((prev) => {
      const updated = prev.filter((t) => t._id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    return { success: true };
  };

  return (
    <WhatsAppBarContext.Provider
      value={{
        templates,
        loading,
        isOpen,
        activeLead,
        setActiveLead,
        openWhatsAppBar,
        closeWhatsAppBar,
        createTemplate,
        updateTemplate,
        deleteTemplate,
        refreshTemplates: fetchTemplates
      }}
    >
      {children}
    </WhatsAppBarContext.Provider>
  );
}

export function useWhatsAppBar() {
  const context = useContext(WhatsAppBarContext);
  if (!context) {
    throw new Error("useWhatsAppBar must be used within a WhatsAppBarProvider");
  }
  return context;
}
