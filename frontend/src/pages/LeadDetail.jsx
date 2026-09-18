import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { getWhatsAppUrl, generateWhatsAppMessage, renderWhatsAppTemplate } from "../utils/whatsapp";
import { useWhatsAppBar } from "../context/WhatsAppBarContext";
import { useEmailBar } from "../context/EmailBarContext";
import { useCallStatus } from "../context/CallStatusContext";
import { invalidateLeadsCache } from "../utils/leadCache";
import {
  formatDateDisplay,
  formatDateTimeDisplay,
  formatTime12,
  cleanPhone,
  formatRupees,
  getFollowUpStatus,
  isTodayDate
} from "../utils/dateUtils";

export default function LeadDetail({ onDataChange }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { initiateCall } = useCallStatus();

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // New Comment Form
  const [commentText, setCommentText] = useState("");
  const [selectedOutcome, setSelectedOutcome] = useState("Connected — Interested");
  const [addingComment, setAddingComment] = useState(false);

  // Post-Call Follow-up Scheduler inside interaction section
  const [showFollowUpPrompt, setShowFollowUpPrompt] = useState(false);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("11:00");
  const [schedNextAction, setSchedNextAction] = useState("");
  const [scheduling, setScheduling] = useState(false);

  // Inline Comment Editing
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [editCommentOutcome, setEditCommentOutcome] = useState("");
  const [savingCommentEdit, setSavingCommentEdit] = useState(false);

  // Delete Comment Confirmation
  const [commentToDelete, setCommentToDelete] = useState(null);
  const [deletingComment, setDeletingComment] = useState(false);

  // Quick Reschedule Popover
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [savingReschedule, setSavingReschedule] = useState(false);

  // Delete Lead Modal
  const [showDeleteLeadModal, setShowDeleteLeadModal] = useState(false);
  const [deletingLead, setDeletingLead] = useState(false);

  // WhatsApp quick templates popover & WhatsApp Bar
  const [showWaMenu, setShowWaMenu] = useState(false);
  const { openWhatsAppBar, templates } = useWhatsAppBar();
  const { openEmailBar, templates: emailTemplates } = useEmailBar();

  // Toast message
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const fetchLead = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`/api/leads/${id}`);
      if (res.data && res.data.success) {
        setLead(res.data.data);
      }
    } catch (err) {
      setError("Lead not found or unable to load details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLead();
  }, [id]);

  // One-tap Stage Update via PATCH /api/leads/:id/quick
  const handleStageChange = async (newStage) => {
    if (!lead || lead.stage === newStage) return;
    try {
      const res = await axios.patch(`/api/leads/${lead._id}/quick`, {
        stage: newStage
      });
      if (res.data && res.data.success) {
        invalidateLeadsCache();
        setLead(res.data.data);
        showToast(`Stage updated to ${newStage}`);
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      alert("Failed to update stage: " + (err.response?.data?.message || err.message));
    }
  };

  // Call click handler: triggers silent Ozonetel call + displays side widget & logs call
  const handleCallClick = async () => {
    if (!lead || !lead.phone) {
      alert("No phone number available for this lead.");
      return;
    }

    try {
      const updated = await initiateCall(lead, (updatedLead) => {
        invalidateLeadsCache();
        setLead(updatedLead);
        if (onDataChange) onDataChange();
      });

      if (updated && updated.callCount) {
        showToast(`📞 Dialing ${lead.name} via Ozonetel... (Call #${updated.callCount})`);
      } else {
        showToast(`📞 Dialing ${lead.name} via Ozonetel...`);
      }
    } catch (err) {
      console.error("Failed to initiate call:", err);
      showToast(`📞 Calling ${lead.name} via Ozonetel...`);
    }
  };

  // Quick Reschedule Save
  const handleSaveReschedule = async () => {
    if (!lead) return;
    try {
      setSavingReschedule(true);
      const res = await axios.patch(`/api/leads/${lead._id}/quick`, {
        followUpDate: rescheduleDate ? new Date(rescheduleDate) : null,
        followUpTime: rescheduleTime ? rescheduleTime.trim() : ""
      });

      if (res.data && res.data.success) {
        invalidateLeadsCache();
        setLead(res.data.data);
        showToast("Follow-up rescheduled.");
        setShowRescheduleModal(false);
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      alert("Failed to reschedule: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingReschedule(false);
    }
  };

  // ADD INTERACTION: Uses POST /api/leads/:id/comments ($push)
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      setAddingComment(true);
      const res = await axios.post(`/api/leads/${lead._id}/comments`, {
        text: commentText.trim(),
        outcome: selectedOutcome
      });

      if (res.data && res.data.success) {
        invalidateLeadsCache();
        setLead(res.data.data);
        setCommentText("");
        showToast("Interaction added to permanent history.");
        setShowFollowUpPrompt(true); // Offer immediate next follow-up scheduling
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      alert("Failed to add interaction: " + (err.response?.data?.message || err.message));
    } finally {
      setAddingComment(false);
    }
  };

  // POST-CALL QUICK SCHEDULER: Set next follow-up right after interaction
  const handlePostCallSchedule = async () => {
    try {
      setScheduling(true);
      const updateData = {
        followUpDate: schedDate ? new Date(schedDate) : null,
        followUpTime: schedTime ? schedTime.trim() : ""
      };

      const res = await axios.patch(`/api/leads/${lead._id}/quick`, updateData);
      if (res.data && res.data.success) {
        invalidateLeadsCache();
        setLead(res.data.data);
        showToast("Next follow-up scheduled.");
        setShowFollowUpPrompt(false);
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      alert("Failed to schedule: " + (err.response?.data?.message || err.message));
    } finally {
      setScheduling(false);
    }
  };

  // INLINE COMMENT EDIT: PATCH /api/leads/:id/comments/:commentId
  const handleSaveCommentEdit = async (commentId) => {
    if (!editCommentText.trim()) return;
    try {
      setSavingCommentEdit(true);
      const res = await axios.patch(`/api/leads/${lead._id}/comments/${commentId}`, {
        text: editCommentText.trim(),
        outcome: editCommentOutcome
      });

      if (res.data && res.data.success) {
        invalidateLeadsCache();
        setLead(res.data.data);
        setEditingCommentId(null);
        showToast("Interaction updated.");
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      alert("Failed to update comment: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingCommentEdit(false);
    }
  };

  // DELETE COMMENT: DELETE /api/leads/:id/comments/:commentId
  const handleDeleteCommentConfirm = async () => {
    if (!commentToDelete) return;
    try {
      setDeletingComment(true);
      const res = await axios.delete(
        `/api/leads/${lead._id}/comments/${commentToDelete.commentId}`
      );

      if (res.data && res.data.success) {
        invalidateLeadsCache();
        setLead(res.data.data);
        setCommentToDelete(null);
        showToast("Interaction deleted.");
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      alert("Failed to delete comment: " + (err.response?.data?.message || err.message));
    } finally {
      setDeletingComment(false);
    }
  };

  // DELETE LEAD: DELETE /api/leads/:id
  const handleDeleteLeadConfirm = async () => {
    try {
      setDeletingLead(true);
      const res = await axios.delete(`/api/leads/${lead._id}`);
      if (res.data && res.data.success) {
        invalidateLeadsCache();
        if (onDataChange) onDataChange();
        navigate("/");
      }
    } catch (err) {
      alert("Failed to delete lead: " + (err.response?.data?.message || err.message));
      setDeletingLead(false);
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ textAlign: "center", padding: "4rem" }}>
        Loading lead details...
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="page" style={{ textAlign: "center", padding: "4rem" }}>
        <h2 style={{ color: "var(--danger)", marginBottom: "1rem" }}>⚠️ Lead Not Found</h2>
        <p style={{ color: "var(--text2)", marginBottom: "1.5rem" }}>
          The requested lead does not exist or has been removed.
        </p>
        <Link to="/" className="btn btn-primary">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const pipelineStages = ["New", "Contacted", "Interested", "Negotiation", "Converted", "Lost"];
  const outcomeOptions = [
    "Connected — Interested",
    "Connected — Call Back",
    "Not Connected",
    "Switched Off",
    "Voicemail",
    "Rescheduled",
    "Not Interested"
  ];

  const followUpStatus = getFollowUpStatus(lead);
  const cleaned = cleanPhone(lead.phone);

  // Comments sorted newest first
  const sortedComments = [...(lead.comments || [])].sort((a, b) => {
    return new Date(b.addedAt) - new Date(a.addedAt);
  });

  return (
    <div className="page">
      {/* Toast */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "1.5rem",
            right: "1.5rem",
            background: "#059669",
            color: "#ffffff",
            padding: "0.75rem 1.25rem",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-lg)",
            fontWeight: 600,
            zIndex: 1200
          }}
        >
          ✓ {toastMessage}
        </div>
      )}

      {/* Top Breadcrumb Navigation */}
      <div style={{ marginBottom: "1rem" }}>
        <Link
          to="/"
          style={{
            fontSize: "0.88rem",
            color: "var(--accent)",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem"
          }}
        >
          ← Back to Calling Queue & Dashboard
        </Link>
      </div>

      {/* HEADER SECTION */}
      <div
        className="card-padded"
        style={{
          marginBottom: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem"
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text)" }}>
              {lead.name}
            </h1>
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                background: "var(--surface2)",
                padding: "0.2rem 0.6rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)"
              }}
            >
              {lead.leadId}
            </span>
            <span className={`badge badge-hot`} style={{ fontSize: "0.75rem" }}>
              {lead.quality}
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "0.2rem 0.5rem",
                borderRadius: "9999px",
                background: "#ea580c",
                color: "#ffffff"
              }}
            >
              P{lead.priority}
            </span>
            <span style={{ fontSize: "0.85rem", color: "var(--text3)" }}>
              via {lead.source}
            </span>
          </div>

          <div style={{ fontSize: "0.88rem", color: "var(--text2)", marginTop: "0.35rem" }}>
            📞 {lead.phone || "No phone"} • ✉️ {lead.email || "No email"}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleCallClick}
            className="btn btn-primary"
            title="Trigger Ozonetel Click-to-Call (requires Henry Harvin portal logged in)"
          >
            📞 Call via Ozonetel ({lead.callCount || 0})
          </button>

          {lead.phone && (
            <a
              href={`tel:${lead.phone}`}
              className="btn btn-outline"
              title="Direct dial from mobile phone"
            >
              📱 Direct Dial
            </a>
          )}

          {/* Email Templates Button */}
          <button
            type="button"
            className="btn"
            style={{
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              color: "#ffffff",
              border: "none",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem"
            }}
            onClick={() => navigate(`/emails?leadId=${lead._id}`)}
            title="Open Email Hub to compose via official Henry Harvin Outlook (subham.saha@henryharvin.in)"
          >
            <span>📧 Email</span>
          </button>

          {lead.phone && (
            <div style={{ display: "inline-flex", position: "relative" }}>
              <a
                href={getWhatsAppUrl(lead.phone, generateWhatsAppMessage(lead, "greeting"))}
                target="_blank"
                rel="noreferrer"
                className="btn btn-success"
                style={{
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0
                }}
                title="Directly opens WhatsApp Web with personalized greeting typed in chat box"
              >
                💬 WhatsApp
              </a>
              <button
                type="button"
                className="btn btn-success"
                style={{
                  padding: "0 0.55rem",
                  borderLeft: "1px solid rgba(255, 255, 255, 0.35)",
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0
                }}
                onClick={() => setShowWaMenu((prev) => !prev)}
                title="Select WhatsApp message template"
              >
                ▾
              </button>

              {showWaMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 5px)",
                    left: 0,
                    zIndex: 100,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.25)",
                    minWidth: "320px",
                    maxWidth: "380px",
                    maxHeight: "420px",
                    overflowY: "auto",
                    padding: "0.5rem 0"
                  }}
                >
                  <div
                    style={{
                      padding: "0.4rem 0.85rem",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      color: "var(--text3)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <span>Send Pre-Typed Message</span>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowWaMenu(false);
                          navigate(`/whatsapp?leadId=${lead._id}`);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#16a34a",
                          cursor: "pointer",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          padding: 0,
                          textDecoration: "underline"
                        }}
                      >
                        Full Hub ↗
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowWaMenu(false);
                          openWhatsAppBar(lead);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#64748b",
                          cursor: "pointer",
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          padding: 0,
                          textDecoration: "underline"
                        }}
                      >
                        Bar ↗
                      </button>
                    </div>
                  </div>

                  {/* List all templates dynamically */}
                  {templates && templates.map((t) => {
                    const rendered = renderWhatsAppTemplate(t.message, lead);
                    return (
                      <a
                        key={t._id}
                        href={getWhatsAppUrl(lead.phone, rendered)}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "block",
                          padding: "0.5rem 0.85rem",
                          color: "var(--text)",
                          textDecoration: "none",
                          fontSize: "0.85rem",
                          borderBottom: "1px solid var(--border)",
                          transition: "background 0.15s ease"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        onClick={() => setShowWaMenu(false)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <strong>{t.title}</strong>
                          <span
                            style={{
                              fontSize: "0.68rem",
                              background: "rgba(59, 130, 246, 0.12)",
                              color: "#2563eb",
                              padding: "0.1rem 0.4rem",
                              borderRadius: "10px",
                              fontWeight: 600
                            }}
                          >
                            {t.category || "General"}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text3)",
                            marginTop: "3px",
                            lineHeight: 1.3,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden"
                          }}
                        >
                          "{rendered}"
                        </div>
                      </a>
                    );
                  })}

                  <a
                    href={getWhatsAppUrl(lead.phone, "")}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "block",
                      padding: "0.5rem 0.85rem",
                      color: "var(--text2)",
                      textDecoration: "none",
                      fontSize: "0.82rem",
                      transition: "background 0.15s ease"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => setShowWaMenu(false)}
                  >
                    💬 <strong>Blank Chat</strong> (Empty message bar)
                  </a>

                  <div style={{ borderTop: "1px solid var(--border)", marginTop: "0.3rem", padding: "0.4rem 0.85rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowWaMenu(false);
                        navigate(`/whatsapp?leadId=${lead._id}`);
                      }}
                      style={{
                        width: "100%",
                        background: "#16a34a",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "0.45rem",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.35rem"
                      }}
                    >
                      <span>🚀</span> Open Full WhatsApp Hub & Editor
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowWaMenu(false);
                        openWhatsAppBar(lead);
                      }}
                      style={{
                        width: "100%",
                        background: "rgba(37, 211, 102, 0.08)",
                        color: "#15803d",
                        border: "1px dashed #25D366",
                        borderRadius: "6px",
                        padding: "0.35rem",
                        fontSize: "0.74rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.35rem"
                      }}
                    >
                      <span>💬</span> Quick Messages Drawer
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <Link to={`/edit/${lead._id}`} className="btn btn-secondary">
            ✏️ Edit Lead
          </Link>

          <button
            type="button"
            className="btn btn-outline"
            style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
            onClick={() => setShowDeleteLeadModal(true)}
          >
            🗑 Delete
          </button>
        </div>
      </div>

      {/* PIPELINE STEPPER */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text2)", marginBottom: "0.4rem" }}>
          PIPELINE PROGRESS (Click stage to advance)
        </div>
        <div className="pipeline-stepper">
          {pipelineStages.map((stg, idx) => {
            const isActive = lead.stage === stg;
            return (
              <React.Fragment key={stg}>
                <div
                  className={`pipeline-step ${isActive ? "active" : ""}`}
                  onClick={() => handleStageChange(stg)}
                  title={`Click to mark as ${stg}`}
                >
                  <span>{stg}</span>
                </div>
                {idx < pipelineStages.length - 1 && (
                  <span className="pipeline-arrow">→</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* NEXT FOLLOW-UP BANNER */}
      <div
        className="card"
        style={{
          padding: "1rem 1.25rem",
          marginBottom: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          background: "var(--surface2)",
          borderLeft:
            followUpStatus?.type === "overdue"
              ? "5px solid var(--danger)"
              : followUpStatus?.type === "duesoon"
              ? "5px solid var(--warn)"
              : "5px solid var(--success)"
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text3)"
            }}
          >
            NEXT FOLLOW-UP APPOINTMENT
          </div>

          {lead.followUpDate ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.2rem" }}>
              <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text)" }}>
                {formatDateDisplay(lead.followUpDate)} at {formatTime12(lead.followUpTime) || "Anytime"}
              </span>
              {followUpStatus && (
                <span
                  className={
                    followUpStatus.type === "overdue"
                      ? "status-overdue"
                      : followUpStatus.type === "duesoon"
                      ? "status-duesoon"
                      : "status-upcoming"
                  }
                >
                  {followUpStatus.label}
                </span>
              )}
            </div>
          ) : (
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text3)", marginTop: "0.2rem" }}>
              No follow-up appointment scheduled.
            </div>
          )}

          {lead.nextAction && (
            <div style={{ fontSize: "0.85rem", color: "var(--text2)", marginTop: "0.25rem" }}>
              <strong>Next Action:</strong> {lead.nextAction}
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            setShowRescheduleModal(true);
            setRescheduleDate(
              lead.followUpDate ? new Date(lead.followUpDate).toISOString().split("T")[0] : ""
            );
            setRescheduleTime(lead.followUpTime || "11:00");
          }}
        >
          ✏️ Quick Reschedule
        </button>
      </div>

      {/* STICKY REMINDER NOTE CARD */}
      {lead.reminderNote && (
        <div
          className="card"
          style={{
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#92400e"
          }}
        >
          <div style={{ fontWeight: 800, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            📌 PINNED REMINDER NOTE
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 600, marginTop: "0.35rem", lineHeight: 1.4 }}>
            {lead.reminderNote}
          </div>
        </div>
      )}

      {/* TWO-COLUMN DETAILS GRID */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "1.25rem",
          marginBottom: "1.5rem"
        }}
      >
        {/* Left Column: Contact & Dates */}
        <div className="card-padded">
          <h3 className="section-title">📋 Contact & Timeline</h3>
          <div className="detail-row">
            <span className="detail-label">Phone</span>
            <span className="detail-value">{lead.phone || "—"}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Email</span>
            <span className="detail-value">{lead.email || "—"}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Lead Source</span>
            <span className="detail-value">{lead.source}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Enquiry Date</span>
            <span className="detail-value">{formatDateDisplay(lead.enquiryDate)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Follow-up Date</span>
            <span className="detail-value">{formatDateDisplay(lead.followUpDate)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Follow-up Time</span>
            <span className="detail-value">{formatTime12(lead.followUpTime) || "—"}</span>
          </div>
        </div>

        {/* Right Column: Status & Sales Outcomes */}
        <div className="card-padded">
          <h3 className="section-title">🎯 Sales Metrics</h3>
          <div className="detail-row">
            <span className="detail-label">Call Count</span>
            <span className="detail-value" style={{ color: "var(--accent)", fontSize: "1.1rem" }}>
              {lead.callCount || 0} calls
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Last Call Outcome</span>
            <span className="detail-value">{lead.lastOutcome || "No calls yet"}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Next Action</span>
            <span className="detail-value">{lead.nextAction || "—"}</span>
          </div>
          {lead.lostReason && (
            <div className="detail-row">
              <span className="detail-label" style={{ color: "var(--danger)" }}>
                Lost Reason
              </span>
              <span className="detail-value" style={{ color: "var(--danger)" }}>
                {lead.lostReason}
              </span>
            </div>
          )}
          <div className="detail-row">
            <span className="detail-label">Created At</span>
            <span className="detail-value">{formatDateTimeDisplay(lead.createdAt)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Last Updated</span>
            <span className="detail-value">{formatDateTimeDisplay(lead.updatedAt)}</span>
          </div>
        </div>
      </div>

      {/* ENROLLED COURSES & FINANCIAL BREAKDOWN */}
      <div className="card-padded" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h3 className="section-title" style={{ marginBottom: 0 }}>
            📚 Enrolled Courses & Fee Breakdown
          </h3>
          <Link to={`/edit/${lead._id}`} className="btn btn-outline btn-sm">
            Modify Courses
          </Link>
        </div>

        {(!lead.enrolledCourses || lead.enrolledCourses.length === 0) ? (
          <p style={{ fontSize: "0.88rem", color: "var(--text3)" }}>
            No courses enrolled yet. Click "Modify Courses" to select courses.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {lead.enrolledCourses.map((c, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.4rem 0",
                  borderBottom: "1px dashed var(--border)",
                  fontSize: "0.92rem"
                }}
              >
                <span style={{ fontWeight: 600 }}>• {c.courseName}</span>
                <span style={{ fontWeight: 700 }}>{formatRupees(c.fee)}</span>
              </div>
            ))}

            <div
              style={{
                marginTop: "0.5rem",
                paddingTop: "0.75rem",
                borderTop: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: "0.3rem"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                <span style={{ color: "var(--text2)" }}>Total Course Fee:</span>
                <span style={{ fontWeight: 600 }}>{formatRupees(lead.totalFee)}</span>
              </div>

              {lead.discountType !== "none" && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.9rem",
                    color: "#059669",
                    fontWeight: 600
                  }}
                >
                  <span>
                    Discount Applied ({lead.discountType === "percentage" ? `${lead.discountValue}%` : `Flat ₹${lead.discountValue}`}):
                  </span>
                  <span>- {formatRupees(lead.totalFee - lead.finalFee)}</span>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "1.15rem",
                  fontWeight: 800,
                  color: "var(--accent)",
                  marginTop: "0.25rem",
                  paddingTop: "0.25rem",
                  borderTop: "2px solid var(--border)"
                }}
              >
                <span>Final Payable Fee:</span>
                <span>{formatRupees(lead.finalFee)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 📝 INTERACTION HISTORY & CALL LOGGING (PERMANENT HISTORY) */}
      <div className="card-padded" style={{ marginBottom: "2rem" }}>
        <div className="section-title">
          <span>📝</span>
          <span>Interaction History</span>
          <span
            style={{
              fontSize: "0.8rem",
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              padding: "0.15rem 0.55rem",
              borderRadius: "9999px"
            }}
          >
            {sortedComments.length} interactions
          </span>
        </div>

        <p style={{ fontSize: "0.85rem", color: "var(--text2)", marginBottom: "1rem" }}>
          Permanent interaction log. Adding interactions appends with unique IDs and preserves the timeline.
        </p>

        {/* Add Interaction Box */}
        <form
          onSubmit={handleAddComment}
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "1rem",
            marginBottom: "1.5rem"
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "0.92rem", marginBottom: "0.5rem" }}>
            Log New Interaction / Call
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <label style={{ fontSize: "0.8rem", color: "var(--text2)", display: "block", marginBottom: "0.35rem" }}>
              Call Outcome:
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
              {outcomeOptions.map((out) => (
                <button
                  key={out}
                  type="button"
                  className={`pill-btn ${selectedOutcome === out ? "active" : ""}`}
                  onClick={() => setSelectedOutcome(out)}
                >
                  {out}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: "0.75rem" }}>
            <textarea
              placeholder="What did the student say? Enter call summary, objections, or fee negotiation details..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={addingComment || !commentText.trim()}
            >
              {addingComment ? "Saving..." : "Add Interaction"}
            </button>
          </div>
        </form>

        {/* Post-Call Immediate Follow-up Scheduler Box */}
        {showFollowUpPrompt && (
          <div
            style={{
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: "var(--radius)",
              padding: "1rem",
              marginBottom: "1.5rem",
              animation: "fadeIn 0.2s ease"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, color: "#065f46", fontSize: "0.92rem" }}>
                📅 Schedule Next Follow-up for this lead?
              </span>
              <button
                type="button"
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#065f46" }}
                onClick={() => setShowFollowUpPrompt(false)}
              >
                ✕ Dismiss
              </button>
            </div>

            <div className="form-row" style={{ marginTop: "0.75rem", marginBottom: "0.5rem" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ color: "#065f46" }}>Next Follow-up Date</label>
                <input
                  type="date"
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ color: "#065f46" }}>Follow-up Time</label>
                <input
                  type="time"
                  value={schedTime}
                  onChange={(e) => setSchedTime(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowFollowUpPrompt(false)}
              >
                Skip For Now
              </button>
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={handlePostCallSchedule}
                disabled={scheduling || !schedDate}
              >
                {scheduling ? "Saving..." : "Set Next Follow-up"}
              </button>
            </div>
          </div>
        )}

        {/* Existing Comments List */}
        {sortedComments.length === 0 ? (
          <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--text3)", fontSize: "0.9rem" }}>
            No interactions recorded yet. Log your first call above.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {sortedComments.map((comment, index) => {
              const isLatest = index === 0;
              const isToday = isTodayDate(comment.addedAt);
              const isEditing = editingCommentId === comment.commentId;

              return (
                <div key={comment.commentId} className="comment-bubble">
                  {isEditing ? (
                    // Inline Edit Form
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "0.5rem" }}>
                        Edit Interaction
                      </div>
                      <div style={{ marginBottom: "0.5rem" }}>
                        <label style={{ fontSize: "0.75rem", color: "var(--text2)" }}>Outcome:</label>
                        <select
                          value={editCommentOutcome}
                          onChange={(e) => setEditCommentOutcome(e.target.value)}
                          style={{ width: "100%", padding: "0.4rem", marginTop: "0.2rem" }}
                        >
                          <option value="">(No Outcome)</option>
                          {outcomeOptions.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        value={editCommentText}
                        onChange={(e) => setEditCommentText(e.target.value)}
                        style={{ width: "100%", padding: "0.5rem", minHeight: "75px" }}
                      />
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setEditingCommentId(null)}
                          disabled={savingCommentEdit}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSaveCommentEdit(comment.commentId)}
                          disabled={savingCommentEdit}
                        >
                          {savingCommentEdit ? "Saving..." : "Save Edit"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Normal Display
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "0.4rem",
                          flexWrap: "wrap",
                          gap: "0.4rem"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          {isLatest && (
                            <span
                              style={{
                                fontSize: "0.7rem",
                                fontWeight: 800,
                                background: "var(--accent)",
                                color: "#ffffff",
                                padding: "0.1rem 0.45rem",
                                borderRadius: "9999px"
                              }}
                            >
                              LATEST
                            </span>
                          )}
                          {isToday && (
                            <span
                              style={{
                                fontSize: "0.7rem",
                                fontWeight: 800,
                                background: "#059669",
                                color: "#ffffff",
                                padding: "0.1rem 0.45rem",
                                borderRadius: "9999px"
                              }}
                            >
                              TODAY
                            </span>
                          )}
                          {comment.outcome && (
                            <span
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                background: "var(--surface)",
                                border: "1px solid var(--border)",
                                padding: "0.15rem 0.5rem",
                                borderRadius: "var(--radius-sm)",
                                color: "var(--text)"
                              }}
                            >
                              {comment.outcome}
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontSize: "0.75rem", color: "var(--text3)" }}>
                            {formatDateTimeDisplay(comment.addedAt)}
                          </span>

                          <button
                            type="button"
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "0.78rem",
                              color: "var(--text2)"
                            }}
                            title="Edit interaction"
                            onClick={() => {
                              setEditingCommentId(comment.commentId);
                              setEditCommentText(comment.text);
                              setEditCommentOutcome(comment.outcome || "");
                            }}
                          >
                            ✏️ Edit
                          </button>

                          <button
                            type="button"
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "0.78rem",
                              color: "var(--danger)"
                            }}
                            title="Delete interaction"
                            onClick={() => setCommentToDelete(comment)}
                          >
                            🗑
                          </button>
                        </div>
                      </div>

                      <p style={{ fontSize: "0.92rem", color: "var(--text)", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                        {comment.text}
                      </p>

                      {comment.updatedAt &&
                        new Date(comment.updatedAt).getTime() !== new Date(comment.addedAt).getTime() && (
                          <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: "0.35rem", fontStyle: "italic" }}>
                            Edited on {formatDateTimeDisplay(comment.updatedAt)}
                          </div>
                        )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QUICK RESCHEDULE MODAL */}
      {showRescheduleModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              ✏️ Reschedule Next Follow-up
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text2)", marginBottom: "1rem" }}>
              Update follow-up appointment for <strong>{lead.name}</strong>
            </p>

            <div className="form-group">
              <label>Follow-up Date</label>
              <input
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Follow-up Time</label>
              <input
                type="time"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowRescheduleModal(false)}
                disabled={savingReschedule}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveReschedule}
                disabled={savingReschedule}
              >
                {savingReschedule ? "Saving..." : "Save Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE COMMENT CONFIRMATION MODAL */}
      {commentToDelete && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--danger)" }}>
              🗑 Delete Interaction?
            </h3>
            <p style={{ fontSize: "0.9rem", color: "var(--text)", marginBottom: "1rem", lineHeight: 1.4 }}>
              Delete this interaction permanently?
            </p>
            <div
              style={{
                background: "var(--surface2)",
                padding: "0.75rem",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.85rem",
                marginBottom: "1.25rem",
                fontStyle: "italic"
              }}
            >
              "{commentToDelete.text.slice(0, 100)}..."
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCommentToDelete(null)}
                disabled={deletingComment}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteCommentConfirm}
                disabled={deletingComment}
              >
                {deletingComment ? "Deleting..." : "Delete Interaction"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE LEAD CONFIRMATION MODAL */}
      {showDeleteLeadModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--danger)" }}>
              🗑 Confirm Lead Deletion
            </h3>
            <p style={{ fontSize: "0.92rem", color: "var(--text)", marginBottom: "1rem", lineHeight: 1.4 }}>
              Delete <strong>{lead.name}</strong> and all associated interaction history?
            </p>
            <div
              style={{
                background: "var(--danger-bg)",
                color: "var(--danger)",
                padding: "0.75rem",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.8rem",
                marginBottom: "1.25rem"
              }}
            >
              ⚠️ Warning: All {lead.comments?.length || 0} interaction notes, call histories, and fee records will be permanently deleted.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDeleteLeadModal(false)}
                disabled={deletingLead}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteLeadConfirm}
                disabled={deletingLead}
              >
                {deletingLead ? "Deleting..." : "Delete Lead"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
