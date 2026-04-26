import sendEmailWithAttachment from './sendEmailWithAttachment.js';
import 'dotenv/config';  // ✅ Add this line at the top

// Generate English email content
function generateEmailContent() {
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @media only screen and (max-width: 600px) {
      .mobile-title { font-size: 20px !important; margin: 0 0 20px 0 !important; }
      .mobile-text { font-size: 14px !important; }
      .mobile-small { font-size: 12px !important; }
      .mobile-padding { padding: 30px 20px 30px !important; }
      .mobile-content { padding: 0 20px 30px !important; }
      .mobile-footer { padding: 20px !important; }
      .mobile-box { padding: 16px !important; margin: 0 0 20px 0 !important; }
      .mobile-logo { height: 40px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #F8FAFC;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">

      <!-- Logo -->
      <div class="mobile-padding" style="padding: 50px 40px 40px; text-align: center;">
        <img class="mobile-logo" src="https://yaodjyiimubilqhamwlx.supabase.co/storage/v1/object/sign/MS%20Files/Screenshot%202026-04-26%20at%204.34.42%20PM.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iOGZhOGVlZi01NmI4LTRlYjUtOGJjYS1lZjFjYTlkZDkyOGMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJNUyBGaWxlcy9TY3JlZW5zaG90IDIwMjYtMDQtMjYgYXQgNC4zNC40MiBQTS5wbmciLCJpYXQiOjE3NzcyMDcxODQsImV4cCI6NDkzMDgwNzE4NH0.cyDgOySfJl4Wb_cMRKXHTApYt-aI1U9ymPJeALha8Hk"
             alt="Microsoft Supplier"
             style="height: 48px;">
      </div>

      <!-- Content -->
      <div class="mobile-content" style="padding: 0 40px 50px; text-align: center;">

        <h1 class="mobile-title" style="color: #1a202c; margin: 0 0 30px 0; font-size: 26px; font-weight: 400; letter-spacing: -0.3px;">
          Order Confirmed
        </h1>

        <p class="mobile-text" style="color: #4a5568; margin: 0 0 20px 0; font-size: 16px; line-height: 1.5;">
          Hello Test User,
        </p>

        <p class="mobile-text" style="color: #4a5568; margin: 0 0 35px 0; font-size: 16px; line-height: 1.5;">
          Thank you for your order. The licenses have been successfully processed and the documents are now available.
        </p>

        <!-- Attachments Box -->
        <div class="mobile-box" style="background: #f7fafc; padding: 24px; margin: 0 0 35px 0; text-align: left; border-radius: 6px;">
          <p class="mobile-small" style="color: #718096; margin: 0 0 12px 0; font-size: 13px; letter-spacing: 0.5px;">ATTACHMENTS</p>
          <p class="mobile-small" style="color: #2d3748; margin: 0; font-size: 14px; line-height: 1.8;">
            • The invoice (VAT 0% – Export outside EU)<br>
            • The license document (containing all license keys)
          </p>
        </div>

        <!-- Important Info Box -->
        <div class="mobile-box" style="background: #fef3c7; padding: 20px; margin: 0 0 35px 0; text-align: left; border-radius: 6px; border-left: 4px solid #f59e0b;">
          <p class="mobile-small" style="color: #92400e; margin: 0 0 8px 0; font-size: 13px; font-weight: 600; letter-spacing: 0.5px;">
            IMPORTANT INFORMATION
          </p>
          <p class="mobile-small" style="color: #92400e; margin: 0; font-size: 13px; line-height: 1.6;">
            • The licenses activate online immediately (no phone activation required)<br>
            • Warranty: 36 months<br>
            • The licenses are supplied through our internal distribution system<br>
            • Delivery method: Digital ESD licenses via email (no physical shipment)<br>
            • Not subject to U.S. sales tax
          </p>
        </div>

        <p class="mobile-small" style="color: #a0aec0; margin: 0; font-size: 14px;">
          Questions? Reply to this email
        </p>

        <p class="mobile-small" style="color: #4a5568; margin: 30px 0 0 0; font-size: 14px; line-height: 1.8;">
          Kind regards,<br>
          S.R. (Sergio) Eersel<br>
          <span style="color: #a0aec0;">Founder @ Sertic</span>
        </p>
      </div>

      <!-- Footer -->
      <div class="mobile-footer" style="padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p class="mobile-small" style="color: #a0aec0; margin: 0 0 4px 0; font-size: 13px; letter-spacing: 0.3px;">
          MICROSOFT SUPPLIER
        </p>
        <p class="mobile-small" style="color: #cbd5e0; margin: 0; font-size: 12px;">
          © 2026
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return {
    subject: 'Your Microsoft Supplier Order',
    html: htmlContent,
  };
}

// Send test email
async function sendTestEmail() {
  try {
    console.log('\n📧 Testing Order Confirmation Email - English');
    console.log('Recipient: omar3691113@gmail.com');
    console.log('='.repeat(60));

    const emailContent = generateEmailContent();

    await sendEmailWithAttachment(
      emailContent.subject,
      emailContent.html,
      'omar3691113@gmail.com',
      null,
      null,
      [] // No attachments for test
    );

    console.log('✅ Email sent successfully!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
  }
}

sendTestEmail();
