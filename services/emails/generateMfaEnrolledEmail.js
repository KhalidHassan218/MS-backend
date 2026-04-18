const templates = {
  EN: {
    subject: 'Two-Factor Authentication Enabled – Microsoft Supplier',
    title: 'Two-Factor Authentication Enabled',
    greeting: 'Hello',
    message: 'Two-factor authentication (2FA) was just set up on your Microsoft Supplier account.',
    warning: 'If you did not do this, your account may be compromised. Please contact us immediately and change your password.',
    contactLabel: 'Contact support:',
    contactEmail: 'info@microsoftsupplier.com',
    closing: 'Kind regards',
    footer: 'MICROSOFT SUPPLIER',
    copyright: '© 2026',
  },
  DE: {
    subject: 'Zwei-Faktor-Authentifizierung aktiviert – Microsoft Supplier',
    title: 'Zwei-Faktor-Authentifizierung aktiviert',
    greeting: 'Hallo',
    message: 'Die Zwei-Faktor-Authentifizierung (2FA) wurde soeben für Ihr Microsoft Supplier-Konto eingerichtet.',
    warning: 'Wenn Sie dies nicht getan haben, könnte Ihr Konto gefährdet sein. Bitte kontaktieren Sie uns sofort und ändern Sie Ihr Passwort.',
    contactLabel: 'Support kontaktieren:',
    contactEmail: 'info@microsoftsupplier.com',
    closing: 'Mit freundlichen Grüßen',
    footer: 'MICROSOFT SUPPLIER',
    copyright: '© 2026',
  },
  FR: {
    subject: 'Authentification à deux facteurs activée – Microsoft Supplier',
    title: 'Authentification à deux facteurs activée',
    greeting: 'Bonjour',
    message: "L'authentification à deux facteurs (2FA) vient d'être configurée sur votre compte Microsoft Supplier.",
    warning: "Si vous n'avez pas effectué cette action, votre compte pourrait être compromis. Veuillez nous contacter immédiatement et changer votre mot de passe.",
    contactLabel: 'Contacter le support :',
    contactEmail: 'info@microsoftsupplier.com',
    closing: 'Cordialement',
    footer: 'MICROSOFT SUPPLIER',
    copyright: '© 2026',
  },
  NL: {
    subject: 'Tweefactorauthenticatie ingeschakeld – Microsoft Supplier',
    title: 'Tweefactorauthenticatie ingeschakeld',
    greeting: 'Hallo',
    message: 'Tweefactorauthenticatie (2FA) is zojuist ingesteld voor uw Microsoft Supplier-account.',
    warning: 'Als u dit niet heeft gedaan, kan uw account in gevaar zijn. Neem onmiddellijk contact met ons op en wijzig uw wachtwoord.',
    contactLabel: 'Contact opnemen:',
    contactEmail: 'info@microsoftsupplier.com',
    closing: 'Met vriendelijke groet',
    footer: 'MICROSOFT SUPPLIER',
    copyright: '© 2026',
  },
  SV: {
    subject: 'Tvåfaktorsautentisering aktiverad – Microsoft Supplier',
    title: 'Tvåfaktorsautentisering aktiverad',
    greeting: 'Hej',
    message: 'Tvåfaktorsautentisering (2FA) har precis konfigurerats på ditt Microsoft Supplier-konto.',
    warning: 'Om du inte gjorde detta kan ditt konto vara komprometterat. Vänligen kontakta oss omedelbart och ändra ditt lösenord.',
    contactLabel: 'Kontakta support:',
    contactEmail: 'info@microsoftsupplier.com',
    closing: 'Vänliga hälsningar',
    footer: 'MICROSOFT SUPPLIER',
    copyright: '© 2026',
  },
};

export default function generateMfaEnrolledEmail({ language = 'EN', userName = '' }) {
  const lang = language.toUpperCase();
  const t = templates[lang] || templates.EN;

  return {
    subject: t.subject,
    html: `<!DOCTYPE html>
<html lang="${lang.toLowerCase()}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${t.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
              <span style="color:#fff;font-size:22px;font-weight:bold;letter-spacing:2px;">MICROSOFT SUPPLIER</span>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#1a1a2e;margin:0 0 16px;">${t.title}</h2>
              <p style="color:#444;font-size:15px;line-height:1.6;">${t.greeting}${userName ? ' ' + userName : ''},</p>
              <p style="color:#444;font-size:15px;line-height:1.6;">${t.message}</p>
              <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:16px 20px;margin:24px 0;">
                <p style="color:#856404;font-size:14px;margin:0;font-weight:bold;">⚠ ${t.warning}</p>
              </div>
              <p style="color:#444;font-size:14px;margin-top:24px;">
                ${t.contactLabel} <a href="mailto:${t.contactEmail}" style="color:#1a1a2e;">${t.contactEmail}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8f8f8;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
              <p style="color:#999;font-size:12px;margin:0;">${t.footer} &nbsp;|&nbsp; ${t.copyright}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}
