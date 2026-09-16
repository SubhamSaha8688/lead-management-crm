import React, { useState, useEffect } from "react";
import axios from "axios";

export default function CourseSelector({
  selectedCourses,
  onChangeCourses,
  discountType,
  onChangeDiscountType,
  discountValue,
  onChangeDiscountValue
}) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseFee, setNewCourseFee] = useState("");
  const [addingCourse, setAddingCourse] = useState(false);
  const [courseError, setCourseError] = useState("");

  // Fetch courses from backend
  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/courses?active=true");
      if (res.data && res.data.success) {
        setCourses(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load courses:", err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle selection of a master course
  const toggleCourse = (course) => {
    const isSelected = selectedCourses.some(
      (c) =>
        (course._id && c.courseId === course._id) ||
        (course.name &&
          c.courseName &&
          c.courseName.trim().toLowerCase() === course.name.trim().toLowerCase())
    );

    if (isSelected) {
      // Remove
      const updated = selectedCourses.filter(
        (c) =>
          !(
            (course._id && c.courseId === course._id) ||
            (course.name &&
              c.courseName &&
              c.courseName.trim().toLowerCase() === course.name.trim().toLowerCase())
          )
      );
      onChangeCourses(updated);
    } else {
      // Add with snapshot of current fee
      const newCourseEntry = {
        courseId: course._id || ("CRS-" + Date.now()),
        courseName: course.name || course.courseName,
        fee: Number(course.fee) || 0
      };
      onChangeCourses([...selectedCourses, newCourseEntry]);
    }
  };

  // Remove a specific course from selected list
  const handleRemoveCourse = (index) => {
    const updated = selectedCourses.filter((_, idx) => idx !== index);
    onChangeCourses(updated);
  };

  // Adjust fee for an enrolled course
  const handleFeeChange = (index, newFeeStr) => {
    const val = newFeeStr === "" ? 0 : Math.max(0, Number(newFeeStr) || 0);
    const updated = selectedCourses.map((c, idx) =>
      idx === index ? { ...c, fee: val } : c
    );
    onChangeCourses(updated);
  };

  // Clear all enrolled courses
  const handleClearAllCourses = () => {
    onChangeCourses([]);
  };

  // Identify custom or AI-extracted courses that are not in the master courses list
  const customCourses = selectedCourses.filter((selected) => {
    return !courses.some(
      (master) =>
        master._id === selected.courseId ||
        (master.name &&
          selected.courseName &&
          master.name.trim().toLowerCase() === selected.courseName.trim().toLowerCase())
    );
  });

  // Inline Add New Course
  const handleAddNewCourse = async (e) => {
    e.preventDefault();
    setCourseError("");

    if (!newCourseName.trim()) {
      setCourseError("Please provide a course name.");
      return;
    }

    const feeNum = Number(newCourseFee);
    if (isNaN(feeNum) || feeNum < 0) {
      setCourseError("Please provide a valid fee (₹).");
      return;
    }

    try {
      setAddingCourse(true);
      const res = await axios.post("/api/courses", {
        name: newCourseName.trim(),
        fee: feeNum
      });

      if (res.data && res.data.success) {
        const created = res.data.data;
        // Add to local list of courses
        setCourses((prev) => [...prev, created]);
        // Automatically select the newly created course
        const newEntry = {
          courseId: created._id,
          courseName: created.name,
          fee: created.fee
        };
        onChangeCourses([...selectedCourses, newEntry]);

        // Reset form
        setNewCourseName("");
        setNewCourseFee("");
        setShowAddCourse(false);
      }
    } catch (err) {
      setCourseError(
        err.response?.data?.message || "Failed to add course. Please try again."
      );
    } finally {
      setAddingCourse(false);
    }
  };

  // Calculations
  const totalFee = selectedCourses.reduce(
    (sum, c) => sum + (Number(c.fee) || 0),
    0
  );

  let savings = 0;
  let savingsPercent = 0;
  let finalFee = totalFee;

  const numDiscountVal = Number(discountValue) || 0;

  if (discountType === "percentage") {
    const cappedPercent = Math.min(Math.max(numDiscountVal, 0), 100);
    savings = (totalFee * cappedPercent) / 100;
    savingsPercent = cappedPercent;
    finalFee = Math.max(0, Math.round(totalFee - savings));
  } else if (discountType === "flat") {
    savings = Math.min(Math.max(numDiscountVal, 0), totalFee);
    savingsPercent = totalFee > 0 ? Math.round((savings / totalFee) * 100) : 0;
    finalFee = Math.max(0, Math.round(totalFee - savings));
  } else {
    savings = 0;
    savingsPercent = 0;
    finalFee = totalFee;
  }

  const formatRupees = (amount) => {
    return "₹" + Number(amount || 0).toLocaleString("en-IN");
  };

  return (
    <div className="card-padded" style={{ marginBottom: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          flexWrap: "wrap",
          gap: "0.5rem"
        }}
      >
        <div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" }}>
            📚 Courses & Fees
          </h3>
          <p style={{ fontSize: "0.8rem", color: "var(--text2)" }}>
            Click courses to enroll the lead. Historical fees are saved with the lead.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setShowAddCourse((prev) => !prev)}
        >
          {showAddCourse ? "✕ Cancel" : "➕ New Course"}
        </button>
      </div>

      {/* Inline Add Course Form */}
      {showAddCourse && (
        <div
          style={{
            background: "var(--surface2)",
            border: "1px dashed var(--accent)",
            borderRadius: "var(--radius-sm)",
            padding: "1rem",
            marginBottom: "1.25rem"
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.5rem" }}>
            Add Master Course
          </div>
          {courseError && (
            <div
              style={{
                color: "#b91c1c",
                fontSize: "0.8rem",
                marginBottom: "0.5rem"
              }}
            >
              ⚠️ {courseError}
            </div>
          )}
          <div className="form-row" style={{ marginBottom: "0.5rem" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Course Name *</label>
              <input
                type="text"
                placeholder="e.g. German B1, Data Science Bootcamp"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Fee (₹) *</label>
              <input
                type="number"
                placeholder="e.g. 25000"
                min="0"
                value={newCourseFee}
                onChange={(e) => setNewCourseFee(e.target.value)}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleAddNewCourse}
              disabled={addingCourse}
            >
              {addingCourse ? "Saving..." : "Save & Select Course"}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowAddCourse(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Courses Chips Selector */}
      {loading ? (
        <div style={{ padding: "1rem", color: "var(--text3)", fontSize: "0.88rem" }}>
          Loading courses...
        </div>
      ) : courses.length === 0 ? (
        <div
          style={{
            padding: "1rem",
            textAlign: "center",
            background: "var(--surface2)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text2)",
            fontSize: "0.88rem"
          }}
        >
          No master courses yet. Click <strong>"+ New Course"</strong> above to create your first course.
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            marginBottom: "1.25rem"
          }}
        >
          {courses.map((course) => {
            const isSelected = selectedCourses.some(
              (c) =>
                (course._id && c.courseId === course._id) ||
                (course.name &&
                  c.courseName &&
                  c.courseName.trim().toLowerCase() === course.name.trim().toLowerCase())
            );
            return (
              <button
                key={course._id}
                type="button"
                onClick={() => toggleCourse(course)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem 0.85rem",
                  borderRadius: "9999px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  border: isSelected ? "2px solid #4f46e5" : "1px solid var(--border2)",
                  background: isSelected ? "#eef2ff" : "var(--surface)",
                  color: isSelected ? "#4f46e5" : "var(--text)"
                }}
              >
                <span>{isSelected ? "✓" : "+"}</span>
                <span>{course.name}</span>
                <span style={{ opacity: 0.85, fontWeight: 700 }}>
                  {formatRupees(course.fee)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Custom / AI Extracted Courses Pills */}
      {customCourses.length > 0 && (
        <div style={{ marginBottom: "1.25rem" }}>
          <div
            style={{
              fontSize: "0.78rem",
              fontWeight: 700,
              color: "var(--text2)",
              marginBottom: "0.4rem",
              textTransform: "uppercase",
              letterSpacing: "0.04em"
            }}
          >
            ✨ Custom / Extracted Courses:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {customCourses.map((c) => {
              const originalIndex = selectedCourses.indexOf(c);
              return (
                <div
                  key={c.courseId || originalIndex}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.4rem 0.8rem",
                    borderRadius: "9999px",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    border: "1.5px solid #6366f1",
                    background: "#eef2ff",
                    color: "#4338ca"
                  }}
                >
                  <span>🎓 {c.courseName}</span>
                  <span style={{ fontWeight: 700, opacity: 0.9 }}>
                    {formatRupees(c.fee)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCourse(originalIndex)}
                    style={{
                      background: "#fee2e2",
                      border: "none",
                      borderRadius: "50%",
                      width: "20px",
                      height: "20px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: "#dc2626",
                      fontWeight: 800,
                      fontSize: "0.75rem",
                      padding: 0,
                      marginLeft: "0.2rem"
                    }}
                    title="Remove this course"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Enrolled Courses Breakdown and Discount Settings */}
      {selectedCourses.length > 0 && (
        <div
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "1rem"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.75rem"
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: "0.95rem",
                color: "var(--text)"
              }}
            >
              📋 Enrolled Courses Summary ({selectedCourses.length})
            </div>
            <button
              type="button"
              onClick={handleClearAllCourses}
              style={{
                background: "transparent",
                border: "1px solid #fca5a5",
                color: "#dc2626",
                fontSize: "0.78rem",
                fontWeight: 600,
                padding: "0.25rem 0.6rem",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer"
              }}
              title="Remove all enrolled courses"
            >
              ✕ Clear All
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
            {selectedCourses.map((c, idx) => (
              <div
                key={c.courseId || idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.88rem",
                  padding: "0.5rem 0.75rem",
                  background: "var(--surface)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  flexWrap: "wrap",
                  gap: "0.5rem"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: "1 1 200px" }}>
                  <span style={{ color: "var(--text)", fontWeight: 600 }}>• {c.courseName}</span>
                  {Number(c.fee) === 0 && (
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "0.15rem 0.45rem",
                        borderRadius: "4px",
                        background: "#fef3c7",
                        color: "#92400e",
                        fontWeight: 700
                      }}
                      title="Course currently has ₹0 fee. Please enter fee."
                    >
                      ⚠️ Set Fee
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <span style={{ fontSize: "0.82rem", color: "var(--text2)", fontWeight: 600 }}>Fee: ₹</span>
                    <input
                      type="number"
                      min="0"
                      value={c.fee === 0 ? "" : c.fee}
                      placeholder="0"
                      onChange={(e) => handleFeeChange(idx, e.target.value)}
                      style={{
                        width: "100px",
                        padding: "0.25rem 0.5rem",
                        fontSize: "0.88rem",
                        fontWeight: 700,
                        textAlign: "right",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                        color: "var(--text)"
                      }}
                      title="Adjust fee for this lead"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveCourse(idx)}
                    style={{
                      background: "#fee2e2",
                      border: "1px solid #fca5a5",
                      color: "#dc2626",
                      borderRadius: "var(--radius-sm)",
                      padding: "0.3rem 0.65rem",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      cursor: "pointer",
                      transition: "background 0.15s ease"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#fecaca")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#fee2e2")}
                    title="Remove this course"
                  >
                    🗑 Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Discount Controls */}
          <div className="form-row" style={{ marginTop: "0.75rem" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Discount Type</label>
              <select
                value={discountType}
                onChange={(e) => onChangeDiscountType(e.target.value)}
              >
                <option value="none">No Discount</option>
                <option value="percentage">Percentage % Off</option>
                <option value="flat">Flat ₹ Off</option>
              </select>
            </div>

            {discountType !== "none" && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>
                  {discountType === "percentage" ? "Discount Percentage (%)" : "Flat Discount (₹)"}
                </label>
                <input
                  type="number"
                  min="0"
                  max={discountType === "percentage" ? "100" : totalFee.toString()}
                  value={discountValue}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (discountType === "percentage") {
                      onChangeDiscountValue(Math.min(Math.max(val, 0), 100));
                    } else {
                      onChangeDiscountValue(Math.min(Math.max(val, 0), totalFee));
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Fee Calculation Display */}
          <div
            style={{
              marginTop: "1rem",
              paddingTop: "0.75rem",
              borderTop: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
              <span style={{ color: "var(--text2)" }}>Total Fee:</span>
              <span style={{ fontWeight: 600, color: "var(--text)" }}>
                {formatRupees(totalFee)}
              </span>
            </div>

            {savings > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.88rem",
                  color: "#059669",
                  fontWeight: 600
                }}
              >
                <span>Savings:</span>
                <span>
                  - {formatRupees(savings)} ({savingsPercent}%)
                </span>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "1.1rem",
                fontWeight: 800,
                marginTop: "0.25rem",
                paddingTop: "0.25rem",
                borderTop: "2px solid var(--border)",
                color: "var(--accent)"
              }}
            >
              <span>Final Fee:</span>
              <span>{formatRupees(finalFee)}</span>
            </div>

            {savings > 0 && (
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#059669",
                  textAlign: "right",
                  fontWeight: 600
                }}
              >
                🎉 You save {formatRupees(savings)} ({savingsPercent}%)
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
