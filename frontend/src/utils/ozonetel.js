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
 * Triggers the Ozonetel call 100% silently in the background.
 * Uses an invisible 0x0 offscreen iframe + background fetch to transmit the
 * agent's active Henry Harvin session cookies to the CTC endpoint WITHOUT
 * opening any new tab, window, popup, or black JSON page!
 *
 * @param {string} phone
 * @returns {object} { success: boolean, url: string, cleanPhone: string, popup: null }
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

  if (typeof window === "undefined" || typeof document === "undefined") {
    return { success: true, url, cleanPhone: clean, popup: null };
  }

  // 1. Silent, invisible iframe trigger (attaches Henry Harvin agent cookies with ZERO tabs/windows)
  try {
    const frameId = "ozonetel-silent-ctc-frame";
    let iframe = document.getElementById(frameId);
    if (iframe && iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }

    iframe = document.createElement("iframe");
    iframe.id = frameId;
    iframe.name = frameId;
    iframe.style.position = "fixed";
    iframe.style.top = "-9999px";
    iframe.style.left = "-9999px";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.opacity = "0";
    iframe.style.visibility = "hidden";
    iframe.style.pointerEvents = "none";
    iframe.style.border = "none";
    iframe.setAttribute("aria-hidden", "true");
    iframe.src = url;
    document.body.appendChild(iframe);

    // Auto cleanup after 5 seconds
    setTimeout(() => {
      try {
        const f = document.getElementById(frameId);
        if (f && f.parentNode) {
          f.parentNode.removeChild(f);
        }
      } catch (e) {
        // Ignore
      }
    }, 5000);
  } catch (err) {
    console.warn("Silent iframe CTC error:", err);
  }

  // 2. Also dispatch silent background fetch with credentials
  try {
    fetch(url, {
      method: "GET",
      mode: "no-cors",
      credentials: "include"
    }).catch(() => {});
  } catch (e) {
    // Ignore no-cors fetch error
  }

  return {
    success: true,
    url,
    cleanPhone: clean,
    popup: null
  };
}
