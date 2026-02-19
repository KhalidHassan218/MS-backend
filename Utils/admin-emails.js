import { sendMail } from './mailersend.js';

/**
 * Email translations for admin notifications
 * Add more languages as needed
 */
const translations = {
  en: {
    pendingRegistration: {
      subject: 'New Pending Registration',
      title: 'New Business Registration Request',
      intro: 'A new company has submitted a registration request and is awaiting approval.',
      companyDetails: 'Company Details',
      email: 'Email',
      company: 'Company Name',
      country: 'Country',
      taxId: 'Tax ID',
      action: 'Action Required',
      actionText: 'Please review this registration in the admin dashboard and approve or reject the application.',
      reviewButton: 'Review Application',
      footer: 'This is an automated notification from Microsoft Supplier.'
    }
  },
  de: {
    pendingRegistration: {
      subject: 'Neue ausstehende Registrierung',
      title: 'Neue Geschäftsregistrierungsanfrage',
      intro: 'Ein neues Unternehmen hat eine Registrierungsanfrage eingereicht und wartet auf Genehmigung.',
      companyDetails: 'Unternehmensdetails',
      email: 'E-Mail',
      company: 'Firmenname',
      country: 'Land',
      taxId: 'Steuernummer',
      action: 'Erforderliche Aktion',
      actionText: 'Bitte überprüfen Sie diese Registrierung im Admin-Dashboard und genehmigen oder lehnen Sie die Bewerbung ab.',
      reviewButton: 'Antrag überprüfen',
      footer: 'Dies ist eine automatische Benachrichtigung von Microsoft Supplier.'
    }
  },
  fr: {
    pendingRegistration: {
      subject: 'Nouvelle inscription en attente',
      title: 'Nouvelle demande d\'inscription d\'entreprise',
      intro: 'Une nouvelle entreprise a soumis une demande d\'inscription et est en attente d\'approbation.',
      companyDetails: 'Détails de l\'entreprise',
      email: 'E-mail',
      company: 'Nom de l\'entreprise',
      country: 'Pays',
      taxId: 'Numéro fiscal',
      action: 'Action requise',
      actionText: 'Veuillez examiner cette inscription dans le tableau de bord administrateur et approuver ou rejeter la demande.',
      reviewButton: 'Examiner la demande',
      footer: 'Ceci est une notification automatique de Microsoft Supplier.'
    }
  },
  es: {
    pendingRegistration: {
      subject: 'Nuevo registro pendiente',
      title: 'Nueva solicitud de registro de empresa',
      intro: 'Una nueva empresa ha enviado una solicitud de registro y está esperando aprobación.',
      companyDetails: 'Detalles de la empresa',
      email: 'Correo electrónico',
      company: 'Nombre de la empresa',
      country: 'País',
      taxId: 'Número de identificación fiscal',
      action: 'Acción requerida',
      actionText: 'Por favor revise este registro en el panel de administración y apruebe o rechace la solicitud.',
      reviewButton: 'Revisar solicitud',
      footer: 'Esta es una notificación automática de Microsoft Supplier.'
    }
  }
};

/**
 * Generate multi-language registration email HTML
 */
function generateRegistrationEmailHTML({ email, company, country, taxId, lang = 'en' }) {
  const t = translations[lang]?.pendingRegistration || translations.en.pendingRegistration;
  const adminDashboardUrl = process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3000/admin/registrations';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f4f4f4;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">${t.title}</h1>
      </div>
      
      <!-- Content -->
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; color: #555; margin-bottom: 25px;">
          ${t.intro}
        </p>
        
        <!-- Company Details Card -->
        <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 20px; margin: 25px 0; border-radius: 5px;">
          <h2 style="margin: 0 0 15px 0; color: #1e40af; font-size: 18px;">${t.companyDetails}</h2>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 40%;">${t.email}:</td>
              <td style="padding: 8px 0; color: #1e293b;">
                <a href="mailto:${email}" style="color: #2563eb; text-decoration: none;">${email}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">${t.company}:</td>
              <td style="padding: 8px 0; color: #1e293b;">${company}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">${t.country}:</td>
              <td style="padding: 8px 0; color: #1e293b;">${country}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">${t.taxId}:</td>
              <td style="padding: 8px 0; color: #1e293b;">${taxId}</td>
            </tr>
          </table>
        </div>
        
        <!-- Action Required Section -->
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 25px 0; border-radius: 5px;">
          <p style="margin: 0; color: #92400e;">
            <strong style="color: #78350f;">${t.action}:</strong> ${t.actionText}
          </p>
        </div>
        
        <!-- CTA Button -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="${adminDashboardUrl}" 
             style="background: #2563eb; color: white; padding: 14px 35px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);">
            ${t.reviewButton}
          </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
        
        <!-- Footer -->
        <p style="font-size: 12px; color: #64748b; text-align: center; margin: 0;">
          ${t.footer}
        </p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send email to admin about pending registration
 * 
 * @param {Object} options
 * @param {string} options.email - User's email
 * @param {string} options.companyName - Company name
 * @param {string} options.taxId - Tax ID
 * @param {string} options.companyCountry - Country
 * @param {string} [options.lang='en'] - Language code (en, de, fr, es)
 */
export async function sendAdminPendingRegistrationEmail({ 
  email, 
  companyName, 
  taxId, 
  companyCountry,
  lang = 'en' 
}) {
  const t = translations[lang]?.pendingRegistration || translations.en.pendingRegistration;
  
  const html = generateRegistrationEmailHTML({
    email,
    company: companyName,
    country: companyCountry,
    taxId,
    lang
  });

  return await sendMail({
    to: 'info@microsoftsupplier.com',
    subject: t.subject,
    html,
    replyTo: email, // Admin can reply directly to the applicant
    fromName: 'Microsoft Supplier System',
    isMarketing: false, // This is transactional
  });
}

/**
 * Generic function to send admin emails (backward compatibility)
 * @deprecated Use sendAdminPendingRegistrationEmail instead
 */
export async function sendEmailToAdmin(subject, message, replyTo, attachment = [], maxRetries = 3) {
  return await sendMail({
    to: 'info@microsoftsupplier.com',
    subject,
    html: message,
    replyTo,
    attachments: attachment,
    isMarketing: false,
    maxRetries
  });
}

export default sendAdminPendingRegistrationEmail;