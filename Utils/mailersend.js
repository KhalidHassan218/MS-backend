/**
 * MailerSend API email sender utility
 * Save this file as: Utils/mailersend.js
 */

const MAILERSEND_API_URL = 'https://api.mailersend.com/v1/email';

// Environment-based configuration
const getConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    apiKey: process.env.MAILERSEND_API_KEY,
    // domain: isProduction 
    //   ? 'microsoftsupplier.com' 
    //   : 'test-zxk54v8y53pljy6v.mlsender.net',
    domain: process.env.MAILERSEND_DOMAIN,
    defaultFrom:process.env.MAILERSEND_INFOEMAIL,
    defaultReplyTo: process.env.MAILERSEND_INFOEMAIL
    // defaultFrom: isProduction
    //   ? 'info@microsoftsupplier.com'
    //   : 'info@test-zxk54v8y53pljy6v.mlsender.net',
    // defaultReplyTo: isProduction
    //   ? 'info@microsoftsupplier.com'
    //   : 'info@test-zxk54v8y53pljy6v.mlsender.net',
  };
};

export async function sendMail({
  to,
  subject,
  html,
  from,
  fromName = 'Microsoft Supplier',
  replyTo,
  attachments = [],
  isMarketing = false,
  unsubscribeUrl = '',
  maxRetries = 3,
}) {
  const config = getConfig();

  if (!config.apiKey) {
    throw new Error('❌ MAILERSEND_API_KEY not configured in environment variables');
  }

  const senderEmail = from || config.defaultFrom;
  const replyToEmail = replyTo || config.defaultReplyTo;

  // Build clean payload without undefined values
  const payload = {
    from: {
      email: senderEmail,
      name: fromName,
    },
    to: [
      {
        email: to,
      },
    ],
    subject,
    html,
    reply_to: {
      email: replyToEmail,
    },
  };

  // Only add attachments if they exist
  if (attachments && attachments.length > 0) {
    payload.attachments = attachments.map((att) => {
      let base64Content;

      // Handle different content types
      if (typeof att.content === 'string') {
        // Already a string, assume it's base64 encoded
        base64Content = att.content;
      } else if (Buffer.isBuffer(att.content)) {
        // Node.js Buffer object
        base64Content = att.content.toString('base64');
      } else if (Array.isArray(att.content) || ArrayBuffer.isView(att.content)) {
        // Array or TypedArray (Uint8Array, etc.) - convert to Buffer first
        base64Content = Buffer.from(att.content).toString('base64');
      } else {
        // Fallback: attempt to convert to Buffer
        try {
          base64Content = Buffer.from(att.content).toString('base64');
        } catch (error) {
          throw new Error(`Invalid attachment content type for ${att.filename}: ${typeof att.content}`);
        }
      }

      return {
        content: base64Content,
        filename: att.filename,
        disposition: att.disposition || 'attachment',
      };
    });
  }

  // Remove any undefined/null values that might cause API errors
  Object.keys(payload).forEach(key => {
    if (payload[key] === undefined || payload[key] === null) {
      delete payload[key];
    }
  });

  let attempt = 0;
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Debug: Log payload (remove sensitive data)
  console.log('📤 Sending email payload:', JSON.stringify({
    ...payload,
    html: payload.html ? `[HTML content ${payload.html.length} chars]` : undefined,
    attachments: payload.attachments ? payload.attachments.map(att => ({
      filename: att.filename,
      size: att.content ? `${att.content.length} chars (base64)` : 'empty',
      disposition: att.disposition
    })) : undefined
  }, null, 2));

  while (attempt < maxRetries) {
    try {
      const response = await fetch(MAILERSEND_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.text();
        console.log(`📧 Email sent successfully to ${to} [${config.domain}]`);
        return {
          success: true,
          messageId: response.headers.get('x-message-id'),
          environment: process.env.NODE_ENV,
          domain: config.domain,
        };
      }

      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 429) {
        attempt++;
        const backoffTime = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.warn(`⚠️ Rate limit hit. Retry ${attempt}/${maxRetries} in ${backoffTime}ms`);
        await delay(backoffTime);
        continue;
      }

      // Log error and break
      console.error(
        `MailerSend API Error (${response.status}): ${
          errorData.message || response.statusText
        }`
      );
      break;

    } catch (error) {
      if (attempt >= maxRetries - 1) {
        console.error('❌ Email failed after maximum retries:', error.message);
        break;
      }
      
      attempt++;
      const backoffTime = 1000 * attempt;
      console.warn(`⚠️ Email error. Retry ${attempt}/${maxRetries} in ${backoffTime}ms`);
      await delay(backoffTime);
    }
  }

  // Never throw, just log and return failure
  return {
    success: false,
    error: 'Email failed to send. See logs for details.',
    environment: process.env.NODE_ENV,
    domain: config.domain,
  };
}

export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return { valid: false, reason: 'Invalid email format' };
  }

  const domain = email.split('@')[1].toLowerCase();
  const commonTypos = {
    'gmial.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'yahou.com': 'yahoo.com',
    'yaho.com': 'yahoo.com',
    'hotmial.com': 'hotmail.com',
  };

  if (commonTypos[domain]) {
    return { 
      valid: false, 
      reason: `Did you mean ${email.split('@')[0]}@${commonTypos[domain]}?`,
      suggestion: `${email.split('@')[0]}@${commonTypos[domain]}`
    };
  }

  return { valid: true };
}