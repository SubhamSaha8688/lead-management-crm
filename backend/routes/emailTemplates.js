const express = require("express");
const router = express.Router();
const EmailTemplate = require("../models/EmailTemplate");

// Default pre-seeded templates for educational counseling at Henry Harvin
const DEFAULT_TEMPLATES = [
  {
    title: "Course Curriculum & Syllabus Brochure",
    category: "Curriculum & Syllabus",
    course: "All Courses",
    subject: "Henry Harvin Education: {course} Curriculum, Syllabus & Schedule for {name}",
    body: `Dear {name},

Greetings from Henry Harvin Education!

Thank you for your interest in our {course} training and certification program.

As discussed, I am pleased to share the program curriculum, learning modules, and upcoming batch details with you.

Program Highlights:
• Internationally Recognized Certification & Gold Membership
• 100% Practical Hands-on Training with Real-world Capstone Projects
• 1-Year Access to LMS with Class Recordings, Study Materials & Masterclasses
• Guaranteed Internship & Placement Support with Top Corporates
• 24x7 Dedicated Mentor Support & Doubt Clearing Sessions

Upcoming Batch Schedule:
• Weekend Batch: Starting this Saturday (Live Interactive Online Sessions)
• Weekday Evening Batch: Available on demand

Standard Program Fee: {fees} (Flexible No-Cost EMI options available)

Please review the curriculum outline and let me know if you would like me to reserve a provisional seat for you in the upcoming batch.

Looking forward to helping you achieve your career goals!

Warm regards,
{counselorName}
Senior Educational Counselor | Henry Harvin Education
Official Email: {counselorEmail}
Phone / WhatsApp: {counselorPhone}
Website: https://www.henryharvin.com`,
    isDefault: true,
    sortOrder: 1
  },
  {
    title: "Follow-Up Discussion on Course Enquiry",
    category: "Follow-up",
    course: "All Courses",
    subject: "Following up on your {course} enquiry - Henry Harvin Education",
    body: `Dear {name},

I hope this email finds you well.

I am writing to follow up on our earlier interaction regarding your career development in {course} with Henry Harvin Education.

We are currently finalizing registrations for the upcoming batch starting this weekend. Have you had an opportunity to review the syllabus and program schedule?

If you have any questions regarding:
1. Course curriculum and module breakdown
2. Batch timings and faculty profile
3. Special fee discounts or installment options

Please reply to this email or let me know a convenient time for a quick 2-minute phone call. I would be happy to guide you!

Warm regards,
{counselorName}
Senior Educational Counselor | Henry Harvin Education
Official Email: {counselorEmail}
Phone / WhatsApp: {counselorPhone}
Website: https://www.henryharvin.com`,
    isDefault: true,
    sortOrder: 2
  },
  {
    title: "Exclusive Scholarship & Fee Offer Letter",
    category: "Scholarship & Offer",
    course: "All Courses",
    subject: "Special Scholarship Offer: Fee Waiver for {course} - {name}",
    body: `Dear {name},

I am delighted to share some wonderful news regarding your admission into the {course} at Henry Harvin Education!

Based on your profile review, you have been approved for an Exclusive Corporate Scholarship Discount for the upcoming batch.

Fee Structure Breakdown:
• Standard Tuition Fee: {fees}
• Scholarship / Special Privilege Discount: Applicable this week
• Flexible Payment: 0% Interest EMI options available across major credit cards & Bajaj Finserv

Please note that this special fee benefit is valid strictly for the current batch registration and is allocated on a first-come, first-served basis due to limited class capacity.

Would you like me to share the official scholarship enrollment link with you today?

Warm regards,
{counselorName}
Senior Educational Counselor | Henry Harvin Education
Official Email: {counselorEmail}
Phone / WhatsApp: {counselorPhone}
Website: https://www.henryharvin.com`,
    isDefault: true,
    sortOrder: 3
  },
  {
    title: "Free Live Demo Masterclass Invitation",
    category: "Demo Session",
    course: "All Courses",
    subject: "Invitation: Free Live Masterclass / Counseling Demo for {course} - Henry Harvin",
    body: `Dear {name},

We are pleased to invite you to an exclusive Free Live Interactive Masterclass on {course}, hosted by Henry Harvin Education.

Session Details:
• Topic: Overview, Industry Roadmap & Practical Applications of {course}
• Trainer: Senior Industry Practitioner (15+ Years Experience)
• Platform: Live on Zoom / Google Meet

What You Will Learn:
• Current industry demand, job roles, and salary expectations
• Hands-on walkthrough of key concepts and case studies
• Live Q&A with the master trainer

Seats are limited to ensure individual attention. Please reply with "YES" to confirm your participation so I can send you the direct meeting link and passkey.

Warm regards,
{counselorName}
Senior Educational Counselor | Henry Harvin Education
Official Email: {counselorEmail}
Phone / WhatsApp: {counselorPhone}
Website: https://www.henryharvin.com`,
    isDefault: true,
    sortOrder: 4
  },
  {
    title: "Official Enrollment & Fee Payment Link",
    category: "Payment & Enrollment",
    course: "All Courses",
    subject: "Official Enrollment & Admission Confirmation Link - {course} | Henry Harvin",
    body: `Dear {name},

Welcome to the Henry Harvin learning community!

As discussed, please find below your official registration and secure fee payment link to confirm your enrollment in {course}:

Registration Link: https://crm.henryharvin.com/portal-new/student-payment
(Lead ID: {leadId})

Next Steps Upon Confirmation:
1. Immediate access to the Henry Harvin LMS learning portal
2. Welcome kit, pre-reading study materials, and software installation guide
3. Invitation to the batch WhatsApp group and live class access links
4. Direct introduction to your dedicated batch manager and mentor

Please share the transaction screenshot or reference number once completed so I can expedite your batch allocation.

If you require any assistance during payment, feel free to call or WhatsApp me directly.

Warm regards,
{counselorName}
Senior Educational Counselor | Henry Harvin Education
Official Email: {counselorEmail}
Phone / WhatsApp: {counselorPhone}
Website: https://www.henryharvin.com`,
    isDefault: true,
    sortOrder: 5
  },
  {
    title: "Did Not Connect / Missed Call Follow-up",
    category: "Did Not Connect",
    course: "All Courses",
    subject: "Tried reaching you regarding your {course} enquiry - Henry Harvin Education",
    body: `Dear {name},

I tried calling you today on your contact number ({phone}) regarding your enquiry for the {course} with Henry Harvin Education, but was unable to connect.

I understand you might be busy, so I wanted to drop you a quick note to make sure you have all the necessary details.

Whenever you have a few minutes, please let me know when would be the best time to speak with you today or tomorrow. Alternatively, feel free to reply to this email with your questions.

Looking forward to speaking with you!

Warm regards,
{counselorName}
Senior Educational Counselor | Henry Harvin Education
Official Email: {counselorEmail}
Phone / WhatsApp: {counselorPhone}
Website: https://www.henryharvin.com`,
    isDefault: true,
    sortOrder: 6
  }
];

// GET /api/email-templates - Fetch all email templates (auto-seeds defaults if empty)
router.get("/", async (req, res) => {
  try {
    let templates = await EmailTemplate.find({}).sort({ sortOrder: 1, createdAt: -1 });

    if (templates.length === 0) {
      await EmailTemplate.insertMany(DEFAULT_TEMPLATES);
      templates = await EmailTemplate.find({}).sort({ sortOrder: 1, createdAt: -1 });
    }

    return res.status(200).json({
      success: true,
      count: templates.length,
      data: templates
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch email templates: " + err.message
    });
  }
});

// POST /api/email-templates - Create a new custom template
router.post("/", async (req, res) => {
  try {
    const { title, category, course, subject, body } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Template title is required"
      });
    }

    if (!subject || !subject.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email subject is required"
      });
    }

    if (!body || !body.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email body content is required"
      });
    }

    const newTemplate = new EmailTemplate({
      title: title.trim(),
      category: category || "Custom",
      course: course && course.trim() ? course.trim() : "All Courses",
      subject: subject.trim(),
      body: body.trim(),
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
      message: "Failed to create email template: " + err.message
    });
  }
});

// PUT /api/email-templates/:id - Update an existing template
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, course, subject, body } = req.body;

    const template = await EmailTemplate.findById(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Email template not found"
      });
    }

    if (title !== undefined) template.title = title.trim();
    if (category !== undefined) template.category = category;
    if (course !== undefined) template.course = course.trim() || "All Courses";
    if (subject !== undefined) template.subject = subject.trim();
    if (body !== undefined) template.body = body.trim();

    const updated = await template.save();
    return res.status(200).json({
      success: true,
      data: updated
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: "Failed to update email template: " + err.message
    });
  }
});

// DELETE /api/email-templates/:id - Delete a template
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await EmailTemplate.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Email template not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Email template deleted successfully",
      data: deleted
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete email template: " + err.message
    });
  }
});

module.exports = router;
