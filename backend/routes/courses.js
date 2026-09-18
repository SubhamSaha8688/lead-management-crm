const express = require("express");
const router = express.Router();
const Course = require("../models/Course");

// GET /api/courses - Return courses
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.active === "true") {
      filter.active = true;
    }
    const courses = await Course.find(filter).sort({ active: -1, name: 1 }).lean();
    return res.status(200).json({
      success: true,
      count: courses.length,
      data: courses
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch courses: " + error.message
    });
  }
});

// POST /api/courses - Create master course
router.post("/", async (req, res) => {
  try {
    const { name, fee } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Course name is required."
      });
    }

    if (fee === undefined || isNaN(Number(fee)) || Number(fee) < 0) {
      return res.status(400).json({
        success: false,
        message: "A valid non-negative course fee is required."
      });
    }

    const existingCourse = await Course.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") }
    });

    if (existingCourse) {
      // If course exists but was soft-deleted, reactivate it with new fee
      if (!existingCourse.active) {
        existingCourse.active = true;
        existingCourse.fee = Number(fee);
        await existingCourse.save();
        return res.status(200).json({
          success: true,
          message: "Course reactivated and updated.",
          data: existingCourse
        });
      }
      return res.status(400).json({
        success: false,
        message: `Course with name "${name}" already exists.`
      });
    }

    const course = new Course({
      name: name.trim(),
      fee: Number(fee),
      active: true
    });

    const savedCourse = await course.save();

    return res.status(201).json({
      success: true,
      message: "Course added.",
      data: savedCourse
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Course name must be unique."
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to create course: " + error.message
    });
  }
});

// PUT /api/courses/:id - Edit course
router.put("/:id", async (req, res) => {
  try {
    const { name, fee, active } = req.body;
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }

    if (name !== undefined && name.trim() !== "") {
      // Check duplicate name
      const duplicate = await Course.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        _id: { $ne: course._id }
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Another course with name "${name}" already exists.`
        });
      }
      course.name = name.trim();
    }

    if (fee !== undefined && !isNaN(Number(fee)) && Number(fee) >= 0) {
      course.fee = Number(fee);
    }

    if (active !== undefined) {
      course.active = Boolean(active);
    }

    const updatedCourse = await course.save();

    return res.status(200).json({
      success: true,
      message: "Course updated.",
      data: updatedCourse
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update course: " + error.message
    });
  }
});

// DELETE /api/courses/:id - Soft delete course (set active: false)
router.delete("/:id", async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }

    course.active = false;
    await course.save();

    return res.status(200).json({
      success: true,
      message: "Course removed.",
      data: course
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to remove course: " + error.message
    });
  }
});

module.exports = router;
