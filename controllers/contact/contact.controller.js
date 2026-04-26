import { sendContactFormEmails } from "../../Utils/contact-email.js";

const ALLOWED_SUBJECTS = [
  "licensing",
  "bulk",
  "compliance",
  "support",
  "other",
];

export async function submitContactForm(req, res) {
  try {
    const { company, email, subject, message, lang } = req.body;

    // Validate required fields
    if (!company || !email || !subject || !message) {
      return res
        .status(400)
        .json({ success: false, error: "All fields are required." });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid email address." });
    }

    if (!ALLOWED_SUBJECTS.includes(subject)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid subject." });
    }

    if (message.trim().length < 10) {
      return res
        .status(400)
        .json({ success: false, error: "Message is too short." });
    }

    const { adminResult } = await sendContactFormEmails({
      company: company.trim(),
      email: email.trim().toLowerCase(),
      subject,
      message: message.trim(),
      lang: lang || 'en',
    });

    if (!adminResult.success) {
      console.error("❌ Contact form: admin notification failed", adminResult);
      return res
        .status(500)
        .json({
          success: false,
          error: "Failed to send message. Please try again.",
        });
    }

    console.log(
      `📩 Contact form submitted by ${company} <${email}> — subject: ${subject}`,
    );
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Contact form error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Server error. Please try again later." });
  }
}
