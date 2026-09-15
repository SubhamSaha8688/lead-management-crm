import React, { useState, useEffect } from "react";
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

  // Fetch existing leads on mount to check phone duplicates
  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const res = await axios.get("/api/leads");
        if (res.data && res.data.success) {
          setExistingLeads(res.data.data);
          // Suggest a default leadId e.g. LD-001 or next number
          if (!leadId) {
            const count = res.data.data.length + 1;
            const padded = String(count).padStart(3, "0");
            setLeadId(`LD-${padded}`);
          }
        }
      } catch (e) {
        console.warn("Could not fetch existing leads:", e);
      }
    };
    fetchExisting();
  }, []);

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

      {/* Duplicate Phone Warning Banner */}
      {duplicatePhoneLead && (
        <div
          style={{
            background: "var(--warn-bg)",
            color: "var(--warn)",
            border: "1px solid var(--warn)",
            borderRadius: "var(--radius)",
            padding: "0.85rem 1rem",
            marginBottom: "1.25rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem"
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.92rem" }}>
              ⚠️ This phone number already exists in your CRM!
            </div>
            <div style={{ fontSize: "0.85rem", marginTop: "0.2rem" }}>
              Existing lead: <strong>{duplicatePhoneLead.name}</strong> ({duplicatePhoneLead.leadId})
            </div>
          </div>
          <Link
            to={`/leads/${duplicatePhoneLead._id}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline btn-sm"
            style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
          >
            View Existing Lead ↗
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* SECTION 1: CONTACT INFORMATION */}
        <div className="card-padded" style={{ marginBottom: "1.25rem" }}>
          <h2 className="section-title">👤 Contact Information</h2>

          <div className="form-row">
            <div className="form-group">
              <label>Lead ID *</label>
              <input
                type="text"
                placeholder="e.g. LD-001"
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                required
              />
              <span className="form-help">Must be unique identifier</span>
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
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                placeholder="e.g. +91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
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
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/")}
            disabled={loading}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Creating Lead..." : "Save & Open Lead"}
          </button>
        </div>
      </form>
    </div>
  );
}
