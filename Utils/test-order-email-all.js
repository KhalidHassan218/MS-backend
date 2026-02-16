import sendEmailWithAttachment from './sendEmailWithAttachment.js';
import 'dotenv/config';

const emailTemplates = {
  NL: {
    subject: "Uw bestelling bij Microsoft Supplier",
    title: "Bestelling bevestigd",
    greeting: "Beste",
    thankYou: "Bedankt voor uw bestelling.",
    processed: "De licenties zijn succesvol verwerkt en de documenten zijn nu beschikbaar.",
    attachmentsTitle: "BIJLAGEN",
    attachments: {
      invoice: "De factuur",
      license: "Het licentiedocument (met alle licentiesleutels)"
    },
    importantTitle: "BELANGRIJKE INFORMATIE",
    importantInfo: [
      "De licenties worden direct online geactiveerd (telefonische activatie is niet nodig)",
      "Garantie: 12 maanden",
      "De licenties zijn afkomstig uit ons interne distributiesysteem"
    ],
    contactText: "Vragen? Antwoord op deze e-mail",
    closing: "Met vriendelijke groet",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026",
  },
  EN: {
    subject: "Your Microsoft Supplier Order",
    title: "Order Confirmed",
    greeting: "Hello",
    thankYou: "Thank you for your order.",
    processed: "The licenses have been successfully processed and the documents are now available.",
    attachmentsTitle: "ATTACHMENTS",
    attachments: {
      invoice: "The invoice (VAT 0% – Export outside EU)",
      license: "The license document (containing all license keys)"
    },
    importantTitle: "IMPORTANT INFORMATION",
    importantInfo: [
      "The licenses activate online immediately (no phone activation required)",
      "Warranty: 36 months",
      "The licenses are supplied through our internal distribution system",
      "Delivery method: Digital ESD licenses via email (no physical shipment)",
      "Not subject to U.S. sales tax"
    ],
    contactText: "Questions? Reply to this email",
    closing: "Kind regards",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026",
  },
  FR: {
    subject: "Votre commande Microsoft Supplier",
    title: "Commande confirmée",
    greeting: "Bonjour",
    thankYou: "Merci pour votre commande.",
    processed: "Les licences ont été traitées avec succès et les documents sont désormais disponibles.",
    attachmentsTitle: "PIÈCES JOINTES",
    attachments: {
      invoice: "La facture (TVA autoliquidée – Article 196 de la directive TVA de l'UE)",
      license: "Le document de licence (contenant toutes les clés de licence)"
    },
    importantTitle: "INFORMATIONS IMPORTANTES",
    importantInfo: [
      "Les licences s'activent directement en ligne (aucune activation téléphonique n'est nécessaire)",
      "Garantie : 12 mois",
      "Les licences proviennent de notre système interne de distribution"
    ],
    contactText: "Questions ? Répondez à cet e-mail",
    closing: "Cordialement",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026",
  },
  DE: {
    subject: "Ihre Microsoft Supplier Bestellung",
    title: "Bestellung bestätigt",
    greeting: "Hallo",
    thankYou: "Vielen Dank für Ihre Bestellung.",
    processed: "Die Lizenzen wurden erfolgreich verarbeitet und die Dokumente sind jetzt verfügbar.",
    attachmentsTitle: "ANHÄNGE",
    attachments: {
      invoice: "Die Rechnung",
      license: "Das Lizenzdokument (mit allen Lizenzschlüsseln)"
    },
    importantTitle: "WICHTIGE INFORMATIONEN",
    importantInfo: [
      "Die Lizenzen werden sofort online aktiviert (keine telefonische Aktivierung erforderlich)",
      "Garantie: 12 Monate",
      "Die Lizenzen stammen aus unserem internen Vertriebssystem"
    ],
    contactText: "Fragen? Antworten Sie auf diese E-Mail",
    closing: "Mit freundlichen Grüßen",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026",
  },
  ES: {
    subject: "Su pedido de Microsoft Supplier",
    title: "Pedido confirmado",
    greeting: "Hola",
    thankYou: "Gracias por su pedido.",
    processed: "Las licencias han sido procesadas con éxito y los documentos ya están disponibles.",
    attachmentsTitle: "ARCHIVOS ADJUNTOS",
    attachments: {
      invoice: "La factura",
      license: "El documento de licencia (con todas las claves de licencia)"
    },
    importantTitle: "INFORMACIÓN IMPORTANTE",
    importantInfo: [
      "Las licencias se activan en línea inmediatamente (no se requiere activación telefónica)",
      "Garantía: 12 meses",
      "Las licencias provienen de nuestro sistema de distribución interno"
    ],
    contactText: "¿Preguntas? Responda a este correo",
    closing: "Saludos cordiales",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026",
  },
};

function generateEmailContent(lang) {
  const t = emailTemplates[lang];
  const importantInfoList = t.importantInfo.map((info) => `• ${info}`).join("<br>\n          ");

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
      <div class="mobile-padding" style="padding: 50px 40px 40px; text-align: center;">
        <img class="mobile-logo" src="https://firebasestorage.googleapis.com/v0/b/supplier-34b95.appspot.com/o/assets%2FMSlogo.png?alt=media&token=f5524581-bc40-41c6-8c56-61906b61b4b0" alt="Microsoft Supplier" style="height: 48px;">
      </div>
      <div class="mobile-content" style="padding: 0 40px 50px; text-align: center;">
        <h1 class="mobile-title" style="color: #1a202c; margin: 0 0 30px 0; font-size: 26px; font-weight: 400; letter-spacing: -0.3px;">
          ${t.title}
        </h1>
        <p class="mobile-text" style="color: #4a5568; margin: 0 0 20px 0; font-size: 16px; line-height: 1.5;">
          ${t.greeting} Test User,
        </p>
        <p class="mobile-text" style="color: #4a5568; margin: 0 0 35px 0; font-size: 16px; line-height: 1.5;">
          ${t.thankYou} ${t.processed}
        </p>
        <div class="mobile-box" style="background: #f7fafc; padding: 24px; margin: 0 0 35px 0; text-align: left; border-radius: 6px;">
          <p class="mobile-small" style="color: #718096; margin: 0 0 12px 0; font-size: 13px; letter-spacing: 0.5px;">${t.attachmentsTitle}</p>
          <p class="mobile-small" style="color: #2d3748; margin: 0; font-size: 14px; line-height: 1.8;">
            • ${t.attachments.invoice}<br>
          </p>
        </div>
        <div class="mobile-box" style="background: #fef3c7; padding: 20px; margin: 0 0 35px 0; text-align: left; border-radius: 6px; border-left: 4px solid #f59e0b;">
          <p class="mobile-small" style="color: #92400e; margin: 0 0 8px 0; font-size: 13px; font-weight: 600; letter-spacing: 0.5px;">
            ${t.importantTitle}
          </p>
          <p class="mobile-small" style="color: #92400e; margin: 0; font-size: 13px; line-height: 1.6;">
            ${importantInfoList}
          </p>
        </div>
        <p class="mobile-small" style="color: #a0aec0; margin: 0; font-size: 14px;">
          ${t.contactText}
        </p>
        <p class="mobile-small" style="color: #4a5568; margin: 30px 0 0 0; font-size: 14px; line-height: 1.8;">
          ${t.closing},<br>
          S.R. (Sergio) Eersel<br>
          <span style="color: #a0aec0;">Founder @ Sertic</span>
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
</html>`;

  return { subject: t.subject, html: htmlContent };
}

async function sendTestEmails() {
  const languages = ['NL', 'EN', 'FR', 'DE', 'ES'];

  console.log('\n📧 Testing Order Confirmation Emails - All Languages');
  console.log('Recipient: omar3691113@gmail.com');
  console.log('Languages:', languages.join(', '));
  console.log('='.repeat(60));

  for (const lang of languages) {
    try {
      console.log(`\n📨 Sending ${lang}...`);
      const emailContent = generateEmailContent(lang);

      await sendEmailWithAttachment(
        emailContent.subject,
        emailContent.html,
        'omar3691113@gmail.com',
        null,
        null,
        [] // No attachments for test
      );

      console.log(`✅ ${lang} sent successfully`);

      // Wait 1 second between emails
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ Failed to send ${lang}:`, error.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ All test emails sent!');
}

sendTestEmails();
