const mongoose = require("mongoose");

const whatsAppTemplateSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Template title is required"],
      trim: true
    },
    category: {
      type: String,
      enum: [
        "Greeting",
        "Follow-up",
        "Syllabus & Fees",
        "Offer",
        "Demo",
        "Payment",
        "Urgent",
        "Custom"
      ],
      default: "Custom"
    },
    message: {
      type: String,
      required: [true, "Message content is required"],
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

module.exports = mongoose.model("WhatsAppTemplate", whatsAppTemplateSchema);
