import * as XLSX from "xlsx";

export function exportLeadsToExcel(leadsToExport, customFilename) {
  if (!leadsToExport || leadsToExport.length === 0) {
    alert("No leads available to export.");
    return;
  }

  const formatDate = (d) => {
    if (!d) return "";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  const formatDateTime = (d) => {
    if (!d) return "";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  };

  const formatTime12 = (timeStr) => {
    if (!timeStr) return "";
    const parts = timeStr.split(":");
    if (parts.length < 2) return timeStr;
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? "PM" : "AM";
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${formattedHours}:${minutes} ${ampm}`;
  };

  // 1. Prepare Sheet 1: Leads
  const leadsData = leadsToExport.map((lead) => {
    // Format comments as numbered list
    const commentsList = (lead.comments || [])
      .map((c, i) => {
        const timeFormatted = formatDateTime(c.addedAt);
        const outcomePart = c.outcome ? ` — ${c.outcome}` : "";
        return `${i + 1}. ${timeFormatted}${outcomePart} — ${c.text}`;
      })
      .join("\n\n");

    // Format enrolled courses
    const coursesStr = (lead.enrolledCourses || [])
      .map((c) => `${c.courseName} (₹${c.fee})`)
      .join(", ");

    return {
      "Lead ID": lead.leadId || "",
      "Name": lead.name || "",
      "Phone": lead.phone || "",
      "Email": lead.email || "",
      "Quality": lead.quality || "",
      "Priority": lead.priority ? `P${lead.priority}` : "",
      "Stage": lead.stage || "",
      "Source": lead.source || "",
      "Enquiry Date": formatDate(lead.enquiryDate),
      "Follow-up Date": formatDate(lead.followUpDate),
      "Follow-up Time": formatTime12(lead.followUpTime),
      "Next Action": lead.nextAction || "",
      "Reminder Note": lead.reminderNote || "",
      "Lost Reason": lead.lostReason || "",
      "Call Count": lead.callCount || 0,
      "Last Outcome": lead.lastOutcome || "",
      "Enrolled Courses": coursesStr,
      "Total Fee (₹)": lead.totalFee || 0,
      "Discount Type": lead.discountType || "none",
      "Discount Value": lead.discountValue || 0,
      "Final Fee (₹)": lead.finalFee || 0,
      "Interaction History": commentsList,
      "Created At": formatDateTime(lead.createdAt)
    };
  });

  // 2. Prepare Sheet 2: Follow-ups (Only leads with follow-up dates)
  const followUpsOnly = leadsToExport.filter((lead) => lead.followUpDate);
  const followUpsData = followUpsOnly.map((lead) => {
    let lastCommentText = "";
    if (lead.comments && lead.comments.length > 0) {
      const last = lead.comments[lead.comments.length - 1];
      lastCommentText = `[${formatDateTime(last.addedAt)}] ${last.outcome ? last.outcome + ": " : ""}${last.text}`;
    }

    return {
      "Lead ID": lead.leadId || "",
      "Name": lead.name || "",
      "Phone": lead.phone || "",
      "Follow-up Date": formatDate(lead.followUpDate),
      "Follow-up Time": formatTime12(lead.followUpTime),
      "Quality": lead.quality || "",
      "Priority": lead.priority ? `P${lead.priority}` : "",
      "Stage": lead.stage || "",
      "Reminder Note": lead.reminderNote || "",
      "Last Interaction": lastCommentText
    };
  });

  // Create workbook and worksheets
  const wb = XLSX.utils.book_new();

  const wsLeads = XLSX.utils.json_to_sheet(leadsData);
  const wsFollowUps = XLSX.utils.json_to_sheet(followUpsData);

  // Set sensible column widths for Sheet 1
  wsLeads["!cols"] = [
    { wch: 12 }, // Lead ID
    { wch: 22 }, // Name
    { wch: 16 }, // Phone
    { wch: 25 }, // Email
    { wch: 18 }, // Quality
    { wch: 10 }, // Priority
    { wch: 14 }, // Stage
    { wch: 16 }, // Source
    { wch: 14 }, // Enquiry Date
    { wch: 14 }, // Follow-up Date
    { wch: 14 }, // Follow-up Time
    { wch: 25 }, // Next Action
    { wch: 30 }, // Reminder Note
    { wch: 20 }, // Lost Reason
    { wch: 12 }, // Call Count
    { wch: 22 }, // Last Outcome
    { wch: 30 }, // Enrolled Courses
    { wch: 14 }, // Total Fee
    { wch: 14 }, // Discount Type
    { wch: 14 }, // Discount Value
    { wch: 14 }, // Final Fee
    { wch: 60 }, // Interaction History
    { wch: 20 }  // Created At
  ];

  // Set sensible column widths for Sheet 2
  wsFollowUps["!cols"] = [
    { wch: 12 }, // Lead ID
    { wch: 22 }, // Name
    { wch: 16 }, // Phone
    { wch: 15 }, // Follow-up Date
    { wch: 15 }, // Follow-up Time
    { wch: 18 }, // Quality
    { wch: 10 }, // Priority
    { wch: 14 }, // Stage
    { wch: 30 }, // Reminder Note
    { wch: 50 }  // Last Interaction
  ];

  XLSX.utils.book_append_sheet(wb, wsLeads, "Leads");
  XLSX.utils.book_append_sheet(wb, wsFollowUps, "Follow-ups");

  // Format file name: lead-manager-YYYY-MM-DD.xlsx
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const filename = customFilename || `lead-manager-${yyyy}-${mm}-${dd}.xlsx`;

  XLSX.writeFile(wb, filename);
}
