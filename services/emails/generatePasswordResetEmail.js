const emailTemplates = {
  NL: {
    subject: "Wachtwoord opnieuw instellen – Microsoft Supplier",
    title: "Wachtwoord opnieuw instellen",
    greeting: "Beste",
    message: "We hebben een verzoek ontvangen om het wachtwoord van uw account opnieuw in te stellen.",
    buttonText: "Wachtwoord opnieuw instellen",
    expiryText: "Deze link verloopt over 1 uur om veiligheidsredenen.",
    ignoreText: "Als u dit verzoek niet heeft ingediend, kunt u deze e-mail veilig negeren.",
    noteTitle: "OPMERKING",
    noteText: "Deel deze link nooit met anderen. Microsoft Supplier zal nooit om uw wachtwoord vragen.",
    closing: "Met vriendelijke groet",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026",
  },
  EN: {
    subject: "Reset Your Password – Microsoft Supplier",
    title: "Reset Your Password",
    greeting: "Hello",
    message: "We received a request to reset the password for your account.",
    buttonText: "Reset Password",
    expiryText: "This link will expire in 1 hour for security reasons.",
    ignoreText: "If you didn't request this, you can safely ignore this email.",
    noteTitle: "NOTE",
    noteText: "Never share this link with anyone. Microsoft Supplier will never ask for your password.",
    closing: "Kind regards",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026",
  },
  FR: {
    subject: "Réinitialisez votre mot de passe – Microsoft Supplier",
    title: "Réinitialisez votre mot de passe",
    greeting: "Bonjour",
    message: "Nous avons reçu une demande de réinitialisation du mot de passe de votre compte.",
    buttonText: "Réinitialiser le mot de passe",
    expiryText: "Ce lien expirera dans 1 heure pour des raisons de sécurité.",
    ignoreText: "Si vous n'avez pas fait cette demande, vous pouvez ignorer cet e-mail en toute sécurité.",
    noteTitle: "REMARQUE",
    noteText: "Ne partagez jamais ce lien avec qui que ce soit. Microsoft Supplier ne vous demandera jamais votre mot de passe.",
    closing: "Cordialement",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026",
  },
  DE: {
    subject: "Passwort zurücksetzen – Microsoft Supplier",
    title: "Passwort zurücksetzen",
    greeting: "Hallo",
    message: "Wir haben eine Anfrage zum Zurücksetzen des Passworts für Ihr Konto erhalten.",
    buttonText: "Passwort zurücksetzen",
    expiryText: "Dieser Link läuft aus Sicherheitsgründen in 1 Stunde ab.",
    ignoreText: "Wenn Sie dies nicht angefordert haben, können Sie diese E-Mail sicher ignorieren.",
    noteTitle: "HINWEIS",
    noteText: "Teilen Sie diesen Link niemals mit anderen. Microsoft Supplier wird Sie niemals nach Ihrem Passwort fragen.",
    closing: "Mit freundlichen Grüßen",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026",
  },
  ES: {
    subject: "Restablece tu contraseña – Microsoft Supplier",
    title: "Restablece tu contraseña",
    greeting: "Hola",
    message: "Recibimos una solicitud para restablecer la contraseña de tu cuenta.",
    buttonText: "Restablecer contraseña",
    expiryText: "Este enlace caducará en 1 hora por razones de seguridad.",
    ignoreText: "Si no solicitaste esto, puedes ignorar este correo de forma segura.",
    noteTitle: "NOTA",
    noteText: "Nunca compartas este enlace con nadie. Microsoft Supplier nunca te pedirá tu contraseña.",
    closing: "Saludos cordiales",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026",
  },
  SV: {
    subject: "Återställ ditt lösenord – Microsoft Supplier",
    title: "Återställ ditt lösenord",
    greeting: "Hej",
    message: "Vi har tagit emot en begäran om att återställa lösenordet för ditt konto.",
    buttonText: "Återställ lösenord",
    expiryText: "Denna länk upphör att gälla om 1 timme av säkerhetsskäl.",
    ignoreText: "Om du inte begärde detta kan du ignorera detta e-postmeddelande.",
    noteTitle: "OBS",
    noteText: "Dela aldrig denna länk med någon annan. Microsoft Supplier kommer aldrig att be om ditt lösenord.",
    closing: "Med vänliga hälsningar",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026",
  },
};

function generatePasswordResetEmail(resetUrl, language = "EN") {
  // Get template based on language, fallback to EN if not found
  const t = emailTemplates[language.toUpperCase()] || emailTemplates.EN;

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
      .mobile-button { padding: 16px 32px !important; font-size: 15px !important; }
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

        <!-- Reset Button -->
        <div style="margin: 0 0 35px 0;">
          <a href="${resetUrl}" class="mobile-button" style="display: inline-block; background: #3b82f6; color: #ffffff; text-decoration: none; padding: 18px 40px; border-radius: 6px; font-size: 16px; font-weight: 500; letter-spacing: -0.2px;">
            ${t.buttonText}
          </a>
        </div>

        <!-- Expiry Info -->
        <p class="mobile-small" style="color: #a0aec0; margin: 0 0 25px 0; font-size: 14px;">
          ${t.expiryText}
        </p>

        <!-- Note Box -->
        <div class="mobile-box" style="background: #fef3c7; padding: 20px; margin: 0 0 25px 0; text-align: left; border-radius: 6px; border-left: 4px solid #f59e0b;">
          <p class="mobile-small" style="color: #92400e; margin: 0 0 8px 0; font-size: 13px; font-weight: 600; letter-spacing: 0.5px;">
            ${t.noteTitle}
          </p>
          <p class="mobile-small" style="color: #92400e; margin: 0; font-size: 13px; line-height: 1.6;">
            ${t.noteText}
          </p>
        </div>

        <p class="mobile-small" style="color: #a0aec0; margin: 0; font-size: 14px;">
          ${t.ignoreText}
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

export default generatePasswordResetEmail;
