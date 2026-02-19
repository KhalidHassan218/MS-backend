const emailTemplates = {
  NL: {
    subject: "Sleutelvervangingsverzoek – Microsoft Supplier",
    title: "Licentie vervangen",
    greeting: "Beste",
    message: "Uw licentie is succesvol vervangen. Het bijgewerkte licentiedocument is nu beschikbaar.",
    attachmentsTitle: "BIJLAGE",
    attachmentText: "Het bijgewerkte licentiedocument (met de nieuwe licentiesleutel)",
    noteTitle: "OPMERKING",
    noteText: "De oude sleutel is gedeactiveerd. Gebruik de nieuwe sleutel uit het bijgevoegde document.",
    contactText: "Vragen? Antwoord op deze e-mail",
    closing: "Met vriendelijke groet",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026",
  },
  EN: {
    subject: "Key Replacement Request – Microsoft Supplier",
    title: "License Replaced",
    greeting: "Hello",
    message: "Your license has been successfully replaced. The updated license document is now available.",
    attachmentsTitle: "ATTACHMENT",
    attachmentText: "The updated license document (containing the new license key)",
    noteTitle: "NOTE",
    noteText: "The old key has been deactivated. Please use the new key from the attached document.",
    contactText: "Questions? Reply to this email",
    closing: "Kind regards",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026",
  },
  FR: {
    subject: "Demande de remplacement de clé – Microsoft Supplier",
    title: "Licence remplacée",
    greeting: "Bonjour",
    message: "Votre licence a été remplacée avec succès. Le document de licence mis à jour est désormais disponible.",
    attachmentsTitle: "PIÈCE JOINTE",
    attachmentText: "Le document de licence mis à jour (contenant la nouvelle clé de licence)",
    noteTitle: "REMARQUE",
    noteText: "L'ancienne clé a été désactivée. Veuillez utiliser la nouvelle clé du document joint.",
    contactText: "Questions ? Répondez à cet e-mail",
    closing: "Cordialement",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026",
  },
  DE: {
    subject: "Schlüsselersatzanfrage – Microsoft Supplier",
    title: "Lizenz ersetzt",
    greeting: "Hallo",
    message: "Ihre Lizenz wurde erfolgreich ersetzt. Das aktualisierte Lizenzdokument ist jetzt verfügbar.",
    attachmentsTitle: "ANHANG",
    attachmentText: "Das aktualisierte Lizenzdokument (mit dem neuen Lizenzschlüssel)",
    noteTitle: "HINWEIS",
    noteText: "Der alte Schlüssel wurde deaktiviert. Bitte verwenden Sie den neuen Schlüssel aus dem beigefügten Dokument.",
    contactText: "Fragen? Antworten Sie auf diese E-Mail",
    closing: "Mit freundlichen Grüßen",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026",
  },
  ES: {
    subject: "Solicitud de reemplazo de clave – Microsoft Supplier",
    title: "Licencia reemplazada",
    greeting: "Hola",
    message: "Su licencia ha sido reemplazada con éxito. El documento de licencia actualizado ya está disponible.",
    attachmentsTitle: "ARCHIVO ADJUNTO",
    attachmentText: "El documento de licencia actualizado (que contiene la nueva clave de licencia)",
    noteTitle: "NOTA",
    noteText: "La clave anterior ha sido desactivada. Utilice la nueva clave del documento adjunto.",
    contactText: "¿Preguntas? Responda a este correo",
    closing: "Saludos cordiales",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026",
  },
};

function generateKeyReplacementEmail(companyCountryCode = "EN") {
  // Get template based on country code, fallback to EN if not found
  const t = emailTemplates[companyCountryCode.toUpperCase()] || emailTemplates.EN;

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
          ${t.greeting},
        </p>

        <p class="mobile-text" style="color: #4a5568; margin: 0 0 35px 0; font-size: 16px; line-height: 1.5;">
          ${t.message}
        </p>

        <!-- Attachments Box -->
        <div class="mobile-box" style="background: #f7fafc; padding: 24px; margin: 0 0 35px 0; text-align: left; border-radius: 6px;">
          <p class="mobile-small" style="color: #718096; margin: 0 0 12px 0; font-size: 13px; letter-spacing: 0.5px;">${t.attachmentsTitle}</p>
          <p class="mobile-small" style="color: #2d3748; margin: 0; font-size: 14px; line-height: 1.8;">
            • ${t.attachmentText}
          </p>
        </div>

        <!-- Note Box -->
        <div class="mobile-box" style="background: #fef3c7; padding: 20px; margin: 0 0 35px 0; text-align: left; border-radius: 6px; border-left: 4px solid #f59e0b;">
          <p class="mobile-small" style="color: #92400e; margin: 0 0 8px 0; font-size: 13px; font-weight: 600; letter-spacing: 0.5px;">
            ${t.noteTitle}
          </p>
          <p class="mobile-small" style="color: #92400e; margin: 0; font-size: 13px; line-height: 1.6;">
            ${t.noteText}
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
</html>`;

  return {
    subject: t.subject,
    html: htmlContent,
  };
}

export default generateKeyReplacementEmail;
