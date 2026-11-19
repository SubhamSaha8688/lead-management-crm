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
  const [rawText, setRawText] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [savingLead, setSavingLead] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab || "lead"); // "lead" | "call" | "bookmarklet"
  const [audioUrl, setAudioUrl] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [loggingCall, setLoggingCall] = useState(false);
  const [sessionCookie, setSessionCookie] = useState(() => localStorage.getItem("hh_session_cookie") || "");
  const [showCookieInput, setShowCookieInput] = useState(false);
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

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

  // The 1-click Bookmarklet script to sync directly from the user's logged-in Henry Harvin tab
  const bookmarkletCode = `javascript:(function(){try{const rawText=document.body.innerText;let data=null;try{data=JSON.parse(rawText);}catch(e){}const apiEndpoint="${window.location.origin}/api/leads/ai-portal-sync";fetch(apiEndpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({rawText:rawText.slice(0,5000),portalData:data,action:"save_or_update"})}).then(r=>r.json()).then(res=>{if(res.success){alert("✅ "+(res.updated?"Updated Existing Lead: ":"Saved New Lead: ")+(res.data?.name||"Lead")+"\\nCourse: "+(res.data?.enrolledCourses?.[0]?.courseName||"")+" (Fee: ₹"+(res.data?.enrolledCourses?.[0]?.fee||0)+")");}else{alert("⚠️ CRM Sync: "+(res.message||"Failed"));}}).catch(err=>{alert("Sync error: "+err.message);});}catch(err){alert("Bookmarklet error: "+err.message);}})();`;

  // Run Deep AI Analysis & Duplicate Check on portal data
  const runAiAnalysis = async (portalDataObj, rawString = "") => {
    try {
      setAnalyzingAi(true);
      setErrorMsg("");
      setStatusMsg("🤖 High-Level AI is analyzing course fee, notes, follow-up, and checking for duplicates...");

      const res = await axios.post("/api/leads/ai-portal-sync", {
        portalData: portalDataObj,
        rawText: rawString,
        action: "analyze"
      });

      if (res.data && res.data.success) {
        setParsedLead(res.data.data);
        setExistingLead(res.data.existingLead || null);

        if (res.data.isDuplicate) {
          setStatusMsg(`⚠️ DUPLICATE DETECTED: This lead already exists in your database as "${res.data.existingLead.name}".`);
        } else {
          setStatusMsg("✓ AI Analysis Complete! Official course fee and follow-up intelligently resolved.");
        }
      }
    } catch (err) {
      console.warn("AI analysis error:", err);
      setErrorMsg("AI Analysis error: " + (err.response?.data?.message || err.message));
    } finally {
      setAnalyzingAi(false);
    }
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
      const res = await axios.post("/api/leads/fetch-portal-lead", {
        leadId,
        sessionCookie: sessionCookie.trim()
      });

      if (res.data) {
        setExistingLead(res.data.existingLead || null);

        if (res.data.data) {
          // Send to AI for deep normalization
          await runAiAnalysis(res.data.raw || res.data.data);
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

  // Read clipboard and run AI automatically
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

      // Check if it's JSON or key-value dump
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
        if (parsedJson.id && !leadId) setLeadId(String(parsedJson.id));
        await runAiAnalysis(parsedJson, clean);
      } else {
        await runAiAnalysis(null, clean);
      }
    } catch (err) {
      setErrorMsg("Clipboard permission denied. Please paste manually into the text box.");
    }
  };

  // Save as BRAND NEW lead (blocked if duplicate exists!)
  const handleSaveAsNewLead = async () => {
    if (!parsedLead) return;
    try {
      setSavingLead(true);
      setErrorMsg("");

      const res = await axios.post("/api/leads/ai-portal-sync", {
        portalData: parsedLead,
        action: "save_new"
      });

      if (res.data && res.data.success) {
        setStatusMsg("🎉 New Lead successfully created in CRM with official course fee!");
        setExistingLead(res.data.data);
      }
    } catch (err) {
      setErrorMsg("Cannot save lead: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingLead(false);
    }
  };

  // Update EXISTING lead (Zero duplicates created!)
  const handleUpdateExistingLead = async () => {
    if (!parsedLead || !existingLead) return;
    try {
      setSavingLead(true);
      setErrorMsg("");

      const res = await axios.post("/api/leads/ai-portal-sync", {
        portalData: parsedLead,
        action: "update_existing"
      });

      if (res.data && res.data.success) {
        setStatusMsg("✓ Existing Lead successfully updated with latest portal follow-up & notes (Zero Duplicates)!");
        setExistingLead(res.data.data);
      }
    } catch (err) {
      setErrorMsg("Failed to update lead: " + (err.response?.data?.message || err.message));
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

  // Save session cookie to localStorage
  const handleSaveCookie = () => {
    localStorage.setItem("hh_session_cookie", sessionCookie.trim());
    setStatusMsg("✓ Henry Harvin session cookie saved for automatic background fetching!");
    setShowCookieInput(false);
    setTimeout(() => setStatusMsg(""), 3500);
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
          maxWidth: "780px",
          maxHeight: "92vh",
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
                Henry Harvin CRM Hub
              </h2>
              <span style={{ fontSize: "0.74rem", color: "var(--text3, #94a3b8)" }}>
                High-Level AI Sync • Auto-Resolve Fees • Duplicate Protection • Audio Streaming
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
            👤 Lead Details & AI Sync
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
            📞 Call Report & Audio Hub
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bookmarklet")}
            style={{
              flex: 1,
              padding: "0.75rem 1rem",
              background: activeTab === "bookmarklet" ? "rgba(245, 158, 11, 0.15)" : "transparent",
              color: activeTab === "bookmarklet" ? "#f59e0b" : "var(--text2)",
              border: "none",
              borderBottom: activeTab === "bookmarklet" ? "2px solid #f59e0b" : "2px solid transparent",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer"
            }}
          >
            🔖 1-Click Sync Bookmarklet
          </button>
        </div>

        {/* MODAL BODY */}
        <div style={{ padding: "1.2rem 1.4rem", overflowY: "auto", flex: 1 }}>
          {/* Status / Error feedback alerts */}
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
                background: statusMsg.includes("DUPLICATE")
                  ? "rgba(245, 158, 11, 0.15)"
                  : "rgba(16, 185, 129, 0.15)",
                border: statusMsg.includes("DUPLICATE")
                  ? "1px solid rgba(245, 158, 11, 0.4)"
                  : "1px solid rgba(16, 185, 129, 0.35)",
                color: statusMsg.includes("DUPLICATE") ? "#fbbf24" : "#34d399",
                padding: "0.65rem 0.9rem",
                borderRadius: "8px",
                fontSize: "0.84rem",
                marginBottom: "1rem"
              }}
            >
              {statusMsg}
            </div>
          )}

          {/* TAB 1: LEAD DETAILS & AI SYNC */}
          {activeTab === "lead" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              {/* Input Section */}
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: "0.35rem", color: "var(--text2)" }}>
                  Enter Lead ID or Paste Portal URL:
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="text"
                    placeholder="e.g. 9640625, 8495779, or crm.henryharvin.com/...id=9640625"
                    value={leadInput}
                    onChange={(e) => setLeadInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleFetchPortal();
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
                    onClick={handleFetchPortal}
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
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {loading ? "Checking..." : analyzingAi ? "🤖 AI Analyzing..." : "⚡ Check Portal"}
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
                    📋 Paste JSON
                  </button>
                </div>
              </div>

              {/* Quick Links & Direct Browser Actions */}
              {leadId && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    flexWrap: "wrap",
                    padding: "0.65rem 0.85rem",
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
                    🌐 Lead Details (JSON) ↗
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

              {/* DUPLICATE LEAD ALERT BANNER */}
              {existingLead && (
                <div
                  style={{
                    background: "linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(217, 119, 6, 0.1))",
                    border: "1.5px solid rgba(245, 158, 11, 0.45)",
                    borderRadius: "12px",
                    padding: "0.9rem 1.1rem"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                    <span style={{ fontSize: "1.2rem" }}>⚠️</span>
                    <strong style={{ color: "#fbbf24", fontSize: "0.92rem" }}>
                      Duplicate Lead Detected in Your Database
                    </strong>
                  </div>
                  <p style={{ margin: "0 0 0.65rem 0", fontSize: "0.82rem", color: "var(--text2)", lineHeight: 1.4 }}>
                    A lead already exists for <strong>{existingLead.name}</strong> (Lead ID: <code>{existingLead.leadId}</code>
                    {existingLead.phone ? ` • Mobile: ${existingLead.phone}` : ""}).
                    To keep your pipeline clean, update this lead directly instead of creating a duplicate!
                  </p>
                  <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={handleUpdateExistingLead}
                      disabled={savingLead}
                      style={{
                        background: "linear-gradient(135deg, #d97706, #b45309)",
                        color: "#ffffff",
                        border: "none",
                        padding: "0.5rem 1rem",
                        borderRadius: "8px",
                        fontWeight: 700,
                        fontSize: "0.84rem",
                        cursor: savingLead ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem"
                      }}
                    >
                      {savingLead ? "Updating..." : "🔄 Update Existing Lead (No Duplicate)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate(`/lead/${existingLead._id || existingLead.leadId}`);
                      }}
                      style={{
                        background: "rgba(255, 255, 255, 0.08)",
                        color: "inherit",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        padding: "0.5rem 0.85rem",
                        borderRadius: "8px",
                        fontWeight: 600,
                        fontSize: "0.82rem",
                        cursor: "pointer"
                      }}
                    >
                      🔗 View in CRM
                    </button>
                  </div>
                </div>
              )}

              {/* AI STRUCTURED PREVIEW CARD */}
              {parsedLead ? (
                <div
                  style={{
                    background: "rgba(0, 0, 0, 0.22)",
                    border: "1px solid rgba(99, 102, 241, 0.35)",
                    borderRadius: "12px",
                    padding: "1.1rem"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span style={{ fontSize: "1rem" }}>🤖</span>
                      <strong style={{ fontSize: "0.92rem", color: "#818cf8" }}>
                        AI-Resolved Lead Details
                      </strong>
                    </div>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        padding: "0.2rem 0.6rem",
                        borderRadius: "9999px",
                        background: existingLead ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.2)",
                        color: existingLead ? "#fbbf24" : "#34d399",
                        border: existingLead ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(16, 185, 129, 0.4)"
                      }}
                    >
                      {existingLead ? "EXISTING RECORD" : "NEW RECORD"}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.75rem", fontSize: "0.86rem" }}>
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.72rem", fontWeight: 700 }}>STUDENT NAME</span>
                      <strong>{parsedLead.name || "—"}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.72rem", fontWeight: 700 }}>MOBILE</span>
                      <strong>{parsedLead.phone || "—"}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.72rem", fontWeight: 700 }}>EMAIL</span>
                      <span>{parsedLead.email || "—"}</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.72rem", fontWeight: 700 }}>COURSE & OFFICIAL CATALOG FEE</span>
                      <strong style={{ color: "#a855f7" }}>
                        {parsedLead.courseName} • ₹{Number(parsedLead.courseFee || 0).toLocaleString("en-IN")}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.72rem", fontWeight: 700 }}>LEAD QUALITY & STAGE</span>
                      <span>{parsedLead.quality} ({parsedLead.stage})</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.72rem", fontWeight: 700 }}>SCHEDULED FOLLOW-UP</span>
                      <span style={{ color: "#38bdf8", fontWeight: 600 }}>
                        {parsedLead.followUpDate || "None"} at {parsedLead.followUpTime || "11:00 AM"}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.72rem", fontWeight: 700 }}>PIPELINE SCOPE</span>
                      <span style={{ color: parsedLead.leadScope === "colleague_lead" ? "#f59e0b" : "#38bdf8", fontWeight: 600 }}>
                        {parsedLead.leadScope === "colleague_lead"
                          ? `👥 Colleague's Pool (${parsedLead.colleagueName || "Colleague"})`
                          : "👤 My Active Pipeline"}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: "var(--text2)", display: "block", fontSize: "0.72rem", fontWeight: 700 }}>PINNED NOTE & TIMELINE</span>
                      <span style={{ color: "var(--text2)" }}>{parsedLead.reminderNote || "None"}</span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div style={{ marginTop: "1.2rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                    {!existingLead ? (
                      <button
                        type="button"
                        onClick={handleSaveAsNewLead}
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
                        {savingLead ? "Saving..." : "💾 Save as New Lead (AI Verified)"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleUpdateExistingLead}
                        disabled={savingLead}
                        style={{
                          background: "linear-gradient(135deg, #d97706, #b45309)",
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
                        {savingLead ? "Updating..." : "🔄 Update Existing Lead (No Duplicate)"}
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
                    <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text2)" }}>
                      Or Paste Copied JSON / Portal Record Below:
                    </label>
                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--accent, #6366f1)",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      Paste from Clipboard 📋
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    placeholder='Paste portal JSON block here (e.g. {"id": 9640625, "name": "Raghavendra Rao", "course": "SSBB", "mobile": "9480703611"})...'
                    value={rawText}
                    onChange={(e) => {
                      setRawText(e.target.value);
                      try {
                        const parsed = JSON.parse(e.target.value);
                        runAiAnalysis(parsed, e.target.value);
                      } catch (err) {
                        // wait for user to finish pasting
                      }
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
                </div>
              )}

              {/* Optional Henry Harvin Session Cookie */}
              <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => setShowCookieInput((p) => !p)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text3)",
                    fontSize: "0.76rem",
                    cursor: "pointer",
                    textDecoration: "underline"
                  }}
                >
                  {showCookieInput ? "▲ Hide Session Cookie Setting" : "▼ Henry Harvin Session Cookie (Optional for 1-Click Background Fetch)"}
                </button>
                {showCookieInput && (
                  <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
                    <input
                      type="text"
                      placeholder="Paste your ci_session or cookie string from Henry Harvin browser tab..."
                      value={sessionCookie}
                      onChange={(e) => setSessionCookie(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "0.5rem 0.75rem",
                        borderRadius: "6px",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        background: "rgba(0, 0, 0, 0.2)",
                        color: "inherit",
                        fontSize: "0.78rem"
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSaveCookie}
                      style={{
                        background: "var(--accent)",
                        color: "#fff",
                        border: "none",
                        padding: "0.5rem 0.85rem",
                        borderRadius: "6px",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      Save Cookie
                    </button>
                  </div>
                )}
              </div>
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

          {/* TAB 3: 1-CLICK BOOKMARKLET */}
          {activeTab === "bookmarklet" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(99, 102, 241, 0.1))",
                  border: "1px solid rgba(245, 158, 11, 0.35)",
                  borderRadius: "12px",
                  padding: "1.25rem"
                }}
              >
                <h3 style={{ margin: "0 0 0.4rem 0", fontSize: "1.05rem", fontWeight: 800, color: "#f59e0b" }}>
                  ⚡ 1-Click Sync Directly From Henry Harvin
                </h3>
                <p style={{ margin: "0 0 1rem 0", fontSize: "0.84rem", color: "var(--text2)", lineHeight: 1.5 }}>
                  Since you are already logged in to Henry Harvin in your browser, you can sync ANY lead directly with a single click — without ever copying JSON or taking screenshots!
                </p>

                {/* Draggable Bookmark Button */}
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                  <a
                    href={bookmarkletCode}
                    onClick={(e) => e.preventDefault()}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      background: "#f59e0b",
                      color: "#000000",
                      padding: "0.65rem 1.25rem",
                      borderRadius: "8px",
                      fontWeight: 800,
                      fontSize: "0.88rem",
                      textDecoration: "none",
                      cursor: "grab",
                      boxShadow: "0 4px 12px rgba(245, 158, 11, 0.35)"
                    }}
                    title="Drag me to your Bookmarks Bar!"
                  >
                    <span>⚡</span> Drag to Bookmarks: <strong>Sync to CRM</strong>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(bookmarkletCode);
                      setCopiedBookmarklet(true);
                      setTimeout(() => setCopiedBookmarklet(false), 3000);
                    }}
                    style={{
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      color: "inherit",
                      padding: "0.65rem 1rem",
                      borderRadius: "8px",
                      fontSize: "0.84rem",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    {copiedBookmarklet ? "✓ Copied to Clipboard!" : "📋 Copy Bookmarklet Script"}
                  </button>
                </div>

                <div
                  style={{
                    background: "rgba(0, 0, 0, 0.25)",
                    borderRadius: "8px",
                    padding: "0.85rem",
                    fontSize: "0.8rem",
                    color: "var(--text2)",
                    lineHeight: 1.6
                  }}
                >
                  <strong style={{ color: "#ffffff", display: "block", marginBottom: "0.2rem" }}>
                    How to use in 3 seconds:
                  </strong>
                  1. Drag the yellow <strong>"Sync to CRM"</strong> button above up to your Chrome Bookmarks Bar (or paste into a new bookmark).<br />
                  2. Whenever you open any lead on <code>crm.henryharvin.com/portal-new/get_lead_contact_details?id=...</code>, click the <strong>Sync to CRM</strong> bookmark.<br />
                  3. Our High-Level AI will instantly parse the course fee, notes, follow-up, and save or update it in your database with <strong>Zero Duplicates</strong>!
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
