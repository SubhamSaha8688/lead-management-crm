import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useWhatsAppBar } from "../context/WhatsAppBarContext";
import { renderWhatsAppTemplate, getWhatsAppUrl, formatWhatsAppPhone } from "../utils/whatsapp";

const CATEGORIES = [
  "All",
  "Greeting",
  "Follow-up",
  "Syllabus & Fees",
  "Offer",
  "Demo",
  "Payment",
  "Urgent",
  "Custom"
];

export default function WhatsAppBar() {
  const {
    isOpen,
    closeWhatsAppBar,
    templates,
    loading,
    activeLead,
    setActiveLead,
    createTemplate,
    updateTemplate,
    deleteTemplate
  } = useWhatsAppBar();

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Lead search & picker
  const [leadsList, setLeadsList] = useState([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [showLeadPicker, setShowLeadPicker] = useState(false);

  // Template Form (Create / Edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState("Custom");
  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState("");

  // Feedback states
  const [copiedId, setCopiedId] = useState(null);
  const [toastMsg, setToastMsg] = useState("");

  const textareaRef = useRef(null);

  // Fetch leads for the lead selector
  useEffect(() => {
    if (isOpen) {
      axios
        .get("/api/leads")
        .then((res) => {
          if (res.data && res.data.success && Array.isArray(res.data.data)) {
            setLeadsList(res.data.data);
          }
        })
        .catch((e) => console.warn("Could not fetch leads for WhatsApp bar:", e));
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        closeWhatsAppBar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeWhatsAppBar]);

  if (!isOpen) return null;

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    const matchesCat =
      selectedCategory === "All" ||
      (t.category && t.category.toLowerCase() === selectedCategory.toLowerCase());
    const query = searchTerm.toLowerCase();
    const matchesSearch =
      !query ||
      (t.title && t.title.toLowerCase().includes(query)) ||
      (t.message && t.message.toLowerCase().includes(query));
    return matchesCat && matchesSearch;
  });

  // Filter leads for lead picker
  const filteredLeads = leadsList.filter((l) => {
    if (!leadSearch) return true;
    const q = leadSearch.toLowerCase();
    return (
      (l.name && l.name.toLowerCase().includes(q)) ||
      (l.phone && String(l.phone).includes(q)) ||
      (l.leadId && l.leadId.toLowerCase().includes(q)) ||
      (l.enrolledCourses && l.enrolledCourses.some((c) => c.courseName?.toLowerCase().includes(q))) ||
      (l.courseName && l.courseName.toLowerCase().includes(q))
    );
  });

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  const handleCopy = (t, renderedText) => {
    navigator.clipboard.writeText(renderedText);
    setCopiedId(t._id);
    showToast("✓ Message copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = (renderedText) => {
    if (!activeLead) {
      setShowLeadPicker(true);
      showToast("⚠️ Please select a lead first to send this message!");
      return;
    }
    if (!activeLead.phone) {
      showToast("⚠️ This lead has no phone number saved!");
      return;
    }

    const url = getWhatsAppUrl(activeLead.phone, renderedText);
    if (!url) {
      showToast("⚠️ Invalid phone number for WhatsApp.");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openNewForm = () => {
    setEditingId(null);
    setFormTitle("");
    setFormCategory("Custom");
    setFormMessage("");
    setFormError("");
    setIsFormOpen(true);
  };

  const openEditForm = (t) => {
    setEditingId(t._id);
    setFormTitle(t.title);
    setFormCategory(t.category || "Custom");
    setFormMessage(t.message);
    setFormError("");
    setIsFormOpen(true);
  };

  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError("Please enter a title.");
      return;
    }
    if (!formMessage.trim()) {
      setFormError("Please enter message content.");
      return;
    }

    if (editingId) {
      await updateTemplate(editingId, {
        title: formTitle.trim(),
        category: formCategory,
        message: formMessage.trim()
      });
      showToast("✓ Template updated successfully!");
    } else {
      await createTemplate({
        title: formTitle.trim(),
        category: formCategory,
        message: formMessage.trim()
      });
      showToast("✓ New message template saved!");
    }

    setIsFormOpen(false);
  };

  const insertVariable = (varName) => {
    const tag = `{${varName}}`;
    const textarea = textareaRef.current;
    if (!textarea) {
      setFormMessage((prev) => prev + " " + tag);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formMessage;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    setFormMessage(before + tag + after);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  };

  const activeCourseName =
    activeLead?.enrolledCourses?.[0]?.courseName ||
    activeLead?.courseName ||
    "Course Not Assigned";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeWhatsAppBar}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          backdropFilter: "blur(2px)",
          zIndex: 9998,
          transition: "opacity 0.2s ease"
        }}
      />

      {/* Slide-Over Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "480px",
          maxWidth: "100vw",
          height: "100vh",
          background: "var(--bg-card, #ffffff)",
          color: "var(--text-primary, #1e293b)",
          boxShadow: "-6px 0 25px rgba(0, 0, 0, 0.3)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          animation: "slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
      >
        {/* Toast Alert */}
        {toastMsg && (
          <div
            style={{
              position: "absolute",
              top: "1rem",
              left: "1rem",
              right: "1rem",
              background: "#10b981",
              color: "#ffffff",
              padding: "0.65rem 1rem",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "0.85rem",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
              zIndex: 10001,
              textAlign: "center"
            }}
          >
            {toastMsg}
          </div>
        )}

        {/* 1. Header */}
        <div
          style={{
            padding: "1.2rem 1.4rem",
            borderBottom: "1px solid var(--border-color, #e2e8f0)",
            background: "var(--bg-secondary, #f8fafc)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span
              style={{
                fontSize: "1.4rem",
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#25D366",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              💬
            </span>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                WhatsApp Messages
                <span
                  style={{
                    fontSize: "0.72rem",
                    background: "#25D366",
                    color: "#ffffff",
                    padding: "0.15rem 0.45rem",
                    borderRadius: "12px",
                    fontWeight: 700
                  }}
                >
                  {templates.length} Saved
                </span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted, #64748b)" }}>
                Quick-send personalized messages to leads
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={closeWhatsAppBar}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.3rem",
              cursor: "pointer",
              color: "var(--text-muted, #64748b)",
              padding: "0.3rem",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
            title="Close WhatsApp Bar (Esc)"
          >
            ✕
          </button>
        </div>

        {/* 2. Active Lead Banner */}
        <div
          style={{
            padding: "0.85rem 1.4rem",
            background: activeLead ? "rgba(37, 211, 102, 0.08)" : "var(--bg-secondary, #f8fafc)",
            borderBottom: "1px solid var(--border-color, #e2e8f0)",
            position: "relative"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#16a34a" }}>
              {activeLead ? "🎯 Active Recipient Lead" : "⚠️ No Lead Selected"}
            </div>
            <button
              type="button"
              onClick={() => setShowLeadPicker((prev) => !prev)}
              style={{
                background: "none",
                border: "none",
                color: "#16a34a",
                fontWeight: 700,
                fontSize: "0.76rem",
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline"
              }}
            >
              {showLeadPicker ? "Cancel Selection" : activeLead ? "Change Lead ▾" : "Select Lead ▾"}
            </button>
          </div>

          {activeLead ? (
            <div style={{ marginTop: "0.4rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                  👤 {activeLead.name || "Unknown Name"}{" "}
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted, #64748b)", fontWeight: 500 }}>
                    ({activeLead.leadId || "No ID"})
                  </span>
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)", marginTop: "0.15rem" }}>
                  📞 {activeLead.phone ? `+91 ${activeLead.phone.replace(/^91/, '')}` : "No phone"}{" "}
                  • 📚 {activeCourseName}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveLead(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted, #64748b)",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  padding: "0.2rem"
                }}
                title="Clear selected lead"
              >
                ✕
              </button>
            </div>
          ) : (
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #64748b)", marginTop: "0.25rem" }}>
              Pick a lead below to preview and 1-click send messages on WhatsApp Web!
            </div>
          )}

          {/* Searchable Lead Picker Dropdown */}
          {showLeadPicker && (
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.75rem",
                background: "var(--bg-card, #ffffff)",
                border: "1px solid var(--border-color, #cbd5e1)",
                borderRadius: "8px",
                boxShadow: "0 8px 20px rgba(0,0,0,0.12)"
              }}
            >
              <input
                type="text"
                placeholder="Search leads by name, phone, or ID..."
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                autoFocus
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color, #cbd5e1)",
                  fontSize: "0.82rem",
                  marginBottom: "0.5rem",
                  background: "var(--bg-input, #ffffff)",
                  color: "var(--text-primary, #0f172a)"
                }}
              />
              <div style={{ maxHeight: "180px", overflowY: "auto" }}>
                {filteredLeads.length === 0 ? (
                  <div style={{ padding: "0.5rem", fontSize: "0.8rem", color: "var(--text-muted, #64748b)", textAlign: "center" }}>
                    No leads found matching "{leadSearch}"
                  </div>
                ) : (
                  filteredLeads.slice(0, 30).map((l) => (
                    <div
                      key={l._id}
                      onClick={() => {
                        setActiveLead(l);
                        setShowLeadPicker(false);
                        setLeadSearch("");
                      }}
                      style={{
                        padding: "0.45rem 0.6rem",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "0.82rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottom: "1px solid var(--border-color, #f1f5f9)",
                        transition: "background 0.15s"
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-secondary, #f8fafc)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <div>
                        <strong>{l.name || "Unnamed Lead"}</strong>{" "}
                        <span style={{ color: "var(--text-muted, #64748b)", fontSize: "0.75rem" }}>
                          ({l.leadId})
                        </span>
                        <div style={{ fontSize: "0.74rem", color: "var(--text-muted, #64748b)" }}>
                          {l.phone ? `+91 ${l.phone.replace(/^91/, '')}` : "No phone"} •{" "}
                          {l.enrolledCourses?.[0]?.courseName || l.courseName || "No course"}
                        </div>
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: 700 }}>
                        Select ➔
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* 3. Search & Action Controls */}
        <div
          style={{
            padding: "0.9rem 1.4rem",
            borderBottom: "1px solid var(--border-color, #e2e8f0)",
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem"
          }}
        >
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <input
              type="text"
              placeholder="🔍 Search saved messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: 1,
                padding: "0.55rem 0.85rem",
                borderRadius: "8px",
                border: "1px solid var(--border-color, #cbd5e1)",
                fontSize: "0.84rem",
                background: "var(--bg-input, #ffffff)",
                color: "var(--text-primary, #0f172a)"
              }}
            />
            <button
              type="button"
              onClick={openNewForm}
              style={{
                background: "#25D366",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "0.55rem 0.95rem",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: "0 2px 6px rgba(37, 211, 102, 0.3)"
              }}
            >
              + New Message
            </button>
          </div>

          {/* Category Filter Pills */}
          <div
            style={{
              display: "flex",
              gap: "0.4rem",
              overflowX: "auto",
              paddingBottom: "0.2rem",
              scrollbarWidth: "none"
            }}
          >
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    background: active ? "var(--accent, #3b82f6)" : "var(--bg-secondary, #f1f5f9)",
                    color: active ? "#ffffff" : "var(--text-muted, #475569)",
                    border: "none",
                    borderRadius: "16px",
                    padding: "0.25rem 0.7rem",
                    fontSize: "0.74rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease"
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Add / Edit Form Modal/Drawer Area */}
        {isFormOpen && (
          <div
            style={{
              padding: "1.2rem 1.4rem",
              background: "var(--bg-secondary, #f8fafc)",
              borderBottom: "2px solid #25D366"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                {editingId ? "✏️ Edit WhatsApp Message" : "➕ Create New WhatsApp Message"}
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted, #64748b)" }}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div style={{ color: "#ef4444", fontSize: "0.8rem", marginBottom: "0.5rem", fontWeight: 600 }}>
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleSaveForm}>
              <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.6rem" }}>
                <input
                  type="text"
                  placeholder="Template Title (e.g. Scholarship Offer)"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  style={{
                    flex: 2,
                    padding: "0.5rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color, #cbd5e1)",
                    fontSize: "0.84rem",
                    background: "var(--bg-input, #ffffff)",
                    color: "var(--text-primary, #0f172a)"
                  }}
                />
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "0.5rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color, #cbd5e1)",
                    fontSize: "0.82rem",
                    background: "var(--bg-input, #ffffff)",
                    color: "var(--text-primary, #0f172a)"
                  }}
                >
                  <option value="Greeting">Greeting</option>
                  <option value="Follow-up">Follow-up</option>
                  <option value="Syllabus & Fees">Syllabus & Fees</option>
                  <option value="Offer">Offer</option>
                  <option value="Demo">Demo</option>
                  <option value="Payment">Payment</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>

              {/* Dynamic Variable Chips */}
              <div style={{ marginBottom: "0.4rem" }}>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted, #64748b)", marginBottom: "0.25rem", fontWeight: 600 }}>
                  Click to insert dynamic lead variable:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                  {["name", "course", "phone", "email", "leadId"].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertVariable(tag)}
                      style={{
                        background: "var(--bg-card, #ffffff)",
                        border: "1px solid #25D366",
                        color: "#15803d",
                        borderRadius: "12px",
                        padding: "0.15rem 0.55rem",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                      title={`Insert {${tag}} into message`}
                    >
                      + {`{${tag}}`}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                ref={textareaRef}
                rows={4}
                placeholder="Write your message here... e.g. Hi {name}, this is regarding your enquiry for {course}..."
                value={formMessage}
                onChange={(e) => setFormMessage(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color, #cbd5e1)",
                  fontSize: "0.82rem",
                  fontFamily: "inherit",
                  resize: "vertical",
                  marginBottom: "0.75rem",
                  background: "var(--bg-input, #ffffff)",
                  color: "var(--text-primary, #0f172a)"
                }}
              />

              {/* Live Preview of Form Message */}
              {formMessage && (
                <div
                  style={{
                    marginBottom: "0.75rem",
                    padding: "0.6rem 0.75rem",
                    background: "rgba(37, 211, 102, 0.08)",
                    borderLeft: "3px solid #25D366",
                    borderRadius: "4px",
                    fontSize: "0.78rem"
                  }}
                >
                  <span style={{ fontWeight: 700, color: "#16a34a" }}>Live Preview: </span>
                  {renderWhatsAppTemplate(formMessage, activeLead)}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  style={{
                    background: "none",
                    border: "1px solid var(--border-color, #cbd5e1)",
                    borderRadius: "6px",
                    padding: "0.45rem 0.85rem",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    color: "var(--text-muted, #64748b)"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: "#25D366",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "0.45rem 1rem",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(37, 211, 102, 0.3)"
                  }}
                >
                  {editingId ? "Save Changes" : "Save Template"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 5. Templates List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.2rem 1.4rem" }}>
          {filteredTemplates.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted, #64748b)" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>💬</div>
              <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.25rem" }}>No Messages Found</div>
              <div style={{ fontSize: "0.82rem" }}>
                {searchTerm
                  ? `No templates matching "${searchTerm}"`
                  : "Click '+ New Message' above to create your first custom WhatsApp template!"}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {filteredTemplates.map((t) => {
                const rendered = renderWhatsAppTemplate(t.message, activeLead);

                return (
                  <div
                    key={t._id}
                    style={{
                      background: "var(--bg-secondary, #f8fafc)",
                      border: "1px solid var(--border-color, #e2e8f0)",
                      borderRadius: "10px",
                      padding: "1rem",
                      transition: "all 0.15s ease",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                    }}
                  >
                    {/* Template Card Header */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "0.5rem"
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-primary, #0f172a)" }}>
                          {t.title}
                        </div>
                        <span
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            padding: "0.15rem 0.45rem",
                            borderRadius: "10px",
                            background: "rgba(59, 130, 246, 0.1)",
                            color: "#2563eb",
                            display: "inline-block",
                            marginTop: "0.2rem"
                          }}
                        >
                          {t.category || "General"}
                        </span>
                      </div>

                      {/* Edit / Delete options */}
                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        <button
                          type="button"
                          onClick={() => openEditForm(t)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                            color: "var(--text-muted, #64748b)",
                            padding: "0.2rem"
                          }}
                          title="Edit Template"
                        >
                          ✏️
                        </button>
                        {!t.isDefault && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete template "${t.title}"?`)) {
                                deleteTemplate(t._id);
                                showToast("Template deleted.");
                              }
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "0.85rem",
                              color: "#ef4444",
                              padding: "0.2rem"
                            }}
                            title="Delete Template"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Rendered Message Content */}
                    <div
                      style={{
                        background: "var(--bg-card, #ffffff)",
                        border: "1px solid var(--border-color, #e2e8f0)",
                        borderRadius: "8px",
                        padding: "0.75rem",
                        fontSize: "0.82rem",
                        lineHeight: 1.45,
                        color: "var(--text-primary, #1e293b)",
                        whiteSpace: "pre-wrap",
                        marginBottom: "0.75rem"
                      }}
                    >
                      {rendered}
                    </div>

                    {/* Action Bar */}
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        onClick={() => handleSend(rendered)}
                        style={{
                          flex: 1,
                          background: "#25D366",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "6px",
                          padding: "0.55rem 0.85rem",
                          fontWeight: 700,
                          fontSize: "0.82rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "0.4rem",
                          boxShadow: "0 2px 6px rgba(37, 211, 102, 0.3)",
                          transition: "background 0.15s"
                        }}
                        title={
                          activeLead
                            ? `Directly opens WhatsApp Web to ${activeLead.name} with this message`
                            : "Select a lead above to send"
                        }
                      >
                        <span>🚀</span> Send on WhatsApp
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopy(t, rendered)}
                        style={{
                          background: "var(--bg-card, #ffffff)",
                          color: "var(--text-primary, #334155)",
                          border: "1px solid var(--border-color, #cbd5e1)",
                          borderRadius: "6px",
                          padding: "0.55rem 0.75rem",
                          fontWeight: 600,
                          fontSize: "0.8rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem"
                        }}
                        title="Copy message to clipboard"
                      >
                        {copiedId === t._id ? "✓ Copied!" : "📋 Copy"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
