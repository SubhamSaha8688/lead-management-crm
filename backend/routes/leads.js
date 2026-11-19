const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const Setting = require("../models/Setting");
const Course = require("../models/Course");

// Helper to find a lead by MongoDB _id or custom leadId
const findLeadByIdOrCustomId = async (idParam) => {
  if (!idParam) return null;
  const cleanId = String(idParam).trim();
  if (mongoose.Types.ObjectId.isValid(cleanId)) {
    const lead = await Lead.findById(cleanId);
    if (lead) return lead;
  }
  const strippedId = cleanId.replace(/^LD-?/i, "");
  return await Lead.findOne({
    $or: [
      { leadId: cleanId },
      { leadId: `LD-${strippedId}` },
      { leadId: strippedId }
    ]
  });
};

/**
 * Helper: Normalizes any time string (e.g. "6:30 PM", "630pm", "18:30", "6:30 PM AM", "11 AM")
 * into clean standard 24-hour "HH:mm" format (e.g. "18:30", "11:00").
 */
function normalizeTimeTo24Hour(timeStr) {
  if (!timeStr) return "";
  let clean = String(timeStr).trim();
  if (!clean) return "";

  // Strip duplicate/trailing tokens e.g. "PM AM" -> "PM"
  clean = clean.replace(/\b(am|pm)\s*(am|pm)\b/gi, "$1");

  // 1. Standard 24-hour format "HH:mm" (e.g. "18:30", "09:00", "00:00")
  const m24 = clean.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (m24) {
    return `${m24[1].padStart(2, "0")}:${m24[2]}`;
  }

  // 2. 12-hour format with colon (e.g. "6:30 PM", "6:30pm", "11:00 AM", "06:30 am")
  const m12Colon = clean.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (m12Colon) {
    let h = parseInt(m12Colon[1], 10);
    const m = m12Colon[2];
    const ampm = (m12Colon[3] || "").toLowerCase();
    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    // Heuristic: If counselor wrote e.g. "6:30" without am/pm, in sales CRM follow-ups hours 1..6 are typically PM (13..18)
    if (!ampm && h >= 1 && h <= 6) h += 12;
    return `${String(h).padStart(2, "0")}:${m}`;
  }

  // 3. Compact 3 digits (e.g. "630pm", "630 PM", "630")
  const m3Digits = clean.match(/^(\d{1})(\d{2})\s*(am|pm)?$/i);
  if (m3Digits) {
    let h = parseInt(m3Digits[1], 10);
    const m = m3Digits[2];
    const ampm = (m3Digits[3] || "").toLowerCase();
    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    if (!ampm && h >= 1 && h <= 6) h += 12;
    return `${String(h).padStart(2, "0")}:${m}`;
  }

  // 4. Compact 4 digits (e.g. "1130am", "1830")
  const m4Digits = clean.match(/^(\d{2})(\d{2})\s*(am|pm)?$/i);
  if (m4Digits) {
    let h = parseInt(m4Digits[1], 10);
    const m = m4Digits[2];
    const ampm = (m4Digits[3] || "").toLowerCase();
    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    if (h >= 0 && h <= 23 && parseInt(m, 10) >= 0 && parseInt(m, 10) <= 59) {
      return `${String(h).padStart(2, "0")}:${m}`;
    }
  }

  // 5. Hour only with AM/PM (e.g. "6pm", "11am", "2 PM")
  const mHourOnly = clean.match(/^(\d{1,2})\s*(am|pm)$/i);
  if (mHourOnly) {
    let h = parseInt(mHourOnly[1], 10);
    const ampm = mHourOnly[2].toLowerCase();
    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:00`;
  }

  return clean;
}

function formatTime12(timeStr) {
  if (!timeStr) return "";
  if (timeStr instanceof Date && !isNaN(timeStr.getTime())) {
    const istParts = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).formatToParts(timeStr);
    const hour = istParts.find((p) => p.type === "hour")?.value || "12";
    const minute = istParts.find((p) => p.type === "minute")?.value || "00";
    const dayPeriod = (istParts.find((p) => p.type === "dayPeriod")?.value || "PM").toUpperCase();
    return `${hour}:${minute} ${dayPeriod}`;
  }

  let clean = String(timeStr).trim();
  if (!clean) return "";

  if (clean.includes("T") || (clean.includes("-") && clean.includes(":"))) {
    const parsedDate = new Date(clean);
    if (!isNaN(parsedDate.getTime())) {
      const istParts = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      }).formatToParts(parsedDate);
      const hour = istParts.find((p) => p.type === "hour")?.value || "12";
      const minute = istParts.find((p) => p.type === "minute")?.value || "00";
      const dayPeriod = (istParts.find((p) => p.type === "dayPeriod")?.value || "PM").toUpperCase();
      return `${hour}:${minute} ${dayPeriod}`;
    }
  }

  // Strip duplicate tokens e.g. "PM AM"
  clean = clean.replace(/\b(am|pm)\s*(am|pm)\b/gi, "$1");

  // If already in 12-hour format e.g. "6:30 PM"
  const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = match12[2];
    const ampm = match12[3].toUpperCase();
    if (h === 0) h = 12;
    else if (h > 12) h = h % 12;
    return `${h}:${m} ${ampm}`;
  }

  // If compact like "630pm" without colon, normalize to 24h first
  if (!clean.includes(":")) {
    const n24 = normalizeTimeTo24Hour(clean);
    if (n24 && n24.includes(":")) {
      clean = n24;
    }
  }

  // Standard 24-hour format "HH:mm"
  const parts = clean.split(":");
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    if (!isNaN(hours)) {
      const minutes = (parts[1] || "").replace(/[^0-9]/g, "").padStart(2, "0").slice(0, 2) || "00";
      const ampm = hours >= 12 ? "PM" : "AM";
      const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
      return `${formattedHours}:${minutes} ${ampm}`;
    }
  }

  return clean;
}

/**
 * Helper: Computes exact local follow-up Date object combining followUpDate and followUpTime.
 * Returns Date object or null.
 */
function computeFollowUpDateTime(followUpDate, followUpTime) {
  if (!followUpDate) return null;
  const d = new Date(followUpDate);
  if (isNaN(d.getTime())) return null;

  let year, month, day;
  if (typeof followUpDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(followUpDate)) {
    [year, month, day] = followUpDate.split("T")[0].split("-").map(Number);
  } else {
    const istParts = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(d);
    day = Number(istParts.find((p) => p.type === "day")?.value);
    month = Number(istParts.find((p) => p.type === "month")?.value);
    year = Number(istParts.find((p) => p.type === "year")?.value);
  }

  let h = 0;
  let m = 0;
  const normalized = normalizeTimeTo24Hour(followUpTime);
  if (normalized && normalized.includes(":")) {
    const parts = normalized.split(":");
    h = parseInt(parts[0], 10) || 0;
    m = parseInt(parts[1], 10) || 0;
  }

  // Target IST Date: UTC milliseconds for IST (UTC+05:30)
  const utcMs = Date.UTC(year, month - 1, day, h, m, 0, 0) - (5.5 * 3600 * 1000);
  return new Date(utcMs);
}

function formatFollowUpReason(followUpDateTime, followUpTime) {
  if (!followUpDateTime) return "Follow-up Scheduled";
  const istDateStr = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(followUpDateTime);
  const timeFormatted = followUpTime ? formatTime12(followUpTime) : "";
  const timePart = timeFormatted ? ` at ${timeFormatted}` : "";
  return `Follow-up Scheduled (${istDateStr}${timePart})`;
}

/**
 * Normalizes stage string to match strict Lead schema enum
 */
function normalizeStage(stageStr) {
  if (!stageStr) return "Contacted";
  const s = String(stageStr).trim();
  const lower = s.toLowerCase();
  if (lower === "new") return "New";
  if (lower === "contacted") return "Contacted";
  if (lower === "interested") return "Interested";
  if (lower === "negotiation") return "Negotiation";
  if (lower === "converted" || lower === "enrolled" || lower === "admitted") return "Converted";
  if (lower === "lost" || lower === "drop") return "Lost";
  if (lower === "follow-up scheduled") return "Follow-up Scheduled";
  if (lower.includes("follow") || lower.includes("callback") || lower.includes("again")) {
    return "Contacted";
  }
  return "Contacted";
}

/**
 * Normalizes lead quality string to match strict Lead schema enum
 */
function normalizeQuality(qStr) {
  if (!qStr) return "Warm Lead";
  const q = String(qStr).trim();
  const lower = q.toLowerCase();
  if (lower.includes("hot")) return "Hot Lead";
  if (lower.includes("warm")) return "Warm Lead";
  if (lower.includes("cold")) return "Cold Lead";
  if (lower.includes("again") || lower.includes("callback")) return "Call Again";
  if (lower.includes("voice")) return "Voicemail";
  if (lower.includes("convert") || lower.includes("customer")) return "Converted/Customer";
  if (lower.includes("not inter") || lower.includes("drop") || lower.includes("lost")) return "Not Interested";
  if (lower.includes("wrong num")) return "Wrong number";
  if (lower.includes("wrong mail") || lower.includes("invalid mail")) return "Wrong Mail";
  return "Warm Lead";
}

/**
 * Intelligent Natural Language Follow-up Engine
 * Extracts exact follow-up date and time from any description, comment, note, or portal text
 */
function extractFollowUpFromText(text, refDateInput = new Date()) {
  if (!text || typeof text !== "string") return { followUpDate: null, followUpTime: null, matched: false };

  // Strip out HTML tags and historical call log headers like "<b style=...>28/06/2025 2:40pm</b>"
  const cleanText = text
    .replace(/<b[^>]*>.*?<\/b>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\b\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}\s+\d{1,2}:\d{2}\s*(?:am|pm)?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const lower = cleanText.toLowerCase();

  // Reference date in IST
  const refDate = new Date(refDateInput);
  const istDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(refDate); // YYYY-MM-DD
  const [curYear, curMonth, curDay] = istDateStr.split("-").map(Number);

  // Current hour/minute in IST
  const istTimeParts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "numeric",
    hour12: false
  }).formatToParts(refDate);
  const curHour = parseInt(istTimeParts.find((p) => p.type === "hour")?.value || "12", 10);
  const curMin = parseInt(istTimeParts.find((p) => p.type === "minute")?.value || "0", 10);

  let detectedTime = null;
  let detectedDate = null;

  // 1. TIME EXTRACTION
  const triggerTimeMatch = lower.match(/(?:call\s*(?:after|at)?|after|at|callback\s*(?:at|after)?|ring\s*(?:at)?)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?:\s*baje)?/i);
  const explicitTimeMatch = lower.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i) ||
                            lower.match(/\b(\d{1,2})\s*(am|pm)\b/i);

  if (triggerTimeMatch) {
    let h = parseInt(triggerTimeMatch[1], 10);
    const m = triggerTimeMatch[2] ? triggerTimeMatch[2] : "00";
    const ampm = (triggerTimeMatch[3] || "").toLowerCase();

    if (ampm === "pm" && h < 12) h += 12;
    else if (ampm === "am" && h === 12) h = 0;
    else if (!ampm) {
      // Business heuristics: 1..8 => PM (13..20), 9..11 => AM (09..11), 12 => 12 PM
      if (h >= 1 && h <= 8) h += 12;
    }
    if (h >= 0 && h <= 23) {
      detectedTime = `${String(h).padStart(2, "0")}:${m}`;
    }
  } else if (explicitTimeMatch) {
    let h = parseInt(explicitTimeMatch[1], 10);
    const m = explicitTimeMatch[2] ? explicitTimeMatch[2] : "00";
    const ampm = (explicitTimeMatch[3] || explicitTimeMatch[2] || "").toLowerCase();
    if (ampm === "pm" && h < 12) h += 12;
    else if (ampm === "am" && h === 12) h = 0;
    if (h >= 0 && h <= 23) {
      detectedTime = `${String(h).padStart(2, "0")}:${m}`;
    }
  } else if (lower.includes("morning") || lower.includes("subah")) {
    detectedTime = "10:30";
  } else if (lower.includes("after lunch") || lower.includes("dopahar") || lower.includes("afternoon")) {
    detectedTime = "14:30";
  } else if (lower.includes("evening") || lower.includes("shaam")) {
    detectedTime = "18:00";
  } else if (lower.includes("night") || lower.includes("raat")) {
    detectedTime = "20:00";
  }

  // 2. DATE EXTRACTION
  const monthMap = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
    aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10,
    nov: 11, november: 11, dec: 12, december: 12
  };

  const dateMonthMatch = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s*,?\s*(\d{4}))?\b/i);
  const monthDateMatch = lower.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/i);
  const isoMatch = lower.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const dmyMatch = lower.match(/\b(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})\b/);
  const inDaysMatch = lower.match(/\b(?:in|after)\s+(\d+)\s*days?\b/i);

  if (dateMonthMatch) {
    const day = parseInt(dateMonthMatch[1], 10);
    const mon = monthMap[dateMonthMatch[2].toLowerCase()] || curMonth;
    const year = dateMonthMatch[3] ? parseInt(dateMonthMatch[3], 10) : curYear;
    detectedDate = `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  } else if (monthDateMatch) {
    const mon = monthMap[monthDateMatch[1].toLowerCase()] || curMonth;
    const day = parseInt(monthDateMatch[2], 10);
    const year = monthDateMatch[3] ? parseInt(monthDateMatch[3], 10) : curYear;
    detectedDate = `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  } else if (isoMatch) {
    detectedDate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  } else if (dmyMatch) {
    let day = parseInt(dmyMatch[1], 10);
    let mon = parseInt(dmyMatch[2], 10);
    let yr = parseInt(dmyMatch[3], 10);
    if (yr < 100) yr += 2000;
    if (day <= 31 && mon <= 12) {
      detectedDate = `${yr}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  } else if (inDaysMatch) {
    const daysToAdd = parseInt(inDaysMatch[1], 10);
    const target = new Date(refDate);
    target.setDate(target.getDate() + daysToAdd);
    detectedDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(target);
  } else if (lower.includes("day after tomorrow") || lower.includes("parso")) {
    const target = new Date(refDate);
    target.setDate(target.getDate() + 2);
    detectedDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(target);
  } else if (lower.includes("tomorrow") || lower.includes("kal")) {
    const target = new Date(refDate);
    target.setDate(target.getDate() + 1);
    detectedDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(target);
  } else if (lower.includes("next week")) {
    const target = new Date(refDate);
    target.setDate(target.getDate() + 7);
    detectedDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(target);
  } else {
    const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    for (let dIdx = 0; dIdx < daysOfWeek.length; dIdx++) {
      const dayName = daysOfWeek[dIdx];
      if (lower.includes(`next ${dayName}`) || lower.includes(`on ${dayName}`) || lower.includes(`this ${dayName}`)) {
        const curDayOfWeek = refDate.getDay();
        let diff = dIdx - curDayOfWeek;
        if (diff <= 0) diff += 7;
        const target = new Date(refDate);
        target.setDate(target.getDate() + diff);
        detectedDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(target);
        break;
      }
    }
  }

  // Guard against ancient / past dates from previous years (like 2025)
  if (detectedDate && detectedDate < istDateStr) {
    if (detectedTime) {
      const [tHour, tMin] = detectedTime.split(":").map(Number);
      if (tHour > curHour || (tHour === curHour && tMin > curMin)) {
        detectedDate = istDateStr; // Today
      } else {
        const target = new Date(refDate);
        target.setDate(target.getDate() + 1);
        detectedDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(target);
      }
    } else {
      detectedDate = null;
    }
  }

  // 3. Couple Time to Date
  if (detectedTime && !detectedDate) {
    const [tHour, tMin] = detectedTime.split(":").map(Number);
    if (tHour > curHour || (tHour === curHour && tMin > curMin)) {
      detectedDate = istDateStr; // Today
    } else {
      const target = new Date(refDate);
      target.setDate(target.getDate() + 1);
      detectedDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(target);
    }
  }

  if (detectedDate && !detectedTime) {
    detectedTime = "11:00";
  }

  return {
    followUpDate: detectedDate,
    followUpTime: detectedTime,
    matched: Boolean(detectedDate || detectedTime)
  };
}

/**
 * Ensures follow-up dates are never assigned to a past year (e.g. 2025).
 * If a date is in the past, rolls it forward to today.
 */
function sanitizeFollowUpDate(followUpDate, followUpTime, refDate = new Date()) {
  const istDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(refDate); // YYYY-MM-DD
  const curYear = parseInt(istDateStr.split("-")[0], 10);

  if (!followUpDate) return { followUpDate: null, followUpTime: followUpTime || "" };

  const parsed = new Date(followUpDate);
  if (isNaN(parsed.getTime())) return { followUpDate: null, followUpTime: followUpTime || "" };

  const targetYear = parsed.getFullYear();
  const targetIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(parsed);

  // If date is in the past or in a previous year (like 2025)
  if (targetIso < istDateStr || targetYear < curYear) {
    return {
      followUpDate: istDateStr,
      followUpTime: followUpTime || "11:00",
      rolledForward: true
    };
  }

  return {
    followUpDate: targetIso,
    followUpTime: followUpTime || "11:00",
    rolledForward: false
  };
}

// Canonical Master Course Catalog & Alias Rules
const COURSE_CATALOG = [
  {
    tokens: ["ssgb", "lssgb", "green belt", "six sigma green belt", "lean six sigma green belt"],
    dbName: "Green Belt",
    displayName: "Six Sigma Green Belt (SSGB)",
    defaultFee: 17500
  },
  {
    tokens: ["ssbb", "lssbb", "black belt", "six sigma black belt", "lean six sigma black belt"],
    dbName: "Black Belt",
    displayName: "Six Sigma Black Belt (SSBB)",
    defaultFee: 29500
  },
  {
    tokens: ["mbb", "ssmbb", "lssmbb", "master black belt", "six sigma master black belt"],
    dbName: "Master Black Belt",
    displayName: "Master Black Belt (SSMBB)",
    defaultFee: 59500
  },
  {
    tokens: ["post graduation in lean six sigma", "post graduate in lean six sigma", "pg in lean six sigma", "pgp in lean six sigma", "pgp-lss", "pgplss", "pgp lss"],
    dbName: "Post Graduation In Lean Six Sigma",
    displayName: "Post Graduation In Lean Six Sigma",
    defaultFee: 89000
  },
  {
    tokens: ["pmp", "project management professional", "pmc"],
    dbName: "PMP",
    displayName: "PMP (Project Management Professional)",
    defaultFee: 14900
  },
  {
    tokens: ["advanced excel", "excel"],
    dbName: "Advanced Excel",
    displayName: "Advanced Excel",
    defaultFee: 7500
  },
  {
    tokens: [
      "pgp-gl",
      "pgpgl",
      "pgp in german",
      "pgp in german language",
      "post graduate program in german language",
      "post graduation in german language",
      "german language course",
      "german language",
      "german",
      "deutsch",
      "gl"
    ],
    dbName: "German Language",
    displayName: "German Language Course (PGP-GL)",
    defaultFee: 15500
  },
  {
    tokens: [
      "pgp-fl",
      "pgpfl",
      "pgp in french",
      "pgp in french language",
      "post graduate program in french language",
      "post graduation in french language",
      "french language course",
      "french language",
      "french",
      "francais",
      "fl"
    ],
    dbName: "French Language",
    displayName: "French Language Course (PGP-FL)",
    defaultFee: 15500
  },
  {
    tokens: [
      "pgp-sl",
      "pgpsl",
      "pgp in spanish",
      "pgp in spanish language",
      "post graduate program in spanish language",
      "post graduation in spanish language",
      "spanish language course",
      "spanish language",
      "spanish",
      "espanol",
      "sl"
    ],
    dbName: "Spanish Language",
    displayName: "Spanish Language Course (PGP-SL)",
    defaultFee: 15500
  },
  {
    tokens: [
      "pgp-jl",
      "pgpjl",
      "pgp in japanese",
      "pgp in japanese language",
      "post graduate program in japanese language",
      "post graduation in japanese language",
      "japanese language course",
      "japanese language",
      "japanese",
      "nihongo",
      "jl",
      "japanese n5",
      "n5"
    ],
    dbName: "Japanese N5",
    displayName: "Japanese Language Course (PGP-JL)",
    defaultFee: 9500
  },
  {
    tokens: [
      "pgp-kl",
      "pgpkl",
      "pgp in korean",
      "pgp in korean language",
      "post graduate program in korean language",
      "korean language course",
      "korean language",
      "korean",
      "hangul",
      "kl"
    ],
    dbName: "Korean Language",
    displayName: "Korean Language Course (PGP-KL)",
    defaultFee: 15500
  },
  {
    tokens: ["sap pp", "sap-pp"],
    dbName: "SAP PP",
    displayName: "SAP PP",
    defaultFee: 34500
  },
  {
    tokens: ["sap fico", "sap-fico", "fico"],
    dbName: "SAP FICO",
    displayName: "SAP FICO",
    defaultFee: 34500
  },
  {
    tokens: ["med-code", "medical coding"],
    dbName: "Medical Coding",
    displayName: "Medical Coding Course",
    defaultFee: 24500
  }
];

// Helper to intelligently resolve course name and catalogue fee
function resolveCourseAndFee(rawName, currentFee = 0, dbCourses = []) {
  if (!rawName) return { courseName: "General Course", fee: 0 };
  let clean = String(rawName).trim();

  let extractedFee = 0;
  const feeMatch = clean.match(/\(fee:\s*₹?([0-9,.]+)\)/i);
  if (feeMatch) {
    extractedFee = parseFloat(feeMatch[1].replace(/,/g, "")) || 0;
    clean = clean.replace(/\s*\(fee:\s*₹?[0-9,.]+\)/i, "").trim();
  }

  const lower = clean.toLowerCase();

  let matchedCatalog = COURSE_CATALOG.find((cat) => {
    return cat.tokens.some((tok) => {
      if (lower === tok) return true;
      const regex = new RegExp(`(^|[^a-zA-Z0-9])${tok}([^a-zA-Z0-9]|$)`, "i");
      return regex.test(lower);
    });
  });

  let matchedDb = null;
  if (matchedCatalog && matchedCatalog.dbName) {
    matchedDb = (dbCourses || []).find((c) => c.name && c.name.toLowerCase() === matchedCatalog.dbName.toLowerCase());
  }
  if (!matchedDb && Array.isArray(dbCourses) && dbCourses.length > 0) {
    matchedDb = dbCourses.find((c) => {
      if (!c.name) return false;
      const cLow = c.name.toLowerCase();
      return cLow === lower || lower.includes(cLow) || cLow.includes(lower);
    });
  }

  const finalName = matchedCatalog ? matchedCatalog.displayName : (matchedDb ? matchedDb.name : clean);
  let finalFee = 0;
  if (currentFee > 0) finalFee = currentFee;
  else if (extractedFee > 0) finalFee = extractedFee;
  else if (matchedDb && matchedDb.fee > 0) finalFee = matchedDb.fee;
  else if (matchedCatalog && matchedCatalog.defaultFee > 0) finalFee = matchedCatalog.defaultFee;

  return {
    courseName: finalName,
    fee: finalFee
  };
}

// Equality comparison helper to eliminate redundant no-op AI proposals
function isSameValue(field, currentVal, newVal) {
  if (currentVal === undefined || currentVal === null) currentVal = "";
  if (newVal === undefined || newVal === null) newVal = "";

  // Course field: if current had fee: 0 and new has fee > 0, KEEP IT (it fixes fee!)
  if (field === "addCourse" || field === "course") {
    const curFeeMatch = String(currentVal).match(/fee:\s*₹?([0-9,.]+)/i);
    const newFeeMatch = String(newVal).match(/fee:\s*₹?([0-9,.]+)/i);
    const curFee = curFeeMatch ? parseFloat(curFeeMatch[1].replace(/,/g, "")) : 0;
    const newFee = newFeeMatch ? parseFloat(newFeeMatch[1].replace(/,/g, "")) : 0;
    if (curFee === 0 && newFee > 0) return false;

    const cleanCur = String(currentVal).replace(/\s*\(fee:[^)]+\)/gi, "").trim().toLowerCase();
    const cleanNew = String(newVal).replace(/\s*\(fee:[^)]+\)/gi, "").trim().toLowerCase();
    return cleanCur === cleanNew && curFee === newFee;
  }

  if (field === "followUpDate") {
    const curD = String(currentVal).split("T")[0].trim();
    const newD = String(newVal).split("T")[0].trim();
    return curD === newD;
  }

  if (field === "followUpTime") {
    const normCur = normalizeTimeTo24Hour(currentVal);
    const normNew = normalizeTimeTo24Hour(newVal);
    return normCur === normNew;
  }

  if (
    field === "discountValue" ||
    field === "paidAmount" ||
    field === "priority" ||
    field === "totalFee" ||
    field === "finalFee"
  ) {
    const curNum = parseFloat(String(currentVal).replace(/[^0-9.]/g, "")) || 0;
    const newNum = parseFloat(String(newVal).replace(/[^0-9.]/g, "")) || 0;
    return curNum === newNum;
  }

  if (field === "isVoicemailPool") {
    return Boolean(currentVal) === Boolean(newVal);
  }

  if (typeof currentVal === "string" && typeof newVal === "string") {
    return currentVal.trim().toLowerCase() === newVal.trim().toLowerCase();
  }

  return currentVal === newVal;
}

// GET /api/leads - Return all leads, newest first
router.get("/", async (req, res) => {
  try {
    const leads = await Lead.find({}).sort({ createdAt: -1 }).lean();
    const now = new Date();
    for (const lead of leads) {
      if (lead.followUpTime) {
        lead.followUpTime = normalizeTimeTo24Hour(lead.followUpTime);
      }
      // Auto-heal contradictory leads: if actively snoozed on cooldown and has stale expired follow-up, wipe it
      if (lead.snoozedUntil && new Date(lead.snoozedUntil) > now && lead.followUpDate) {
        const followUpDt = computeFollowUpDateTime(lead.followUpDate, lead.followUpTime);
        if (!followUpDt || followUpDt <= now) {
          lead.followUpDate = null;
          lead.followUpTime = "";
        }
      }
    }
    return res.status(200).json({
      success: true,
      count: leads.length,
      data: leads
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch leads: " + error.message
    });
  }
});

// Helper: Collect all configured Gemini API keys (supports comma-separated, GEMINI_API_KEYS, or numbered keys)
function getGeminiApiKeys() {
  const keys = [];
  const addKeysFromString = (val) => {
    if (!val) return;
    const split = String(val).split(/[,\s\n]+/);
    for (const k of split) {
      const trimmed = k.trim();
      if (trimmed && !keys.includes(trimmed)) {
        keys.push(trimmed);
      }
    }
  };

  addKeysFromString(process.env.GEMINI_API_KEYS);
  addKeysFromString(process.env.GEMINI_API_KEY);

  for (let i = 1; i <= 10; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k && k.trim() && !keys.includes(k.trim())) {
      keys.push(k.trim());
    }
  }

  return keys;
}

// Track rotation index to distribute load evenly across keys
let currentKeyIndex = 0;
function getRotatedGeminiKeys() {
  const allKeys = getGeminiApiKeys();
  if (allKeys.length <= 1) return allKeys;
  const startIndex = currentKeyIndex % allKeys.length;
  currentKeyIndex++;
  return [
    ...allKeys.slice(startIndex),
    ...allKeys.slice(0, startIndex)
  ];
}

// Ordered list of Google Gemini vision models:
// 1. gemini-3.1-flash-lite: Engineered for ultra-low latency OCR & high speed (~2.4s)
// 2. gemini-3.5-flash-lite: High speed fallback (~3.5s)
// 3. Additional models with separate daily quotas
const GEMINI_VISION_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-image",
  "gemini-3.5-flash"
];

// Helper to sanitize and normalize extracted lead data from AI
function sanitizeExtractedLead(raw) {
  if (!raw || typeof raw !== "object") return raw;
  if (Array.isArray(raw)) raw = raw[0] || {};
  const d = { ...raw };

  // Collect phone from all possible keys that vision models might return
  const candidatePhone =
    d.phone ||
    d.mobile ||
    d.phoneNumber ||
    d.mobileNumber ||
    d.contact ||
    d.mobile_no ||
    d.primaryPhone ||
    d.primaryMobile ||
    "";

  let cleanPhone = String(candidatePhone).replace(/\D/g, "");
  if (cleanPhone.length === 12 && cleanPhone.startsWith("91")) {
    cleanPhone = cleanPhone.slice(2);
  } else if (cleanPhone.length === 11 && cleanPhone.startsWith("0")) {
    cleanPhone = cleanPhone.slice(1);
  } else if (cleanPhone.length > 10 && cleanPhone.startsWith("91")) {
    cleanPhone = cleanPhone.slice(cleanPhone.length - 10);
  }

  if (!cleanPhone || cleanPhone === "null") {
    d.phone = null;
    d.mobile = null;
  } else {
    d.phone = cleanPhone;
    d.mobile = cleanPhone;
  }

  // Clean leadId
  if (d.leadId) {
    const cleanId = String(d.leadId).replace(/[^\d]/g, "");
    if (cleanId) d.leadId = cleanId;
  }

  // Clean email
  if (d.email) {
    const em = String(d.email).trim().toLowerCase();
    if (em === "null" || !em.includes("@")) {
      d.email = null;
    } else {
      d.email = em;
    }
  }

  // Clean name
  if (d.name && String(d.name).trim().toLowerCase() === "null") {
    d.name = null;
  }

  // Course normalization & fee resolution
  if (d.courseName || d.course) {
    const rawCourse = String(d.courseName || d.course).trim();
    const explicitFee = Number(d.fee || d.courseFee) || 0;
    const resolved = resolveCourseAndFee(rawCourse, explicitFee);
    d.courseName = resolved.courseName;
    d.course = resolved.courseName;
    d.courseFee = resolved.fee;
    d.fee = resolved.fee;
    d.enrolledCourses = [
      {
        courseId: "CRS-" + Date.now(),
        courseName: resolved.courseName,
        fee: resolved.fee
      }
    ];
  }

  // Stage normalization
  const validStages = ["New", "Contacted", "Interested", "Negotiation", "Converted", "Lost"];
  if (d.stage && !validStages.includes(d.stage)) {
    if (d.stage.toLowerCase().includes("follow") || d.stage.toLowerCase().includes("call")) {
      d.stage = "Contacted";
    } else if (d.stage.toLowerCase().includes("enroll")) {
      d.stage = "Converted";
    } else if (d.stage.toLowerCase().includes("drop") || d.stage.toLowerCase().includes("lost")) {
      d.stage = "Lost";
    } else {
      d.stage = "New";
    }
  }

  // Follow-up Date normalization (handles DD/MM/YYYY, YYYY-MM-DD HH:mm, etc.)
  if (d.followUpDate) {
    const cleanD = String(d.followUpDate).trim().split(" ")[0];
    const slashParts = cleanD.split("/");
    if (slashParts.length === 3) {
      if (slashParts[0].length === 4) {
        d.followUpDate = `${slashParts[0]}-${slashParts[1].padStart(2, "0")}-${slashParts[2].padStart(2, "0")}`;
      } else if (slashParts[2].length === 4) {
        d.followUpDate = `${slashParts[2]}-${slashParts[1].padStart(2, "0")}-${slashParts[0].padStart(2, "0")}`;
      }
    }
    const san = sanitizeFollowUpDate(d.followUpDate, d.followUpTime);
    d.followUpDate = san.followUpDate;
    if (san.followUpTime) d.followUpTime = san.followUpTime;
  }

  // Follow-up Time normalization
  if (d.followUpTime) {
    d.followUpTime = normalizeTimeTo24Hour(d.followUpTime);
  }

  return d;
}

// Helper to call a specific Gemini model with low-latency configuration
async function callGeminiVision(apiKey, model, mimeType, pureBase64, promptText) {
  const geminiPayload = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inline_data: {
              mime_type: mimeType,
              data: pureBase64
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0,
      maxOutputTokens: 350
    }
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload),
      signal: AbortSignal.timeout(6000)
    }
  );

  const status = response.status;
  if (!response.ok) {
    const errText = await response.text();
    return { ok: false, status, error: errText };
  }

  const geminiData = await response.json();
  const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return { ok: false, status: 500, error: "Empty candidate text from Gemini" };
  }

  try {
    let parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length > 0) parsed = parsed[0];
    return { ok: true, data: sanitizeExtractedLead(parsed), modelUsed: `Gemini (${model})` };
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      let parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length > 0) parsed = parsed[0];
      return { ok: true, data: sanitizeExtractedLead(parsed), modelUsed: `Gemini (${model})` };
    }
    return { ok: false, status: 500, error: "Invalid JSON from Gemini: " + text };
  }
}

// Helper: Free Alternative Groq Cloud Vision (llama-3.2-11b-vision-preview)
async function callGroqVision(groqApiKey, mimeType, pureBase64, promptText) {
  const groqPayload = {
    model: "llama-3.2-11b-vision-preview",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: promptText + "\nRespond with a valid JSON object ONLY. Do NOT wrap in markdown or add explanations."
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${pureBase64}`
            }
          }
        ]
      }
    ],
    response_format: { type: "json_object" }
  };

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqApiKey}`
    },
    body: JSON.stringify(groqPayload)
  });

  if (!response.ok) {
    const errText = await response.text();
    return { ok: false, status: response.status, error: errText };
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    return { ok: false, status: 500, error: "Empty content from Groq Vision" };
  }

  try {
    const parsed = JSON.parse(text);
    return { ok: true, data: sanitizeExtractedLead(parsed), modelUsed: "Groq Vision (Llama-3.2)" };
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return { ok: true, data: sanitizeExtractedLead(JSON.parse(match[0])), modelUsed: "Groq Vision (Llama-3.2)" };
    }
    return { ok: false, status: 500, error: "Invalid JSON from Groq: " + text };
  }
}

// POST /api/leads/extract-from-image - Multi-tier AI vision extractor with automatic fallback
router.post("/extract-from-image", async (req, res) => {
  try {
    // 0. Ultra-fast path: If text or CRM key-value dump is provided, parse in <1ms without calling AI APIs
    const rawText = req.body.text || req.body.crmDump;
    if (rawText && typeof rawText === "string" && (rawText.includes(":") || rawText.includes("=") || rawText.includes("{"))) {
      try {
        let extracted = null;
        try {
          extracted = JSON.parse(rawText);
        } catch (e) {
          extracted = {};
          const lines = rawText.split(/\r?\n/);
          for (const line of lines) {
            const m = line.match(/^\s*"?([a-zA-Z0-9_]+)"?\s*[:=]\s*"?([^",\r\n]+)"?/);
            if (m) {
              const k = m[1].trim();
              let v = m[2].trim();
              if (v === "null") v = null;
              extracted[k] = v;
            }
          }
        }
        if (extracted && (extracted.mobile || extracted.phone || extracted.id || extracted.name)) {
          let colleague = null;
          let leadScope = "my_lead";
          const camp =
            extracted.ozonetel_campaign_name ||
            extracted.campaign ||
            (Array.isArray(extracted.member) && extracted.member[0]?.ozonetel_campaign_name);
          if (camp && typeof camp === "string") {
            const parts = camp.split("_");
            if (parts[0] && !["general", "inbound", "campaign", "ozonetel"].includes(parts[0].toLowerCase())) {
              colleague = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
              leadScope = "colleague_lead";
            }
          }

          const sanitized = sanitizeExtractedLead({
            leadId: extracted.id || extracted.lead_id || extracted.repeat_id,
            name: extracted.name,
            phone: extracted.mobile || extracted.phone,
            email: extracted.email,
            courseName: extracted.course || extracted.courseName,
            quality: extracted.lead_quality || extracted.quality,
            stage: extracted.painarea && extracted.painarea.includes("Followup") ? "Contacted" : extracted.stage,
            reminderNote: [extracted.painarea, extracted.description].filter(Boolean).filter((n) => n !== "null").join(" - "),
            followUpDate: extracted.followuptime ? extracted.followuptime.split(" ")[0] : null,
            followUpTime: extracted.followuptime && extracted.followuptime.includes(" ") ? extracted.followuptime.split(" ")[1] : null,
            language: extracted.language,
            source: extracted.source || "Website",
            colleagueName: colleague,
            leadScope
          });
          return res.status(200).json({
            success: true,
            data: sanitized,
            modelUsed: "Instant CRM Text Parser (0.01s)"
          });
        }
      } catch (textErr) {
        console.warn("[CRM Text Parser] Falling back to AI:", textErr.message);
      }
    }

    const image = req.body.image || req.body.imageBase64;
    if (!image) {
      return res.status(400).json({
        success: false,
        message: "No image or lead data provided."
      });
    }

    const geminiKeys = getRotatedGeminiKeys();
    const groqKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : null;

    if (geminiKeys.length === 0 && !groqKey) {
      return res.status(500).json({
        success: false,
        message: "No AI vision API key configured. Please set GEMINI_API_KEY in your environment variables."
      });
    }

    // Extract mimeType and pure base64 data
    let mimeType = "image/png";
    let pureBase64 = image;

    if (image.startsWith("data:")) {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        pureBase64 = match[2];
      }
    }

    const promptText = `You are an expert CRM data extractor. Extract all lead details from this CRM screenshot.
Return a valid JSON object ONLY, with no extra commentary or markdown formatting.
Schema fields:
- leadId: string (e.g. from "Lead Detail (9568469)" -> "9568469", or null if not found)
- name: string (e.g. "siddheshwar", or null)
- email: string (clean valid email, or null if missing or "null")
- phone: string (CRITICAL: Look for the primary mobile or phone number, typically under the column header "MOBILE", "MOBILE NO", "Phone", or next to "Call via Ozonetel" / "Call via TATA". Exclude country code like +91, spaces, dashes to return ONLY the clean 10-digit number. Note: Do NOT be confused by "ALT MOBILE: null" - always extract the primary MOBILE number.)
- mobile: string (Duplicate the same clean 10-digit mobile number here)
- courseName: string (exact course name, e.g. "Lean Six Sigma Black Belt Course", or null)
- quality: string (map to one of: "Hot Lead", "Warm Lead", "Cold Lead", "Call Again", "Voicemail", "Converted/Customer", "Not Interested", "Wrong number", "Wrong Mail", or null)
- stage: string (map to: "New", "Contacted", "Interested", "Negotiation", "Converted", "Lost", or "New")
- followUpDate: string (YYYY-MM-DD format if present, convert DD-MM-YYYY or similar to YYYY-MM-DD, or null)
- followUpTime: string (HH:MM in 24-hour format if present, or null)
- reminderNote: string (notes like Pain Area, Description, or Comments visible, or null)
- language: string (e.g. "English", or null)
- source: string (e.g. "Website" or other if visible, or null)`;

    const errorsEncountered = [];

    // TIER 1: Cascade through all Gemini Keys and Models
    for (let kIdx = 0; kIdx < geminiKeys.length; kIdx++) {
      const currentKey = geminiKeys[kIdx];

      for (let mIdx = 0; mIdx < GEMINI_VISION_MODELS.length; mIdx++) {
        const currentModel = GEMINI_VISION_MODELS[mIdx];

        try {
          const result = await callGeminiVision(currentKey, currentModel, mimeType, pureBase64, promptText);

          if (result.ok) {
            console.log(`[AI Vision] Success using key #${kIdx + 1} with model: ${currentModel}`);
            return res.status(200).json({
              success: true,
              data: result.data,
              modelUsed: result.modelUsed
            });
          }

          // If rate limit (429), high demand (503), or model unavailable (404), continue cascade
          console.warn(`[AI Vision] Key #${kIdx + 1} (${currentModel}) returned ${result.status}. Cascading to next model...`);
          errorsEncountered.push(`Key #${kIdx + 1} [${currentModel}]: HTTP ${result.status}`);
        } catch (callErr) {
          console.warn(`[AI Vision] Error calling ${currentModel}:`, callErr.message);
          errorsEncountered.push(`Key #${kIdx + 1} [${currentModel}]: ${callErr.message}`);
        }
      }
    }

    // TIER 2: Fallback to Groq Vision if configured and Gemini exhausted
    if (groqKey) {
      try {
        console.log("[AI Vision] Attempting fallback to Groq Cloud Vision...");
        const groqResult = await callGroqVision(groqKey, mimeType, pureBase64, promptText);
        if (groqResult.ok) {
          console.log("[AI Vision] Success using Groq Cloud Vision!");
          return res.status(200).json({
            success: true,
            data: groqResult.data,
            modelUsed: groqResult.modelUsed
          });
        }
        errorsEncountered.push(`Groq Vision: HTTP ${groqResult.status}`);
      } catch (groqErr) {
        console.warn("[AI Vision] Groq Vision error:", groqErr.message);
        errorsEncountered.push(`Groq Vision: ${groqErr.message}`);
      }
    }

    // If all keys and models failed, return helpful error
    console.error("[AI Vision] All models and keys exhausted:", errorsEncountered);
    return res.status(429).json({
      success: false,
      message: `All available free AI quotas were temporarily exhausted across ${geminiKeys.length} key(s) and ${GEMINI_VISION_MODELS.length} model(s). Please wait 30 seconds to retry, or add an additional free Gemini API key to GEMINI_API_KEY in your environment variables.`,
      details: errorsEncountered
    });
  } catch (error) {
    console.error("Error in extract-from-image:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to extract lead details from image: " + error.message
    });
  }
});

// GET /api/leads/lookup-id/:query - Fast instant lookup by Lead ID, Phone, or Email
router.get("/lookup-id/:query", async (req, res) => {
  try {
    const raw = String(req.params.query || "").trim();
    if (!raw) return res.status(400).json({ success: false, message: "Query is required" });

    // Extract numeric ID if URL
    let cleanId = raw;
    const urlMatch = raw.match(/[?&]id=(\d+)/i);
    if (urlMatch) cleanId = urlMatch[1];
    else {
      const digits = raw.replace(/[^\d]/g, "");
      if (digits.length >= 5) cleanId = digits;
    }

    const queries = [];
    if (cleanId) {
      queries.push({ leadId: cleanId });
      queries.push({ leadId: `LD-${cleanId}` });
    }
    const cleanDigits = raw.replace(/\D/g, "");
    if (cleanDigits.length >= 6) {
      queries.push({ phone: { $regex: cleanDigits.slice(-10) + "$" } });
      queries.push({ alternatePhone: { $regex: cleanDigits.slice(-10) + "$" } });
    }
    if (raw.includes("@")) {
      queries.push({ email: { $regex: `^${raw}$`, $options: "i" } });
    }

    if (queries.length === 0) {
      return res.status(200).json({ success: true, found: false });
    }

    const lead = await Lead.findOne({ $or: queries }).lean();
    if (!lead) {
      return res.status(200).json({ success: true, found: false, cleanId });
    }

    return res.status(200).json({
      success: true,
      found: true,
      cleanId,
      data: lead
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/leads/fetch-portal-lead - Fetch lead details and call report URLs from Henry Harvin CRM
router.post("/fetch-portal-lead", async (req, res) => {
  try {
    const { leadId } = req.body;
    if (!leadId) {
      return res.status(400).json({ success: false, message: "Lead ID is required" });
    }

    // Clean leadId: extract numbers if full URL was pasted
    let cleanId = String(leadId).trim();
    const idParamMatch = cleanId.match(/[?&]id=(\d+)/i);
    if (idParamMatch) {
      cleanId = idParamMatch[1];
    } else {
      cleanId = cleanId.replace(/[^\d]/g, "");
    }

    if (!cleanId) {
      return res.status(400).json({ success: false, message: "Valid numeric Lead ID is required" });
    }

    const leadCheckUrl = `https://crm.henryharvin.com/portal-new/get_lead_contact_details?id=${cleanId}`;
    const callCheckUrl = `https://crm.henryharvin.com/portal-new/call/report/view?id=${cleanId}`;

    // 1. First check if this lead already exists in local DB
    const existingLead = await Lead.findOne({
      $or: [{ leadId: cleanId }, { leadId: `LD-${cleanId}` }]
    }).lean();

    // If existing in local DB, return it immediately so user can view/open it!
    if (existingLead) {
      return res.status(200).json({
        success: true,
        foundInDatabase: true,
        leadId: cleanId,
        leadCheckUrl,
        callCheckUrl,
        existingLead: existingLead,
        data: {
          leadId: existingLead.leadId,
          name: existingLead.name,
          phone: existingLead.phone,
          email: existingLead.email,
          courseName: existingLead.enrolledCourses?.[0]?.courseName || existingLead.courseName || "General Course",
          courseFee: existingLead.enrolledCourses?.[0]?.fee || 0,
          quality: existingLead.quality,
          stage: existingLead.stage,
          followUpDate: existingLead.followUpDate ? existingLead.followUpDate.toISOString().split("T")[0] : null,
          followUpTime: existingLead.followUpTime || "",
          reminderNote: existingLead.reminderNote || "",
          leadScope: existingLead.leadScope || "my_lead",
          colleagueName: existingLead.colleagueName || ""
        }
      });
    }

    // 2. Try fetching directly from portal
    let portalData = null;
    let blockedByCloudflare = false;

    try {
      const portalResponse = await fetch(leadCheckUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9"
        },
        signal: AbortSignal.timeout(4000)
      });

      const responseText = await portalResponse.text();
      if (
        responseText.includes("Just a moment...") ||
        responseText.includes("cf_chl_opt") ||
        responseText.includes("challenges.cloudflare.com")
      ) {
        blockedByCloudflare = true;
      } else {
        try {
          portalData = JSON.parse(responseText);
        } catch (jsonErr) {
          blockedByCloudflare = true;
        }
      }
    } catch (fetchErr) {
      blockedByCloudflare = true;
    }

    if (portalData && typeof portalData === "object") {
      let colleague = null;
      let leadScope = "my_lead";
      const camp =
        portalData.ozonetel_campaign_name ||
        portalData.campaign ||
        (Array.isArray(portalData.member) && portalData.member[0]?.ozonetel_campaign_name) ||
        (portalData.member && portalData.member.ozonetel_campaign_name);
      if (camp && typeof camp === "string") {
        const parts = camp.split("_");
        const campaignUser = (parts[0] || "").toLowerCase().trim();
        const genericKeywords = ["general", "inbound", "campaign", "ozonetel", "crm"];
        if (campaignUser === "subham") {
          leadScope = "my_lead";
          colleague = null;
        } else if (campaignUser && !genericKeywords.includes(campaignUser)) {
          colleague = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
          leadScope = "colleague_lead";
        }
      }

      let rawFDate = portalData.followuptime ? portalData.followuptime.split(" ")[0] : null;
      let rawFTime = portalData.followuptime && portalData.followuptime.includes(" ") ? portalData.followuptime.split(" ")[1] : null;

      // Also check if text description has follow-up time mentioned (e.g. "Calling call at 4", "call after 1 pm")
      const textFollowUp = extractFollowUpFromText([portalData.description, portalData.desc].filter(Boolean).join(" "));
      if (textFollowUp.matched) {
        if (textFollowUp.followUpDate) rawFDate = textFollowUp.followUpDate;
        if (textFollowUp.followUpTime) rawFTime = textFollowUp.followUpTime;
      }

      if (rawFDate) {
        const san = sanitizeFollowUpDate(rawFDate, rawFTime);
        rawFDate = san.followUpDate;
        rawFTime = san.followUpTime;
      }

      const sanitized = sanitizeExtractedLead({
        leadId: cleanId,
        name: portalData.name,
        phone: portalData.mobile || portalData.phone,
        email: portalData.email,
        courseName: portalData.course || portalData.courseName,
        quality: normalizeQuality(portalData.lead_quality || portalData.quality),
        stage: normalizeStage(portalData.painarea && portalData.painarea.includes("Followup") ? "Contacted" : portalData.stage),
        reminderNote: [portalData.painarea, portalData.description].filter(Boolean).filter((n) => n !== "null").join(" - "),
        followUpDate: rawFDate,
        followUpTime: rawFTime,
        language: portalData.language,
        source: portalData.source || "Website",
        colleagueName: colleague,
        leadScope
      });

      return res.status(200).json({
        success: true,
        leadId: cleanId,
        leadCheckUrl,
        callCheckUrl,
        data: sanitized,
        raw: portalData,
        existingLead: existingLead ? { _id: existingLead._id, name: existingLead.name, leadId: existingLead.leadId } : null
      });
    }

    // Cloudflare or authentication session required
    return res.status(200).json({
      success: true,
      leadId: cleanId,
      leadCheckUrl,
      callCheckUrl,
      blockedByCloudflare: true,
      message: "Portal is protected by Cloudflare session. Open in browser and paste JSON.",
      existingLead: existingLead ? { _id: existingLead._id, name: existingLead.name, leadId: existingLead.leadId } : null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Portal check failed: " + error.message
    });
  }
});

// Modern Gemini text models for conversational CRM instruction parsing
const GEMINI_TEXT_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash",
  "gemini-flash-latest"
];

// Helper to call Gemini for text generation with low latency & strict JSON
async function callGeminiText(apiKey, model, systemPrompt, userText) {
  const geminiPayload = {
    contents: [
      {
        parts: [
          { text: systemPrompt + "\n\nUser Instruction:\n" + userText }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
      maxOutputTokens: 1500
    }
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload),
      signal: AbortSignal.timeout(7000)
    }
  );

  const status = response.status;
  if (!response.ok) {
    const errText = await response.text();
    return { ok: false, status, error: errText };
  }

  const geminiData = await response.json();
  const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return { ok: false, status: 500, error: "Empty candidate text from Gemini" };
  }

  try {
    const parsed = JSON.parse(text);
    return { ok: true, data: parsed, modelUsed: `Gemini (${model})` };
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return { ok: true, data: JSON.parse(match[0]), modelUsed: `Gemini (${model})` };
    }
    return { ok: false, status: 500, error: "Invalid JSON from Gemini: " + text };
  }
}

// POST /api/leads/ai-portal-sync - High-Level AI processing, duplicate prevention, and sync from Henry Harvin CRM
router.post("/ai-portal-sync", async (req, res) => {
  try {
    let { portalData, rawText, action = "analyze", forceUpdate = false } = req.body;

    if (!portalData && rawText) {
      try {
        portalData = JSON.parse(rawText);
      } catch (e) {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            portalData = JSON.parse(jsonMatch[0]);
          } catch (e2) {}
        }
      }
    }

    if (!portalData || typeof portalData !== "object") {
      return res.status(400).json({
        success: false,
        message: "Valid portal data or JSON is required."
      });
    }

    // Extract core identifiers
    const leadId = String(portalData.leadId || portalData.id || portalData.lead_id || portalData.repeat_id || "").trim();
    let phone = String(portalData.mobile || portalData.phone || "").replace(/\D/g, "");
    if (phone.length > 10 && phone.startsWith("91")) phone = phone.slice(-10);
    const email = (portalData.email || "").trim().toLowerCase();

    // DUPLICATE DETECTION: Check across all records by leadId, phone, and email
    const dupQueries = [];
    if (leadId) {
      dupQueries.push({ leadId: leadId });
      dupQueries.push({ leadId: `LD-${leadId}` });
    }
    if (phone && phone.length >= 6) {
      dupQueries.push({ phone: { $regex: phone.slice(-10) + "$" } });
      dupQueries.push({ alternatePhone: { $regex: phone.slice(-10) + "$" } });
    }
    if (email && email.includes("@") && email !== "null") {
      dupQueries.push({ email: { $regex: `^${email}$`, $options: "i" } });
    }

    let existingLead = null;
    if (dupQueries.length > 0) {
      existingLead = await Lead.findOne({ $or: dupQueries }).lean();
    }

    // Load master courses
    let dbCourses = [];
    try {
      dbCourses = await Course.find({ active: true }).lean();
    } catch (e) {}

    // Course Resolution with canonical catalog
    const rawCourse = portalData.course || portalData.courseName || portalData.program || "";
    const resolvedCourse = resolveCourseAndFee(rawCourse, 0, dbCourses);

    // Colleague vs Self Attribution (Subham is the user himself!)
    let colleague = null;
    let leadScope = "my_lead";
    const camp =
      portalData.ozonetel_campaign_name ||
      portalData.campaign ||
      (Array.isArray(portalData.member) && portalData.member[0]?.ozonetel_campaign_name) ||
      (portalData.member && portalData.member.ozonetel_campaign_name);
    if (camp && typeof camp === "string") {
      const parts = camp.split("_");
      const campaignUser = (parts[0] || "").toLowerCase().trim();
      const genericKeywords = ["general", "inbound", "campaign", "ozonetel", "crm"];
      if (campaignUser === "subham") {
        leadScope = "my_lead";
        colleague = null;
      } else if (campaignUser && !genericKeywords.includes(campaignUser)) {
        colleague = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        leadScope = "colleague_lead";
      }
    }

    // Intelligent Follow-up & Time Parsing from description, notes, and call history
    const descText = [portalData.description, portalData.painarea, portalData.desc, rawText].filter(Boolean).join(" ");
    const nlpFollowUp = extractFollowUpFromText(descText);

    let followUpDate = nlpFollowUp.followUpDate || null;
    let followUpTime = nlpFollowUp.followUpTime ? formatTime12(nlpFollowUp.followUpTime) : "11:00 AM";

    if (portalData.followuptime) {
      const rawFt = String(portalData.followuptime).trim();
      const parts = rawFt.includes("T") ? rawFt.split("T") : rawFt.split(" ");
      if (parts[0] && !nlpFollowUp.followUpDate) followUpDate = parts[0];
      if (parts[1] && !nlpFollowUp.followUpTime) {
        followUpTime = formatTime12(parts[1].slice(0, 5));
      }
    }

    if (followUpDate) {
      const san = sanitizeFollowUpDate(followUpDate, followUpTime);
      followUpDate = san.followUpDate;
      followUpTime = formatTime12(san.followUpTime);
    }

    // Quality mapping
    let quality = "Warm Lead";
    const rawQ = String(portalData.lead_quality || portalData.quality || "").toLowerCase();
    if (rawQ.includes("hot") || rawQ.includes("interested")) quality = "Hot Lead";
    else if (rawQ.includes("cold") || rawQ.includes("not interested")) quality = "Cold Lead";
    else if (rawQ.includes("again") || rawQ.includes("followup") || rawQ.includes("warm")) quality = "Warm Lead";

    // Stage mapping
    let stage = "Contacted";
    const notesStr = [portalData.painarea, portalData.description].filter(Boolean).filter((n) => n !== "null").join(" - ");
    if (notesStr.toLowerCase().includes("followup") || notesStr.toLowerCase().includes("call")) {
      stage = "Contacted";
    }

    const aiResolved = {
      leadId: leadId,
      name: portalData.name && portalData.name !== "null" ? portalData.name.trim() : `Lead #${leadId}`,
      phone: phone,
      email: email && email !== "null" ? email : "",
      courseName: resolvedCourse.courseName,
      courseFee: resolvedCourse.fee,
      quality: normalizeQuality(quality),
      stage: normalizeStage(stage),
      followUpDate: followUpDate,
      followUpTime: followUpTime,
      nextAction: nlpFollowUp.followUpTime
        ? `Call back at ${formatTime12(nlpFollowUp.followUpTime)}${notesStr ? " (" + notesStr.slice(0, 40) + ")" : ""}`
        : (notesStr || "Follow-up"),
      reminderNote: notesStr || portalData.description || "Follow-up scheduled",
      leadScope: leadScope,
      colleagueName: colleague,
      initialCommentText: `⚡ Synced from Henry Harvin Portal (ID: ${leadId}). Notes: ${notesStr || "None"}${nlpFollowUp.followUpTime ? ` (Scheduled for ${formatTime12(nlpFollowUp.followUpTime)})` : ""}`
    };

    // If Gemini API Key is available, use Gemini AI to refine even further
    const geminiKeys = getGeminiApiKeys();
    if (geminiKeys.length > 0) {
      try {
        const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
        const currentYear = new Date().getFullYear();
        const sysPrompt = `You are a high-level AI CRM intelligence engine.
Today's date is ${todayIso} (Year: ${currentYear}).
Analyze this portal data from Henry Harvin CRM and refine the lead profile into strict JSON.

CRITICAL COURSE RESOLUTION RULES:
- The student's enquired course from portalData is: "${rawCourse}".
- Master Catalog Resolved Course: "${resolvedCourse.courseName}" (Catalog Fee: ₹${resolvedCourse.fee}).
- You MUST set "courseName" to "${resolvedCourse.courseName}" and "courseFee" to ${resolvedCourse.fee} if recognized.
- CRITICAL WARNING: 'ozonetel_campaign_name' (e.g. "Subham_SSGB") is ONLY the counselor's dialer campaign / phone queue. It is NEVER the student's enquired course! NEVER change or assume the student's course is Six Sigma Green Belt (SSGB) just because the counselor's telephony queue contains "SSGB"!
- Course Abbreviations Reference:
  * "PGP-GL" or "GL" -> German Language Course (PGP-GL) (Fee: ₹15500)
  * "PGP-FL" or "FL" -> French Language Course (PGP-FL) (Fee: ₹15500)
  * "PGP-SL" or "SL" -> Spanish Language Course (PGP-SL) (Fee: ₹15500)
  * "PGP-JL" or "JL" -> Japanese Language Course (PGP-JL) (Fee: ₹9500)
  * "PGP-KL" or "KL" -> Korean Language Course (PGP-KL) (Fee: ₹15500)
  * "German" -> German Language Course (Fee: ₹15500)
  * "SSGB" -> Six Sigma Green Belt (SSGB) (Fee: ₹17500)
  * "SSBB" -> Six Sigma Black Belt (SSBB) (Fee: ₹29500)
  * "SSMBB" -> Master Black Belt (SSMBB) (Fee: ₹59500)
  * "PMP" -> PMP (Project Management Professional) (Fee: ₹14900)
  * "Excel" -> Advanced Excel (Fee: ₹7500)
  * "SAP FICO" -> SAP FICO (Fee: ₹34500)
  * "SAP PP" -> SAP PP (Fee: ₹34500)
  * "Medical Coding" -> Medical Coding Course (Fee: ₹24500)
  * Course fee must NEVER be 0.
- If description says "call after 1 pm" or similar, set followUpTime to "01:00 PM".
- Format followUpTime as 12-hour string like "01:00 PM" or "11:00 AM".
- Set quality to one of: "Hot Lead", "Warm Lead", "Cold Lead", "Call Again".
- Set stage to one of: "New", "Contacted", "Interested", "Negotiation", "Converted", "Lost". If callback or follow-up is scheduled, set stage to "Contacted" (do NOT output "Follow-up" as stage).
- IMPORTANT: followUpDate must be in YYYY-MM-DD format. The year must be ${currentYear} or later. NEVER output a date in a past year like 2025. If historical logs mention past dates/years, roll the follow-up appointment forward to today (${todayIso}).
- Output JSON format:
{
  "name": string,
  "courseName": string,
  "courseFee": number,
  "quality": string,
  "stage": string,
  "followUpDate": string (YYYY-MM-DD),
  "followUpTime": string,
  "nextAction": string,
  "reminderNote": string
}`;
        const aiRes = await callGeminiText(geminiKeys[0], "gemini-3.1-flash-lite", sysPrompt, JSON.stringify(portalData));
        if (aiRes && aiRes.ok && aiRes.data) {
          const d = aiRes.data;
          // Safeguard course: Prefer canonical master resolution when available, do not let hallucinated campaign override
          if (resolvedCourse.courseName && resolvedCourse.courseName !== "General Course") {
            aiResolved.courseName = resolvedCourse.courseName;
            aiResolved.courseFee = resolvedCourse.fee;
          } else if (d.courseName) {
            const reRes = resolveCourseAndFee(d.courseName, d.courseFee, dbCourses);
            aiResolved.courseName = reRes.courseName;
            aiResolved.courseFee = reRes.fee;
          }
          if (d.quality) aiResolved.quality = normalizeQuality(d.quality);
          if (d.stage) aiResolved.stage = normalizeStage(d.stage);
          if (d.followUpDate) aiResolved.followUpDate = d.followUpDate;
          if (d.followUpTime) aiResolved.followUpTime = formatTime12(d.followUpTime);
          if (aiResolved.followUpDate) {
            const san = sanitizeFollowUpDate(aiResolved.followUpDate, aiResolved.followUpTime);
            aiResolved.followUpDate = san.followUpDate;
            aiResolved.followUpTime = formatTime12(san.followUpTime);
          }
          if (d.nextAction) aiResolved.nextAction = d.nextAction;
          if (d.reminderNote) aiResolved.reminderNote = d.reminderNote;
        }
      } catch (gemErr) {
        console.warn("Gemini refine non-fatal:", gemErr.message);
      }
    }

    // Action 1: "analyze" - Return data and duplicate warning
    if (action === "analyze") {
      return res.status(200).json({
        success: true,
        isDuplicate: Boolean(existingLead),
        existingLead: existingLead ? {
          _id: existingLead._id,
          leadId: existingLead.leadId,
          name: existingLead.name,
          phone: existingLead.phone,
          email: existingLead.email,
          stage: existingLead.stage,
          quality: existingLead.quality,
          courseName: existingLead.enrolledCourses?.[0]?.courseName || existingLead.courseName || "General",
          followUpDate: existingLead.followUpDate,
          followUpTime: existingLead.followUpTime
        } : null,
        data: aiResolved
      });
    }

    // Merge any user-edited fields from frontend before saving/updating
    const finalLeadData = {
      ...aiResolved,
      ...(portalData.leadId ? { leadId: String(portalData.leadId).trim() } : {}),
      ...(portalData.id ? { leadId: String(portalData.id).trim() } : {}),
      ...(portalData.name ? { name: portalData.name.trim() } : {}),
      ...(portalData.phone ? { phone: portalData.phone.trim() } : {}),
      ...(portalData.email !== undefined ? { email: portalData.email.trim() } : {}),
      ...(portalData.courseName ? { courseName: portalData.courseName } : {}),
      ...(portalData.courseFee !== undefined ? { courseFee: Number(portalData.courseFee) || 0 } : {}),
      ...(portalData.quality ? { quality: portalData.quality } : {}),
      ...(portalData.stage ? { stage: portalData.stage } : {}),
      ...(portalData.followUpDate !== undefined ? { followUpDate: portalData.followUpDate } : {}),
      ...(portalData.followUpTime !== undefined ? { followUpTime: portalData.followUpTime } : {}),
      ...(portalData.reminderNote !== undefined ? { reminderNote: portalData.reminderNote } : {}),
      ...(portalData.leadScope ? { leadScope: portalData.leadScope } : {}),
      ...(portalData.colleagueName !== undefined ? { colleagueName: portalData.colleagueName } : {})
    };

    finalLeadData.stage = normalizeStage(finalLeadData.stage);
    finalLeadData.quality = normalizeQuality(finalLeadData.quality);

    if (finalLeadData.courseName) {
      const cr = resolveCourseAndFee(finalLeadData.courseName, finalLeadData.courseFee, dbCourses);
      finalLeadData.courseName = cr.courseName;
      if (!finalLeadData.courseFee || finalLeadData.courseFee === 0) {
        finalLeadData.courseFee = cr.fee;
      }
    }

    if (finalLeadData.followUpDate) {
      const san = sanitizeFollowUpDate(finalLeadData.followUpDate, finalLeadData.followUpTime);
      finalLeadData.followUpDate = san.followUpDate;
      if (san.followUpTime) finalLeadData.followUpTime = formatTime12(san.followUpTime);
    }

    // Action 2: "update_existing" or "save_or_update" with existingLead
    if (action === "update_existing" || (action === "save_or_update" && existingLead)) {
      if (!existingLead) {
        return res.status(404).json({ success: false, message: "Existing lead not found to update." });
      }

      const leadDoc = await Lead.findById(existingLead._id);
      if (!leadDoc) {
        return res.status(404).json({ success: false, message: "Lead record not found in database." });
      }

      if (finalLeadData.leadId) leadDoc.leadId = finalLeadData.leadId;
      if (finalLeadData.name) leadDoc.name = finalLeadData.name;
      if (finalLeadData.phone) leadDoc.phone = finalLeadData.phone;
      if (finalLeadData.email !== undefined) leadDoc.email = finalLeadData.email;
      if (finalLeadData.quality) leadDoc.quality = finalLeadData.quality;
      if (finalLeadData.stage) leadDoc.stage = finalLeadData.stage;
      if (finalLeadData.leadScope) leadDoc.leadScope = finalLeadData.leadScope;
      if (finalLeadData.colleagueName !== undefined) leadDoc.colleagueName = finalLeadData.colleagueName;

      if (finalLeadData.followUpDate) {
        leadDoc.followUpDate = new Date(finalLeadData.followUpDate);
        leadDoc.followUpTime = normalizeTimeTo24Hour(finalLeadData.followUpTime);
        const fDt = computeFollowUpDateTime(leadDoc.followUpDate, leadDoc.followUpTime);
        if (fDt && fDt > new Date()) {
          leadDoc.snoozedUntil = fDt;
          leadDoc.snoozeReason = formatFollowUpReason(fDt, leadDoc.followUpTime);
        }
      }
      if (finalLeadData.reminderNote) {
        leadDoc.reminderNote = finalLeadData.reminderNote;
      }
      if (finalLeadData.nextAction) {
        leadDoc.nextAction = finalLeadData.nextAction;
      }

      // If course is present, update enrolledCourses
      if (finalLeadData.courseName) {
        leadDoc.enrolledCourses = [
          {
            courseId: leadDoc.enrolledCourses?.[0]?.courseId || ("CRS-" + Date.now()),
            courseName: finalLeadData.courseName,
            fee: finalLeadData.courseFee || 0
          }
        ];
      }

      leadDoc.comments.push({
        commentId: "COM-" + Date.now() + "-" + Math.floor(1000 + Math.random() * 9000),
        text: `⚡ Portal Synced: Updated follow-up to ${finalLeadData.followUpDate || "None"} ${finalLeadData.followUpTime || ""}. Notes: ${finalLeadData.reminderNote || "None"}`,
        outcome: "Portal Synced",
        addedAt: new Date(),
        updatedAt: new Date()
      });

      const updated = await leadDoc.save();
      return res.status(200).json({
        success: true,
        updated: true,
        isDuplicate: true,
        message: `✓ Existing Lead "${updated.name}" (${updated.leadId}) successfully updated without duplicates!`,
        data: updated
      });
    }

    // Action 3: "save_new" - BLOCK duplicate creation
    if (existingLead && !forceUpdate) {
      return res.status(409).json({
        success: false,
        isDuplicate: true,
        message: `⚠️ Lead already exists as "${existingLead.name}" (ID: ${existingLead.leadId}, Phone: ${existingLead.phone}). Please choose "Update Existing Lead" instead of creating a duplicate.`,
        existingLead
      });
    }

    let finalLeadId = String(finalLeadData.leadId || leadId || "").trim();
    if (!finalLeadId) {
      finalLeadId = String(Date.now()).slice(-7);
    }
    let initialSnoozedUntil = null;
    let initialSnoozeReason = "";
    if (finalLeadData.followUpDate) {
      const fDt = computeFollowUpDateTime(finalLeadData.followUpDate, finalLeadData.followUpTime);
      if (fDt && fDt > new Date()) {
        initialSnoozedUntil = fDt;
        initialSnoozeReason = formatFollowUpReason(fDt, finalLeadData.followUpTime);
      }
    }

    const newLead = new Lead({
      leadId: finalLeadId,
      name: finalLeadData.name,
      phone: finalLeadData.phone,
      email: finalLeadData.email,
      quality: finalLeadData.quality,
      stage: finalLeadData.stage,
      source: "Henry Harvin Portal",
      priority: 3,
      followUpDate: finalLeadData.followUpDate ? new Date(finalLeadData.followUpDate) : null,
      followUpTime: finalLeadData.followUpTime ? normalizeTimeTo24Hour(finalLeadData.followUpTime) : "",
      snoozedUntil: initialSnoozedUntil,
      snoozeReason: initialSnoozeReason,
      nextAction: finalLeadData.nextAction,
      reminderNote: finalLeadData.reminderNote,
      leadScope: finalLeadData.leadScope,
      colleagueName: finalLeadData.colleagueName,
      enrolledCourses: [
        {
          courseId: "CRS-" + Date.now(),
          courseName: finalLeadData.courseName,
          fee: finalLeadData.courseFee
        }
      ],
      comments: [
        {
          commentId: "COM-" + Date.now() + "-" + Math.floor(1000 + Math.random() * 9000),
          text: finalLeadData.initialCommentText,
          outcome: "Portal Imported",
          addedAt: new Date(),
          updatedAt: new Date()
        }
      ]
    });

    const saved = await newLead.save();
    return res.status(201).json({
      success: true,
      created: true,
      message: `🎉 New Lead "${saved.name}" (${saved.leadId}) saved successfully with official course fee ₹${finalLeadData.courseFee}!`,
      data: saved
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "AI Portal Sync error: " + err.message
    });
  }
});

// POST /api/leads/:id/ai-parse-update - Parse counselor natural language note into structured checklist diff
router.post("/:id/ai-parse-update", async (req, res) => {
  try {
    const { instruction } = req.body;
    if (!instruction || !instruction.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please enter what you want to update."
      });
    }

    const lead = await findLeadByIdOrCustomId(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    // Load active courses to guide AI matching
    let availableCourses = [];
    let dbCourses = [];
    try {
      dbCourses = await Course.find({ active: true }).select("name fee").lean();
      availableCourses = dbCourses.map((c) => `${c.name} (Fee: ₹${c.fee})`);
    } catch (e) {
      // Graceful fallback
    }

    // Also include canonical catalog courses to ensure full awareness of aliases
    COURSE_CATALOG.forEach((cat) => {
      const entry = `${cat.displayName} (Fee: ₹${cat.defaultFee})`;
      if (!availableCourses.some((ac) => ac.toLowerCase().includes(cat.displayName.toLowerCase()))) {
        availableCourses.push(entry);
      }
    });

    const now = new Date();
    const istOptions = { timeZone: "Asia/Kolkata" };
    const istDateStr = now.toLocaleDateString("en-IN", {
      ...istOptions,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    const istIsoDate = new Intl.DateTimeFormat("en-CA", istOptions).format(now); // YYYY-MM-DD

    const currentLeadSnapshot = {
      leadId: lead.leadId || "",
      name: lead.name || "",
      phone: lead.phone || "",
      alternatePhone: lead.alternatePhone || "",
      email: lead.email || "",
      stage: lead.stage || "New",
      quality: lead.quality || "Warm Lead",
      priority: lead.priority || 3,
      leadScope: lead.leadScope || "my_lead",
      colleagueName: lead.colleagueName || "",
      isVoicemailPool: Boolean(lead.isVoicemailPool),
      followUpDate: lead.followUpDate ? lead.followUpDate.toISOString().split("T")[0] : null,
      followUpTime: lead.followUpTime || "",
      nextAction: lead.nextAction || "",
      reminderNote: lead.reminderNote || "",
      lostReason: lead.lostReason || "",
      enrolledCourses: (lead.enrolledCourses || []).map((c) => {
        const res = resolveCourseAndFee(c.courseName, c.fee, dbCourses);
        return `${res.courseName} (Fee: ₹${res.fee || 0})`;
      }),
      totalFee: lead.totalFee || 0,
      discountType: lead.discountType || "none",
      discountValue: lead.discountValue || 0,
      finalFee: lead.finalFee || 0,
      paidAmount: lead.paidAmount || 0,
      balanceAmount: lead.balanceAmount || 0,
      paymentStatus: lead.paymentStatus || "Unpaid",
      remainingDueDate: lead.remainingDueDate ? lead.remainingDueDate.toISOString().split("T")[0] : null,
      paymentNotes: lead.paymentNotes || ""
    };

    const systemPrompt = `You are an expert AI CRM Assistant for an Educational Institution & Professional Course Sales CRM.
Your job is to read a counselor's input—which may be natural language instructions, meeting notes, call summaries, OR raw copied JSON / CRM record dumps—and determine what fields in the CRM should be updated.

Today's Date in IST: ${istDateStr} (ISO: ${istIsoDate}).
Current Lead State:
${JSON.stringify(currentLeadSnapshot, null, 2)}

Available Courses in System:
${JSON.stringify(availableCourses, null, 2)}

Supported Field Values & Rules:
- leadId: Unique identifier of the lead (e.g. "9377325"). If counselor mentions a Lead ID or pastes a JSON/CRM dump containing "id", "lead_id", or "repeat_id", propose updating leadId if it differs from current leadId.
- name: Full name of student/prospect. (e.g. from "name", replacing placeholder like "Voicemail Lead - ...").
- phone: 10-digit mobile number. (e.g. from "mobile" or "phone").
- alternatePhone: Secondary/alternate phone number. (e.g. from "alt_mobile" or "alt_phone").
- email: Student email address. (e.g. from "email").
- addCourse: Course name interested in or enrolling into. (from "course", "courseInterested", "course_name", or mentioned course).
  * Map course abbreviations intelligently and ALWAYS include standard catalog fee:
    - "PGP-GL" or "GL" -> "German Language Course (PGP-GL) (Fee: ₹15500)"
    - "PGP-FL" or "FL" -> "French Language Course (PGP-FL) (Fee: ₹15500)"
    - "PGP-SL" or "SL" -> "Spanish Language Course (PGP-SL) (Fee: ₹15500)"
    - "PGP-JL" or "JL" -> "Japanese Language Course (PGP-JL) (Fee: ₹9500)"
    - "German" -> "German Language Course (Fee: ₹15500)"
    - "Spanish" -> "Spanish Language Course (Fee: ₹15500)"
    - "French" -> "French Language Course (Fee: ₹15500)"
    - "Japanese" -> "Japanese Language Course (Fee: ₹9500)"
    - "SSBB" -> "Six Sigma Black Belt (SSBB) (Fee: ₹29500)"
    - "SSGB" -> "Six Sigma Green Belt (SSGB) (Fee: ₹17500)"
    - "LSSBB" -> "Six Sigma Black Belt (SSBB) (Fee: ₹29500)"
    - "LSSGB" -> "Six Sigma Green Belt (SSGB) (Fee: ₹17500)"
    - "SSMBB" -> "Master Black Belt (SSMBB) (Fee: ₹59500)"
    - "PMP" -> "PMP (Project Management Professional) (Fee: ₹14900)"
    - "Excel" -> "Advanced Excel (Fee: ₹7500)"
    - "SAP FICO" -> "SAP FICO (Fee: ₹34500)"
    - "SAP PP" -> "SAP PP (Fee: ₹34500)"
    - "Medical Coding" -> "Medical Coding Course (Fee: ₹24500)"
  * CRITICAL: 'ozonetel_campaign_name' (e.g. "Subham_SSGB") is ONLY the counselor's dialer phone queue. It is NEVER the course! When 'course' is "PGP-GL", do NOT propose Six Sigma Green Belt!
  * CRITICAL FOR COURSE FEE: If the lead's current enrolled course has "(Fee: ₹0)" or no fee, you MUST propose updating "addCourse" with its real catalogue fee! A recognized course must NEVER have ₹0 fee!
  * If a course is present in the note/JSON and current lead has no courses or placeholder "General Course", propose updating addCourse!
- stage: ["New", "Contacted", "Interested", "Negotiation", "Converted", "Lost"]
  * Note on stage: The official stages are "New", "Contacted", "Interested", "Negotiation", "Converted", "Lost". If a callback or follow-up is scheduled and current stage is "New", set stage to "Contacted" (do NOT output "Follow-up Scheduled" as stage - put the follow-up date in followUpDate and time in followUpTime!). If current stage is already "Contacted", "Interested", or "Negotiation", keep that existing stage.
  * If student enrolled/joined/admitted: set stage to "Converted".
  * If student said not interested / drop: set stage to "Lost".
- quality: ["Hot Lead", "Warm Lead", "Cold Lead", "Call Again", "Voicemail", "Converted/Customer", "Not Interested", "Wrong number"]
  * Map from "lead_quality" or "quality" (e.g. "Call Again", "Warm Lead", "Hot Lead", etc.).
- priority: 1 (High/Urgent), 2 (Medium), 3 (Standard)
- followUpDate: YYYY-MM-DD format.
  * Today's ISO date is ${istIsoDate}. The current year is ${now.getFullYear()}.
  * NEVER propose a past date or past year (such as 2025 or earlier)! Any follow-up or callback must be scheduled for today (${istIsoDate}) or a future date.
  * If the input provides an explicit timestamp or date (such as "followuptime": "2026-05-02 21:21:00" or "2026-11-10 14:00:00" or "10/11/2026"), extract the date in YYYY-MM-DD format. If the year is before ${now.getFullYear()} or the date is in the past, roll forward to ${istIsoDate}.
  * If relative ("today", "tomorrow", "next Monday"), compute relative to ${istIsoDate}.
- followUpTime: 24-hour HH:mm format ONLY (e.g. "21:21", "18:30" for 6:30 PM, "11:00" for 11:00 AM, "14:00" for 2:00 PM).
  * If "followuptime": "2026-05-02 21:21:00", extract "21:21"!
  * For PM / afternoon / evening hours (like "6:30 PM", "630pm", "6:30 evening", "2 pm", "7 pm"), add 12 to the hour:
    - "6:30 PM" or "630pm" or "6:30" -> "18:30"
    - "2 PM" or "2pm" -> "14:00"
    - "3:30 PM" or "330pm" -> "15:30"
    - "11 AM" -> "11:00"
  * NEVER output strings with "AM" or "PM" in followUpTime. Always output standard 24-hour "HH:mm".
- nextAction: short descriptive action phrase (e.g. "Need Followup", "Call Back", "Share brochure", "Fee payment link").
  * In CRM dumps, map from "painarea" (e.g. "Need Followup").
- reminderNote: text note to display prominently on the lead's card (Pinned Reminder Note).
  * In CRM dumps, extract "painarea" and/or "description" (e.g. "Need Followup - switched off NOT NOW").
- lostReason: text reason if stage is "Lost" (e.g. "Fee too high", "Joined elsewhere", "Not interested", "Looking for offline").
- leadScope: "colleague_lead" | "my_lead"
  * CRITICAL RULE FOR COLLEAGUE LEADS & PIPELINE OWNERSHIP:
    - Whenever the counselor indicates that this lead belongs to, came from, or is of a coworker / colleague / teammate (e.g. "this lead is shaksh's", "this lead is sakshi's", "sakshi's lead", "lead of rahul", "assigned to priya", "colleague lead priya", "give to rohit", "teammate lead"):
      1. Propose field "leadScope" with newValue "colleague_lead" and label "Pipeline Scope".
      2. Propose field "colleagueName" with newValue extracted cleanly as the person's capitalized name (e.g. "Sakshi", "Rahul", "Priya") and label "Colleague / Owner".
      * DO NOT put colleague ownership into Reminder Note or Comment instead! You MUST update "leadScope" and "colleagueName"!
    - When the counselor says they are claiming, taking over, taking back, or enrolling the lead into their own pipeline (e.g. "claim lead", "this is my lead", "my lead now", "move to my pipeline", "take over"):
      1. Propose field "leadScope" with newValue "my_lead" and label "Pipeline Scope".
- colleagueName: string name of the colleague (e.g. "Sakshi", "Rahul", "Priya").
- isVoicemailPool: boolean (true or false).
  * If counselor says "move to voicemail", "add to voicemail pool", "voicemail lead" -> propose isVoicemailPool: true (label: "Voicemail Hub").
  * If counselor says "remove from voicemail", "not in voicemail" -> propose isVoicemailPool: false (label: "Voicemail Hub").
- discountType & discountValue:
  * MANDATORY RULE FOR SCHOLARSHIPS, DISCOUNTS, & QUOTED PRICING:
    - Whenever the counselor's note or call summary mentions a scholarship, discount percentage, concession, promotional offer, or quoted price:
      * Examples:
        - "Quoted ₹20,650 (after a 30% scholarship discount)"
        - "Offered 30% discount, final fee ₹20,650"
        - "Gave 20% scholarship discount"
        - "Quoted ₹20,650 for Black Belt"
        - "Flat 5000 off"
        - "Discounted to 20650"
      1. YOU MUST ALWAYS PROPOSE BOTH "discountType" AND "discountValue"! NEVER OMIT THEM!
      2. If a percentage is stated (e.g. "30% scholarship discount", "after a 30% discount", "20% off"):
         - Propose field "discountType", label "Discount Type", currentValue "${currentLeadSnapshot.discountType}", newValue "percentage", type "select".
         - Propose field "discountValue", label "Course Discount / Scholarship", currentValue ${currentLeadSnapshot.discountValue}, newValue 30, type: "number".
      3. If a quoted final fee is mentioned (e.g. "quoted ₹20,650" when the course standard fee is ₹29,500) without saying the word percentage:
         - Difference = 29500 - 20650 = 8850.
         - Since 8850 is exactly 30% of 29500, propose discountType: "percentage" and discountValue: 30!
         - If it does not form an exact integer percentage, propose discountType: "flat" and discountValue: 8850!
      4. Note on token payment vs discount:
         - If the counselor pitched a token (e.g. "pitched ₹2,000 token registration payment") but the prospect REFUSED or has NOT yet paid:
           * DO NOT set paidAmount (student has not paid yet).
           * BUT DO PROPOSE discountType and discountValue, because the scholarship/discount price (e.g. 30% / ₹20,650) was agreed/quoted for the student!
- paidAmount: number (Total amount paid by student so far, token amount, advance, or full payment. E.g. if counselor says "paid 5000 token" -> 5000. If "paid 60%", calculate 60% of finalFee. If "paid full", set to finalFee).
- remainingDueDate: YYYY-MM-DD format (Date when student promised or agreed to pay the remaining balance/installment).
- paymentNotes: text (Notes on payment method, UPI reference, or installment terms, e.g. "Token paid via UPI, remaining on 25th").
- snoozeDays: number of days to snooze/cooldown (if mentioned, e.g. 2, 30, 45).
- comment: a clean, professional summary of what transpired or what was decided, to log in the interaction history.
  * When HTML or multi-call logs are in "desc" or notes, strip all HTML tags and summarize the call history and latest notes into a readable summary!

SPECIAL INSTRUCTIONS FOR RAW JSON / CRM RECORD DUMPS:
When the counselor pastes a JSON block, key-value export, or CRM record (which may have fields like id, member_id, email, mobile, course, lead_quality, painarea, followuptime, description, name, desc, member):
- YOU MUST EXTRACT EVERY SINGLE AVAILABLE PIECE OF INFORMATION AND PROPOSE CHANGES FOR ALL APPLICABLE FIELDS:
  1. 'leadId': from 'id' / 'repeat_id' / 'lead_id' if different from current leadId.
  2. 'name': from 'name' if different from current name (e.g. replaces placeholder "Voicemail Lead - ...").
  3. 'phone': from 'mobile' / 'phone' if different from current phone.
  4. 'alternatePhone': from 'alt_mobile' if provided and not null.
  5. 'email': from 'email' if provided.
  6. 'addCourse': from 'course' (map abbreviations like 'PGP-GL' or 'GL' -> 'German Language Course (PGP-GL) (Fee: ₹15500)', 'PGP-FL' -> 'French Language Course (PGP-FL) (Fee: ₹15500)', 'SSGB' -> 'Six Sigma Green Belt (SSGB) (Fee: ₹17500)', 'SSBB' -> 'Six Sigma Black Belt (SSBB) (Fee: ₹29500)'). NEVER map course from 'ozonetel_campaign_name'! Ozonetel campaign is only the telephony dialer queue!
  7. 'quality': from 'lead_quality' or 'quality'.
  8. 'reminderNote': from 'painarea' and/or 'description' (e.g. 'Need Followup - calling').
  9. 'nextAction': from 'painarea' or follow-up action (e.g. 'Need Followup').
  10. 'followUpDate' and 'followUpTime': from 'followuptime' (e.g. "2026-11-18 10:51" -> followUpDate: "2026-11-18", followUpTime: "10:51").
  11. 'leadScope' and 'colleagueName':
    * CRITICAL USER IDENTITY: The counselor using this system is Subham (or Shubham). Any campaign like "Subham_SSGB" or containing "Subham" belongs directly to Subham's active pipeline (leadScope: "my_lead", colleagueName: null). NEVER assign Subham to colleague pool!
    * Only if the campaign explicitly mentions ANOTHER counselor (e.g. "Arun_ERP_4", "Sakshi_SSGB", "Rahul_PMP") should leadScope be "colleague_lead" and colleagueName set to that person's name!
  12. 'discountType' and 'discountValue': from any quoted fee, scholarship, or discount mentioned in notes or offer details.
  13. 'comment': from 'desc' and/or 'description' (clean text without HTML tags, providing a clear summary of recent call history and latest notes).
- CRITICAL DEDUPLICATION RULE:
  DO NOT propose any change where the proposed newValue is ALREADY IDENTICAL to currentValue (e.g. do not propose Stage: "Interested" -> "Interested", or Lead Quality: "Hot Lead" -> "Hot Lead", or Follow-up Date: "2026-11-19" -> "2026-11-19"). Only propose fields that actually change or need updating!

CRITICAL INSTRUCTIONS:
1. Propose all fields that the counselor provided or intended to update, including any course and fee discounts / scholarships.
2. If a callback or follow-up is scheduled, do NOT change stage if already Contacted/Interested; if stage is New, change to Contacted. Always resolve followUpDate and followUpTime.
3. If the user mentions not interested / drop / lost, set stage to "Lost" or quality to "Not Interested" and set lostReason.
4. Always generate a 'comment' field summarizing what happened to log into interaction comments.
5. Return a valid JSON object matching this structure:
{
  "summary": "1-sentence summary of what will be updated",
  "proposedChanges": [
    {
      "field": "leadId",
      "label": "Lead ID",
      "currentValue": "LD-1002",
      "newValue": "9377325",
      "type": "text"
    },
    {
      "field": "name",
      "label": "Name",
      "currentValue": "Voicemail Lead - 9756889766",
      "newValue": "Brijesh",
      "type": "text"
    },
    {
      "field": "addCourse",
      "label": "Course Interested",
      "currentValue": "None",
      "newValue": "Six Sigma Black Belt (SSBB)",
      "type": "text"
    },
    {
      "field": "discountType",
      "label": "Discount Type",
      "currentValue": "none",
      "newValue": "percentage",
      "type": "select"
    },
    {
      "field": "discountValue",
      "label": "Course Discount / Scholarship",
      "currentValue": 0,
      "newValue": 30,
      "type": "number"
    }
  ]
}`;

    const geminiKeys = getRotatedGeminiKeys();
    if (geminiKeys.length === 0) {
      return res.status(500).json({
        success: false,
        message: "No Gemini API key configured. Please set GEMINI_API_KEY in backend/.env"
      });
    }

    let result = null;
    let errors = [];

    for (let kIdx = 0; kIdx < geminiKeys.length; kIdx++) {
      const currentKey = geminiKeys[kIdx];
      for (let mIdx = 0; mIdx < GEMINI_TEXT_MODELS.length; mIdx++) {
        const currentModel = GEMINI_TEXT_MODELS[mIdx];
        try {
          const resAI = await callGeminiText(currentKey, currentModel, systemPrompt, instruction);
          if (resAI.ok) {
            result = resAI;
            break;
          }
          errors.push(`Key #${kIdx + 1} [${currentModel}]: HTTP ${resAI.status}`);
        } catch (err) {
          errors.push(`Key #${kIdx + 1} [${currentModel}]: ${err.message}`);
        }
      }
      if (result) break;
    }

    if (!result) {
      return res.status(502).json({
        success: false,
        message: "AI service temporarily unavailable. Please retry in a few seconds.",
        details: errors
      });
    }

    if (result && result.data && Array.isArray(result.data.proposedChanges)) {
      result.data.proposedChanges.forEach((change) => {
        if (change.field === "course") change.field = "addCourse";
        if (change.field === "id") change.field = "leadId";
        if (change.field === "painarea") change.field = "reminderNote";
        if (change.field === "discount" || change.field === "scholarship" || change.field === "discountPercentage") {
          change.field = "discountValue";
        }

        if (change.field === "leadId") change.label = change.label || "Lead ID";
        if (change.field === "addCourse") {
          change.label = change.label || "Course Interested";
          const resCourse = resolveCourseAndFee(change.newValue, 0, dbCourses);
          change.newValue = `${resCourse.courseName} (Fee: ₹${resCourse.fee})`;
        }
        if (change.field === "reminderNote") change.label = change.label || "Pinned Reminder Note";
        if (change.field === "nextAction") change.label = change.label || "Next Action";
        if (change.field === "comment") change.label = change.label || "Interaction Comment";
        if (change.field === "leadScope") change.label = change.label || "Pipeline Scope";
        if (change.field === "colleagueName") change.label = change.label || "Colleague / Owner";
        if (change.field === "isVoicemailPool") change.label = change.label || "Voicemail Hub";
        if (change.field === "discountType") change.label = change.label || "Discount Type";
        if (change.field === "discountValue") change.label = change.label || "Course Discount / Scholarship";
        if (change.field === "finalFee" || change.field === "quotedFee") change.label = change.label || "Quoted / Final Fee";
        if (change.field === "paidAmount") change.label = change.label || "Paid / Token Amount";
        if (change.field === "remainingDueDate") change.label = change.label || "Balance Due Date";
        if (change.field === "paymentNotes") change.label = change.label || "Payment Mode / Note";
        if (change.field === "followUpDate") {
          change.label = change.label || "Follow-up Date";
          if (change.newValue) {
            const timeVal = result.data.proposedChanges.find((c) => c.field === "followUpTime")?.newValue || lead.followUpTime || "";
            const san = sanitizeFollowUpDate(change.newValue, timeVal);
            change.newValue = san.followUpDate;
          }
        }
        if (change.field === "followUpTime") {
          change.label = change.label || "Follow-up Time";
          if (change.newValue) {
            change.newValue = normalizeTimeTo24Hour(change.newValue);
          }
        }
      });

      // Colleague vs Self Attribution from instruction (e.g. ozonetel_campaign_name: Subham_SSGB vs Arun_ERP_4)
      const campMatch = instruction.match(/"?(?:ozonetel_campaign_name|campaign)"?\s*[:=]\s*"?([a-zA-Z0-9_-]+)"?/i);
      if (campMatch && campMatch[1]) {
        const parts = campMatch[1].split("_");
        const rawUser = (parts[0] || "").toLowerCase().trim();
        const genericKeywords = ["general", "inbound", "campaign", "ozonetel", "crm"];
        if (rawUser.includes("subham") || rawUser.includes("shubham")) {
          // Subham is the user himself! Ensure my_lead
          if (currentLeadSnapshot.leadScope === "colleague_lead") {
            result.data.proposedChanges = result.data.proposedChanges.filter((c) => c.field !== "leadScope" && c.field !== "colleagueName");
            result.data.proposedChanges.push({
              field: "leadScope",
              label: "Pipeline Scope",
              currentValue: currentLeadSnapshot.leadScope,
              newValue: "my_lead",
              type: "select"
            });
          }
        } else if (rawUser && !genericKeywords.includes(rawUser)) {
          const colleague = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
          if (!result.data.proposedChanges.some((c) => c.field === "leadScope")) {
            result.data.proposedChanges.push({
              field: "leadScope",
              label: "Pipeline Scope",
              currentValue: currentLeadSnapshot.leadScope,
              newValue: "colleague_lead",
              type: "select"
            });
            result.data.proposedChanges.push({
              field: "colleagueName",
              label: "Colleague / Owner",
              currentValue: currentLeadSnapshot.colleagueName,
              newValue: colleague,
              type: "text"
            });
          }
        }
      }

      // Deterministic / AI fallback: check if instruction mentions discount or scholarship
      const hasDiscountProp = result.data.proposedChanges.some((c) => c.field === "discountValue");
      if (!hasDiscountProp) {
        // Check for percentage scholarship/discount like "30% scholarship", "30% discount", "20% off", "scholarship discount (30%)"
        const pctMatch = instruction.match(/(\d{1,2}(?:\.\d+)?)\s*%\s*(?:scholarship|discount|off|concession)/i) ||
                         instruction.match(/(?:scholarship|discount|off|concession)\s*(?:of\s*)?(\d{1,2}(?:\.\d+)?)\s*%/i) ||
                         instruction.match(/after\s*(?:a\s*)?(\d{1,2}(?:\.\d+)?)\s*%\s*(?:scholarship|discount)/i);
        // Check for quoted fee like "Quoted ₹20,650", "quoted: 20650", "final fee 20,650"
        const quotedFeeMatch = instruction.match(/(?:quoted|final fee|offer fee|discounted fee|price quoted)\s*(?:of\s*|is\s*|:\s*)?(?:₹|INR|Rs\.?)?\s*([0-9,.]+)/i);

        if (pctMatch && pctMatch[1]) {
          const pctVal = parseFloat(pctMatch[1]);
          if (pctVal > 0 && pctVal <= 100) {
            result.data.proposedChanges.push({
              field: "discountType",
              label: "Discount Type",
              currentValue: currentLeadSnapshot.discountType || "none",
              newValue: "percentage",
              type: "select"
            });
            result.data.proposedChanges.push({
              field: "discountValue",
              label: "Course Discount / Scholarship",
              currentValue: currentLeadSnapshot.discountValue || 0,
              newValue: pctVal,
              type: "number"
            });
          }
        } else if (quotedFeeMatch && quotedFeeMatch[1]) {
          const quotedNum = parseFloat(quotedFeeMatch[1].replace(/,/g, ""));
          let baseFee = currentLeadSnapshot.totalFee || 0;
          const courseChange = result.data.proposedChanges.find((c) => c.field === "addCourse");
          if (courseChange && courseChange.newValue) {
            const m = String(courseChange.newValue).match(/fee:\s*₹?([0-9,.]+)/i);
            if (m) baseFee = parseFloat(m[1].replace(/,/g, "")) || baseFee;
          }
          if (baseFee > quotedNum && quotedNum > 0) {
            const diff = baseFee - quotedNum;
            const pct = Math.round((diff / baseFee) * 100);
            if (pct > 0 && pct < 100 && Math.abs(baseFee * (1 - pct / 100) - quotedNum) < 5) {
              result.data.proposedChanges.push({
                field: "discountType",
                label: "Discount Type",
                currentValue: currentLeadSnapshot.discountType || "none",
                newValue: "percentage",
                type: "select"
              });
              result.data.proposedChanges.push({
                field: "discountValue",
                label: "Course Discount / Scholarship",
                currentValue: currentLeadSnapshot.discountValue || 0,
                newValue: pct,
                type: "number"
              });
            } else {
              result.data.proposedChanges.push({
                field: "discountType",
                label: "Discount Type",
                currentValue: currentLeadSnapshot.discountType || "none",
                newValue: "flat",
                type: "select"
              });
              result.data.proposedChanges.push({
                field: "discountValue",
                label: "Course Discount / Scholarship",
                currentValue: currentLeadSnapshot.discountValue || 0,
                newValue: diff,
                type: "number"
              });
            }
          }
        }
      }

      // If discountValue is proposed but discountType is missing, inject discountType
      const dValIndex = result.data.proposedChanges.findIndex((c) => c.field === "discountValue");
      const hasDiscountType = result.data.proposedChanges.some((c) => c.field === "discountType");
      if (dValIndex !== -1 && !hasDiscountType) {
        const dVal = result.data.proposedChanges[dValIndex];
        const valNum = Number(String(dVal.newValue).replace(/[^0-9.]/g, "")) || 0;
        const autoType = valNum > 0 && valNum <= 100 ? "percentage" : valNum > 100 ? "flat" : "none";
        result.data.proposedChanges.splice(dValIndex, 0, {
          field: "discountType",
          label: "Discount Type",
          currentValue: currentLeadSnapshot.discountType || "none",
          newValue: autoType,
          type: "select"
        });
      }

      // Deterministic / NLP fallback: check if instruction mentions callback or follow-up date/time
      const hasFollowUpDate = result.data.proposedChanges.some((c) => c.field === "followUpDate");
      const hasFollowUpTime = result.data.proposedChanges.some((c) => c.field === "followUpTime");
      if (!hasFollowUpDate || !hasFollowUpTime) {
        const nlp = extractFollowUpFromText(instruction);
        if (nlp.matched) {
          if (!hasFollowUpDate && nlp.followUpDate) {
            result.data.proposedChanges.push({
              field: "followUpDate",
              label: "Follow-up Date",
              currentValue: currentLeadSnapshot.followUpDate,
              newValue: nlp.followUpDate,
              type: "date"
            });
          }
          if (!hasFollowUpTime && nlp.followUpTime) {
            result.data.proposedChanges.push({
              field: "followUpTime",
              label: "Follow-up Time",
              currentValue: currentLeadSnapshot.followUpTime,
              newValue: normalizeTimeTo24Hour(nlp.followUpTime),
              type: "text"
            });
          }
        }
      }

      // INTELLIGENT DEDUPLICATION: Filter out no-op proposed changes where currentValue === newValue
      result.data.proposedChanges = result.data.proposedChanges.filter((change) => {
        if (change.field === "comment") return true; // Always preserve interaction comments
        const identical = isSameValue(change.field, change.currentValue, change.newValue);
        return !identical;
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data,
      modelUsed: result.modelUsed
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "AI Update failed: " + error.message
    });
  }
});

// POST /api/leads/:id/ai-apply-update - Apply reviewed and ticked updates to a lead
router.post("/:id/ai-apply-update", async (req, res) => {
  try {
    const lead = await findLeadByIdOrCustomId(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    const { updates = {}, comment = "" } = req.body;

    // Lead ID update
    if (updates.leadId && String(updates.leadId).trim()) {
      const cleanId = String(updates.leadId).trim().replace(/^LD-?/i, "");
      const existingWithId = await Lead.findOne({ leadId: cleanId, _id: { $ne: lead._id } });
      if (existingWithId) {
        return res.status(400).json({
          success: false,
          message: `Cannot change Lead ID to "${cleanId}": already used by ${existingWithId.name}.`
        });
      }
      lead.leadId = cleanId;
      lead.markModified("leadId");
    }

    // Contact fields
    if (updates.name && updates.name.trim()) {
      lead.name = updates.name.trim();
      if (lead.isVoicemailPool && !lead.name.toLowerCase().includes("voicemail lead")) {
        lead.isVoicemailPool = false;
        lead.markModified("isVoicemailPool");
      }
      lead.markModified("name");
    }
    if (updates.phone && updates.phone.trim()) {
      lead.phone = updates.phone.trim();
      lead.markModified("phone");
    }
    if (updates.alternatePhone !== undefined) {
      lead.alternatePhone = String(updates.alternatePhone).trim();
      lead.markModified("alternatePhone");
    }
    if (updates.email !== undefined) {
      lead.email = updates.email.trim();
      lead.markModified("email");
    }

    // Strategy & Pipeline (with graceful normalization)
    if (updates.stage) {
      let stg = String(updates.stage).trim();
      if (stg.toLowerCase() === "enrolled") stg = "Converted";
      if (stg.toLowerCase() === "drop") stg = "Lost";
      if (stg === "Follow-up Scheduled") {
        // If current stage is "New", advance to "Contacted"; otherwise keep the current stage
        if (!lead.stage || lead.stage === "New") {
          stg = "Contacted";
        } else {
          stg = lead.stage;
        }
        if (!updates.nextAction && !lead.nextAction) {
          lead.nextAction = "Call Back / Follow-up";
        }
      }
      lead.stage = stg;
      lead.markModified("stage");
    }

    if (updates.quality) {
      let q = String(updates.quality).trim();
      if (q.toLowerCase() === "drop") q = "Not Interested";
      lead.quality = q;
      lead.markModified("quality");
    }

    if (updates.priority !== undefined) {
      lead.priority = Number(updates.priority);
      lead.markModified("priority");
    }
    if (updates.nextAction !== undefined) {
      lead.nextAction = updates.nextAction.trim();
      lead.markModified("nextAction");
    }
    if (updates.reminderNote !== undefined) {
      lead.reminderNote = updates.reminderNote.trim();
      lead.markModified("reminderNote");
    }
    if (updates.lostReason !== undefined) {
      lead.lostReason = updates.lostReason.trim();
      lead.markModified("lostReason");
    }

    // Follow-up & Snooze
    if (updates.followUpDate !== undefined) {
      if (updates.followUpDate) {
        const san = sanitizeFollowUpDate(updates.followUpDate, updates.followUpTime || lead.followUpTime);
        lead.followUpDate = new Date(san.followUpDate);
        if (!updates.followUpTime && san.followUpTime) {
          lead.followUpTime = normalizeTimeTo24Hour(san.followUpTime);
        }
      } else {
        lead.followUpDate = null;
      }
      lead.markModified("followUpDate");
    }
    if (updates.followUpTime !== undefined) {
      lead.followUpTime = updates.followUpTime ? normalizeTimeTo24Hour(updates.followUpTime) : "";
      lead.markModified("followUpTime");
    }

    // Auto-calculate follow-up snooze
    if (lead.followUpDate) {
      const followUpDateTime = computeFollowUpDateTime(lead.followUpDate, lead.followUpTime);
      if (followUpDateTime && followUpDateTime > new Date()) {
        lead.snoozedUntil = followUpDateTime;
        lead.snoozeReason = formatFollowUpReason(followUpDateTime, lead.followUpTime);
        lead.markModified("snoozedUntil");
        lead.markModified("snoozeReason");
      }
    } else if (updates.snoozeDays && Number(updates.snoozeDays) > 0) {
      const days = Number(updates.snoozeDays);
      lead.snoozedUntil = new Date(Date.now() + days * 86400000);
      lead.snoozeReason = `Snoozed for ${days} days`;
      lead.followUpDate = null;
      lead.followUpTime = "";
      lead.markModified("snoozedUntil");
      lead.markModified("snoozeReason");
      lead.markModified("followUpDate");
      lead.markModified("followUpTime");
    }

    // Courses & Discounts
    if (updates.discountType) {
      lead.discountType = updates.discountType;
      lead.markModified("discountType");
    }
    if (updates.discountValue !== undefined) {
      let dVal = updates.discountValue;
      if (typeof dVal === "string") {
        dVal = parseFloat(dVal.replace(/[^0-9.]/g, "")) || 0;
      }
      lead.discountValue = Number(dVal) || 0;
      if (!updates.discountType || lead.discountType === "none") {
        if (lead.discountValue > 0 && lead.discountValue <= 100) {
          lead.discountType = "percentage";
        } else if (lead.discountValue > 100) {
          lead.discountType = "flat";
        }
      }
      lead.markModified("discountType");
      lead.markModified("discountValue");
    }

    if (updates.finalFee !== undefined || updates.quotedFee !== undefined) {
      const qFee = Number(updates.finalFee || updates.quotedFee) || 0;
      if (qFee > 0) {
        lead.finalFee = qFee;
        lead.markModified("finalFee");
      }
    }

    const courseToAdd = updates.addCourse || updates.course;
    if (courseToAdd && String(courseToAdd).trim()) {
      let dbCourses = [];
      try {
        dbCourses = await Course.find({ active: true }).lean();
      } catch (e) {}

      const resolved = resolveCourseAndFee(courseToAdd, 0, dbCourses);
      const cleanCourseName = resolved.courseName;
      const courseFee = resolved.fee;

      if (!Array.isArray(lead.enrolledCourses)) lead.enrolledCourses = [];

      // If lead currently only has 0 or 1 course (placeholder or previous course being updated)
      if (
        lead.enrolledCourses.length <= 1 ||
        (lead.enrolledCourses.length === 1 &&
          lead.enrolledCourses[0].courseName &&
          lead.enrolledCourses[0].courseName.toLowerCase().includes("general course"))
      ) {
        lead.enrolledCourses = [
          {
            courseId: lead.enrolledCourses[0]?.courseId || ("CRS-" + Date.now()),
            courseName: cleanCourseName,
            fee: courseFee
          }
        ];
      } else {
        const existingIdx = lead.enrolledCourses.findIndex(
          (c) => c.courseName && c.courseName.toLowerCase() === cleanCourseName.toLowerCase()
        );
        if (existingIdx !== -1) {
          if (!lead.enrolledCourses[existingIdx].fee || lead.enrolledCourses[existingIdx].fee === 0) {
            lead.enrolledCourses[existingIdx].fee = courseFee;
          }
          lead.enrolledCourses[existingIdx].courseName = cleanCourseName;
        } else {
          lead.enrolledCourses.push({
            courseId: "CRS-" + Date.now(),
            courseName: cleanCourseName,
            fee: courseFee
          });
        }
      }
      lead.markModified("enrolledCourses");
    }

    // Auto-heal any other course in enrolledCourses that still has fee 0
    if (Array.isArray(lead.enrolledCourses) && lead.enrolledCourses.length > 0) {
      let dbCourses = [];
      try {
        dbCourses = await Course.find({ active: true }).lean();
      } catch (e) {}
      lead.enrolledCourses.forEach((c) => {
        if (!c.fee || c.fee === 0) {
          const res = resolveCourseAndFee(c.courseName, c.fee, dbCourses);
          if (res.fee > 0) {
            c.courseName = res.courseName;
            c.fee = res.fee;
            lead.markModified("enrolledCourses");
          }
        }
      });
    }

    // Payments & Installments
    if (updates.paidAmount !== undefined) {
      lead.paidAmount = Math.max(0, Number(updates.paidAmount) || 0);
      lead.markModified("paidAmount");
    }
    if (updates.remainingDueDate !== undefined) {
      lead.remainingDueDate = updates.remainingDueDate ? new Date(updates.remainingDueDate) : null;
      lead.markModified("remainingDueDate");
    }
    if (updates.paymentNotes !== undefined) {
      lead.paymentNotes = updates.paymentNotes ? updates.paymentNotes.trim() : "";
      lead.markModified("paymentNotes");
    }
    if (updates.leadScope !== undefined) {
      if (lead.leadScope === "colleague_lead" && updates.leadScope === "my_lead") {
        lead.claimedAt = new Date();
        lead.markModified("claimedAt");
      }
      lead.leadScope = updates.leadScope;
      lead.markModified("leadScope");
    }
    if (updates.colleagueName !== undefined) {
      lead.colleagueName = String(updates.colleagueName).trim();
      lead.markModified("colleagueName");
    }
    if (updates.isVoicemailPool !== undefined) {
      lead.isVoicemailPool = Boolean(updates.isVoicemailPool);
      lead.markModified("isVoicemailPool");
    }

    // Interaction history comment
    if (comment && comment.trim()) {
      if (!Array.isArray(lead.comments)) lead.comments = [];
      lead.comments.push({
        commentId: "COM-" + Date.now() + "-" + Math.floor(1000 + Math.random() * 9000),
        text: `🤖 [AI Quick Update] ${comment.trim()}`,
        outcome: lead.lastOutcome || "AI Updated",
        addedAt: new Date(),
        updatedAt: new Date()
      });
      lead.markModified("comments");
    }

    const savedLead = await lead.save();

    return res.status(200).json({
      success: true,
      message: "Lead successfully updated via AI.",
      data: savedLead
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to apply AI update: " + error.message
    });
  }
});


// Helper to compute today's talk-time and call logs across all leads
async function getTodayTalkTimeStats() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const leadsWithActivity = await Lead.find({
    $or: [
      { lastCallDate: { $gte: startOfToday } },
      { "comments.addedAt": { $gte: startOfToday } }
    ]
  })
    .select("name phone leadId course stage lastCallDate lastCallDuration totalTalkTime comments enrolledCourses courseName")
    .lean();

  let todayTalkTime = 0;
  let todayCallsCount = 0;
  const callLogs = [];

  for (const lead of leadsWithActivity) {
    if (lead.comments && Array.isArray(lead.comments)) {
      for (const c of lead.comments) {
        if (c.addedAt && new Date(c.addedAt) >= startOfToday) {
          const match = c.text && c.text.match(/Duration:\s*(\d+)s/i);
          const duration = match ? parseInt(match[1], 10) : (c.duration || 0);
          const isCallEvent =
            duration > 0 ||
            (c.outcome &&
              (c.outcome.includes("Call") ||
                c.outcome.includes("Voicemail") ||
                c.outcome.includes("Connected") ||
                c.outcome.includes("Interested") ||
                c.outcome.includes("Not Interested") ||
                c.outcome.includes("No Answer") ||
                c.outcome.includes("Switched Off") ||
                c.outcome.includes("Picked")));

          if (isCallEvent) {
            todayTalkTime += duration;
            todayCallsCount++;
            callLogs.push({
              leadId: lead._id,
              leadCustomId: lead.leadId,
              name: lead.name,
              phone: lead.phone,
              course: lead.course || (lead.enrolledCourses?.[0]?.courseName || lead.courseName || "General"),
              stage: lead.stage,
              outcome: c.outcome || "Call Logged",
              duration: duration,
              addedAt: c.addedAt,
              note: c.text
            });
          }
        }
      }
    }
  }

  callLogs.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
  return { todayTalkTime, todayCallsCount, callLogs };
}

// GET /api/leads/talktime-stats - Realtime talk-time & calls logged today across all leads (with Setting calibration)
router.get("/talktime-stats", async (req, res) => {
  try {
    const stats = await getTodayTalkTimeStats();
    let effectiveSeconds = stats.todayTalkTime;
    let isManualOverride = false;
    let targetMinutes = 90;

    const setting = await Setting.findOne({ key: "default" }).lean();
    if (setting) {
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      // Check dynamic per-day target if set for today
      const todayTarget = (setting.dailyTargets || []).find((t) => t.date === todayKey);
      if (todayTarget && typeof todayTarget.targetMinutes === "number") {
        targetMinutes = todayTarget.isOffDay ? 0 : todayTarget.targetMinutes;
      } else if (setting.targetTalkTimeMinutes) {
        targetMinutes = setting.targetTalkTimeMinutes;
      }

      const manualAdj = (setting.manualTalkTimeAdjustments || []).find((a) => a.date === todayKey);
      if (manualAdj && typeof manualAdj.adjustedSeconds === "number") {
        effectiveSeconds = manualAdj.adjustedSeconds;
        isManualOverride = true;
      }
    }

    return res.status(200).json({
      success: true,
      todayTalkTimeSeconds: effectiveSeconds,
      crmLoggedSeconds: stats.todayTalkTime,
      isManualOverride,
      targetTalkTimeMinutes: targetMinutes,
      todayCallsCount: stats.todayCallsCount,
      callLogs: stats.callLogs
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/leads/voicemail-pool - Get all leads in Voicemail Pool with today's talk-time statistics
router.get("/voicemail-pool", async (req, res) => {
  try {
    const now = new Date();
    const stats = await getTodayTalkTimeStats();

    const poolLeads = await Lead.find({
      $or: [
        { isVoicemailPool: true },
        { quality: "Voicemail", isVoicemailPool: { $ne: false } }
      ]
    }).lean();

    const active = [];
    const snoozed = [];

    for (const lead of poolLeads) {
      let isSnoozed = false;
      let effectiveSnoozeUntil = null;
      let effectiveSnoozeReason = lead.snoozeReason || "";

      // 1. Explicit snoozedUntil
      if (lead.snoozedUntil && new Date(lead.snoozedUntil) > now) {
        isSnoozed = true;
        effectiveSnoozeUntil = new Date(lead.snoozedUntil);
      }

      // 2. Scheduled follow-up: if followUpDate is set and in the future, snooze until then!
      // (Unless counselor explicitly manually unsnoozed this specific lead)
      if (lead.followUpDate && lead.snoozeReason !== "UNSNOOZED_MANUAL") {
        const followUpDateTime = computeFollowUpDateTime(lead.followUpDate, lead.followUpTime);
        if (followUpDateTime && followUpDateTime > now) {
          isSnoozed = true;
          if (!effectiveSnoozeUntil || followUpDateTime > effectiveSnoozeUntil) {
            effectiveSnoozeUntil = followUpDateTime;
            effectiveSnoozeReason = formatFollowUpReason(followUpDateTime, lead.followUpTime);
          }
        }
      }

      if (isSnoozed) {
        snoozed.push({
          ...lead,
          snoozedUntil: effectiveSnoozeUntil,
          snoozeReason: effectiveSnoozeReason
        });
      } else {
        active.push(lead);
      }
    }

    return res.status(200).json({
      success: true,
      activeCount: active.length,
      snoozedCount: snoozed.length,
      todayTalkTimeSeconds: stats.todayTalkTime,
      todayCallCount: stats.todayCallsCount,
      dailyGoalSeconds: 5400, // default 90m
      activeLeads: active,
      snoozedLeads: snoozed,
      callLogs: stats.callLogs
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch voicemail pool: " + error.message
    });
  }
});

// GET /api/leads/:id - Return a single lead
router.get("/:id", async (req, res) => {
  try {
    const lead = await findLeadByIdOrCustomId(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found"
      });
    }
    if (lead.followUpTime) {
      lead.followUpTime = normalizeTimeTo24Hour(lead.followUpTime);
    }
    // Auto-heal contradictory lead: if actively snoozed and has stale expired follow-up, wipe it
    const now = new Date();
    if (lead.snoozedUntil && new Date(lead.snoozedUntil) > now && lead.followUpDate) {
      const followUpDt = computeFollowUpDateTime(lead.followUpDate, lead.followUpTime);
      if (!followUpDt || followUpDt <= now) {
        lead.followUpDate = null;
        lead.followUpTime = "";
      }
    }
    return res.status(200).json({
      success: true,
      data: lead
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch lead: " + error.message
    });
  }
});

// POST /api/leads - Create a new lead
router.post("/", async (req, res) => {
  try {
    const {
      leadId,
      name,
      email,
      phone,
      quality,
      source,
      priority,
      stage,
      nextAction,
      reminderNote,
      lostReason,
      callCount,
      lastOutcome,
      enquiryDate,
      followUpDate,
      followUpTime,
      enrolledCourses,
      discountType,
      discountValue,
      paidAmount,
      remainingDueDate,
      paymentNotes,
      leadScope,
      colleagueName,
      initialCommentText,
      initialCommentOutcome
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Lead name is required"
      });
    }

    let finalLeadId = leadId ? String(leadId).trim() : "";
    if (finalLeadId) {
      // Strip any LD- or ld- prefix if provided
      finalLeadId = finalLeadId.replace(/^LD-?/i, "").trim();
    }
    if (!finalLeadId) {
      // Auto-generate highest numeric lead number without "LD-" prefix
      const allLeads = await Lead.find({}).select("leadId").lean();
      let maxNum = 0;
      allLeads.forEach((l) => {
        if (l.leadId) {
          const m = l.leadId.match(/(\d+)/);
          if (m) {
            const n = parseInt(m[1], 10);
            if (n > maxNum) maxNum = n;
          }
        }
      });
      finalLeadId = maxNum > 0 ? String(maxNum + 1) : String(Date.now()).slice(-7);
    } else {
      const existingLead = await Lead.findOne({ leadId: finalLeadId });
      if (existingLead) {
        return res.status(400).json({
          success: false,
          message: `Lead ID "${finalLeadId}" already exists. Please choose a unique Lead ID.`
        });
      }
    }

    // Check duplicate phone if provided
    if (phone && phone.trim() !== "") {
      const cleanNewPhone = phone.replace(/[^0-9]/g, "");
      if (cleanNewPhone.length >= 6) {
        const allLeadsWithPhone = await Lead.find({ phone: { $exists: true, $ne: "" } }).select("leadId name phone");
        const dupPhoneLead = allLeadsWithPhone.find((l) => {
          const digits = (l.phone || "").replace(/[^0-9]/g, "");
          return digits && digits === cleanNewPhone;
        });
        if (dupPhoneLead) {
          return res.status(400).json({
            success: false,
            message: `Phone number is already registered to Lead ${dupPhoneLead.leadId} (${dupPhoneLead.name}).`
          });
        }
      }
    }

    // Build initial comments array if first interaction note was provided
    const commentsList = [];
    if (initialCommentText && initialCommentText.trim() !== "") {
      commentsList.push({
        commentId: "COM-" + Date.now() + "-" + Math.floor(1000 + Math.random() * 9000),
        text: initialCommentText.trim(),
        outcome: initialCommentOutcome ? initialCommentOutcome.trim() : (lastOutcome || ""),
        addedAt: new Date(),
        updatedAt: new Date()
      });
    } else if (Array.isArray(req.body.comments) && req.body.comments.length > 0) {
      // Ensure all comments have commentId
      req.body.comments.forEach((c) => {
        if (c && c.text) {
          commentsList.push({
            commentId: c.commentId || "COM-" + Date.now() + "-" + Math.floor(1000 + Math.random() * 9000),
            text: c.text,
            outcome: c.outcome || "",
            addedAt: c.addedAt ? new Date(c.addedAt) : new Date(),
            updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date()
          });
        }
      });
    }

    let initialSnoozedUntil = null;
    let initialSnoozeReason = "";
    if (followUpDate) {
      const followUpDateTime = computeFollowUpDateTime(followUpDate, followUpTime);
      if (followUpDateTime && followUpDateTime > new Date()) {
        initialSnoozedUntil = followUpDateTime;
        initialSnoozeReason = formatFollowUpReason(followUpDateTime, followUpTime);
      }
    }

    let resolvedCourses = [];
    if (Array.isArray(enrolledCourses) && enrolledCourses.length > 0) {
      let dbCourses = [];
      try {
        dbCourses = await Course.find({ active: true }).lean();
      } catch (e) {}
      resolvedCourses = enrolledCourses.map((c) => {
        const res = resolveCourseAndFee(c.courseName, c.fee, dbCourses);
        return {
          courseId: c.courseId || ("CRS-" + Date.now() + "-" + Math.floor(Math.random() * 1000)),
          courseName: res.courseName,
          fee: res.fee
        };
      });
    }

    const newLead = new Lead({
      leadId: finalLeadId,
      name: name.trim(),
      email: email ? email.trim() : "",
      phone: phone ? phone.trim() : "",
      quality: quality || "Warm Lead",
      source: source || "Website",
      priority: priority !== undefined ? Number(priority) : 3,
      stage: stage || "New",
      nextAction: nextAction ? nextAction.trim() : "",
      reminderNote: reminderNote ? reminderNote.trim() : "",
      lostReason: lostReason ? lostReason.trim() : "",
      callCount: callCount !== undefined ? Number(callCount) : 0,
      lastOutcome: initialCommentOutcome || lastOutcome || "",
      enquiryDate: enquiryDate ? new Date(enquiryDate) : new Date(),
      followUpDate: followUpDate ? new Date(followUpDate) : null,
      followUpTime: followUpTime ? normalizeTimeTo24Hour(followUpTime) : "",
      snoozedUntil: initialSnoozedUntil,
      snoozeReason: initialSnoozeReason,
      enrolledCourses: resolvedCourses,
      discountType: discountType || "none",
      discountValue: discountValue !== undefined ? Number(discountValue) : 0,
      paidAmount: paidAmount !== undefined ? Math.max(0, Number(paidAmount) || 0) : 0,
      remainingDueDate: remainingDueDate ? new Date(remainingDueDate) : null,
      paymentNotes: paymentNotes ? paymentNotes.trim() : "",
      leadScope: leadScope === "colleague_lead" ? "colleague_lead" : "my_lead",
      colleagueName: colleagueName ? colleagueName.trim() : "",
      comments: commentsList
    });

    const savedLead = await newLead.save();

    return res.status(201).json({
      success: true,
      message: "Lead created successfully.",
      data: savedLead
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Lead ID already exists. Please choose a unique Lead ID."
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to create lead: " + error.message
    });
  }
});

// PUT /api/leads/:id - Full edit of a lead
// CRITICAL SAFETY RULE: NEVER overwrite comments array!
router.put("/:id", async (req, res) => {
  try {
    const lead = await findLeadByIdOrCustomId(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found"
      });
    }

    // Explicitly delete any comments field from incoming payload to protect history
    delete req.body.comments;
    delete req.body._id;

    // Check if new leadId is being requested and conflicts with another lead
    if (req.body.leadId && req.body.leadId.trim() !== lead.leadId) {
      const duplicate = await Lead.findOne({
        leadId: req.body.leadId.trim(),
        _id: { $ne: lead._id }
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Lead ID "${req.body.leadId}" is already in use by another lead.`
        });
      }
      lead.leadId = req.body.leadId.trim();
    }

    if (req.body.name !== undefined) lead.name = req.body.name.trim();
    if (req.body.email !== undefined) lead.email = req.body.email.trim();
    if (req.body.phone !== undefined) {
      const newPhoneTrimmed = req.body.phone.trim();
      if (newPhoneTrimmed && newPhoneTrimmed !== (lead.phone || "").trim()) {
        const cleanPhoneDigits = newPhoneTrimmed.replace(/[^0-9]/g, "");
        if (cleanPhoneDigits.length >= 6) {
          const allLeadsWithPhone = await Lead.find({
            _id: { $ne: lead._id },
            phone: { $exists: true, $ne: "" }
          }).select("leadId name phone");
          const dupPhoneLead = allLeadsWithPhone.find((l) => {
            const digits = (l.phone || "").replace(/[^0-9]/g, "");
            return digits && digits === cleanPhoneDigits;
          });
          if (dupPhoneLead) {
            return res.status(400).json({
              success: false,
              message: `Phone number is already registered to Lead ${dupPhoneLead.leadId} (${dupPhoneLead.name}).`
            });
          }
        }
      }
      lead.phone = newPhoneTrimmed;
    }
    if (req.body.quality !== undefined) lead.quality = req.body.quality;
    if (req.body.source !== undefined) lead.source = req.body.source;
    if (req.body.priority !== undefined) lead.priority = Number(req.body.priority);
    if (req.body.stage !== undefined) lead.stage = req.body.stage;
    if (req.body.nextAction !== undefined) lead.nextAction = req.body.nextAction.trim();
    if (req.body.reminderNote !== undefined) lead.reminderNote = req.body.reminderNote.trim();
    if (req.body.lostReason !== undefined) lead.lostReason = req.body.lostReason.trim();
    if (req.body.callCount !== undefined) lead.callCount = Math.max(0, Number(req.body.callCount));
    if (req.body.lastOutcome !== undefined) lead.lastOutcome = req.body.lastOutcome.trim();
    if (req.body.enquiryDate !== undefined) {
      lead.enquiryDate = req.body.enquiryDate ? new Date(req.body.enquiryDate) : new Date();
    }
    if (req.body.followUpDate !== undefined) {
      if (req.body.followUpDate) {
        const san = sanitizeFollowUpDate(req.body.followUpDate, req.body.followUpTime || lead.followUpTime);
        lead.followUpDate = new Date(san.followUpDate);
      } else {
        lead.followUpDate = null;
      }
      lead.markModified("followUpDate");
    }
    if (req.body.followUpTime !== undefined) {
      lead.followUpTime = req.body.followUpTime ? normalizeTimeTo24Hour(req.body.followUpTime) : "";
      lead.markModified("followUpTime");
    }
    if (req.body.followUpDate !== undefined || req.body.followUpTime !== undefined) {
      if (lead.followUpDate) {
        const followUpDateTime = computeFollowUpDateTime(lead.followUpDate, lead.followUpTime);
        if (followUpDateTime && followUpDateTime > new Date()) {
          lead.snoozedUntil = followUpDateTime;
          lead.snoozeReason = formatFollowUpReason(followUpDateTime, lead.followUpTime);
          lead.markModified("snoozedUntil");
          lead.markModified("snoozeReason");
        } else if (lead.snoozeReason && lead.snoozeReason.startsWith("Follow-up")) {
          lead.snoozedUntil = null;
          lead.snoozeReason = "";
          lead.markModified("snoozedUntil");
          lead.markModified("snoozeReason");
        }
      } else {
        lead.followUpDate = null;
        lead.followUpTime = "";
        lead.snoozedUntil = null;
        lead.snoozeReason = "";
        lead.markModified("followUpDate");
        lead.markModified("followUpTime");
        lead.markModified("snoozedUntil");
        lead.markModified("snoozeReason");
      }
    }
    if (Array.isArray(req.body.enrolledCourses)) {
      lead.enrolledCourses = req.body.enrolledCourses;
    }
    if (req.body.discountType !== undefined) {
      lead.discountType = req.body.discountType;
    }
    if (req.body.discountValue !== undefined) {
      lead.discountValue = Number(req.body.discountValue) || 0;
    }
    if (req.body.paidAmount !== undefined) {
      lead.paidAmount = Math.max(0, Number(req.body.paidAmount) || 0);
    }
    if (req.body.remainingDueDate !== undefined) {
      lead.remainingDueDate = req.body.remainingDueDate ? new Date(req.body.remainingDueDate) : null;
    }
    if (req.body.paymentNotes !== undefined) {
      lead.paymentNotes = req.body.paymentNotes ? req.body.paymentNotes.trim() : "";
    }
    if (req.body.leadScope !== undefined) {
      lead.leadScope = req.body.leadScope;
    }
    if (req.body.colleagueName !== undefined) {
      lead.colleagueName = req.body.colleagueName.trim();
    }

    // Save so pre('save') recalculates totalFee and finalFee accurately
    const updatedLead = await lead.save();

    return res.status(200).json({
      success: true,
      message: "Lead updated successfully.",
      data: updatedLead
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update lead: " + error.message
    });
  }
});

// PATCH /api/leads/:id/quick - Quick inline update for ANY field on LeadDetail
// CRITICAL SAFETY RULE: Never overwrite past interaction comments or audit duration metrics!
router.patch("/:id/quick", async (req, res) => {
  try {
    const lead = await findLeadByIdOrCustomId(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found"
      });
    }

    const {
      name,
      phone,
      email,
      source,
      quality,
      stage,
      priority,
      nextAction,
      reminderNote,
      lostReason,
      enquiryDate,
      followUpDate,
      followUpTime,
      callCount,
      lastOutcome,
      enrolledCourses,
      discountType,
      discountValue,
      paidAmount,
      remainingDueDate,
      paymentNotes,
      leadScope,
      colleagueName,
      isVoicemailPool,
      markDone,
      clearFollowUp
    } = req.body;

    // Contact Details
    if (name !== undefined && name.trim()) {
      lead.name = name.trim();
    }

    if (phone !== undefined) {
      const newPhone = phone.trim();
      if (newPhone && newPhone !== (lead.phone || "").trim()) {
        const cleanPhoneDigits = newPhone.replace(/[^0-9]/g, "");
        if (cleanPhoneDigits.length >= 6) {
          const allLeadsWithPhone = await Lead.find({
            _id: { $ne: lead._id },
            phone: { $exists: true, $ne: "" }
          }).select("leadId name phone");
          const dupPhoneLead = allLeadsWithPhone.find((l) => {
            const digits = (l.phone || "").replace(/[^0-9]/g, "");
            return digits && digits === cleanPhoneDigits;
          });
          if (dupPhoneLead) {
            return res.status(400).json({
              success: false,
              message: `Phone number is already registered to Lead ${dupPhoneLead.leadId} (${dupPhoneLead.name}).`
            });
          }
        }
      }
      lead.phone = newPhone;
    }

    if (email !== undefined) {
      lead.email = email.trim();
    }

    if (source !== undefined && source) {
      lead.source = source;
    }

    // Pipeline & Status
    if (quality !== undefined && quality) {
      lead.quality = quality;
    }
    if (stage !== undefined && stage) {
      lead.stage = stage;
    }
    if (priority !== undefined) {
      lead.priority = Number(priority);
    }
    if (nextAction !== undefined) {
      lead.nextAction = nextAction ? nextAction.trim() : "";
    }
    if (reminderNote !== undefined) {
      lead.reminderNote = reminderNote ? reminderNote.trim() : "";
      // If user did not manually pick followUpDate in the payload, detect from note text
      if (followUpDate === undefined && lead.reminderNote) {
        const nlp = extractFollowUpFromText(lead.reminderNote);
        if (nlp.matched) {
          if (nlp.followUpDate) lead.followUpDate = new Date(nlp.followUpDate);
          if (nlp.followUpTime) lead.followUpTime = normalizeTimeTo24Hour(nlp.followUpTime);
          const fDt = computeFollowUpDateTime(lead.followUpDate, lead.followUpTime);
          if (fDt && fDt > new Date()) {
            lead.snoozedUntil = fDt;
            lead.snoozeReason = formatFollowUpReason(fDt, lead.followUpTime);
          }
          lead.markModified("followUpDate");
          lead.markModified("followUpTime");
          lead.markModified("snoozedUntil");
          lead.markModified("snoozeReason");
        }
      }
    }
    if (lostReason !== undefined) {
      lead.lostReason = lostReason ? lostReason.trim() : "";
    }
    if (enquiryDate !== undefined) {
      lead.enquiryDate = enquiryDate ? new Date(enquiryDate) : lead.enquiryDate;
    }

    // Follow-up Appointment Updates
    if (clearFollowUp) {
      lead.followUpDate = null;
      lead.followUpTime = "";
      lead.snoozedUntil = null;
      lead.snoozeReason = "";
      lead.markModified("followUpDate");
      lead.markModified("followUpTime");
      lead.markModified("snoozedUntil");
      lead.markModified("snoozeReason");
      if (!Array.isArray(lead.comments)) lead.comments = [];
      lead.comments.push({
        commentId: "COM-" + Date.now() + "-" + Math.floor(1000 + Math.random() * 9000),
        text: "✕ Follow-up appointment cleared",
        outcome: "Follow-up Cleared",
        addedAt: new Date(),
        updatedAt: new Date()
      });
    } else if (markDone) {
      lead.lastCallDate = new Date();
      if (lead.stage === "New") {
        lead.stage = "Contacted";
      }
      lead.lastOutcome = "Follow-up Completed";
      lead.followUpDate = null;
      lead.followUpTime = "";
      lead.snoozedUntil = null;
      lead.snoozeReason = "";
      lead.markModified("followUpDate");
      lead.markModified("followUpTime");
      lead.markModified("snoozedUntil");
      lead.markModified("snoozeReason");
      if (!Array.isArray(lead.comments)) lead.comments = [];
      lead.comments.push({
        commentId: "COM-" + Date.now() + "-" + Math.floor(1000 + Math.random() * 9000),
        text: "✓ Follow-up marked as completed",
        outcome: "Follow-up Completed",
        addedAt: new Date(),
        updatedAt: new Date()
      });
    } else {
      if (followUpDate !== undefined) {
        if (followUpDate) {
          const san = sanitizeFollowUpDate(followUpDate, followUpTime || lead.followUpTime);
          lead.followUpDate = new Date(san.followUpDate);
        } else {
          lead.followUpDate = null;
        }
        lead.markModified("followUpDate");
      }
      if (followUpTime !== undefined) {
        lead.followUpTime = followUpTime ? normalizeTimeTo24Hour(followUpTime) : "";
        lead.markModified("followUpTime");
      }
      if (followUpDate !== undefined || followUpTime !== undefined) {
        if (lead.followUpDate) {
          const followUpDateTime = computeFollowUpDateTime(lead.followUpDate, lead.followUpTime);
          if (followUpDateTime && followUpDateTime > new Date()) {
            lead.snoozedUntil = followUpDateTime;
            lead.snoozeReason = formatFollowUpReason(followUpDateTime, lead.followUpTime);
            lead.markModified("snoozedUntil");
            lead.markModified("snoozeReason");
          } else if (lead.snoozeReason && lead.snoozeReason.startsWith("Follow-up")) {
            lead.snoozedUntil = null;
            lead.snoozeReason = "";
            lead.markModified("snoozedUntil");
            lead.markModified("snoozeReason");
          }
        } else {
          lead.followUpDate = null;
          lead.followUpTime = "";
          lead.snoozedUntil = null;
          lead.snoozeReason = "";
          lead.markModified("followUpDate");
          lead.markModified("followUpTime");
          lead.markModified("snoozedUntil");
          lead.markModified("snoozeReason");
        }
      }
    }

    // Courses & Financials
    if (enrolledCourses !== undefined && Array.isArray(enrolledCourses)) {
      lead.enrolledCourses = enrolledCourses;
    }
    if (discountType !== undefined) {
      lead.discountType = discountType;
    }
    if (discountValue !== undefined) {
      lead.discountValue = Number(discountValue) || 0;
    }
    if (paidAmount !== undefined) {
      lead.paidAmount = Math.max(0, Number(paidAmount) || 0);
    }
    if (remainingDueDate !== undefined) {
      lead.remainingDueDate = remainingDueDate ? new Date(remainingDueDate) : null;
    }
    if (paymentNotes !== undefined) {
      lead.paymentNotes = paymentNotes ? paymentNotes.trim() : "";
    }

    // Lead Scope & Colleague Holding Pool
    if (leadScope !== undefined) {
      lead.leadScope = leadScope;
    }
    if (colleagueName !== undefined) {
      lead.colleagueName = colleagueName.trim();
    }

    // Voicemail Pool Status
    if (isVoicemailPool !== undefined) {
      lead.isVoicemailPool = Boolean(isVoicemailPool);
    }

    // Call Count & Last Outcome
    if (callCount !== undefined) {
      lead.callCount = Math.max(0, Number(callCount));
    }
    if (lastOutcome !== undefined) {
      lead.lastOutcome = lastOutcome ? lastOutcome.trim() : "";
    }

    // Pre-save hook will automatically recalculate totalFee and finalFee!
    const updatedLead = await lead.save();

    return res.status(200).json({
      success: true,
      message: "Lead updated successfully.",
      data: updatedLead
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update lead: " + error.message
    });
  }
});

// POST /api/leads/:id/clear-followup - 1-Click Clear Follow-up Date and Time
router.post("/:id/clear-followup", async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }
    lead.followUpDate = null;
    lead.followUpTime = "";
    lead.snoozedUntil = null;
    lead.snoozeReason = "";
    lead.markModified("followUpDate");
    lead.markModified("followUpTime");
    lead.markModified("snoozedUntil");
    lead.markModified("snoozeReason");
    if (!Array.isArray(lead.comments)) lead.comments = [];
    lead.comments.push({
      commentId: "COM-" + Date.now() + "-" + Math.floor(1000 + Math.random() * 9000),
      text: "✕ Follow-up appointment cleared",
      outcome: "Follow-up Cleared",
      addedAt: new Date(),
      updatedAt: new Date()
    });
    const updatedLead = await lead.save();
    return res.status(200).json({
      success: true,
      message: "Follow-up cleared successfully.",
      data: updatedLead
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to clear follow-up: " + error.message
    });
  }
});

// POST /api/leads/:id/call - Log an outgoing call trigger (e.g. via Ozonetel)
// Increments callCount and automatically appends a call interaction into comments
router.post("/:id/call", async (req, res) => {
  try {
    const lead = await findLeadByIdOrCustomId(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found"
      });
    }

    const newCallCount = (lead.callCount || 0) + 1;
    const phoneDisplay = lead.phone || "provided number";

    const callComment = {
      commentId: "COM-" + Date.now() + "-" + Math.floor(1000 + Math.random() * 9000),
      text: req.body.note || `📞 Outgoing call triggered via Ozonetel to ${phoneDisplay}`,
      outcome: req.body.outcome || "Call Triggered",
      addedAt: new Date(),
      updatedAt: new Date()
    };

    const updateFields = {
      $inc: { callCount: 1 },
      $push: { comments: callComment },
      $set: { lastOutcome: req.body.outcome || "Call Triggered" }
    };

    const updatedLead = await Lead.findByIdAndUpdate(lead._id, updateFields, {
      new: true,
      runValidators: true
    });

    return res.status(200).json({
      success: true,
      message: `Call #${newCallCount} logged successfully.`,
      data: updatedLead,
      comment: callComment
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to log call: " + error.message
    });
  }
});

// POST /api/leads/:id/comments - Add an interaction comment
// Uses MongoDB $push to append to comments array permanently

// POST /api/leads/:id/call-log - Detailed call logger with duration, outcome, and snooze
router.post("/:id/call-log", async (req, res) => {
  try {
    const lead = await findLeadByIdOrCustomId(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    const {
      duration = 0,
      outcome = "Voicemail Connected",
      snoozeDays = null,
      customNote = "",
      stage = null,
      quality = null,
      isVoicemailPool = null,
      followUpDate = null,
      followUpTime = null
    } = req.body;

    const callSecs = Math.max(0, parseInt(duration, 10) || 0);
    const durationFormatted = callSecs >= 60
      ? `${Math.floor(callSecs / 60)}m ${callSecs % 60}s`
      : `${callSecs}s`;

    let commentText = `📞 Call Outcome: ${outcome} (Duration: ${callSecs}s / ${durationFormatted})`;
    if (customNote && customNote.trim()) {
      commentText += `\nNote: ${customNote.trim()}`;
    }

    const callComment = {
      commentId: "COM-" + Date.now() + "-" + Math.floor(1000 + Math.random() * 9000),
      text: commentText,
      outcome: outcome,
      addedAt: new Date(),
      updatedAt: new Date()
    };

    const updateFields = {
      $inc: { callCount: 1, totalTalkTime: callSecs },
      $push: { comments: callComment },
      $set: {
        lastOutcome: outcome,
        lastCallDate: new Date(),
        lastCallDuration: callSecs
      }
    };

    // 1. If explicit follow-up scheduled in this call log
    if (followUpDate) {
      const san = sanitizeFollowUpDate(followUpDate, followUpTime || lead.followUpTime);
      const parsedFollowUpDate = new Date(san.followUpDate);
      updateFields.$set.followUpDate = parsedFollowUpDate;
      const targetTime = san.followUpTime || (followUpTime !== null && followUpTime !== undefined ? normalizeTimeTo24Hour(followUpTime) : normalizeTimeTo24Hour(lead.followUpTime || ""));
      updateFields.$set.followUpTime = targetTime;
      const followUpDateTime = computeFollowUpDateTime(parsedFollowUpDate, targetTime);
      if (followUpDateTime && followUpDateTime > new Date()) {
        updateFields.$set.snoozedUntil = followUpDateTime;
        updateFields.$set.snoozeReason = formatFollowUpReason(followUpDateTime, targetTime);
      }
    } else if (snoozeDays && Number(snoozeDays) > 0) {
      // 2. If snooze requested by days count (e.g. 2, 30, 45 days or custom timeout)
      const daysCount = Number(snoozeDays);
      const snoozeDate = new Date(Date.now() + daysCount * 86400000);
      updateFields.$set.snoozedUntil = snoozeDate;
      const daysLabel = daysCount === 1 ? "1 Day" : `${daysCount} Days`;
      let reasonLabel = `${outcome} (${daysLabel} Cooldown)`;
      if (outcome.toLowerCase().includes("disconnect")) {
        reasonLabel = `Picked & Disconnected (${daysLabel} Cooldown)`;
      } else if (customNote && customNote.trim()) {
        reasonLabel = `${outcome} (${daysLabel} - ${customNote.trim()})`;
      }
      updateFields.$set.snoozeReason = reasonLabel;
      // Cooldown Guard: When placing on snooze cooldown, clear any old/expired follow-up schedule
      updateFields.$set.followUpDate = null;
      updateFields.$set.followUpTime = "";
    } else if (!snoozeDays && lead.followUpDate) {
      // 3. If no new snooze specified, but this lead already has a scheduled future follow-up, KEEP SNOOZED till that date!
      const followUpDateTime = computeFollowUpDateTime(lead.followUpDate, lead.followUpTime);
      if (followUpDateTime && followUpDateTime > new Date()) {
        updateFields.$set.snoozedUntil = followUpDateTime;
        updateFields.$set.snoozeReason = formatFollowUpReason(followUpDateTime, lead.followUpTime);
      }
    }

    if (stage) {
      updateFields.$set.stage = stage;
    }
    if (quality) {
      updateFields.$set.quality = quality;
    }
    if (isVoicemailPool !== null) {
      updateFields.$set.isVoicemailPool = Boolean(isVoicemailPool);
    }

    const updated = await Lead.findByIdAndUpdate(lead._id, updateFields, {
      new: true,
      runValidators: true
    });

    return res.status(200).json({
      success: true,
      message: `Call logged: ${outcome} (${durationFormatted})`,
      data: updated,
      loggedDurationSeconds: callSecs
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/leads/:id/snooze - Snooze or unsnooze a lead
router.post("/:id/snooze", async (req, res) => {
  try {
    const lead = await findLeadByIdOrCustomId(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    const { days = 30, reason, unsnooze = false } = req.body;

    let update = {};
    if (unsnooze) {
      update = { $set: { snoozedUntil: null, snoozeReason: "UNSNOOZED_MANUAL" } };
    } else {
      const numDays = Number(days) || 30;
      const snoozedUntil = new Date(Date.now() + numDays * 86400000);
      const defaultReason = numDays === 2
        ? "Picked & Disconnected (2 Days Cooldown)"
        : `Snoozed for ${numDays} days`;
      update = {
        $set: {
          snoozedUntil,
          snoozeReason: reason || defaultReason,
          followUpDate: null,
          followUpTime: ""
        }
      };
    }

    const updated = await Lead.findByIdAndUpdate(lead._id, update, { new: true });
    return res.status(200).json({
      success: true,
      message: unsnooze ? "Lead unsnoozed and returned to queue." : `Lead snoozed for ${days} days.`,
      data: updated
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/leads/:id/voicemail-toggle - Add or remove lead from Voicemail Pool
router.post("/:id/voicemail-toggle", async (req, res) => {
  try {
    const lead = await findLeadByIdOrCustomId(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    // Explicit status if provided, otherwise toggle based on current isVoicemailPool
    const newStatus = req.body.status !== undefined
      ? Boolean(req.body.status)
      : !Boolean(lead.isVoicemailPool);

    const update = {
      isVoicemailPool: newStatus
    };

    if (newStatus) {
      if (lead.quality !== "Voicemail") {
        update.quality = "Voicemail";
      }
    } else {
      // Revert quality if it was Voicemail so lead doesn't stay stuck as Voicemail
      if (lead.quality === "Voicemail") {
        update.quality = "Call Again";
      }
    }

    const updated = await Lead.findByIdAndUpdate(lead._id, { $set: update }, { new: true });
    return res.status(200).json({
      success: true,
      isVoicemailPool: newStatus,
      message: newStatus ? "Added to Voicemail Hub." : "Removed from Voicemail Hub.",
      data: updated
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/:id/comments", async (req, res) => {
  try {
    const { text, outcome } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Comment text is required."
      });
    }

    const lead = await findLeadByIdOrCustomId(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found"
      });
    }

    const newComment = {
      commentId: "COM-" + Date.now() + "-" + Math.floor(1000 + Math.random() * 9000),
      text: text.trim(),
      outcome: outcome ? outcome.trim() : "",
      addedAt: new Date(),
      updatedAt: new Date()
    };

    if (!Array.isArray(lead.comments)) lead.comments = [];
    lead.comments.push(newComment);

    if (outcome && outcome.trim() !== "") {
      lead.lastOutcome = outcome.trim();
    }

    // AI Follow-up Understanding: If counselor mentions when to take follow-up in the comment
    const nlpFollowUp = extractFollowUpFromText(text.trim());
    let autoFollowUpScheduled = false;

    if (nlpFollowUp.matched) {
      if (nlpFollowUp.followUpDate) {
        lead.followUpDate = new Date(nlpFollowUp.followUpDate);
        lead.markModified("followUpDate");
      }
      if (nlpFollowUp.followUpTime) {
        lead.followUpTime = normalizeTimeTo24Hour(nlpFollowUp.followUpTime);
        lead.markModified("followUpTime");
      }
      const fDt = computeFollowUpDateTime(lead.followUpDate, lead.followUpTime);
      if (fDt && fDt > new Date()) {
        lead.snoozedUntil = fDt;
        lead.snoozeReason = formatFollowUpReason(fDt, lead.followUpTime);
        lead.markModified("snoozedUntil");
        lead.markModified("snoozeReason");
      }
      if (!lead.stage || lead.stage === "New") {
        lead.stage = "Contacted";
        lead.markModified("stage");
      }
      lead.nextAction = `Follow-up: ${text.slice(0, 45).trim()}`;
      lead.markModified("nextAction");
      autoFollowUpScheduled = true;
    }

    const updatedLead = await lead.save();

    return res.status(201).json({
      success: true,
      message: autoFollowUpScheduled
        ? `Interaction added and follow-up scheduled for ${lead.followUpDate ? lead.followUpDate.toISOString().split("T")[0] : ""} at ${formatTime12(lead.followUpTime)}!`
        : "Interaction added.",
      data: updatedLead,
      comment: newComment,
      autoFollowUpScheduled
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to add interaction: " + error.message
    });
  }
});

// POST /api/leads/:id/record-payment - Record payment (token/partial/full) with payment mode, remaining due date, and audit comment
router.post("/:id/record-payment", async (req, res) => {
  try {
    const lead = await findLeadByIdOrCustomId(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    const {
      amount, // Amount received in this transaction (or new total paid)
      isIncremental = true, // If true, adds to existing paidAmount; if false, sets absolute paidAmount
      remainingDueDate, // YYYY-MM-DD or null
      paymentNotes, // e.g. "UPI / GPay / Netbanking"
      courseName // Optional specific course for which payment was made
    } = req.body;

    const parsedAmount = Math.max(0, Number(amount) || 0);
    const prevPaid = Number(lead.paidAmount) || 0;
    const newPaidAmount = isIncremental ? (prevPaid + parsedAmount) : parsedAmount;

    lead.paidAmount = newPaidAmount;
    if (remainingDueDate !== undefined) {
      lead.remainingDueDate = remainingDueDate ? new Date(remainingDueDate) : null;
    }
    if (paymentNotes !== undefined) {
      lead.paymentNotes = paymentNotes ? paymentNotes.trim() : "";
    }

    // Lead Scope & Colleague Holding Pool
    if (leadScope !== undefined) {
      lead.leadScope = leadScope;
    }
    if (colleagueName !== undefined) {
      lead.colleagueName = colleagueName.trim();
    }

    // Auto-update stage if token or full paid
    if (newPaidAmount >= (lead.finalFee || lead.totalFee) && (lead.finalFee || lead.totalFee) > 0) {
      if (lead.stage !== "Converted") {
        lead.stage = "Converted";
      }
    } else if (newPaidAmount > 0 && lead.stage === "New") {
      lead.stage = "Interested";
    }

    // Append structured payment comment to interaction history
    const finalFee = lead.finalFee || lead.totalFee || 0;
    const balance = Math.max(0, finalFee - newPaidAmount);
    const pct = finalFee > 0 ? Math.round((newPaidAmount / finalFee) * 100) : 100;
    const statusLabel = newPaidAmount >= finalFee && finalFee > 0
      ? "Full Payment Received"
      : `Token / Partial Payment (${pct}%)`;

    const receivedStr = isIncremental
      ? `Received ₹${parsedAmount.toLocaleString("en-IN")}`
      : `Updated Total Paid: ₹${newPaidAmount.toLocaleString("en-IN")}`;

    let commentText = `💰 Payment Logged: ${receivedStr}`;
    if (courseName) commentText += ` for ${courseName}`;
    commentText += `\nTotal Paid: ₹${newPaidAmount.toLocaleString("en-IN")} / ₹${finalFee.toLocaleString("en-IN")} (${pct}%)`;
    if (balance > 0) {
      commentText += `\nRemaining Balance: ₹${balance.toLocaleString("en-IN")}`;
      if (lead.remainingDueDate) {
        const dueStr = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(lead.remainingDueDate));
        commentText += ` (Due: ${dueStr})`;
      }
    } else {
      commentText += `\nStatus: Fully Cleared (No balance due)`;
    }
    if (paymentNotes && paymentNotes.trim()) {
      commentText += `\nPayment Mode / Notes: ${paymentNotes.trim()}`;
    }

    const paymentComment = {
      commentId: "PAY-" + Date.now() + "-" + Math.floor(1000 + Math.random() * 9000),
      text: commentText,
      outcome: statusLabel,
      addedAt: new Date(),
      updatedAt: new Date()
    };

    if (!Array.isArray(lead.comments)) lead.comments = [];
    lead.comments.push(paymentComment);

    const saved = await lead.save();

    return res.status(200).json({
      success: true,
      message: `Payment saved: ₹${parsedAmount.toLocaleString("en-IN")}. Balance: ₹${saved.balanceAmount.toLocaleString("en-IN")}`,
      data: saved
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to record payment: " + error.message });
  }
});

// POST /api/leads/:id/claim-lead - 1-Click claim and transfer colleague's lead into personal active pipeline
router.post("/:id/claim-lead", async (req, res) => {
  try {
    const lead = await findLeadByIdOrCustomId(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    const prevOwner = lead.colleagueName || "Colleague";
    const notes = (req.body.notes || "").trim();

    lead.leadScope = "my_lead";
    lead.claimedAt = new Date();
    if (notes) lead.claimedNotes = notes;

    const claimComment = {
      commentId: "CLM-" + Date.now() + "-" + Math.floor(1000 + Math.random() * 9000),
      text: `⚡ Lead Claimed: Transferred from colleague (${prevOwner}) into personal active pipeline.${notes ? `\nReason / Note: ${notes}` : ""}`,
      outcome: "Lead Claimed",
      addedAt: new Date(),
      updatedAt: new Date()
    };

    if (!Array.isArray(lead.comments)) lead.comments = [];
    lead.comments.push(claimComment);

    const saved = await lead.save();

    return res.status(200).json({
      success: true,
      message: `Lead successfully claimed and transferred to your personal pipeline from ${prevOwner}.`,
      data: saved
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to claim lead: " + error.message });
  }
});

// PATCH /api/leads/:id/comments/:commentId - Edit individual comment
router.patch("/:id/comments/:commentId", async (req, res) => {
  try {
    const { text, outcome } = req.body;
    const { commentId } = req.params;

    if (!text || text.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Comment text cannot be empty."
      });
    }

    const lead = await findLeadByIdOrCustomId(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found"
      });
    }

    const existingComment = (lead.comments || []).find((c) => c.commentId === commentId);
    if (!existingComment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found"
      });
    }

    const updatedLead = await Lead.findOneAndUpdate(
      { _id: lead._id, "comments.commentId": commentId },
      {
        $set: {
          "comments.$.text": text.trim(),
          "comments.$.outcome": outcome !== undefined ? outcome.trim() : existingComment.outcome,
          "comments.$.updatedAt": new Date()
        }
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Interaction updated.",
      data: updatedLead
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update comment: " + error.message
    });
  }
});

// DELETE /api/leads/:id/comments/:commentId - Delete individual comment
router.delete("/:id/comments/:commentId", async (req, res) => {
  try {
    const { commentId } = req.params;

    const lead = await findLeadByIdOrCustomId(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found"
      });
    }

    const updatedLead = await Lead.findByIdAndUpdate(
      lead._id,
      {
        $pull: { comments: { commentId: commentId } }
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Interaction deleted.",
      data: updatedLead
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete comment: " + error.message
    });
  }
});

// DELETE /api/leads/:id - Delete full lead
router.delete("/:id", async (req, res) => {
  try {
    const lead = await findLeadByIdOrCustomId(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found"
      });
    }

    await Lead.findByIdAndDelete(lead._id);

    return res.status(200).json({
      success: true,
      message: `Lead ${lead.name} deleted successfully.`
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete lead: " + error.message
    });
  }
});

module.exports = router;
