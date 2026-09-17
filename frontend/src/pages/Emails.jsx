import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { useEmailBar } from "../context/EmailBarContext";
import {
  renderEmailTemplate,
  getOutlookComposeUrl,
  getGmailComposeUrl,
  getMailtoUrl,
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

export default function Emails({ onDataChange }) {
  const [searchParams] = useSearchParams();
  const leadIdParam = searchParams.get("leadId");

  const {
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

  // State
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Leads list & picker
  const [leadsList, setLeadsList] = useState([]);
  const [showLeadPicker, setShowLeadPicker] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [inlineEmailInput, setInlineEmailInput] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  // Template Form (Create / Edit)
  const [isEditing, setIsEditing] = useState(false);
  const [formId, setFormId] = useState(null);
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState("Curriculum & Syllabus");
  const [formCourse, setFormCourse] = useState("All Courses");
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formError, setFormError] = useState("");

  // Feedback states
  const [copiedType, setCopiedType] = useState(null);
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

          // If leadId is in query param, find and activate it
          if (leadIdParam) {
            const matched = res.data.data.find(
              (l) => l._id === leadIdParam || l.leadId === leadIdParam
            );
            if (matched) {
              setActiveLead(matched);
              if (matched.enrolledCourses && matched.enrolledCourses.length > 0) {
                setSelectedCourseFilter(matched.enrolledCourses[0].courseName);
              }
            }
          }
        }
      })
      .catch((e) => console.warn("Could not fetch leads for Email Hub:", e));
  }, [leadIdParam, setActiveLead, setSelectedCourseFilter]);

  // Set default selected template
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0]._id);
    }
  }, [templates, selectedTemplateId]);

  // Distinct courses
  const distinctCourses = Array.from(
    new Set([
      "All Courses",
      "Lean Six Sigma",
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

    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.subject && t.subject.toLowerCase().includes(q)) ||
      (t.body && t.body.toLowerCase().includes(q));

    return matchesCat && matchesCourse && matchesSearch;
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
      (l.email && l.email.toLowerCase().includes(q)) ||
      (l.phone && String(l.phone).includes(q)) ||
      (l.leadId && String(l.leadId).includes(q))
    );
  });

  // Save missing email
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
        showToast("✓ Email address saved to lead profile!");
        setInlineEmailInput("");
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      alert("Failed to save email: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingEmail(false);
    }
  };

  // 1-Click Launch Outlook Web Compose
  const handleOpenInOutlook = async (template) => {
    const renderedSub = renderEmailTemplate(template.subject, activeLead, counselorProfile);
    const renderedB = renderEmailTemplate(template.body, activeLead, counselorProfile);

    const toEmail = activeLead?.email || "";
    const composeUrl = getOutlookComposeUrl({
      to: toEmail,
      subject: renderedSub,
      body: renderedB
    });

    // Launch Outlook Web in new tab
    window.open(composeUrl, "_blank", "noopener,noreferrer");

    // Automatically log interaction to CRM timeline
    if (activeLead && activeLead._id) {
      await logEmailSent(activeLead, renderedSub, template.title);
      showToast(`📧 Opened in Outlook & logged to ${activeLead.name}'s CRM timeline!`);
      if (onDataChange) onDataChange();
    } else {
      showToast("📧 Opened in Outlook Web Compose!");
    }
  };

  // 1-Click Launch Gmail Compose (fallback)
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
    window.open(composeUrl, "_blank", "noopener,noreferrer");
    if (activeLead && activeLead._id) {
      await logEmailSent(activeLead, renderedSub, template.title);
      showToast(`📧 Opened in Gmail & logged to timeline!`);
    }
  };

  // Copy handlers
  const handleCopyFull = (template) => {
    const renderedSub = renderEmailTemplate(template.subject, activeLead, counselorProfile);
    const renderedB = renderEmailTemplate(template.body, activeLead, counselorProfile);
    const full = `Subject: ${renderedSub}\n\n${renderedB}`;
    navigator.clipboard.writeText(full);
    setCopiedType("full");
    setTimeout(() => setCopiedType(null), 2000);
    showToast("📋 Copied full email (Subject + Body) to clipboard!");
  };

  const handleCopySubject = (template) => {
    const renderedSub = renderEmailTemplate(template.subject, activeLead, counselorProfile);
    navigator.clipboard.writeText(renderedSub);
    setCopiedType("subject");
    setTimeout(() => setCopiedType(null), 2000);
    showToast("📋 Copied email subject line!");
  };

  const handleCopyBody = (template) => {
    const renderedB = renderEmailTemplate(template.body, activeLead, counselorProfile);
    navigator.clipboard.writeText(renderedB);
    setCopiedType("body");
    setTimeout(() => setCopiedType(null), 2000);
    showToast("📋 Copied email body text!");
  };

  // Open Form for Create
  const handleOpenCreateForm = () => {
    setFormId(null);
    setFormTitle("");
    setFormCategory(selectedCategory !== "All" ? selectedCategory : "Curriculum & Syllabus");
    setFormCourse(selectedCourseFilter !== "All Courses" ? selectedCourseFilter : "All Courses");
    setFormSubject("Henry Harvin Education: {course} - Details for {name}");
    setFormBody(
      `Greetings of the day!\n\nThank you for your interest in {course} with Henry Harvin Education.\n\nI am Subham your Learning Consultant, and I will be assisting you throughout the admission process.\n\nProgram Highlights:\n• Live Interactive Online Training\n• 100% Practical Hands-on Projects\n• 1-Year Gold Membership with LMS access & recordings\n• Dedicated Placement & Internship Assistance\n\nProgram Fee: {fees}\n\nPlease review and let me know if you would like me to reserve your seat in the upcoming batch.\n\nWarm regards,\nSubham`
    );
    setFormError("");
    setIsEditing(true);
  };

  // Open Form for Edit
  const handleOpenEditForm = (t) => {
    setFormId(t._id);
    setFormTitle(t.title);
    setFormCategory(t.category || "Curriculum & Syllabus");
    setFormCourse(t.course || "All Courses");
    setFormSubject(t.subject || "");
    setFormBody(t.body || "");
    setFormError("");
    setIsEditing(true);
  };

  // Insert placeholder chip
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

  // Save template
  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError("Template title is required");
      return;
    }
    if (!formSubject.trim()) {
      setFormError("Email subject is required");
      return;
    }
    if (!formBody.trim()) {
      setFormError("Email body is required");
      return;
    }

    if (formId) {
      await updateTemplate(formId, {
        title: formTitle,
        category: formCategory,
        course: formCourse,
        subject: formSubject,
        body: formBody
      });
      showToast("✓ Template updated successfully!");
    } else {
      const res = await createTemplate({
        title: formTitle,
        category: formCategory,
        course: formCourse,
        subject: formSubject,
        body: formBody
      });
      if (res && res.data) {
        setSelectedTemplateId(res.data._id);
      }
      showToast("✓ New template created!");
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
      {/* Top Header Bar */}
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
              background: "rgba(37, 99, 235, 0.12)",
              color: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            📧
          </span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <h1 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "var(--text)" }}>
                Email Hub
              </h1>
              <span
                style={{
                  background: "rgba(37, 99, 235, 0.12)",
                  color: "#2563eb",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  padding: "0.2rem 0.55rem",
                  borderRadius: "6px",
                  border: "1px solid rgba(37, 99, 235, 0.25)"
                }}
              >
                1-Click Outlook Web
              </span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text3)", marginTop: "2px" }}>
              Corporate Account: <strong style={{ color: "var(--text2)" }}>subham.saha@henryharvin.in</strong> • Official Visiting Card Signature Auto-Attached
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
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
                  color: "#0078d4",
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
                    {activeLead.leadId && (
                      <span style={{ fontSize: "0.75rem", color: "var(--text3, #94a3b8)", marginLeft: "6px" }}>
                        (ID: {activeLead.leadId})
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      background: "rgba(0, 120, 212, 0.1)",
                      color: "#0078d4",
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
                      marginTop: "4px"
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>⚠️ Missing Email Address</div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        type="email"
                        placeholder="Enter student email..."
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
                          background: "#0078d4",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "4px",
                          padding: "4px 10px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: savingEmail ? "not-allowed" : "pointer"
                        }}
                      >
                        {savingEmail ? "..." : "Save"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: "0.82rem", color: "var(--text3, #94a3b8)" }}>
                No student selected. Click <strong>"Select Student"</strong> to personalize emails!
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
                        if (l.enrolledCourses && l.enrolledCourses.length > 0) {
                          setSelectedCourseFilter(l.enrolledCourses[0].courseName);
                        }
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
                          {l.email || "No email"} • 📞 {l.phone}
                        </div>
                      </div>
                      <span style={{ color: "#0078d4", fontWeight: 700 }}>Select →</span>
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
                FILTER BY COURSE:
              </label>
              <select
                value={selectedCourseFilter}
                onChange={(e) => setSelectedCourseFilter(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.45rem 0.65rem",
                  fontSize: "0.82rem",
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

            <div>
              <label style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--text3, #94a3b8)", display: "block", marginBottom: "3px" }}>
                KEYWORD SEARCH:
              </label>
              <input
                type="text"
                placeholder="Search subject or pitch..."
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
                      borderColor: selectedCategory === cat ? "#0078d4" : "var(--border, #cbd5e1)",
                      background: selectedCategory === cat ? "#0078d4" : "var(--surface2, #f8fafc)",
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
                background: "#0078d4",
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
              <span>New Template</span>
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
                    background: isSelected ? "rgba(0, 120, 212, 0.08)" : "var(--surface, #ffffff)",
                    border: isSelected ? "2px solid #0078d4" : "1px solid var(--border, #e2e8f0)",
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
                    <div style={{ fontWeight: 800, fontSize: "0.85rem", color: isSelected ? "#0078d4" : "var(--text, #0f172a)" }}>
                      {t.title}
                    </div>
                    {t.course && t.course !== "All Courses" && (
                      <span
                        style={{
                          background: "rgba(0, 120, 212, 0.12)",
                          color: "#0078d4",
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          padding: "1px 5px",
                          borderRadius: "4px"
                        }}
                      >
                        {t.course}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "var(--text2, #475569)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t.subject}
                  </div>
                </div>
              );
            })}

            {filteredTemplates.length === 0 && (
              <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--text3, #94a3b8)", fontSize: "0.85rem" }}>
                No templates matched your current search/filter.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Main Reading Pane or Template Editor */}
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
                <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, color: "#0078d4" }}>
                  {formId ? "✏️ Edit Email Template" : "➕ Create New Email Template"}
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

              {/* Title & Course */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Template Title:</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Lean Six Sigma Agota Framework Pitch"
                    style={{ width: "100%", padding: "0.5rem", fontSize: "0.85rem", borderRadius: "6px", border: "1px solid var(--border, #cbd5e1)", marginTop: "3px" }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Target Course:</label>
                  <input
                    type="text"
                    value={formCourse}
                    onChange={(e) => setFormCourse(e.target.value)}
                    placeholder="All Courses or specific (e.g. Lean Six Sigma)"
                    style={{ width: "100%", padding: "0.5rem", fontSize: "0.85rem", borderRadius: "6px", border: "1px solid var(--border, #cbd5e1)", marginTop: "3px" }}
                  />
                </div>
              </div>

              {/* Category */}
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

              {/* Subject Line */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Subject Line:</label>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {["{name}", "{course}", "{batchDate}"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setFormSubject((prev) => prev + " " + p)}
                        style={{ background: "var(--surface2, #f8fafc)", border: "1px solid var(--border, #cbd5e1)", borderRadius: "4px", fontSize: "0.68rem", padding: "1px 6px", cursor: "pointer", color: "#0078d4", fontWeight: 700 }}
                      >
                        + {p}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", fontSize: "0.85rem", borderRadius: "6px", border: "1px solid var(--border, #cbd5e1)" }}
                  required
                />
              </div>

              {/* Body */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Email Body Content:</label>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {["{name}", "{course}", "{fees}", "{phone}", "{counselorName}", "{counselorEmail}"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleInsertPlaceholder(p)}
                        style={{ background: "var(--surface2, #f8fafc)", border: "1px solid var(--border, #cbd5e1)", borderRadius: "4px", fontSize: "0.68rem", padding: "1px 6px", cursor: "pointer", color: "#0078d4", fontWeight: 700 }}
                      >
                        + {p}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  ref={textareaRef}
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  rows={14}
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

              {/* Form Action Buttons */}
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
                  style={{ background: "#0078d4", color: "#ffffff", border: "none", borderRadius: "6px", padding: "0.5rem 1.25rem", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}
                >
                  {formId ? "Save Changes" : "Create Template"}
                </button>
              </div>
            </form>
          ) : currentTemplate ? (
            /* Template Reading & Composing Pane */
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              {/* Workspace Header Strip */}
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
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, color: "var(--text, #0f172a)" }}>
                    {currentTemplate.title}
                  </h2>
                  {currentTemplate.course && currentTemplate.course !== "All Courses" && (
                    <span
                      style={{
                        background: "rgba(0, 120, 212, 0.12)",
                        color: "#0078d4",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        padding: "0.2rem 0.55rem",
                        borderRadius: "12px"
                      }}
                    >
                      🎓 {currentTemplate.course}
                    </span>
                  )}
                  <span
                    style={{
                      background: "var(--surface, #ffffff)",
                      border: "1px solid var(--border, #cbd5e1)",
                      color: "var(--text2, #475569)",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      padding: "0.2rem 0.55rem",
                      borderRadius: "12px"
                    }}
                  >
                    {currentTemplate.category}
                  </span>
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
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                    title="Edit Template"
                  >
                    <span>✏️</span>
                    <span>Edit</span>
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
                      title="Delete Custom Template"
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Recipient Details Strip */}
              <div
                style={{
                  padding: "0.75rem 1.5rem",
                  borderBottom: "1px solid var(--border, #e2e8f0)",
                  background: "var(--surface, #ffffff)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "0.82rem"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
                  <div>
                    <span style={{ color: "var(--text3, #94a3b8)", fontWeight: 700 }}>TO: </span>
                    <strong style={{ color: activeLead?.email ? "#0078d4" : "var(--warn, #d97706)" }}>
                      {activeLead?.email ? activeLead.email : "⚠️ No email address (Click Switch Student to assign)"}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text3, #94a3b8)", fontWeight: 700 }}>STUDENT: </span>
                    <span>{activeLead ? activeLead.name : "Student (Preview)"}</span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => handleCopySubject(currentTemplate)}
                    style={{
                      background: "var(--surface2, #f8fafc)",
                      border: "1px solid var(--border, #cbd5e1)",
                      borderRadius: "6px",
                      padding: "0.3rem 0.65rem",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      fontWeight: 600
                    }}
                  >
                    {copiedType === "subject" ? "✓ Copied" : "📋 Copy Subject"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyBody(currentTemplate)}
                    style={{
                      background: "var(--surface2, #f8fafc)",
                      border: "1px solid var(--border, #cbd5e1)",
                      borderRadius: "6px",
                      padding: "0.3rem 0.65rem",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      fontWeight: 600
                    }}
                  >
                    {copiedType === "body" ? "✓ Copied" : "📋 Copy Body"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyFull(currentTemplate)}
                    style={{
                      background: "var(--surface2, #f8fafc)",
                      border: "1px solid var(--border, #cbd5e1)",
                      borderRadius: "6px",
                      padding: "0.3rem 0.65rem",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      fontWeight: 700,
                      color: "#0078d4"
                    }}
                  >
                    {copiedType === "full" ? "✓ Copied" : "📋 Copy Full Email"}
                  </button>
                </div>
              </div>

              {/* Subject Line Display */}
              <div style={{ padding: "0.75rem 1.5rem", borderBottom: "1px solid var(--border, #e2e8f0)", background: "var(--surface2, #f8fafc)" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--text3, #94a3b8)", marginBottom: "2px" }}>
                  SUBJECT:
                </div>
                <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--text, #0f172a)" }}>
                  {renderEmailTemplate(currentTemplate.subject, activeLead, counselorProfile)}
                </div>
              </div>

              {/* Email Body Reading Pane */}
              <div
                style={{
                  flex: 1,
                  padding: "1.5rem",
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.6,
                  fontSize: "0.88rem",
                  fontFamily: "Segoe UI, -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
                  color: "var(--text, #0f172a)"
                }}
              >
                {renderEmailTemplate(currentTemplate.body, activeLead, counselorProfile)}
              </div>

              {/* BOTTOM ACTION BAR */}
              <div
                style={{
                  padding: "1rem 1.5rem",
                  borderTop: "1px solid var(--border, #e2e8f0)",
                  background: "var(--surface2, #f8fafc)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem"
                }}
              >
                <div style={{ fontSize: "0.76rem", color: "var(--text3, #94a3b8)" }}>
                  💡 1-Click Outlook Compose launches your active Microsoft 365 session and pre-fills all content automatically.
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  {/* Fallback Gmail */}
                  <button
                    type="button"
                    onClick={() => handleOpenInGmail(currentTemplate)}
                    style={{
                      background: "var(--surface, #ffffff)",
                      border: "1px solid var(--border, #cbd5e1)",
                      borderRadius: "8px",
                      padding: "0.55rem 0.9rem",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--text2, #475569)",
                      cursor: "pointer"
                    }}
                    title="Open in Gmail Web (fallback)"
                  >
                    ✉️ Gmail Fallback
                  </button>

                  {/* Mailto Desktop */}
                  <a
                    href={getMailtoUrl({
                      to: activeLead?.email || "",
                      subject: renderEmailTemplate(currentTemplate.subject, activeLead, counselorProfile),
                      body: renderEmailTemplate(currentTemplate.body, activeLead, counselorProfile)
                    })}
                    style={{
                      background: "var(--surface, #ffffff)",
                      border: "1px solid var(--border, #cbd5e1)",
                      borderRadius: "8px",
                      padding: "0.55rem 0.9rem",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--text2, #475569)",
                      textDecoration: "none"
                    }}
                    title="Open in Default Desktop Client"
                  >
                    ✉️ Mailto
                  </a>

                  {/* PRIMARY: Open in Outlook Web */}
                  <button
                    type="button"
                    onClick={() => handleOpenInOutlook(currentTemplate)}
                    style={{
                      background: "linear-gradient(135deg, #0078d4 0%, #005a9e 100%)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "0.6rem 1.4rem",
                      fontSize: "0.9rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      boxShadow: "0 4px 12px rgba(0, 120, 212, 0.35)"
                    }}
                  >
                    <span style={{ fontSize: "1.1rem" }}>🚀</span>
                    <span>Open in Outlook (1-Click)</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "4rem 2rem", color: "var(--text3, #94a3b8)" }}>
              Select a template on the left to view, personalize, and compose in Outlook.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
