// ============================================
// FILE: Utils/client-emails.js
// Accept/Decline registration emails - Minimal Design
// ============================================

import { sendMail } from './mailersend.js';

const translations = {
  en: {
    accepted: {
      subject: 'Account Approved - Microsoft Supplier',
      title: 'Account Approved',
      message: 'Your Microsoft Supplier account is now active.',
      accountDetails: 'ACCOUNT DETAILS',
      button: 'SIGN IN',
      questions: 'Questions? Reply to this email',
      footer: 'MICROSOFT SUPPLIER',
      copyright: '© 2026',
    },
    declined: {
      subject: 'Application Update - Microsoft Supplier',
      title: 'Application Update',
      message: 'We are unable to approve your application at this time.',
      reason1: 'Missing information',
      reason2: 'Unable to verify details',
      reason3: 'Requirements not met',
      note: 'You may reapply or contact us for clarification.',
      button: 'CONTACT US',
      closing: 'Thank you for your interest',
      footer: 'MICROSOFT SUPPLIER',
      copyright: '© 2026',
    },
  },
  de: {
    accepted: {
      subject: 'Konto genehmigt - Microsoft Supplier',
      title: 'Konto genehmigt',
      message: 'Ihr Microsoft Supplier-Konto ist jetzt aktiv.',
      accountDetails: 'KONTODETAILS',
      button: 'ANMELDEN',
      questions: 'Fragen? Antworten Sie auf diese E-Mail',
      footer: 'MICROSOFT SUPPLIER',
      copyright: '© 2026',
    },
    declined: {
      subject: 'Antragsupdate - Microsoft Supplier',
      title: 'Antragsupdate',
      message: 'Wir können Ihren Antrag derzeit nicht genehmigen.',
      reason1: 'Fehlende Informationen',
      reason2: 'Details nicht verifizierbar',
      reason3: 'Anforderungen nicht erfüllt',
      note: 'Sie können erneut beantragen oder uns kontaktieren.',
      button: 'KONTAKT',
      closing: 'Vielen Dank für Ihr Interesse',
      footer: 'MICROSOFT SUPPLIER',
      copyright: '© 2026',
    },
  },
  fr: {
    accepted: {
      subject: 'Compte approuvé - Microsoft Supplier',
      title: 'Compte approuvé',
      message: 'Votre compte Microsoft Supplier est maintenant actif.',
      accountDetails: 'DÉTAILS DU COMPTE',
      button: 'SE CONNECTER',
      questions: 'Des questions ? Répondez à cet e-mail',
      footer: 'MICROSOFT SUPPLIER',
      copyright: '© 2026',
    },
    declined: {
      subject: 'Mise à jour candidature - Microsoft Supplier',
      title: 'Mise à jour candidature',
      message: 'Nous ne pouvons pas approuver votre candidature pour le moment.',
      reason1: 'Informations manquantes',
      reason2: 'Impossible de vérifier les détails',
      reason3: 'Exigences non satisfaites',
      note: 'Vous pouvez postuler à nouveau ou nous contacter.',
      button: 'NOUS CONTACTER',
      closing: 'Merci pour votre intérêt',
      footer: 'MICROSOFT SUPPLIER',
      copyright: '© 2026',
    },
  },
  es: {
    accepted: {
      subject: 'Cuenta aprobada - Microsoft Supplier',
      title: 'Cuenta aprobada',
      message: 'Su cuenta de Microsoft Supplier ya está activa.',
      accountDetails: 'DETALLES DE CUENTA',
      button: 'INICIAR SESIÓN',
      questions: '¿Preguntas? Responda a este correo',
      footer: 'MICROSOFT SUPPLIER',
      copyright: '© 2026',
    },
    declined: {
      subject: 'Actualización solicitud - Microsoft Supplier',
      title: 'Actualización solicitud',
      message: 'No podemos aprobar su solicitud en este momento.',
      reason1: 'Información faltante',
      reason2: 'No se pueden verificar detalles',
      reason3: 'Requisitos no cumplidos',
      note: 'Puede volver a solicitar o contactarnos.',
      button: 'CONTACTAR',
      closing: 'Gracias por su interés',
      footer: 'MICROSOFT SUPPLIER',
      copyright: '© 2026',
    },
  },
  nl: {
    accepted: {
      subject: 'Account goedgekeurd - Microsoft Supplier',
      title: 'Account goedgekeurd',
      message: 'Uw Microsoft Supplier-account is nu actief.',
      accountDetails: 'ACCOUNTGEGEVENS',
      button: 'INLOGGEN',
      questions: 'Vragen? Antwoord op deze e-mail',
      footer: 'MICROSOFT SUPPLIER',
      copyright: '© 2026',
    },
    declined: {
      subject: 'Aanvraagupdate - Microsoft Supplier',
      title: 'Aanvraagupdate',
      message: 'We kunnen uw aanvraag op dit moment niet goedkeuren.',
      reason1: 'Ontbrekende informatie',
      reason2: 'Kan details niet verifiëren',
      reason3: 'Vereisten niet voldaan',
      note: 'U kunt opnieuw aanvragen of contact met ons opnemen.',
      button: 'CONTACT',
      closing: 'Bedankt voor uw interesse',
      footer: 'MICROSOFT SUPPLIER',
      copyright: '© 2026',
    },
  },
};

function generateAcceptedEmailHTML({ email, supplierId, lang = 'en' }) {
  const t = translations[lang]?.accepted || translations.en.accepted;
  const loginUrl = process.env.FRONT_DOMAIN || 'http://localhost:3000';
  
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
      .mobile-box { padding: 16px !important; margin: 0 0 20px 0 !important; }
      .mobile-button { padding: 12px 30px !important; font-size: 14px !important; }
      .mobile-logo { height: 40px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #F8FAFC;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">

      <!-- Logo -->
      <div class="mobile-padding" style="padding: 50px 40px 40px; text-align: center;">
        <img class="mobile-logo" src="https://firebasestorage.googleapis.com/v0/b/supplier-34b95.appspot.com/o/assets%2FMSlogo.png?alt=media&token=f5524581-bc40-41c6-8c56-61906b61b4b0"
             alt="Microsoft Supplier"
             style="height: 48px;">
      </div>

      <!-- Content -->
      <div class="mobile-content" style="padding: 0 40px 50px; text-align: center;">

        <h1 class="mobile-title" style="color: #1a202c; margin: 0 0 30px 0; font-size: 26px; font-weight: 400; letter-spacing: -0.3px;">
          ${t.title}
        </h1>

        <p class="mobile-text" style="color: #4a5568; margin: 0 0 35px 0; font-size: 16px; line-height: 1.5;">
          ${t.message}
        </p>

        <!-- Account Box -->
        <div class="mobile-box" style="background: #f7fafc; padding: 24px; margin: 0 0 35px 0; border-radius: 6px;">
          <p class="mobile-small" style="color: #718096; margin: 0 0 12px 0; font-size: 13px; letter-spacing: 0.5px;">${t.accountDetails}</p>
          <p class="mobile-text" style="color: #2d3748; margin: 0; font-size: 15px; line-height: 1.8;">
            ${email}<br>
            ${supplierId}
          </p>
        </div>

        <!-- Button -->
        <a href="${loginUrl}/sign-in" class="mobile-button" style="display: inline-block; background: #2d3748; color: #ffffff; padding: 14px 45px; text-decoration: none; font-size: 15px; letter-spacing: 0.3px; border-radius: 6px;">
          ${t.button}
        </a>

        <p class="mobile-small" style="color: #a0aec0; margin: 40px 0 0 0; font-size: 14px;">
          ${t.questions}
        </p>
      </div>

      <!-- Footer -->
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

function generateDeclinedEmailHTML({ email, lang = 'en' }) {
  const t = translations[lang]?.declined || translations.en.declined;
  const supportEmail = 'info@microsoftsupplier.com';
  
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
      .mobile-box { padding: 16px !important; margin: 0 0 20px 0 !important; }
      .mobile-button { padding: 12px 30px !important; font-size: 14px !important; }
      .mobile-logo { height: 40px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #F8FAFC;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">

      <!-- Logo -->
      <div class="mobile-padding" style="padding: 50px 40px 40px; text-align: center;">
        <img class="mobile-logo" src="https://firebasestorage.googleapis.com/v0/b/supplier-34b95.appspot.com/o/assets%2FMSlogo.png?alt=media&token=f5524581-bc40-41c6-8c56-61906b61b4b0"
             alt="Microsoft Supplier"
             style="height: 48px;">
      </div>

      <!-- Content -->
      <div class="mobile-content" style="padding: 0 40px 50px; text-align: center;">

        <h1 class="mobile-title" style="color: #1a202c; margin: 0 0 30px 0; font-size: 26px; font-weight: 400; letter-spacing: -0.3px;">
          ${t.title}
        </h1>

        <p class="mobile-text" style="color: #4a5568; margin: 0 0 35px 0; font-size: 16px; line-height: 1.5;">
          ${t.message}
        </p>

        <!-- Info Box -->
        <div class="mobile-box" style="background: #f7fafc; padding: 24px; margin: 0 0 35px 0; text-align: left; border-radius: 6px;">
          <p class="mobile-small" style="color: #718096; margin: 0; font-size: 14px; line-height: 1.8;">
            • ${t.reason1}<br>
            • ${t.reason2}<br>
            • ${t.reason3}
          </p>
        </div>

        <p class="mobile-text" style="color: #4a5568; margin: 0 0 35px 0; font-size: 15px; line-height: 1.5;">
          ${t.note}
        </p>

        <!-- Button -->
        <a href="mailto:${supportEmail}" class="mobile-button" style="display: inline-block; background: #718096; color: #ffffff; padding: 14px 45px; text-decoration: none; font-size: 15px; letter-spacing: 0.3px; border-radius: 6px;">
          ${t.button}
        </a>

        <p class="mobile-small" style="color: #a0aec0; margin: 40px 0 0 0; font-size: 14px;">
          ${t.closing}
        </p>
      </div>

      <!-- Footer -->
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

export async function sendAcceptanceEmail({ email, supplierId, lang = 'en' }) {
  const t = translations[lang]?.accepted || translations.en.accepted;
  const html = generateAcceptedEmailHTML({ email, supplierId, lang });
  
  return await sendMail({
    to: email,
    subject: t.subject,
    html,
    fromName: 'Microsoft Supplier',
  });
}

export async function sendDeclineEmail({ email, lang = 'en' }) {
  const t = translations[lang]?.declined || translations.en.declined;
  const html = generateDeclinedEmailHTML({ email, lang });
  
  return await sendMail({
    to: email,
    subject: t.subject,
    html,
    fromName: 'Microsoft Supplier',
  });
}

export { generateAcceptedEmailHTML, generateDeclinedEmailHTML, translations };