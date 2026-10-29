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

    // Check dynamic daily target for today (if management changed today's target)
    const todayTargetEntry = (settings.dailyTargets || []).find((t) => t.date === todayKey);
    const todayTargetMinutes = todayTargetEntry && typeof todayTargetEntry.targetMinutes === "number"
      ? (todayTargetEntry.isOffDay ? 0 : todayTargetEntry.targetMinutes)
      : (settings.targetTalkTimeMinutes || 90);

    const targetSeconds = todayTargetMinutes * 60;

    return res.status(200).json({
      success: true,
      data: {
        loginTime: settings.loginTime,
        logoutTime: settings.logoutTime,
        breakStartTime: settings.breakStartTime,
        breakEndTime: settings.breakEndTime,
        targetTalkTimeMinutes: settings.targetTalkTimeMinutes,
        todayTargetMinutes: todayTargetMinutes,
        isTodayCustomTarget: Boolean(todayTargetEntry),
        todayIsOffDay: Boolean(todayTargetEntry?.isOffDay),
        todayDate: todayKey,
        isManualOverride: Boolean(hasOverride),
        manualOverrideSeconds: hasOverride ? manualAdj.adjustedSeconds : null,
        crmTalkTimeSeconds: crmStats.todayTalkTime,
        effectiveTalkTimeSeconds: effectiveTalkTimeSeconds,
        targetSeconds: targetSeconds,
        todayCallsCount: crmStats.todayCallsCount,
        callLogs: crmStats.callLogs,
        slotAdjustments: (settings.slotAdjustments || []).filter((s) => s.date === todayKey),
        dailyTargets: settings.dailyTargets || [],
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

    // Check dynamic daily target for today (e.g. if set to 2 hours or holiday)
    const todayTargetEntry = (settings.dailyTargets || []).find((t) => t.date === todayKey);
    const todayTargetMinutes = todayTargetEntry && typeof todayTargetEntry.targetMinutes === "number"
      ? (todayTargetEntry.isOffDay ? 0 : todayTargetEntry.targetMinutes)
      : (settings.targetTalkTimeMinutes || 90);

    const targetSeconds = todayTargetMinutes * 60;
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
          targetTalkTimeMinutes: settings.targetTalkTimeMinutes,
          todayTargetMinutes: todayTargetMinutes,
          isTodayCustomTarget: Boolean(todayTargetEntry)
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

// POST /api/settings/daily-target - Set custom target or mark off-day for a specific date
router.post("/daily-target", async (req, res) => {
  try {
    const { date, targetMinutes, isOffDay, note } = req.body;
    const targetDate = date ? String(date).trim() : getTodayDateKey();

    const settings = await getOrCreateSettings();
    if (!Array.isArray(settings.dailyTargets)) {
      settings.dailyTargets = [];
    }

    const cleanMins = Math.max(0, parseInt(targetMinutes, 10) || 90);
    const existingIdx = settings.dailyTargets.findIndex((t) => t.date === targetDate);

    if (existingIdx !== -1) {
      settings.dailyTargets[existingIdx].targetMinutes = cleanMins;
      settings.dailyTargets[existingIdx].isOffDay = Boolean(isOffDay);
      if (note !== undefined) settings.dailyTargets[existingIdx].note = note;
      settings.dailyTargets[existingIdx].updatedAt = new Date();
    } else {
      settings.dailyTargets.push({
        date: targetDate,
        targetMinutes: cleanMins,
        isOffDay: Boolean(isOffDay),
        note: note || "",
        updatedAt: new Date()
      });
    }

    await settings.save();

    return res.status(200).json({
      success: true,
      message: `Target for ${targetDate} set to ${isOffDay ? "OFF / Holiday" : `${cleanMins} minutes`}.`,
      data: {
        date: targetDate,
        targetMinutes: cleanMins,
        isOffDay: Boolean(isOffDay),
        note: note || "",
        dailyTargets: settings.dailyTargets
      }
    });
  } catch (err) {
    console.error("Error setting daily target:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Helper to format seconds into "Xh Ym Zs" or "Ym Zs"
function formatSecondsToHMS(totalSec) {
  const sec = Math.max(0, Math.round(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

// GET /api/settings/monthly-ledger - Monthly audit ledger, date range filtering, deduction risks, and TL proof report
router.get("/monthly-ledger", async (req, res) => {
  try {
    const now = new Date();
    const queryMonth = req.query.month; // e.g. "2026-10"

    let year = now.getFullYear();
    let month = now.getMonth() + 1; // 1-based

    if (queryMonth && /^\d{4}-\d{2}$/.test(queryMonth)) {
      const parts = queryMonth.split("-");
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
    }

    const settings = await getOrCreateSettings();

    // Calculate month boundaries (using local calendar dates)
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(year, month, 1, 0, 0, 0, 0);

    // Fetch leads with call activity in this month
    const leadsInMonth = await Lead.find({
      $or: [
        { "comments.addedAt": { $gte: startOfMonth, $lt: endOfMonth } },
        { lastCallDate: { $gte: startOfMonth, $lt: endOfMonth } }
      ]
    })
      .select("name phone leadId course stage comments enrolledCourses courseName")
      .lean();

    // Group CRM calls by "YYYY-MM-DD"
    const dayCallsMap = {};

    for (const lead of leadsInMonth) {
      if (Array.isArray(lead.comments)) {
        for (const c of lead.comments) {
          if (c.addedAt) {
            const cDate = new Date(c.addedAt);
            if (cDate >= startOfMonth && cDate < endOfMonth) {
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
                const dateKey = `${cDate.getFullYear()}-${String(cDate.getMonth() + 1).padStart(2, "0")}-${String(cDate.getDate()).padStart(2, "0")}`;
                if (!dayCallsMap[dateKey]) {
                  dayCallsMap[dateKey] = { crmSeconds: 0, callsCount: 0, logs: [] };
                }
                dayCallsMap[dateKey].crmSeconds += duration;
                dayCallsMap[dateKey].callsCount += 1;
                dayCallsMap[dateKey].logs.push({
                  leadId: lead._id,
                  name: lead.name,
                  phone: lead.phone,
                  duration,
                  outcome: c.outcome || "Call Logged",
                  addedAt: c.addedAt
                });
              }
            }
          }
        }
      }
    }

    const todayKey = getTodayDateKey(now);
    const todayDateMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const daysList = [];
    let totalTargetSeconds = 0;
    let totalAchievedSeconds = 0;
    let workingDaysCount = 0;
    let achievedDaysCount = 0;
    let riskDaysCount = 0;
    let totalCallsCount = 0;

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayNamesFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dObj = new Date(year, month - 1, d);
      const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayOfWeek = dObj.getDay();
      const isSunday = dayOfWeek === 0;

      // Custom daily target lookup
      const customTarget = (settings.dailyTargets || []).find((t) => t.date === dateKey);
      const isOffDay = customTarget ? Boolean(customTarget.isOffDay) : isSunday;
      const targetMins = customTarget
        ? (isOffDay ? 0 : Number(customTarget.targetMinutes) || settings.targetTalkTimeMinutes || 90)
        : (isOffDay ? 0 : settings.targetTalkTimeMinutes || 90);

      // Manual calibration lookup (e.g. from Ozonetel portal sync)
      const manualAdj = (settings.manualTalkTimeAdjustments || []).find((a) => a.date === dateKey);
      const hasOverride = manualAdj && typeof manualAdj.adjustedSeconds === "number";

      const crmDay = dayCallsMap[dateKey] || { crmSeconds: 0, callsCount: 0, logs: [] };
      const effectiveSeconds = hasOverride ? manualAdj.adjustedSeconds : crmDay.crmSeconds;

      const targetSec = targetMins * 60;
      const differenceSeconds = effectiveSeconds - targetSec;

      const isToday = dateKey === todayKey;
      const isPast = dObj < todayDateMidnight;
      const isFuture = dObj > todayDateMidnight;

      let status = "working";
      if (isOffDay) {
        status = "off";
      } else if (isFuture) {
        status = "future";
      } else if (isToday) {
        status = effectiveSeconds >= targetSec ? "achieved" : "in_progress";
      } else if (isPast) {
        status = effectiveSeconds >= targetSec ? "achieved" : "risk";
      }

      // Summary tally for elapsed or current working days
      if (!isOffDay && !isFuture) {
        workingDaysCount++;
        totalTargetSeconds += targetSec;
        totalAchievedSeconds += effectiveSeconds;
        totalCallsCount += crmDay.callsCount;
        if (effectiveSeconds >= targetSec) {
          achievedDaysCount++;
        } else if (isPast) {
          riskDaysCount++;
        }
      }

      daysList.push({
        date: dateKey,
        dayNumber: d,
        dayOfWeek: dayNames[dayOfWeek],
        dayOfWeekFull: dayNamesFull[dayOfWeek],
        isSunday,
        isOffDay,
        isToday,
        isPast,
        isFuture,
        targetMinutes: targetMins,
        targetSeconds: targetSec,
        crmSeconds: crmDay.crmSeconds,
        callsCount: crmDay.callsCount,
        manualAdjustedSeconds: hasOverride ? manualAdj.adjustedSeconds : null,
        isManualOverride: Boolean(hasOverride),
        effectiveSeconds,
        differenceSeconds,
        isTargetMet: effectiveSeconds >= targetSec,
        status,
        note: customTarget?.note || manualAdj?.note || ""
      });
    }

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthLabel = `${monthNames[month - 1]} ${year}`;

    const netBalanceSeconds = totalAchievedSeconds - totalTargetSeconds;
    const successRatePercent = workingDaysCount > 0 ? Math.round((achievedDaysCount / workingDaysCount) * 100) : 0;
    const avgDailySeconds = workingDaysCount > 0 ? Math.round(totalAchievedSeconds / workingDaysCount) : 0;

    // Compose professional proof report for Team Lead / Manager
    const netPrefix = netBalanceSeconds >= 0 ? "+" : "-";
    const netFormatted = `${netPrefix}${formatSecondsToHMS(Math.abs(netBalanceSeconds))}`;

    let proofText = `📊 TALK-TIME AUDIT REPORT - ${monthLabel.toUpperCase()}\n`;
    proofText += `Counselor / Agent: Lead Manager CRM\n`;
    proofText += `Audit Period: 01 ${monthNames[month - 1].slice(0, 3)} ${year} – ${String(totalDaysInMonth).padStart(2, "0")} ${monthNames[month - 1].slice(0, 3)} ${year}\n\n`;
    proofText += `• Total Working Days: ${workingDaysCount} Days\n`;
    proofText += `• Targets Met: ${achievedDaysCount} / ${workingDaysCount} (${successRatePercent}% Target Adherence)\n`;
    proofText += `• Total Achieved Talk-Time: ${formatSecondsToHMS(totalAchievedSeconds)}\n`;
    proofText += `• Total Required Target: ${formatSecondsToHMS(totalTargetSeconds)}\n`;
    proofText += `• Net Month Balance: ${netFormatted} (${netBalanceSeconds >= 0 ? "SURPLUS ✅" : "DEFICIT ⚠️"})\n`;
    proofText += `• Daily Average Achieved: ${formatSecondsToHMS(avgDailySeconds)} / working day\n`;
    proofText += `• Total Calls Logged: ${totalCallsCount} calls\n`;

    if (riskDaysCount > 0) {
      proofText += `• ⚠️ Days Below Target: ${riskDaysCount} Day(s) (Risk of salary/attendance deduction)\n`;
    } else {
      proofText += `• 🛡️ Salary Status: 100% Target Met (Salary & Attendance Protected)\n`;
    }

    proofText += `\n🗓️ DAILY AUDIT BREAKDOWN:\n`;
    daysList
      .filter((d) => !d.isFuture)
      .forEach((d) => {
        if (d.isOffDay) {
          proofText += `• ${d.date} (${d.dayOfWeek}): OFF / Holiday\n`;
        } else {
          const diffStr = d.differenceSeconds >= 0
            ? `+${formatSecondsToHMS(d.differenceSeconds)}`
            : `-${formatSecondsToHMS(Math.abs(d.differenceSeconds))}`;
          const badge = d.isTargetMet ? "🟢 MET" : (d.isToday ? "🟡 IN PROGRESS" : "🔴 DEFICIT");
          proofText += `• ${d.date} (${d.dayOfWeek}): ${formatSecondsToHMS(d.effectiveSeconds)} / Target: ${formatSecondsToHMS(d.targetSeconds)} [${badge} (${diffStr})] • ${d.callsCount} calls\n`;
        }
      });

    return res.status(200).json({
      success: true,
      data: {
        year,
        month,
        monthKey: `${year}-${String(month).padStart(2, "0")}`,
        monthLabel,
        workingDaysCount,
        achievedDaysCount,
        riskDaysCount,
        successRatePercent,
        totalTargetSeconds,
        totalAchievedSeconds,
        netBalanceSeconds,
        avgDailySeconds,
        totalCallsCount,
        safeSalaryStatus: riskDaysCount === 0 ? "PROTECTED" : "AT_RISK",
        proofText,
        days: daysList
      }
    });
  } catch (err) {
    console.error("Error generating monthly ledger:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
module.exports.computeTodayCrmTalkTime = computeTodayCrmTalkTime;
module.exports.getOrCreateSettings = getOrCreateSettings;
