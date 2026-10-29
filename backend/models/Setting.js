const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "default"
    },
    loginTime: {
      type: String,
      default: "10:00", // 24-hr format HH:mm e.g. "10:00" (10:00 AM)
      trim: true
    },
    logoutTime: {
      type: String,
      default: "19:00", // 24-hr format HH:mm e.g. "19:00" (07:00 PM)
      trim: true
    },
    breakStartTime: {
      type: String,
      default: "13:30", // 24-hr format HH:mm e.g. "13:30" (01:30 PM)
      trim: true
    },
    breakEndTime: {
      type: String,
      default: "14:30", // 24-hr format HH:mm e.g. "14:30" (02:30 PM)
      trim: true
    },
    targetTalkTimeMinutes: {
      type: Number,
      default: 90, // 90 mins = 1 hr 30 mins target
      min: 1
    },
    // Dynamic per-day targets (e.g., today 2 hrs, tomorrow 1h 30m, festivals like Navratri, or holiday/off-day)
    dailyTargets: [
      {
        date: { type: String, required: true }, // "YYYY-MM-DD" e.g. "2026-10-29"
        targetMinutes: { type: Number, required: true }, // Target in minutes for this specific day
        isOffDay: { type: Boolean, default: false }, // Marked as Sunday / Holiday / Off
        note: { type: String, default: "" },
        updatedAt: { type: Date, default: Date.now }
      }
    ],
    // Array of daily manual overrides so the counselor can calibrate with Ozonetel portal accurately
    manualTalkTimeAdjustments: [
      {
        date: { type: String, required: true }, // "YYYY-MM-DD" e.g. "2026-10-28"
        adjustedSeconds: { type: Number, required: true }, // Total seconds for that day
        note: { type: String, default: "" },
        updatedAt: { type: Date, default: Date.now }
      }
    ],
    // Per-slot adjustments so counselors can click "+1m" on any specific 30-min block
    slotAdjustments: [
      {
        date: { type: String, required: true }, // "YYYY-MM-DD" e.g. "2026-10-28"
        slotKey: { type: String, required: true }, // e.g. "600", "slot-8", or "14:00"
        addedSeconds: { type: Number, default: 0 } // Extra seconds added directly to this slot
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Setting", settingSchema);
