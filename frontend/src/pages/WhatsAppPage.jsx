import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { useWhatsAppBar } from "../context/WhatsAppBarContext";
import {
  renderWhatsAppTemplate,
  getWhatsAppUrl,
  formatWhatsAppPhone
} from "../utils/whatsapp";

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

export default function WhatsAppPage({ onDataChange }) {
  const [searchParams] = useSearchParams();
  const leadIdParam = searchParams.get("leadId");

  const {
    templates,
    loading,
    activeLead,
    setActiveLead,
    createTemplate,
    updateTemplate,
    deleteTemplate
  } = useWhatsAppBar();

  // State
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Leads list & picker
  const [leadsList, setLeadsList] = useState([]);
  const [showLeadPicker, setShowLeadPicker] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");

  // Template Form (Create / Edit)
  const [isEditing, setIsEditing] = useState(false);
  const [formId, setFormId] = useState(null);
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState("Custom");
  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState("");

  // Feedback states
  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const textareaRef = useRef(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  // Fetch leads
  useEffect(() => {
    axios
      .get("/api/leads")
      .then((res) => {
        if (res.data && res.data.success && Array.isArray(res.data.data)) {
          setLeadsList(res.data.data);

          if (leadIdParam) {
            const matched = res.data.data.find(
              (l) => l._id === leadIdParam || l.leadId === leadIdParam
            );
            if (matched) {
              setActiveLead(matched);
            }
          }
        }
      })
      .catch((e) => console.warn("Could not fetch leads for WhatsApp Hub:", e));
  }, [leadIdParam, setActiveLead]);

  // Set default selected template
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0]._id);
    }
  }, [templates, selectedTemplateId]);

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    const matchesCat =
      selectedCategory === "All" ||
      (t.category && t.category.toLowerCase() === selectedCategory.toLowerCase());

    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.message && t.message.toLowerCase().includes(q));

    return matchesCat && matchesSearch;
  });

  const currentTemplate =
    templates.find((t) => t._id === selectedTemplateId) ||
    filteredTemplates[0] ||
    templates[0];

  // Filter leads for picker
  const filteredLeads = leadsList.filter((l) => {
    if (!leadSearch) return true;
    const q = leadSearch.toLowerCase();
    return (
      (l.name && l.name.toLowerCase().includes(q)) ||
      (l.phone && String(l.phone).includes(q)) ||
      (l.leadId && String(l.leadId).includes(q))
    );
  });

  // 1-Click Send on WhatsApp Web
  const handleSendWhatsApp = (t) => {
    const phone = activeLead ? activeLead.phone : "";
    if (!phone) {
      alert("Please select a student with a valid phone number first.");
      return;
    }
    const renderedMsg = renderWhatsAppTemplate(t.message, activeLead);
    const url = getWhatsAppUrl(phone, renderedMsg);
    window.open(url, "_blank", "noopener,noreferrer");
    showToast(`🚀 Opening WhatsApp Web for ${activeLead.name}!`);
  };

  // Copy message
  const handleCopyMessage = (t) => {
    const renderedMsg = renderWhatsAppTemplate(t.message, activeLead);
    navigator.clipboard.writeText(renderedMsg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast("📋 Copied message to clipboard!");
  };

  // Insert placeholder chip
  const handleInsertPlaceholder = (placeholder) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart || 0;
    const end = textareaRef.current.selectionEnd || 0;
    const current = formMessage;
    const updated = current.substring(0, start) + placeholder + current.substring(end);
    setFormMessage(updated);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = start + placeholder.length;
        textareaRef.current.selectionEnd = start + placeholder.length;
      }
    }, 50);
  };

  // Open create form
  const handleOpenCreateForm = () => {
    setFormId(null);
    setFormTitle("");
    setFormCategory(selectedCategory !== "All" ? selectedCategory : "Custom");
    setFormMessage(
      "Hi {name}, regarding your enquiry for the {course} at Henry Harvin Education..."
    );
    setFormError("");
    setIsEditing(true);
  };

  // Open edit form
  const handleOpenEditForm = (t) => {
    setFormId(t._id);
    setFormTitle(t.title);
    setFormCategory(t.category || "Custom");
    setFormMessage(t.message || "");
    setFormError("");
    setIsEditing(true);
  };

  // Save template
  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError("Template title is required");
      return;
    }
    if (!formMessage.trim()) {
      setFormError("Template message content is required");
      return;
    }

    if (formId) {
      await updateTemplate(formId, {
        title: formTitle,
        category: formCategory,
        message: formMessage
      });
      showToast("✓ Template updated successfully!");
    } else {
      const res = await createTemplate({
        title: formTitle,
        category: formCategory,
        message: formMessage
      });
      if (res && res.data) {
        setSelectedTemplateId(res.data._id);
      }
      showToast("✓ New WhatsApp template created!");
    }
    setIsEditing(false);
  };

  // Delete template
  const handleDelete = async (t) => {
    if (window.confirm(`Are you sure you want to delete template "${t.title}"?`)) {
      await deleteTemplate(t._id);
      showToast("✓ Template deleted.");
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "calc(100vh - var(--nav-h, 62px))",
        backgroundColor: "var(--bg, #f8fafc)",
        color: "var(--text, #0f172a)"
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          padding: "1rem 2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "var(--shadow-sm)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span
            style={{
              fontSize: "1.4rem",
              width: "42px",
              height: "42px",
              borderRadius: "10px",
              background: "rgba(34, 197, 94, 0.12)",
              color: "#16a34a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            💬
          </span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <h1 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "var(--text)" }}>
                WhatsApp Hub
              </h1>
              <span
                style={{
                  background: "rgba(34, 197, 94, 0.12)",
                  color: "#16a34a",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  padding: "0.2rem 0.55rem",
                  borderRadius: "6px",
                  border: "1px solid rgba(34, 197, 94, 0.25)"
                }}
              >
                WhatsApp Web Direct
              </span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text3)", marginTop: "2px" }}>
              Quick-Send Personalized Messages • Interactive Chat Bubble Mockup
            </div>
          </div>
        </div>

        <Link
          to="/"
          style={{
            background: "var(--surface2)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "0.45rem 0.95rem",
            fontSize: "0.82rem",
            fontWeight: 700,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            boxShadow: "var(--shadow-sm)"
          }}
        >
          ← Back to CRM
        </Link>
      </div>

      {/* Toast alert banner */}
      {toastMsg && (
        <div
          style={{
            background: "#10b981",
            color: "#ffffff",
            padding: "0.65rem 2rem",
            fontSize: "0.85rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            animation: "fadeIn 0.2s ease"
          }}
        >
          <span>{toastMsg}</span>
          <button
            type="button"
            onClick={() => setToastMsg("")}
            style={{ background: "none", border: "none", color: "#ffffff", cursor: "pointer", fontWeight: 800 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "380px 1fr",
          gap: "1.5rem",
          padding: "1.5rem 2rem",
          maxWidth: "1800px",
          margin: "0 auto",
          width: "100%"
        }}
      >
        {/* LEFT COLUMN: Student Recipient + Filters + Template List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Target Student Recipient Card */}
          <div
            style={{
              background: "var(--surface, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "12px",
              padding: "1rem",
              boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--text3, #94a3b8)", textTransform: "uppercase" }}>
                Target Student Recipient:
              </span>
              <button
                type="button"
                onClick={() => setShowLeadPicker((prev) => !prev)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#16a34a",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                {activeLead ? "⇄ Switch Student" : "🔍 Select Student"}
              </button>
            </div>

            {activeLead ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 800, fontSize: "1rem" }}>
                    {activeLead.name}
                  </div>
                  <span
                    style={{
                      background: "rgba(22, 163, 74, 0.1)",
                      color: "#16a34a",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      padding: "0.15rem 0.5rem",
                      borderRadius: "6px"
                    }}
                  >
                    {activeLead.enrolledCourses && activeLead.enrolledCourses.length > 0
                      ? activeLead.enrolledCourses[0].courseName
                      : activeLead.courseName || "General"}
                  </span>
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text2, #475569)" }}>
                  📞 {activeLead.phone ? `+91 ${activeLead.phone}` : "⚠️ No phone"}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "0.82rem", color: "var(--text3, #94a3b8)" }}>
                No student selected. Click <strong>"Select Student"</strong> to personalize messages!
              </div>
            )}

            {/* Searchable Student Picker */}
            {showLeadPicker && (
              <div
                style={{
                  marginTop: "0.6rem",
                  padding: "0.6rem",
                  background: "var(--surface2, #f8fafc)",
                  border: "1px solid var(--border, #cbd5e1)",
                  borderRadius: "8px"
                }}
              >
                <input
                  type="text"
                  placeholder="Search students..."
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "0.4rem 0.6rem",
                    fontSize: "0.8rem",
                    borderRadius: "6px",
                    border: "1px solid var(--border, #cbd5e1)",
                    marginBottom: "0.4rem"
                  }}
                />
                <div style={{ maxHeight: "160px", overflowY: "auto" }}>
                  {filteredLeads.slice(0, 20).map((l) => (
                    <div
                      key={l._id}
                      onClick={() => {
                        setActiveLead(l);
                        setShowLeadPicker(false);
                        setLeadSearch("");
                      }}
                      style={{
                        padding: "0.4rem",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.78rem",
                        display: "flex",
                        justifyContent: "space-between",
                        borderBottom: "1px solid var(--border, #e2e8f0)"
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface, #ffffff)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <div>
                        <strong>{l.name}</strong>
                        <div style={{ fontSize: "0.72rem", color: "var(--text3, #94a3b8)" }}>
                          📞 {l.phone}
                        </div>
                      </div>
                      <span style={{ color: "#16a34a", fontWeight: 700 }}>Select →</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Filters & Search */}
          <div
            style={{
              background: "var(--surface, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "12px",
              padding: "1rem",
              boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem"
            }}
          >
            <div>
              <label style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--text3, #94a3b8)", display: "block", marginBottom: "3px" }}>
                SEARCH MESSAGES:
              </label>
              <input
                type="text"
                placeholder="Search message text..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.45rem 0.65rem",
                  fontSize: "0.82rem",
                  borderRadius: "6px",
                  border: "1px solid var(--border, #cbd5e1)",
                  background: "var(--surface2, #f8fafc)",
                  color: "var(--text, #0f172a)"
                }}
              />
            </div>

            {/* Category Filter Chips */}
            <div>
              <label style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--text3, #94a3b8)", display: "block", marginBottom: "4px" }}>
                CATEGORY:
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      padding: "0.2rem 0.55rem",
                      borderRadius: "14px",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: selectedCategory === cat ? "#16a34a" : "var(--border, #cbd5e1)",
                      background: selectedCategory === cat ? "#16a34a" : "var(--surface2, #f8fafc)",
                      color: selectedCategory === cat ? "#ffffff" : "var(--text2, #475569)"
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Template List Header with New Button */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--text3, #94a3b8)" }}>
              {filteredTemplates.length} TEMPLATES AVAILABLE
            </span>
            <button
              type="button"
              onClick={handleOpenCreateForm}
              style={{
                background: "#16a34a",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "0.35rem 0.75rem",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px"
              }}
            >
              <span>➕</span>
              <span>New Message</span>
            </button>
          </div>

          {/* Template Cards List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "560px", overflowY: "auto" }}>
            {filteredTemplates.map((t) => {
              const isSelected = selectedTemplateId === t._id;
              return (
                <div
                  key={t._id}
                  onClick={() => {
                    setSelectedTemplateId(t._id);
                    setIsEditing(false);
                  }}
                  style={{
                    background: isSelected ? "rgba(22, 163, 74, 0.08)" : "var(--surface, #ffffff)",
                    border: isSelected ? "2px solid #16a34a" : "1px solid var(--border, #e2e8f0)",
                    borderRadius: "10px",
                    padding: "0.75rem",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 800, fontSize: "0.85rem", color: isSelected ? "#16a34a" : "var(--text, #0f172a)" }}>
                      {t.title}
                    </div>
                    <span
                      style={{
                        background: "rgba(22, 163, 74, 0.12)",
                        color: "#16a34a",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        padding: "1px 5px",
                        borderRadius: "4px"
                      }}
                    >
                      {t.category}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "var(--text2, #475569)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t.message}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: WhatsApp Interactive Preview or Template Editor */}
        <div
          style={{
            background: "var(--surface, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "12px",
            boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}
        >
          {isEditing ? (
            /* Template Editor Form */
            <form onSubmit={handleSaveForm} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem", flex: 1, overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border, #e2e8f0)", paddingBottom: "0.75rem" }}>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, color: "#16a34a" }}>
                  {formId ? "✏️ Edit WhatsApp Template" : "➕ Create New WhatsApp Template"}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  style={{ background: "none", border: "none", fontSize: "1rem", cursor: "pointer", color: "var(--text3, #94a3b8)" }}
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div style={{ background: "var(--danger-bg, #fef2f2)", color: "var(--danger, #dc2626)", padding: "0.5rem", borderRadius: "6px", fontSize: "0.8rem" }}>
                  {formError}
                </div>
              )}

              {/* Title & Category */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Template Title:</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Scholarship Discount Pitch"
                    style={{ width: "100%", padding: "0.5rem", fontSize: "0.85rem", borderRadius: "6px", border: "1px solid var(--border, #cbd5e1)", marginTop: "3px" }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Category:</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem", fontSize: "0.85rem", borderRadius: "6px", border: "1px solid var(--border, #cbd5e1)", marginTop: "3px" }}
                  >
                    {CATEGORIES.filter((c) => c !== "All").map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Message Body with Chips */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>WhatsApp Message Content:</label>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {["{name}", "{course}", "{phone}", "{email}", "{leadId}"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleInsertPlaceholder(p)}
                        style={{ background: "var(--surface2, #f8fafc)", border: "1px solid var(--border, #cbd5e1)", borderRadius: "4px", fontSize: "0.68rem", padding: "1px 6px", cursor: "pointer", color: "#16a34a", fontWeight: 700 }}
                      >
                        + {p}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  ref={textareaRef}
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                  rows={10}
                  style={{
                    width: "100%",
                    flex: 1,
                    padding: "0.75rem",
                    fontSize: "0.85rem",
                    fontFamily: "inherit",
                    borderRadius: "6px",
                    border: "1px solid var(--border, #cbd5e1)",
                    lineHeight: 1.5
                  }}
                  required
                />
              </div>

              {/* Form Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  style={{ background: "var(--surface2, #f8fafc)", border: "1px solid var(--border, #cbd5e1)", borderRadius: "6px", padding: "0.5rem 1rem", fontSize: "0.82rem", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: "#16a34a", color: "#ffffff", border: "none", borderRadius: "6px", padding: "0.5rem 1.25rem", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}
                >
                  {formId ? "Save Changes" : "Create Template"}
                </button>
              </div>
            </form>
          ) : currentTemplate ? (
            /* Interactive WhatsApp Chat Mockup Preview */
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              {/* Header */}
              <div
                style={{
                  padding: "1rem 1.5rem",
                  borderBottom: "1px solid var(--border, #e2e8f0)",
                  background: "var(--surface2, #f8fafc)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <div>
                  <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, color: "var(--text, #0f172a)" }}>
                    {currentTemplate.title}
                  </h2>
                  <div style={{ fontSize: "0.75rem", color: "var(--text3, #94a3b8)", marginTop: "2px" }}>
                    Category: {currentTemplate.category}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => handleOpenEditForm(currentTemplate)}
                    style={{
                      background: "var(--surface, #ffffff)",
                      border: "1px solid var(--border, #cbd5e1)",
                      borderRadius: "6px",
                      padding: "0.35rem 0.75rem",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    ✏️ Edit
                  </button>
                  {!currentTemplate.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleDelete(currentTemplate)}
                      style={{
                        background: "var(--surface, #ffffff)",
                        border: "1px solid var(--danger, #dc2626)",
                        color: "var(--danger, #dc2626)",
                        borderRadius: "6px",
                        padding: "0.35rem 0.75rem",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Chat Canvas (WhatsApp Background with Chat Bubble) */}
              <div
                style={{
                  flex: 1,
                  background: "var(--surface2)",
                  padding: "2rem",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center"
                }}
              >
                <div
                  style={{
                    maxWidth: "540px",
                    width: "100%",
                    background: "rgba(34, 197, 94, 0.12)",
                    border: "1px solid rgba(34, 197, 94, 0.3)",
                    color: "var(--text)",
                    borderRadius: "12px 2px 12px 12px",
                    padding: "1.2rem 1.4rem",
                    boxShadow: "var(--shadow)",
                    position: "relative",
                    lineHeight: 1.6,
                    fontSize: "0.92rem",
                    whiteSpace: "pre-wrap",
                    fontFamily: "Segoe UI, -apple-system, BlinkMacSystemFont, sans-serif"
                  }}
                >
                  {renderWhatsAppTemplate(currentTemplate.message, activeLead)}
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--text3)",
                      textAlign: "right",
                      marginTop: "8px",
                      display: "flex",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      gap: "5px"
                    }}
                  >
                    <span>11:24 AM</span>
                    <span style={{ color: "#38bdf8", fontWeight: 800 }}>✓✓</span>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div
                style={{
                  padding: "1rem 1.5rem",
                  borderTop: "1px solid var(--border, #e2e8f0)",
                  background: "var(--surface2, #f8fafc)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <button
                  type="button"
                  onClick={() => handleCopyMessage(currentTemplate)}
                  style={{
                    background: "var(--surface, #ffffff)",
                    border: "1px solid var(--border, #cbd5e1)",
                    borderRadius: "8px",
                    padding: "0.55rem 1rem",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  {copied ? "✓ Copied" : "📋 Copy Message"}
                </button>

                <button
                  type="button"
                  onClick={() => handleSendWhatsApp(currentTemplate)}
                  style={{
                    background: "#25D366",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "0.6rem 1.5rem",
                    fontSize: "0.9rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 4px 12px rgba(37, 211, 102, 0.35)"
                  }}
                >
                  <span>🚀</span>
                  <span>Send on WhatsApp Web</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
