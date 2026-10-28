/**
 * 30-Minute Interval Pacing & Schedule Engine
 * Calculates dynamic required talk-time pace per 30-minute slot,
 * strictly excluding configured break periods.
 */

export function timeToMinutes(timeStr) {
  if (!timeStr || !timeStr.includes(":")) return 0;
  const parts = timeStr.split(":");
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

export function minutesToTime12(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${String(displayH).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return "0s";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    return `${h}h ${m}m ${s > 0 ? `${s}s` : ""}`.trim();
  }
  if (m > 0) {
    return `${m}m ${s > 0 ? `${s}s` : ""}`.trim();
  }
  return `${s}s`;
}

export function formatDurationPace(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return "0m 00s";
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function calculatePacingSchedule(settings, effectiveTalkTimeSeconds = 0, callLogs = [], currentTime = new Date(), slotAdjustments = []) {
  const loginTime = settings?.loginTime || "10:00";
  const logoutTime = settings?.logoutTime || "19:00";
  const breakStartTime = settings?.breakStartTime || "13:30";
  const breakEndTime = settings?.breakEndTime || "14:30";
  const targetMinutes = settings?.targetTalkTimeMinutes || 90;

  const loginMins = timeToMinutes(loginTime);
  const logoutMins = timeToMinutes(logoutTime);
  const breakStartMins = timeToMinutes(breakStartTime);
  const breakEndMins = timeToMinutes(breakEndTime);

  const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes();
  const targetSeconds = targetMinutes * 60;
  const remainingSeconds = Math.max(0, targetSeconds - effectiveTalkTimeSeconds);

  const slots = [];
  let slotIdx = 0;

  for (let startM = loginMins; startM < logoutMins; startM += 30) {
    const endM = Math.min(startM + 30, logoutMins);
    
    // Check if slot overlaps with break window
    const isBreak =
      (startM >= breakStartMins && startM < breakEndMins) ||
      (endM > breakStartMins && endM <= breakEndMins);

    let status = "upcoming";
    if (nowMins >= endM) {
      status = "past";
    } else if (nowMins >= startM && nowMins < endM) {
      status = "current";
    }

    // Filter calls made in this slot window today
    const callsInSlot = (callLogs || []).filter((c) => {
      if (!c.addedAt) return false;
      const d = new Date(c.addedAt);
      const callMins = d.getHours() * 60 + d.getMinutes();
      return callMins >= startM && callMins < endM;
    });

    const slotTalkTimeSeconds = callsInSlot.reduce((acc, c) => acc + (c.duration || 0), 0);
    const slotKeyId = `slot-${slotIdx}`;
    const slotAdj = (slotAdjustments || []).find(
      (a) => a.slotKey === slotKeyId || a.slotKey === String(startM)
    );
    const slotAddedSeconds = slotAdj ? (slotAdj.addedSeconds || 0) : 0;
    const totalSlotActualSeconds = slotTalkTimeSeconds + slotAddedSeconds;

    slots.push({
      id: slotKeyId,
      key: String(startM),
      index: slotIdx++,
      startMinutes: startM,
      endMinutes: endM,
      timeLabel: `${minutesToTime12(startM)} – ${minutesToTime12(endM)}`,
      startTime12: minutesToTime12(startM),
      endTime12: minutesToTime12(endM),
      isBreak,
      status, // "past" | "current" | "upcoming"
      callsInSlot,
      callsCount: callsInSlot.length,
      actualSeconds: totalSlotActualSeconds,
      baseActualSeconds: slotTalkTimeSeconds,
      slotAddedSeconds: slotAddedSeconds,
      targetSeconds: 0
    });
  }

  // Count remaining working slots from current time onward (current + upcoming, excluding break)
  const totalWorkingSlots = slots.filter((s) => !s.isBreak).length;
  const remainingWorkingSlots = slots.filter(
    (s) => !s.isBreak && (s.status === "upcoming" || s.status === "current")
  ).length;

  // Base planned pace per working slot
  const basePacePerSlot = totalWorkingSlots > 0 ? Math.round(targetSeconds / totalWorkingSlots) : 0;

  // Dynamic required pace per remaining working slot
  const requiredPacePerSlot =
    remainingWorkingSlots > 0 ? Math.ceil(remainingSeconds / remainingWorkingSlots) : 0;

  // Assign slot target pace
  slots.forEach((s) => {
    if (s.isBreak) {
      s.targetSeconds = 0;
    } else if (s.status === "past") {
      s.targetSeconds = basePacePerSlot;
    } else {
      s.targetSeconds = requiredPacePerSlot;
    }
  });

  // Calculate current slot info
  const currentSlot = slots.find((s) => s.status === "current") || null;

  // Pacing Health Status
  let pacingHealth = "on_track";
  let pacingMessage = "Great pace! You are on track to meet your target comfortably.";
  let pacingColor = "#059669"; // Emerald green

  if (remainingSeconds <= 0) {
    pacingHealth = "completed";
    pacingMessage = `🎉 Goal Achieved! You exceeded today's target by ${formatDuration(effectiveTalkTimeSeconds - targetSeconds)}!`;
    pacingColor = "#10b981";
  } else if (remainingWorkingSlots === 0) {
    pacingHealth = "short";
    pacingMessage = `Shift ended. Short by ${formatDuration(remainingSeconds)}.`;
    pacingColor = "#dc2626";
  } else if (requiredPacePerSlot > 15 * 60) {
    // Need > 15 mins out of 30 mins
    pacingHealth = "critical";
    pacingMessage = `⚠️ Intensive Pace Required: ${formatDurationPace(requiredPacePerSlot)} per 30-min block!`;
    pacingColor = "#dc2626"; // Red
  } else if (requiredPacePerSlot > 8 * 60) {
    // Need 8 to 15 mins per 30 mins
    pacingHealth = "moderate";
    pacingMessage = `⚡ Step Up Calls: Need ${formatDurationPace(requiredPacePerSlot)} per 30-min block to finish on time.`;
    pacingColor = "#f59e0b"; // Amber
  }

  const progressPercent = Math.min(100, Math.round((effectiveTalkTimeSeconds / targetSeconds) * 100));

  return {
    settings: {
      loginTime,
      logoutTime,
      breakStartTime,
      breakEndTime,
      targetMinutes
    },
    nowMins,
    currentTime12: minutesToTime12(nowMins),
    targetSeconds,
    effectiveTalkTimeSeconds,
    remainingSeconds,
    progressPercent,
    isTargetMet: remainingSeconds <= 0,
    totalSlots: slots.length,
    totalWorkingSlots,
    remainingWorkingSlots,
    basePacePerSlot,
    requiredPacePerSlot,
    currentSlot,
    pacingHealth,
    pacingMessage,
    pacingColor,
    slots
  };
}
