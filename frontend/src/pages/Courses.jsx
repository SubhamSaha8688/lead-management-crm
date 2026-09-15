import React, { useState, useEffect } from "react";
import axios from "axios";

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add course form
  const [name, setName] = useState("");
  const [fee, setFee] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  // Inline editing
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editFee, setEditFee] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Soft delete confirmation modal
  const [courseToRemove, setCourseToRemove] = useState(null);
  const [removing, setRemoving] = useState(false);

  // Toast message
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError("");
      // Fetch all courses (both active and inactive)
      const res = await axios.get("/api/courses");
      if (res.data && res.data.success) {
        setCourses(res.data.data);
      }
    } catch (err) {
      setError("Unable to load courses. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const formatRupees = (amount) => {
    return "₹" + Number(amount || 0).toLocaleString("en-IN");
  };

  // Add Master Course
  const handleAddCourse = async (e) => {
    e.preventDefault();
    setAddError("");

    if (!name.trim()) {
      setAddError("Course name is required.");
      return;
    }

    const feeNum = Number(fee);
    if (isNaN(feeNum) || feeNum < 0) {
      setAddError("Please provide a valid non-negative fee.");
      return;
    }

    try {
      setAdding(true);
      const res = await axios.post("/api/courses", {
        name: name.trim(),
        fee: feeNum
      });

      if (res.data && res.data.success) {
        showToast("Course added successfully.");
        setName("");
        setFee("");
        fetchCourses();
      }
    } catch (err) {
      setAddError(
        err.response?.data?.message || "Failed to add course. Please try again."
      );
    } finally {
      setAdding(false);
    }
  };

  // Inline Edit Save
  const handleSaveEdit = async (courseId) => {
    if (!editName.trim()) {
      alert("Course name cannot be empty.");
      return;
    }
    const feeNum = Number(editFee);
    if (isNaN(feeNum) || feeNum < 0) {
      alert("Course fee must be a valid non-negative number.");
      return;
    }

    try {
      setSavingEdit(true);
      const res = await axios.put(`/api/courses/${courseId}`, {
        name: editName.trim(),
        fee: feeNum
      });

      if (res.data && res.data.success) {
        setCourses((prev) =>
          prev.map((c) => (c._id === courseId ? res.data.data : c))
        );
        setEditingId(null);
        showToast("Course updated.");
      }
    } catch (err) {
      alert("Failed to update course: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingEdit(false);
    }
  };

  // Soft Delete Course: DELETE /api/courses/:id
  const handleConfirmRemove = async () => {
    if (!courseToRemove) return;
    try {
      setRemoving(true);
      const res = await axios.delete(`/api/courses/${courseToRemove._id}`);
      if (res.data && res.data.success) {
        setCourses((prev) =>
          prev.map((c) => (c._id === courseToRemove._id ? { ...c, active: false } : c))
        );
        showToast("Course removed.");
        setCourseToRemove(null);
      }
    } catch (err) {
      alert("Failed to remove course: " + (err.response?.data?.message || err.message));
    } finally {
      setRemoving(false);
    }
  };

  // Reactivate Course
  const handleReactivateCourse = async (course) => {
    try {
      const res = await axios.put(`/api/courses/${course._id}`, {
        active: true
      });
      if (res.data && res.data.success) {
        setCourses((prev) =>
          prev.map((c) => (c._id === course._id ? res.data.data : c))
        );
        showToast(`Course ${course.name} reactivated.`);
      }
    } catch (err) {
      alert("Failed to reactivate: " + (err.response?.data?.message || err.message));
    }
  };

  // Stats Calculations
  const activeCourses = courses.filter((c) => c.active !== false);
  const inactiveCourses = courses.filter((c) => c.active === false);
  const totalCombinedFees = activeCourses.reduce(
    (sum, c) => sum + (Number(c.fee) || 0),
    0
  );

  return (
    <div className="page" style={{ maxWidth: "900px" }}>
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

      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text)" }}>
          📚 Course Catalog Management
        </h1>
        <p style={{ color: "var(--text2)", fontSize: "0.9rem" }}>
          Configure master courses and default fees. Existing enrolled leads preserve their historical rates.
        </p>
      </div>

      {/* STATS SUMMARY */}
      <div className="stat-grid" style={{ marginBottom: "1.5rem" }}>
        <div className="stat-card">
          <div className="stat-card-title">Total Active Courses</div>
          <div className="stat-card-value" style={{ color: "var(--accent)" }}>
            {activeCourses.length}
          </div>
          <div className="stat-card-sub">Available for new student leads</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-title">Combined Fees</div>
          <div className="stat-card-value" style={{ color: "#059669" }}>
            {formatRupees(totalCombinedFees)}
          </div>
          <div className="stat-card-sub">Sum of all active course tuition fees</div>
        </div>
      </div>

      {/* ADD NEW COURSE FORM */}
      <div className="card-padded" style={{ marginBottom: "1.5rem" }}>
        <h2 className="section-title">➕ Add New Course</h2>

        {addError && (
          <div
            style={{
              background: "var(--danger-bg)",
              color: "var(--danger)",
              padding: "0.75rem",
              borderRadius: "var(--radius-sm)",
              marginBottom: "1rem",
              fontSize: "0.85rem",
              fontWeight: 600
            }}
          >
            ⚠️ {addError}
          </div>
        )}

        <form onSubmit={handleAddCourse}>
          <div className="form-row" style={{ marginBottom: "0.75rem" }}>
            <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
              <label>Course Name *</label>
              <input
                type="text"
                placeholder="e.g. German Language — A1, Coding Bootcamp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Tuition Fee (₹) *</label>
              <input
                type="number"
                placeholder="e.g. 15000"
                min="0"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
            <button type="submit" className="btn btn-primary" disabled={adding}>
              {adding ? "Adding Course..." : "+ Add Course"}
            </button>
          </div>
        </form>
      </div>

      {/* ACTIVE COURSES LIST */}
      <div className="card-padded" style={{ marginBottom: "1.5rem" }}>
        <h2 className="section-title">
          <span>Active Courses ({activeCourses.length})</span>
        </h2>

        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text2)" }}>
            Loading courses...
          </div>
        ) : error ? (
          <div style={{ color: "var(--danger)", textAlign: "center", padding: "1.5rem" }}>
            {error}
          </div>
        ) : activeCourses.length === 0 ? (
          <div
            style={{
              padding: "2.5rem 1rem",
              textAlign: "center",
              color: "var(--text3)",
              fontSize: "0.95rem"
            }}
          >
            No active courses yet. Add a course above to get started.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {activeCourses.map((course) => {
              const isEditing = editingId === course._id;

              return (
                <div
                  key={course._id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.85rem 1rem",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--surface2)",
                    border: "1px solid var(--border)",
                    flexWrap: "wrap",
                    gap: "0.75rem"
                  }}
                >
                  {isEditing ? (
                    /* Inline Editing Row */
                    <div style={{ display: "flex", flex: 1, gap: "0.5rem", flexWrap: "wrap" }}>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{
                          flex: 2,
                          padding: "0.45rem",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--border)"
                        }}
                      />
                      <input
                        type="number"
                        value={editFee}
                        min="0"
                        onChange={(e) => setEditFee(e.target.value)}
                        style={{
                          flex: 1,
                          padding: "0.45rem",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--border)"
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleSaveEdit(course._id)}
                        disabled={savingEdit}
                      >
                        {savingEdit ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    /* Normal Display Row */
                    <>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text)" }}>
                          {course.name}
                        </div>
                        <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#059669", marginTop: "0.15rem" }}>
                          {formatRupees(course.fee)}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setEditingId(course._id);
                            setEditName(course.name);
                            setEditFee(course.fee);
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                          onClick={() => setCourseToRemove(course)}
                        >
                          Remove
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* INACTIVE (SOFT-DELETED) COURSES */}
      {inactiveCourses.length > 0 && (
        <div className="card-padded" style={{ marginBottom: "1.5rem", opacity: 0.9 }}>
          <h2 className="section-title" style={{ fontSize: "1.05rem", color: "var(--text2)" }}>
            Archived Courses ({inactiveCourses.length})
          </h2>
          <p style={{ fontSize: "0.82rem", color: "var(--text3)", marginBottom: "0.75rem" }}>
            Soft-deleted courses hidden from the new lead selector. Existing leads keep their historical fee.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {inactiveCourses.map((course) => (
              <div
                key={course._id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.6rem 0.85rem",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface)",
                  border: "1px dashed var(--border)",
                  color: "var(--text3)"
                }}
              >
                <div>
                  <span style={{ textDecoration: "line-through", fontWeight: 600 }}>
                    {course.name}
                  </span>{" "}
                  — {formatRupees(course.fee)}
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => handleReactivateCourse(course)}
                >
                  Reactivate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SOFT DELETE CONFIRMATION MODAL */}
      {courseToRemove && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--danger)" }}>
              Confirm Course Removal
            </h3>
            <p style={{ fontSize: "0.9rem", color: "var(--text)", marginBottom: "1rem", lineHeight: 1.4 }}>
              Are you sure you want to remove <strong>{courseToRemove.name}</strong> from active courses?
            </p>
            <p style={{ fontSize: "0.82rem", color: "var(--text2)", marginBottom: "1.25rem" }}>
              Note: This is a safe soft-delete. Existing leads who previously enrolled in this course will NOT lose their historical enrollment or fee data.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCourseToRemove(null)}
                disabled={removing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmRemove}
                disabled={removing}
              >
                {removing ? "Removing..." : "Remove Course"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
