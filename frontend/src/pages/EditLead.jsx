import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import CourseSelector from "../components/CourseSelector";

export default function EditLead({ onLeadUpdated }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form states
  const [leadId, setLeadId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [quality, setQuality] = useState("Warm Lead");
  const [priority, setPriority] = useState(3);
  const [source, setSource] = useState("Website");
  const [stage, setStage] = useState("New");

  const [callCount, setCallCount] = useState(0);
  const [lastOutcome, setLastOutcome] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [reminderNote, setReminderNote] = useState("");
  const [lostReason, setLostReason] = useState("");

  const [enquiryDate, setEnquiryDate] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");

  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [discountType, setDiscountType] = useState("none");
  const [discountValue, setDiscountValue] = useState(0);

  // Other existing leads for duplicate conflict detection
  const [otherLeads, setOtherLeads] = useState([]);

  // Fetch current lead data and all other leads
  useEffect(() => {
    const fetchLeadData = async () => {
      try {
        setLoading(true);
        setError("");
        const [res, allRes] = await Promise.all([
          axios.get(`/api/leads/${id}`),
          axios.get("/api/leads")
        ]);

        if (res.data && res.data.success) {
          const l = res.data.data;
          setLeadId(l.leadId || "");
          setName(l.name || "");
          setPhone(l.phone || "");
          setEmail(l.email || "");
          setQuality(l.quality || "Warm Lead");
          setPriority(l.priority !== undefined ? Number(l.priority) : 3);
          setSource(l.source || "Website");
          setStage(l.stage || "New");
          setCallCount(l.callCount || 0);
          setLastOutcome(l.lastOutcome || "");
          setNextAction(l.nextAction || "");
          setReminderNote(l.reminderNote || "");
          setLostReason(l.lostReason || "");

          if (l.enquiryDate) {
            setEnquiryDate(new Date(l.enquiryDate).toISOString().split("T")[0]);
          }
          if (l.followUpDate) {
            setFollowUpDate(new Date(l.followUpDate).toISOString().split("T")[0]);
          } else {
            setFollowUpDate("");
          }
          setFollowUpTime(l.followUpTime || "");

          setEnrolledCourses(l.enrolledCourses || []);
          setDiscountType(l.discountType || "none");
          setDiscountValue(l.discountValue || 0);
        }

        if (allRes.data && allRes.data.success) {
          setOtherLeads(allRes.data.data.filter((leadItem) => leadItem._id !== id));
        }
      } catch (err) {
        setError("Unable to load lead details for editing.");
      } finally {
        setLoading(false);
      }
    };
    fetchLeadData();
  }, [id]);

  // Check Duplicate Lead ID (against other leads)
  const duplicateLeadIdLead = React.useMemo(() => {
    if (!leadId || !leadId.trim()) return null;
    const currentNorm = leadId.trim().toLowerCase();
    return otherLeads.find(
      (l) => l.leadId && l.leadId.trim().toLowerCase() === currentNorm
    );
  }, [leadId, otherLeads]);

  // Check Duplicate Phone (against other leads)
  const duplicatePhoneLead = React.useMemo(() => {
    if (!phone || phone.trim().length < 6) return null;
    const cleanCurrent = phone.replace(/[^0-9]/g, "");
    if (!cleanCurrent) return null;

    return otherLeads.find((l) => {
      if (!l.phone) return false;
      const cleanExisting = l.phone.replace(/[^0-9]/g, "");
      return cleanExisting && cleanExisting === cleanCurrent;
    });
  }, [phone, otherLeads]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!leadId.trim()) {
      setError("Lead ID cannot be blank.");
      return;
    }
    if (duplicateLeadIdLead) {
      setError(`Cannot update lead: Lead ID "${leadId}" is already used by ${duplicateLeadIdLead.name}.`);
      return;
    }
    if (duplicatePhoneLead) {
      setError(`Cannot update lead: Phone number is already registered to Lead ${duplicatePhoneLead.leadId} (${duplicatePhoneLead.name}).`);
      return;
    }
    if (!name.trim()) {
      setError("Lead Name cannot be blank.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        leadId: leadId.trim(),
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        quality,
        priority: Number(priority),
        source,
        stage,
        callCount: Number(callCount) || 0,
        lastOutcome: lastOutcome.trim(),
        nextAction: nextAction.trim(),
        reminderNote: reminderNote.trim(),
        lostReason: quality === "Not Interested" ? lostReason.trim() : "",
        enquiryDate: enquiryDate ? new Date(enquiryDate) : new Date(),
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        followUpTime: followUpTime.trim(),
        enrolledCourses,
        discountType,
        discountValue: Number(discountValue) || 0
      };

      const res = await axios.put(`/api/leads/${id}`, payload);

      if (res.data && res.data.success) {
        if (onLeadUpdated) onLeadUpdated();
        navigate(`/leads/${id}`);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to update lead. Please review your inputs."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ textAlign: "center", padding: "4rem" }}>
        Loading lead details...
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: "880px" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link
          to={`/leads/${id}`}
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
          ← Cancel and Return to Lead Details
        </Link>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text)" }}>
          ✏️ Edit Lead: {name}
        </h1>
        <p style={{ color: "var(--text2)", fontSize: "0.9rem" }}>
          Update contact details, enrolled courses, and appointment scheduling.
        </p>
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
            <div className="form-group">
              <label>Lead ID *</label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
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
              ) : (
                <span className="form-help">Must be unique identifier</span>
              )}
            </div>

            <div className="form-group" style={{ flex: 2 }}>
              <label>Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Phone Number</label>
              <div style={{ position: "relative" }}>
                <input
                  type="tel"
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

              {duplicatePhoneLead && (
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
              )}
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: CLASSIFICATION & METRICS */}
        <div className="card-padded" style={{ marginBottom: "1.25rem" }}>
          <h2 className="section-title">📊 Classification & Metrics</h2>

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

          <div className="form-row">
            <div className="form-group">
              <label>Call Count</label>
              <input
                type="number"
                min="0"
                value={callCount}
                onChange={(e) => setCallCount(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Last Outcome</label>
              <input
                type="text"
                value={lastOutcome}
                onChange={(e) => setLastOutcome(e.target.value)}
                placeholder="e.g. Connected — Interested"
              />
            </div>
          </div>

          {quality === "Not Interested" && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Lost Reason</label>
              <input
                type="text"
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="Why did the student drop out or decline?"
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

        {/* SECTION 4: DATES & APPOINTMENTS */}
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

          <div className="form-group">
            <label>Next Action Plan</label>
            <input
              type="text"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="e.g. Call to finalize payment after demo session"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>📌 Sticky Reminder Note (Pinned on Lead Details)</label>
            <input
              type="text"
              value={reminderNote}
              onChange={(e) => setReminderNote(e.target.value)}
              placeholder="Pinned notes visible on the lead overview"
            />
          </div>
        </div>

        {/* DATA SAFETY NOTICE */}
        <div
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "0.85rem 1rem",
            fontSize: "0.82rem",
            color: "var(--text2)",
            marginBottom: "1.5rem"
          }}
        >
          🔒 <strong>Permanent Interaction History Protected:</strong> Updating lead details never alters or overwrites previous sales comments or call logs. Interaction comments are managed directly on the Lead Details workspace.
        </div>

        {/* SUBMIT BUTTONS */}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          {(duplicateLeadIdLead || duplicatePhoneLead) && (
            <span style={{ fontSize: "0.85rem", color: "var(--danger)", fontWeight: 700 }}>
              ⚠️ {duplicateLeadIdLead ? `Lead ID "${leadId}" already in use.` : "Phone number belongs to another lead."} Fix before saving.
            </span>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(`/leads/${id}`)}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || Boolean(duplicateLeadIdLead) || Boolean(duplicatePhoneLead)}
            style={{
              opacity: (duplicateLeadIdLead || duplicatePhoneLead) ? 0.6 : 1,
              cursor: (duplicateLeadIdLead || duplicatePhoneLead) ? "not-allowed" : "pointer"
            }}
          >
            {saving ? "Saving Changes..." : "Save Lead"}
          </button>
        </div>
      </form>
    </div>
  );
}
