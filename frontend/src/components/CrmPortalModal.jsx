import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

// Helper to resolve canonical courses and fees
const COURSE_CATALOG = [
  {
    tokens: ["ssgb", "lssgb", "green belt", "six sigma green belt", "lean six sigma green belt"],
    dbName: "Green Belt",
    displayName: "Six Sigma Green Belt (SSGB)",
    defaultFee: 17500
  },
  {
    tokens: ["ssbb", "lssbb", "black belt", "six sigma black belt", "lean six sigma black belt"],
    dbName: "Black Belt",
    displayName: "Six Sigma Black Belt (SSBB)",
    defaultFee: 29500
  },
  {
    tokens: ["mbb", "ssmbb", "lssmbb", "master black belt", "six sigma master black belt"],
    dbName: "Master Black Belt",
    displayName: "Master Black Belt (SSMBB)",
    defaultFee: 59500
  },
  {
    tokens: ["post graduation", "post graduate", "pgp", "pg program", "pg in lean six sigma", "pgp-fl", "pgp-gl"],
    dbName: "Post Graduation In Lean Six Sigma",
    displayName: "Post Graduation In Lean Six Sigma",
    defaultFee: 89000
  },
  {
    tokens: ["pmp", "project management professional", "pmc"],
    dbName: "PMP",
    displayName: "PMP (Project Management Professional)",
    defaultFee: 14900
  },
  {
    tokens: ["advanced excel", "excel"],
    dbName: "Advanced Excel",
    displayName: "Advanced Excel",
    defaultFee: 7500
  },
  {
    tokens: ["japanese", "n5", "japanese n5"],
    dbName: "Japanese N5",
    displayName: "Japanese N5",
    defaultFee: 9500
  },
  {
    tokens: ["sap pp", "sap-pp"],
    dbName: "SAP PP",
    displayName: "SAP PP",
    defaultFee: 34500
  },
  {
    tokens: ["sap fico", "sap-fico", "fico"],
    dbName: "SAP FICO",
    displayName: "SAP FICO",
    defaultFee: 34500
  },
  {
    tokens: ["spanish"],
    dbName: "Spanish Language",
    displayName: "Spanish Language Course",
    defaultFee: 15500
  },
  {
    tokens: ["german"],
    dbName: "German Language",
    displayName: "German Language Course",
    defaultFee: 15500
  },
  {
    tokens: ["med-code", "medical coding"],
    dbName: "Medical Coding",
    displayName: "Medical Coding Course",
    defaultFee: 24500
  }
];

function resolveCourse(rawName, coursesList = []) {
  if (!rawName) return { name: "General Course", fee: 0, courseId: "CR-" + Date.now() };
  let clean = String(rawName).trim();

  let extractedFee = 0;
  const feeMatch = clean.match(/\(fee:\s*₹?([0-9,.]+)\)/i);
  if (feeMatch) {
    extractedFee = parseFloat(feeMatch[1].replace(/,/g, "")) || 0;
    clean = clean.replace(/\s*\(fee:\s*₹?[0-9,.]+\)/i, "").trim();
  }

  const lower = clean.toLowerCase();

  const matchedCatalog = COURSE_CATALOG.find((cat) => {
    return cat.tokens.some((tok) => {
      if (lower === tok) return true;
      const regex = new RegExp(`(^|[^a-zA-Z0-9])${tok}([^a-zA-Z0-9]|$)`, "i");
      return regex.test(lower);
    });
  });

  let matchedDb = null;
  if (matchedCatalog && matchedCatalog.dbName) {
    matchedDb = (coursesList || []).find(
      (c) => c.name && c.name.toLowerCase() === matchedCatalog.dbName.toLowerCase()
    );
  }
  if (!matchedDb && Array.isArray(coursesList) && coursesList.length > 0) {
    matchedDb = coursesList.find((c) => {
      if (!c.name) return false;
      const cLow = c.name.toLowerCase();
      return cLow === lower || lower.includes(cLow) || cLow.includes(lower);
    });
  }

  const finalName = matchedCatalog ? matchedCatalog.displayName : (matchedDb ? matchedDb.name : clean);
  let finalFee = 0;
  if (extractedFee > 0) finalFee = extractedFee;
  else if (matchedDb && matchedDb.fee > 0) finalFee = matchedDb.fee;
  else if (matchedCatalog && matchedCatalog.defaultFee > 0) finalFee = matchedCatalog.defaultFee;

  return {
    name: finalName,
    fee: finalFee,
    courseId: matchedDb?._id || ("CR-" + Date.now())
  };
}

export default function CrmPortalModal({ isOpen, onClose, initialTab = "lead" }) {
  const navigate = useNavigate();
  const [leadInput, setLeadInput] = useState("");
  const [leadId, setLeadId] = useState("");
  const [loading, setLoading] = useState(false);
  const [existingLead, setExistingLead] = useState(null);
  const [parsedLead, setParsedLead] = useState(null);
  const [rawText, setRawText] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [savingLead, setSavingLead] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab || "lead"); // "lead" | "call"

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);
  const [audioUrl, setAudioUrl] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [loggingCall, setLoggingCall] = useState(false);
  const [masterCourses, setMasterCourses] = useState([]);

  // Load master courses on mount
  useEffect(() => {
    if (isOpen) {
      axios.get("/api/courses?active=true").then((res) => {
        if (res.data && res.data.success) {
          setMasterCourses(res.data.data || []);
        }
      }).catch(() => {});
    }
  }, [isOpen]);

  // Extract clean ID whenever input changes
  useEffect(() => {
    if (!leadInput) {
      setLeadId("");
      return;
    }
    const clean = String(leadInput).trim();
    const idMatch = clean.match(/[?&]id=(\d+)/i);
    if (idMatch) {
      setLeadId(idMatch[1]);
    } else {
      const digits = clean.replace(/[^\d]/g, "");
      if (digits) setLeadId(digits);
    }
  }, [leadInput]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const leadCheckUrl = leadId
    ? `https://crm.henryharvin.com/portal-new/get_lead_contact_details?id=${leadId}`
    : "";
  const callCheckUrl = leadId
    ? `https://crm.henryharvin.com/portal-new/call/report/view?id=${leadId}`
    : "";

  // Parse any raw JSON or text into structured lead
  const parseRawPayload = (text) => {
    if (!text || !text.trim()) return null;
    let extracted = {};
    try {
      extracted = JSON.parse(text);
    } catch (e) {
      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        const m = line.match(/^\s*"?([a-zA-Z0-9_]+)"?\s*[:=]\s*"?([^",\r\n]+)"?/);
        if (m) {
          const k = m[1].trim();
          let v = m[2].trim();
          if (v === "null") v = null;
          extracted[k] = v;
        }
      }
    }

    const cleanLeadId = extracted.id || extracted.lead_id || extracted.repeat_id || leadId;
    let cleanPhone = String(extracted.mobile || extracted.phone || extracted.phoneNumber || "").replace(/\D/g, "");
    if (cleanPhone.length > 10 && cleanPhone.startsWith("91")) cleanPhone = cleanPhone.slice(-10);

    const rawCourse = extracted.course || extracted.courseName || "";
    const resolvedCourse = resolveCourse(rawCourse, masterCourses);

    // Detect colleague attribution from campaign
    let colleague = null;
    let leadScope = "my_lead";
    const camp =
      extracted.ozonetel_campaign_name ||
      extracted.campaign ||
      (Array.isArray(extracted.member) && extracted.member[0]?.ozonetel_campaign_name) ||
      (extracted.member && extracted.member.ozonetel_campaign_name);
    if (camp && typeof camp === "string") {
      const parts = camp.split("_");
      if (parts[0] && !["general", "inbound", "campaign", "ozonetel"].includes(parts[0].toLowerCase())) {
        colleague = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        leadScope = "colleague_lead";
      }
    }

    let fDate = "";
    let fTime = "11:00";
    if (extracted.followuptime) {
      const parts = String(extracted.followuptime).trim().split(" ");
      if (parts[0]) fDate = parts[0];
      if (parts[1]) fTime = parts[1].slice(0, 5);
    }

    const notes = [extracted.painarea, extracted.description].filter(Boolean).filter((n) => n !== "null").join(" - ");

    return {
      leadId: String(cleanLeadId).trim(),
      name: extracted.name && extracted.name !== "null" ? extracted.name.trim() : `Lead #${cleanLeadId}`,
      phone: cleanPhone,
      email: extracted.email && extracted.email !== "null" ? extracted.email.trim() : "",
      courseName: resolvedCourse.name,
      courseFee: resolvedCourse.fee,
      quality: extracted.lead_quality || extracted.quality || "Warm Lead",
      stage: extracted.stage || (notes.includes("Followup") ? "Contacted" : "New"),
      followUpDate: fDate,
      followUpTime: fTime,
      leadScope,
      colleagueName: colleague,
      reminderNote: notes
    };
  };

  // Check portal via backend
  const handleFetchPortal = async () => {
    if (!leadId) {
      setErrorMsg("Please enter a valid numeric Lead ID.");
      return;
    }
    setErrorMsg("");
    setStatusMsg("");
    setLoading(true);

    try {
      const res = await axios.post("/api/leads/fetch-portal-lead", { leadId });
      if (res.data) {
        setExistingLead(res.data.existingLead || null);

        if (res.data.data) {
          const resolved = resolveCourse(res.data.data.courseName, masterCourses);
          setParsedLead({
            ...res.data.data,
            courseName: resolved.name,
            courseFee: resolved.fee
          });
          setStatusMsg("✓ Lead data successfully fetched and verified!");
        } else if (res.data.blockedByCloudflare) {
          setStatusMsg("ℹ️ Portal requires active browser session. Open link below and paste JSON to sync in 0.01s.");
        }
      }
    } catch (err) {
      console.warn("Portal fetch error:", err);
      setErrorMsg("Failed to connect to portal. Please open link directly or paste JSON.");
    } finally {
      setLoading(false);
    }
  };

  // Read clipboard automatically
  const handlePasteClipboard = async () => {
    try {
      setErrorMsg("");
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setErrorMsg("Clipboard is empty.");
        return;
      }
      setRawText(text);

      // Check if text is just a lead ID or URL
      const clean = text.trim();
      const idMatch = clean.match(/[?&]id=(\d+)/i);
      if (idMatch) {
        setLeadInput(idMatch[1]);
        setLeadId(idMatch[1]);
      } else if (/^\d{5,9}$/.test(clean)) {
        setLeadInput(clean);
        setLeadId(clean);
      }

      // Check if it's JSON or key-value CRM dump
      if (clean.includes(":") || clean.includes("{")) {
        const parsed = parseRawPayload(clean);
        if (parsed) {
          setParsedLead(parsed);
          if (parsed.leadId && !leadId) setLeadId(parsed.leadId);
          // Check if exists in DB
          axios.get(`/api/leads`).then((r) => {
            if (r.data?.success) {
              const match = r.data.data.find(
                (l) => l.leadId === parsed.leadId || (parsed.phone && l.phone === parsed.phone)
              );
              setExistingLead(match || null);
            }
          });
          setStatusMsg("⚡ Parsed JSON instantly from clipboard!");
        }
      }
    } catch (err) {
      setErrorMsg("Clipboard permission denied. Please paste manually into the text box.");
    }
  };

  // Save new lead directly into database
  const handleSaveToDatabase = async () => {
    if (!parsedLead) return;
    try {
      setSavingLead(true);
      setErrorMsg("");

      const payload = {
        leadId: parsedLead.leadId || leadId,
        name: parsedLead.name || `Lead #${leadId}`,
        phone: parsedLead.phone || "",
        email: parsedLead.email || "",
        quality: parsedLead.quality || "Warm Lead",
        stage: parsedLead.stage || "New",
        priority: 3,
        source: "Henry Harvin Portal",
        followUpDate: parsedLead.followUpDate || null,
        followUpTime: parsedLead.followUpTime || "",
        reminderNote: parsedLead.reminderNote || "",
        nextAction: parsedLead.reminderNote?.includes("Followup") ? "Need Followup" : "",
        leadScope: parsedLead.leadScope || "my_lead",
        colleagueName: parsedLead.colleagueName || "",
        enrolledCourses: [
          {
            courseId: "CRS-" + Date.now(),
            courseName: parsedLead.courseName || "General Course",
            fee: parsedLead.courseFee || 0
          }
        ],
        initialCommentText: `⚡ Imported directly from Henry Harvin Portal (ID: ${leadId}). Notes: ${parsedLead.reminderNote || "None"}`
      };

      const res = await axios.post("/api/leads", payload);
      if (res.data && res.data.success) {
        setStatusMsg("🎉 Lead successfully saved to database!");
        setExistingLead(res.data.data);
      }
    } catch (err) {
      setErrorMsg("Failed to save lead: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingLead(false);
    }
  };

  // Copy portal links
  const handleCopyLinks = () => {
    if (!leadId) return;
    const text = `Lead Details: ${leadCheckUrl}\nCall Report: ${callCheckUrl}`;
    navigator.clipboard.writeText(text);
    setStatusMsg("✓ Links copied to clipboard!");
    setTimeout(() => setStatusMsg(""), 3000);
  };

  // Log Call Notes to existing lead
  const handleLogCallNotes = async () => {
    if (!existingLead || !existingLead._id) {
      setErrorMsg("Please save the lead to database before logging call reports.");
      return;
    }
    if (!callNotes.trim() && !audioUrl.trim()) {
      setErrorMsg("Please enter call notes or an audio recording URL.");
      return;
    }
    try {
      setLoggingCall(true);
      setErrorMsg("");

      const commentBody = [
        audioUrl.trim() ? `🎧 Call Recording: ${audioUrl.trim()}` : "",
        callNotes.trim() ? `📞 Call Report:\n${callNotes.trim()}` : ""
      ].filter(Boolean).join("\n\n");

      await axios.post(`/api/leads/${existingLead._id}/comments`, {
        text: commentBody,
        outcome: "Call Report Logged"
      });

      setStatusMsg("✓ Call report and audio link logged to lead history!");
      setCallNotes("");
    } catch (err) {
      setErrorMsg("Failed to log call: " + (err.response?.data?.message || err.message));
    } finally {
      setLoggingCall(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(10, 15, 29, 0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem"
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--card-bg, #1a2234)",
          border: "1px solid rgba(99, 102, 241, 0.35)",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "760px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          color: "var(--text, #f8fafc)",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.08))"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.6rem" }}>⚡</span>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, letterSpacing: "-0.01em" }}>
                Henry Harvin CRM Hub
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--text2, #94a3b8)" }}>
                Fetch contact JSON, open call reports, play/download audio & sync directly with AI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text2, #94a3b8)",
              fontSize: "1.4rem",
              cursor: "pointer",
              padding: "0.25rem 0.5rem",
              borderRadius: "6px"
            }}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            padding: "0.75rem 1.5rem",
            background: "rgba(0, 0, 0, 0.15)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)"
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("lead")}
            style={{
              background: activeTab === "lead" ? "var(--accent, #6366f1)" : "transparent",
              color: activeTab === "lead" ? "#ffffff" : "var(--text2, #94a3b8)",
              border: "none",
              padding: "0.4rem 1rem",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem"
            }}
          >
            <span>👤 Lead Details & Sync</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("call")}
            style={{
              background: activeTab === "call" ? "var(--accent, #6366f1)" : "transparent",
              color: activeTab === "call" ? "#ffffff" : "var(--text2, #94a3b8)",
              border: "none",
              padding: "0.4rem 1rem",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem"
            }}
          >
            <span>📞 Call Report & Audio Hub</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Lead ID Input Bar */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "12px",
              padding: "1rem"
            }}
          >
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text2)", marginBottom: "0.5rem" }}>
              Enter Lead ID or Paste Portal URL:
            </label>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: "1 1 240px" }}>
                <input
                  type="text"
                  placeholder="e.g. 9639399 or 8495779..."
                  value={leadInput}
                  onChange={(e) => setLeadInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.8rem",
                    borderRadius: "8px",
                    border: "1px solid rgba(99, 102, 241, 0.4)",
                    background: "rgba(0, 0, 0, 0.25)",
                    color: "inherit",
                    fontSize: "0.95rem",
                    outline: "none"
                  }}
                />
                {leadInput && (
                  <button
                    onClick={() => { setLeadInput(""); setLeadId(""); setParsedLead(null); }}
                    style={{
                      position: "absolute",
                      right: "8px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "var(--text3, #64748b)",
                      cursor: "pointer"
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handleFetchPortal}
                disabled={loading || !leadId}
                style={{
                  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                  color: "#ffffff",
                  border: "none",
                  padding: "0.6rem 1.25rem",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "0.88rem",
                  cursor: !leadId || loading ? "not-allowed" : "pointer",
                  opacity: !leadId || loading ? 0.6 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem"
                }}
              >
                {loading ? "⏳ Checking..." : "⚡ Check Portal"}
              </button>
              <button
                type="button"
                onClick={handlePasteClipboard}
                title="Paste copied JSON or text from clipboard"
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  color: "inherit",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  padding: "0.6rem 1rem",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem"
                }}
              >
                📋 Paste JSON
              </button>
            </div>

            {/* Quick Link Pills */}
            {leadId && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
                <span style={{ fontSize: "0.76rem", color: "var(--text3)", fontWeight: 600 }}>PORTAL LINKS:</span>
                <a
                  href={leadCheckUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    color: "#38bdf8",
                    background: "rgba(56, 189, 248, 0.12)",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "6px",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem"
                  }}
                >
                  🔍 Lead JSON ↗
                </a>
                <a
                  href={callCheckUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    color: "#34d399",
                    background: "rgba(52, 211, 153, 0.12)",
                    border: "1px solid rgba(52, 211, 153, 0.3)",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "6px",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem"
                  }}
                >
                  📞 Call Report ↗
                </a>
                <button
                  type="button"
                  onClick={handleCopyLinks}
                  style={{
                    fontSize: "0.74rem",
                    background: "transparent",
                    border: "none",
                    color: "var(--text2)",
                    cursor: "pointer",
                    textDecoration: "underline"
                  }}
                >
                  Copy Links
                </button>
              </div>
            )}
          </div>

          {/* Feedback messages */}
          {statusMsg && (
            <div
              style={{
                padding: "0.6rem 0.9rem",
                borderRadius: "8px",
                background: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                color: "#10b981",
                fontSize: "0.85rem"
              }}
            >
              {statusMsg}
            </div>
          )}
          {errorMsg && (
            <div
              style={{
                padding: "0.6rem 0.9rem",
                borderRadius: "8px",
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#ef4444",
                fontSize: "0.85rem"
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Database Match Status */}
          {leadId && existingLead && (
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "10px",
                background: "rgba(99, 102, 241, 0.12)",
                border: "1px solid rgba(99, 102, 241, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                flexWrap: "wrap"
              }}
            >
              <div>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#818cf8" }}>
                  ℹ️ Found in CRM Database:
                </span>{" "}
                <strong style={{ fontSize: "0.9rem" }}>{existingLead.name}</strong>{" "}
                <span style={{ fontSize: "0.8rem", color: "var(--text2)" }}>(ID: {existingLead.leadId})</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(`/lead/${existingLead._id || existingLead.leadId}`);
                }}
                style={{
                  background: "#6366f1",
                  color: "#ffffff",
                  border: "none",
                  padding: "0.35rem 0.8rem",
                  borderRadius: "6px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                View Lead Card ➔
              </button>
            </div>
          )}

          {/* TAB 1: LEAD DETAILS & SYNC */}
          {activeTab === "lead" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Structured Lead Preview */}
              {parsedLead ? (
                <div
                  style={{
                    background: "rgba(0, 0, 0, 0.2)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "12px",
                    padding: "1.25rem"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#38bdf8" }}>
                      ✨ Structured Lead Extracted (Ready to Save)
                    </h3>
                    <span style={{ fontSize: "0.76rem", color: "#34d399", fontWeight: 600 }}>
                      AI Catalog Resolved ✓
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", fontSize: "0.86rem" }}>
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.75rem" }}>NAME</span>
                      <strong>{parsedLead.name || "—"}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.75rem" }}>MOBILE</span>
                      <strong>{parsedLead.phone || "—"}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.75rem" }}>EMAIL</span>
                      <span>{parsedLead.email || "—"}</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.75rem" }}>COURSE & OFFICIAL FEE</span>
                      <strong style={{ color: "#a855f7" }}>
                        {parsedLead.courseName} • ₹{Number(parsedLead.courseFee || 0).toLocaleString("en-IN")}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.75rem" }}>QUALITY & STAGE</span>
                      <span>{parsedLead.quality} ({parsedLead.stage})</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.75rem" }}>FOLLOW-UP</span>
                      <span>{parsedLead.followUpDate || "None"} at {parsedLead.followUpTime || "11:00"}</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.75rem" }}>PIPELINE SCOPE</span>
                      <span style={{ color: parsedLead.leadScope === "colleague_lead" ? "#f59e0b" : "#38bdf8" }}>
                        {parsedLead.leadScope === "colleague_lead"
                          ? `👥 Colleague's Holding Pool (${parsedLead.colleagueName || "Coworker"})`
                          : "👤 My Active Pipeline"}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.75rem" }}>PINNED NOTE</span>
                      <span style={{ color: "var(--text2)" }}>{parsedLead.reminderNote || "—"}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    {!existingLead && (
                      <button
                        type="button"
                        onClick={handleSaveToDatabase}
                        disabled={savingLead}
                        style={{
                          background: "linear-gradient(135deg, #059669, #10b981)",
                          color: "#ffffff",
                          border: "none",
                          padding: "0.6rem 1.25rem",
                          borderRadius: "8px",
                          fontWeight: 700,
                          fontSize: "0.88rem",
                          cursor: savingLead ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem"
                        }}
                      >
                        {savingLead ? "💾 Saving Lead..." : "💾 Save Directly to CRM Database"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate("/add", { state: { prefilledLead: parsedLead } });
                      }}
                      style={{
                        background: "rgba(255, 255, 255, 0.08)",
                        color: "inherit",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        padding: "0.6rem 1rem",
                        borderRadius: "8px",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        cursor: "pointer"
                      }}
                    >
                      ✏️ Edit in Add Lead Form
                    </button>
                  </div>
                </div>
              ) : (
                /* Paste box if not fetched yet */
                <div
                  style={{
                    background: "rgba(0, 0, 0, 0.15)",
                    border: "1px dashed rgba(255, 255, 255, 0.15)",
                    borderRadius: "12px",
                    padding: "1rem"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text2)" }}>
                      Or Paste Copied JSON / Portal Record Below:
                    </label>
                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--accent)",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      Paste from Clipboard 📋
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    placeholder='Paste portal JSON block here (e.g. {"id": 9639399, "name": "Sonu", "course": "SSGB", "mobile": "7573944848"})...'
                    value={rawText}
                    onChange={(e) => {
                      setRawText(e.target.value);
                      const parsed = parseRawPayload(e.target.value);
                      if (parsed) setParsedLead(parsed);
                    }}
                    style={{
                      width: "100%",
                      padding: "0.6rem",
                      borderRadius: "8px",
                      background: "rgba(0, 0, 0, 0.3)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "inherit",
                      fontSize: "0.82rem",
                      fontFamily: "monospace",
                      outline: "none",
                      resize: "vertical"
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CALL REPORT & AUDIO HUB */}
          {activeTab === "call" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div
                style={{
                  background: "rgba(0, 0, 0, 0.2)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "12px",
                  padding: "1.25rem"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 700, color: "#34d399" }}>
                      🎧 Audio Recording & Call Player
                    </h3>
                    <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--text2)" }}>
                      Paste call recording link to play inline or download directly
                    </p>
                  </div>
                  {callCheckUrl && (
                    <a
                      href={callCheckUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: "rgba(52, 211, 153, 0.15)",
                        color: "#34d399",
                        border: "1px solid rgba(52, 211, 153, 0.3)",
                        padding: "0.35rem 0.75rem",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textDecoration: "none"
                      }}
                    >
                      Open Call Report ↗
                    </a>
                  )}
                </div>

                {/* Audio URL Input */}
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <input
                    type="url"
                    placeholder="Paste Call Audio Recording URL (.mp3 / .wav / Ozonetel link)..."
                    value={audioUrl}
                    onChange={(e) => setAudioUrl(e.target.value)}
                    style={{
                      flex: 1,
                      padding: "0.6rem 0.8rem",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      background: "rgba(0, 0, 0, 0.25)",
                      color: "inherit",
                      fontSize: "0.88rem",
                      outline: "none"
                    }}
                  />
                  {audioUrl && (
                    <a
                      href={audioUrl}
                      download={`call_recording_${leadId || "lead"}.mp3`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: "#059669",
                        color: "#ffffff",
                        padding: "0.6rem 1rem",
                        borderRadius: "8px",
                        textDecoration: "none",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem"
                      }}
                    >
                      ⬇️ Download
                    </a>
                  )}
                </div>

                {/* Inline HTML5 Audio Player */}
                {audioUrl && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <audio
                      controls
                      src={audioUrl}
                      style={{ width: "100%", height: "40px", borderRadius: "8px" }}
                    >
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
              </div>

              {/* Call Summary / Notes Logger */}
              <div
                style={{
                  background: "rgba(0, 0, 0, 0.2)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "12px",
                  padding: "1.25rem"
                }}
              >
                <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "0.98rem", fontWeight: 700, color: "#a855f7" }}>
                  📝 Call Notes & AI Summary Logger
                </h3>
                <textarea
                  rows={4}
                  placeholder="Paste call discussion notes, transcript, or summary here..."
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.6rem",
                    borderRadius: "8px",
                    background: "rgba(0, 0, 0, 0.25)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "inherit",
                    fontSize: "0.85rem",
                    outline: "none",
                    resize: "vertical"
                  }}
                />

                <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                  <button
                    type="button"
                    onClick={handleLogCallNotes}
                    disabled={loggingCall || (!callNotes.trim() && !audioUrl.trim())}
                    style={{
                      background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                      color: "#ffffff",
                      border: "none",
                      padding: "0.55rem 1.25rem",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: loggingCall || (!callNotes.trim() && !audioUrl.trim()) ? "not-allowed" : "pointer",
                      opacity: loggingCall || (!callNotes.trim() && !audioUrl.trim()) ? 0.6 : 1,
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem"
                    }}
                  >
                    {loggingCall ? "⏳ Logging..." : "📝 Log to Lead History"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
