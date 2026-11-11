const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const Setting = require("../models/Setting");
const Course = require("../models/Course");

// Helper to find a lead by MongoDB _id or custom leadId
const findLeadByIdOrCustomId = async (idParam) => {
  if (mongoose.Types.ObjectId.isValid(idParam)) {
    const lead = await Lead.findById(idParam);
    if (lead) return lead;
  }
  return await Lead.findOne({ leadId: idParam });
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
// 1. gemini-3.5-flash-lite: Engineered for ultra-low latency OCR & high speed
// 2. gemini-3.5-flash: High accuracy backup
// 3. Additional models with separate daily quotas
const GEMINI_VISION_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest"
];

// Helper to sanitize and normalize extracted lead data from AI
function sanitizeExtractedLead(raw) {
  if (!raw || typeof raw !== "object") return raw;
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
      maxOutputTokens: 600
    }
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload)
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
    return { ok: true, data: sanitizeExtractedLead(parsed), modelUsed: `Gemini (${model})` };
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return { ok: true, data: sanitizeExtractedLead(JSON.parse(match[0])), modelUsed: `Gemini (${model})` };
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
    const image = req.body.image || req.body.imageBase64;
    if (!image) {
      return res.status(400).json({
        success: false,
        message: "No image data provided."
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

// Modern Gemini text models for conversational CRM instruction parsing
const GEMINI_TEXT_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
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
      maxOutputTokens: 3000
    }
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload)
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
    try {
      const dbCourses = await Course.find({ active: true }).select("name fee").lean();
      availableCourses = dbCourses.map((c) => `${c.name} (Fee: ₹${c.fee})`);
    } catch (e) {
      // Graceful fallback
    }

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
      followUpDate: lead.followUpDate ? lead.followUpDate.toISOString().split("T")[0] : null,
      followUpTime: lead.followUpTime || "",
      nextAction: lead.nextAction || "",
      reminderNote: lead.reminderNote || "",
      lostReason: lead.lostReason || "",
      enrolledCourses: (lead.enrolledCourses || []).map((c) => c.courseName),
      discountType: lead.discountType || "none",
      discountValue: lead.discountValue || 0,
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
  * Map course abbreviations intelligently:
    - "SSBB" -> "Six Sigma Black Belt (SSBB)"
    - "SSGB" -> "Six Sigma Green Belt (SSGB)"
    - "LSSBB" -> "Lean Six Sigma Black Belt (LSSBB)"
    - "LSSGB" -> "Lean Six Sigma Green Belt (LSSGB)"
  * If a course is present in the note/JSON and current lead has no courses or placeholder "General Course", propose updating addCourse!
- stage: ["New", "Contacted", "Interested", "Negotiation", "Converted", "Lost"]
  * Note on stage: The official stages are "New", "Contacted", "Interested", "Negotiation", "Converted", "Lost". If a callback or follow-up is scheduled and current stage is "New", set stage to "Contacted" (do NOT output "Follow-up Scheduled" as stage - put the follow-up date in followUpDate and time in followUpTime!). If current stage is already "Contacted", "Interested", or "Negotiation", keep that existing stage.
  * If student enrolled/joined/admitted: set stage to "Converted".
  * If student said not interested / drop: set stage to "Lost".
- quality: ["Hot Lead", "Warm Lead", "Cold Lead", "Call Again", "Voicemail", "Converted/Customer", "Not Interested", "Wrong number"]
  * Map from "lead_quality" or "quality" (e.g. "Call Again", "Warm Lead", "Hot Lead", etc.).
- priority: 1 (High/Urgent), 2 (Medium), 3 (Standard)
- followUpDate: YYYY-MM-DD format.
  * If the input provides an explicit timestamp or date (such as "followuptime": "2026-05-02 21:21:00" or "2026-11-10 14:00:00" or "10/11/2026"), extract the date in YYYY-MM-DD format (e.g. "2026-05-02").
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
- discountType: "percentage" | "flat" | "none"
- discountValue: number
- paidAmount: number (Total amount paid by student so far, token amount, advance, or full payment. E.g. if counselor says "paid 5000 token" -> 5000. If "paid 60%", calculate 60% of finalFee. If "paid full", set to finalFee).
- remainingDueDate: YYYY-MM-DD format (Date when student promised or agreed to pay the remaining balance/installment).
- paymentNotes: text (Notes on payment method, UPI reference, or installment terms, e.g. "Token paid via UPI, remaining on 25th").
- snoozeDays: number of days to snooze/cooldown (if mentioned, e.g. 2, 30, 45).
- comment: a clean, professional summary of what transpired or what was decided, to log in the interaction history.
  * When HTML or multi-call logs are in "desc" or notes, strip all HTML tags and summarize the call history and latest notes into a readable summary!

SPECIAL INSTRUCTIONS FOR RAW JSON / CRM RECORD DUMPS:
When the counselor pastes a JSON block, key-value export, or CRM record (which may have fields like id, member_id, email, mobile, course, lead_quality, painarea, followuptime, description, name, desc):
- YOU MUST EXTRACT EVERY SINGLE AVAILABLE PIECE OF INFORMATION AND PROPOSE CHANGES FOR ALL APPLICABLE FIELDS:
  1. 'leadId': from 'id' / 'repeat_id' / 'lead_id' if different from current leadId.
  2. 'name': from 'name' if different from current name (e.g. replaces placeholder "Voicemail Lead - ...").
  3. 'phone': from 'mobile' / 'phone' if different from current phone.
  4. 'alternatePhone': from 'alt_mobile' if provided and not null.
  5. 'email': from 'email' if provided.
  6. 'addCourse': from 'course' (map abbreviations like 'SSBB' -> 'Six Sigma Black Belt (SSBB)').
  7. 'quality': from 'lead_quality' or 'quality'.
  8. 'reminderNote': from 'painarea' and/or 'description' (e.g. 'Need Followup - switched off NOT NOW').
  9. 'nextAction': from 'painarea' or follow-up action (e.g. 'Need Followup').
  10. 'followUpDate' and 'followUpTime': from 'followuptime' (e.g. "2026-05-02 21:21:00" -> followUpDate: "2026-05-02", followUpTime: "21:21").
  11. 'comment': from 'desc' and/or 'description' (clean text without HTML tags, providing a clear summary of recent call history and latest notes).
- Do NOT skip fields because they look like raw JSON keys. Treat every key in the pasted data as an intentional update instruction!
- Only omit a field if its value is null, empty, or already completely identical to currentValue.

CRITICAL INSTRUCTIONS:
1. Propose all fields that the counselor provided or intended to update.
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

        if (change.field === "leadId") change.label = change.label || "Lead ID";
        if (change.field === "addCourse") change.label = change.label || "Course Interested";
        if (change.field === "reminderNote") change.label = change.label || "Pinned Reminder Note";
        if (change.field === "nextAction") change.label = change.label || "Next Action";
        if (change.field === "comment") change.label = change.label || "Interaction Comment";
        if (change.field === "followUpDate") change.label = change.label || "Follow-up Date";
        if (change.field === "followUpTime") {
          change.label = change.label || "Follow-up Time";
          if (change.newValue) {
            change.newValue = normalizeTimeTo24Hour(change.newValue);
          }
        }
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
      lead.followUpDate = updates.followUpDate ? new Date(updates.followUpDate) : null;
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
    if (updates.discountType) lead.discountType = updates.discountType;
    if (updates.discountValue !== undefined) lead.discountValue = Number(updates.discountValue) || 0;

    const courseToAdd = updates.addCourse || updates.course;
    if (courseToAdd && String(courseToAdd).trim()) {
      const courseName = String(courseToAdd).trim();
      if (!Array.isArray(lead.enrolledCourses)) lead.enrolledCourses = [];

      // If enrolledCourses currently only has a placeholder "General Course", replace it
      if (
        lead.enrolledCourses.length === 1 &&
        lead.enrolledCourses[0].courseName &&
        lead.enrolledCourses[0].courseName.toLowerCase().includes("general course")
      ) {
        lead.enrolledCourses = [];
      }

      const existing = lead.enrolledCourses.some(
        (c) => c.courseName && c.courseName.toLowerCase() === courseName.toLowerCase()
      );
      if (!existing) {
        let courseFee = 0;
        try {
          const matchCourse = await Course.findOne({
            name: { $regex: new RegExp(`^${courseName}$`, "i") }
          });
          if (matchCourse) courseFee = matchCourse.fee || 0;
        } catch (e) {}

        lead.enrolledCourses.push({
          courseId: "CRS-" + Date.now(),
          courseName: courseName,
          fee: courseFee
        });
        lead.markModified("enrolledCourses");
      }
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
      lead.leadScope = updates.leadScope;
      lead.markModified("leadScope");
    }
    if (updates.colleagueName !== undefined) {
      lead.colleagueName = String(updates.colleagueName).trim();
      lead.markModified("colleagueName");
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
      enrolledCourses: Array.isArray(enrolledCourses) ? enrolledCourses : [],
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
      lead.followUpDate = req.body.followUpDate ? new Date(req.body.followUpDate) : null;
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
        lead.followUpDate = followUpDate ? new Date(followUpDate) : null;
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
      const parsedFollowUpDate = new Date(followUpDate);
      updateFields.$set.followUpDate = parsedFollowUpDate;
      const targetTime = followUpTime !== null && followUpTime !== undefined ? normalizeTimeTo24Hour(followUpTime) : normalizeTimeTo24Hour(lead.followUpTime || "");
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

    const updateFields = {
      $push: { comments: newComment }
    };

    if (outcome && outcome.trim() !== "") {
      updateFields.$set = { lastOutcome: outcome.trim() };
    }

    const updatedLead = await Lead.findByIdAndUpdate(lead._id, updateFields, {
      new: true,
      runValidators: true
    });

    return res.status(201).json({
      success: true,
      message: "Interaction added.",
      data: updatedLead,
      comment: newComment
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
