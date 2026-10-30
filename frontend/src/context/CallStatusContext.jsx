import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import axios from "axios";
import { triggerOzonetelCall, clean10DigitPhone, getOzonetelCallUrl } from "../utils/ozonetel";

const CallStatusContext = createContext(null);

export function CallStatusProvider({ children, onLeadUpdated }) {
  const [activeCall, setActiveCall] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isSavingOutcome, setIsSavingOutcome] = useState(false);
  const [lastSavedOutcome, setLastSavedOutcome] = useState(null);

  // In-Call Live Stopwatch Timer State
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Daily Talk-Time Goal (Default: 90 mins = 1h 30m, customizable in localStorage)
  const [dailyTargetMinutes, setDailyTargetMinutesState] = useState(() => {
    const saved = localStorage.getItem("lead_crm_daily_target_minutes");
    const parsed = parseInt(saved, 10);
    return !isNaN(parsed) && parsed > 0 ? parsed : 90;
  });

  const setDailyTargetMinutes = (mins) => {
    const val = Math.max(1, parseInt(mins, 10) || 90);
    setDailyTargetMinutesState(val);
    localStorage.setItem("lead_crm_daily_target_minutes", String(val));
  };

  // Cumulative talk-time across all leads today
  const [todayTalkTimeSeconds, setTodayTalkTimeSeconds] = useState(0);
  const [todayCallsCount, setTodayCallsCount] = useState(0);

  // Manual timer modal visibility
  const [showManualTimerModal, setShowManualTimerModal] = useState(false);

  // Timer interval effect
  useEffect(() => {
    let interval = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  // Global Settings state (dynamic targets, snooze days, timer increments)
  const [settings, setSettings] = useState(null);

  const fetchSettings = async () => {
    try {
      const res = await axios.get("/api/settings");
      if (res.data && res.data.success) {
        setSettings(res.data.data);
      }
    } catch (err) {
      console.warn("Could not fetch settings in CallStatusContext:", err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Fetch real-time talk-time metrics across all leads
  const fetchTodayStats = async () => {
    try {
      const res = await axios.get("/api/leads/talktime-stats");
      if (res.data && res.data.success) {
        setTodayTalkTimeSeconds(res.data.todayTalkTimeSeconds || 0);
        setTodayCallsCount(res.data.todayCallsCount || 0);
      }
    } catch (err) {
      // Graceful fallback
    }
  };

  useEffect(() => {
    fetchTodayStats();
  }, []);

  // Timer controls
  const startTimer = () => setIsTimerRunning(true);
  const pauseTimer = () => setIsTimerRunning(false);
  const resetTimer = () => {
    setTimerSeconds(0);
    setIsTimerRunning(false);
  };
  const addTimerSeconds = (secs) => {
    setTimerSeconds((prev) => Math.max(0, prev + secs));
  };

  /**
   * Initiate a call via Ozonetel for a lead.
   * Timer is initialized to 0 and paused so agent can hit "Start Timer" when lead picks up!
   */
  const initiateCall = async (lead, onLeadDataChange) => {
    if (!lead || !lead.phone) {
      alert("No phone number available for this lead.");
      return null;
    }

    const clean = clean10DigitPhone(lead.phone);
    if (!clean) {
      alert("Invalid phone number format.");
      return null;
    }

    const callUrl = getOzonetelCallUrl(lead.phone);
    const initialCallCount = (lead.callCount || 0) + 1;

    // Reset and prepare call state
    const newCallState = {
      leadId: lead._id,
      lead: lead,
      name: lead.name || "Student",
      phone: lead.phone,
      cleanPhone: clean,
      course: lead.course || (lead.enrolledCourses?.[0]?.courseName || lead.courseName || "General"),
      stage: lead.stage || "New",
      quality: lead.quality || "Warm Lead",
      priority: lead.priority || 2,
      callCount: initialCallCount,
      status: "connecting", // 'connecting' -> 'queued'
      startTime: Date.now(),
      url: callUrl
    };

    setActiveCall(newCallState);
    setIsMinimized(false);
    setLastSavedOutcome(null);
    setTimerSeconds(0);
    setIsTimerRunning(false); // DO NOT auto-run; agent starts when person picks up

    // 1. Silent offscreen trigger
    try {
      triggerOzonetelCall(lead.phone);
    } catch (err) {
      console.error("Silent trigger error:", err);
    }

    // 2. Transition status to 'queued' after 1.1s
    setTimeout(() => {
      setActiveCall((prev) => {
        if (!prev || prev.leadId !== lead._id) return prev;
        return { ...prev, status: "queued" };
      });
    }, 1100);

    // 3. Register call increment in backend
    try {
      const res = await axios.post(`/api/leads/${lead._id}/call`);
      if (res.data && res.data.success && res.data.data) {
        const updatedLead = res.data.data;
        setActiveCall((prev) => {
          if (!prev || prev.leadId !== lead._id) return prev;
          return {
            ...prev,
            lead: updatedLead,
            callCount: updatedLead.callCount
          };
        });

        if (typeof onLeadDataChange === "function") {
          onLeadDataChange(updatedLead);
        }
        if (typeof onLeadUpdated === "function") {
          onLeadUpdated(updatedLead);
        }
        return updatedLead;
      }
    } catch (err) {
      console.warn("Could not log call increment to backend:", err.message);
    }

    return lead;
  };

  /**
   * Start a manual call timer session for ANY lead (without necessarily triggering Ozonetel).
   */
  const startManualCall = (lead, triggerOzo = false) => {
    if (!lead) return;
    const clean = clean10DigitPhone(lead.phone || "");

    const newCallState = {
      leadId: lead._id,
      lead: lead,
      name: lead.name || "Student",
      phone: lead.phone || "",
      cleanPhone: clean,
      course: lead.course || (lead.enrolledCourses?.[0]?.courseName || lead.courseName || "General"),
      stage: lead.stage || "New",
      quality: lead.quality || "Warm Lead",
      priority: lead.priority || 2,
      callCount: (lead.callCount || 0) + 1,
      status: triggerOzo ? "connecting" : "manual",
      startTime: Date.now(),
      url: lead.phone ? getOzonetelCallUrl(lead.phone) : ""
    };

    setActiveCall(newCallState);
    setIsMinimized(false);
    setTimerSeconds(0);
    setIsTimerRunning(false);
    setLastSavedOutcome(null);

    if (triggerOzo && lead.phone) {
      try {
        triggerOzonetelCall(lead.phone);
      } catch (err) {
        console.error("Silent trigger error:", err);
      }
    }
  };

  /**
   * Log outcome with duration, optional snooze, and custom notes.
   * Automatically calls `/api/leads/:id/call-log` to update total talk time.
   */
  const logOutcome = async (outcome, options = {}, onLeadDataChange) => {
    if (!activeCall) return;

    let duration = timerSeconds;
    let customNote = "";
    let snoozeDays = null;
    let stage = null;
    let quality = null;
    let isVoicemailPool = null;
    let followUpDate = null;
    let followUpTime = null;

    if (typeof options === "string") {
      customNote = options;
    } else if (typeof options === "object" && options !== null) {
      if (options.duration !== undefined) duration = options.duration;
      if (options.customNote !== undefined) customNote = options.customNote;
      if (options.snoozeDays !== undefined) snoozeDays = options.snoozeDays;
      if (options.stage !== undefined) stage = options.stage;
      if (options.quality !== undefined) quality = options.quality;
      if (options.isVoicemailPool !== undefined) isVoicemailPool = options.isVoicemailPool;
      if (options.followUpDate !== undefined) followUpDate = options.followUpDate;
      if (options.followUpTime !== undefined) followUpTime = options.followUpTime;
    }

    try {
      setIsSavingOutcome(true);
      setIsTimerRunning(false);

      const res = await axios.post(`/api/leads/${activeCall.leadId}/call-log`, {
        duration,
        outcome,
        snoozeDays,
        customNote,
        stage,
        quality,
        isVoicemailPool,
        followUpDate,
        followUpTime
      });

      if (res.data && res.data.success && res.data.data) {
        const updatedLead = res.data.data;
        setLastSavedOutcome(outcome);

        // Instantly add to today's cumulative talk time
        setTodayTalkTimeSeconds((prev) => prev + (parseInt(duration, 10) || 0));
        setTodayCallsCount((prev) => prev + 1);

        setActiveCall((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            lead: updatedLead,
            stage: updatedLead.stage
          };
        });

        if (typeof onLeadDataChange === "function") {
          onLeadDataChange(updatedLead);
        }
        if (typeof onLeadUpdated === "function") {
          onLeadUpdated(updatedLead);
        }

        // Re-fetch backend stats in background
        fetchTodayStats();

        // Auto-dismiss after 3 seconds once outcome is logged
        setTimeout(() => {
          setActiveCall((curr) => {
            if (curr && curr.leadId === activeCall.leadId) {
              return null;
            }
            return curr;
          });
          setLastSavedOutcome(null);
          setTimerSeconds(0);
          setIsTimerRunning(false);
        }, 3000);

        return updatedLead;
      }
    } catch (err) {
      console.error("Failed to log call outcome:", err);
      alert("Failed to save call log: " + (err.response?.data?.message || err.message));
    } finally {
      setIsSavingOutcome(false);
    }
  };

  const dismissCall = () => {
    setActiveCall(null);
    setLastSavedOutcome(null);
    setIsMinimized(false);
    setTimerSeconds(0);
    setIsTimerRunning(false);
  };

  const toggleMinimize = () => {
    setIsMinimized((prev) => !prev);
  };

  return (
    <CallStatusContext.Provider
      value={{
        activeCall,
        isMinimized,
        isSavingOutcome,
        lastSavedOutcome,
        timerSeconds,
        isTimerRunning,
        startTimer,
        pauseTimer,
        resetTimer,
        addTimerSeconds,
        dailyTargetMinutes,
        setDailyTargetMinutes,
        todayTalkTimeSeconds,
        todayCallsCount,
        fetchTodayStats,
        initiateCall,
        startManualCall,
        logOutcome,
        dismissCall,
        toggleMinimize,
        settings,
        fetchSettings,
        showManualTimerModal,
        setShowManualTimerModal
      }}
    >
      {children}
    </CallStatusContext.Provider>
  );
}

export function useCallStatus() {
  const context = useContext(CallStatusContext);
  if (!context) {
    throw new Error("useCallStatus must be used within a CallStatusProvider");
  }
  return context;
}
