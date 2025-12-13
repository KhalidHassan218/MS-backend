const nodemailer = require("nodemailer");

const sendEmailToClient = async (
  subject,
  message,
  send_to,
  sent_from,
  reply_to,
  attachment,
  maxRetries = 5
) => {

   const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    // port: 587,
    port: 2525,
    auth: {
      user: '9cdd6e001@smtp-brevo.com',
      pass: 'bskuptBWkrHKv5V',
    },
    secure: false,
  });
  const mailOptions = {
    from: '<info@microsoftsupplier.com>',
    to: send_to,
    replyTo: reply_to,
    subject: subject,
    html: message,
    attachments: attachment ? attachment : [],
  };

  // ---- RETRY LOGIC ----
  let attempt = 0;
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  while (attempt < maxRetries) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log("📧 Email sent:", info.response);
      return info;
    } catch (err) {
      // Only retry if it's a rate limit (450)
      if (err.responseCode === 450) {
        attempt++;
        console.error(
          `⚠️ SMTP rate limit hit (450). Retry ${attempt}/${maxRetries} in ${attempt * 2000}ms`
        );
        await delay(attempt * 2000); // exponential backoff
      } else {
        console.error("❌ Non-retryable email error:", err);
        throw err; // break on other errors
      }
    }
  }

  throw new Error("❌ Email failed after maximum retries.");
};

module.exports = sendEmailToClient;
