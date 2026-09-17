const express = require("express");
const router = express.Router();
const WhatsAppTemplate = require("../models/WhatsAppTemplate");

// Default pre-seeded templates for educational counseling
const DEFAULT_TEMPLATES = [
  {
    title: "Course Enquiry Greeting",
    category: "Greeting",
    message: "Hi {name}, this is regarding your enquiry for the {course} with Henry Harvin Education. How can I assist you today?",
    isDefault: true,
    sortOrder: 1
  },
  {
    title: "Follow-Up Discussion",
    category: "Follow-up",
    message: "Hi {name}, following up on our previous discussion regarding the {course} at Henry Harvin Education. Are you available for a quick 2-minute call today?",
    isDefault: true,
    sortOrder: 2
  },
  {
    title: "Syllabus, Schedule & Fees",
    category: "Syllabus & Fees",
    message: "Hi {name}, sharing the syllabus, upcoming batch schedule, and fee details for the {course} with Henry Harvin Education. Please review and let me know if you have any questions!",
    isDefault: true,
    sortOrder: 3
  },
  {
    title: "Exclusive Scholarship / Discount",
    category: "Offer",
    message: "Hi {name}, we have an exclusive limited-time scholarship discount available this week for the {course}. Would you like me to share the discounted fee breakdown?",
    isDefault: true,
    sortOrder: 4
  },
  {
    title: "Free Live Demo Session Invite",
    category: "Demo",
    message: "Hi {name}, we are organizing a free live counseling / demo masterclass for {course}. Would you like me to reserve your seat for this weekend's session?",
    isDefault: true,
    sortOrder: 5
  },
  {
    title: "Enrollment & Payment Link",
    category: "Payment",
    message: "Hi {name}, here is the official enrollment link to confirm your registration for {course}. Please let me know once completed so I can activate your LMS access immediately.",
    isDefault: true,
    sortOrder: 6
  },
  {
    title: "Did Not Connect / Call Back",
    category: "Urgent",
    message: "Hi {name}, I tried calling you regarding your enquiry for {course} with Henry Harvin Education but couldn't connect. When would be a good time to speak with you today?",
    isDefault: true,
    sortOrder: 7
  }
];

// GET /api/whatsapp-templates - Fetch all templates (auto-seeds defaults if empty)
router.get("/", async (req, res) => {
  try {
    let templates = await WhatsAppTemplate.find({}).sort({ sortOrder: 1, createdAt: -1 });

    if (templates.length === 0) {
      await WhatsAppTemplate.insertMany(DEFAULT_TEMPLATES);
      templates = await WhatsAppTemplate.find({}).sort({ sortOrder: 1, createdAt: -1 });
    }

    return res.status(200).json({
      success: true,
      count: templates.length,
      data: templates
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch WhatsApp templates: " + err.message
    });
  }
});

// POST /api/whatsapp-templates - Create a new custom template
router.post("/", async (req, res) => {
  try {
    const { title, category, message } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Template title is required"
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Template message content is required"
      });
    }

    const newTemplate = new WhatsAppTemplate({
      title: title.trim(),
      category: category || "Custom",
      message: message.trim(),
      isDefault: false,
      sortOrder: 99
    });

    const saved = await newTemplate.save();
    return res.status(201).json({
      success: true,
      data: saved
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: "Failed to create template: " + err.message
    });
  }
});

// PUT /api/whatsapp-templates/:id - Update an existing template
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, message } = req.body;

    const template = await WhatsAppTemplate.findById(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found"
      });
    }

    if (title !== undefined) template.title = title.trim();
    if (category !== undefined) template.category = category;
    if (message !== undefined) template.message = message.trim();

    const updated = await template.save();
    return res.status(200).json({
      success: true,
      data: updated
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: "Failed to update template: " + err.message
    });
  }
});

// DELETE /api/whatsapp-templates/:id - Delete a template
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await WhatsAppTemplate.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Template not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Template deleted successfully",
      data: deleted
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete template: " + err.message
    });
  }
});

module.exports = router;
