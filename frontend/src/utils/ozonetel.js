/**
 * Ozonetel Click-to-Call (CTC) Integration Helper
 * Integrates with Henry Harvin's portal CTC endpoint:
 * https://crm.henryharvin.com/portal-new/ctc-ozonetel?mobile=[DOUBLE_BASE64_ENCODED_MOBILE]
 */

/**
 * Universal Base64 encoder (works in modern browsers and Node environments).
 */
function base64Encode(str) {
  if (typeof btoa === "function") {
    return btoa(str);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf-8").toString("base64");
  }
  return "";
}

/**
 * Strips non-digits and normalizes to a standard 10-digit Indian mobile number.
 * Examples:
 *   "+91 88979 43703" -> "8897943703"
 *   "918897943703"    -> "8897943703"
 *   "08897943703"     -> "8897943703"
 *   "8897943703"      -> "8897943703"
 */
export function clean10DigitPhone(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/[^0-9]/g, "");

  // If 12 digits and starts with 91 (India country code), strip 91
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }

  // If 11 digits and starts with 0 (STD/Trunk code), strip 0
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }

  // If 13 digits and starts with 091
  if (digits.length === 13 && digits.startsWith("091")) {
    return digits.slice(3);
  }

  return digits;
}

/**
 * Double base64 encodes the mobile number.
 * e.g., "8897943703"
 * Pass 1: base64Encode("8897943703")         = "ODg5Nzk0MzcwMw=="
 * Pass 2: base64Encode("ODg5Nzk0MzcwMw==")  = "T0RnNU56azBNemN3TXc9PQ=="
 */
export function doubleEncodePhone(phone) {
  const clean = clean10DigitPhone(phone);
  if (!clean) return "";
  try {
    const firstPass = base64Encode(clean);
    const secondPass = base64Encode(firstPass);
    return secondPass;
  } catch (err) {
    console.error("Failed to double-encode phone number:", err);
    return "";
  }
}

/**
 * Generates the full Henry Harvin Ozonetel CTC URL for a given phone number.
 */
export function getOzonetelCallUrl(phone) {
  const encoded = doubleEncodePhone(phone);
  if (!encoded) return "";
  return `https://crm.henryharvin.com/portal-new/ctc-ozonetel?mobile=${encoded}`;
}

/**
 * Triggers the Ozonetel call silently in the background.
 * Uses an off-screen 1x1 window to transmit the user's active Henry Harvin
 * session cookies to the CTC endpoint, then immediately refocuses the CRM
 * and automatically closes the background window after 1.8 seconds.
 *
 * @param {string} phone
 * @returns {object} { success: boolean, url: string, cleanPhone: string, popup: Window|null }
 */
export function triggerOzonetelCall(phone) {
  const clean = clean10DigitPhone(phone);
  if (!clean) {
    throw new Error("No valid phone number found for this lead.");
  }

  const url = getOzonetelCallUrl(phone);
  if (!url) {
    throw new Error("Failed to encode phone number for Ozonetel call.");
  }

  if (typeof window === "undefined") {
    return { success: true, url, cleanPhone: clean, popup: null };
  }

  // Open off-screen 1x1 background trigger window
  const popup = window.open(
    url,
    "ozonetel_silent_trigger",
    "width=1,height=1,left=50000,top=50000,menubar=no,toolbar=no,location=no,status=no,resizable=no"
  );

  if (popup) {
    // Immediately return focus to the CRM
    try {
      if (typeof window.focus === "function") {
        window.focus();
      }
    } catch (e) {
      // Ignore cross-origin focus restrictions
    }

    // Auto-close after 1.8 seconds so zero popup screens remain open
    setTimeout(() => {
      try {
        if (popup && !popup.closed) {
          popup.close();
        }
      } catch (e) {
        // Ignore
      }
    }, 1800);
  }

  return {
    success: true,
    url,
    cleanPhone: clean,
    popup
  };
}
