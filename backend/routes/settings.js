const express = require("express");
const router = express.Router();
const Setting = require("../models/Setting");
const Lead = require("../models/Lead");

// Helper to get local date key in YYYY-MM-DD format
function getTodayDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Helper to convert "HH:mm" to minutes from midnight
function timeToMinutes(timeStr) {
  if (!timeStr || !timeStr.includes(":")) return 0;
  const parts = timeStr.split(":");
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

// Helper to convert minutes from midnight to 12-hour display string
function minutesToTime12(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${String(displayH).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Compute today's CRM-logged call statistics
async function computeTodayCrmTalkTime() {
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

// Helper to get or initialize default settings document
async function getOrCreateSettings() {
  let doc = await Setting.findOne({ key: "default" });
  if (!doc) {
    doc = await Setting.create({
      key: "default",
      loginTime: "10:00",
      logoutTime: "19:00",
      breakStartTime: "13:30",
      breakEndTime: "14:30",
      targetTalkTimeMinutes: 90
    });
  }
  return doc;
}

// GET /api/settings - Fetch user settings and today's talk-time metrics
router.get("/", async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    const todayKey = getTodayDateKey();
    const crmStats = await computeTodayCrmTalkTime();

    // Check manual override for today
    const manualAdj = (settings.manualTalkTimeAdjustments || []).find(
      (a) => a.date === todayKey
    );

    const hasOverride = manualAdj && typeof manualAdj.adjustedSeconds === "number";
    const effectiveTalkTimeSeconds = hasOverride
      ? manualAdj.adjustedSeconds
      : crmStats.todayTalkTime;

    const targetSeconds = settings.targetTalkTimeMinutes * 60;

    return res.status(200).json({
      success: true,
      data: {
        loginTime: settings.loginTime,
        logoutTime: settings.logoutTime,
        breakStartTime: settings.breakStartTime,
        breakEndTime: settings.breakEndTime,
        targetTalkTimeMinutes: settings.targetTalkTimeMinutes,
        todayDate: todayKey,
        isManualOverride: Boolean(hasOverride),
        manualOverrideSeconds: hasOverride ? manualAdj.adjustedSeconds : null,
        crmTalkTimeSeconds: crmStats.todayTalkTime,
        effectiveTalkTimeSeconds: effectiveTalkTimeSeconds,
        targetSeconds: targetSeconds,
        todayCallsCount: crmStats.todayCallsCount,
        callLogs: crmStats.callLogs,
        slotAdjustments: (settings.slotAdjustments || []).filter((s) => s.date === todayKey),
        updatedAt: settings.updatedAt
      }
    });
  } catch (err) {
    console.error("Error fetching settings:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/settings - Update shift, break & target settings
router.put("/", async (req, res) => {
  try {
    const { loginTime, logoutTime, breakStartTime, breakEndTime, targetTalkTimeMinutes } = req.body;

    const settings = await getOrCreateSettings();

    if (loginTime) settings.loginTime = loginTime.trim();
    if (logoutTime) settings.logoutTime = logoutTime.trim();
    if (breakStartTime) settings.breakStartTime = breakStartTime.trim();
    if (breakEndTime) settings.breakEndTime = breakEndTime.trim();
    if (targetTalkTimeMinutes && !isNaN(Number(targetTalkTimeMinutes))) {
      settings.targetTalkTimeMinutes = Math.max(1, Number(targetTalkTimeMinutes));
    }

    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Schedule settings updated successfully.",
      data: settings
    });
  } catch (err) {
    console.error("Error saving settings:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/settings/talktime-override - Manual calibration for today's talktime
router.post("/talktime-override", async (req, res) => {
  try {
    const { seconds, note, date } = req.body;
    const targetDate = date ? date.trim() : getTodayDateKey();

    const settings = await getOrCreateSettings();

    if (!Array.isArray(settings.manualTalkTimeAdjustments)) {
      settings.manualTalkTimeAdjustments = [];
    }

    if (seconds === null || seconds === undefined || Number(seconds) < 0) {
      // Remove override, reverting to CRM auto-calculation
      settings.manualTalkTimeAdjustments = settings.manualTalkTimeAdjustments.filter(
        (a) => a.date !== targetDate
      );
    } else {
      // Set or update override
      const cleanSeconds = Math.max(0, Math.round(Number(seconds)));
      const existingIdx = settings.manualTalkTimeAdjustments.findIndex(
        (a) => a.date === targetDate
      );

      if (existingIdx !== -1) {
        settings.manualTalkTimeAdjustments[existingIdx].adjustedSeconds = cleanSeconds;
        settings.manualTalkTimeAdjustments[existingIdx].note = note || "Manual Ozonetel calibration";
        settings.manualTalkTimeAdjustments[existingIdx].updatedAt = new Date();
      } else {
        settings.manualTalkTimeAdjustments.push({
          date: targetDate,
          adjustedSeconds: cleanSeconds,
          note: note || "Manual Ozonetel calibration",
          updatedAt: new Date()
        });
      }
    }

    await settings.save();

    const crmStats = await computeTodayCrmTalkTime();
    const manualAdj = settings.manualTalkTimeAdjustments.find((a) => a.date === targetDate);
    const hasOverride = manualAdj && typeof manualAdj.adjustedSeconds === "number";
    const effectiveTalkTimeSeconds = hasOverride
      ? manualAdj.adjustedSeconds
      : crmStats.todayTalkTime;

    return res.status(200).json({
      success: true,
      message: hasOverride
        ? `Today's talk-time calibrated to ${Math.floor(effectiveTalkTimeSeconds / 60)}m ${effectiveTalkTimeSeconds % 60}s.`
        : "Reverted to CRM logged talk-time calculation.",
      data: {
        isManualOverride: Boolean(hasOverride),
        effectiveTalkTimeSeconds,
        crmTalkTimeSeconds: crmStats.todayTalkTime
      }
    });
  } catch (err) {
    console.error("Error setting talk-time override:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/settings/slot-adjust - Add or subtract seconds for a specific 30-min slot
router.post("/slot-adjust", async (req, res) => {
  try {
    const { slotKey, deltaSeconds = 60, date } = req.body;
    if (!slotKey) {
      return res.status(400).json({ success: false, message: "slotKey is required" });
    }

    const settings = await getOrCreateSettings();
    const targetDate = date || getTodayDateKey();
    const crmStats = await computeTodayCrmTalkTime();

    if (!settings.slotAdjustments) {
      settings.slotAdjustments = [];
    }

    const delta = Math.round(Number(deltaSeconds)) || 60;

    // Find or create slot adjustment entry
    let slotEntry = settings.slotAdjustments.find(
      (s) => s.date === targetDate && s.slotKey === String(slotKey)
    );

    if (slotEntry) {
      slotEntry.addedSeconds = Math.max(0, (slotEntry.addedSeconds || 0) + delta);
    } else if (delta > 0) {
      settings.slotAdjustments.push({
        date: targetDate,
        slotKey: String(slotKey),
        addedSeconds: delta
      });
    }

    // Update overall day's effective talk-time
    const manualAdj = (settings.manualTalkTimeAdjustments || []).find(
      (a) => a.date === targetDate
    );

    if (manualAdj && typeof manualAdj.adjustedSeconds === "number") {
      manualAdj.adjustedSeconds = Math.max(0, manualAdj.adjustedSeconds + delta);
      manualAdj.note = `Slot adjusted (${slotKey} +${delta}s)`;
      manualAdj.updatedAt = new Date();
    } else {
      // Base on CRM + sum of all slot adjustments for today
      const totalSlotAdds = settings.slotAdjustments
        .filter((s) => s.date === targetDate)
        .reduce((sum, s) => sum + (s.addedSeconds || 0), 0);

      const newTotal = Math.max(0, crmStats.todayTalkTime + totalSlotAdds);
      settings.manualTalkTimeAdjustments.push({
        date: targetDate,
        adjustedSeconds: newTotal,
        note: `Slot adjusted (${slotKey} +${delta}s)`,
        updatedAt: new Date()
      });
    }

    await settings.save();

    const updatedAdj = settings.manualTalkTimeAdjustments.find((a) => a.date === targetDate);
    const effectiveTalkTimeSeconds = updatedAdj?.adjustedSeconds ?? crmStats.todayTalkTime;

    return res.status(200).json({
      success: true,
      message: `Updated slot ${slotKey} by ${delta >= 0 ? "+" : ""}${Math.round(delta / 60)}m.`,
      data: {
        date: targetDate,
        slotKey,
        slotAddedSeconds: settings.slotAdjustments.find((s) => s.date === targetDate && s.slotKey === String(slotKey))?.addedSeconds || 0,
        effectiveTalkTimeSeconds,
        crmTalkTimeSeconds: crmStats.todayTalkTime,
        slotAdjustments: settings.slotAdjustments.filter((s) => s.date === targetDate)
      }
    });
  } catch (err) {
    console.error("Error adjusting slot talk-time:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/settings/pacing-slots - Generate dynamic 30-minute interval breakdown
router.get("/pacing-slots", async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    const todayKey = getTodayDateKey();
    const crmStats = await computeTodayCrmTalkTime();

    const manualAdj = (settings.manualTalkTimeAdjustments || []).find(
      (a) => a.date === todayKey
    );
    const hasOverride = manualAdj && typeof manualAdj.adjustedSeconds === "number";
    const effectiveTalkTimeSeconds = hasOverride
      ? manualAdj.adjustedSeconds
      : crmStats.todayTalkTime;

    const targetSeconds = settings.targetTalkTimeMinutes * 60;
    const remainingSeconds = Math.max(0, targetSeconds - effectiveTalkTimeSeconds);

    const loginMins = timeToMinutes(settings.loginTime);
    const logoutMins = timeToMinutes(settings.logoutTime);
    const breakStartMins = timeToMinutes(settings.breakStartTime);
    const breakEndMins = timeToMinutes(settings.breakEndTime);

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const slots = [];
    let slotIdx = 0;

    for (let startM = loginMins; startM < logoutMins; startM += 30) {
      const endM = Math.min(startM + 30, logoutMins);
      const isBreak =
        (startM >= breakStartMins && startM < breakEndMins) ||
        (endM > breakStartMins && endM <= breakEndMins);

      let status = "upcoming";
      if (nowMinutes >= endM) {
        status = "past";
      } else if (nowMinutes >= startM && nowMinutes < endM) {
        status = "current";
      }

      // Check calls in this slot window
      const callsInSlot = crmStats.callLogs.filter((c) => {
        const d = new Date(c.addedAt);
        const callMins = d.getHours() * 60 + d.getMinutes();
        return callMins >= startM && callMins < endM;
      });

      const slotTalkTimeSeconds = callsInSlot.reduce((acc, c) => acc + (c.duration || 0), 0);

      slots.push({
        id: `slot-${slotIdx++}`,
        startMinutes: startM,
        endMins: endM,
        timeLabel: `${minutesToTime12(startM)} – ${minutesToTime12(endM)}`,
        startTime12: minutesToTime12(startM),
        endTime12: minutesToTime12(endM),
        isBreak,
        status,
        callsInSlot,
        callsCount: callsInSlot.length,
        actualSeconds: slotTalkTimeSeconds,
        targetSeconds: 0 // Will compute dynamically below
      });
    }

    // Compute remaining working slots from current time onward
    const remainingWorkingSlots = slots.filter(
      (s) => !s.isBreak && (s.status === "upcoming" || s.status === "current")
    );

    const requiredPacePerSlot =
      remainingWorkingSlots.length > 0
        ? Math.ceil(remainingSeconds / remainingWorkingSlots.length)
        : 0;

    // Distribute required target pace across active/upcoming slots
    slots.forEach((s) => {
      if (s.isBreak) {
        s.targetSeconds = 0;
      } else if (s.status === "past") {
        // Expected pace based on total target / total working slots
        const totalWorking = slots.filter((x) => !x.isBreak).length || 1;
        s.targetSeconds = Math.round(targetSeconds / totalWorking);
      } else {
        s.targetSeconds = requiredPacePerSlot;
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        todayDate: todayKey,
        currentTime12: minutesToTime12(nowMinutes),
        nowMinutes,
        settings: {
          loginTime: settings.loginTime,
          logoutTime: settings.logoutTime,
          breakStartTime: settings.breakStartTime,
          breakEndTime: settings.breakEndTime,
          targetTalkTimeMinutes: settings.targetTalkTimeMinutes
        },
        targetSeconds,
        effectiveTalkTimeSeconds,
        remainingSeconds,
        isTargetMet: remainingSeconds <= 0,
        totalSlots: slots.length,
        totalWorkingSlots: slots.filter((s) => !s.isBreak).length,
        remainingWorkingSlots: remainingWorkingSlots.length,
        requiredPacePerSlot,
        slots
      }
    });
  } catch (err) {
    console.error("Error generating pacing slots:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
module.exports.computeTodayCrmTalkTime = computeTodayCrmTalkTime;
module.exports.getOrCreateSettings = getOrCreateSettings;
