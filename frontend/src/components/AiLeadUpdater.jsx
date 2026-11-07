import React, { useState } from "react";
import axios from "axios";

const STAGE_OPTIONS = ["New", "Contacted", "Interested", "Negotiation", "Converted", "Lost"];
const QUALITY_OPTIONS = [
  "Hot Lead",
  "Warm Lead",
  "Cold Lead",
  "Call Again",
  "Voicemail",
  "Converted/Customer",
  "Not Interested",
  "Wrong number"
];

const formatTime12 = (timeStr) => {
  if (!timeStr) return "";
  if (timeStr instanceof Date && !isNaN(timeStr.getTime())) {
    let h = timeStr.getHours();
    const m = String(timeStr.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }

  let clean = String(timeStr).trim();
  if (!clean) return "";

  if (clean.includes("T") || (clean.includes("-") && clean.includes(":"))) {
    const parsedDate = new Date(clean);
    if (!isNaN(parsedDate.getTime())) {
      let h = parsedDate.getHours();
      const m = String(parsedDate.getMinutes()).padStart(2, "0");
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h}:${m} ${ampm}`;
    }
  }

  clean = clean.replace(/\b(am|pm)\s*(am|pm)\b/gi, "$1");

  const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = match12[2];
    const ampm = match12[3].toUpperCase();
    if (h === 0) h = 12;
    else if (h > 12) h = h % 12;
    return `${h}:${m} ${ampm}`;
  }

  const parts = clean.split(":");
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    if (!isNaN(hours)) {
      const minutes = (parts[1] || "").replace(/[^0-9]/g, "").padStart(2, "0").slice(0, 2) || "00";
      const ampm = hours >= 12 ? "PM" : "AM";
      const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
      return `${formattedHours}:${minutes} ${ampm}`;
    }
  }

  return clean;
};

export default function AiLeadUpdater({ lead, onLeadUpdated, showToast }) {
  const [instruction, setInstruction] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [aiResult, setAiResult] = useState(null); // { summary, proposedChanges, modelUsed }
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Checked state for each proposed change: { [field]: true/false }
  const [checkedFields, setCheckedFields] = useState({});
  // Editable values for each proposed change: { [field]: value }
  const [editedValues, setEditedValues] = useState({});
  // Inline editing row tracker: { [field]: true/false }
  const [editingRows, setEditingRows] = useState({});

  // Quick suggestion prompts
  const suggestions = [
    { label: "📞 Callback Tomorrow 11 AM", text: "Customer answered and requested call back tomorrow at 11:00 AM" },
    { label: "🔥 Hot Lead & Interested", text: "Student is very interested, mark as Hot Lead, stage Interested" },
    { label: "📴 Picked & Cut (2d Snooze)", text: "Customer answered and immediately disconnected, snooze for 2 days" },
    { label: "❌ Not Interested / Lost", text: "Not interested, said course fee is too high, mark as Lost with reason High Fee" },
    { label: "🎓 Enrolled & Paid", text: "Student confirmed admission and enrolled, mark stage as Enrolled" }
  ];

  // Analyze the instruction with Gemini
  const handleAnalyze = async (textToAnalyze) => {
    const text = textToAnalyze || instruction;
    if (!text || !text.trim()) {
      alert("Please enter what you want to update.");
      return;
    }

    try {
      setIsAnalyzing(true);
      const res = await axios.post(`/api/leads/${lead._id}/ai-parse-update`, {
        instruction: text.trim()
      });

      if (res.data && res.data.success && res.data.data) {
        const data = res.data.data;
        const changes = data.proposedChanges || [];

        if (changes.length === 0) {
          alert("AI could not detect any specific updates from your note. Please try being more specific.");
          setIsAnalyzing(false);
          return;
        }

        // Initialize all proposed changes as CHECKED by default
        const initialChecked = {};
        const initialValues = {};
        changes.forEach((c) => {
          initialChecked[c.field] = true;
          initialValues[c.field] = c.newValue;
        });

        setCheckedFields(initialChecked);
        setEditedValues(initialValues);
        setEditingRows({});
        setAiResult({
          summary: data.summary || "AI detected the following updates:",
          proposedChanges: changes,
          modelUsed: res.data.modelUsed || "Gemini AI"
        });
        setShowReviewModal(true);
      }
    } catch (err) {
      alert("AI analysis failed: " + (err.response?.data?.message || err.message));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleCheck = (field) => {
    setCheckedFields((prev) => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleSelectAll = (select) => {
    if (!aiResult) return;
    const next = {};
    aiResult.proposedChanges.forEach((c) => {
      next[c.field] = select;
    });
    setCheckedFields(next);
  };

  const handleValueChange = (field, val) => {
    setEditedValues((prev) => ({
      ...prev,
      [field]: val
    }));
  };

  const toggleEditRow = (field) => {
    setEditingRows((prev) => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // Apply selected updates to backend
  const handleApplyUpdates = async () => {
    if (!aiResult) return;

    // Filter only checked changes
    const updatesToApply = {};
    let commentToApply = "";

    aiResult.proposedChanges.forEach((c) => {
      if (checkedFields[c.field]) {
        const val = editedValues[c.field] !== undefined ? editedValues[c.field] : c.newValue;
        if (c.field === "comment") {
          commentToApply = val;
        } else {
          updatesToApply[c.field] = val;
        }
      }
    });

    if (Object.keys(updatesToApply).length === 0 && !commentToApply) {
      alert("No changes selected. Please select at least one field to update.");
      return;
    }

    try {
      setIsAnalyzing(true);
      setErrorMessage("");
      const res = await axios.post(`/api/leads/${lead._id}/ai-apply-update`, {
        updates: updatesToApply,
        comment: commentToApply
      });

      if (res.data && res.data.success && res.data.data) {
        if (typeof showToast === "function") {
          showToast("✓ AI updates applied successfully!");
        }
        if (typeof onLeadUpdated === "function") {
          onLeadUpdated(res.data.data);
        }
        setShowReviewModal(false);
        setInstruction("");
        setAiResult(null);
        setErrorMessage("");
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setErrorMessage(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const checkedCount = Object.values(checkedFields).filter(Boolean).length;
  const totalCount = aiResult?.proposedChanges?.length || 0;

  return (
    <div
      style={{
        marginBottom: "1.5rem",
        background: "linear-gradient(135deg, rgba(79, 70, 229, 0.06) 0%, rgba(147, 51, 234, 0.04) 100%)",
        border: "1px solid rgba(129, 140, 248, 0.35)",
        borderRadius: "12px",
        padding: "1rem 1.25rem",
        boxShadow: "0 2px 10px rgba(79, 70, 229, 0.05)"
      }}
    >
      {/* Title & Badge */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.6rem",
          flexWrap: "wrap",
          gap: "0.5rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "1.15rem" }}>✨</span>
          <strong style={{ fontSize: "0.92rem", color: "var(--text)" }}>
            AI Smart Update Assistant
          </strong>
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 800,
              background: "rgba(99, 102, 241, 0.15)",
              color: "#4f46e5",
              padding: "2px 8px",
              borderRadius: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}
          >
            Gemini Powered
          </span>
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--text3)" }}>
          Type naturally in English or Hinglish • Review and tick before applying
        </span>
      </div>

      {/* Input & Action Bar */}
      <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
        <textarea
          rows={instruction.includes("\n") || instruction.length > 80 ? 4 : 1}
          value={instruction}
          disabled={isAnalyzing}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey || (!instruction.includes("\n") && !e.shiftKey))) {
              e.preventDefault();
              handleAnalyze();
            }
          }}
          placeholder="e.g. Spoke with student, agreed for Python course, schedule callback tomorrow at 3 PM, Hot Lead... (or paste CRM JSON dump)"
          style={{
            flex: 1,
            padding: "0.65rem 0.9rem",
            fontSize: "0.85rem",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            background: "var(--surface, #ffffff)",
            color: "var(--text)",
            resize: "vertical",
            fontFamily: "inherit",
            lineHeight: 1.4
          }}
        />

        <button
          type="button"
          disabled={isAnalyzing || !instruction.trim()}
          onClick={() => handleAnalyze()}
          style={{
            background: isAnalyzing
              ? "#94a3b8"
              : "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            padding: "0.65rem 1.25rem",
            fontSize: "0.84rem",
            fontWeight: 800,
            cursor: isAnalyzing || !instruction.trim() ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            boxShadow: "0 2px 8px rgba(79, 70, 229, 0.35)",
            whiteSpace: "nowrap"
          }}
        >
          {isAnalyzing ? (
            <>
              <span className="spinner" style={{ width: "14px", height: "14px", borderWidth: "2px" }} />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <span>⚡</span>
              <span>AI Parse & Review</span>
            </>
          )}
        </button>
      </div>

      {/* Quick Suggestion Chips */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          marginTop: "0.6rem",
          flexWrap: "wrap",
          alignItems: "center"
        }}
      >
        <span style={{ fontSize: "0.72rem", color: "var(--text3)", fontWeight: 700 }}>
          Quick Prompts:
        </span>
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            type="button"
            disabled={isAnalyzing}
            onClick={() => {
              setInstruction(s.text);
              handleAnalyze(s.text);
            }}
            style={{
              background: "var(--surface, #ffffff)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              padding: "2px 9px",
              fontSize: "0.72rem",
              color: "var(--text2)",
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--text2)";
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* REVIEW & TICK MODAL / DIFF CHECKLIST                                       */}
      {/* ========================================================================= */}
      {showReviewModal && aiResult && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 1300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem"
          }}
          onClick={() => setShowReviewModal(false)}
        >
          <div
            style={{
              background: "var(--surface, #ffffff)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              width: "650px",
              maxWidth: "100%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.3)",
              animation: "fadeIn 0.2s ease"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "1.1rem 1.3rem",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1.2rem" }}>✨</span>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>
                    AI Proposed Updates — Review & Confirm
                  </h3>
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text3)", marginTop: "3px" }}>
                  Tick the boxes you want to update, edit any value if needed, then confirm.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.2rem",
                  color: "var(--text3)",
                  cursor: "pointer",
                  padding: "4px 8px"
                }}
              >
                ✕
              </button>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div
                style={{
                  background: "#fee2e2",
                  borderBottom: "1px solid #f87171",
                  color: "#991b1b",
                  padding: "0.6rem 1.3rem",
                  fontSize: "0.82rem",
                  fontWeight: 700
                }}
              >
                ⚠️ {errorMessage}
              </div>
            )}

            {/* AI Summary Banner */}
            <div
              style={{
                background: "rgba(99, 102, 241, 0.08)",
                borderBottom: "1px solid rgba(99, 102, 241, 0.2)",
                padding: "0.75rem 1.3rem",
                fontSize: "0.82rem",
                color: "var(--text)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.5rem"
              }}
            >
              <div>
                <strong>AI Summary:</strong> {aiResult.summary}
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--accent)",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    textDecoration: "underline"
                  }}
                >
                  Select All
                </button>
                <span style={{ color: "var(--border)" }}>•</span>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text3)",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    textDecoration: "underline"
                  }}
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Proposed Changes Checklist Body */}
            <div
              style={{
                padding: "1rem 1.3rem",
                overflowY: "auto",
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem"
              }}
            >
              {aiResult.proposedChanges.map((change) => {
                const isChecked = Boolean(checkedFields[change.field]);
                const isEditing = Boolean(editingRows[change.field]);
                const currentValueDisplay =
                  change.currentValue === null || change.currentValue === undefined || change.currentValue === ""
                    ? "None"
                    : change.field === "followUpTime"
                    ? formatTime12(change.currentValue) || "None"
                    : Array.isArray(change.currentValue)
                    ? change.currentValue.join(", ") || "None"
                    : String(change.currentValue);

                const activeValue = editedValues[change.field] !== undefined ? editedValues[change.field] : change.newValue;

                return (
                  <div
                    key={change.field}
                    style={{
                      border: isChecked ? "1px solid #818cf8" : "1px solid var(--border)",
                      background: isChecked ? "rgba(99, 102, 241, 0.03)" : "var(--surface2, #f8fafc)",
                      borderRadius: "8px",
                      padding: "0.75rem 1rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.45rem",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      {/* Checkbox & Field Label */}
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: "0.88rem",
                          color: "var(--text)"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleCheck(change.field)}
                          style={{
                            width: "16px",
                            height: "16px",
                            cursor: "pointer",
                            accentColor: "var(--accent)"
                          }}
                        />
                        <span>{change.label || change.field}</span>
                      </label>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => toggleEditRow(change.field)}
                        style={{
                          background: isEditing ? "var(--accent)" : "none",
                          color: isEditing ? "#ffffff" : "var(--accent)",
                          border: isEditing ? "none" : "1px solid var(--border)",
                          borderRadius: "4px",
                          padding: "2px 7px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                        title="Edit proposed value"
                      >
                        {isEditing ? "Done ✕" : "✏️ Edit"}
                      </button>
                    </div>

                    {/* Diff Preview / Inline Edit */}
                    {!isEditing ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "0.82rem",
                          paddingLeft: "24px",
                          flexWrap: "wrap"
                        }}
                      >
                        <span style={{ color: "var(--text3)", textDecoration: "line-through" }}>
                          {currentValueDisplay}
                        </span>
                        <span style={{ color: "var(--text3)" }}>➔</span>
                        <span style={{ color: "#16a34a", fontWeight: 800 }}>
                          {change.field === "followUpTime"
                            ? `${formatTime12(activeValue)} (${activeValue})`
                            : String(activeValue)}
                        </span>
                      </div>
                    ) : (
                      <div style={{ paddingLeft: "24px", marginTop: "4px" }}>
                        {change.type === "select" || change.field === "stage" || change.field === "quality" ? (
                          (() => {
                            const availableOpts =
                              change.field === "stage"
                                ? STAGE_OPTIONS
                                : change.field === "quality"
                                ? QUALITY_OPTIONS
                                : Array.isArray(change.options) && change.options.length > 0
                                ? change.options
                                : [activeValue];

                            return (
                              <select
                                value={activeValue}
                                onChange={(e) => handleValueChange(change.field, e.target.value)}
                                style={{
                                  width: "100%",
                                  padding: "0.4rem 0.6rem",
                                  fontSize: "0.82rem",
                                  borderRadius: "6px",
                                  border: "1px solid var(--accent)",
                                  background: "var(--surface)",
                                  color: "var(--text)"
                                }}
                              >
                                {availableOpts.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            );
                          })()
                        ) : change.type === "textarea" ? (
                          <textarea
                            rows={3}
                            value={activeValue}
                            onChange={(e) => handleValueChange(change.field, e.target.value)}
                            style={{
                              width: "100%",
                              padding: "0.4rem 0.6rem",
                              fontSize: "0.82rem",
                              borderRadius: "6px",
                              border: "1px solid var(--accent)",
                              background: "var(--surface)",
                              color: "var(--text)"
                            }}
                          />
                        ) : change.type === "date" || change.field === "followUpDate" ? (
                          <input
                            type="date"
                            value={activeValue}
                            onChange={(e) => handleValueChange(change.field, e.target.value)}
                            style={{
                              padding: "0.4rem 0.6rem",
                              fontSize: "0.82rem",
                              borderRadius: "6px",
                              border: "1px solid var(--accent)",
                              background: "var(--surface)",
                              color: "var(--text)"
                            }}
                          />
                        ) : change.type === "time" || change.field === "followUpTime" ? (
                          <input
                            type="time"
                            value={activeValue}
                            onChange={(e) => handleValueChange(change.field, e.target.value)}
                            style={{
                              padding: "0.4rem 0.6rem",
                              fontSize: "0.82rem",
                              borderRadius: "6px",
                              border: "1px solid var(--accent)",
                              background: "var(--surface)",
                              color: "var(--text)"
                            }}
                          />
                        ) : (
                          <input
                            type={change.type === "number" ? "number" : "text"}
                            value={activeValue}
                            onChange={(e) => handleValueChange(change.field, e.target.value)}
                            style={{
                              width: "100%",
                              padding: "0.4rem 0.6rem",
                              fontSize: "0.82rem",
                              borderRadius: "6px",
                              border: "1px solid var(--accent)",
                              background: "var(--surface)",
                              color: "var(--text)"
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "1rem 1.3rem",
                borderTop: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--surface2, #f8fafc)"
              }}
            >
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text2)" }}>
                Selected: <span style={{ color: "var(--accent)" }}>{checkedCount}</span> of {totalCount} updates
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    padding: "0.5rem 1rem",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    color: "var(--text2)"
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isAnalyzing || checkedCount === 0}
                  onClick={handleApplyUpdates}
                  style={{
                    background:
                      checkedCount === 0
                        ? "#94a3b8"
                        : "linear-gradient(135deg, #059669 0%, #047857 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "0.5rem 1.25rem",
                    fontSize: "0.84rem",
                    fontWeight: 800,
                    cursor: checkedCount === 0 || isAnalyzing ? "not-allowed" : "pointer",
                    boxShadow: "0 2px 8px rgba(5, 150, 105, 0.35)",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  {isAnalyzing ? (
                    <span>Applying...</span>
                  ) : (
                    <>
                      <span>💾</span>
                      <span>Apply Selected Updates ({checkedCount})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
