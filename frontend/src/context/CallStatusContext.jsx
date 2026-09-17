import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import axios from "axios";
import { triggerOzonetelCall, clean10DigitPhone, getOzonetelCallUrl } from "../utils/ozonetel";

const CallStatusContext = createContext(null);

export function CallStatusProvider({ children, onLeadUpdated }) {
  const [activeCall, setActiveCall] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isSavingOutcome, setIsSavingOutcome] = useState(false);
  const [lastSavedOutcome, setLastSavedOutcome] = useState(null);

  const activeCallRef = useRef(activeCall);
  activeCallRef.current = activeCall;

  /**
   * Initiate a silent Ozonetel call for a lead.
   * Opens the offscreen self-closing trigger, registers the call in the database,
   * and displays the in-app side call card.
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

    // Set active call state immediately
    const newCallState = {
      leadId: lead._id,
      lead: lead,
      name: lead.name || "Student",
      phone: lead.phone,
      cleanPhone: clean,
      course: lead.course || "General",
      stage: lead.stage || "New",
      callCount: initialCallCount,
      status: "connecting", // 'connecting' -> 'queued'
      startTime: Date.now(),
      url: callUrl
    };

    setActiveCall(newCallState);
    setIsMinimized(false);
    setLastSavedOutcome(null);

    // 1. Silent offscreen trigger
    try {
      triggerOzonetelCall(lead.phone);
    } catch (err) {
      console.error("Silent trigger error:", err);
    }

    // 2. Transition status to 'queued' after 1.1 seconds (realistic CTC queue time)
    const queueTimer = setTimeout(() => {
      setActiveCall((prev) => {
        if (!prev || prev.leadId !== lead._id) return prev;
        return { ...prev, status: "queued" };
      });
    }, 1100);

    // 3. Increment call count in backend database
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
   * Log an outcome (e.g. Voicemail, Connected - Interested, Call Back, etc.)
   * directly from the side widget.
   */
  const logOutcome = async (outcome, customNote = "", onLeadDataChange) => {
    if (!activeCall) return;

    try {
      setIsSavingOutcome(true);
      const noteText = customNote.trim()
        ? customNote.trim()
        : `📞 Call outcome: ${outcome} (via Ozonetel)`;

      const res = await axios.post(`/api/leads/${activeCall.leadId}/comments`, {
        text: noteText,
        outcome: outcome
      });

      if (res.data && res.data.success && res.data.data) {
        const updatedLead = res.data.data;
        setLastSavedOutcome(outcome);
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

        // Auto-dismiss after 3.5 seconds once outcome is logged
        setTimeout(() => {
          setActiveCall((curr) => {
            if (curr && curr.leadId === activeCall.leadId) {
              return null;
            }
            return curr;
          });
          setLastSavedOutcome(null);
        }, 3500);

        return updatedLead;
      }
    } catch (err) {
      console.error("Failed to log call outcome:", err);
      alert("Failed to save outcome: " + (err.response?.data?.message || err.message));
    } finally {
      setIsSavingOutcome(false);
    }
  };

  const dismissCall = () => {
    setActiveCall(null);
    setLastSavedOutcome(null);
    setIsMinimized(false);
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
        initiateCall,
        logOutcome,
        dismissCall,
        toggleMinimize
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
