import { sendMail } from './mailersend.js';

/**
 * Send email with attachments using MailerSend
 * 
 * @param {string} subject - Email subject
 * @param {string} message - HTML message content
 * @param {string} send_to - Recipient email address
 * @param {string} sent_from - Sender email (optional, uses default)
 * @param {string} reply_to - Reply-to address (optional)
 * @param {Array} attachment - Array of attachment objects
 * @param {number} maxRetries - Maximum retry attempts
 * 
 * Attachment format:
 * [
 *   {
 *     content: 'base64-encoded-string',
 *     filename: 'invoice.pdf',
 *     disposition: 'attachment' // or 'inline'
 *   }
 * ]
 */
async function sendEmailWithAttachment(
  subject,
  message,
  send_to,
  sent_from = null,
  reply_to = null,
  attachment = [],
  maxRetries = 3
) {
  try {
    // Validate recipient email
    // if (!send_to || !send_to.includes('@')) {
    //   throw new Error('Invalid recipient email address');
    // }

    const recipients = Array.isArray(send_to) ? send_to : [send_to];
    for (const email of recipients) {
      if (!email || !email.includes('@')) {
        throw new Error(`Invalid recipient email address: ${email}`);
      }
    }

    // Prepare attachments for MailerSend format
    const formattedAttachments = attachment && attachment.length > 0
      ? attachment.map(att => ({
          content: att.content, // Base64 string
          filename: att.filename,
          disposition: att.disposition || 'attachment',
        }))
      : [];

    const result = await sendMail({
      to: send_to,
      subject,
      html: message,
      from: sent_from,
      replyTo: reply_to,
      attachments: formattedAttachments,
      maxRetries,
      isMarketing: false, // Transactional email
    });

    console.log(`📧 Email with attachment sent to ${send_to}`);
    return result;
  } catch (error) {
    console.error('❌ Failed to send email with attachment:', error.message);
    throw error;
  }
}

export default sendEmailWithAttachment;