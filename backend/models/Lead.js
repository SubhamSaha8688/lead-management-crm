const mongoose = require("mongoose");

const enrolledCourseSchema = new mongoose.Schema(
  {
    courseId: {
      type: String,
      required: true,
      trim: true
    },
    courseName: {
      type: String,
      required: true,
      trim: true
    },
    fee: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    }
  },
  { _id: false }
);

const commentSchema = new mongoose.Schema(
  {
    commentId: {
      type: String,
      required: true,
      trim: true
    },
    text: {
      type: String,
      required: true,
      trim: true
    },
    outcome: {
      type: String,
      trim: true,
      default: ""
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const leadSchema = new mongoose.Schema(
  {
    leadId: {
      type: String,
      required: [true, "Lead ID is required"],
      unique: true,
      trim: true
    },
    name: {
      type: String,
      required: [true, "Lead name is required"],
      trim: true
    },
    email: {
      type: String,
      trim: true,
      default: ""
    },
    phone: {
      type: String,
      trim: true,
      default: ""
    },
    quality: {
      type: String,
      enum: [
        "Hot Lead",
        "Warm Lead",
        "Cold Lead",
        "Call Again",
        "Voicemail",
        "Converted/Customer",
        "Not Interested",
        "Wrong number",
        "Wrong Mail"
      ],
      default: "Warm Lead"
    },
    source: {
      type: String,
      enum: [
        "Instagram",
        "WhatsApp",
        "Facebook",
        "Google Ads",
        "Website",
        "Reference / Referral",
        "Cold Call",
        "Walk-in",
        "Email Campaign",
        "Other"
      ],
      default: "Website"
    },
    priority: {
      type: Number,
      enum: [1, 2, 3, 4, 5],
      default: 3
    },
    stage: {
      type: String,
      enum: [
        "New",
        "Contacted",
        "Interested",
        "Negotiation",
        "Converted",
        "Lost"
      ],
      default: "New"
    },
    nextAction: {
      type: String,
      trim: true,
      default: ""
    },
    reminderNote: {
      type: String,
      trim: true,
      default: ""
    },
    lostReason: {
      type: String,
      trim: true,
      default: ""
    },
    callCount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastOutcome: {
      type: String,
      trim: true,
      default: ""
    },
    enquiryDate: {
      type: Date,
      default: Date.now
    },
    followUpDate: {
      type: Date,
      default: null
    },
    followUpTime: {
      type: String,
      trim: true,
      default: ""
    },
    enrolledCourses: {
      type: [enrolledCourseSchema],
      default: []
    },
    totalFee: {
      type: Number,
      default: 0,
      min: 0
    },
    discountType: {
      type: String,
      enum: ["none", "percentage", "flat"],
      default: "none"
    },
    discountValue: {
      type: Number,
      default: 0,
      min: 0
    },
    finalFee: {
      type: Number,
      default: 0,
      min: 0
    },
    comments: {
      type: [commentSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Pre-save hook: compute totalFee and finalFee accurately
leadSchema.pre("save", function (next) {
  const calculatedTotal = (this.enrolledCourses || []).reduce((sum, item) => {
    return sum + (Number(item.fee) || 0);
  }, 0);
  this.totalFee = Math.max(0, calculatedTotal);

  let discountVal = Number(this.discountValue) || 0;
  if (discountVal < 0) {
    discountVal = 0;
    this.discountValue = 0;
  }

  let final = this.totalFee;

  if (this.discountType === "percentage") {
    if (discountVal > 100) {
      discountVal = 100;
      this.discountValue = 100;
    }
    const savings = (this.totalFee * discountVal) / 100;
    final = Math.max(0, this.totalFee - savings);
  } else if (this.discountType === "flat") {
    if (discountVal > this.totalFee) {
      discountVal = this.totalFee;
      this.discountValue = this.totalFee;
    }
    final = Math.max(0, this.totalFee - discountVal);
  } else {
    this.discountType = "none";
    this.discountValue = 0;
    final = this.totalFee;
  }

  this.finalFee = Math.round(final);
  next();
});

module.exports = mongoose.model("Lead", leadSchema);
