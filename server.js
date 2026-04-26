import "dotenv/config";
import licenseRoutes from "./routes/license/license.routes.js";
import proformaRoutes from "./routes/proforma/proforma.routes.js";
import invoiceRoutes from "./routes/invoice/invoice.routes.js";
import authRoutes from "./routes/auth.routes.js";
import contactRoutes from "./routes/contact/contact.routes.js";
import express from "express";
const stripeSecretKey = process.env.STRIPE_SECRET_KEY; //sergio test
import Stripe from "stripe";
import cors from "cors";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import { sendAcceptanceEmail, sendDeclineEmail } from './Utils/client-emails.js';
import { sendAdminPendingRegistrationEmail } from './Utils/admin-emails.js';
import { sendVerificationEmail } from './Utils/verification-email.js';

const stripe = new Stripe(stripeSecretKey);

// import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  generateVerificationEmailHTML,
  verificationTemplates,
} from "./Utils/verification-email.js";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import chromium from "@sparticuz/chromium";
import sendEmailWithAttachment from "./Utils/sendEmailWithAttachment.js";
import generateRegistrationEmailHTML from "./templates/Emails/newRegisteredCompaniesrequest.js";
import generateClientStatusEmailHTML from "./templates/Emails/ClientNewRegisterationResponse.js";
import { uploadPDFToSupabaseStorage } from "./services/supabaseStorage.service.js";
import generateLicencePDFBuffer from "./services/pdf/generateLicencePDF.service.js";
import { generateProformaPDFBuffer } from "./services/pdf/generateProformaPDF.service.js";
import { supabaseAdmin } from "./config/supabase.js";
import {
  logPaymentEvent,
  logOrderEvent,
  logDocumentEvent,
  logEmailEvent,
  logSecurityEvent,
  getMasqueradeFromRequest,
} from "./services/auditTrail.service.js";

// import savePDFRecord from "./services/pdf/savePdfRecord.service.js";
puppeteer.use(StealthPlugin());
const isLocalMac = process.platform === "darwin" && process.arch === "arm64";
// YOUR_DOMAIN = "https://microsoftsupplier.com";
// YOUR_DOMAIN = "http://localhost:3000";
const YOUR_DOMAIN = process.env.FRONT_DOMAIN;
// const YOUR_DOMAIN = "https://microsoftsupplier-n-git-deac10-sergioeerselhotmailcoms-projects.vercel.app";
const app = express();

app.use(cors());
app.use(express.static("public"));

import { getNextOrderNumber } from "./Utils/supabaseOrderUtils.js";
import { getOrderById, insertOrder, updateOrder } from "./Utils/supabaseOrderService.js";
import requireAuth from "./middleware/auth.js";
import attachProfile from "./middleware/attachProfile.js";
import { getUserProfile } from "./Utils/getUserProfile.js";
import { getLangCode } from "./Utils/locale.js";
const extractLicenseDataFromSession = (
  session,
  orderId,
  orderNumber,
  productsWithKeys,
) => {
  return {
    customer: {
      name:
        session.customer_details?.name ||
        session.customer_details?.business_name ||
        "",
      businessName: session.customer_details?.business_name,
      address: {
        line1: session.customer_details?.address?.line1 || "",
        postalCode: session.customer_details?.address?.postal_code || "",
        country: session.customer_details?.address?.country || "",
      },
    },
    order: {
      id: orderId,
      number: orderNumber,
      date: new Date(session.created * 1000),
    },
    products: productsWithKeys,
  };
};

async function processPayByInvoiceOrder(
  data,
  orderNumber,
  companyCountry,
  productsWithKeys,
  phisycalProducts,
  orderId,
  taxId,
  company_city,
  company_house_number,
  company_street,
  company_zip_code,
  company_name,
  over_due_date,
  billing_contact,
  billing_documents,
  masquerade = null
) {
  try {
    console.log("pay_by_invoice_order", orderId);

    const _customerId = data.user_id || null;

    // Audit: order created via pay-by-invoice
    logOrderEvent.created(orderId, orderNumber, _customerId, {
      totalAmount:   data.total_amount || data.total,
      currency:      data.currency,
      itemsCount:    (productsWithKeys?.length || 0) + (phisycalProducts?.length || 0),
      paymentMethod: 'invoice',
    }, masquerade);
    // Audit: keys assigned
    logOrderEvent.keysAssigned(orderId, orderNumber, _customerId, {
      licensesCount: productsWithKeys?.reduce((sum, p) => sum + (p.licenseKeys?.length || 0), 0),
      productsCount: productsWithKeys?.length,
    }, masquerade);

    const allProducts = [...productsWithKeys, ...phisycalProducts];
    await updateOrder(orderId, {
      // Add products to a related table if needed
      ...data,
      payment_due_date: over_due_date,
      internal_status: "keys assigned",
    });
    const adaptedSession = {
      created: new Date(), // match Stripe session timestamp
      currency: data.currency,
      metadata: {
        email: data.email,
        po_number: data.po_number,
      },
      customer_details: {
        name: data.customer?.name || "",
        business_name: data.customer?.businessName || "",
        address: {
          line1: data.customer?.address?.line1 || "",
          postal_code: data.customer?.address?.postalCode || "",
          country: data.country || "",
        },
      },
    };

    const licenseData = extractLicenseDataFromSession(
      adaptedSession,
      orderId,
      orderNumber,
      productsWithKeys,
    );

    // Generate PDF with the assigned keys embedded
    const pdfBuffer = await generateLicencePDFBuffer(
      licenseData,
      companyCountry,
      false,
      company_name, company_city, company_street, company_house_number, company_zip_code, taxId
    );
    const proformaPdfBuffer = await generateProformaPDFBuffer(
      data,
      orderNumber,
      allProducts,
      companyCountry,
      taxId,
      company_city,
      company_house_number,
      company_street,
      company_zip_code,
      company_name,
      over_due_date
    );

    const licensePdfUrl = await uploadPDFToSupabaseStorage(
      orderNumber,
      pdfBuffer,
      "License",
    );
    const proformaPdfUrl = await uploadPDFToSupabaseStorage(
      orderNumber,
      proformaPdfBuffer,
      "Proforma",
    );

    // Audit: PDFs generated and uploaded
    logDocumentEvent.generated('license', orderId, orderNumber, _customerId, {
      fileName:   `License-${orderNumber}.pdf`,
      storageUrl: licensePdfUrl,
    }, masquerade);
    logDocumentEvent.generated('proforma', orderId, orderNumber, _customerId, {
      fileName:   `Proforma-${orderNumber}.pdf`,
      storageUrl: proformaPdfUrl,
    }, masquerade);

    // Update order as completed with both URLs
    await updateOrder(orderId, {
      proforma_generated_at: new Date().toISOString(),
      internal_status: "completed",
      proforma_url: proformaPdfUrl,
      license_url: licensePdfUrl,
    });
    const emailTargets = [
      {
        key: "proforma",
        filename: `Proforma-${orderNumber}.pdf`,
        content: proformaPdfBuffer,
        contentType: proformaPdfBuffer.contentType || "application/pdf",
        condition: true,
      },
      // {
      //   key: "license",
      //   filename: `License-${orderNumber}.pdf`,
      //   content: pdfBuffer,
      //   contentType: pdfBuffer.contentType || "application/pdf",
      //   condition: productsWithKeys?.length > 0,
      // },
    ];

    // Group attachments by recipient email
    const recipientMap = {};

    for (const doc of emailTargets) {
      if (!doc.condition) continue;

      const attachment = { filename: doc.filename, content: doc.content, contentType: doc.contentType };

      if (billing_documents?.[`${doc.key}_work_email`] && data?.email) {
        if (!recipientMap[data.email]) recipientMap[data.email] = [];
        recipientMap[data.email].push(attachment);
      }
      const billing_email = billing_contact?.email
      if (billing_documents?.[`${doc.key}_billing_email`] && billing_email && billing_contact?.verified_at) {
        if (!recipientMap[billing_email]) recipientMap[billing_email] = [];
        recipientMap[billing_email].push(attachment);
      }
    }

    // Send one email per recipient with all their attachments
    for (const [email, attachments] of Object.entries(recipientMap)) {
      console.log("sending to:", email, "attachments:", attachments.map(a => a.filename));
      try {
        await sendOrderConfirmationEmail(
          data?.name,
          email,
          attachments,
          companyCountry,
          'proforma'
        );
        // Audit: proforma email sent
        logEmailEvent.proformaSent(orderId, orderNumber, _customerId, email, masquerade);
      } catch (emailErr) {
        console.error('❌ Email send failed:', emailErr.message);
        logEmailEvent.sendFailed(orderId, orderNumber, _customerId, email, {
          failureReason: emailErr.message,
          emailType: 'proforma',
        }, masquerade);
      }
    }

    // Audit: pay-by-invoice order fully completed
    logOrderEvent.completed(orderId, orderNumber, _customerId, {
      proforma_url: proformaPdfUrl,
      license_url:  licensePdfUrl,
      payment_method: 'invoice',
    }, masquerade);

    console.log("✅ Order completed:", orderId);
  } catch (err) {
    console.error("❌ Error processing order:", err);
  }
}

const invoiceTemplates = {
  NL: {
    language: "nl-NL",
    translations: {
      invoiceNumber: "Factuurnummer",
      po_number: "Bestelnummer",
      invoiceDate: "Factuurdatum",
      expiryDate: "Vervaldatum",
      date: "DATUM",
      description: "BESCHRIJVING",
      price: "PRIJS",
      amount: "AANTAL",
      total: "TOTAAL",
      subtotal: "Subtotaal",
      paid: "Betaald",
      vat: "BTW",
      finalTotal: "Eindtotaal",
      paymentInfo: "Betalingsinformatie",
      bankName: "Banknaam",
      accountNumber: "Rekeningnummer",
      accountHolder: "Rekeninghouder",
      businessInfo: "Zakelijke Informatie",
      terms: "Algemene voorwaarden",
      termsText:
        "Nadat wij een bevestiging van uw betaling hebben ontvangen,\nzullen wij uw aanvraag binnen 24 uur in behandeling nemen.",
      signature: "Handtekening",
      location: "Europa – Nederland - Utrecht",
      city: "IJsselstein - Osakastraat 9, 3404DR",
      taxNote: null, // No special tax note for NL
    },
  },
  EN: {
    language: "en-US",
    translations: {
      invoiceNumber: "Invoice Number",
      po_number: "PO number",
      invoiceDate: "Invoice Date",
      expiryDate: "Expiry Date",
      date: "DATE",
      description: "DESCRIPTION",
      price: "PRICE",
      amount: "AMOUNT",
      total: "TOTAL",
      subtotal: "Subtotal",
      paid: "Paid",
      vat: "VAT",
      finalTotal: "Total",
      paymentInfo: "Payment Information",
      bankName: "Bank Name",
      accountNumber: "Account Number",
      accountHolder: "Account Holder",
      businessInfo: "Business Information",
      terms: "General Terms & Conditions",
      termsText:
        "After we receive confirmation of your payment,\nwe will process your request within 24 hours.",
      signature: "Signature",
      location: "Europe – Netherlands - Utrecht",
      city: "IJsselstein - Osakastraat 9, 3404DR",
      taxNote:
        "Digital goods — exempt from US sales tax (seller located outside US)",
    },
  },
  FR: {
    language: "fr-FR",
    translations: {
      invoiceNumber: "Numéro de facture",
      po_number: "Numéro de commande",
      invoiceDate: "Date de facture",
      expiryDate: "Date d'échéance",
      date: "DATE",
      description: "DESCRIPTION",
      price: "PRIX",
      amount: "QUANTITÉ",
      total: "TOTAL",
      subtotal: "Sous-total",
      paid: "Payé",
      vat: "TVA",
      finalTotal: "Total final",
      paymentInfo: "Informations de paiement",
      bankName: "Nom de la banque",
      accountNumber: "Numéro de compte",
      accountHolder: "Titulaire du compte",
      businessInfo: "Informations professionnelles",
      terms: "Conditions générales",
      termsText:
        "Dès réception de votre paiement,\nnous traiterons votre demande dans un délai de 24 heures.",
      signature: "Signature",
      location: "Europe – Pays-Bas – Utrecht",
      city: "IJsselstein - Osakstraat 9, 3404DR",
      taxNote:
        "livraison intracommunautaire (NL → FR, B2B)\nAutoliquidation de la TVA – Article 196 de la directive TVA de l'UE.",
    },
  },
  DE: {
    language: "de-DE",
    translations: {
      invoiceNumber: "Rechnungsnummer",
      po_number: "Bestellnummer",
      invoiceDate: "Rechnungsdatum",
      expiryDate: "Fälligkeitsdatum",
      date: "DATUM",
      description: "BESCHREIBUNG",
      price: "PREIS",
      amount: "MENGE",
      total: "GESAMT",
      subtotal: "Zwischensumme",
      paid: "Bezahlt",
      vat: "MwSt",
      finalTotal: "Endsumme",
      paymentInfo: "Zahlungsinformationen",
      bankName: "Bankname",
      accountNumber: "Kontonummer",
      accountHolder: "Kontoinhaber",
      businessInfo: "Geschäftsinformationen",
      terms: "Allgemeine Geschäftsbedingungen",
      termsText:
        "Nach Erhalt Ihrer Zahlungsbestätigung,\nwerden wir Ihre Anfrage innerhalb von 24 Stunden bearbeiten.",
      signature: "Unterschrift",
      location: "Europa – Niederlande - Utrecht",
      city: "IJsselstein - Osakastraat 9, 3404DR",
      taxNote: null,
      vatNumberLabel: "USt-IdNr",
      vatNotProvided: "USt-IdNr nicht angegeben",
    },
  },
  SE: {
    language: "sv-SE",
    translations: {
      invoiceNumber: "Fakturanummer",
      po_number: "Ordernummer",
      invoiceDate: "Fakturadatum",
      expiryDate: "Förfallodatum",
      date: "DATUM",
      description: "BESKRIVNING",
      price: "PRIS",
      amount: "ANTAL",
      total: "TOTAL",
      subtotal: "Delsumma",
      paid: "Betald",
      notPaid: "Ej betald",
      vat: "Moms enligt unionsreglerna",
      vatLabel: "Moms",
      vatNumberLabel: "Momsnummer",
      vatNotProvided: "Momsregistreringsnummer ej mottaget",
      finalTotal: "Total",
      paymentInfo: "Betalningsinformation",
      bankName: "Bankens namn",
      accountNumber: "Kontonummer",
      accountHolder: "Kontoinnehavare",
      businessInfo: "Företagsinformation",
      terms: "Allmänna villkor",
      termsText:
        "När vi har mottagit bekräftelse på din betalning,\nkommer vi att behandla din förfrågan inom 24 timmar.",
      comments: "Kommentarer",
      signature: "Underskrift",
      location: "Europa – Nederländerna - Utrecht",
      city: "IJsselstein - Osakastraat 9, 3404DR",
      taxNote:
        "Denna faktura har utfärdats enligt unionsreglerna.\nMomsen överförs till köparen enligt artikel 196 i direktiv 2006/112/EG.",
    },
  },
};

// Also add vatNotProvided to the other templates that are missing it
invoiceTemplates.NL.translations.vatNumberLabel = invoiceTemplates.NL.translations.vatNumberLabel || "BTW-nummer";
invoiceTemplates.NL.translations.vatNotProvided = invoiceTemplates.NL.translations.vatNotProvided || "BTW-nummer niet verstrekt";
invoiceTemplates.EN.translations.vatNumberLabel = invoiceTemplates.EN.translations.vatNumberLabel || "VAT Number";
invoiceTemplates.EN.translations.vatNotProvided = invoiceTemplates.EN.translations.vatNotProvided || "VAT number not provided";
invoiceTemplates.FR.translations.vatNumberLabel = invoiceTemplates.FR.translations.vatNumberLabel || "N° TVA";
invoiceTemplates.FR.translations.vatNotProvided = invoiceTemplates.FR.translations.vatNotProvided || "N° TVA non fourni";

// Main function to generate invoice HTML
function generateInvoiceHTML(
  session,
  invoiceNumber,
  orderNumber,
  productsWithKeys,
  companyCountryInput = "EN",
  taxId,
  company_city,
  company_house_number,
  company_street,
  company_zip_code,
  company_name
) {
  // Normalize: "Sweden" / "Sverige" / "SE" → "SE"
  const companyCountryCode = resolveCountryCode(companyCountryInput);
  console.log("[INVOICE DEBUG] companyCountryInput:", companyCountryInput, "→ resolved:", companyCountryCode, "→ template exists:", !!invoiceTemplates[companyCountryCode]);

  // Map country codes to invoice language templates.
  const COUNTRY_TO_TEMPLATE = {
    AT: "DE", CH: "DE", LI: "DE",
    BE: "FR", LU: "FR", MC: "FR",
    SR: "NL", CW: "NL", BQ: "NL",
    FI: "SE", DK: "SE", NO: "SE", IS: "SE",
  };
  const templateKey = COUNTRY_TO_TEMPLATE[companyCountryCode] || companyCountryCode;
  const template = invoiceTemplates[templateKey] || invoiceTemplates.EN;
  const t = template.translations;

  const customer = session.customer_details || {};
  const address = customer.address || {};
  const total = (session.amount_total || 0) / 100;
  const formattedTotal = total.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const currency = (session.currency || "eur").toUpperCase();
  const po_number = session?.metadata?.po_number;
  // Determine currency symbol
  let currencySymbol = currency;
  if (currency.toLowerCase() === "eur") currencySymbol = "€";
  else if (currency.toLowerCase() === "usd") currencySymbol = "$";
  else if (currency.toLowerCase() === "gbp") currencySymbol = "£";
  else if (currency.toLowerCase() === "sek") currencySymbol = "kr";

  // Calculate tax based on country and currency
  let subtotal, tax, vatPercentage;
  if (companyCountryCode.toUpperCase() === "NL") {
    // Netherlands: 21% VAT included
    vatPercentage = 21;
    subtotal = total / 1.21;
    tax = total - subtotal;
  } else if (
    companyCountryCode.toUpperCase() === "EN" &&
    currency.toLowerCase() === "usd"
  ) {
    // USA: No tax (export)
    vatPercentage = 0;
    subtotal = total;
    tax = 0;
  } else if (companyCountryCode.toUpperCase() === "FR") {
    // France: Tax autoliquidation (B2B)
    vatPercentage = 21;
    subtotal = total;
    tax = 0;
  } else if (companyCountryCode.toUpperCase() === "SE") {
    // Sweden: EU reverse charge (B2B)
    vatPercentage = 0;
    subtotal = total;
    tax = 0;
  } else if (companyCountryCode.toUpperCase() === "DE") {
    // Germany: EU reverse charge (B2B)
    vatPercentage = 0;
    subtotal = total;
    tax = 0;
  } else {
    // Default: no VAT for other countries
    subtotal = total;
    tax = 0;
    vatPercentage = 0;
  }
  const formattedTax = tax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedSubtotal = subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });


  // Format dates based on template language
  const invoiceDate = new Date(session.created * 1000).toLocaleDateString(
    template.language,
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    },
  );

  // Due date is 30 days after invoice date
  const dueDate = new Date(session.created * 1000);
  dueDate.setDate(dueDate.getDate() + 30);
  const dueDateFormatted = dueDate.toLocaleDateString(template.language, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Map productsWithKeys to table rows
  const productsRows = (productsWithKeys || [])
    .map((product) => {
      const unitPrice = product.unitPrice || 0;
      const formattedUnitPrice = unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const quantity = product.quantity || 0;
      const calculatedRowTotal = unitPrice * quantity;
      const formattedRowTotal = calculatedRowTotal.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      return `
      <tr>
        <td>${invoiceDate}</td>
        <td>${escapeHtml(product.name || "")}</td>
        <td class="text-right">${currencySymbol} ${formattedUnitPrice}</td>
        <td class="text-center">${quantity}</td>
        <td class="text-right">${currencySymbol} ${formattedRowTotal}</td>
      </tr>
    `;
    })
    .join("");

  // Generate VAT label based on country
  let vatLabel;
  if (companyCountryCode.toUpperCase() === "NL") {
    vatLabel = `${vatPercentage}% ${t.vat}`;
  } else if (
    companyCountryCode.toUpperCase() === "EN" &&
    currency.toLowerCase() === "usd"
  ) {
    vatLabel = `${t.vat}: 0% – Export outside EU`;
  } else if (companyCountryCode.toUpperCase() === "FR") {
    vatLabel = `${t.vat} ${vatPercentage}% incl`;
  } else {
    vatLabel = `${t.vat}`;
  }

  return `
  <html>
  <head>
    <meta charset="UTF-8">
    <title>${t.invoiceNumber} ${escapeHtml(orderNumber)}</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html, body {
        width: 100%;
        min-height: 100vh;
        font-family: Arial, sans-serif;
        color: #333;
        line-height: 1.5;
      }
      body {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }
      .banner {
        width: 100%;
        aspect-ratio: 4 / 1;
        background-image: url("https://yaodjyiimubilqhamwlx.supabase.co/storage/v1/object/sign/MS%20Files/sertic-banner.webp?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iOGZhOGVlZi01NmI4LTRlYjUtOGJjYS1lZjFjYTlkZDkyOGMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJNUyBGaWxlcy9zZXJ0aWMtYmFubmVyLndlYnAiLCJpYXQiOjE3NzcyMDc2ODUsImV4cCI6NDkzMDgwNzY4NX0.4UidB3UAPmwMoLaMH3v9nm_W4zPpGR4Jf8yPRXfHegM");
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 40px;
        color: white;
      }
      .banner .left h1 {
        font-size: 32px;
        margin: 0;
        font-family: "Helvetica", "Arial", sans-serif;
        font-weight: 800;
      }
      .banner .right {
        text-align: right;
        font-size: 16px;
        line-height: 1.6;
        font-family: "Helvetica", "Arial", sans-serif;
        font-weight: 400;
      }
      .banner .right div {
        margin-bottom: 4px;
      }
      .content {
        padding: 20px 40px;
        width: 100%;
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .top-section {
        display: flex;
        justify-content: space-between;
        margin-bottom: 20px;
      }
      .customer-info {
        font-size: 14px;
        line-height: 1.6;
      }
      .customer-info div {
        margin-bottom: 2px;
      }
      .invoice-info {
        text-align: right;
      }
      .invoice-number {
        background: #8BC34A;
        color: white;
        padding: 8px 16px;
        font-weight: bold;
        font-size: 18px;
        display: inline-block;
        margin-bottom: 15px;
      }
      .po-number {
        background: #333b29ff;
        color: white;
        padding: 2px 7px; /* Slightly smaller padding */
        font-weight: bold;
        font-size: 16px;
        display: block;
        margin-bottom: 8px;
        width:fit-content;
      }
      .invoice-dates {
        font-size: 14px;
        line-height: 1.8;
      }
      .invoice-table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
        font-size: 14px;
      }
      .invoice-table thead {
        background: #00A9E0;
        color: white;
      }
      .invoice-table th {
        padding: 10px 10px;
        text-align: left;
        font-weight: bold;
        text-transform: uppercase;
        font-size: 13px;
      }
      .invoice-table td {
        padding: 10px 10px;
        border-bottom: 1px solid #e0e0e0;
      }
      .invoice-table tbody tr:hover {
        background: #f9f9f9;
      }
      .text-right {
        text-align: right;
      }
      .text-center {
        text-align: center;
      }
      .totals-section {
        margin: 20px 0;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: flex-end;
      }
      .totals-table {
        width: 350px;
        font-size: 14px;
      }
      .table-container {
        width: 350px;
        display: flex;
        flex-direction: column;
        
      }
      .totals-table tr {
        border-bottom: 1px solid #e0e0e0;
      }
      .totals-table td {
        padding: 8px;
      }
      .totals-table td:first-child {
        font-weight: bold;
      }
      .totals-table .subtotal-row td {
        background: #f5f5f5;
      }
      .totals-table .tax-row td {
        background: #f5f5f5;
      }
      .totals-table .total-row td {
        background: #00A9E0;
        color: white;
        font-weight: bold;
        font-size: 16px;
        padding: 10px 8px;
      }
      .payment-info {
        margin: 20px 0;
        font-size: 13px;
      }
      .payment-info h3 {
        color: #8BC34A;
        font-size: 14px;
        margin-bottom: 8px;
        font-weight: bold;
      }
      .payment-info div {
        margin-bottom: 2px;
      }
      .professional-info {
        text-align: right;
        font-size: 13px;
        margin-top: 20px;
      }
      .professional-info h3 {
        color: #8BC34A;
        font-size: 14px;
        margin-bottom: 8px;
        font-weight: bold;
      }
      .bottom-section {
        margin-top: 25px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 20px;
      }
      .terms-section {
        flex: 1;
        font-size: 13px;
      }
      .terms-section h3 {
        color: #8BC34A;
        font-size: 14px;
        margin-bottom: 8px;
        font-weight: bold;
      }
      .terms-section p {
        margin-bottom: 10px;
        line-height: 1.5;
        white-space: pre-line;
      }
      .signature-section {
        text-align: center;
        width: 200px;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .signature-image {
        width: 80px;
        height: 80px;
        border-bottom: 2px solid #333;
        margin: 0 auto 10px auto;
        display: block;
      }
      .signature-image img {
        width: 100%;
        display: block;
        margin: 0;
      }
      .signature-label {
        font-weight: bold;
        font-size: 14px;
      }
      .footer {
        text-align: center;
        padding: 20px 0;
        background: white;
        width: 100%;
        margin-top: auto;
      }
      .footer img {
        max-width: 200px;
        height: auto;
      }
      .currency-note {
        font-size: 11px;
        font-style: italic;
        color: #666;
        margin-top: 5px;
      }
      .tax-note {
        font-size: 11px;
        color: #666;
        margin-top: 8px;
        font-style: italic;
      }
      .invoice-content {
        flex: 1;
      }
    </style>
  </head>
  <body>
    <div class="banner">
      <div class="left">
        <h1>Sertic</h1>
      </div>
      <div class="right">
        <div><strong>${t.location}</strong></div>
        <div>${t.city}</div>
        <div>info@sertic.nl</div>
        <div>Sertic.nl</div>
      </div>
    </div>

    <div class="content">
      <div class="invoice-content">
        <div class="top-section">
          <div class="customer-info">
            <div><strong>${escapeHtml(
    company_name || "COMPANY NAME",
  )}</strong></div>
            <div>${escapeHtml(company_street || "")}${company_house_number ? " " + escapeHtml(company_house_number) : ""}</div>
            <div>${escapeHtml(
    company_zip_code || "POSTAL CODE",
  )} ${escapeHtml(company_city || "CITY")}</div>
            <div>${escapeHtml(getCountryName(companyCountryCode) || companyCountryCode || "COUNTRY")}</div>
            ${taxId
      ? `<div>${t.vatNumberLabel || "VAT Number"}: ${escapeHtml(taxId)}</div>`
      : `<div>${t.vatNumberLabel || "VAT Number"}: (${t.vatNotProvided || "not provided"})</div>`
    }
          </div>
          
          <div class="invoice-info">
                           ${po_number
      ? `
              <div class="po-number">PO: ${escapeHtml(po_number)}</div>
            `
      : ""
    }
            <div class="invoice-number">${t.invoiceNumber}: #${escapeHtml(
      orderNumber,
    )}</div>
            <div class="invoice-dates">
              <div><strong>${t.invoiceDate}:</strong> ${invoiceDate}</div>
              <div><strong>${t.expiryDate}:</strong> ${dueDateFormatted}</div>
            </div>
          </div>
        </div>

        <table class="invoice-table">
          <thead>
            <tr>
              <th>${t.date}</th>
              <th>${t.description}</th>
              <th class="text-center">${t.price}</th>
              <th class="text-center">${t.amount}</th>
              <th class="text-center">${t.total}</th>
            </tr>
          </thead>
          <tbody>
            ${productsRows}
          </tbody>
        </table>

        <div class="totals-section">
          <div class="table-container">
          <table class="totals-table">
            <tr class="subtotal-row">
              <td>${t.subtotal}:</td>
              <td class="text-right">${currencySymbol} ${formattedSubtotal}</td>
            </tr>
            <tr class="tax-row">
              <td>${vatLabel}:</td>
              <td class="text-right">${currencySymbol} ${formattedTax}</td>
            </tr>
            <tr class="total-row">
              <td>${t.finalTotal}:</td>
              <td class="text-right">${currencySymbol} ${formattedTotal}</td>
            </tr>
          </table>
          <div class="invoice-status">
          <strong>${t.paid}</strong>
          </div>
          </div>
        </div>
        
        ${currency.toLowerCase() === "usd"
      ? `<div class="currency-note">Currency: USD (United States Dollar)</div>`
      : ""
    }
        ${t.taxNote ? `<div class="tax-note">${t.taxNote}</div>` : ""}

        <div style="display: flex; justify-content: space-between;">
          <div class="payment-info">
            <h3>${t.paymentInfo}:</h3>
            <div>${t.bankName}: KNAB</div>
            <div>BIC: KNABNL2H</div>
            <div>${t.accountNumber}: NL15 KNAB 0401 3837 92</div>
            <div>${t.accountHolder}: S.R. Eersel</div>
          </div>
          
          <div class="professional-info">
            <h3>${t.businessInfo}</h3>
            <div>KVK: 65 26 84 23</div>
            <div>BTW: NL00 2264 923B 25</div>
          </div>
        </div>

        <div class="bottom-section">
          <div class="terms-section">
            <h3>${t.terms}</h3>
            <p>${t.termsText}</p>
          </div>
          
          <div class="signature-section">
            <div class="signature-image">
              <img src="https://yaodjyiimubilqhamwlx.supabase.co/storage/v1/object/sign/MS%20Files/Screenshot%202026-04-26%20at%204.35.56%20PM.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iOGZhOGVlZi01NmI4LTRlYjUtOGJjYS1lZjFjYTlkZDkyOGMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJNUyBGaWxlcy9TY3JlZW5zaG90IDIwMjYtMDQtMjYgYXQgNC4zNS41NiBQTS5wbmciLCJpYXQiOjE3NzcyMDcxNjEsImV4cCI6NDkzMDgwNzE2MX0.fqRfLTJJsxHGveNpu0dSszkzazfqixu4rGY_eBhrJdk" alt="Signature">
            </div>
            <div class="signature-label">${t.signature}</div>
          </div>
        </div>
      </div>

      <div class="footer">
        <img src="https://yaodjyiimubilqhamwlx.supabase.co/storage/v1/object/sign/MS%20Files/Screenshot%202026-04-26%20at%204.34.42%20PM.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iOGZhOGVlZi01NmI4LTRlYjUtOGJjYS1lZjFjYTlkZDkyOGMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJNUyBGaWxlcy9TY3JlZW5zaG90IDIwMjYtMDQtMjYgYXQgNC4zNC40MiBQTS5wbmciLCJpYXQiOjE3NzcyMDcxODQsImV4cCI6NDkzMDgwNzE4NH0.cyDgOySfJl4Wb_cMRKXHTApYt-aI1U9ymPJeALha8Hk" alt="Microsoft Supplier Logo">
      </div>
    </div>
  </body>
  </html>
  `;
}

// Simple HTML-escape to avoid injection in generated HTML
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Map ISO country codes to localized display names */
const COUNTRY_CODE_TO_NAME = {
  NL: "Nederland", DE: "Deutschland", FR: "France",
  SE: "Sverige", GB: "United Kingdom", US: "United States",
  BE: "België", AT: "Österreich", CH: "Schweiz",
  IT: "Italia", ES: "España", PL: "Polska",
  DK: "Danmark", NO: "Norge", FI: "Finland",
  IE: "Ireland", LU: "Luxembourg", PT: "Portugal",
};

function getCountryName(code) {
  return COUNTRY_CODE_TO_NAME[(code || "").toUpperCase()] || null;
}

/** Normalize full country name or ISO code → 2-letter ISO code */
const COUNTRY_NAME_TO_CODE = {
  "netherlands": "NL", "the netherlands": "NL", "holland": "NL",
  "germany": "DE", "france": "FR", "sweden": "SE",
  "united kingdom": "GB", "uk": "GB", "great britain": "GB",
  "united states": "US", "usa": "US",
  "belgium": "BE", "austria": "AT", "switzerland": "CH",
  "italy": "IT", "spain": "ES", "poland": "PL",
  "denmark": "DK", "norway": "NO", "finland": "FI",
  "ireland": "IE", "luxembourg": "LU", "portugal": "PT",
  "iceland": "IS", "liechtenstein": "LI",
  "nederland": "NL", "deutschland": "DE",
  "sverige": "SE", "belgique": "BE", "belgien": "BE", "belgië": "BE",
  "österreich": "AT", "schweiz": "CH", "suisse": "CH",
  "italia": "IT", "españa": "ES", "polska": "PL",
  "danmark": "DK", "norge": "NO",
};

function resolveCountryCode(input) {
  if (!input) return "EN";
  const upper = input.trim().toUpperCase();
  if (upper.length === 2) return upper;
  return COUNTRY_NAME_TO_CODE[input.trim().toLowerCase()] || "EN";
}

async function assignKeysToProducts(
  orderId,
  orderNumber,
  digitalProducts,
  b2b_supplier_id,
  id,
) {
  const results = [];
  for (const product of digitalProducts) {
    const needed = product.quantity || 0;
    const productId = product?.productId; // or product.productId (whichever your data uses)

    // Reserve keys for this specific product
    const assignedKeys = await reserveLicenseKeys(
      orderId,
      orderNumber,
      productId,
      needed,
      b2b_supplier_id,
      id,
    );

    results.push({
      ...product,
      licenseKeys: assignedKeys,
      replacementHistory: [],
    });
  }

  return results;
}

async function reserveLicenseKeys(
  orderId,
  orderNumber,
  productId,
  neededQty,
  b2b_supplier_id,
  id,
) {
  if (neededQty <= 0) return [];

  console.log(`🔄 Transaction started: order=${orderId}, product=${productId}`);
  console.log("b2b_supplier_id", b2b_supplier_id);

  try {
    const { data: reservedDbKeys, error } = await supabaseAdmin.rpc("reserve_keys", {
      p_order_id: orderId,
      p_order_number: orderNumber,
      p_product_id: productId,
      p_needed_qty: neededQty,
      p_user_id: id,
      // Safety: If b2b_supplier_id is undefined, send null explicitly
      p_b2b_supplier_id: b2b_supplier_id || null,
    });

    if (error) throw new Error(error.message);
 // Helper to mask license key, keeping only the last 5 characters
    function maskLicenseKey(key) {
      if (!key) return "";
      // If key is in format XXXXX-XXXXX-XXXXX-XXXXX-XXXXX
      const parts = key.split("-");
      if (parts.length === 5 && parts.every(p => p.length === 5)) {
        return parts[4];
      }
      // Otherwise, just return last 5 chars 
      return key.slice(-5);
    }
    // Format to match your original return object exactly
    const formattedKeys = reservedDbKeys.map((item) => ({
      key: maskLicenseKey(item.license_key),
      status: "active",
      licenseDocId: item.id,
      revealedAt: null,
      copiedAt: null,
      isReplacement: false,
      addedAt: Date.now(),
      replacedAt: null,
      replacementReason: null,
      licenseDocId: item.id,
    }));

   

    console.log(`✅ Reserved keys for product ${productId}:`, formattedKeys);
    return formattedKeys;
  } catch (err) {
    console.error("Reserve Keys Error:", err.message);
    throw err;
  }
}

app.post(
  "/webhooks",
  express.raw({ type: "application/json" }),
  async (request, response) => {
    const sig = request.headers["stripe-signature"];

    try {
      const event = stripe.webhooks.constructEvent(
        request.body,
        sig,
        process.env.WEBHOOK_SECRET,
      );

      console.log("🔔 Webhook received:", event.type, "| event.id:", event.id);

      // 🔥 Respond immediately before doing any slow work
      response.json({ received: true });

      // Continue processing in background
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        console.log("🔔 [DUPLICATE DEBUG] checkout.session.completed | session.id:", session.id, "| metadata.orderId:", session?.metadata?.orderId);

        // Audit: payment webhook received
        const _customerId = session?.metadata?.id || null;
        logPaymentEvent.webhookReceived(session.id, _customerId, {
          amount:   session.amount_total ? session.amount_total / 100 : null,
          currency: session.currency,
          orderNumber: session?.metadata?.orderNumber || null,
        });

        processPaidOrder(session); // Fire and forget
      }
    } catch (err) {
      console.log("❌ Webhook verification failed:", err.message);
      // Audit: webhook signature verification failure
      logSecurityEvent.webhookVerificationFailed({ failureReason: err.message });
      return response.status(400).json({ error: err.message });
    }
  },
);

const emailTemplates = {
  NL: {
    subject: "Uw bestelling bij Microsoft Supplier",
    title: "Bestelling bevestigd",
    greeting: "Beste",
    thankYou: "Bedankt voor uw bestelling.",
    processed: "De licenties zijn succesvol verwerkt en de documenten zijn nu beschikbaar.",
    attachmentsTitle: "BIJLAGEN",
    attachments: {
      invoice: "De factuur (BTW 21% - Export binnen NL)",
      license: "Het licentiedocument (met alle licentiesleutels)",
      proforma: "De proforma factuur (BTW 21% - Export binnen NL)",
    },
    importantTitle: "BELANGRIJKE INFORMATIE",
    importantInfo: [
      "De licenties worden direct online geactiveerd (telefonische activatie is niet nodig)",
      "Garantie: 36 maanden",
      "De licenties zijn afkomstig uit ons interne distributiesysteem",
    ],
    contactText: "Vragen? Antwoord op deze e-mail",
    closing: "Met vriendelijke groet",
    founder: "Founder @ Sertic",
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
      license: "The license document (containing all license keys)",
      proforma: "The pro forma invoice (VAT 0% – Export outside EU)",
    },
    importantTitle: "IMPORTANT INFORMATION",
    importantInfo: [
      "The licenses activate online immediately (no phone activation required)",
      "Warranty: 36 months",
      "The licenses are supplied through our internal distribution system",
      "Delivery method: Digital ESD licenses via email (no physical shipment)",
      "Not subject to U.S. sales tax",
    ],
    contactText: "Questions? Reply to this email",
    closing: "Kind regards",
    founder: "Founder @ Sertic",
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
      proforma: "La facture proforma (TVA autoliquidée – Article 196 de la directive TVA de l'UE)",
      license: "Le document de licence (contenant toutes les clés de licence)",
    },
    importantTitle: "INFORMATIONS IMPORTANTES",
    importantInfo: [
      "Les licences s'activent directement en ligne (aucune activation téléphonique n'est nécessaire)",
      "Garantie : 36 mois",
      "Les licences proviennent de notre système interne de distribution",
    ],
    contactText: "Questions ? Répondez à cet e-mail",
    closing: "Cordialement",
    founder: "Founder @ Sertic",
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
      proforma: "Die Proforma-Rechnung (MwSt. 0% – Export außerhalb der EU)",
      license: "Das Lizenzdokument (mit allen Lizenzschlüsseln)",
    },
    importantTitle: "WICHTIGE INFORMATIONEN",
    importantInfo: [
      "Die Lizenzen werden sofort online aktiviert (keine telefonische Aktivierung erforderlich)",
      "Garantie: 36 Monate",
      "Die Lizenzen stammen aus unserem internen Vertriebssystem",
    ],
    contactText: "Fragen? Antworten Sie auf diese E-Mail",
    closing: "Mit freundlichen Grüßen",
    founder: "Gründer @ Sertic",
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
      license: "El documento de licencia (con todas las claves de licencia)",
    },
    importantTitle: "INFORMACIÓN IMPORTANTE",
    importantInfo: [
      "Las licencias se activan en línea inmediatamente (no se requiere activación telefónica)",
      "Garantía: 36 meses",
      "Las licencias provienen de nuestro sistema de distribución interno",
    ],
    contactText: "¿Preguntas? Responda a este correo",
    closing: "Saludos cordiales",
    founder: "Founder @ Sertic",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026",
  },
  SE: {
    subject: "Din Microsoft Supplier-beställning",
    title: "Beställning bekräftad",
    greeting: "Hej",
    thankYou: "Tack för din beställning.",
    processed: "Licenserna har behandlats och dokumenten är nu tillgängliga.",
    attachmentsTitle: "BILAGOR",
    attachments: {
      invoice: "Fakturan",
      proforma: "Proformafakturan",
      license: "Licensdokumentet (med alla licensnycklar)",
    },
    importantTitle: "VIKTIG INFORMATION",
    importantInfo: [
      "Licenserna aktiveras direkt online (ingen telefonaktivering krävs)",
      "Garanti: 36 månader",
      "Licenserna levereras via vårt interna distributionssystem",
    ],
    contactText: "Frågor? Svara på detta e-postmeddelande",
    closing: "Vänliga hälsningar",
    founder: "Grundare @ Sertic",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026",
  },
};

function generateEmailContent(customerName, companyCountryCode = "EN", type) {
  const template =
    emailTemplates[companyCountryCode.toUpperCase()] || emailTemplates.EN;

  const name = customerName || "";
  const displayName = name ? ` ${name}` : "";

  const importantInfoList = template.importantInfo
    .map((info) => `• ${info}`)
    .join("<br>\n          ");

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
        <img class="mobile-logo" src="https://yaodjyiimubilqhamwlx.supabase.co/storage/v1/object/sign/MS%20Files/Screenshot%202026-04-26%20at%204.34.42%20PM.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iOGZhOGVlZi01NmI4LTRlYjUtOGJjYS1lZjFjYTlkZDkyOGMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJNUyBGaWxlcy9TY3JlZW5zaG90IDIwMjYtMDQtMjYgYXQgNC4zNC40MiBQTS5wbmciLCJpYXQiOjE3NzcyMDcxODQsImV4cCI6NDkzMDgwNzE4NH0.cyDgOySfJl4Wb_cMRKXHTApYt-aI1U9ymPJeALha8Hk"
             alt="Microsoft Supplier"
             style="height: 48px;">
      </div>

      <!-- Content -->
      <div class="mobile-content" style="padding: 0 40px 50px; text-align: center;">

        <h1 class="mobile-title" style="color: #1a202c; margin: 0 0 30px 0; font-size: 26px; font-weight: 400; letter-spacing: -0.3px;">
          ${template.title}
        </h1>

        <p class="mobile-text" style="color: #4a5568; margin: 0 0 20px 0; font-size: 16px; line-height: 1.5;">
          ${template.greeting}${displayName},
        </p>

        <p class="mobile-text" style="color: #4a5568; margin: 0 0 35px 0; font-size: 16px; line-height: 1.5;">
          ${template.thankYou} ${template.processed}
        </p>

        <!-- Attachments Box -->
        <div class="mobile-box" style="background: #f7fafc; padding: 24px; margin: 0 0 35px 0; text-align: left; border-radius: 6px;">
          <p class="mobile-small" style="color: #718096; margin: 0 0 12px 0; font-size: 13px; letter-spacing: 0.5px;">${template.attachmentsTitle}</p>
          <p class="mobile-small" style="color: #2d3748; margin: 0; font-size: 14px; line-height: 1.8;">
            • ${type === 'invoice' ? template.attachments.invoice : template.attachments.proforma}<br>
          </p>
        </div>

        <!-- Important Info Box -->
        <div class="mobile-box" style="background: #fef3c7; padding: 20px; margin: 0 0 35px 0; text-align: left; border-radius: 6px; border-left: 4px solid #f59e0b;">
          <p class="mobile-small" style="color: #92400e; margin: 0 0 8px 0; font-size: 13px; font-weight: 600; letter-spacing: 0.5px;">
            ${template.importantTitle}
          </p>
          <p class="mobile-small" style="color: #92400e; margin: 0; font-size: 13px; line-height: 1.6;">
            ${importantInfoList}
          </p>
        </div>

        <p class="mobile-small" style="color: #a0aec0; margin: 0; font-size: 14px;">
          ${template.contactText}
        </p>

        <p class="mobile-small" style="color: #4a5568; margin: 30px 0 0 0; font-size: 14px; line-height: 1.8;">
          ${template.closing},<br>
          S.R. (Sergio) Eersel<br>
          <span style="color: #a0aec0;">${template.founder}</span>
        </p>
      </div>

      <!-- Footer -->
      <div class="mobile-footer" style="padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p class="mobile-small" style="color: #a0aec0; margin: 0 0 4px 0; font-size: 13px; letter-spacing: 0.3px;">
          ${template.footer}
        </p>
        <p class="mobile-small" style="color: #cbd5e0; margin: 0; font-size: 12px;">
          ${template.copyright}
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return {
    subject: template.subject,
    html: htmlContent,
  };
}

// Main function to send email with attachments
async function sendOrderConfirmationEmail(
  customerName = "",
  customerEmail,
  emailAttachments,
  companyCountryCode = "EN",
  type = 'invoice'
) {
  const emailContent = generateEmailContent(customerName, companyCountryCode, type);

  await sendEmailWithAttachment(
    emailContent.subject,
    emailContent.html,
    customerEmail,
    process.env.EMAIL_USER,
    process.env.EMAIL_USER,
    emailAttachments,
  );
}
async function processPaidOrder(session) {
  try {
    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["line_items.data.price.product"],
    });
    const user_id = fullSession?.metadata?.id;
    let userProfile = null;
    if (user_id) {
      userProfile = await getUserProfile(user_id);
    }
console.log("user_profile", userProfile);

    const {
      id,
      email,
      company_name,
      company_country,
      tax_id,
      b2b_supplier_id,
      invoice_settings, // This remains an object { enabled: true, ... }
      lang_code,
      company_city,
      company_house_number,
      company_street,
      company_zip_code,
      billing_contact,
      billing_documents
    } = userProfile;

    if (fullSession?.metadata && fullSession?.metadata?.orderId) {
      const orderId = fullSession?.metadata?.orderId;
      const orderNumber = fullSession?.metadata?.orderNumber;

      const orderRef = await getOrderById(orderId);

      const allProducts = orderRef.products ?? [];

      const invoicePdfBuffer = await generateInvoicePDFBuffer(
        fullSession,
        orderId,
        orderNumber,
        allProducts,
        company_country,
        tax_id,
        company_city,
        company_house_number,
        company_street,
        company_zip_code,
        company_name,
      );

      const invoicePdfUrl = await uploadPDFToSupabaseStorage(
        orderNumber,
        invoicePdfBuffer,
        "Invoice",
      );

      // Audit: invoice PDF generated + uploaded
      logDocumentEvent.generated('invoice', orderId, orderNumber, id, {
        fileName:   `Invoice-${orderNumber}.pdf`,
        storageUrl: invoicePdfUrl,
      });

      // Update order as completed with both URLs
      await updateOrder(orderRef?.id, {
        invoice_generated_at: new Date(),
        payment_status: "paid",
        invoice_url: invoicePdfUrl,
      });

      // Audit: order paid (existing order re-paid)
      logOrderEvent.paid(orderId, orderNumber, id, {
        amount:        fullSession?.amount_total ? fullSession.amount_total / 100 : null,
        currency:      fullSession?.currency,
        paymentMethod: 'stripe',
      });





      const emailTargets = [
        {
          key: "invoice",
          filename: `Invoice-${orderNumber}.pdf`,
          content: invoicePdfBuffer,
          contentType: invoicePdfBuffer.contentType || "application/pdf",
          condition: true,
        },
      ];

      // Group attachments by recipient email
      const recipientMap = {};
      const email = fullSession?.metadata?.email
      for (const doc of emailTargets) {
        if (!doc.condition) continue;

        const attachment = { filename: doc.filename, content: doc.content, contentType: doc.contentType };

        if (billing_documents?.[`${doc.key}_work_email`] && email) {
          if (!recipientMap[email]) recipientMap[email] = [];
          recipientMap[email].push(attachment);
        }
        const billing_email = billing_contact?.email
        if (billing_documents?.[`${doc.key}_billing_email`] && billing_email && billing_contact?.verified_at) {
          if (!recipientMap[billing_email]) recipientMap[billing_email] = [];
          recipientMap[billing_email].push(attachment);
        }
      }

      // Send one email per recipient with all their attachments
      for (const [email, attachments] of Object.entries(recipientMap)) {
        console.log("sending to:", email, "attachments:", attachments.map(a => a.filename));
        try {
          await sendOrderConfirmationEmail(
            "",
            email,
            attachments,
            company_country, // 'NL', 'EN', 'FR', or 'DE'
            'invoice'
          );
          // Audit: invoice email sent
          logEmailEvent.invoiceSent(orderId, orderNumber, id, email);
        } catch (emailErr) {
          console.error('❌ Email send failed:', emailErr.message);
          logEmailEvent.sendFailed(orderId, orderNumber, id, email, {
            failureReason: emailErr.message,
            emailType: 'invoice',
          });
        }
      }

      // Audit: order fully completed (existing order re-paid)
      logOrderEvent.completed(orderId, orderNumber, id, {
        invoice_url: invoicePdfUrl,
      });

    } else {
      const orderNumber = await getNextOrderNumber();
      console.log("fullSession12", fullSession?.line_items?.data[0]);
      const po_number = fullSession?.metadata?.po_number || null;

      const data = {
        user_id: id,
        orderNumber: orderNumber,
        po_number: po_number,
        po_number: fullSession?.metadata?.po_number,
        internal_status: "pending",
        email: email,
        country: company_country,
        city: company_city,
        address1: company_country,
        address2: `${company_street} ${company_house_number}`,
        postal_code: company_zip_code,
        company_name: company_name,
        total: fullSession?.amount_total / 100,
        currency: fullSession?.currency,
        created_at: new Date(),
        total_amount: fullSession?.amount_total / 100,
        products: fullSession?.line_items?.data?.map((item) => ({
          productId: item?.price?.product?.metadata?.id,
          name: item?.price?.product?.name,
          quantity: item?.quantity,
          unitPrice: item?.price?.unit_amount / 100,
          totalPrice: item?.amount_total / 100,
          isDigital: item?.price?.product?.metadata?.isDigital === "true", // Retrieve from metadata
          PN: item?.price?.product?.metadata?.pn,
          image_url: item?.price?.product?.metadata?.image_url,
          install_url_en: item?.price?.product?.metadata?.install_url_en || "",
          install_url_de: item?.price?.product?.metadata?.install_url_de || "",
          install_url_fr: item?.price?.product?.metadata?.install_url_fr || "",
          install_url_nl: item?.price?.product?.metadata?.install_url_nl || "",
          install_url_sv: item?.price?.product?.metadata?.install_url_sv || "",
          subscription_type: item?.price?.product?.metadata?.subscription_type || "",
          product_category: item?.price?.product?.metadata?.product_category || "",
        })),
      };

      let digitalProducts =
        data.products?.filter((product) => product.isDigital) ?? [];
      let phisycalProducts =
        data.products?.filter((product) => !product.isDigital) ?? [];
      const order = await insertOrder(data);
      const orderId = order.id;

      // Audit: new order created
      logOrderEvent.created(orderId, orderNumber, id, {
        totalAmount:   data.total_amount,
        currency:      data.currency,
        itemsCount:    data.products?.length,
        paymentMethod: 'stripe',
      });
      // Audit: payment confirmed by Stripe
      logPaymentEvent.initiated(orderId, orderNumber, id, {
        amount:        data.total_amount,
        currency:      data.currency,
        paymentMethod: 'stripe',
      });

      let productsWithKeys;
      try {
        productsWithKeys = await assignKeysToProducts(
          orderId,
          orderNumber,
          digitalProducts,
          b2b_supplier_id,
          id,
        );
      } catch (err) {
        console.error(
          "❌ Not enough license keys or error reserving keys:",
          err.message,
        );

        // Update order as failed or out-of-stock
        await updateOrder(orderId, {
          internal_status: "failed",
          failure_reason: err.message,
          invoice_generated_at: null,
        });

        // Audit: payment / key assignment failed
        logPaymentEvent.failed(orderId, orderNumber, id, {
          failureReason: err.message,
          paymentMethod: 'stripe',
        });

        // optional: notify admin or send email to customer here
        return;
      }
      const allProducts = [...productsWithKeys, ...phisycalProducts];
      await updateOrder(orderId, {
        // Add products to a related table if needed
        products: allProducts,
        internal_status: "keys assigned",
      });

      // Audit: license keys assigned
      logOrderEvent.keysAssigned(orderId, orderNumber, id, {
        licensesCount: productsWithKeys?.reduce((sum, p) => sum + (p.licenseKeys?.length || 0), 0),
        productsCount: productsWithKeys?.length,
      });
      const licenseData = extractLicenseDataFromSession(
        session,
        orderId,
        orderNumber,
        productsWithKeys,
      );
      // Generate PDF with the assigned keys embedded
      const pdfBuffer = await generateLicencePDFBuffer(
        licenseData,
        company_country,
        false,
        company_name, company_city, company_street, company_house_number, company_zip_code, tax_id
      );
      const invoicePdfBuffer = await generateInvoicePDFBuffer(
        fullSession,
        orderId,
        orderNumber,
        allProducts,
        company_country,
        tax_id,
        company_city,
        company_house_number,
        company_street,
        company_zip_code,
        company_name,
      );

      const licensePdfUrl = await uploadPDFToSupabaseStorage(
        orderNumber,
        pdfBuffer,
        "License",
      );
      const invoicePdfUrl = await uploadPDFToSupabaseStorage(
        orderNumber,
        invoicePdfBuffer,
        "Invoice",
      );

      // Audit: PDFs generated and uploaded
      logDocumentEvent.generated('license', orderId, orderNumber, id, {
        fileName:   `License-${orderNumber}.pdf`,
        storageUrl: licensePdfUrl,
      });
      logDocumentEvent.generated('invoice', orderId, orderNumber, id, {
        fileName:   `Invoice-${orderNumber}.pdf`,
        storageUrl: invoicePdfUrl,
      });

      // Update order as completed with both URLs
      await updateOrder(orderId, {
        invoice_generated_at: new Date().toISOString(),
        internal_status: "completed",
        payment_status: "paid",
        invoice_url: invoicePdfUrl,
        license_url: licensePdfUrl,
      });

      // Audit: order paid and completed
      logOrderEvent.paid(orderId, orderNumber, id, {
        amount:        data.total_amount,
        currency:      data.currency,
        paymentMethod: 'stripe',
      });








      const emailTargets = [
        {
          key: "invoice",
          filename: `Invoice-${orderNumber}.pdf`,
          content: invoicePdfBuffer,
          contentType: invoicePdfBuffer.contentType || "application/pdf",
          condition: true,
        },
        // {
        //   key: "license",
        //   filename: `License-${orderNumber}.pdf`,
        //   content: pdfBuffer,
        //   contentType: pdfBuffer.contentType || "application/pdf",
        //   condition: productsWithKeys?.length > 0,
        // },
      ];

      // Group attachments by recipient email
      const recipientMap = {};
      for (const doc of emailTargets) {
        if (!doc.condition) continue;

        const attachment = { filename: doc.filename, content: doc.content, contentType: doc.contentType };

        if (billing_documents?.[`${doc.key}_work_email`] && data?.email) {
          if (!recipientMap[data?.email]) recipientMap[email] = [];
          recipientMap[data?.email].push(attachment);
        }
        const billing_email = billing_contact?.email
        if (billing_documents?.[`${doc.key}_billing_email`] && billing_email && billing_documents?.verified_at) {
          if (!recipientMap[billing_email]) recipientMap[billing_email] = [];
          recipientMap[billing_email].push(attachment);
        }
      }

      // Send one email per recipient with all their attachments
      for (const [email, attachments] of Object.entries(recipientMap)) {
        console.log("sending to:", email, "attachments:", attachments.map(a => a.filename));
        try {
          await sendOrderConfirmationEmail(
            data?.name,
            email,
            attachments,
            company_country, // 'NL', 'EN', 'FR', or 'DE'
            'invoice'
          );
          // Audit: invoice email sent to recipient
          logEmailEvent.invoiceSent(orderId, orderNumber, id, email);
        } catch (emailErr) {
          console.error('❌ Email send failed:', emailErr.message);
          logEmailEvent.sendFailed(orderId, orderNumber, id, email, {
            failureReason: emailErr.message,
            emailType: 'invoice',
          });
        }
      }

      // Audit: new order fully completed
      logOrderEvent.completed(orderId, orderNumber, id, {
        invoice_url: invoicePdfUrl,
        license_url: licensePdfUrl,
      });

    }
  } catch (err) {
    console.error("❌ Error processing order:", err);
  }
}

// New function for generating invoice PDF
async function generateInvoicePDFBuffer(
  session,
  orderId,
  orderNumber,
  productsWithKeys,
  companyCountryCode,
  taxId,
  company_city,
  company_house_number,
  company_street,
  company_zip_code,
  company_name
) {
  let browser;
  try {
    const htmlContent = generateInvoiceHTML(
      session,
      orderId,
      orderNumber,
      productsWithKeys,
      companyCountryCode,
      taxId,
      company_city,
      company_house_number,
      company_street,
      company_zip_code,
      company_name
    );

    // browser = await puppeteer.launch({
    //   args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"], // Use chromium's recommended args
    //   defaultViewport: chromium.defaultViewport,
    //   executablePath: await chromium.executablePath(), // <-- THIS is the key line
    //   headless: chromium.headless,
    //   ignoreHTTPSErrors: true,
    // });
    browser = await puppeteer.launch(
      isLocalMac
        ? {
          // ✅ macOS (M1–M4) → system Chrome
          executablePath:
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          headless: "new",
        }
        : {
          // ✅ AWS / serverless → sparticuz chromium
          args: chromium.args,
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
        },
    );
    const page = await browser.newPage();
    await page.setContent(htmlContent, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    console.log("✅ Invoice PDF buffer generated");
    return pdfBuffer;
  } catch (error) {
    console.error("❌ Error generating invoice PDF buffer:", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
app.use(express.json());
app.use(bodyParser.json());



app.get("/", (req, res) => {
  res.send("welcome to microsoftsupplier website");
});

// Common translations for verification API responses
const verificationApiMessages = {
  EN: {
    missing: "Missing token or uid",
    notFound: "User not found",
    invalid: "Invalid or expired verification link",
    verified: "Email verified successfully",
    error: "An error occurred",
    alreadySent: "Verification email already sent. Please check your inbox.",
    alreadyVerified: "Email is already verified. No email sent.",
    sent: "Verification email sent successfully",
    firebaseNotFound: "User not found in Firebase Auth",
    unauthorized: "Unauthorized: UID mismatch",
    missingData: "Missing data",
  },
  NL: {
    missing: "Ontbrekende token of uid",
    notFound: "Gebruiker niet gevonden",
    invalid: "Ongeldige of verlopen verificatielink",
    verified: "E-mailadres succesvol geverifieerd",
    error: "Er is een fout opgetreden",
    alreadySent: "Verificatie-e-mail is al verzonden. Controleer uw inbox.",
    alreadyVerified: "E-mailadres is al geverifieerd. Geen e-mail verzonden.",
    sent: "Verificatie-e-mail succesvol verzonden",
    firebaseNotFound: "Gebruiker niet gevonden in Firebase Auth",
    unauthorized: "Niet gemachtigd: UID komt niet overeen",
    missingData: "Ontbrekende gegevens",
  },
  FR: {
    missing: "Token ou uid manquant",
    notFound: "Utilisateur non trouvé",
    invalid: "Lien de vérification invalide ou expiré",
    verified: "E-mail vérifié avec succès",
    error: "Une erreur est survenue",
    alreadySent:
      "E-mail de vérification déjà envoyé. Veuillez vérifier votre boîte de réception.",
    alreadyVerified: "E-mail déjà vérifié. Aucun e-mail envoyé.",
    sent: "E-mail de vérification envoyé avec succès",
    firebaseNotFound: "Utilisateur non trouvé dans Firebase Auth",
    unauthorized: "Non autorisé : UID ne correspond pas",
    missingData: "Données manquantes",
  },
  DE: {
    missing: "Fehlendes Token oder UID",
    notFound: "Benutzer nicht gefunden",
    invalid: "Ungültiger oder abgelaufener Verifizierungslink",
    verified: "E-Mail erfolgreich verifiziert",
    error: "Ein Fehler ist aufgetreten",
    alreadySent:
      "Verifizierungs-E-Mail wurde bereits gesendet. Bitte prüfen Sie Ihr Postfach.",
    alreadyVerified: "E-Mail ist bereits verifiziert. Keine E-Mail gesendet.",
    sent: "Verifizierungs-E-Mail erfolgreich gesendet",
    firebaseNotFound: "Benutzer in Firebase Auth nicht gefunden",
    unauthorized: "Nicht autorisiert: UID stimmt nicht überein",
    missingData: "Fehlende Daten",
  },
  SV: {
    missing: "Token eller uid saknas",
    notFound: "Användaren hittades inte",
    invalid: "Ogiltig eller utgången verifieringslänk",
    verified: "E-postadressen verifierades",
    error: "Ett fel uppstod",
    alreadySent: "Verifieringsmejl har redan skickats. Kontrollera din inkorg.",
    alreadyVerified: "E-postadressen är redan verifierad. Inget e-postmeddelande skickades.",
    sent: "Verifieringsmejl skickades",
    firebaseNotFound: "Användaren hittades inte i Firebase Auth",
    unauthorized: "Ej behörig: UID stämmer inte",
    missingData: "Data saknas",
  },
};

function getVerificationMsg(lang, key) {
  const t =
    verificationApiMessages[lang?.toUpperCase()] || verificationApiMessages.EN;
  return t[key] || verificationApiMessages.EN[key] || "";
}

// API route to handle email verification
app.get("/api/verify", async (req, res) => {
  try {
    const { token, uid, lang = "EN" } = req.query;
    if (!token || !uid) {
      return res
        .status(400)
        .json({ success: false, message: getVerificationMsg(lang, "missing") });
    }

    // Fetch profile from Supabase profiles table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single();
    if (profileError || !profile) {
      return res.status(404).json({
        success: false,
        message: getVerificationMsg(lang, "notFound"),
      });
    }
    const now = new Date();
    if (
      profile.verification_token !== token ||
      !profile.verification_expires_at ||
      new Date(profile.verification_expires_at).getTime() < now.getTime()
    ) {
      return res
        .status(400)
        .json({ success: false, message: getVerificationMsg(lang, "invalid") });
    }
    // Mark profile as verified and remove verification_token/expiry, set verified_at
    const updatePayload = {
      verification_token: null,
      verification_expires_at: null,
      verified_at: now.toISOString(),
    }
    // Check if billing email is same 100% as work email and verify as well
    if (
      profile.billing_contact?.email &&
      profile.email.toLowerCase().trim() === profile.billing_contact.email.toLowerCase().trim()
    ) {
      updatePayload.billing_contact = {
        ...profile.billing_contact,
        verified_at: now.toISOString(),
      };
    }
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(updatePayload)
      .eq("id", uid);
    if (updateError) {
      throw new Error(updateError.message);
    }
    // Also update Supabase Auth user to set email_confirm: true
    try {
      await supabaseAdmin.auth.admin.updateUserById(uid, {
        email_confirm: true,
      });
    } catch (err) {
      // If user not found in Auth, ignore and proceed (optional: log error)
      console.error("Error updating Supabase Auth user:", err);
    }
    return res.json({
      success: true,
      message: getVerificationMsg(lang, "verified"),
    });
  } catch (err) {
    const lang = req.query?.lang || "EN";
    res
      .status(500)
      .json({ success: false, message: getVerificationMsg(lang, "error") });
  }
});


app.post("/api/send-verification", async (req, res) => {
  try {
    const { email, name, lang = "EN", verifyUrl, uid } = req.body;

    if (!email || !verifyUrl || !uid) {
      return res.status(400).json({
        success: false,
        message: getVerificationMsg(lang, "missingData"),
      });
    }

    // Fetch profile from Supabase
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({
        success: false,
        message: getVerificationMsg(lang, "notFound"),
      });
    }

    // Check if already verified
    if (profile.verified_at) {
      return res.status(200).json({
        success: true,
        message: getVerificationMsg(lang, "alreadyVerified"),
      });
    }

    const now = new Date();
    const expiryMs = 24 * 60 * 60 * 1000; // 24 hours

    if (
      profile.verification_token &&
      profile.verification_expires_at &&
      new Date(profile.verification_expires_at).getTime() > now.getTime()
    ) {
      return res.status(200).json({
        success: true,
        message: getVerificationMsg(lang, "alreadySent"),
      });
    }

    // Generate new verification token
    const crypto = await import("crypto");
    const verification_token = crypto.randomBytes(32).toString("hex");
    const verification_expires_at = new Date(
      now.getTime() + expiryMs,
    ).toISOString();

    // Update profile with new token and expiry
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        verification_token,
        verification_expires_at,
      })
      .eq("id", uid);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Generate verification link with token
    const baseUrl = verifyUrl.replace(/\/$/, "");
    const verificationLink = `${baseUrl}?token=${verification_token}&uid=${encodeURIComponent(uid)}`;

    // Send verification email using MailerSend
    await sendVerificationEmail({
      email,
      verifyUrl: verificationLink,
      customerName: name,
      lang: lang.toUpperCase()
    });

    console.log(`✅ Verification email sent to ${email} (${lang})`);

    res.json({
      success: true,
      message: getVerificationMsg(lang, "sent")
    });

  } catch (err) {
    console.error('❌ Verification email error:', err);
    const lang = req.body?.lang || "EN";
    res.status(500).json({
      success: false,
      message: getVerificationMsg(lang, "error"),
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});


app.post("/api/send-billing-verification", async (req, res) => {
  try {
    const { email, name, lang = "EN", verifyUrl, uid } = req.body;

    if (!email || !verifyUrl || !uid) {
      return res.status(400).json({ success: false, message: getVerificationMsg(lang, "missingData") });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("billing_contact")
      .eq("id", uid)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ success: false, message: getVerificationMsg(lang, "notFound") });
    }

    const billing = profile.billing_contact || {};

    // 1. Check if billing email is already verified
    if (billing.verified_at) {
      return res.status(200).json({ success: true, message: getVerificationMsg(lang, "alreadyVerified") });
    }

    // 2. CHECK FOR EXISTING VALID TOKEN (Cooldown Logic)
    const now = new Date();
    if (
      billing.verification_token &&
      billing.verification_expires_at &&
      new Date(billing.verification_expires_at) > now
    ) {
      // If a token exists and hasn't expired, don't send a new one
      return res.status(200).json({
        success: true,
        message: getVerificationMsg(lang, "alreadySent")
      });
    }

    // 3. Generate new verification token if none exists or old one expired
    const crypto = await import("crypto");
    const token = crypto.randomBytes(32).toString("hex");
    const oneDayInMs = 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + oneDayInMs).toISOString();
    // Update the nested billing_contact object
    const updatedBillingContact = {
      ...billing,
      email: email.toLowerCase().trim(),
      verification_token: token,
      verification_expires_at: expiresAt
    };

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ billing_contact: updatedBillingContact })
      .eq("id", uid);

    if (updateError) throw updateError;

    const verificationLink = `${verifyUrl.replace(/\/$/, "")}?token=${token}&uid=${uid}&type=billing`;

    await sendVerificationEmail({
      email: email.toLowerCase().trim(),
      verifyUrl: verificationLink,
      customerName: name,
      lang: lang.toUpperCase(),
      isBilling: true
    });

    res.json({ success: true, message: getVerificationMsg(lang, "sent") });
  } catch (err) {
    console.error("Billing Verification Error:", err);
    res.status(500).json({ success: false, message: getVerificationMsg(lang, "error") });
  }
});




app.get("/api/verify-billing", async (req, res) => {
  try {
    const { token, uid, lang = "EN" } = req.query;

    if (!token || !uid) {
      return res.status(400).json({ success: false, message: getVerificationMsg(lang, "missing") });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("billing_contact")
      .eq("id", uid)
      .single();

    if (profileError || !profile || !profile.billing_contact) {
      return res.status(404).json({ success: false, message: getVerificationMsg(lang, "notFound") });
    }

    const billing = profile.billing_contact;
    const now = new Date();

    // Validate the token inside the JSON object
    if (
      billing.verification_token !== token ||
      !billing.verification_expires_at ||
      new Date(billing.verification_expires_at).getTime() < now.getTime()
    ) {
      return res.status(400).json({ success: false, message: getVerificationMsg(lang, "invalid") });
    }

    // Prepare updated JSON: remove tokens, add verified_at
    const updatedBillingContact = {
      ...billing,
      verification_token: null,
      verification_expires_at: null,
      verified_at: now.toISOString(),
    };

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ billing_contact: updatedBillingContact })
      .eq("id", uid);

    if (updateError) throw updateError;

    return res.json({ success: true, message: getVerificationMsg(lang, "verified") });
  } catch (err) {
    res.status(500).json({ success: false, message: getVerificationMsg(lang, "error") });
  }
});








app.post(
  "/api/create-checkout-session",
  requireAuth,
  attachProfile,
  async (req, res) => {
    console.log("profile", req.profile);
    const {
      id,
      email,
      billing_contact,
      company_name,
      company_country,
      tax_id,
      b2b_supplier_id,
      status,
      verification_token,
      verification_expires_at,
      verified_at,
      accepted_at,
      invoice_settings, // This remains an object { enabled: true, ... }
      lang_code,
      company_city,
      company_house_number,
      company_street,
      company_zip_code,
      billing_documents
    } = req.profile;
    const cart = req.body.cart;
    const userLang = req.body?.userLang || "en";

    const po_number = req.body?.po_number || null;

    const is_user_pay_by_invoice_enabled = invoice_settings?.enabled || false;

    const currentDate = new Date();
    const over_due_date = new Date(currentDate);
    const over_due_day =
      is_user_pay_by_invoice_enabled && invoice_settings?.over_due_day;

    over_due_date.setDate(currentDate.getDate() + over_due_day);
    const isUSCompany = company_country === "US";
    const isSECompany = company_country === "SE";
    let currency;
    currency = isUSCompany ? "usd" : isSECompany ? "sek" : "eur";
    const LANG_TO_STRIPE_LOCALE = { en: "en", sv: "sv", de: "de", fr: "fr", nl: "nl", es: "es", it: "it", pt: "pt", pl: "pl", da: "da", fi: "fi", nb: "nb" };
    const stripeLocale = LANG_TO_STRIPE_LOCALE[userLang] || "auto";
    const lineItems = cart?.map((product) => {

      let b2bpriceWVat = parseFloat(product?.priceWVat);
      const priceCopy = b2bpriceWVat.toFixed(2);
      const isDigital = product?.type === "digital software";
      let customFields = null;
      let description = "";
      const pn = product?.pn;
      if (product?.selectedLangObj?.id) {
        customFields = {
          PN: product.selectedLangObj.pn,
          language: product.selectedLangObj.lang,
          isDigital: isDigital,
          pn: pn,
          id: product?.id,
          company_country: company_country,
          b2b_supplier_id: b2b_supplier_id,
          po_number: po_number,
          image_url: product.image_url,
          install_url_en: product.install_url_en || "",
          install_url_de: product.install_url_de || "",
          install_url_fr: product.install_url_fr || "",
          install_url_nl: product.install_url_nl || "",
          install_url_sv: product.install_url_sv || "",
          subscription_type: product.subscription_type || "",
          product_category: product.product_category || "",
          // tax_id: tax_id,
        };
        description = `Language: ${product.selectedLangObj.lang}  MPN/SKU: ${product.selectedLangObj.pn}`;
      } else {
        customFields = {
          language: `Language: English`,
          isDigital: isDigital,
          pn: pn,
          id: product?.id,
          company_country: company_country,
          b2b_supplier_id: b2b_supplier_id,
          po_number: po_number,
          image_url: product.image_url,
          install_url_en: product.install_url_en || "",
          install_url_de: product.install_url_de || "",
          install_url_fr: product.install_url_fr || "",
          install_url_nl: product.install_url_nl || "",
          install_url_sv: product.install_url_sv || "",
          subscription_type: product.subscription_type || "",
          product_category: product.product_category || "",
          // tax_id: tax_id,
        };
        description = `Language: English`;
      }

      return {
        price_data: {
          currency: currency,
          product_data: {
            name: product.name,
            images: [product.image_url],
            metadata: customFields,
            description: description,
          },
          // Fix: Use Math.round here as well
          unit_amount: Math.round(priceCopy * 100),
        },
        quantity: product.calculatequantity || 1,
      };
    });

    if (is_user_pay_by_invoice_enabled) {
      try {
        // 1. Prepare line items using your exact existing logic for metadata and pricing
        const paymentLinkLineItems = cart.map((product) => {
          const b2bpriceWVat = parseFloat(product?.priceWVat);
          const isDigital = product?.type === "digital software";
          const description = product?.selectedLangObj?.id
            ? `Language: ${product.selectedLangObj.lang} MPN/SKU: ${product.selectedLangObj.pn}`
            : `Language: English`;

          const unit_amount = Math.round(b2bpriceWVat * 100);
          return {
            price_data: {
              currency: currency,
              unit_amount: unit_amount,
              product_data: {
                name: product.name,
                description: description,
                metadata: {
                  amount_total: product?.quantity * unit_amount,
                  pn: product?.selectedLangObj?.pn || product.pn,
                  id: product?.id,
                  isDigital: String(isDigital),
                  language: product?.selectedLangObj?.lang || "English",
                  image_url: product.image_url,
                  install_url_en: product.install_url_en || "",
                  install_url_de: product.install_url_de || "",
                  install_url_fr: product.install_url_fr || "",
                  install_url_nl: product.install_url_nl || "",
                  subscription_type: product.subscription_type || "",
                  product_category: product.product_category || "",
                },
              },
            },
            quantity: product.calculatequantity || 1,
          };
        });

        // 2. Create the Payment Link
        const orderNumber = await getNextOrderNumber();

        const { data: order, error } = await supabaseAdmin
          .from('orders')
          .upsert(
            {
              order_number: orderNumber,
              created_at: new Date(),
            },
            { onConflict: 'order_number' } // If order_number exists, update instead of error
          )
          .select(); // This allows you to get the created record (including the ID) back

        if (error) throw error;

        const newOrder = order[0];
        const orderId = newOrder.id;

        const payByLinkSessionData = {
          line_items: paymentLinkLineItems,
          currency: currency,
          metadata: {
            po_number: po_number || "N/A",
            orderType: "pay_by_invoice",
            orderNumber: orderNumber,
            orderId: orderId,
            id: id,
            b2b_supplier_id: b2b_supplier_id,
            tax_id: tax_id,
            company_country: company_country,
            email: email,
          },
          // You can disable manual tax or promotion codes to keep the UI minimal
          after_completion: {
            type: "redirect",
            redirect: {
              url: `${YOUR_DOMAIN}/success?status`,
            },
          },
          restrictions: {
            completed_sessions: {
              limit: 1,
            },
          },
        };
        const paymentLink =
          await stripe.paymentLinks.create(payByLinkSessionData);
        const totalAmountCents = paymentLinkLineItems.reduce((acc, item) => {
          return acc + parseFloat(item.price_data.unit_amount) * item.quantity;
        }, 0);
        const totalAmountMainCurrency = totalAmountCents / 100;
        // 3. Log for your Firebase tracking
        const paymentLinkUrl = paymentLink.url;

        const data = {
          user_id: id,
          internal_status: "pending",
          payment_status: "payment due",
          payment_url: paymentLinkUrl,
          email: email,
          po_number: po_number,
          company_info: {
            country: company_country,
            company_name: company_name,
            city: company_city,
            address1: company_country,
            address2: `${company_street} ${company_house_number}`,
            postal_code: company_zip_code,
            business_name: company_name,
          },
          // city: fullSession?.customer_details?.address?.city,
          // address1: fullSession?.customer_details?.address?.line1,
          // address2: fullSession?.customer_details?.address?.line2,
          // postal_code: fullSession?.customer_details?.address?.postal_code,
          // company_name: fullSession?.customer_details?.business_name,
          total_amount: totalAmountMainCurrency,
          currency: currency,
          created_at: new Date(),
          products: paymentLinkLineItems.map((item) => ({
            productId: item?.price_data?.product_data?.metadata?.id,
            name: item?.price_data?.product_data?.name,
            quantity: item?.quantity,
            unitPrice: item?.price_data?.unit_amount / 100,
            totalPrice:
              item?.price_data?.product_data?.metadata?.amount_total,
            isDigital:
              item?.price_data?.product_data?.metadata?.isDigital === "true", // Retrieve from metadata
            PN: item?.price_data?.product_data?.metadata?.pn,
            company_country,
            image_url: item?.price_data?.product_data?.metadata?.image_url,
            install_url_en: item?.price_data?.product_data?.metadata?.install_url_en || "",
            install_url_de: item?.price_data?.product_data?.metadata?.install_url_de || "",
            install_url_fr: item?.price_data?.product_data?.metadata?.install_url_fr || "",
            install_url_nl: item?.price_data?.product_data?.metadata?.install_url_nl || "",
            install_url_sv: item?.price_data?.product_data?.metadata?.install_url_sv || "",
            subscription_type: item?.price_data?.product_data?.metadata?.subscription_type || "",
            product_category: item?.price_data?.product_data?.metadata?.product_category || "",
          })),
        };

        // Store order as pending
        // await updateOrder(orderId, data);
        let digitalProducts =
          data.products?.filter((product) => product.isDigital) ?? [];
        let phisycalProducts =
          data.products?.filter((product) => !product.isDigital) ?? [];
        let productsWithKeys;
        try {
          productsWithKeys = await assignKeysToProducts(
            orderId,
            orderNumber,
            digitalProducts,
            b2b_supplier_id,
            id,
          );
        } catch (err) {
          console.error(
            "❌ Not enough license keys or error reserving keys:",
            err.message,
          );

          // Update order as failed or out-of-stock
          await updateOrder(orderId, {
            internal_status: "failed",
            failure_reason: err.message,
            invoice_generated_at: null,
          });

          // optional: notify admin or send email to customer here
          return res.status(500).json({ error: "Not enough license keys available." });

        }
        const allProducts = [...productsWithKeys, ...phisycalProducts];
        data.products = allProducts;
        processPayByInvoiceOrder(
          data,
          orderNumber,
          company_country,
          productsWithKeys,
          phisycalProducts,
          orderId,
          tax_id,
          company_city,
          company_house_number,
          company_street,
          company_zip_code,
          company_name,
          over_due_date,
          billing_contact,
          billing_documents,
          getMasqueradeFromRequest(req)
        );
        // 4. Return the link to be attached to your Firebase orders doc
        res.status(200).send();
      } catch (error) {
        console.error("Payment Link Error:", error);
        res.status(500).json({ error: error.message });
      }
    } else {
      const expirationTime = Math.floor(Date.now() / 1000) + 30 * 60; // 30 minutes in seconds
      const sessionData = {
        line_items: lineItems,
        mode: "payment",
        locale: stripeLocale,
        name_collection: {
          business: {
            enabled: false, // show Business Name field
          },
        },
        metadata: {
          tax_id: tax_id,
          b2b_supplier_id: b2b_supplier_id,
          id: id,
          po_number: po_number || "N/A",
        },
        expires_at: expirationTime,
        success_url: `${YOUR_DOMAIN}/success`,
        cancel_url: `${YOUR_DOMAIN}?canceled=true`,
      };

      if (email) {
        sessionData.customer_email = email;
      }

      const session = await stripe.checkout.sessions.create(sessionData);
      res.status(200).send(session.url);
    }
  },
);

// app.post("/api/sendemail", async (req, res) => {
//   const { email, companyName, messages } = req.body;

//   try {
//     const send_to = process.env.EMAIL_USER;
//     const sent_from = process.env.EMAIL_USER;
//     const reply_to = email;
//     const subject = `Asking regarding buying`;
//     const message = `
//       <p>Dear MicrosoftSupplier team</p>
//       <p>Please click on reply to contact me regarding the GigaSupplier Plan:</p>
//       <h5>My Email Address: </h5>
//       <p>${email}</p>
//       <h5>Company Name : </h5>
//       <p>${companyName}</p>
//       <p>${messages}</p>
//     `;

//     await sendEmail(subject, message, send_to, sent_from, reply_to);
//     res.status(200).json({ success: true, message: "Email Sent" });
//   } catch (error) {
//     res.status(500).json(error.message);
//   }
// });
app.post("/api/registerNewPendingUser", async (req, res) => {
  const {
    email,
    company_name,
    tax_id,
    company_country,
    company_street,
    company_house_number,
    company_zip_code,
    company_city,
    billing_email,
    password
  } = req.body;
  try {
    // 1. Check if user already exists in Auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId;

    if (existingUser) {
      // User exists - check if they have a pending registration
      const { data: pendingReg } = await supabaseAdmin
        .from('pending_registrations')
        .select('*')
        .eq('email', email)
        .single();

      if (pendingReg) {
        return res.status(400).json({
          success: false,
          message: "Registration already pending approval"
        });
      }

      // User was declined before - reuse the same auth user
      userId = existingUser.id;
    } else {
      // Create new user in Supabase Auth (disabled by default)
      const { data: user, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          pending_approval: true
        }
      });

      if (userError) {
        console.error("Error creating user:", userError);
        return res.status(500).json({
          success: false,
          message: userError.message
        });
      }

      userId = user.user?.id;
    }

    // 2. Insert pending registration
    const { error: regError } = await supabaseAdmin
      .from('pending_registrations')
      .insert([{
        uid: userId,
        email,
        tax_id,
        company_name,
        company_country,
        company_street,
        company_house_number,
        company_zip_code,
        company_city,
        billing_email: billing_email,
        created_at: Date.now(),
      }]);

    if (regError) {
      console.error("Error creating pending registration:", regError);
      return res.status(500).json({
        success: false,
        message: regError.message
      });
    }

    // 3. Send notification to admin
    const preferredLang = getLangCode(company_country) ?? 'en';

    try {
      await sendAdminPendingRegistrationEmail({
        email,
        companyName: company_name,
        taxId: tax_id,
        companyCountry: company_country,
        lang: preferredLang
      });
    } catch (emailError) {
      console.error("Admin notification failed:", emailError);
      // Don't fail the registration if email fails
    }

    res.status(200).json({
      success: true,
      message: "Registration submitted successfully"
    });

  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
app.post("/api/send-admin-email-pendingRegistrations", async (req, res) => {
  const { email, companyName, taxId, companyCountry } = req.body;

  try {
    await sendAdminPendingRegistrationEmail({
      email,
      companyName,
      taxId,
      companyCountry,
      lang: 'en' // Use user's language or default to English
    });

    res.status(200).json({
      success: true,
      message: "Admin notification sent successfully"
    });
  } catch (error) {
    console.error('❌ Admin email error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
app.use("/api/licenses", licenseRoutes);
app.use("/api/proforma", proformaRoutes);
app.use("/api/invoice", invoiceRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/contact", contactRoutes);


// Function to safely generate the next sequential B2B Account ID
const getNextB2BAccountId = async () => {
  // Use a transaction to ensure atomic increment and prevent race conditions
  // Assumes a 'settings' table with a row where id = 'b2b_account_id_counter'
  let newId;
  const { data: counterRows, error: fetchError } = await supabaseAdmin
    .from("settings")
    .select("*")
    .eq("id", "b2b_account_id_counter")
    .single();

  if (fetchError || !counterRows) {
    throw new Error("B2B ID counter not set up!");
  }

  const currentId = counterRows.last_id;
  const prefix = counterRows.prefix || "";
  const nextIdNumber = currentId + 1;

  // Use a Postgres function or upsert to ensure atomicity
  // Here, we use a single update and check for race conditions (Supabase does not support JS-side transactions)
  const { error: updateError } = await supabaseAdmin
    .from("settings")
    .update({ last_id: nextIdNumber })
    .eq("id", "b2b_account_id_counter");

  if (updateError) {
    throw new Error("Failed to update B2B ID counter: " + updateError.message);
  }

  newId = `${prefix}${nextIdNumber}`;
  return newId;
};



// Accept registration endpoint
app.post("/api/accept-pendingRegistration", async (req, res) => {
  const { uid, email, docId } = req.body;
  try {
    const b2bSupplierId = await getNextB2BAccountId();

    // 1. Enable the user account in Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(uid, {
      disabled: false,
    });
    if (updateError) {
      throw new Error(`Auth Update Error: ${updateError.message}`);
    }

    // 2. Get Pending Registration Details
    const { data: pendingRegistration, error: pendingError } = await supabaseAdmin
      .from("pending_registrations")
      .select("*")
      .eq("id", docId)
      .single();
    if (pendingError || !pendingRegistration) {
      throw new Error("Pending registration not found");
    }

    const preferredLang = getLangCode(pendingRegistration?.company_country);
    console.log("pendingRegistration", pendingRegistration);

    // 3. Create user profile
    const newUserData = {
      id: uid,
      email: email,
      is_b2b: true,
      b2b_supplier_id: b2bSupplierId,
      company_name: pendingRegistration.company_name,
      company_country: pendingRegistration.company_country,
      tax_id: pendingRegistration.tax_id,
      company_street: pendingRegistration?.company_street,
      company_house_number: pendingRegistration?.company_house_number,
      company_zip_code: pendingRegistration?.company_zip_code,
      company_city: pendingRegistration?.company_city,
      billing_contact: {
        email: pendingRegistration?.billing_email || null, // from req.body
        is_verified: false,
        verified_at: null
      },
      status: "active",
      created_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
      lang_code: preferredLang ?? "en",
      invoice_settings: { enabled: false, overDueDay: null },
    };

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert([newUserData]);
    if (profileError) {
      throw new Error(profileError.message);
    }

    // 4. Delete pending registration
    const { error: deleteError } = await supabaseAdmin
      .from("pending_registrations")
      .delete()
      .eq("id", docId);
    if (deleteError) {
      throw new Error(deleteError.message);
    }

    // 5. Add to registrations_history
    const { error: regHistError } = await supabaseAdmin
      .from("registrations_history")
      .insert([{
        uid: uid,
        email: email,
        status: "Accepted",
        created_at: Date.now(),
      }]);
    if (regHistError) {
      throw new Error(regHistError.message);
    }

    // 6. Send acceptance email (with user's preferred language)
    try {
      await sendAcceptanceEmail({
        email,
        supplierId: b2bSupplierId,
        lang: preferredLang ?? 'en'
      });
    } catch (emailError) {
      console.error("Email failed to send, but registration was successful:", emailError);
    }

    res.status(200).json({
      success: true,
      message: "User accepted and created successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "An unknown error occurred",
    });
  }
});

// Decline registration endpoint
app.post("/api/decline-pendingRegistration", async (req, res) => {
  const { uid, email, docId } = req.body;

  try {
    // 1. Get user's language preference
    const { data: pendingRegistration } = await supabaseAdmin
      .from("pending_registrations")
      .select("company_country")
      .eq("id", docId)
      .single();

    const preferredLang = getLangCode(pendingRegistration?.company_country) ?? 'en';

    // 2. Send decline email
    try {
      await sendDeclineEmail({
        email,
        lang: preferredLang
      });
    } catch (emailError) {
      console.error("Decline email failed:", emailError);
    }

    // 3. Delete the user from Supabase Auth (cleanup)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (deleteAuthError) {
      console.error("Failed to delete auth user:", deleteAuthError);
      // Continue anyway - we still want to clean up the pending registration
    }

    // 4. Delete pending registration
    const { error: deleteError } = await supabaseAdmin
      .from("pending_registrations")
      .delete()
      .eq("id", docId);
    if (deleteError) {
      throw new Error(deleteError.message);
    }

    // 5. Add to registrations_history
    const { error: regHistError } = await supabaseAdmin
      .from("registrations_history")
      .insert([{
        uid: uid,
        email: email,
        status: "Declined",
        created_at: Date.now(),
      }]);
    if (regHistError) {
      throw new Error(regHistError.message);
    }

    res.status(200).json({
      success: true,
      message: "Registration declined successfully"
    });

  } catch (error) {
    console.error("Decline error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.post("/api/download", async (req, res) => {
  const { type, url, id } = req.body;

  if (!id || !url || !type) {
    return res.status(400).send("Missing parameters");
  }

  const allowedHosts = ["storage.googleapis.com"];
  const parsed = new URL(url);

  if (!allowedHosts.includes(parsed.host)) {
    return res.status(400).send("Invalid file source");
  }

  // Download the file from the URL
  const response = await fetch(url);

  if (!response.ok) {
    return res.status(500).send("Failed to fetch file");
  }

  const buffer = await response.arrayBuffer();

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="invoice-${id}.pdf"`,
  );
  res.setHeader("Content-Type", "application/pdf");

  res.send(Buffer.from(buffer));
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`Node server listening on port ${PORT}`));
