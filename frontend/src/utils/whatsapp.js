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

/**
 * Generate personalized pre-typed message for a lead
 *
 * @param {object} lead
 * @param {string} templateType - "greeting" | "followup" | "syllabus" | "blank"
 * @returns {string}
 */
export function generateWhatsAppMessage(lead, templateType = "greeting") {
  if (!lead || templateType === "blank") return "";

  const name = lead.name ? lead.name.trim() : "";
  const course =
    lead.enrolledCourses && lead.enrolledCourses.length > 0
      ? lead.enrolledCourses[0].courseName
      : lead.courseName || "";

  switch (templateType) {
    case "followup":
      if (name && course) {
        return `Hi ${name}, following up on our previous discussion regarding the ${course} at Henry Harvin Education. Are you available for a quick conversation today?`;
      } else if (name) {
        return `Hi ${name}, following up on our previous discussion regarding your training program at Henry Harvin Education. Are you available for a quick conversation today?`;
      }
      return `Hi, following up on our previous conversation regarding the course at Henry Harvin Education. When would be a good time to connect?`;

    case "syllabus":
      if (name && course) {
        return `Hi ${name}, sharing the syllabus, upcoming batch schedule, and fee details for the ${course} with Henry Harvin Education. Please review and let me know if you have any questions!`;
      } else if (course) {
        return `Hi, sharing the syllabus, batch schedule, and fee details for the ${course} with Henry Harvin Education. Please let me know if you have any questions!`;
      }
      return `Hi, sharing the syllabus and course details from Henry Harvin Education. Please let me know if you have any questions!`;

    case "greeting":
    default:
      if (name && course) {
        return `Hi ${name}, this is regarding your enquiry for the ${course} with Henry Harvin Education. How can I assist you today?`;
      } else if (name) {
        return `Hi ${name}, this is regarding your enquiry with Henry Harvin Education. How can I assist you today?`;
      } else if (course) {
        return `Hi, this is regarding your enquiry for the ${course} with Henry Harvin Education. How can I assist you today?`;
      } else {
        return `Hi, this is regarding your enquiry with Henry Harvin Education. How can I assist you today?`;
      }
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
