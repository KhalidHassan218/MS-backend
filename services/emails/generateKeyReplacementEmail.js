const emailTemplates = {
  NL: {
    subject: "Uw bestelling bij Microsoft Supplier – Licenties en documentatie",
    greeting: "Beste",
    thankYou: "Bedankt voor uw bestelling.",
    processed:
      "De licenties zijn succesvol verwerkt en de documenten zijn nu beschikbaar.",
    attachmentsIntro: "In de bijlagen vindt u:",
    attachments: {
      invoice: "De factuur",
      license: "Het licentiedocument (met alle licentiesleutels)",
    },
    importantInfoTitle: "Belangrijke informatie:",
    importantInfo: [
      "De licenties worden direct online geactiveerd (telefonische activatie is niet nodig)",
      "Garantie: 12 maanden",
      "De licenties zijn afkomstig uit ons interne distributiesysteem",
    ],
    contactText:
      "Als u vragen heeft of aanvullende licenties nodig heeft, kunt u contact met ons opnemen via:",
    closing: "Met vriendelijke groet",
    founder: "Founder @ Sertic",
    keyReplacementRequest: "Sleutelvervangingsverzoek", // ✅ New key
  },
  EN: {
    subject: "Your order from Microsoft Supplier – Licenses and documentation",
    greeting: "Hello",
    thankYou: "Thank you for your order.",
    processed:
      "The licenses have been successfully processed and the documents are now available.",
    attachmentsIntro: "Please find attached:",
    attachments: {
      invoice: "The invoice (VAT 0% – Export outside EU)",
      license: "The license document (containing all license keys)",
    },
    importantInfoTitle: "Important information:",
    importantInfo: [
      "The licenses activate online immediately (no phone activation required)",
      "Warranty: 12 months",
      "The licenses are supplied through our internal distribution system",
      "Delivery method: Digital ESD licenses via email (no physical shipment)",
      "Not subject to U.S. sales tax",
    ],
    contactText:
      "If you have any questions or need additional licenses, feel free to contact us at:",
    closing: "Kind regards",
    founder: "Founder @ Sertic",
    keyReplacementRequest: "Key replacement request", // ✅ New key
  },
  FR: {
    subject:
      "Votre commande chez Microsoft Supplier – Licences et documentation",
    greeting: "Bonjour",
    thankYou: "Merci pour votre commande.",
    processed:
      "Les licences ont été traitées avec succès et les documents sont désormais disponibles.",
    attachmentsIntro: "Vous trouverez en pièces jointes :",
    attachments: {
      invoice:
        "La facture (TVA autoliquidée – Article 196 de la directive TVA de l'UE)",
      license: "Le document de licence (contenant toutes les clés de licence)",
    },
    importantInfoTitle: "Informations importantes :",
    importantInfo: [
      "Les licences s'activent directement en ligne (aucune activation téléphonique n'est nécessaire)",
      "Garantie : 12 mois",
      "Les licences proviennent de notre système interne de distribution",
    ],
    contactText:
      "Si vous avez des questions ou si vous avez besoin de licences supplémentaires, vous pouvez nous contacter à :",
    closing: "Cordialement",
    founder: "Founder @ Sertic",
    keyReplacementRequest: "Demande de remplacement de clé", // ✅ New key
  },
  DE: {
    subject:
      "Ihre Bestellung bei Microsoft Supplier – Lizenzen und Dokumentation",
    greeting: "Hallo",
    thankYou: "Vielen Dank für Ihre Bestellung.",
    processed:
      "Die Lizenzen wurden erfolgreich verarbeitet und die Dokumente sind jetzt verfügbar.",
    attachmentsIntro: "Im Anhang finden Sie:",
    attachments: {
      invoice: "Die Rechnung",
      license: "Das Lizenzdokument (mit allen Lizenzschlüsseln)",
    },
    importantInfoTitle: "Wichtige Informationen:",
    importantInfo: [
      "Die Lizenzen werden sofort online aktiviert (keine telefonische Aktivierung erforderlich)",
      "Garantie: 12 Monate",
      "Die Lizenzen stammen aus unserem internen Vertriebssystem",
    ],
    contactText:
      "Wenn Sie Fragen haben oder zusätzliche Lizenzen benötigen, können Sie uns gerne kontaktieren unter:",
    closing: "Mit freundlichen Grüßen",
    founder: "Gründer @ Sertic",
    keyReplacementRequest: "Schlüsselersatzanfrage", // ✅ New key
  },
};
function generateKeyReplacementEmail(companyCountryCode = "EN") {
  // Get template based on country code, fallback to EN if not found
  const template =
    emailTemplates[companyCountryCode.toUpperCase()] || emailTemplates.EN;

  // Minimal email content focused on license replacement
  const htmlContent = `
      <p><strong>${template.keyReplacementRequest}</strong></p>
      <p>${template.attachments.license}</p>
      <p>${template.contactText} <a href="mailto:info@sertic.nl">info@sertic.nl</a></p>
      <p>${template.closing},<br>
      S.R. (Sergio) Eersel<br>
      ${template.founder}</p>`;

  return {
    subject: `${template.keyReplacementRequest} - ${template.subject}`,
    html: htmlContent,
  };
}

export default generateKeyReplacementEmail;
