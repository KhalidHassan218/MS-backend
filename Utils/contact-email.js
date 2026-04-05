import { sendMail } from './mailersend.js';

const ADMIN_EMAIL = 'info@microsoftsupplier.com';

// Subject labels per language
const subjectLabels = {
  en: {
    licensing: 'Licensing Inquiry',
    bulk: 'Bulk Order Inquiry',
    compliance: 'Compliance Inquiry',
    support: 'Support Request',
    other: 'General Inquiry',
  },
  de: {
    licensing: 'Lizenzanfrage',
    bulk: 'Großbestellungsanfrage',
    compliance: 'Compliance-Anfrage',
    support: 'Supportanfrage',
    other: 'Allgemeine Anfrage',
  },
  fr: {
    licensing: 'Demande de licence',
    bulk: 'Demande de commande en gros',
    compliance: 'Demande de conformité',
    support: 'Demande d\'assistance',
    other: 'Demande générale',
  },
  nl: {
    licensing: 'Licentieaanvraag',
    bulk: 'Bulkbestellingsaanvraag',
    compliance: 'Compliance-aanvraag',
    support: 'Ondersteuningsverzoek',
    other: 'Algemene aanvraag',
  },
};

// Auto-reply copy per language
const autoReplyTranslations = {
  en: {
    subject: 'We received your message — Microsoft Supplier',
    heading: 'We received your message',
    greeting: (company) => `Dear <strong>${company}</strong>,`,
    body: (subjectLabel) =>
      `Thank you for reaching out. We have received your <strong>${subjectLabel}</strong> and will get back to you the same or next business day.`,
    urgent: 'If your request is urgent, you can reply directly to this email.',
    regards: 'Kind regards,',
    footer: 'Netherlands-based distributor. Not affiliated with Microsoft Corporation.',
  },
  de: {
    subject: 'Wir haben Ihre Nachricht erhalten — Microsoft Supplier',
    heading: 'Wir haben Ihre Nachricht erhalten',
    greeting: (company) => `Sehr geehrte Damen und Herren von <strong>${company}</strong>,`,
    body: (subjectLabel) =>
      `Vielen Dank für Ihre Kontaktaufnahme. Wir haben Ihre <strong>${subjectLabel}</strong> erhalten und werden uns am selben oder nächsten Werktag bei Ihnen melden.`,
    urgent: 'Bei dringenden Anliegen können Sie direkt auf diese E-Mail antworten.',
    regards: 'Mit freundlichen Grüßen,',
    footer: 'In den Niederlanden ansässiger Distributor. Nicht mit der Microsoft Corporation verbunden.',
  },
  fr: {
    subject: 'Nous avons reçu votre message — Microsoft Supplier',
    heading: 'Nous avons reçu votre message',
    greeting: (company) => `Cher(e) <strong>${company}</strong>,`,
    body: (subjectLabel) =>
      `Merci de nous avoir contactés. Nous avons bien reçu votre <strong>${subjectLabel}</strong> et nous vous répondrons le jour même ou le prochain jour ouvrable.`,
    urgent: 'Si votre demande est urgente, vous pouvez répondre directement à cet e-mail.',
    regards: 'Cordialement,',
    footer: 'Distributeur basé aux Pays-Bas. Non affilié à Microsoft Corporation.',
  },
  nl: {
    subject: 'Wij hebben uw bericht ontvangen — Microsoft Supplier',
    heading: 'Wij hebben uw bericht ontvangen',
    greeting: (company) => `Geachte <strong>${company}</strong>,`,
    body: (subjectLabel) =>
      `Bedankt voor uw bericht. Wij hebben uw <strong>${subjectLabel}</strong> ontvangen en nemen dezelfde of de volgende werkdag contact met u op.`,
    urgent: 'Als uw verzoek dringend is, kunt u rechtstreeks op deze e-mail antwoorden.',
    regards: 'Met vriendelijke groet,',
    footer: 'In Nederland gevestigde distributeur. Niet gelieerd aan Microsoft Corporation.',
  },
};

function getSubjectLabel(subject, lang) {
  const langLabels = subjectLabels[lang] || subjectLabels.en;
  return langLabels[subject] || subjectLabels.en[subject] || subject;
}

// Admin notification is always in English (internal use)
function generateContactNotificationHTML({ company, email, subject, message, lang }) {
  const subjectLabel = getSubjectLabel(subject, 'en');
  const senderLang = (lang || 'en').toUpperCase();
  const now = new Date().toUTCString();

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f4f4f4;">
      <div style="background: linear-gradient(135deg, #0078D4 0%, #005A9E 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px;">New Contact Form Submission</h1>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 15px; color: #555; margin-bottom: 20px;">
          A visitor submitted the contact form on <strong>microsoftsupplier.com</strong>.
        </p>

        <div style="background: #f0f6ff; border-left: 4px solid #0078D4; padding: 20px; margin: 20px 0; border-radius: 5px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #555; font-weight: 600; width: 38%;">Company:</td>
              <td style="padding: 8px 0; color: #1A1A1A;">${company}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #555; font-weight: 600;">Email:</td>
              <td style="padding: 8px 0; color: #1A1A1A;">
                <a href="mailto:${email}" style="color: #0078D4; text-decoration: none;">${email}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #555; font-weight: 600;">Subject:</td>
              <td style="padding: 8px 0; color: #1A1A1A;">${subjectLabel}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #555; font-weight: 600;">Language:</td>
              <td style="padding: 8px 0; color: #1A1A1A;">${senderLang}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #555; font-weight: 600;">Received:</td>
              <td style="padding: 8px 0; color: #1A1A1A;">${now}</td>
            </tr>
          </table>
        </div>

        <div style="background: #fafafa; border: 1px solid #EDEBE9; border-radius: 6px; padding: 20px; margin: 20px 0;">
          <h3 style="margin: 0 0 12px; font-size: 14px; color: #555; text-transform: uppercase; letter-spacing: 0.05em;">Message</h3>
          <p style="margin: 0; font-size: 15px; color: #1A1A1A; white-space: pre-wrap;">${message}</p>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="mailto:${email}?subject=Re: ${subjectLabel}"
             style="background: #0078D4; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 15px;">
            Reply to ${company}
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #EDEBE9; margin: 24px 0;">
        <p style="font-size: 12px; color: #A19F9D; text-align: center; margin: 0;">
          Automated notification — Microsoft Supplier contact form
        </p>
      </div>
    </body>
    </html>
  `;
}

function generateAutoReplyHTML({ company, subject, lang }) {
  const t = autoReplyTranslations[lang] || autoReplyTranslations.en;
  const subjectLabel = getSubjectLabel(subject, lang);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f4f4f4;">
      <div style="background: linear-gradient(135deg, #0078D4 0%, #005A9E 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px;">${t.heading}</h1>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 15px; color: #555;">${t.greeting(company)}</p>
        <p style="font-size: 15px; color: #555;">${t.body(subjectLabel)}</p>
        <p style="font-size: 15px; color: #555;">${t.urgent}</p>

        <hr style="border: none; border-top: 1px solid #EDEBE9; margin: 24px 0;">
        <p style="font-size: 13px; color: #605E5C; margin: 0;">
          ${t.regards}<br>
          <strong>Sertic — Microsoft Supplier</strong><br>
          <a href="mailto:info@microsoftsupplier.com" style="color: #0078D4; text-decoration: none;">info@microsoftsupplier.com</a>
        </p>
        <hr style="border: none; border-top: 1px solid #EDEBE9; margin: 24px 0;">
        <p style="font-size: 12px; color: #A19F9D; text-align: center; margin: 0;">
          ${t.footer}
        </p>
      </div>
    </body>
    </html>
  `;
}

const SUPPORTED_LANGS = ['en', 'de', 'fr', 'nl'];

/**
 * Handle a contact form submission:
 *  1. Notify admin (info@microsoftsupplier.com) — always in English
 *  2. Send auto-reply to the submitter in their language (en/de/fr/nl)
 */
export async function sendContactFormEmails({ company, email, subject, message, lang = 'en' }) {
  const safeLang = SUPPORTED_LANGS.includes(lang) ? lang : 'en';
  const t = autoReplyTranslations[safeLang];

  // 1. Admin notification (English)
  const adminResult = await sendMail({
    to: ADMIN_EMAIL,
    subject: `[Contact] ${getSubjectLabel(subject, 'en')} — ${company}`,
    html: generateContactNotificationHTML({ company, email, subject, message, lang: safeLang }),
    replyTo: email,
    fromName: 'Microsoft Supplier Contact Form',
  });

  // 2. Auto-reply in sender's language
  const autoReplyResult = await sendMail({
    to: email,
    subject: t.subject,
    html: generateAutoReplyHTML({ company, subject, lang: safeLang }),
    fromName: 'Microsoft Supplier',
  });

  return { adminResult, autoReplyResult };
}
