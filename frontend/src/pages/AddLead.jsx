import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import CourseSelector from "../components/CourseSelector";

export default function AddLead({ onLeadAdded }) {
  const navigate = useNavigate();

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

  // Image optimization: Preserves 100% lossless PNG for standard screenshots (< 3.5MB)
  // Only downscales abnormally huge images (> 3.5MB) to keep small text razor sharp
  const optimizeImageForOCR = (dataUrl, maxDim = 1920, quality = 0.95) => {
    return new Promise((resolve) => {
      // If image base64 is under ~3.5MB (standard clipboard screenshot), keep 100% original lossless pixels
      if (dataUrl.length < 3.5 * 1024 * 1024) {
        return resolve(dataUrl);
      }

      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width <= maxDim && height <= maxDim) {
          return resolve(dataUrl);
        }

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Process Screenshot file or blob with Gemini Vision AI
  const handleImageExtract = async (file) => {
    if (!file) return;
    try {
      setExtracting(true);
      setError("");
      setExtractSuccessMsg("");

      // 1. Read file to Base64
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
      });
      reader.readAsDataURL(file);
      const rawBase64 = await base64Promise;

      // Fast in-browser compression to ensure lightning-fast OCR
      const optimizedBase64 = await optimizeImageForOCR(rawBase64);

      setPastedImagePreview(optimizedBase64);

      // 2. Call backend Gemini AI extraction endpoint
      const res = await axios.post("/api/leads/extract-from-image", {
        image: optimizedBase64
      });

      if (res.data && res.data.success) {
        const d = res.data.data;
        let filledCount = 0;

        if (d.leadId) {
          setLeadId(String(d.leadId).trim());
          filledCount++;
        }
        if (d.name && d.name !== "null") {
          setName(d.name.trim());
          filledCount++;
        }

        // Robust phone extraction across all model key variants
        const candidatePhone =
          d.phone ||
          d.mobile ||
          d.phoneNumber ||
          d.mobileNumber ||
          d.contact ||
          d.mobile_no ||
          d.primaryPhone ||
          d.primaryMobile ||
          "";

        let cleanP = String(candidatePhone).replace(/\D/g, "");
        if (cleanP.length === 12 && cleanP.startsWith("91")) {
          cleanP = cleanP.slice(2);
        } else if (cleanP.length === 11 && cleanP.startsWith("0")) {
          cleanP = cleanP.slice(1);
        } else if (cleanP.length > 10 && cleanP.startsWith("91")) {
          cleanP = cleanP.slice(cleanP.length - 10);
        }

        if (cleanP && cleanP !== "null") {
          setPhone(cleanP);
          filledCount++;
        }
        if (d.email && d.email !== "null") {
          setEmail(d.email.trim());
          filledCount++;
        }
        if (d.quality) {
          setQuality(d.quality);
          filledCount++;
        }
        if (d.stage) {
          setStage(d.stage);
          filledCount++;
        }
        if (d.followUpDate) {
          setFollowUpDate(d.followUpDate);
          filledCount++;
        }
        if (d.followUpTime) {
          setFollowUpTime(d.followUpTime);
          filledCount++;
        }
        if (d.reminderNote && d.reminderNote !== "null") {
          setReminderNote(d.reminderNote.trim());
          filledCount++;
        }

        // Auto-populate course
        if (d.courseName && d.courseName.trim() && d.courseName !== "null") {
          setEnrolledCourses([
            {
              courseId: "CRS-AI-" + Math.floor(100 + Math.random() * 900),
              courseName: d.courseName.trim(),
              fee: 0
            }
          ]);
          filledCount++;
        }

        setExtractSuccessMsg(`✨ AI successfully extracted ${filledCount} fields from your screenshot! Review and edit below before saving.`);
      }
    } catch (err) {
      console.error("AI Screenshot extraction failed:", err);
      const msg = err.response?.data?.message || err.message;
      setError("AI Screenshot scan failed: " + msg);
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

  // Drag and drop handlers
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

  // Smart next ID generator: finds the highest numeric suffix in existing leads
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
    return `LD-${String(maxNum + 1).padStart(3, "0")}`;
  };

  // Fetch existing leads on mount to check Lead ID and Phone duplicates
  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const res = await axios.get("/api/leads");
        if (res.data && res.data.success) {
          const data = res.data.data;
          setExistingLeads(data);
          // Suggest a guaranteed unique leadId
          if (!leadId) {
            setLeadId(generateNextLeadId(data));
          }
        }
      } catch (e) {
        console.warn("Could not fetch existing leads:", e);
      }
    };
    fetchExisting();
  }, []);

  // Check Duplicate Lead ID
  const duplicateLeadIdLead = React.useMemo(() => {
    if (!leadId || !leadId.trim()) return null;
    const currentNorm = leadId.trim().toLowerCase();
    return existingLeads.find(
      (l) => l.leadId && l.leadId.trim().toLowerCase() === currentNorm
    );
  }, [leadId, existingLeads]);

  // Check Duplicate Phone
  const duplicatePhoneLead = React.useMemo(() => {
    if (!phone || phone.trim().length < 6) return null;
    const cleanCurrent = phone.replace(/[^0-9]/g, "");
    if (!cleanCurrent) return null;

    return existingLeads.find((l) => {
      if (!l.phone) return false;
      const cleanExisting = l.phone.replace(/[^0-9]/g, "");
      return cleanExisting && cleanExisting === cleanCurrent;
    });
  }, [phone, existingLeads]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!leadId.trim()) {
      setError("Lead ID is required.");
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
    if (!name.trim()) {
      setError("Lead Name is required.");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        leadId: leadId.trim(),
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
        enrolledCourses,
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
        // Redirect to Lead Detail of the created lead
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

  return (
    <div className="page" style={{ maxWidth: "880px" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link
          to="/"
          style={{
            fontSize: "0.88rem",
            color: "var(--accent)",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
            marginBottom: "0.5rem"
          }}
        >
          ← Back to Dashboard
        </Link>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text)" }}>
          ➕ Add New Sales Lead
        </h1>
        <p style={{ color: "var(--text2)", fontSize: "0.9rem" }}>
          Fill in student contact details, enrolled course options, and next follow-up appointment.
        </p>
      </div>

      {/* AI SCREENSHOT PASTE ZONE */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          border: extracting ? "2px dashed var(--accent)" : "2px dashed var(--border)",
          borderRadius: "var(--radius)",
          background: extracting ? "rgba(99, 102, 241, 0.05)" : "var(--surface)",
          padding: "1.25rem 1.5rem",
          marginBottom: "1.5rem",
          transition: "all 0.2s ease",
          boxShadow: extracting ? "0 0 0 4px rgba(99, 102, 241, 0.15)" : "var(--shadow-sm)"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                fontSize: "2rem",
                width: "52px",
                height: "52px",
                borderRadius: "var(--radius)",
                background: "var(--surface2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--border)"
              }}
            >
              {extracting ? "⏳" : "📸"}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text)" }}>
                  AI Screenshot Auto-Fill
                </span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "0.15rem 0.5rem",
                    borderRadius: "9999px",
                    background: "var(--accent)",
                    color: "#ffffff"
                  }}
                >
                  Ctrl + V
                </span>
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text2)", marginTop: "0.2rem" }}>
                {extracting
                  ? "Scanning screenshot with Gemini 3.6 Flash AI... (Extracting Lead ID, Name, Phone, Email, Course, Follow-up)"
                  : "Copy screenshot of the Henry Harvin lead modal (Win + Shift + S) and press Ctrl+V anywhere to auto-fill!"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
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
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={extracting}
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
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {/* Thumbnail Preview & Success Notification */}
        {pastedImagePreview && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              marginTop: "1rem",
              paddingTop: "0.85rem",
              borderTop: "1px solid var(--border)"
            }}
          >
            <img
              src={pastedImagePreview}
              alt="Pasted Lead Screenshot"
              style={{
                height: "64px",
                maxWidth: "140px",
                objectFit: "cover",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)"
              }}
            />
            <div style={{ flex: 1, fontSize: "0.85rem" }}>
              {extracting ? (
                <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                  ✨ Analyzing image with Gemini Vision AI... please wait ~1-2 seconds.
                </span>
              ) : extractSuccessMsg ? (
                <span style={{ color: "var(--success)", fontWeight: 700 }}>
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

      {error && (
        <div
          style={{
            background: "var(--danger-bg)",
            color: "var(--danger)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--radius)",
            padding: "0.85rem 1rem",
            marginBottom: "1.25rem",
            fontWeight: 600,
            fontSize: "0.9rem"
          }}
        >
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* SECTION 1: CONTACT INFORMATION */}
        <div className="card-padded" style={{ marginBottom: "1.25rem" }}>
          <h2 className="section-title">👤 Contact Information</h2>

          <div className="form-row">
            {/* Lead ID with Real-Time Duplicate Alert */}
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                <label style={{ margin: 0 }}>Lead ID *</label>
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

              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder="e.g. LD-001"
                  value={leadId}
                  onChange={(e) => setLeadId(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    borderColor: duplicateLeadIdLead
                      ? "var(--danger)"
                      : leadId.trim().length >= 2
                      ? "var(--success)"
                      : undefined,
                    boxShadow: duplicateLeadIdLead
                      ? "0 0 0 3px rgba(239, 68, 68, 0.15)"
                      : undefined
                  }}
                />
                {leadId.trim().length >= 2 && (
                  <span
                    style={{
                      position: "absolute",
                      right: "0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: "0.9rem"
                    }}
                  >
                    {duplicateLeadIdLead ? "❌" : "✅"}
                  </span>
                )}
              </div>

              {duplicateLeadIdLead ? (
                <div
                  style={{
                    marginTop: "0.45rem",
                    padding: "0.55rem 0.75rem",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--danger-bg)",
                    border: "1px solid var(--danger)",
                    color: "var(--danger)",
                    fontSize: "0.82rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.5rem"
                  }}
                >
                  <div>
                    <strong>🚫 Lead ID Already In Use:</strong> Belongs to{" "}
                    <strong>{duplicateLeadIdLead.name}</strong> ({duplicateLeadIdLead.stage})
                  </div>
                  <Link
                    to={`/leads/${duplicateLeadIdLead._id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "var(--danger)",
                      fontWeight: 700,
                      textDecoration: "underline",
                      whiteSpace: "nowrap"
                    }}
                  >
                    View Lead ↗
                  </Link>
                </div>
              ) : leadId.trim().length >= 2 ? (
                <span style={{ fontSize: "0.78rem", color: "var(--success)", fontWeight: 600, display: "inline-block", marginTop: "0.25rem" }}>
                  ✓ Lead ID is available
                </span>
              ) : (
                <span className="form-help">Must be a unique identifier</span>
              )}
            </div>

            <div className="form-group" style={{ flex: 2 }}>
              <label>Full Name *</label>
              <input
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            {/* Phone Number with Real-Time Duplicate Alert */}
            <div className="form-group">
              <label>Phone Number</label>
              <div style={{ position: "relative" }}>
                <input
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{
                    width: "100%",
                    borderColor: duplicatePhoneLead
                      ? "var(--danger)"
                      : phone.replace(/[^0-9]/g, "").length >= 10
                      ? "var(--success)"
                      : undefined,
                    boxShadow: duplicatePhoneLead
                      ? "0 0 0 3px rgba(239, 68, 68, 0.15)"
                      : undefined
                  }}
                />
                {phone.replace(/[^0-9]/g, "").length >= 6 && (
                  <span
                    style={{
                      position: "absolute",
                      right: "0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: "0.9rem"
                    }}
                  >
                    {duplicatePhoneLead ? "⚠️" : "✅"}
                  </span>
                )}
              </div>

              {duplicatePhoneLead ? (
                <div
                  style={{
                    marginTop: "0.45rem",
                    padding: "0.6rem 0.8rem",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--warn-bg)",
                    border: "1.5px solid var(--warn)",
                    color: "var(--warn)",
                    fontSize: "0.82rem"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                    <div>
                      <strong>⚠️ Phone Number Already Exists!</strong>
                      <div style={{ marginTop: "0.15rem" }}>
                        Assigned to: <strong>{duplicatePhoneLead.name}</strong> ({duplicatePhoneLead.leadId}) • {duplicatePhoneLead.stage}
                      </div>
                    </div>
                    <Link
                      to={`/leads/${duplicatePhoneLead._id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-outline btn-sm"
                      style={{
                        borderColor: "var(--warn)",
                        color: "var(--warn)",
                        padding: "0.2rem 0.5rem",
                        fontSize: "0.75rem",
                        whiteSpace: "nowrap"
                      }}
                    >
                      View Lead ↗
                    </Link>
                  </div>
                </div>
              ) : phone.replace(/[^0-9]/g, "").length >= 10 ? (
                <span style={{ fontSize: "0.78rem", color: "var(--success)", fontWeight: 600, display: "inline-block", marginTop: "0.25rem" }}>
                  ✓ Phone number is unique & valid
                </span>
              ) : (
                <span className="form-help">Enter 10-digit mobile number</span>
              )}
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="e.g. student@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: LEAD DETAILS */}
        <div className="card-padded" style={{ marginBottom: "1.25rem" }}>
          <h2 className="section-title">📊 Lead Classification</h2>

          <div className="form-row">
            <div className="form-group">
              <label>Quality Status</label>
              <select value={quality} onChange={(e) => setQuality(e.target.value)}>
                <option value="Hot Lead">Hot Lead</option>
                <option value="Warm Lead">Warm Lead</option>
                <option value="Cold Lead">Cold Lead</option>
                <option value="Call Again">Call Again</option>
                <option value="Converted/Customer">Converted/Customer</option>
                <option value="Not Interested">Not Interested</option>
                <option value="Wrong number">Wrong number</option>
                <option value="Wrong Mail">Wrong Mail</option>
              </select>
            </div>

            <div className="form-group">
              <label>Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
              >
                <option value={1}>P1 — Urgent</option>
                <option value={2}>P2 — High</option>
                <option value={3}>P3 — Medium</option>
                <option value={4}>P4 — Low</option>
                <option value={5}>P5 — Minimal</option>
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

            <div className="form-group">
              <label>Lead Source</label>
              <select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="Instagram">Instagram</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Facebook">Facebook</option>
                <option value="Google Ads">Google Ads</option>
                <option value="Website">Website</option>
                <option value="Reference / Referral">Reference / Referral</option>
                <option value="Cold Call">Cold Call</option>
                <option value="Walk-in">Walk-in</option>
                <option value="Email Campaign">Email Campaign</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {quality === "Not Interested" && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Lost Reason</label>
              <input
                type="text"
                placeholder="e.g. Budget constraints, opted for competitor, no requirement"
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* SECTION 3: COURSES & FEES */}
        <CourseSelector
          selectedCourses={enrolledCourses}
          onChangeCourses={setEnrolledCourses}
          discountType={discountType}
          onChangeDiscountType={setDiscountType}
          discountValue={discountValue}
          onChangeDiscountValue={setDiscountValue}
        />

        {/* SECTION 4: DATES & FOLLOW-UP */}
        <div className="card-padded" style={{ marginBottom: "1.25rem" }}>
          <h2 className="section-title">📅 Dates & Follow-up Scheduling</h2>

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
              <label>Next Follow-up Date</label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
              <span className="form-help">Leave empty if no follow-up needed</span>
            </div>

            <div className="form-group">
              <label>Follow-up Time</label>
              <input
                type="time"
                value={followUpTime}
                onChange={(e) => setFollowUpTime(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Next Action Plan</label>
            <input
              type="text"
              placeholder="e.g. Send German A1 syllabus PDF on WhatsApp and call at 11:00 AM"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
            />
          </div>
        </div>

        {/* SECTION 5: NOTES & FIRST INTERACTION */}
        <div className="card-padded" style={{ marginBottom: "1.75rem" }}>
          <h2 className="section-title">📝 Interaction & Sticky Reminders</h2>

          <div className="form-group">
            <label>📌 Sticky Reminder Note (Pinned on Lead Details)</label>
            <input
              type="text"
              placeholder="e.g. Call after 5th of month (salary day). Wants weekend German batch."
              value={reminderNote}
              onChange={(e) => setReminderNote(e.target.value)}
            />
            <span className="form-help">
              This note stays visible at the top of the lead workspace as a quick reminder.
            </span>
          </div>

          <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
            <label style={{ fontWeight: 700, fontSize: "0.9rem", display: "block", marginBottom: "0.5rem" }}>
              First Interaction Log (Appended to Permanent History)
            </label>

            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ fontSize: "0.8rem", color: "var(--text2)", display: "block", marginBottom: "0.35rem" }}>
                Call Outcome
              </label>
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
              <label>First Interaction Note</label>
              <textarea
                placeholder="Write summary of first call or enquiry message (e.g. Inquired about German A1 fees and batch timing. Working professional looking for evening batches)."
                value={initialCommentText}
                onChange={(e) => setInitialCommentText(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* SUBMIT BUTTONS */}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          {(duplicateLeadIdLead || duplicatePhoneLead) && (
            <span style={{ fontSize: "0.85rem", color: "var(--danger)", fontWeight: 700 }}>
              ⚠️ {duplicateLeadIdLead ? `Lead ID "${leadId}" already taken.` : "Phone number already exists."} Fix before saving.
            </span>
          )}
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
            style={{
              opacity: (duplicateLeadIdLead || duplicatePhoneLead) ? 0.6 : 1,
              cursor: (duplicateLeadIdLead || duplicatePhoneLead) ? "not-allowed" : "pointer"
            }}
          >
            {loading ? "Creating Lead..." : "Save & Open Lead"}
          </button>
        </div>
      </form>
    </div>
  );
}
