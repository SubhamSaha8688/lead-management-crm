import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import CourseSelector from "../components/CourseSelector";

export default function AddLead({ onLeadAdded }) {
  const navigate = useNavigate();

  // Mode: "quick" (speed dial fast entry) vs "detailed" (full form + AI OCR)
  const [formMode, setFormMode] = useState("quick");

  // Existing leads for duplicate phone detection
  const [existingLeads, setExistingLeads] = useState([]);

  // Form state
  const [leadId, setLeadId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [quality, setQuality] = useState("Warm Lead");
  const [priority, setPriority] = useState(3);
  const [source, setSource] = useState("Website");
  const [stage, setStage] = useState("New");

  // Quick mode course field
  const [quickCourseName, setQuickCourseName] = useState("");

  const [enquiryDate, setEnquiryDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("11:00");

  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [discountType, setDiscountType] = useState("none");
  const [discountValue, setDiscountValue] = useState(0);

  const [initialCommentText, setInitialCommentText] = useState("");
  const [initialCommentOutcome, setInitialCommentOutcome] = useState("Connected — Interested");
  const [reminderNote, setReminderNote] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [nextAction, setNextAction] = useState("");

  // Submission & UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // AI Screenshot Extraction States
  const [extracting, setExtracting] = useState(false);
  const [extractSuccessMsg, setExtractSuccessMsg] = useState("");
  const [pastedImagePreview, setPastedImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  // Smart next ID generator: finds the highest numeric suffix in existing leads without "LD-" prefix
  const generateNextLeadId = (list) => {
    const leadsList = list || existingLeads;
    let maxNum = 0;
    leadsList.forEach((l) => {
      if (l.leadId) {
        const m = l.leadId.match(/(\d+)/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxNum) maxNum = n;
        }
      }
    });
    return maxNum > 0 ? String(maxNum + 1) : "";
  };

  // Fetch existing leads on mount to check Lead ID and Phone duplicates
  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const res = await axios.get("/api/leads");
        if (res.data && res.data.success) {
          const data = res.data.data;
          setExistingLeads(data);
        }
      } catch (e) {
        console.warn("Could not fetch existing leads:", e);
      }
    };
    fetchExisting();
  }, []);

  const readFileAsDataURL = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Process Screenshot file or blob with Gemini Vision AI
  const handleImageExtract = async (file) => {
    if (!file) return;
    try {
      setExtracting(true);
      setError("");
      setExtractSuccessMsg("");
      // Keep user in whichever formMode they are currently in (quick or detailed)

      const base64Data = await readFileAsDataURL(file);
      setPastedImagePreview(base64Data);

      const res = await axios.post("/api/leads/extract-from-image", {
        image: base64Data,
        imageBase64: base64Data
      });

      if (res.data && res.data.success) {
        const d = res.data.data;
        if (d.name) setName(d.name);
        if (d.phone) setPhone(d.phone);
        if (d.email) setEmail(d.email);
        if (d.leadId) {
          const cleanId = String(d.leadId).replace(/^LD-?/i, "").trim();
          setLeadId(cleanId);
        }
        if (d.source) setSource(d.source);
        if (d.quality) setQuality(d.quality);
        if (d.stage) setStage(d.stage);
        if (d.priority) setPriority(d.priority);
        if (d.enquiryDate) setEnquiryDate(d.enquiryDate.split("T")[0]);
        if (d.followUpDate) setFollowUpDate(d.followUpDate.split("T")[0]);
        if (d.followUpTime) setFollowUpTime(d.followUpTime);
        if (d.reminderNote) setReminderNote(d.reminderNote);
        if (d.initialCommentText) setInitialCommentText(d.initialCommentText);

        const course = d.courseName || d.course;
        if (course) {
          setQuickCourseName(course);
          setEnrolledCourses([{ courseId: "CR-" + Date.now(), courseName: course, fee: 0 }]);
        } else if (d.enrolledCourses && Array.isArray(d.enrolledCourses) && d.enrolledCourses.length > 0) {
          setEnrolledCourses(d.enrolledCourses);
          if (d.enrolledCourses[0]?.courseName) {
            setQuickCourseName(d.enrolledCourses[0].courseName);
          }
        }

        setExtractSuccessMsg("✓ Lead information automatically parsed from screenshot!");
      } else {
        setError(res.data?.message || "Failed to scan screenshot.");
      }
    } catch (err) {
      console.error("AI extraction error:", err);
      setError(err.response?.data?.message || err.message || "Failed to scan screenshot.");
    } finally {
      setExtracting(false);
    }
  };

  // Global paste event listener for seamless Ctrl+V screenshot paste
  useEffect(() => {
    const handlePaste = (e) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.type && item.type.indexOf("image") !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            handleImageExtract(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  // Keyboard shortcut: Ctrl + Enter / Cmd + Enter anywhere to submit immediately!
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit(e);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [name, phone, email, leadId, quality, priority, source, quickCourseName, formMode, enrolledCourses]);

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type && file.type.startsWith("image/")) {
        handleImageExtract(file);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Check Duplicate Lead ID
  const duplicateLeadIdLead = React.useMemo(() => {
    if (!leadId.trim()) return null;
    return existingLeads.find(
      (l) => l.leadId && l.leadId.trim().toLowerCase() === leadId.trim().toLowerCase()
    );
  }, [leadId, existingLeads]);

  // Check Duplicate Phone
  const duplicatePhoneLead = React.useMemo(() => {
    if (!phone || phone.trim().length < 6) return null;
    const cleanCurrent = phone.replace(/[^0-9]/g, "");
    return existingLeads.find((l) => {
      const digits = (l.phone || "").replace(/[^0-9]/g, "");
      return digits && digits === cleanCurrent;
    });
  }, [phone, existingLeads]);

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Student Name is required.");
      return;
    }

    if (duplicateLeadIdLead) {
      setError(`Cannot create lead: Lead ID "${leadId}" is already used by ${duplicateLeadIdLead.name}. Please enter a unique Lead ID.`);
      return;
    }
    if (duplicatePhoneLead) {
      setError(`Cannot create lead: Phone number is already registered to Lead ${duplicatePhoneLead.leadId} (${duplicatePhoneLead.name}).`);
      return;
    }

    const cleanLeadId = leadId.trim().replace(/^LD-?/i, "");
    const finalLeadId = cleanLeadId || generateNextLeadId();

    let finalCourses = enrolledCourses;
    if (formMode === "quick" && quickCourseName.trim()) {
      finalCourses = [{ courseId: "CR-" + Date.now(), courseName: quickCourseName.trim(), fee: 0 }];
    }

    try {
      setLoading(true);

      const payload = {
        leadId: finalLeadId,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        quality,
        priority: Number(priority),
        source,
        stage,
        enquiryDate: enquiryDate ? new Date(enquiryDate) : new Date(),
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        followUpTime: followUpTime.trim(),
        enrolledCourses: finalCourses,
        discountType,
        discountValue: Number(discountValue) || 0,
        initialCommentText: initialCommentText.trim(),
        initialCommentOutcome: initialCommentText.trim() ? initialCommentOutcome : "",
        reminderNote: reminderNote.trim(),
        lostReason: quality === "Not Interested" ? lostReason.trim() : "",
        nextAction: nextAction.trim()
      };

      const res = await axios.post("/api/leads", payload);

      if (res.data && res.data.success) {
        if (onLeadAdded) onLeadAdded();
        const createdId = res.data.data._id;
        navigate(`/leads/${createdId}`);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to create lead. Please check the fields."
      );
    } finally {
      setLoading(false);
    }
  };

  const outcomeOptions = [
    "Connected — Interested",
    "Connected — Call Back",
    "Not Connected",
    "Switched Off",
    "Voicemail",
    "Rescheduled",
    "Not Interested"
  ];

  // Reusable AI Screenshot Dropzone available in BOTH Quick Speed Add and Detailed Form
  const renderScreenshotDropzone = (isQuick = false) => (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      style={{
        border: extracting
          ? "2px dashed #10b981"
          : isQuick
          ? "2px dashed rgba(16, 185, 129, 0.45)"
          : "2px dashed var(--border)",
        borderRadius: "var(--radius, 10px)",
        background: extracting
          ? "rgba(16, 185, 129, 0.08)"
          : isQuick
          ? "linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(5, 150, 105, 0.02) 100%)"
          : "var(--surface)",
        padding: isQuick ? "1rem 1.25rem" : "1.25rem 1.5rem",
        marginBottom: isQuick ? "1.25rem" : "1.5rem",
        transition: "all 0.2s ease",
        boxShadow: extracting
          ? "0 0 0 4px rgba(16, 185, 129, 0.18)"
          : isQuick
          ? "0 2px 8px rgba(16, 185, 129, 0.08)"
          : "var(--shadow-sm)"
      }}
    >
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleImageExtract(e.target.files[0]);
          }
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.85rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
          <div
            style={{
              fontSize: "1.75rem",
              width: "48px",
              height: "48px",
              borderRadius: "10px",
              background: isQuick ? "rgba(16, 185, 129, 0.15)" : "var(--surface2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: isQuick ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid var(--border)"
            }}
          >
            {extracting ? "⏳" : "📸"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, fontSize: "1.02rem", color: "var(--text)" }}>
                {isQuick ? "⚡ 1-Click AI Screenshot Auto-Fill" : "AI Screenshot Auto-Fill"}
              </span>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  padding: "0.15rem 0.5rem",
                  borderRadius: "9999px",
                  background: isQuick ? "#10b981" : "var(--accent)",
                  color: "#ffffff"
                }}
              >
                Ctrl + V
              </span>
              {isQuick && (
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: "#059669",
                    background: "rgba(16, 185, 129, 0.15)",
                    padding: "1px 6px",
                    borderRadius: "6px"
                  }}
                >
                  Populates Quick Form in 2s
                </span>
              )}
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--text2)", marginTop: "0.2rem" }}>
              {extracting
                ? "Scanning screenshot with Gemini AI... (Extracting Lead ID, Name, Phone, Email, Course, Follow-up)"
                : "Copy screenshot of the lead modal (Win + Shift + S) and press Ctrl+V anywhere or drop image here!"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={extracting}
            style={{ fontWeight: 700, fontSize: "0.82rem" }}
          >
            📁 Browse Image
          </button>
          {pastedImagePreview && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setPastedImagePreview(null);
                setExtractSuccessMsg("");
              }}
              style={{ fontSize: "0.82rem" }}
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {pastedImagePreview && (
        <div
          style={{
            marginTop: "0.85rem",
            padding: "0.65rem 0.85rem",
            borderRadius: "8px",
            background: "var(--surface2)",
            display: "flex",
            alignItems: "center",
            gap: "0.85rem",
            border: "1px solid var(--border)"
          }}
        >
          <img
            src={pastedImagePreview}
            alt="Pasted Lead Screenshot"
            style={{
              maxHeight: "70px",
              maxWidth: "120px",
              objectFit: "contain",
              borderRadius: "4px",
              border: "1px solid var(--border)"
            }}
          />
          <div style={{ flex: 1, fontSize: "0.85rem" }}>
            {extracting ? (
              <span style={{ color: isQuick ? "#059669" : "var(--accent)", fontWeight: 700 }}>
                ⚡ AI is analyzing screenshot and extracting student details...
              </span>
            ) : extractSuccessMsg ? (
              <span style={{ color: "#10b981", fontWeight: 800 }}>
                {extractSuccessMsg}
              </span>
            ) : (
              <span style={{ color: "var(--text2)" }}>
                Pasted screenshot loaded.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="page" style={{ maxWidth: "880px" }}>
      {/* Top Header */}
      <div style={{ marginBottom: "1.25rem" }}>
        <Link
          to="/"
          style={{
            fontSize: "0.88rem",
            color: "var(--accent)",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
            marginBottom: "0.4rem"
          }}
        >
          ← Back to Dashboard
        </Link>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text)", margin: 0 }}>
          ➕ Add New Sales Lead
        </h1>
        <p style={{ color: "var(--text2)", fontSize: "0.88rem", marginTop: "4px" }}>
          Quick speed dial entry or comprehensive form with AI OCR screenshot scanning.
        </p>
      </div>

      {/* MODE SWITCHER TABS */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1.5rem",
          background: "var(--surface2, #f1f5f9)",
          padding: "0.35rem",
          borderRadius: "10px",
          border: "1px solid var(--border, #cbd5e1)"
        }}
      >
        <button
          type="button"
          onClick={() => setFormMode("quick")}
          style={{
            flex: 1,
            padding: "0.65rem 1rem",
            borderRadius: "8px",
            border: "none",
            background: formMode === "quick" ? "var(--surface, #ffffff)" : "transparent",
            color: formMode === "quick" ? "var(--text, #0f172a)" : "var(--text2, #475569)",
            fontWeight: 800,
            fontSize: "0.9rem",
            cursor: "pointer",
            boxShadow: formMode === "quick" ? "var(--shadow-sm, 0 2px 4px rgba(0,0,0,0.08))" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            transition: "all 0.15s ease"
          }}
        >
          <span>⚡</span>
          <span>Quick Speed Add (3 Seconds)</span>
          <span style={{ fontSize: "0.7rem", background: "#10b981", color: "#ffffff", padding: "1px 6px", borderRadius: "10px", fontWeight: 800 }}>
            Recommended
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFormMode("detailed")}
          style={{
            flex: 1,
            padding: "0.65rem 1rem",
            borderRadius: "8px",
            border: "none",
            background: formMode === "detailed" ? "var(--surface, #ffffff)" : "transparent",
            color: formMode === "detailed" ? "var(--text, #0f172a)" : "var(--text2, #475569)",
            fontWeight: 800,
            fontSize: "0.9rem",
            cursor: "pointer",
            boxShadow: formMode === "detailed" ? "var(--shadow-sm, 0 2px 4px rgba(0,0,0,0.08))" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            transition: "all 0.15s ease"
          }}
        >
          <span>📋</span>
          <span>Detailed Form & AI Screenshot</span>
        </button>
      </div>

      {error && (
        <div
          style={{
            background: "var(--danger-bg, #fee2e2)",
            color: "var(--danger, #dc2626)",
            border: "1px solid var(--danger, #dc2626)",
            borderRadius: "var(--radius, 8px)",
            padding: "0.85rem 1rem",
            marginBottom: "1.25rem",
            fontWeight: 600,
            fontSize: "0.9rem"
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. SPEED ADD MODE (MINIMALIST 3-SECOND CREATION)          */}
      {/* ======================================================== */}
      {formMode === "quick" ? (
        <form onSubmit={handleSubmit}>
          {renderScreenshotDropzone(true)}

          <div
            className="card-padded"
            style={{
              marginBottom: "1.25rem",
              border: "2px solid #10b981",
              boxShadow: "0 8px 24px rgba(16, 185, 129, 0.12)"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.2rem",
                flexWrap: "wrap",
                gap: "0.5rem"
              }}
            >
              <div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: "var(--text)" }}>
                  ⚡ Speed Lead Entry
                </h2>
                <p style={{ fontSize: "0.82rem", color: "var(--text3)", margin: "3px 0 0 0" }}>
                  Fill only Name, Phone & Email. You can edit courses, fees and details later directly on the lead page!
                </p>
              </div>

              <span
                style={{
                  fontSize: "0.75rem",
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#059669",
                  fontWeight: 800,
                  padding: "4px 10px",
                  borderRadius: "20px",
                  border: "1px solid rgba(16, 185, 129, 0.3)"
                }}
              >
                Press Ctrl + Enter to Save
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
              {/* Full Name */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontWeight: 800, fontSize: "0.88rem" }}>Student Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                  style={{
                    fontSize: "1rem",
                    padding: "0.7rem 0.9rem",
                    borderRadius: "8px",
                    border: "1.5px solid var(--border)",
                    fontWeight: 600,
                    width: "100%"
                  }}
                />
              </div>

              {/* Phone */}
              <div className="form-group" style={{ margin: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                  <label style={{ margin: 0, fontWeight: 800, fontSize: "0.88rem" }}>Phone Number *</label>
                  {duplicatePhoneLead && (
                    <span style={{ fontSize: "0.72rem", color: "var(--danger)", fontWeight: 700 }}>
                      ⚠️ Duplicate Phone ({duplicatePhoneLead.name})
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  style={{
                    fontSize: "1rem",
                    padding: "0.7rem 0.9rem",
                    borderRadius: "8px",
                    border: duplicatePhoneLead ? "2px solid var(--danger)" : "1.5px solid var(--border)",
                    fontWeight: 600,
                    width: "100%"
                  }}
                />
              </div>

              {/* Email */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontWeight: 700, fontSize: "0.85rem" }}>Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="e.g. rahul@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    fontSize: "0.95rem",
                    padding: "0.7rem 0.9rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    width: "100%"
                  }}
                />
              </div>

              {/* Lead ID */}
              <div className="form-group" style={{ margin: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                  <label style={{ margin: 0, fontWeight: 700, fontSize: "0.85rem" }}>Lead ID</label>
                  <button
                    type="button"
                    onClick={() => setLeadId(generateNextLeadId())}
                    style={{ background: "none", border: "none", color: "var(--accent)", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", padding: 0 }}
                  >
                    ↻ Generate ID
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. 9621128"
                  value={leadId}
                  onChange={(e) => setLeadId(e.target.value.replace(/^LD-?/i, ""))}
                  style={{
                    fontSize: "0.95rem",
                    padding: "0.7rem 0.9rem",
                    borderRadius: "8px",
                    border: duplicateLeadIdLead ? "2px solid var(--danger)" : "1px solid var(--border)",
                    width: "100%"
                  }}
                />
              </div>
            </div>

            {/* Quick Pills Row: Course & Quality */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "1rem",
                marginBottom: "1.25rem",
                paddingTop: "0.9rem",
                borderTop: "1px dashed var(--border)"
              }}
            >
              {/* Quick Course */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, marginBottom: "0.3rem", display: "block" }}>
                  Course Interested in (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Data Science, German Language..."
                  value={quickCourseName}
                  onChange={(e) => setQuickCourseName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.55rem 0.85rem",
                    fontSize: "0.88rem",
                    borderRadius: "6px",
                    border: "1px solid var(--border)"
                  }}
                />
              </div>

              {/* Quick Quality */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, marginBottom: "0.35rem", display: "block" }}>
                  Quality Rating
                </label>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  {["Warm Lead", "Hot Lead", "Cold Lead", "Voicemail"].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuality(q)}
                      style={{
                        padding: "0.4rem 0.8rem",
                        borderRadius: "6px",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        border: "1px solid",
                        borderColor: quality === q ? "#10b981" : "var(--border)",
                        background: quality === q ? "#10b981" : "var(--surface2)",
                        color: quality === q ? "#ffffff" : "var(--text)",
                        cursor: "pointer"
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Submit Action Bar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
                flexWrap: "wrap",
                paddingTop: "0.75rem",
                borderTop: "1px solid var(--border)"
              }}
            >
              <button
                type="button"
                onClick={() => setFormMode("detailed")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--accent)",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  textDecoration: "underline"
                }}
              >
                Need detailed form? (Course fees, multiple courses, remarks) →
              </button>

              <button
                type="submit"
                disabled={loading || Boolean(duplicatePhoneLead) || Boolean(duplicateLeadIdLead)}
                style={{
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "0.8rem 1.8rem",
                  fontSize: "1rem",
                  fontWeight: 800,
                  cursor: loading || duplicatePhoneLead || duplicateLeadIdLead ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
                  opacity: loading || duplicatePhoneLead || duplicateLeadIdLead ? 0.6 : 1
                }}
              >
                <span>{loading ? "⏳ Creating Lead..." : "⚡ Save Lead & Open Page"}</span>
                <span style={{ fontSize: "0.85rem", opacity: 0.9 }}>↵</span>
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* ======================================================== */
        /* 2. DETAILED FORM (FULL ADVANCED & AI OCR)                */
        /* ======================================================== */
        <div>
          {renderScreenshotDropzone(false)}

          <form onSubmit={handleSubmit}>
            {/* SECTION 1: CONTACT INFORMATION */}
            <div className="card-padded" style={{ marginBottom: "1.25rem" }}>
              <h2 className="section-title">👤 Contact Information</h2>

              <div className="form-row">
                <div className="form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                    <label style={{ margin: 0 }}>Lead ID</label>
                    <button
                      type="button"
                      onClick={() => setLeadId(generateNextLeadId())}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--accent)",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: 0
                      }}
                      title="Auto-generate the next available Lead ID"
                    >
                      ↻ Auto-generate ID
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. 9621128"
                    value={leadId}
                    onChange={(e) => setLeadId(e.target.value.replace(/^LD-?/i, ""))}
                    style={{
                      width: "100%",
                      borderColor: duplicateLeadIdLead
                        ? "var(--danger)"
                        : leadId.trim().length >= 2
                        ? "var(--success)"
                        : undefined
                    }}
                  />
                  {duplicateLeadIdLead && (
                    <span style={{ fontSize: "0.78rem", color: "var(--danger)", fontWeight: 600, display: "inline-block", marginTop: "0.25rem" }}>
                      🚫 Already used by {duplicateLeadIdLead.name}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    placeholder="Student's Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{
                      borderColor: duplicatePhoneLead ? "var(--danger)" : undefined
                    }}
                  />
                  {duplicatePhoneLead && (
                    <span style={{ fontSize: "0.78rem", color: "var(--danger)", fontWeight: 600, display: "inline-block", marginTop: "0.25rem" }}>
                      ⚠️ Phone registered to {duplicatePhoneLead.name}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="student@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: STATUS & SALES ATTRIBUTES */}
            <div className="card-padded" style={{ marginBottom: "1.25rem" }}>
              <h2 className="section-title">🎯 Status & Pipeline</h2>

              <div className="form-row">
                <div className="form-group">
                  <label>Quality Rating</label>
                  <select value={quality} onChange={(e) => setQuality(e.target.value)}>
                    <option value="Hot Lead">🔥 Hot Lead</option>
                    <option value="Warm Lead">🟡 Warm Lead</option>
                    <option value="Cold Lead">❄️ Cold Lead</option>
                    <option value="Call Again">📞 Call Again</option>
                    <option value="Voicemail">🎙️ Voicemail</option>
                    <option value="Converted/Customer">🎉 Converted / Customer</option>
                    <option value="Not Interested">🚫 Not Interested</option>
                    <option value="Wrong number">❌ Wrong Number</option>
                    <option value="Wrong Mail">❌ Wrong Email</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority (1 = Highest, 5 = Lowest)</label>
                  <select value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
                    <option value={1}>P1 - Highest</option>
                    <option value={2}>P2 - High</option>
                    <option value={3}>P3 - Medium</option>
                    <option value={4}>P4 - Low</option>
                    <option value={5}>P5 - Lowest</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Lead Source</label>
                  <select value={source} onChange={(e) => setSource(e.target.value)}>
                    <option value="Website">Website</option>
                    <option value="Instagram">Instagram</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Google Ads">Google Ads</option>
                    <option value="Reference / Referral">Reference / Referral</option>
                    <option value="Cold Call">Cold Call</option>
                    <option value="Walk-in">Walk-in</option>
                    <option value="Email Campaign">Email Campaign</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Pipeline Stage</label>
                  <select value={stage} onChange={(e) => setStage(e.target.value)}>
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Interested">Interested</option>
                    <option value="Negotiation">Negotiation</option>
                    <option value="Converted">Converted</option>
                    <option value="Lost">Lost</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Enquiry Date</label>
                  <input
                    type="date"
                    value={enquiryDate}
                    onChange={(e) => setEnquiryDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Next Follow-Up Date</label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Follow-Up Time</label>
                  <input
                    type="time"
                    value={followUpTime}
                    onChange={(e) => setFollowUpTime(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: COURSE SELECTOR */}
            <div className="card-padded" style={{ marginBottom: "1.25rem" }}>
              <h2 className="section-title">📚 Enrolled Courses & Fee Calculator</h2>
              <CourseSelector
                selectedCourses={enrolledCourses}
                onChangeCourses={setEnrolledCourses}
                discountType={discountType}
                onChangeDiscountType={setDiscountType}
                discountValue={discountValue}
                onChangeDiscountValue={setDiscountValue}
              />
            </div>

            {/* SECTION 4: STRATEGY & NOTES */}
            <div className="card-padded" style={{ marginBottom: "1.25rem" }}>
              <h2 className="section-title">📝 Strategy & Interactions</h2>

              <div className="form-group">
                <label>Next Immediate Action</label>
                <input
                  type="text"
                  placeholder="e.g. Send syllabus brochure on WhatsApp"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Pinned Reminder Note</label>
                <input
                  type="text"
                  placeholder="e.g. Call after 5th of month (salary day). Wants weekend batch."
                  value={reminderNote}
                  onChange={(e) => setReminderNote(e.target.value)}
                />
              </div>

              <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
                <label style={{ fontWeight: 700, fontSize: "0.9rem", display: "block", marginBottom: "0.5rem" }}>
                  First Interaction Log (Appended to Permanent History)
                </label>

                <div style={{ marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    {outcomeOptions.map((outcome) => (
                      <button
                        key={outcome}
                        type="button"
                        className={`pill-btn ${initialCommentOutcome === outcome ? "active" : ""}`}
                        onClick={() => setInitialCommentOutcome(outcome)}
                      >
                        {outcome}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <textarea
                    placeholder="Write summary of first call or enquiry message..."
                    value={initialCommentText}
                    onChange={(e) => setInitialCommentText(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* SUBMIT BUTTONS */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate("/")}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || Boolean(duplicateLeadIdLead) || Boolean(duplicatePhoneLead)}
              >
                {loading ? "Creating Lead..." : "Save & Open Lead"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
