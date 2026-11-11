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
    },
    paidAmount: {
      type: Number,
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
        "Drop",
        "Wrong number",
        "Wrong Mail"
      ],
      default: "Warm Lead"
    },
    source: {
      type: String,
      trim: true,
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
        "Follow-up Scheduled",
        "Interested",
        "Negotiation",
        "Converted",
        "Enrolled",
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
    lastCallDate: {
      type: Date,
      default: null
    },
    lastCallDuration: {
      type: Number,
      default: 0,
      min: 0
    },
    totalTalkTime: {
      type: Number,
      default: 0,
      min: 0
    },
    isVoicemailPool: {
      type: Boolean,
      default: false
    },
    snoozedUntil: {
      type: Date,
      default: null
    },
    snoozeReason: {
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
    paidAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    balanceAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    paymentStatus: {
      type: String,
      enum: ["Unpaid", "Partial / Token", "Fully Paid"],
      default: "Unpaid"
    },
    remainingDueDate: {
      type: Date,
      default: null
    },
    paymentNotes: {
      type: String,
      trim: true,
      default: ""
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

// Pre-save hook: compute totalFee, finalFee, balanceAmount, and paymentStatus accurately
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

  // Compute payment status and balance
  const paid = Math.max(0, Number(this.paidAmount) || 0);
  this.paidAmount = paid;

  if (this.finalFee > 0) {
    if (paid >= this.finalFee) {
      this.balanceAmount = 0;
      this.paymentStatus = "Fully Paid";
    } else if (paid > 0) {
      this.balanceAmount = Math.max(0, this.finalFee - paid);
      this.paymentStatus = "Partial / Token";
    } else {
      this.balanceAmount = this.finalFee;
      this.paymentStatus = "Unpaid";
    }
  } else {
    if (paid > 0) {
      this.balanceAmount = 0;
      this.paymentStatus = "Fully Paid";
    } else {
      this.balanceAmount = 0;
      this.paymentStatus = "Unpaid";
    }
  }

  next();
});

// Indexes for ultra-fast sorting and dashboard queries
leadSchema.index({ createdAt: -1 });
leadSchema.index({ followUpDate: 1, followUpTime: 1 });
leadSchema.index({ quality: 1, priority: 1, stage: 1 });
leadSchema.index({ isVoicemailPool: 1, snoozedUntil: 1, lastCallDate: 1 });
leadSchema.index({ paymentStatus: 1, remainingDueDate: 1 });

module.exports = mongoose.model("Lead", leadSchema);
