const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Course name is required"],
      unique: true,
      trim: true
    },
    fee: {
      type: Number,
      required: [true, "Course fee is required"],
      min: [0, "Fee must be a positive number"]
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Course", courseSchema);
