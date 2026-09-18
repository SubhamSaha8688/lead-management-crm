const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Counselor / User name is required"],
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ""
    },
    passcode: {
      type: String,
      required: [true, "Passcode / PIN is required"],
      trim: true,
      unique: true
    },
    dbName: {
      type: String,
      required: [true, "MongoDB database name is required"],
      trim: true,
      default: "lead_manager"
    },
    role: {
      type: String,
      enum: ["admin", "counselor"],
      default: "counselor"
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastLoginAt: {
      type: Date
    }
  },
  { timestamps: true }
);

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

module.exports = mongoose.model("User", userSchema);
