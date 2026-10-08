/**
 * Email Helper Utilities for Lead Management CRM
 * Tailored for Subham Saha (Learning Consultant) at Henry Harvin Education.
 * Supports zero-admin 1-click Outlook Web composing using the official
 * Microsoft 365 corporate account (subham.saha@henryharvin.in).
 */

export const DEFAULT_COUNSELOR_PROFILE = {
  name: "Subham Saha",
  email: "subham.saha@henryharvin.in",
  designation: "Learning Consultant",
  company: "Henry Harvin® School of Quality Management",
  phone: "+91 98183 31469",
  website: "https://www.henryharvin.com"
};

export const DEFAULT_EMAIL_TEMPLATES = [
  {
    _id: "email-def-1",
    title: "Post Graduate Program in Lean Six Sigma (Agota™ Framework)",
    category: "Curriculum & Syllabus",
    course: "Lean Six Sigma",
    subject: "Regarding Post Graduate Program in Lean Six Sigma Course from Henry Harvin® School of Quality Management",
    body: `Greetings of the day!

Thank you for your interest in the Post Graduate Program in Lean Six Sigma from Henry Harvin® School of Quality Management.

I am Subham your Learning Consultant, and I will be assisting you throughout the admission process. Please find the complete program details below.

**🎯 Why Choose the Post Graduate Program in Lean Six Sigma?**

Our Agota™ Framework is a comprehensive 10-in-1 learning and career development framework designed to help you build practical skills, gain industry exposure, and improve your career opportunities.

**🚀 What You Get With the Program:**

**1. Live Interactive Training**
• **Duration & Format:** 144 hours of two-way live online interactive sessions
• **Faculty:** Learn from experienced industry professionals
• **Flexibility:** Attend unlimited batches with different instructors for the next 12 months at no additional cost

**2. Practical Projects**
Get opportunities to work on practical projects in areas such as:
• **Six Sigma:** Green Belt & Black Belt capstone projects
• **Methodologies:** Design Thinking & Lean Practitioner
• **Analytics:** Advanced Statistics, Analytics using R, RPA, and more

**3. Certification**
• **Credential:** Receive recognized Course Completion Certification in the Post Graduate Program in Lean Six Sigma upon successful completion of the program.

**4. Internship Assistance**
• **Industry Exposure:** Get internship assistance through Henry Harvin® and opportunities with organizations through platforms such as 100X Suite and Yuva Intern (including companies such as J.P. Morgan, Accenture, and others).

**5. Placement Support**
• **Career Support:** Weekly job assistance, placement support, and dedicated career guidance (1-Year Duration).
• **Placement Drives:** Dedicated interview drives & premium job portal access.
• **Personalized Consulting:** 1-on-1 resume review & career counseling.

**6. Gold Membership**
• **Privilege:** 1-Year Gold Membership of Henry Harvin® School of Quality Management.

**7. E-Learning Access**
Access the LMS with 24x7 support:
• **Self-Paced Learning:** HD video lectures & class recordings
• **Study Repository:** PPTs, study materials, quizzes, question banks, practice tests & final assessments
• **Community:** Collaborative learning forum & digital library

**8. Masterclasses**
• **Complimentary Skill Modules:** Full modules covering Soft Skills (Business Communication, Interview Prep, Presentation Skills) and Professional Resume Writing across 52+ Masterclasses.

**9. Student Engagement & Events**
• **Industry Networking:** Connect with peers and industry experts across the academy network through hackathons, competitions, and collaborative community events.

**10. Entrepreneurship Mentorship**
• **Incubation:** Mentorship and support for learners aspiring to initiate their own ventures.

👉 **Detailed Curriculum:** [Click Here to View Program Curriculum](https://www.henryharvin.com/post-graduate-program-in-lean-six-sigma#curriculum)

**Mentor Profile**
• **Experience:** Seasoned domain experts with 15+ years of active industry experience.
• **Track Record:** Mentors have delivered 450+ lectures, hosted 250+ keynotes, and remain actively engaged with corporate placement networks.

**Quick Links & Program Fee**
• **Class Schedule:** [Click Here to View Schedule](https://www.henryharvin.com/post-graduate-program-in-lean-six-sigma)
• **Course Brochure:** [Click Here to View Brochure](https://www.henryharvin.com/post-graduate-program-in-lean-six-sigma)
• **Detailed Curriculum:** [Click Here to View Curriculum](https://www.henryharvin.com/post-graduate-program-in-lean-six-sigma#curriculum)
• **All-Inclusive Program Fee:** {fees}
*(Covers live training, 1-year membership, LMS access, study materials, and applicable taxes)*

**Why Henry Harvin®?**
*"Henry Harvin offers Ivy League-level education with diverse course choice."* — **Business World Education**
*"Giving a boost to vocational qualifications and practical knowledge which is the need of the hour!"* — **Financial Express**

Learn more about Henry Harvin®:
• **About Us:** https://www.henryharvin.com/about-us
• **Media:** https://www.henryharvin.com/media
• **Accreditations & Affiliations:** https://www.henryharvin.com/affiliations-accreditations
• **Customer Reviews:** https://www.henryharvin.com/video-reviews
• **Job Success Stories:** https://www.henryharvin.com/placed-students-list

**🔗 Registration & Enrolment:**
To enroll, you can make the payment securely via Credit Card, Debit Card, Net Banking, UPI, or 0% EMI.
Registration Payment Link: [Click Here to Pay & Register](https://crm.henryharvin.com/portal-new/student-payment)

Please revert to this email if you have any questions, or feel free to call/WhatsApp me directly at {counselorPhone} to discuss your enrolment or to get the best price for this course.

Warm regards,
{counselorName}
{counselorDesignation}
Henry Harvin® School of Quality Management
Phone: {counselorPhone}
Email: {counselorEmail}`,
    isDefault: true,
    sortOrder: 1
  },
  {
    _id: "email-def-2",
    title: "Course Curriculum, Syllabus & Schedule (Universal)",
    category: "Curriculum & Syllabus",
    course: "All Courses",
    subject: "Henry Harvin Education: {course} Curriculum, Syllabus & Schedule for {name}",
    body: `Dear {name},

Greetings from Henry Harvin Education!

Thank you for your enquiry regarding our {course} training and certification program.

As discussed, I am pleased to share the program highlights, syllabus breakdown, and upcoming batch schedule with you:

**Key Program Highlights:**
• **Certification:** Internationally Recognized Certification & 1-Year Gold Membership
• **Practical Training:** 100% Practical Hands-on Training with Real-world Capstone Projects
• **LMS Portal:** 1-Year Unlimited Access to LMS with Class Recordings & Study Materials
• **Career Support:** Dedicated Placement Assistance & Internship Opportunities
• **Mentorship:** 24x7 Dedicated Mentor Support & Doubt Clearing Sessions

**Upcoming Batch Schedule:**
• **Weekend Batch:** Starting this Saturday (Live Interactive Online Sessions)
• **Weekday Evening Batch:** Available on demand

**All-Inclusive Program Fee:** {fees} *(Flexible 0% EMI options available)*

**Quick Links:**
• **Course Curriculum:** [Click Here to View Curriculum](https://www.henryharvin.com/)
• **Student Portal & Registration:** [Click Here to Enroll](https://crm.henryharvin.com/portal-new/student-payment)

Please review the curriculum outline and let me know if you would like me to reserve a provisional seat for you in the upcoming batch.

Looking forward to assisting you in your career journey!

Warm regards,
{counselorName}
{counselorDesignation}
Henry Harvin Education
Phone: {counselorPhone}
Email: {counselorEmail}`,
    isDefault: true,
    sortOrder: 2
  },
  {
    _id: "email-def-3",
    title: "Follow-Up Discussion on Course Enquiry",
    category: "Follow-up",
    course: "All Courses",
    subject: "Following up on your {course} enquiry - Henry Harvin Education",
    body: `Dear {name},

I hope you are having a wonderful day.

I am writing to follow up on our earlier interaction regarding your career development in {course} with Henry Harvin Education.

We are currently finalizing registrations for the upcoming batch starting this weekend. Have you had an opportunity to review the syllabus and program schedule?

If you have any questions regarding:
1. **Course Curriculum:** Module breakdown & industry projects
2. **Batch Timings:** Weekend vs weekday schedules and mentor profile
3. **Fee Structure:** Special scholarship discounts or 0% EMI options

Please reply to this email or let me know a convenient time for a quick 2-minute phone call. I would be happy to guide you!

Warm regards,
{counselorName}
{counselorDesignation}
Henry Harvin Education
Phone: {counselorPhone}
Email: {counselorEmail}`,
    isDefault: true,
    sortOrder: 3
  },
  {
    _id: "email-def-4",
    title: "Exclusive Corporate Scholarship & Fee Offer Letter",
    category: "Scholarship & Offer",
    course: "All Courses",
    subject: "Exclusive Corporate Scholarship Offer: Fee Waiver for {course} - {name}",
    body: `Dear {name},

I am delighted to share some exciting news regarding your admission into the {course} at Henry Harvin Education!

Based on your profile review, you have been approved for an Exclusive Corporate Scholarship Discount for the upcoming batch.

**Fee Structure Breakdown:**
• **Standard Tuition Fee:** {fees}
• **Corporate Scholarship Discount:** Applicable this week
• **Flexible Payment:** 0% Interest EMI options available across major credit cards & Bajaj Finserv

Please note that this special fee benefit is valid strictly for the current batch registration and is allocated on a first-come, first-served basis due to limited class capacity.

Registration Payment Link: [Click Here to Pay & Register](https://crm.henryharvin.com/portal-new/student-payment)

Would you like me to reserve your scholarship seat today?

Warm regards,
{counselorName}
{counselorDesignation}
Henry Harvin Education
Phone: {counselorPhone}
Email: {counselorEmail}`,
    isDefault: true,
    sortOrder: 4
  },
  {
    _id: "email-def-5",
    title: "Free Live Demo Masterclass Invitation",
    category: "Demo Session",
    course: "All Courses",
    subject: "Invitation: Free Live Masterclass / Counseling Demo for {course} - Henry Harvin",
    body: `Dear {name},

We are pleased to invite you to an exclusive Free Live Interactive Masterclass on {course}, hosted by Henry Harvin Education.

**Session Details:**
• **Topic:** Overview, Industry Roadmap & Practical Applications of {course}
• **Trainer:** Senior Industry Practitioner (15+ Years Experience)
• **Platform:** Live on Zoom / Google Meet

**What You Will Learn:**
• **Career Opportunities:** Current industry demand, job roles, and salary expectations
• **Hands-on Exposure:** Walkthrough of key concepts and industry case studies
• **Interactive Q&A:** Direct doubt clearing with the master trainer

Seats are limited to ensure individual attention. Please reply with "YES" to confirm your participation so I can send you the direct meeting link and passkey.

Warm regards,
{counselorName}
{counselorDesignation}
Henry Harvin Education
Phone: {counselorPhone}
Email: {counselorEmail}`,
    isDefault: true,
    sortOrder: 5
  },
  {
    _id: "email-def-6",
    title: "Official Enrollment & Admission Confirmation Link",
    category: "Payment & Enrollment",
    course: "All Courses",
    subject: "Official Enrollment & Admission Confirmation Link - {course} | Henry Harvin",
    body: `Dear {name},

Welcome to the Henry Harvin learning community!

As discussed, please find below your official registration and secure fee payment link to confirm your enrollment in {course}:

**Registration Link:** [Click Here to Pay & Register](https://crm.henryharvin.com/portal-new/student-payment)
(Lead ID: {leadId})

**Next Steps Upon Confirmation:**
1. **LMS Credentials:** Immediate access to the Henry Harvin LMS learning portal
2. **Welcome Kit:** Pre-reading study materials, tool cheat-sheets, and software installation guide
3. **Batch Access:** Direct invitation to batch WhatsApp group and live class access links
4. **Dedicated Mentor:** Introduction to your batch manager and personal course mentor

Please share the transaction screenshot or reference number once completed so I can expedite your batch allocation.

If you require any assistance during payment, feel free to call or WhatsApp me directly.

Warm regards,
{counselorName}
{counselorDesignation}
Henry Harvin Education
Phone: {counselorPhone}
Email: {counselorEmail}`,
    isDefault: true,
    sortOrder: 6
  },
  {
    _id: "email-def-7",
    title: "Did Not Connect / Missed Call Follow-up",
    category: "Did Not Connect",
    course: "All Courses",
    subject: "Tried reaching you regarding your {course} enquiry - Henry Harvin Education",
    body: `Dear {name},

I tried calling you today on your contact number ({phone}) regarding your enquiry for {course} with Henry Harvin Education, but was unable to connect.

I understand you might be busy, so I wanted to drop you a quick note to make sure you have all the necessary details.

Whenever you have a few minutes, please let me know when would be the best time to speak with you today or tomorrow. Alternatively, feel free to reply to this email with your preferred timing or queries.

Looking forward to speaking with you!

Warm regards,
{counselorName}
{counselorDesignation}
Henry Harvin Education
Phone: {counselorPhone}
Email: {counselorEmail}`,
    isDefault: true,
    sortOrder: 7
  }
];

/**
 * Render dynamic variables into an email string (subject or body)
 */
export function renderEmailTemplate(templateString, lead, counselorProfile = DEFAULT_COUNSELOR_PROFILE) {
  if (!templateString) return "";

  const counselor = counselorProfile || DEFAULT_COUNSELOR_PROFILE;
  const cName = counselor.name || "Subham Saha";
  const cEmail = counselor.email || "subham.saha@henryharvin.in";
  const cPhone = counselor.phone || "+91 98183 31469";
  const cDesignation = counselor.designation || "Learning Consultant";

  if (!lead) {
    const isLeanSixSigma =
      templateString.toLowerCase().includes("lean six sigma") ||
      templateString.toLowerCase().includes("89000");
    const defaultFees = isLeanSixSigma ? "INR 89,000" : "₹49,500";

    return templateString
      .replace(/\{name\}/gi, "Student")
      .replace(/\{course\}/gi, "Post Graduate Program in Lean Six Sigma")
      .replace(/\{fees\}/gi, defaultFees)
      .replace(/\{phone\}/gi, "")
      .replace(/\{email\}/gi, "")
      .replace(/\{leadId\}/gi, "")
      .replace(/\{batchDate\}/gi, "Upcoming Weekend Batch")
      .replace(/\{counselorName\}/gi, cName)
      .replace(/\{counselorEmail\}/gi, cEmail)
      .replace(/\{counselorPhone\}/gi, cPhone)
      .replace(/\{counselorDesignation\}/gi, cDesignation);
  }

  const name = lead.name && lead.name.trim() ? lead.name.trim() : "Student";
  const course =
    lead.enrolledCourses && lead.enrolledCourses.length > 0
      ? lead.enrolledCourses[0].courseName
      : lead.courseName && lead.courseName.trim()
      ? lead.courseName.trim()
      : "Post Graduate Program in Lean Six Sigma";

  let fees = course.toLowerCase().includes("lean six sigma") ? "INR 89,000" : "₹49,500";
  if (lead.finalFee && lead.finalFee > 0) {
    fees = `₹${Number(lead.finalFee).toLocaleString("en-IN")}`;
  } else if (lead.totalFee && lead.totalFee > 0) {
    fees = `₹${Number(lead.totalFee).toLocaleString("en-IN")}`;
  } else if (lead.enrolledCourses && lead.enrolledCourses.length > 0 && lead.enrolledCourses[0].fee > 0) {
    fees = `₹${Number(lead.enrolledCourses[0].fee).toLocaleString("en-IN")}`;
  }

  const phone = lead.phone || "";
  const email = lead.email || "";
  const leadId = lead.leadId || "";
  const batchDate = "Upcoming Weekend Batch";

  return templateString
    .replace(/\{name\}/gi, name)
    .replace(/\{course\}/gi, course)
    .replace(/\{fees\}/gi, fees)
    .replace(/\{phone\}/gi, phone)
    .replace(/\{email\}/gi, email)
    .replace(/\{leadId\}/gi, leadId)
    .replace(/\{batchDate\}/gi, batchDate)
    .replace(/\{counselorName\}/gi, cName)
    .replace(/\{counselorEmail\}/gi, cEmail)
    .replace(/\{counselorPhone\}/gi, cPhone)
    .replace(/\{counselorDesignation\}/gi, cDesignation);
}

/**
 * Convert email text (with Markdown **Bold**, *Italics*, [Text](url) and raw URLs) into rich HTML
 * suitable for interactive previews and rich-text clipboard copying into Outlook/Gmail.
 */
export function emailToHtml(rawText) {
  if (!rawText) return "";

  // Step 1: Escape HTML special chars
  let safe = rawText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Step 2: Replace Markdown links: [Anchor Text](https://...)
  const links = [];
  safe = safe.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/gi, (match, text, url) => {
    const token = `___LINK_TOKEN_${links.length}___`;
    // Format any bold/italic that might be inside link text
    let formattedText = text
      .replace(/\*\*([^*\n\r]+?)\*\*/g, '<strong style="font-weight: 700;">$1</strong>')
      .replace(/(?<!\*)\*(?!\s)([^*\n\r]+?)(?<!\s)\*(?!\*)/g, '<em style="font-style: italic;">$1</em>');
    links.push({
      token,
      html: `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #0078d4; text-decoration: underline; font-weight: 600;">${formattedText}</a>`
    });
    return token;
  });

  // Step 3: Replace standalone URLs: https://...
  safe = safe.replace(/(https?:\/\/[^\s<]+)/gi, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #0078d4; text-decoration: underline;">${url}</a>`;
  });

  // Step 4: Parse Bold: **text** or __text__
  safe = safe.replace(/\*\*([^*\n\r]+?)\*\*/g, '<strong style="font-weight: 700; color: inherit;">$1</strong>');
  safe = safe.replace(/__([^_\n\r]+?)__/g, '<strong style="font-weight: 700; color: inherit;">$1</strong>');

  // Step 5: Parse Italic: *text* (excluding bullet lines) or _text_
  safe = safe.replace(/(?<!\*)\*(?!\s)([^*\n\r]+?)(?<!\s)\*(?!\*)/g, '<em style="font-style: italic;">$1</em>');
  safe = safe.replace(/(?<![a-zA-Z0-9_])_(?!\s)([^_\n\r]+?)(?<!\s)_(?![a-zA-Z0-9_])/g, '<em style="font-style: italic;">$1</em>');

  // Step 6: Restore Markdown link tokens
  links.forEach(({ token, html }) => {
    safe = safe.replace(token, html);
  });

  // Step 7: Convert line breaks to <br />
  safe = safe.replace(/\n/g, "<br />");

  return safe;
}

/**
 * Formats Markdown links into text suitable for Outlook Web Deeplink Compose
 * Transforms [Click Here](https://url) -> Click Here ( https://url )
 * so Outlook automatically renders the URL as a clickable link.
 */
export function emailToPlainTextWithUrls(rawText) {
  if (!rawText) return "";
  return rawText.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/gi, "$1 ( $2 )");
}

/**
 * Copies formatted email to clipboard as Rich HTML (MIME: text/html)
 * When pasted (Ctrl+V) into Outlook Web, Outlook Desktop, or Gmail, hyperlinks appear as true clickable links and bold text remains bold.
 */
export async function copyEmailAsRichText({ subject, body }) {
  const htmlBody = emailToHtml(body || "");
  const fullHtml = `
<div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #0f172a;">
  ${htmlBody}
</div>`.trim();

  const plainText = emailToPlainTextWithUrls(body || "");

  if (typeof ClipboardItem !== "undefined" && navigator.clipboard && navigator.clipboard.write) {
    try {
      const blobHtml = new Blob([fullHtml], { type: "text/html" });
      const blobText = new Blob([plainText], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": blobHtml,
          "text/plain": blobText
        })
      ]);
      return true;
    } catch (err) {
      console.warn("ClipboardItem write failed, falling back to writeText:", err);
    }
  }

  // Fallback to plain text
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(plainText);
    return true;
  }
  return false;
}

/**
 * 1-Click Microsoft 365 Outlook Web Deep Link
 * Opens compose pane directly inside Subham's active session at outlook.office.com
 */
export function getOutlookComposeUrl({ to, subject, body }) {
  const encTo = encodeURIComponent(to || "");
  const encSubject = encodeURIComponent(subject || "");
  const encBody = encodeURIComponent(body || "");

  return `https://outlook.office.com/mail/deeplink/compose?to=${encTo}&subject=${encSubject}&body=${encBody}`;
}

/**
 * 1-Click Outlook Live / Personal fallback
 */
export function getOutlookLiveComposeUrl({ to, subject, body }) {
  const encTo = encodeURIComponent(to || "");
  const encSubject = encodeURIComponent(subject || "");
  const encBody = encodeURIComponent(body || "");

  return `https://outlook.live.com/mail/0/deeplink/compose?to=${encTo}&subject=${encSubject}&body=${encBody}`;
}

/**
 * 1-Click Gmail Web Compose URL (fallback)
 */
export function getGmailComposeUrl({ to, subject, body, counselorEmail = "subham.saha@henryharvin.in" }) {
  const encTo = encodeURIComponent(to || "");
  const encSu = encodeURIComponent(subject || "");
  const encBody = encodeURIComponent(body || "");
  const encUser = encodeURIComponent(counselorEmail || "subham.saha@henryharvin.in");

  return `https://mail.google.com/mail/?authuser=${encUser}&view=cm&fs=1&to=${encTo}&su=${encSu}&body=${encBody}`;
}

/**
 * Standard mailto: URL for local desktop mail client (Outlook desktop, etc.)
 */
export function getMailtoUrl({ to, subject, body }) {
  const encTo = encodeURIComponent(to || "");
  const encSu = encodeURIComponent(subject || "");
  const encBody = encodeURIComponent(body || "");

  return `mailto:${encTo}?subject=${encSu}&body=${encBody}`;
}
