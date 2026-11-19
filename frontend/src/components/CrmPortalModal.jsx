import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function CrmPortalModal({ isOpen, onClose, initialTab = "lead" }) {
  const navigate = useNavigate();
  const [leadInput, setLeadInput] = useState("");
  const [leadId, setLeadId] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [existingLead, setExistingLead] = useState(null);
  const [parsedLead, setParsedLead] = useState(null);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [rawText, setRawText] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [savingLead, setSavingLead] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab || "lead"); // "lead" | "call"
  const [audioUrl, setAudioUrl] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [loggingCall, setLoggingCall] = useState(false);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

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

  // Real-time lookup whenever leadInput changes
  useEffect(() => {
    if (!leadInput || !leadInput.trim()) {
      setLeadId("");
      setExistingLead(null);
      setParsedLead(null);
      setErrorMsg("");
      setStatusMsg("");
      return;
    }

    const clean = String(leadInput).trim();

    // 1. If user pasted raw JSON directly into the input bar
    if (clean.startsWith("{") && clean.endsWith("}")) {
      try {
        const parsed = JSON.parse(clean);
        if (parsed.id) setLeadId(String(parsed.id));
        runAiAnalysis(parsed, clean);
        return;
      } catch (e) {}
    }

    // 2. Extract numeric Lead ID from URL or bare digits
    let extractedId = "";
    const idMatch = clean.match(/[?&]id=(\d+)/i);
    if (idMatch) {
      extractedId = idMatch[1];
    } else {
      const digits = clean.replace(/[^\d]/g, "");
      if (digits.length >= 4) extractedId = digits;
    }

    if (extractedId) {
      setLeadId(extractedId);
      lookupInDatabase(extractedId);
    }
  }, [leadInput]);

  if (!isOpen) return null;

  const leadCheckUrl = leadId
    ? `https://crm.henryharvin.com/portal-new/get_lead_contact_details?id=${leadId}`
    : "";
  const callCheckUrl = leadId
    ? `https://crm.henryharvin.com/portal-new/call/report/view?id=${leadId}`
    : "";

  // Instant DB lookup by Lead ID, Phone, or URL
  const lookupInDatabase = async (queryId) => {
    try {
      setErrorMsg("");
      const res = await axios.get(`/api/leads/lookup-id/${encodeURIComponent(queryId)}`);
      if (res.data && res.data.found && res.data.data) {
        const lead = res.data.data;
        setExistingLead(lead);
        setParsedLead({
          leadId: lead.leadId,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          courseName: lead.enrolledCourses?.[0]?.courseName || lead.courseName || "General Course",
          courseFee: lead.enrolledCourses?.[0]?.fee || 0,
          quality: lead.quality,
          stage: lead.stage,
          followUpDate: lead.followUpDate ? lead.followUpDate.split("T")[0] : "",
          followUpTime: lead.followUpTime || "",
          reminderNote: lead.reminderNote || "",
          leadScope: lead.leadScope || "my_lead",
          colleagueName: lead.colleagueName || ""
        });
        setStatusMsg(`✓ Lead found in CRM database! Click "Open Lead in CRM" to view.`);
      } else {
        setExistingLead(null);
        setParsedLead(null);
        setStatusMsg("");
      }
    } catch (err) {
      console.warn("Lookup error:", err);
    }
  };

  // Run AI Analysis on raw portal JSON
  const runAiAnalysis = async (portalDataObj, rawString = "") => {
    try {
      setAnalyzingAi(true);
      setErrorMsg("");
      setStatusMsg("🤖 AI is reading course, official fee, and checking database...");

      const res = await axios.post("/api/leads/ai-portal-sync", {
        portalData: portalDataObj,
        rawText: rawString,
        action: "analyze"
      });

      if (res.data && res.data.success) {
        let data = res.data.data;
        // Subham is the user himself - ensure Subham leads are ALWAYS in My Active Pipeline!
        if (data) {
          if (
            (data.colleagueName && data.colleagueName.toLowerCase() === "subham") ||
            (portalDataObj && portalDataObj.member?.ozonetel_campaign_name?.toLowerCase().includes("subham"))
          ) {
            data.leadScope = "my_lead";
            data.colleagueName = "";
          }
        }
        setParsedLead(data);
        setExistingLead(res.data.existingLead || null);

        if (res.data.isDuplicate) {
          setStatusMsg(`⚠️ Found Existing Record for "${res.data.existingLead.name}". You can update or open it directly.`);
        } else {
          setStatusMsg("✓ AI Analysis Complete! Review or edit any details below, then save.");
        }
      }
    } catch (err) {
      console.warn("AI analysis error:", err);
      setErrorMsg("AI Analysis error: " + (err.response?.data?.message || err.message));
    } finally {
      setAnalyzingAi(false);
    }
  };

  // Direct fetch attempt or open portal
  const handleCheckPortal = async () => {
    if (!leadId) {
      setErrorMsg("Please enter a valid Lead ID or URL.");
      return;
    }
    setErrorMsg("");
    setStatusMsg("");
    setLoading(true);

    try {
      const res = await axios.post("/api/leads/fetch-portal-lead", { leadId });
      if (res.data) {
        if (res.data.foundInDatabase && res.data.existingLead) {
          setExistingLead(res.data.existingLead);
          setParsedLead(res.data.data);
          setStatusMsg(`✓ Found in CRM database! Click below to open.`);
        } else if (res.data.data) {
          await runAiAnalysis(res.data.raw || res.data.data);
        } else {
          setStatusMsg("ℹ️ Lead not in CRM database yet. Click 'Open in Henry Harvin' to copy JSON, then paste below to save with AI.");
        }
      }
    } catch (err) {
      setErrorMsg("Failed to connect: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Paste from clipboard automatically
  const handlePasteClipboard = async () => {
    try {
      setErrorMsg("");
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setErrorMsg("Clipboard is empty.");
        return;
      }
      setRawText(text);

      const clean = text.trim();

      // Check if text is just a lead ID or URL
      const idMatch = clean.match(/[?&]id=(\d+)/i);
      if (idMatch) {
        setLeadInput(idMatch[1]);
        setLeadId(idMatch[1]);
        lookupInDatabase(idMatch[1]);
        return;
      } else if (/^\d{5,9}$/.test(clean)) {
        setLeadInput(clean);
        setLeadId(clean);
        lookupInDatabase(clean);
        return;
      }

      // If it's JSON
      let parsedJson = null;
      try {
        parsedJson = JSON.parse(clean);
      } catch (e) {
        const m = clean.match(/\{[\s\S]*\}/);
        if (m) {
          try { parsedJson = JSON.parse(m[0]); } catch (e2) {}
        }
      }

      if (parsedJson) {
        if (parsedJson.id) {
          setLeadId(String(parsedJson.id));
          setLeadInput(String(parsedJson.id));
        }
        await runAiAnalysis(parsedJson, clean);
      } else {
        await runAiAnalysis(null, clean);
      }
    } catch (err) {
      setErrorMsg("Clipboard permission denied. Please paste manually into the text box.");
    }
  };

  // Save new lead directly into database and immediately redirect
  const handleSaveAndOpenLead = async () => {
    if (!parsedLead) return;
    try {
      setSavingLead(true);
      setErrorMsg("");

      const action = existingLead ? "update_existing" : "save_new";
      const res = await axios.post("/api/leads/ai-portal-sync", {
        portalData: parsedLead,
        action: action
      });

      if (res.data && res.data.success) {
        const savedDoc = res.data.data;
        setStatusMsg("🎉 Lead saved successfully! Redirecting...");
        setTimeout(() => {
          onClose();
          navigate(`/lead/${savedDoc._id || savedDoc.leadId}`);
        }, 400);
      }
    } catch (err) {
      setErrorMsg("Failed to save: " + (err.response?.data?.message || err.message));
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
    setTimeout(() => setStatusMsg(""), 2500);
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
        backgroundColor: "rgba(10, 15, 29, 0.78)",
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
          maxWidth: "790px",
          maxHeight: "94vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.45)",
          color: "var(--text, #f1f5f9)",
          overflow: "hidden"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: "1.1rem 1.4rem",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.12), transparent)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "1.35rem" }}>⚡</span>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, letterSpacing: "-0.01em" }}>
                Henry Harvin Lead Hub
              </h2>
              <span style={{ fontSize: "0.74rem", color: "var(--text3, #94a3b8)" }}>
                Paste Link, ID or JSON • Instant Database Lookup • AI Course Fee Resolution
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text2, #cbd5e1)",
              fontSize: "1.2rem",
              cursor: "pointer",
              padding: "0.3rem",
              lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>

        {/* TABS HEADER */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(0, 0, 0, 0.15)"
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("lead")}
            style={{
              flex: 1,
              padding: "0.75rem 1rem",
              background: activeTab === "lead" ? "rgba(99, 102, 241, 0.18)" : "transparent",
              color: activeTab === "lead" ? "#818cf8" : "var(--text2)",
              border: "none",
              borderBottom: activeTab === "lead" ? "2px solid #6366f1" : "2px solid transparent",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer"
            }}
          >
            👤 Lead Lookup & AI Save
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("call")}
            style={{
              flex: 1,
              padding: "0.75rem 1rem",
              background: activeTab === "call" ? "rgba(52, 211, 153, 0.15)" : "transparent",
              color: activeTab === "call" ? "#34d399" : "var(--text2)",
              border: "none",
              borderBottom: activeTab === "call" ? "2px solid #10b981" : "2px solid transparent",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer"
            }}
          >
            📞 Call Report & Audio Player
          </button>
        </div>

        {/* MODAL BODY */}
        <div style={{ padding: "1.2rem 1.4rem", overflowY: "auto", flex: 1 }}>
          {/* Status / Error Alerts */}
          {errorMsg && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                color: "#f87171",
                padding: "0.65rem 0.9rem",
                borderRadius: "8px",
                fontSize: "0.84rem",
                marginBottom: "1rem"
              }}
            >
              {errorMsg}
            </div>
          )}
          {statusMsg && (
            <div
              style={{
                background: statusMsg.includes("⚠️")
                  ? "rgba(245, 158, 11, 0.15)"
                  : "rgba(16, 185, 129, 0.15)",
                border: statusMsg.includes("⚠️")
                  ? "1px solid rgba(245, 158, 11, 0.4)"
                  : "1px solid rgba(16, 185, 129, 0.35)",
                color: statusMsg.includes("⚠️") ? "#fbbf24" : "#34d399",
                padding: "0.65rem 0.9rem",
                borderRadius: "8px",
                fontSize: "0.84rem",
                marginBottom: "1rem"
              }}
            >
              {statusMsg}
            </div>
          )}

          {/* TAB 1: LEAD LOOKUP & AI SAVE */}
          {activeTab === "lead" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              {/* Universal Smart Input */}
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "0.35rem", color: "var(--text2)" }}>
                  Paste Lead Link, Lead ID, or Raw JSON:
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="text"
                    placeholder="e.g. 9640547, crm.henryharvin.com/...id=9640547, or paste JSON"
                    value={leadInput}
                    onChange={(e) => setLeadInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCheckPortal();
                    }}
                    style={{
                      flex: 1,
                      padding: "0.65rem 0.9rem",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      background: "rgba(0, 0, 0, 0.25)",
                      color: "inherit",
                      fontSize: "0.88rem",
                      outline: "none"
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleCheckPortal}
                    disabled={loading || analyzingAi}
                    style={{
                      background: "var(--accent, #6366f1)",
                      color: "#ffffff",
                      border: "none",
                      padding: "0.65rem 1.15rem",
                      borderRadius: "8px",
                      fontWeight: 700,
                      fontSize: "0.86rem",
                      cursor: loading || analyzingAi ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {loading ? "Searching..." : analyzingAi ? "🤖 Analyzing..." : "🔍 Find Lead"}
                  </button>
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    style={{
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      color: "inherit",
                      padding: "0.65rem 0.95rem",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "0.84rem",
                      cursor: "pointer",
                      whiteSpace: "nowrap"
                    }}
                  >
                    📋 Paste
                  </button>
                </div>
              </div>

              {/* Portal Links Pill */}
              {leadId && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    flexWrap: "wrap",
                    padding: "0.6rem 0.85rem",
                    background: "rgba(0, 0, 0, 0.2)",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    fontSize: "0.8rem"
                  }}
                >
                  <span style={{ color: "var(--text3)", fontWeight: 600 }}>PORTAL LINKS:</span>
                  <a
                    href={leadCheckUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#60a5fa",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      background: "rgba(96, 165, 250, 0.12)",
                      padding: "0.25rem 0.55rem",
                      borderRadius: "6px",
                      fontWeight: 600
                    }}
                  >
                    🌐 Open in Henry Harvin ↗
                  </a>
                  <a
                    href={callCheckUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#34d399",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      background: "rgba(52, 211, 153, 0.12)",
                      padding: "0.25rem 0.55rem",
                      borderRadius: "6px",
                      fontWeight: 600
                    }}
                  >
                    📞 Call Report ↗
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyLinks}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text2)",
                      cursor: "pointer",
                      textDecoration: "underline",
                      fontSize: "0.78rem"
                    }}
                  >
                    Copy Links
                  </button>
                </div>
              )}

              {/* CASE 1: LEAD IS FOUND IN CRM DATABASE */}
              {existingLead && (
                <div
                  style={{
                    background: "linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(6, 95, 70, 0.12))",
                    border: "1.5px solid rgba(16, 185, 129, 0.45)",
                    borderRadius: "14px",
                    padding: "1.2rem"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "1.25rem" }}>✅</span>
                      <div>
                        <strong style={{ color: "#34d399", fontSize: "1rem" }}>
                          Lead Found in CRM Database
                        </strong>
                        <span style={{ display: "block", fontSize: "0.74rem", color: "var(--text2)" }}>
                          No duplicates needed — this lead is already saved in your pipeline.
                        </span>
                      </div>
                    </div>
                    <span
                      style={{
                        background: "rgba(16, 185, 129, 0.25)",
                        color: "#34d399",
                        padding: "0.25rem 0.75rem",
                        borderRadius: "9999px",
                        fontSize: "0.75rem",
                        fontWeight: 700
                      }}
                    >
                      SAVED IN CRM
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", fontSize: "0.86rem", marginBottom: "1.1rem" }}>
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.72rem", fontWeight: 700 }}>STUDENT NAME</span>
                      <strong style={{ fontSize: "0.95rem" }}>{existingLead.name || "—"}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.72rem", fontWeight: 700 }}>LEAD ID</span>
                      <strong>{existingLead.leadId || leadId}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.72rem", fontWeight: 700 }}>MOBILE</span>
                      <strong>{existingLead.phone || "—"}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.72rem", fontWeight: 700 }}>COURSE & FEE</span>
                      <strong style={{ color: "#a855f7" }}>
                        {existingLead.enrolledCourses?.[0]?.courseName || existingLead.courseName || "General Course"} • ₹{Number(existingLead.enrolledCourses?.[0]?.fee || existingLead.totalFee || 0).toLocaleString("en-IN")}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.72rem", fontWeight: 700 }}>STAGE & QUALITY</span>
                      <span>{existingLead.stage} ({existingLead.quality})</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.72rem", fontWeight: 700 }}>SCHEDULED FOLLOW-UP</span>
                      <span style={{ color: "#38bdf8", fontWeight: 600 }}>
                        {existingLead.followUpDate ? String(existingLead.followUpDate).split("T")[0] : "None"} at {existingLead.followUpTime || "11:00 AM"}
                      </span>
                    </div>
                  </div>

                  {/* Primary Direct Action: OPEN LEAD */}
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate(`/lead/${existingLead._id || existingLead.leadId}`);
                      }}
                      style={{
                        background: "linear-gradient(135deg, #059669, #10b981)",
                        color: "#ffffff",
                        border: "none",
                        padding: "0.7rem 1.4rem",
                        borderRadius: "8px",
                        fontWeight: 800,
                        fontSize: "0.92rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.45rem",
                        boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)"
                      }}
                    >
                      🚀 Open Lead in CRM ➔
                    </button>
                    {parsedLead && (
                      <button
                        type="button"
                        onClick={handleSaveAndOpenLead}
                        disabled={savingLead}
                        style={{
                          background: "rgba(255, 255, 255, 0.08)",
                          color: "inherit",
                          border: "1px solid rgba(255, 255, 255, 0.18)",
                          padding: "0.7rem 1.1rem",
                          borderRadius: "8px",
                          fontWeight: 600,
                          fontSize: "0.86rem",
                          cursor: savingLead ? "not-allowed" : "pointer"
                        }}
                      >
                        {savingLead ? "Updating..." : "🔄 Update Notes & Follow-up"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* CASE 2: LEAD PARSED WITH AI (NEW RECORD - WITH FULL INLINE EDITING) */}
              {!existingLead && parsedLead && (
                <div
                  style={{
                    background: "rgba(0, 0, 0, 0.22)",
                    border: "1px solid rgba(99, 102, 241, 0.35)",
                    borderRadius: "14px",
                    padding: "1.2rem"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.9rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                      <span style={{ fontSize: "1.2rem" }}>🤖</span>
                      <div>
                        <strong style={{ fontSize: "0.98rem", color: "#818cf8" }}>
                          AI Resolved Lead Profile
                        </strong>
                        <span style={{ display: "block", fontSize: "0.72rem", color: "var(--text3)" }}>
                          You can edit any field directly below before saving.
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <button
                        type="button"
                        onClick={() => setIsEditingMode((prev) => !prev)}
                        style={{
                          background: isEditingMode ? "rgba(99, 102, 241, 0.25)" : "rgba(255, 255, 255, 0.08)",
                          border: "1px solid rgba(99, 102, 241, 0.4)",
                          color: isEditingMode ? "#a5b4fc" : "var(--text)",
                          padding: "0.25rem 0.65rem",
                          borderRadius: "6px",
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                      >
                        {isEditingMode ? "👁️ View Mode" : "✏️ Edit Values"}
                      </button>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          padding: "0.2rem 0.6rem",
                          borderRadius: "9999px",
                          background: "rgba(99, 102, 241, 0.2)",
                          color: "#a5b4fc",
                          border: "1px solid rgba(99, 102, 241, 0.4)"
                        }}
                      >
                        NEW LEAD
                      </span>
                    </div>
                  </div>

                  {/* EDITABLE GRID */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.85rem", fontSize: "0.86rem", marginBottom: "1.1rem" }}>
                    {/* Student Name */}
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.72rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                        STUDENT NAME
                      </span>
                      {isEditingMode ? (
                        <input
                          type="text"
                          value={parsedLead.name || ""}
                          onChange={(e) => setParsedLead({ ...parsedLead, name: e.target.value })}
                          style={{
                            width: "100%",
                            padding: "0.45rem 0.65rem",
                            borderRadius: "6px",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            background: "rgba(0, 0, 0, 0.35)",
                            color: "inherit",
                            fontSize: "0.85rem",
                            boxSizing: "border-box"
                          }}
                        />
                      ) : (
                        <strong style={{ fontSize: "0.95rem" }}>{parsedLead.name || "—"}</strong>
                      )}
                    </div>

                    {/* Mobile */}
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.72rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                        MOBILE
                      </span>
                      {isEditingMode ? (
                        <input
                          type="text"
                          value={parsedLead.phone || ""}
                          onChange={(e) => setParsedLead({ ...parsedLead, phone: e.target.value })}
                          style={{
                            width: "100%",
                            padding: "0.45rem 0.65rem",
                            borderRadius: "6px",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            background: "rgba(0, 0, 0, 0.35)",
                            color: "inherit",
                            fontSize: "0.85rem",
                            boxSizing: "border-box"
                          }}
                        />
                      ) : (
                        <strong>{parsedLead.phone || "—"}</strong>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.72rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                        EMAIL
                      </span>
                      {isEditingMode ? (
                        <input
                          type="text"
                          value={parsedLead.email || ""}
                          onChange={(e) => setParsedLead({ ...parsedLead, email: e.target.value })}
                          style={{
                            width: "100%",
                            padding: "0.45rem 0.65rem",
                            borderRadius: "6px",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            background: "rgba(0, 0, 0, 0.35)",
                            color: "inherit",
                            fontSize: "0.85rem",
                            boxSizing: "border-box"
                          }}
                        />
                      ) : (
                        <span>{parsedLead.email || "—"}</span>
                      )}
                    </div>

                    {/* Course & Official Fee */}
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.72rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                        COURSE & OFFICIAL CATALOG FEE
                      </span>
                      {isEditingMode ? (
                        <div style={{ display: "flex", gap: "0.35rem" }}>
                          <input
                            type="text"
                            value={parsedLead.courseName || ""}
                            onChange={(e) => setParsedLead({ ...parsedLead, courseName: e.target.value })}
                            placeholder="Course Name"
                            style={{
                              flex: 2,
                              padding: "0.45rem 0.65rem",
                              borderRadius: "6px",
                              border: "1px solid rgba(255, 255, 255, 0.2)",
                              background: "rgba(0, 0, 0, 0.35)",
                              color: "inherit",
                              fontSize: "0.85rem"
                            }}
                          />
                          <input
                            type="number"
                            value={parsedLead.courseFee || 0}
                            onChange={(e) => setParsedLead({ ...parsedLead, courseFee: Number(e.target.value) || 0 })}
                            placeholder="₹ Fee"
                            style={{
                              flex: 1,
                              padding: "0.45rem 0.65rem",
                              borderRadius: "6px",
                              border: "1px solid rgba(255, 255, 255, 0.2)",
                              background: "rgba(0, 0, 0, 0.35)",
                              color: "#a855f7",
                              fontWeight: 700,
                              fontSize: "0.85rem"
                            }}
                          />
                        </div>
                      ) : (
                        <strong style={{ color: "#a855f7" }}>
                          {parsedLead.courseName} • ₹{Number(parsedLead.courseFee || 0).toLocaleString("en-IN")}
                        </strong>
                      )}
                    </div>

                    {/* Quality & Stage */}
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.72rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                        LEAD QUALITY & STAGE
                      </span>
                      {isEditingMode ? (
                        <div style={{ display: "flex", gap: "0.35rem" }}>
                          <select
                            value={parsedLead.quality || "Warm Lead"}
                            onChange={(e) => setParsedLead({ ...parsedLead, quality: e.target.value })}
                            style={{
                              flex: 1,
                              padding: "0.45rem 0.5rem",
                              borderRadius: "6px",
                              border: "1px solid rgba(255, 255, 255, 0.2)",
                              background: "rgba(0, 0, 0, 0.4)",
                              color: "inherit",
                              fontSize: "0.82rem"
                            }}
                          >
                            <option value="Hot Lead">Hot Lead</option>
                            <option value="Warm Lead">Warm Lead</option>
                            <option value="Cold Lead">Cold Lead</option>
                          </select>
                          <select
                            value={parsedLead.stage || "Contacted"}
                            onChange={(e) => setParsedLead({ ...parsedLead, stage: e.target.value })}
                            style={{
                              flex: 1,
                              padding: "0.45rem 0.5rem",
                              borderRadius: "6px",
                              border: "1px solid rgba(255, 255, 255, 0.2)",
                              background: "rgba(0, 0, 0, 0.4)",
                              color: "inherit",
                              fontSize: "0.82rem"
                            }}
                          >
                            <option value="New">New</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Follow-up Scheduled">Follow-up</option>
                            <option value="Interested">Interested</option>
                            <option value="Enrolled">Enrolled</option>
                            <option value="Lost">Lost</option>
                          </select>
                        </div>
                      ) : (
                        <span>{parsedLead.quality} ({parsedLead.stage})</span>
                      )}
                    </div>

                    {/* Follow-up Date & Time */}
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.72rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                        FOLLOW-UP DATE & TIME
                      </span>
                      {isEditingMode ? (
                        <div style={{ display: "flex", gap: "0.35rem" }}>
                          <input
                            type="date"
                            value={parsedLead.followUpDate || ""}
                            onChange={(e) => setParsedLead({ ...parsedLead, followUpDate: e.target.value })}
                            style={{
                              flex: 1.2,
                              padding: "0.45rem 0.5rem",
                              borderRadius: "6px",
                              border: "1px solid rgba(255, 255, 255, 0.2)",
                              background: "rgba(0, 0, 0, 0.4)",
                              color: "inherit",
                              fontSize: "0.82rem"
                            }}
                          />
                          <input
                            type="text"
                            placeholder="e.g. 04:00 PM"
                            value={parsedLead.followUpTime || ""}
                            onChange={(e) => setParsedLead({ ...parsedLead, followUpTime: e.target.value })}
                            style={{
                              flex: 1,
                              padding: "0.45rem 0.5rem",
                              borderRadius: "6px",
                              border: "1px solid rgba(255, 255, 255, 0.2)",
                              background: "rgba(0, 0, 0, 0.4)",
                              color: "inherit",
                              fontSize: "0.82rem"
                            }}
                          />
                        </div>
                      ) : (
                        <span style={{ color: "#38bdf8", fontWeight: 600 }}>
                          {parsedLead.followUpDate || "None"} at {parsedLead.followUpTime || "11:00 AM"}
                        </span>
                      )}
                    </div>

                    {/* Pipeline Scope (Subham Self vs Colleague) */}
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.72rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                        PIPELINE SCOPE
                      </span>
                      {isEditingMode ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                          <select
                            value={parsedLead.leadScope || "my_lead"}
                            onChange={(e) => {
                              const scope = e.target.value;
                              setParsedLead({
                                ...parsedLead,
                                leadScope: scope,
                                colleagueName: scope === "my_lead" ? "" : (parsedLead.colleagueName || "Colleague")
                              });
                            }}
                            style={{
                              width: "100%",
                              padding: "0.45rem 0.65rem",
                              borderRadius: "6px",
                              border: "1px solid rgba(255, 255, 255, 0.2)",
                              background: "rgba(0, 0, 0, 0.4)",
                              color: "inherit",
                              fontSize: "0.82rem"
                            }}
                          >
                            <option value="my_lead">👤 My Active Pipeline (Subham)</option>
                            <option value="colleague_lead">👥 Colleague's Pool</option>
                          </select>
                          {parsedLead.leadScope === "colleague_lead" && (
                            <input
                              type="text"
                              placeholder="Colleague Name (e.g. Arun, Sakshi)"
                              value={parsedLead.colleagueName || ""}
                              onChange={(e) => setParsedLead({ ...parsedLead, colleagueName: e.target.value })}
                              style={{
                                width: "100%",
                                padding: "0.45rem 0.65rem",
                                borderRadius: "6px",
                                border: "1px solid rgba(255, 255, 255, 0.2)",
                                background: "rgba(0, 0, 0, 0.35)",
                                color: "inherit",
                                fontSize: "0.82rem",
                                boxSizing: "border-box"
                              }}
                            />
                          )}
                        </div>
                      ) : (
                        <span style={{ color: parsedLead.leadScope === "colleague_lead" ? "#f59e0b" : "#38bdf8", fontWeight: 700 }}>
                          {parsedLead.leadScope === "colleague_lead"
                            ? `👥 Colleague's Pool (${parsedLead.colleagueName || "Colleague"})`
                            : "👤 My Active Pipeline (Subham)"}
                        </span>
                      )}
                    </div>

                    {/* Pinned Note */}
                    <div style={{ gridColumn: "1 / -1" }}>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.72rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                        PINNED REMINDER NOTE
                      </span>
                      {isEditingMode ? (
                        <textarea
                          rows={2}
                          value={parsedLead.reminderNote || ""}
                          onChange={(e) => setParsedLead({ ...parsedLead, reminderNote: e.target.value })}
                          style={{
                            width: "100%",
                            padding: "0.5rem 0.65rem",
                            borderRadius: "6px",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            background: "rgba(0, 0, 0, 0.35)",
                            color: "inherit",
                            fontSize: "0.84rem",
                            boxSizing: "border-box",
                            resize: "vertical"
                          }}
                        />
                      ) : (
                        <span style={{ color: "var(--text2)", lineHeight: 1.4 }}>{parsedLead.reminderNote || "None"}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={handleSaveAndOpenLead}
                      disabled={savingLead}
                      style={{
                        background: "linear-gradient(135deg, #059669, #10b981)",
                        color: "#ffffff",
                        border: "none",
                        padding: "0.65rem 1.3rem",
                        borderRadius: "8px",
                        fontWeight: 800,
                        fontSize: "0.88rem",
                        cursor: savingLead ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)"
                      }}
                    >
                      {savingLead ? "Saving..." : "💾 Save to CRM & Open Lead ➔"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingMode((prev) => !prev)}
                      style={{
                        background: "rgba(255, 255, 255, 0.08)",
                        color: "inherit",
                        border: "1px solid rgba(255, 255, 255, 0.18)",
                        padding: "0.65rem 1rem",
                        borderRadius: "8px",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        cursor: "pointer"
                      }}
                    >
                      {isEditingMode ? "✓ Done Editing" : "✏️ Edit Values"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate("/add", { state: { prefilledLead: parsedLead } });
                      }}
                      style={{
                        background: "transparent",
                        color: "var(--text3)",
                        border: "none",
                        padding: "0.65rem 0.75rem",
                        fontSize: "0.82rem",
                        cursor: "pointer",
                        textDecoration: "underline"
                      }}
                    >
                      Open in Full Add Form
                    </button>
                  </div>
                </div>
              )}

              {/* CASE 3: PASTE BOX (When not found in DB or ready to paste JSON) */}
              {!existingLead && !parsedLead && (
                <div
                  style={{
                    background: "rgba(0, 0, 0, 0.15)",
                    border: "1px dashed rgba(255, 255, 255, 0.15)",
                    borderRadius: "12px",
                    padding: "1rem"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text2)" }}>
                      Paste Portal JSON To Save Directly:
                    </label>
                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--accent, #6366f1)",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      📋 Paste from Clipboard
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    placeholder='Paste portal JSON here (e.g. {"id": 9640547, "name": "Mehak", "course": "SSBB", "mobile": "9591804134"})...'
                    value={rawText}
                    onChange={(e) => {
                      setRawText(e.target.value);
                      try {
                        const parsed = JSON.parse(e.target.value);
                        runAiAnalysis(parsed, e.target.value);
                      } catch (err) {}
                    }}
                    style={{
                      width: "100%",
                      padding: "0.65rem",
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
                  <div style={{ marginTop: "0.6rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.74rem", color: "var(--text3)" }}>
                      AI automatically maps Course, Official Fee & your Active Pipeline.
                    </span>
                    {rawText.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            const parsed = JSON.parse(rawText);
                            runAiAnalysis(parsed, rawText);
                          } catch (e) {
                            runAiAnalysis(null, rawText);
                          }
                        }}
                        style={{
                          background: "var(--accent, #6366f1)",
                          color: "#fff",
                          border: "none",
                          padding: "0.45rem 0.9rem",
                          borderRadius: "6px",
                          fontWeight: 700,
                          fontSize: "0.8rem",
                          cursor: "pointer"
                        }}
                      >
                        ⚡ Parse & Save
                      </button>
                    )}
                  </div>
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
                  📝 Call Notes & Timeline History
                </h3>
                <textarea
                  rows={4}
                  placeholder="Paste or write notes from call report (e.g. prospect discussion, objections, fee pitch)..."
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.8rem",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    background: "rgba(0, 0, 0, 0.25)",
                    color: "inherit",
                    fontSize: "0.85rem",
                    outline: "none",
                    boxSizing: "border-box",
                    resize: "vertical"
                  }}
                />
                <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={handleLogCallNotes}
                    disabled={loggingCall || !existingLead}
                    style={{
                      background: "var(--accent, #6366f1)",
                      color: "#ffffff",
                      border: "none",
                      padding: "0.55rem 1.15rem",
                      borderRadius: "8px",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: loggingCall || !existingLead ? "not-allowed" : "pointer"
                    }}
                  >
                    {loggingCall ? "Logging..." : "📝 Log to Lead History"}
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
