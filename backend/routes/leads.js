const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Lead = require("../models/Lead");

// Helper to find a lead by MongoDB _id or custom leadId
const findLeadByIdOrCustomId = async (idParam) => {
  if (mongoose.Types.ObjectId.isValid(idParam)) {
    const lead = await Lead.findById(idParam);
    if (lead) return lead;
  }
  return await Lead.findOne({ leadId: idParam });
};

// GET /api/leads - Return all leads, newest first
router.get("/", async (req, res) => {
  try {
    const leads = await Lead.find({}).sort({ createdAt: -1 });
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
  "gemini-3.6-flash",
  "gemini-3.5-flash",
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
    const { image } = req.body;
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
- quality: string (map to one of: "Hot Lead", "Warm Lead", "Cold Lead", "Call Again", "Converted/Customer", "Not Interested", "Wrong number", "Wrong Mail", or null)
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
      initialCommentText,
      initialCommentOutcome
    } = req.body;

    if (!leadId || !name) {
      return res.status(400).json({
        success: false,
        message: "leadId and name are required fields"
      });
    }

    const existingLead = await Lead.findOne({ leadId: leadId.trim() });
    if (existingLead) {
      return res.status(400).json({
        success: false,
        message: `Lead ID "${leadId}" already exists. Please choose a unique Lead ID.`
      });
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

    const newLead = new Lead({
      leadId: leadId.trim(),
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
      followUpTime: followUpTime ? followUpTime.trim() : "",
      enrolledCourses: Array.isArray(enrolledCourses) ? enrolledCourses : [],
      discountType: discountType || "none",
      discountValue: discountValue !== undefined ? Number(discountValue) : 0,
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
    }
    if (req.body.followUpTime !== undefined) {
      lead.followUpTime = req.body.followUpTime ? req.body.followUpTime.trim() : "";
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

// PATCH /api/leads/:id/quick - Quick inline update
// Allowed fields: followUpDate, followUpTime, quality, stage, priority, callCount
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
      followUpDate,
      followUpTime,
      quality,
      stage,
      priority,
      callCount,
      reminderNote,
      lastOutcome,
      markDone
    } = req.body;

    if (followUpDate !== undefined) {
      lead.followUpDate = followUpDate ? new Date(followUpDate) : null;
    }
    if (followUpTime !== undefined) {
      lead.followUpTime = followUpTime ? followUpTime.trim() : "";
    }
    if (quality !== undefined) {
      lead.quality = quality;
    }
    if (stage !== undefined) {
      lead.stage = stage;
    }
    if (priority !== undefined) {
      lead.priority = Number(priority);
    }
    if (callCount !== undefined) {
      lead.callCount = Math.max(0, Number(callCount));
    }
    if (reminderNote !== undefined) {
      lead.reminderNote = reminderNote ? reminderNote.trim() : "";
    }
    if (lastOutcome !== undefined) {
      lead.lastOutcome = lastOutcome ? lastOutcome.trim() : "";
    }
    if (markDone) {
      lead.lastCallDate = new Date();
      if (lead.stage === "New") {
        lead.stage = "Contacted";
      }
      lead.lastOutcome = "Follow-up Completed";
      lead.followUpDate = null;
      lead.followUpTime = "";
      if (!Array.isArray(lead.comments)) lead.comments = [];
      lead.comments.push({
        commentId: "COM-" + Date.now() + "-" + Math.floor(1000 + Math.random() * 9000),
        text: "✓ Follow-up marked as completed",
        outcome: "Follow-up Completed",
        addedAt: new Date(),
        updatedAt: new Date()
      });
    }

    const updatedLead = await lead.save();

    return res.status(200).json({
      success: true,
      message: "Lead updated successfully.",
      data: updatedLead
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to quick-update lead: " + error.message
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
