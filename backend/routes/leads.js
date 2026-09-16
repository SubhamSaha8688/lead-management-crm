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

// POST /api/leads/extract-from-image - Extract lead fields from screenshot using Gemini Flash Vision
router.post("/extract-from-image", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({
        success: false,
        message: "No image data provided."
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "GEMINI_API_KEY is not configured on the backend server. Please add it to environment variables."
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
- phone: string (clean 10-digit mobile number, exclude country code +91 or letters, or null)
- courseName: string (exact course name, e.g. "Lean Six Sigma Black Belt Course", or null)
- quality: string (map to one of: "Hot Lead", "Warm Lead", "Cold Lead", "Call Again", "Converted/Customer", "Not Interested", "Wrong number", "Wrong Mail", or null)
- stage: string (map to: "New", "Contacted", "Interested", "Negotiation", "Converted", "Lost", or "New")
- followUpDate: string (YYYY-MM-DD format if present, convert DD-MM-YYYY or similar to YYYY-MM-DD, or null)
- followUpTime: string (HH:MM in 24-hour format if present, or null)
- reminderNote: string (notes like Pain Area, Description, or Comments visible, or null)
- language: string (e.g. "English", or null)
- source: string (e.g. "Website" or other if visible, or null)`;

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
        responseMimeType: "application/json"
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload)
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini Vision API error:", response.status, errText);
      return res.status(response.status).json({
        success: false,
        message: `Gemini API returned status ${response.status}: ${errText}`
      });
    }

    const geminiData = await response.json();
    const candidateText =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return res.status(500).json({
        success: false,
        message: "No content returned from Gemini Vision model."
      });
    }

    let parsed = {};
    try {
      parsed = JSON.parse(candidateText);
    } catch (e) {
      const match = candidateText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error("Could not parse JSON from Gemini response: " + candidateText);
      }
    }

    return res.status(200).json({
      success: true,
      data: parsed
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

    const { followUpDate, followUpTime, quality, stage, priority, callCount } = req.body;

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
