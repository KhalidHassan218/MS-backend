import { sendMail } from './mailersend.js';

/**
 * Complete multi-language verification email templates
 * 100% MailerSend compliant with translated compliance footers
 */
export const verificationTemplates = {
  NL: {
    subject: "Verifieer uw e-mailadres - Microsoft Supplier",
    title: "Verifieer uw e-mailadres",
    message: "U heeft zich geregistreerd bij Microsoft Supplier. Om uw account te activeren, moet u uw e-mailadres verifiëren.",
    billingTitle: "Verifieer uw facturatie e-mail",
    billingMessage: "Verifieer dit e-mailadres om facturen en betalingsupdates te ontvangen op dit adres.",
    button: "E-MAILADRES VERIFIËREN",
    alternativeText: "Als de knop niet werkt, kopieer en plak deze link in uw browser:",
    expiryNote: "⏱️ Deze verificatielink verloopt over 24 uur.",
    securityTitle: "🔒 Beveiligingsherinnering",
    securityMessage: "Als u deze verificatie niet heeft aangevraagd, negeer dan deze e-mail.",
    questions: "Vragen? Antwoord op deze e-mail",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026"
  },
  EN: {
    subject: "Verify Your Email Address - Microsoft Supplier",
    title: "Verify Your Email Address",
    message: "You have registered with Microsoft Supplier. To activate your account, you need to verify your email address.",
    billingTitle: "Verify Your Billing Email",
    billingMessage: "Please verify this email address to receive invoices and billing updates at this address.",
    button: "VERIFY EMAIL ADDRESS",
    alternativeText: "If the button doesn't work, copy and paste this link into your browser:",
    expiryNote: "⏱️ This verification link will expire in 24 hours.",
    securityTitle: "🔒 Security Reminder",
    securityMessage: "If you did not request this verification, please ignore this email.",
    questions: "Questions? Reply to this email",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026"
  },
  FR: {
    subject: "Vérifiez votre adresse e-mail - Microsoft Supplier",
    title: "Vérifiez votre adresse e-mail",
    message: "Vous vous êtes inscrit chez Microsoft Supplier. Pour activer votre compte, vous devez vérifier votre adresse e-mail.",
    billingTitle: "Vérifiez votre e-mail de facturation",
    billingMessage: "Veuillez vérifier cette adresse e-mail pour recevoir vos factures et mises à jour de paiement.",
    button: "VÉRIFIER L'ADRESSE E-MAIL",
    alternativeText: "Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :",
    expiryNote: "⏱️ Ce lien de vérification expirera dans 24 hours.",
    securityTitle: "🔒 Rappel de sécurité",
    securityMessage: "Si vous n'avez pas demandé cette vérification, veuillez ignorer cet e-mail.",
    questions: "Des questions ? Répondez à cet e-mail",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026"
  },
  DE: {
    subject: "Verifizieren Sie Ihre E-Mail-Adresse - Microsoft Supplier",
    title: "Verifizieren Sie Ihre E-Mail-Adresse",
    message: "Sie haben sich bei Microsoft Supplier registriert. Um Ihr Konto zu aktivieren, müssen Sie Ihre E-Mail-Adresse verifizieren.",
    billingTitle: "Rechnungs-E-Mail verifizieren",
    billingMessage: "Bitte verifizieren Sie diese E-Mail-Adresse, um Rechnungen und Zahlungs-Updates zu erhalten.",
    button: "E-MAIL-ADRESSE VERIFIZIEREN",
    alternativeText: "Wenn die Schaltfläche nicht funktioniert, kopieren Sie diesen Link und fügen Sie ihn in Ihren Browser ein:",
    expiryNote: "⏱️ Dieser Verifizierungslink läuft in 24 Stunden ab.",
    securityTitle: "🔒 Sicherheitshinweis",
    securityMessage: "Wenn Sie diese Verifizierung nicht angefordert haben, ignorieren Sie bitte diese E-Mail.",
    questions: "Fragen? Antworten Sie auf diese E-Mail",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026"
  },
  ES: {
    subject: "Verifique su dirección de correo electrónico - Microsoft Supplier",
    title: "Verifique su dirección de correo electrónico",
    message: "Se ha registrado en Microsoft Supplier. Para activar su cuenta, debe verificar su dirección de correo electrónico.",
    billingTitle: "Verifique su correo de facturación",
    billingMessage: "Verifique esta dirección de correo electrónico para recibir facturas y actualizaciones de facturación.",
    button: "VERIFICAR DIRECCIÓN DE CORREO",
    alternativeText: "Si el botón no funciona, copie y pegue este enlace en su navegador:",
    expiryNote: "⏱️ Este enlace de verificación caducará en 24 horas.",
    securityTitle: "🔒 Recordatorio de seguridad",
    securityMessage: "Si no solicitó esta verificación, ignore este correo electrónico.",
    questions: "¿Preguntas? Responda a este correo",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026"
  }
};

/**
 * Generate verification email HTML matching accept/decline style
 */
export function generateVerificationEmailHTML(verifyUrl, customerName = "", lang = "EN", isBilling = false) {
  const t = verificationTemplates[lang.toUpperCase()] || verificationTemplates.EN;

  // Toggle strings based on whether this is for Billing or Work email
  const displayTitle = isBilling ? (t.billingTitle || t.title) : t.title;
  const displayMessage = isBilling ? (t.billingMessage || t.message) : t.message;

  return `
<!DOCTYPE html>
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
      .mobile-box { padding: 16px !important; margin: 20px 0 !important; }
      .mobile-button { padding: 12px 30px !important; font-size: 14px !important; }
      .mobile-logo { height: 40px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #F8FAFC;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">

      <div class="mobile-padding" style="padding: 50px 40px 40px; text-align: center;">
        <img class="mobile-logo" src="https://firebasestorage.googleapis.com/v0/b/supplier-34b95.appspot.com/o/assets%2FMSlogo.png?alt=media&token=f5524581-bc40-41c6-8c56-61906b61b4b0"
             alt="Logo"
             style="height: 48px;">
      </div>

      <div class="mobile-content" style="padding: 0 40px 50px; text-align: center;">

        <h1 class="mobile-title" style="color: #1a202c; margin: 0 0 30px 0; font-size: 26px; font-weight: 400; letter-spacing: -0.3px;">
          ${displayTitle}
        </h1>

        <p class="mobile-text" style="color: #4a5568; margin: 0 0 35px 0; font-size: 16px; line-height: 1.5;">
          ${displayMessage}
        </p>

        <a href="${verifyUrl}" class="mobile-button" style="display: inline-block; background: #2d3748; color: #ffffff; padding: 14px 45px; text-decoration: none; font-size: 15px; letter-spacing: 0.3px; border-radius: 6px;">
          ${t.button}
        </a>

        <div class="mobile-box" style="background: #f7fafc; padding: 24px; margin: 35px 0; text-align: left; border-radius: 6px;">
          <p class="mobile-small" style="color: #718096; margin: 0 0 12px 0; font-size: 13px; letter-spacing: 0.5px;">
            ${t.alternativeText}
          </p>
          <a href="${verifyUrl}" class="mobile-small" style="color: #2d3748; word-break: break-all; font-size: 13px; text-decoration: underline;">
            ${verifyUrl}
          </a>
        </div>

        <div class="mobile-box" style="background: #fef3c7; padding: 20px; margin: 0 0 25px 0; text-align: left; border-radius: 6px; border-left: 4px solid #f59e0b;">
          <p class="mobile-small" style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.6;">
            ${t.expiryNote}
          </p>
        </div>

        <div class="mobile-box" style="background: #f7fafc; padding: 20px; margin: 0 0 35px 0; text-align: left; border-radius: 6px;">
          <p class="mobile-small" style="color: #718096; margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">
            ${t.securityTitle}
          </p>
          <p class="mobile-small" style="color: #4a5568; margin: 0; font-size: 14px; line-height: 1.6;">
            ${t.securityMessage}
          </p>
        </div>

        <p class="mobile-small" style="color: #a0aec0; margin: 0; font-size: 14px;">
          ${t.questions}
        </p>
      </div>

      <div class="mobile-footer" style="padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p class="mobile-small" style="color: #a0aec0; margin: 0 0 4px 0; font-size: 13px; letter-spacing: 0.3px;">
          ${t.footer}
        </p>
        <p class="mobile-small" style="color: #cbd5e0; margin: 0; font-size: 12px;">
          ${t.copyright}
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Send verification email using MailerSend
 */
export async function sendVerificationEmail({
  email,
  verifyUrl,
  customerName = "",
  lang = "EN",
  isBilling = false
}) {
  const t = verificationTemplates[lang.toUpperCase()] || verificationTemplates.EN;

  const html = generateVerificationEmailHTML(verifyUrl, customerName, lang, isBilling);

  return await sendMail({
    to: email,
    subject: t.subject,
    html,
    fromName: 'Microsoft Supplier',
    replyTo: 'info@microsoftsupplier.com',
    isMarketing: false, // CRITICAL: This is transactional
  });
}

export default sendVerificationEmail;