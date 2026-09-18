import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useEmailBar } from "../context/EmailBarContext";
import {
  renderEmailTemplate,
  getGmailComposeUrl,
  getMailtoUrl,
  emailToHtml,
  emailToPlainTextWithUrls,
  copyEmailAsRichText,
  DEFAULT_COUNSELOR_PROFILE
} from "../utils/email";

const CATEGORIES = [
  "All",
  "Curriculum & Syllabus",
  "Follow-up",
  "Scholarship & Offer",
  "Demo Session",
  "Payment & Enrollment",
  "Did Not Connect",
  "Custom"
];

export default function EmailBar() {
  const {
    isOpen,
    closeEmailBar,
    templates,
    loading,
    activeLead,
    setActiveLead,
    selectedCourseFilter,
    setSelectedCourseFilter,
    counselorProfile,
    updateCounselorProfile,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    logEmailSent
  } = useEmailBar();

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Lead search & picker
  const [leadsList, setLeadsList] = useState([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [showLeadPicker, setShowLeadPicker] = useState(false);
  const [inlineEmailInput, setInlineEmailInput] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  // Template Form (Create / Edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState("Curriculum & Syllabus");
  const [formCourse, setFormCourse] = useState("All Courses");
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formError, setFormError] = useState("");

  // Counselor Profile Modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profName, setProfName] = useState("");
  const [profEmail, setProfEmail] = useState("");
  const [profPhone, setProfPhone] = useState("");
  const [profDesignation, setProfDesignation] = useState("");

  // Feedback states
  const [copiedId, setCopiedId] = useState(null);
  const [toastMsg, setToastMsg] = useState("");

  const textareaRef = useRef(null);

  // Fetch leads for the lead switcher
  useEffect(() => {
    if (isOpen) {
      axios
        .get("/api/leads")
        .then((res) => {
          if (res.data && res.data.success && Array.isArray(res.data.data)) {
            setLeadsList(res.data.data);
          }
        })
        .catch((e) => console.warn("Could not fetch leads for Email bar:", e));
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        closeEmailBar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeEmailBar]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  if (!isOpen) return null;

  // Distinct courses from leads & templates for filter dropdown
  const distinctCourses = Array.from(
    new Set([
      "All Courses",
      ...templates.map((t) => t.course).filter((c) => c && c !== "All Courses"),
      ...leadsList.flatMap((l) =>
        l.enrolledCourses ? l.enrolledCourses.map((c) => c.courseName) : [l.courseName]
      ).filter(Boolean)
    ])
  );

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    const matchesCat =
      selectedCategory === "All" ||
      (t.category && t.category.toLowerCase() === selectedCategory.toLowerCase());

    const matchesCourse =
      selectedCourseFilter === "All Courses" ||
      !t.course ||
      t.course === "All Courses" ||
      t.course.toLowerCase().includes(selectedCourseFilter.toLowerCase()) ||
      selectedCourseFilter.toLowerCase().includes(t.course.toLowerCase());

    const query = searchTerm.toLowerCase();
    const matchesSearch =
      !query ||
      (t.title && t.title.toLowerCase().includes(query)) ||
      (t.subject && t.subject.toLowerCase().includes(query)) ||
      (t.body && t.body.toLowerCase().includes(query));

    return matchesCat && matchesCourse && matchesSearch;
  });

  // Filter leads for picker
  const filteredLeads = leadsList.filter((l) => {
    if (!leadSearch) return true;
    const q = leadSearch.toLowerCase();
    return (
      (l.name && l.name.toLowerCase().includes(q)) ||
      (l.email && l.email.toLowerCase().includes(q)) ||
      (l.phone && String(l.phone).includes(q)) ||
      (l.leadId && String(l.leadId).includes(q))
    );
  });

  // Quick save missing email for active lead
  const handleSaveMissingEmail = async () => {
    if (!activeLead || !inlineEmailInput.trim()) return;
    try {
      setSavingEmail(true);
      const res = await axios.patch(`/api/leads/${activeLead._id}/quick`, {
        email: inlineEmailInput.trim()
      });
      if (res.data && res.data.success) {
        setActiveLead(res.data.data);
        setLeadsList((prev) =>
          prev.map((l) => (l._id === activeLead._id ? res.data.data : l))
        );
        showToast("✓ Email address saved to lead!");
        setInlineEmailInput("");
      }
    } catch (err) {
      alert("Failed to save email: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingEmail(false);
    }
  };

  // 1-Click Launch Gmail Compose
  const handleOpenInGmail = async (template) => {
    const renderedSub = renderEmailTemplate(template.subject, activeLead, counselorProfile);
    const renderedB = renderEmailTemplate(template.body, activeLead, counselorProfile);

    const toEmail = activeLead?.email || "";
    const composeUrl = getGmailComposeUrl({
      to: toEmail,
      subject: renderedSub,
      body: renderedB,
      counselorEmail: counselorProfile.email
    });

    // Open Gmail Compose in a new browser tab
    window.open(composeUrl, "_blank", "noopener,noreferrer");

    // Automatically log interaction to CRM timeline if lead is active
    if (activeLead && activeLead._id) {
      await logEmailSent(activeLead, renderedSub, template.title);
      showToast(`📧 Opened in Gmail & logged to ${activeLead.name}'s timeline!`);
    } else {
      showToast("📧 Opened in Gmail Web Compose!");
    }
  };

  // Copy helpers
  const handleCopyFull = (template) => {
    const renderedSub = renderEmailTemplate(template.subject, activeLead, counselorProfile);
    const renderedB = renderEmailTemplate(template.body, activeLead, counselorProfile);
    const fullText = `Subject: ${renderedSub}\n\n${emailToPlainTextWithUrls(renderedB)}`;
    navigator.clipboard.writeText(fullText);
    setCopiedId(template._id + "-full");
    setTimeout(() => setCopiedId(null), 2000);
    showToast("📋 Copied full email (Subject + Body) to clipboard!");
  };

  const handleCopyBody = (template) => {
    const renderedB = renderEmailTemplate(template.body, activeLead, counselorProfile);
    navigator.clipboard.writeText(emailToPlainTextWithUrls(renderedB));
    setCopiedId(template._id + "-body");
    setTimeout(() => setCopiedId(null), 2000);
    showToast("📋 Copied email body with links to clipboard!");
  };

  const handleCopyRichText = async (template) => {
    const renderedSub = renderEmailTemplate(template.subject, activeLead, counselorProfile);
    const renderedB = renderEmailTemplate(template.body, activeLead, counselorProfile);
    const ok = await copyEmailAsRichText({ subject: renderedSub, body: renderedB });
    if (ok) {
      setCopiedId(template._id + "-rich");
      setTimeout(() => setCopiedId(null), 2000);
      showToast("✨ Copied formatted email with clickable links!");
    } else {
      showToast("📋 Copied email to clipboard!");
    }
  };

  // Insert placeholder into template editor
  const handleInsertPlaceholder = (placeholder) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart || 0;
    const end = textareaRef.current.selectionEnd || 0;
    const current = formBody;
    const updated = current.substring(0, start) + placeholder + current.substring(end);
    setFormBody(updated);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = start + placeholder.length;
        textareaRef.current.selectionEnd = start + placeholder.length;
      }
    }, 50);
  };

  // Open Form for Create
  const handleOpenCreateForm = () => {
    setEditingId(null);
    setFormTitle("");
    setFormCategory(selectedCategory !== "All" ? selectedCategory : "Curriculum & Syllabus");
    setFormCourse(selectedCourseFilter !== "All Courses" ? selectedCourseFilter : "All Courses");
    setFormSubject("Henry Harvin Education: {course} - Details for {name}");
    setFormBody(
      `Dear {name},\n\nGreetings from Henry Harvin Education!\n\nRegarding your enquiry for {course}...\n\nProgram Fee: {fees}\n\nWarm regards,\n{counselorName}\n{counselorDesignation} | Henry Harvin Education\nOfficial Email: {counselorEmail}`
    );
    setFormError("");
    setIsFormOpen(true);
  };

  // Open Form for Edit
  const handleOpenEditForm = (t) => {
    setEditingId(t._id);
    setFormTitle(t.title);
    setFormCategory(t.category || "Curriculum & Syllabus");
    setFormCourse(t.course || "All Courses");
    setFormSubject(t.subject || "");
    setFormBody(t.body || "");
    setFormError("");
    setIsFormOpen(true);
  };

  // Save Template
  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError("Template title is required");
      return;
    }
    if (!formSubject.trim()) {
      setFormError("Email subject line is required");
      return;
    }
    if (!formBody.trim()) {
      setFormError("Email body content is required");
      return;
    }

    if (editingId) {
      await updateTemplate(editingId, {
        title: formTitle,
        category: formCategory,
        course: formCourse,
        subject: formSubject,
        body: formBody
      });
      showToast("✓ Template updated successfully!");
    } else {
      await createTemplate({
        title: formTitle,
        category: formCategory,
        course: formCourse,
        subject: formSubject,
        body: formBody
      });
      showToast("✓ New email template created!");
    }
    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleDelete = async (id, title) => {
    if (window.confirm(`Are you sure you want to delete template "${title}"?`)) {
      await deleteTemplate(id);
      showToast("✓ Template deleted.");
    }
  };

  // Open Profile Settings
  const handleOpenProfileModal = () => {
    setProfName(counselorProfile.name || "Subham Saha");
    setProfEmail(counselorProfile.email || "subham.saha@henryharvin.in");
    setProfPhone(counselorProfile.phone || "+91 98183 31469");
    setProfDesignation(counselorProfile.designation || "Senior Educational Counselor");
    setShowProfileModal(true);
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    updateCounselorProfile({
      name: profName.trim() || "Subham Saha",
      email: profEmail.trim() || "subham.saha@henryharvin.in",
      phone: profPhone.trim() || "+91 98183 31469",
      designation: profDesignation.trim() || "Senior Educational Counselor"
    });
    setShowProfileModal(false);
    showToast("✓ Counselor signature profile updated!");
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeEmailBar}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(15, 23, 42, 0.4)",
          backdropFilter: "blur(3px)",
          zIndex: 979,
          animation: "fadeIn 0.2s ease"
        }}
      />

      {/* Drawer Container */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "560px",
          maxWidth: "100vw",
          backgroundColor: "var(--surface, #ffffff)",
          color: "var(--text, #0f172a)",
          zIndex: 980,
          boxShadow: "-8px 0 32px rgba(0, 0, 0, 0.22)",
          display: "flex",
          flexDirection: "column",
          animation: "slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          overflow: "hidden"
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--border, #e2e8f0)",
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            color: "#ffffff",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span style={{ fontSize: "1.4rem" }}>📧</span>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#ffffff" }}>
                    Email Templates & Quick Send
                  </h2>
                  <span
                    style={{
                      background: "rgba(59, 130, 246, 0.3)",
                      color: "#93c5fd",
                      border: "1px solid rgba(59, 130, 246, 0.5)",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      padding: "0.15rem 0.45rem",
                      borderRadius: "12px"
                    }}
                  >
                    {templates.length} Saved
                  </span>
                </div>
                <div style={{ fontSize: "0.76rem", opacity: 0.85, marginTop: "2px" }}>
                  1-Click Send via official Google Workspace ({counselorProfile.email})
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={handleOpenProfileModal}
                style={{
                  background: "rgba(255, 255, 255, 0.12)",
                  color: "#ffffff",
                  border: "1px solid rgba(255, 255, 255, 0.25)",
                  borderRadius: "6px",
                  padding: "0.3rem 0.55rem",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
                title="Edit Counselor Signature & Email Profile"
              >
                👤 Signature
              </button>
              <button
                type="button"
                onClick={closeEmailBar}
                style={{
                  background: "rgba(255, 255, 255, 0.12)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  width: "30px",
                  height: "30px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: "1.1rem"
                }}
                title="Close (ESC)"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Toast Alert Banner */}
        {toastMsg && (
          <div
            style={{
              background: "var(--accent, #4f46e5)",
              color: "#ffffff",
              padding: "0.6rem 1rem",
              fontSize: "0.82rem",
              fontWeight: 600,
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
              style={{ background: "none", border: "none", color: "#ffffff", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Active Lead Banner */}
        <div
          style={{
            padding: "0.85rem 1.25rem",
            background: activeLead ? "var(--surface2, #f8fafc)" : "var(--warn-bg, #fffbeb)",
            borderBottom: "1px solid var(--border, #e2e8f0)",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                color: "var(--text3, #94a3b8)",
                textTransform: "uppercase",
                letterSpacing: "0.04em"
              }}
            >
              Target Student Recipient:
            </span>
            <button
              type="button"
              onClick={() => setShowLeadPicker((prev) => !prev)}
              style={{
                background: "none",
                border: "none",
                color: "var(--accent, #4f46e5)",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
                padding: 0
              }}
            >
              {activeLead ? "⇄ Switch Student" : "🔍 Select Student"}
            </button>
          </div>

          {activeLead ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                  {activeLead.name}
                  {activeLead.leadId && (
                    <span style={{ fontSize: "0.75rem", color: "var(--text3, #94a3b8)", marginLeft: "6px" }}>
                      (ID: {activeLead.leadId})
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    padding: "0.15rem 0.5rem",
                    borderRadius: "4px",
                    background: "var(--accent-bg, #eef2ff)",
                    color: "var(--accent, #4f46e5)",
                    fontWeight: 600
                  }}
                >
                  {activeLead.enrolledCourses && activeLead.enrolledCourses.length > 0
                    ? activeLead.enrolledCourses[0].courseName
                    : activeLead.courseName || "General"}
                </div>
              </div>

              {/* Email address / Missing Email warning */}
              {activeLead.email ? (
                <div style={{ fontSize: "0.82rem", color: "var(--text2, #475569)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>✉️ {activeLead.email}</span>
                  {activeLead.phone && (
                    <span style={{ color: "var(--text3, #94a3b8)", fontSize: "0.76rem" }}>
                      • 📞 {activeLead.phone}
                    </span>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    background: "var(--warn-bg, #fffbeb)",
                    border: "1px solid var(--warn, #f59e0b)",
                    borderRadius: "6px",
                    padding: "6px 10px",
                    fontSize: "0.78rem",
                    color: "var(--warn, #d97706)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    marginTop: "2px"
                  }}
                >
                  <div style={{ fontWeight: 600 }}>⚠️ No email address saved for this lead!</div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="email"
                      placeholder="Enter student's email..."
                      value={inlineEmailInput}
                      onChange={(e) => setInlineEmailInput(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "4px 8px",
                        fontSize: "0.78rem",
                        borderRadius: "4px",
                        border: "1px solid var(--border, #cbd5e1)",
                        background: "var(--surface, #ffffff)",
                        color: "var(--text, #0f172a)"
                      }}
                    />
                    <button
                      type="button"
                      disabled={savingEmail || !inlineEmailInput.trim()}
                      onClick={handleSaveMissingEmail}
                      style={{
                        background: "var(--warn, #d97706)",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "4px",
                        padding: "4px 10px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        cursor: savingEmail ? "not-allowed" : "pointer"
                      }}
                    >
                      {savingEmail ? "Saving..." : "Save Email"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: "0.82rem", color: "var(--warn, #d97706)" }}>
              ⚠️ No student currently selected. Templates will show preview defaults. Click <strong>"Select Student"</strong> above to personalize for a specific lead!
            </div>
          )}

          {/* Searchable Student Picker Dropdown */}
          {showLeadPicker && (
            <div
              style={{
                marginTop: "0.4rem",
                padding: "0.6rem",
                background: "var(--surface, #ffffff)",
                border: "1px solid var(--border, #cbd5e1)",
                borderRadius: "8px",
                boxShadow: "var(--shadow, 0 4px 6px rgba(0,0,0,0.1))"
              }}
            >
              <input
                type="text"
                placeholder="Search students by name, email, phone, or Lead ID..."
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                autoFocus
                style={{
                  width: "100%",
                  padding: "0.45rem 0.65rem",
                  fontSize: "0.82rem",
                  border: "1px solid var(--border, #cbd5e1)",
                  borderRadius: "6px",
                  background: "var(--surface2, #f8fafc)",
                  color: "var(--text, #0f172a)",
                  marginBottom: "0.5rem"
                }}
              />
              <div style={{ maxHeight: "160px", overflowY: "auto" }}>
                {filteredLeads.slice(0, 20).map((l) => (
                  <div
                    key={l._id}
                    onClick={() => {
                      setActiveLead(l);
                      if (l.enrolledCourses && l.enrolledCourses.length > 0) {
                        setSelectedCourseFilter(l.enrolledCourses[0].courseName);
                      }
                      setShowLeadPicker(false);
                      setLeadSearch("");
                    }}
                    style={{
                      padding: "0.4rem 0.6rem",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderBottom: "1px solid var(--border, #f1f5f9)"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2, #f8fafc)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div>
                      <strong style={{ color: "var(--text, #0f172a)" }}>{l.name}</strong>
                      <div style={{ fontSize: "0.72rem", color: "var(--text3, #94a3b8)" }}>
                        {l.email ? `✉️ ${l.email}` : "⚠️ No email"} • 📞 {l.phone}
                      </div>
                    </div>
                    <span style={{ fontSize: "0.72rem", color: "var(--accent, #4f46e5)", fontWeight: 600 }}>
                      Select →
                    </span>
                  </div>
                ))}
                {filteredLeads.length === 0 && (
                  <div style={{ padding: "0.6rem", fontSize: "0.78rem", color: "var(--text3, #94a3b8)", textAlign: "center" }}>
                    No matching students found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Filter Controls: Course Dropdown + Keyword Search + Category Tabs */}
        <div style={{ padding: "0.75rem 1.25rem 0.5rem", borderBottom: "1px solid var(--border, #e2e8f0)", background: "var(--surface, #ffffff)" }}>
          {/* Row 1: Course Selector + Search */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text3, #94a3b8)", display: "block", marginBottom: "2px" }}>
                FILTER BY COURSE:
              </label>
              <select
                value={selectedCourseFilter}
                onChange={(e) => setSelectedCourseFilter(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.4rem 0.6rem",
                  fontSize: "0.8rem",
                  borderRadius: "6px",
                  border: "1px solid var(--border, #cbd5e1)",
                  background: "var(--surface2, #f8fafc)",
                  color: "var(--text, #0f172a)",
                  fontWeight: 600
                }}
              >
                {distinctCourses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text3, #94a3b8)", display: "block", marginBottom: "2px" }}>
                KEYWORD SEARCH:
              </label>
              <input
                type="text"
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.4rem 0.6rem",
                  fontSize: "0.8rem",
                  borderRadius: "6px",
                  border: "1px solid var(--border, #cbd5e1)",
                  background: "var(--surface2, #f8fafc)",
                  color: "var(--text, #0f172a)"
                }}
              />
            </div>
          </div>

          {/* Row 2: Category Filter Tabs */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              overflowX: "auto",
              paddingBottom: "4px",
              scrollbarWidth: "none"
            }}
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: "0.25rem 0.6rem",
                  borderRadius: "20px",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  border: "1px solid",
                  borderColor: selectedCategory === cat ? "var(--accent, #4f46e5)" : "var(--border, #e2e8f0)",
                  background: selectedCategory === cat ? "var(--accent, #4f46e5)" : "var(--surface2, #f8fafc)",
                  color: selectedCategory === cat ? "#ffffff" : "var(--text2, #475569)",
                  transition: "all 0.15s ease"
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Action Button: Create New Template */}
        <div style={{ padding: "0.6rem 1.25rem", borderBottom: "1px solid var(--border, #e2e8f0)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface2, #f8fafc)" }}>
          <span style={{ fontSize: "0.76rem", color: "var(--text3, #94a3b8)", fontWeight: 600 }}>
            Showing {filteredTemplates.length} of {templates.length} templates
          </span>
          <button
            type="button"
            onClick={handleOpenCreateForm}
            style={{
              background: "var(--accent, #4f46e5)",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "0.35rem 0.75rem",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              boxShadow: "0 2px 6px rgba(79, 70, 229, 0.3)"
            }}
          >
            <span>➕</span>
            <span>New Template</span>
          </button>
        </div>

        {/* Scrollable Template List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Template Creator / Editor Form Accordion */}
          {isFormOpen && (
            <div
              style={{
                background: "var(--surface, #ffffff)",
                border: "2px solid var(--accent, #4f46e5)",
                borderRadius: "10px",
                padding: "1rem",
                boxShadow: "var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.1))",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                animation: "fadeIn 0.2s ease"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--accent, #4f46e5)" }}>
                  {editingId ? "✏️ Edit Email Template" : "➕ Create Custom Email Template"}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  style={{ background: "none", border: "none", color: "var(--text3, #94a3b8)", cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div style={{ background: "var(--danger-bg, #fef2f2)", color: "var(--danger, #dc2626)", padding: "0.4rem 0.6rem", borderRadius: "4px", fontSize: "0.75rem" }}>
                  {formError}
                </div>
              )}

              {/* Form Row: Title + Course */}
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text2, #475569)" }}>
                    Template Title:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lean Six Sigma Syllabus & Schedule"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.6rem",
                      fontSize: "0.8rem",
                      borderRadius: "6px",
                      border: "1px solid var(--border, #cbd5e1)",
                      marginTop: "2px"
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text2, #475569)" }}>
                    Target Course:
                  </label>
                  <input
                    type="text"
                    placeholder="All Courses or specific (e.g. Data Science)"
                    value={formCourse}
                    onChange={(e) => setFormCourse(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.6rem",
                      fontSize: "0.8rem",
                      borderRadius: "6px",
                      border: "1px solid var(--border, #cbd5e1)",
                      marginTop: "2px"
                    }}
                  />
                </div>
              </div>

              {/* Form Row: Category */}
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text2, #475569)" }}>
                  Category:
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.6rem",
                    fontSize: "0.8rem",
                    borderRadius: "6px",
                    border: "1px solid var(--border, #cbd5e1)",
                    marginTop: "2px"
                  }}
                >
                  {CATEGORIES.filter((c) => c !== "All").map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Form Row: Subject Line */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text2, #475569)" }}>
                    Email Subject Line:
                  </label>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {["{name}", "{course}", "{batchDate}"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setFormSubject((prev) => prev + " " + p)}
                        style={{
                          background: "var(--surface2, #f8fafc)",
                          border: "1px solid var(--border, #cbd5e1)",
                          borderRadius: "4px",
                          fontSize: "0.68rem",
                          padding: "1px 5px",
                          cursor: "pointer",
                          color: "var(--accent, #4f46e5)"
                        }}
                      >
                        + {p}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Henry Harvin: {course} Curriculum & Batch Details for {name}"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.6rem",
                    fontSize: "0.8rem",
                    borderRadius: "6px",
                    border: "1px solid var(--border, #cbd5e1)",
                    marginTop: "2px"
                  }}
                />
              </div>

              {/* Form Row: Body Content */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text2, #475569)" }}>
                    Email Body:
                  </label>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
                    {["{name}", "{course}", "{fees}", "{phone}", "{counselorName}", "{counselorEmail}"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleInsertPlaceholder(p)}
                        style={{
                          background: "var(--surface2, #f8fafc)",
                          border: "1px solid var(--border, #cbd5e1)",
                          borderRadius: "4px",
                          fontSize: "0.68rem",
                          padding: "1px 5px",
                          cursor: "pointer",
                          color: "var(--accent, #4f46e5)"
                        }}
                      >
                        + {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleInsertPlaceholder("[Click Here to View](https://www.henryharvin.com/)")}
                      style={{
                        background: "rgba(79, 70, 229, 0.1)",
                        border: "1px solid var(--accent, #4f46e5)",
                        borderRadius: "4px",
                        fontSize: "0.68rem",
                        padding: "1px 6px",
                        cursor: "pointer",
                        color: "var(--accent, #4f46e5)",
                        fontWeight: 700
                      }}
                      title="Insert [Link Text](https://URL)"
                    >
                      🔗 + Link [Text](URL)
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    marginBottom: "4px",
                    fontSize: "0.72rem",
                    background: "rgba(79, 70, 229, 0.06)",
                    border: "1px solid rgba(79, 70, 229, 0.15)",
                    borderRadius: "4px",
                    padding: "3px 6px",
                    color: "var(--text2, #475569)"
                  }}
                >
                  💡 <strong>Links:</strong> Use <code>[Click Here](https://...)</code> or paste raw URLs to make clickable links.
                </div>
                <textarea
                  ref={textareaRef}
                  rows={8}
                  placeholder="Write your email content here..."
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    fontSize: "0.8rem",
                    fontFamily: "inherit",
                    borderRadius: "6px",
                    border: "1px solid var(--border, #cbd5e1)",
                    lineHeight: 1.4
                  }}
                />
              </div>

              {/* Form Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  style={{
                    background: "var(--surface2, #f8fafc)",
                    border: "1px solid var(--border, #cbd5e1)",
                    borderRadius: "6px",
                    padding: "0.4rem 0.8rem",
                    fontSize: "0.78rem",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveForm}
                  style={{
                    background: "var(--accent, #4f46e5)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "0.4rem 1rem",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  {editingId ? "Save Changes" : "Create Template"}
                </button>
              </div>
            </div>
          )}

          {/* Rendered Template Cards */}
          {filteredTemplates.map((t) => {
            const renderedSub = renderEmailTemplate(t.subject, activeLead, counselorProfile);
            const renderedB = renderEmailTemplate(t.body, activeLead, counselorProfile);

            return (
              <div
                key={t._id}
                style={{
                  background: "var(--surface, #ffffff)",
                  border: "1px solid var(--border, #e2e8f0)",
                  borderRadius: "10px",
                  overflow: "hidden",
                  boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))",
                  display: "flex",
                  flexDirection: "column"
                }}
              >
                {/* Template Card Header */}
                <div
                  style={{
                    padding: "0.75rem 1rem",
                    background: "var(--surface2, #f8fafc)",
                    borderBottom: "1px solid var(--border, #e2e8f0)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text, #0f172a)" }}>
                      {t.title}
                    </span>
                    {t.course && t.course !== "All Courses" && (
                      <span
                        style={{
                          background: "var(--accent-bg, #eef2ff)",
                          color: "var(--accent, #4f46e5)",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          padding: "0.1rem 0.45rem",
                          borderRadius: "10px"
                        }}
                      >
                        🎓 {t.course}
                      </span>
                    )}
                    <span
                      style={{
                        background: "var(--surface, #ffffff)",
                        border: "1px solid var(--border, #cbd5e1)",
                        color: "var(--text2, #475569)",
                        fontSize: "0.68rem",
                        fontWeight: 600,
                        padding: "0.1rem 0.45rem",
                        borderRadius: "10px"
                      }}
                    >
                      {t.category}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => handleOpenEditForm(t)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        color: "var(--text3, #94a3b8)"
                      }}
                      title="Edit Template"
                    >
                      ✏️
                    </button>
                    {!t.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleDelete(t._id, t.title)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                          color: "var(--danger, #dc2626)"
                        }}
                        title="Delete Template"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>

                {/* Template Card Body Preview */}
                <div style={{ padding: "0.85rem 1rem", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {/* Subject line box */}
                  <div
                    style={{
                      background: "var(--surface2, #f8fafc)",
                      border: "1px solid var(--border, #e2e8f0)",
                      borderRadius: "6px",
                      padding: "6px 10px",
                      fontSize: "0.78rem"
                    }}
                  >
                    <span style={{ fontWeight: 700, color: "var(--text3, #94a3b8)", marginRight: "6px" }}>
                      Subject:
                    </span>
                    <strong style={{ color: "var(--text, #0f172a)" }}>{renderedSub}</strong>
                  </div>

                  {/* Body preview box */}
                  <div
                    style={{
                      background: "var(--surface2, #f8fafc)",
                      border: "1px solid var(--border, #e2e8f0)",
                      borderRadius: "6px",
                      padding: "8px 10px",
                      fontSize: "0.75rem",
                      color: "var(--text2, #475569)",
                      maxHeight: "140px",
                      overflowY: "auto",
                      lineHeight: 1.45,
                      fontFamily: "inherit"
                    }}
                    dangerouslySetInnerHTML={{
                      __html: emailToHtml(renderedB)
                    }}
                  />
                </div>

                {/* Template Card Action Buttons */}
                <div
                  style={{
                    padding: "0.6rem 1rem",
                    borderTop: "1px solid var(--border, #e2e8f0)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    background: "var(--surface2, #f8fafc)"
                  }}
                >
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => handleCopyRichText(t)}
                      style={{
                        background: copiedId === t._id + "-rich" ? "rgba(16, 185, 129, 0.15)" : "rgba(79, 70, 229, 0.1)",
                        border: "1px solid",
                        borderColor: copiedId === t._id + "-rich" ? "#10b981" : "var(--accent, #4f46e5)",
                        borderRadius: "6px",
                        padding: "0.35rem 0.65rem",
                        fontSize: "0.74rem",
                        color: copiedId === t._id + "-rich" ? "#10b981" : "var(--accent, #4f46e5)",
                        cursor: "pointer",
                        fontWeight: 700
                      }}
                      title="Copy with formatted clickable hyperlinks"
                    >
                      {copiedId === t._id + "-rich" ? "✓ Copied!" : "✨ Rich Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyFull(t)}
                      style={{
                        background: "var(--surface, #ffffff)",
                        border: "1px solid var(--border, #cbd5e1)",
                        borderRadius: "6px",
                        padding: "0.35rem 0.65rem",
                        fontSize: "0.74rem",
                        color: "var(--text2, #475569)",
                        cursor: "pointer",
                        fontWeight: 600
                      }}
                      title="Copy Subject + Body"
                    >
                      {copiedId === t._id + "-full" ? "✓ Copied" : "📋 Full"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyBody(t)}
                      style={{
                        background: "var(--surface, #ffffff)",
                        border: "1px solid var(--border, #cbd5e1)",
                        borderRadius: "6px",
                        padding: "0.35rem 0.65rem",
                        fontSize: "0.74rem",
                        color: "var(--text2, #475569)",
                        cursor: "pointer",
                        fontWeight: 500
                      }}
                      title="Copy Body Only"
                    >
                      {copiedId === t._id + "-body" ? "✓ Copied" : "Body"}
                    </button>
                    <a
                      href={getMailtoUrl({
                        to: activeLead?.email || "",
                        subject: renderedSub,
                        body: emailToPlainTextWithUrls(renderedB)
                      })}
                      style={{
                        background: "var(--surface, #ffffff)",
                        border: "1px solid var(--border, #cbd5e1)",
                        borderRadius: "6px",
                        padding: "0.35rem 0.65rem",
                        fontSize: "0.74rem",
                        color: "var(--text2, #475569)",
                        textDecoration: "none",
                        fontWeight: 500,
                        display: "inline-flex",
                        alignItems: "center"
                      }}
                      title="Open in default desktop mail client"
                    >
                      ✉️ Mailto
                    </a>
                  </div>

                  {/* Primary 1-Click Send Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenInGmail(t)}
                    style={{
                      background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "0.4rem 0.95rem",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 2px 6px rgba(37, 99, 235, 0.3)"
                    }}
                    title="Open in Gmail Web Compose with all fields pre-filled"
                  >
                    <span>🚀</span>
                    <span>Open in Gmail (1-Click)</span>
                  </button>
                </div>
              </div>
            );
          })}

          {filteredTemplates.length === 0 && (
            <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text3, #94a3b8)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📭</div>
              <p style={{ fontWeight: 600 }}>No templates matched your current filter.</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("All");
                  setSelectedCourseFilter("All Courses");
                  setSearchTerm("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--accent, #4f46e5)",
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  marginTop: "4px"
                }}
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Counselor Profile Modal */}
      {showProfileModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "fadeIn 0.15s ease"
          }}
        >
          <div
            style={{
              background: "var(--surface, #ffffff)",
              color: "var(--text, #0f172a)",
              borderRadius: "12px",
              width: "420px",
              maxWidth: "92vw",
              padding: "1.25rem",
              boxShadow: "var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.2))",
              display: "flex",
              flexDirection: "column",
              gap: "1rem"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
                👤 Counselor Signature Profile
              </h3>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.1rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "0.78rem", color: "var(--text2, #475569)", margin: 0 }}>
              This information is automatically populated into all email templates as your official Henry Harvin sign-off.
            </p>

            <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 600 }}>Your Full Name:</label>
                <input
                  type="text"
                  value={profName}
                  onChange={(e) => setProfName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.65rem",
                    fontSize: "0.82rem",
                    borderRadius: "6px",
                    border: "1px solid var(--border, #cbd5e1)",
                    marginTop: "2px"
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 600 }}>Official Email Address:</label>
                <input
                  type="email"
                  value={profEmail}
                  onChange={(e) => setProfEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.65rem",
                    fontSize: "0.82rem",
                    borderRadius: "6px",
                    border: "1px solid var(--border, #cbd5e1)",
                    marginTop: "2px"
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 600 }}>Phone / WhatsApp Number:</label>
                <input
                  type="text"
                  value={profPhone}
                  onChange={(e) => setProfPhone(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.65rem",
                    fontSize: "0.82rem",
                    borderRadius: "6px",
                    border: "1px solid var(--border, #cbd5e1)",
                    marginTop: "2px"
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 600 }}>Official Designation:</label>
                <input
                  type="text"
                  value={profDesignation}
                  onChange={(e) => setProfDesignation(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.65rem",
                    fontSize: "0.82rem",
                    borderRadius: "6px",
                    border: "1px solid var(--border, #cbd5e1)",
                    marginTop: "2px"
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  style={{
                    background: "var(--surface2, #f8fafc)",
                    border: "1px solid var(--border, #cbd5e1)",
                    borderRadius: "6px",
                    padding: "0.4rem 0.8rem",
                    fontSize: "0.78rem",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: "var(--accent, #4f46e5)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "0.4rem 1rem",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Save Signature
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
