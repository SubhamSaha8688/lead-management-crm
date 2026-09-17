const mongoose = require("mongoose");

const emailTemplateSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Template title is required"],
      trim: true
    },
    category: {
      type: String,
      enum: [
        "Curriculum & Syllabus",
        "Follow-up",
        "Scholarship & Offer",
        "Demo Session",
        "Payment & Enrollment",
        "Did Not Connect",
        "Custom"
      ],
      default: "Custom"
    },
    course: {
      type: String,
      default: "All Courses",
      trim: true
    },
    subject: {
      type: String,
      required: [true, "Email subject is required"],
      trim: true
    },
    body: {
      type: String,
      required: [true, "Email body content is required"],
      trim: true
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    sortOrder: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("EmailTemplate", emailTemplateSchema);
