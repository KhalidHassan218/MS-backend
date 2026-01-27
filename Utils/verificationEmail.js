// Verification email templates in all supported languages
export const verificationTemplates = {
  NL: {
    subject: "Verifieer uw e-mailadres voor uw account",
    greeting: "Geachte heer/mevrouw",
    message: "Verifieer uw e-mailadres door op onderstaande knop te klikken.",
    button: "E-mailadres verifiëren",
    closing: "Hoogachtend",
    company: "Sertic Support Team",
  },
  EN: {
    subject: "Please verify your email address",
    greeting: "Dear Customer",
    message: "Please verify your email address by clicking the button below.",
    button: "Verify Email Address",
    closing: "Sincerely",
    company: "Sertic Support Team",
  },
  FR: {
    subject: "Veuillez vérifier votre adresse e-mail",
    greeting: "Madame, Monsieur",
    message:
      "Veuillez vérifier votre adresse e-mail en cliquant sur le bouton ci-dessous.",
    button: "Vérifier l'adresse e-mail",
    closing: "Cordialement",
    company: "Équipe d'assistance Sertic",
  },
  DE: {
    subject: "Bitte verifizieren Sie Ihre E-Mail-Adresse",
    greeting: "Sehr geehrte Damen und Herren",
    message:
      "Bitte verifizieren Sie Ihre E-Mail-Adresse, indem Sie auf die Schaltfläche unten klicken.",
    button: "E-Mail-Adresse verifizieren",
    closing: "Mit freundlichen Grüßen",
    company: "Sertic Support Team",
  },
};

export function generateVerificationEmailHTML(
  verifyUrl,
  customerName = "",
  lang = "EN",
) {
  const t =
    verificationTemplates[lang.toUpperCase()] || verificationTemplates.EN;
  return `
   <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.subject}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
      background: #f5f5f5;
      margin: 0; 
      padding: 20px;
      line-height: 1.6;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
    }
    .container { 
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: #ffffff;
      padding: 32px 24px;
      text-align: center;
      border-bottom: 3px solid #0078d4;
    }
    .logo img { 
      max-width: 200px;
      height: auto;
    }
    .content {
      padding: 40px 32px;
    }
    .greeting { 
      font-size: 24px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 16px;
    }
    .message { 
      font-size: 16px;
      color: #4a4a4a;
      margin-bottom: 32px;
      line-height: 1.7;
    }
    .button-wrapper {
      text-align: center;
      margin-bottom: 32px;
    }
    .button { 
      display: inline-block;
      background: #0078d4;
      color: #ffffff;
      text-decoration: none;
      padding: 16px 48px;
      border-radius: 4px;
      font-size: 16px;
      font-weight: 600;
      transition: background 0.2s ease;
    }
    .button:hover {
      background: #005a9e;
    }
    .divider {
      height: 1px;
      background: #e0e0e0;
      margin: 32px 0;
    }
    .security-note {
      background: #f0f6fc;
      border-left: 4px solid #0078d4;
      padding: 16px;
      border-radius: 4px;
      margin-bottom: 24px;
    }
    .security-note p {
      font-size: 14px;
      color: #5a5a5a;
      margin: 0;
    }
    .footer { 
      text-align: center;
      color: #737373;
      font-size: 14px;
      padding: 24px 32px;
      background: #fafafa;
      border-top: 1px solid #e8e8e8;
    }
    .footer-company {
      font-weight: 600;
      color: #0078d4;
      margin-top: 8px;
    }
    .social-links {
      margin-top: 16px;
    }
    .social-links a {
      display: inline-block;
      margin: 0 8px;
      color: #737373;
      text-decoration: none;
      font-size: 12px;
    }
    .social-links a:hover {
      color: #0078d4;
    }
    
    @media only screen and (max-width: 600px) {
      body { padding: 10px; }
      .content { padding: 32px 24px; }
      .greeting { font-size: 20px; }
      .message { font-size: 15px; }
      .button { padding: 14px 32px; font-size: 15px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="container">
      <div class="header">
        <div class="logo">
          <img src="https://firebasestorage.googleapis.com/v0/b/supplier-34b95.appspot.com/o/assets%2FMSlogo.png?alt=media&token=f5524581-bc40-41c6-8c56-61906b61b4b0" alt="Microsoft Supplier Logo">
        </div>
      </div>
      
      <div class="content">
        <div class="greeting">${t.greeting}${customerName ? ", " + customerName : ""}!</div>
        <div class="message">${t.message}</div>
        
        <div class="button-wrapper">
          <a class="button" href="${verifyUrl}">${t.button}</a>
        </div>
        
        <div class="divider"></div>
        
        <div class="security-note">
          <p><strong>Security reminder:</strong> This email contains a verification link. If you didn't request this action, please disregard this message and contact support.</p>
        </div>
      </div>
      
      <div class="footer">
        <div>${t.closing}</div>
        <div class="footer-company">${t.company}</div>
        <div class="social-links">
          <a href="#">Privacy Policy</a> | 
          <a href="#">Terms of Service</a> | 
          <a href="#">Contact Support</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
