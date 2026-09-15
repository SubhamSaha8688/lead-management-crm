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

  // Toggle selection of a course
  const toggleCourse = (course) => {
    const isSelected = selectedCourses.some(
      (c) => c.courseId === (course._id || course.courseId)
    );

    if (isSelected) {
      // Remove
      const updated = selectedCourses.filter(
        (c) => c.courseId !== (course._id || course.courseId)
      );
      onChangeCourses(updated);
    } else {
      // Add with snapshot of current fee
      const newCourseEntry = {
        courseId: course._id || course.courseId,
        courseName: course.name || course.courseName,
        fee: Number(course.fee) || 0
      };
      onChangeCourses([...selectedCourses, newCourseEntry]);
    }
  };

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
              (c) => c.courseId === course._id
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
              fontWeight: 700,
              fontSize: "0.9rem",
              marginBottom: "0.5rem",
              color: "var(--text)"
            }}
          >
            Enrolled Courses Summary ({selectedCourses.length})
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            {selectedCourses.map((c, idx) => (
              <div
                key={c.courseId || idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.85rem",
                  padding: "0.3rem 0",
                  borderBottom: "1px dashed var(--border)"
                }}
              >
                <span style={{ color: "var(--text)" }}>• {c.courseName}</span>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>
                  {formatRupees(c.fee)}
                </span>
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
