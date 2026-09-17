/**
 * WhatsApp Helper Utilities for Lead Management CRM
 * Automatically formats phone numbers with country codes (+91 for India),
 * generates personalized greeting messages, and directs desktop/laptop users
 * straight to WhatsApp Web (web.whatsapp.com) to bypass all app-switching prompts
 * and landing pages.
 */

/**
 * Format phone number for WhatsApp international standard.
 * Standard Indian 10-digit mobile numbers are prepended with country code 91.
 *
 * @param {string|number} rawPhone
 * @returns {string} Digits-only international phone string
 */
export function formatWhatsAppPhone(rawPhone) {
  if (!rawPhone) return "";
  const cleaned = String(rawPhone).trim();
  const digitsOnly = cleaned.replace(/\D/g, "");

  // If user explicitly typed a + prefix (e.g. +1 555..., +971...), preserve international digits
  if (cleaned.startsWith("+")) {
    return digitsOnly;
  }

  // 10 digits (Standard Indian mobile numbers) -> Prepend 91
  if (digitsOnly.length === 10) {
    return "91" + digitsOnly;
  }

  // 11 digits starting with 0 (e.g. 09398902091) -> Replace 0 with 91
  if (digitsOnly.length === 11 && digitsOnly.startsWith("0")) {
    return "91" + digitsOnly.slice(1);
  }

  // Already 12 digits starting with 91 (e.g. 919398902091)
  if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
    return digitsOnly;
  }

  return digitsOnly;
}

export const DEFAULT_WHATSAPP_TEMPLATES = [
  {
    _id: "default-1",
    title: "Course Enquiry Greeting",
    category: "Greeting",
    message: "Hi {name}, this is regarding your enquiry for the {course} with Henry Harvin Education. How can I assist you today?",
    isDefault: true
  },
  {
    _id: "default-2",
    title: "Follow-Up Discussion",
    category: "Follow-up",
    message: "Hi {name}, following up on our previous discussion regarding the {course} at Henry Harvin Education. Are you available for a quick 2-minute call today?",
    isDefault: true
  },
  {
    _id: "default-3",
    title: "Syllabus, Schedule & Fees",
    category: "Syllabus & Fees",
    message: "Hi {name}, sharing the syllabus, upcoming batch schedule, and fee details for the {course} with Henry Harvin Education. Please review and let me know if you have any questions!",
    isDefault: true
  },
  {
    _id: "default-4",
    title: "Exclusive Scholarship / Discount",
    category: "Offer",
    message: "Hi {name}, we have an exclusive limited-time scholarship discount available this week for the {course}. Would you like me to share the discounted fee breakdown?",
    isDefault: true
  },
  {
    _id: "default-5",
    title: "Free Live Demo Session Invite",
    category: "Demo",
    message: "Hi {name}, we are organizing a free live counseling / demo masterclass for {course}. Would you like me to reserve your seat for this weekend's session?",
    isDefault: true
  },
  {
    _id: "default-6",
    title: "Enrollment & Payment Link",
    category: "Payment",
    message: "Hi {name}, here is the official enrollment link to confirm your registration for {course}. Please let me know once completed so I can activate your LMS access immediately.",
    isDefault: true
  },
  {
    _id: "default-7",
    title: "Did Not Connect / Call Back",
    category: "Urgent",
    message: "Hi {name}, I tried calling you regarding your enquiry for {course} with Henry Harvin Education but couldn't connect. When would be a good time to speak with you today?",
    isDefault: true
  }
];

/**
 * Render dynamic variables ({name}, {course}, {phone}, {email}, {leadId}) into a template string
 *
 * @param {string} templateString
 * @param {object} lead
 * @returns {string}
 */
export function renderWhatsAppTemplate(templateString, lead) {
  if (!templateString) return "";
  if (!lead) {
    // If no lead selected, clean up or provide clean defaults
    return templateString
      .replace(/\{name\}/gi, "there")
      .replace(/\{course\}/gi, "the course")
      .replace(/\{phone\}/gi, "")
      .replace(/\{email\}/gi, "")
      .replace(/\{leadId\}/gi, "");
  }

  const name = lead.name && lead.name.trim() ? lead.name.trim() : "there";
  const course =
    lead.enrolledCourses && lead.enrolledCourses.length > 0
      ? lead.enrolledCourses[0].courseName
      : lead.courseName && lead.courseName.trim()
      ? lead.courseName.trim()
      : "our training program";
  const phone = lead.phone || "";
  const email = lead.email || "";
  const leadId = lead.leadId || "";

  return templateString
    .replace(/\{name\}/gi, name)
    .replace(/\{course\}/gi, course)
    .replace(/\{phone\}/gi, phone)
    .replace(/\{email\}/gi, email)
    .replace(/\{leadId\}/gi, leadId);
}

/**
 * Generate personalized pre-typed message for a lead
 *
 * @param {object} lead
 * @param {string} templateType - "greeting" | "followup" | "syllabus" | "blank"
 * @returns {string}
 */
export function generateWhatsAppMessage(lead, templateType = "greeting") {
  if (!lead || templateType === "blank") return "";

  switch (templateType) {
    case "followup":
      return renderWhatsAppTemplate(DEFAULT_WHATSAPP_TEMPLATES[1].message, lead);
    case "syllabus":
      return renderWhatsAppTemplate(DEFAULT_WHATSAPP_TEMPLATES[2].message, lead);
    case "offer":
      return renderWhatsAppTemplate(DEFAULT_WHATSAPP_TEMPLATES[3].message, lead);
    case "demo":
      return renderWhatsAppTemplate(DEFAULT_WHATSAPP_TEMPLATES[4].message, lead);
    case "payment":
      return renderWhatsAppTemplate(DEFAULT_WHATSAPP_TEMPLATES[5].message, lead);
    case "urgent":
      return renderWhatsAppTemplate(DEFAULT_WHATSAPP_TEMPLATES[6].message, lead);
    case "greeting":
    default:
      return renderWhatsAppTemplate(DEFAULT_WHATSAPP_TEMPLATES[0].message, lead);
  }
}

/**
 * Generate direct WhatsApp URL that bypasses the "Open WhatsApp?" app prompt
 * and the "Continue to WhatsApp Web" landing page on desktop/laptop.
 *
 * @param {string|number} rawPhone
 * @param {string} messageText
 * @returns {string} URL to open
 */
export function getWhatsAppUrl(rawPhone, messageText = "") {
  const formattedPhone = formatWhatsAppPhone(rawPhone);
  if (!formattedPhone) return "";

  const encodedText = messageText ? encodeURIComponent(messageText) : "";
  const params = [];
  params.push(`phone=${formattedPhone}`);
  if (encodedText) {
    params.push(`text=${encodedText}`);
  }
  const queryString = params.join("&");

  // Check if current device is a mobile device
  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  if (isMobile) {
    // On mobile phone, open official universal link which directly launches WhatsApp app
    return `https://api.whatsapp.com/send?${queryString}`;
  } else {
    // On laptop / desktop browser, open WhatsApp Web directly!
    // This completely prevents Chrome from showing "Open WhatsApp? wants to open this application"
    // and eliminates the "Chat on WhatsApp -> Continue to WhatsApp Web" interstitial page.
    return `https://web.whatsapp.com/send?${queryString}`;
  }
}
