import "dotenv/config";
import licenseRoutes from "./routes/license/license.routes.js";
import proformaRoutes from "./routes/proforma/proforma.routes.js";
import invoiceRoutes from "./routes/invoice/invoice.routes.js";
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
import { supabase, supabaseAdmin } from "./config/supabase.js";

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
  billing_email,
  billing_documents
) {
  try {
    console.log("pay_by_invoice_order", orderId);


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
      {
        key: "license",
        filename: `License-${orderNumber}.pdf`,
        content: pdfBuffer,
        contentType: pdfBuffer.contentType || "application/pdf",
        condition: productsWithKeys?.length > 0,
      },
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
      if (billing_documents?.[`${doc.key}_billing_email`] && billing_email) {
        if (!recipientMap[billing_email]) recipientMap[billing_email] = [];
        recipientMap[billing_email].push(attachment);
      }
    }

    // Send one email per recipient with all their attachments
    for (const [email, attachments] of Object.entries(recipientMap)) {
      console.log("sending to:", email, "attachments:", attachments.map(a => a.filename));
      await sendOrderConfirmationEmail(
        data?.name,
        email,
        attachments,
        companyCountry,
      );
    }

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
    },
  },
};
// Main function to generate invoice HTML
function generateInvoiceHTML(
  session,
  invoiceNumber,
  orderNumber,
  productsWithKeys,
  companyCountryCode = "EN",
  taxId,
  company_city,
  company_house_number,
  company_street,
  company_zip_code,
  company_name
) {
  console.log("company_city", company_city);
  console.log("company_name", company_name);
  console.log("company_street", company_street);
  console.log("company_zip_code", company_zip_code);



  // Get template based on country code, fallback to EN if not found
  const template =
    invoiceTemplates[companyCountryCode.toUpperCase()] || invoiceTemplates.EN;
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
  } else {
    // Default
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
        background-image: url("https://firebasestorage.googleapis.com/v0/b/supplier-34b95.appspot.com/o/assets%2Fimage.png?alt=media&token=104e6658-bbf5-482e-8f0a-314a9d3875e0");
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
            <div>${escapeHtml(
    company_street, company_house_number || "STREET NAME & STREET NUMBER",
  )}</div>
            <div>${escapeHtml(
    company_zip_code || "POSTAL CODE",
  )} ${escapeHtml(company_city || "CITY")}</div>
            <div>${escapeHtml(companyCountryCode || "COUNTRY")}</div>
            ${taxId
      ? `<div>${escapeHtml(taxId)}</div>`
      : "<div>Company Tax ID</div>"
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
              <img src="https://firebasestorage.googleapis.com/v0/b/supplier-34b95.appspot.com/o/assets%2Fsergio-signature.png?alt=media&token=18a1b49b-ae58-4494-b99d-34f3c32fae73" alt="Signature">
            </div>
            <div class="signature-label">${t.signature}</div>
          </div>
        </div>
      </div>

      <div class="footer">
        <img src="https://firebasestorage.googleapis.com/v0/b/supplier-34b95.appspot.com/o/assets%2FMSlogo.png?alt=media&token=f5524581-bc40-41c6-8c56-61906b61b4b0" alt="Microsoft Supplier Logo">
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
    const { data: reservedDbKeys, error } = await supabase.rpc("reserve_keys", {
      p_order_id: orderId,
      p_order_number: orderNumber,
      p_product_id: productId,
      p_needed_qty: neededQty,
      p_user_id: id,
      // Safety: If b2b_supplier_id is undefined, send null explicitly
      p_b2b_supplier_id: b2b_supplier_id || null,
    });

    if (error) throw new Error(error.message);

    // Format to match your original return object exactly
    const formattedKeys = reservedDbKeys.map((item) => ({
      key: item.license_key,
      status: "active",
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

      console.log("🔔 Webhook received:", event.type);

      // 🔥 Respond immediately before doing any slow work
      response.json({ received: true });

      // Continue processing in background
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        processPaidOrder(session); // Fire and forget
      }
    } catch (err) {
      console.log("❌ Webhook verification failed:", err.message);
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
      invoice: "De factuur",
      license: "Het licentiedocument (met alle licentiesleutels)",
    },
    importantTitle: "BELANGRIJKE INFORMATIE",
    importantInfo: [
      "De licenties worden direct online geactiveerd (telefonische activatie is niet nodig)",
      "Garantie: 12 maanden",
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
    },
    importantTitle: "IMPORTANT INFORMATION",
    importantInfo: [
      "The licenses activate online immediately (no phone activation required)",
      "Warranty: 12 months",
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
      license: "Le document de licence (contenant toutes les clés de licence)",
    },
    importantTitle: "INFORMATIONS IMPORTANTES",
    importantInfo: [
      "Les licences s'activent directement en ligne (aucune activation téléphonique n'est nécessaire)",
      "Garantie : 12 mois",
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
      license: "Das Lizenzdokument (mit allen Lizenzschlüsseln)",
    },
    importantTitle: "WICHTIGE INFORMATIONEN",
    importantInfo: [
      "Die Lizenzen werden sofort online aktiviert (keine telefonische Aktivierung erforderlich)",
      "Garantie: 12 Monate",
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
      "Garantía: 12 meses",
      "Las licencias provienen de nuestro sistema de distribución interno",
    ],
    contactText: "¿Preguntas? Responda a este correo",
    closing: "Saludos cordiales",
    founder: "Founder @ Sertic",
    footer: "MICROSOFT SUPPLIER",
    copyright: "© 2026",
  },
};

function generateEmailContent(customerName, companyCountryCode = "EN") {
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
        <img class="mobile-logo" src="https://firebasestorage.googleapis.com/v0/b/supplier-34b95.appspot.com/o/assets%2FMSlogo.png?alt=media&token=f5524581-bc40-41c6-8c56-61906b61b4b0"
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
            • ${template.attachments.invoice}<br>
            • ${template.attachments.license}
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
) {
  const emailContent = generateEmailContent(customerName, companyCountryCode);

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
    // console.log("fullSession123", fullSession);
    const user_id = fullSession?.metadata?.id;
    let userProfile = null;
    if (user_id) {
      userProfile = await getUserProfile(user_id);
    }

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
      billing_email,
      billing_documents
    } = userProfile;

    if (fullSession?.metadata && fullSession?.metadata?.orderId) {
      const orderId = fullSession?.metadata?.orderId;
      const orderNumber = fullSession?.metadata?.orderNumber;

      const orderRef = await getOrderById(orderId);
      console.log("orderRef0999", orderRef);

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

      // let emailAttachemnts = [
      //   {
      //     filename: `Invoice-${orderNumber}.pdf`,
      //     content: invoicePdfBuffer, // Buffer or string
      //     contentType: invoicePdfBuffer.contentType || "application/pdf",
      //   },
      // ];

      // Update order as completed with both URLs
      await updateOrder(orderRef?.id, {
        invoice_generated_at: new Date(),
        payment_status: "paid",
        invoice_url: invoicePdfUrl,
      });
      // await sendOrderConfirmationEmail(
      //   "",
      //   fullSession?.metadata?.email,
      //   emailAttachemnts,
      //   company_country, // 'NL', 'EN', 'FR', or 'DE'
      // );







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
        if (billing_documents?.[`${doc.key}_billing_email`] && billing_email) {
          if (!recipientMap[billing_email]) recipientMap[billing_email] = [];
          recipientMap[billing_email].push(attachment);
        }
      }

      // Send one email per recipient with all their attachments
      for (const [email, attachments] of Object.entries(recipientMap)) {
        console.log("sending to:", email, "attachments:", attachments.map(a => a.filename));
        await sendOrderConfirmationEmail(
          "",
          email,
          attachments,
          company_country, // 'NL', 'EN', 'FR', or 'DE'
        );
      }


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
        })),
      };

      let digitalProducts =
        data.products?.filter((product) => product.isDigital) ?? [];
      let phisycalProducts =
        data.products?.filter((product) => !product.isDigital) ?? [];
      const order = await insertOrder(data);
      const orderId = order.id;
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
        return;
      }
      const allProducts = [...productsWithKeys, ...phisycalProducts];
      await updateOrder(orderId, {
        // Add products to a related table if needed
        products: allProducts,
        internal_status: "keys assigned",
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
      // Update order as completed with both URLs
      await updateOrder(orderId, {
        invoice_generated_at: new Date().toISOString(),
        internal_status: "completed",
        payment_status: "paid",
        invoice_url: invoicePdfUrl,
        license_url: licensePdfUrl,
      });





      // let emailAttachemnts = [
      //   {
      //     filename: `Invoice-${orderNumber}.pdf`,
      //     content: invoicePdfBuffer, // Buffer or string
      //     contentType: invoicePdfBuffer.contentType || "application/pdf",
      //   },
      // ];
      // if (productsWithKeys?.length > 0) {
      //   emailAttachemnts.push({
      //     filename: `License-${orderNumber}.pdf`,
      //     content: pdfBuffer, // Buffer or string
      //     contentType: pdfBuffer.contentType || "application/pdf",
      //   });
      // }
      // await sendOrderConfirmationEmail(
      //   data?.name,
      //   data?.email,
      //   emailAttachemnts,
      //   company_country, // 'NL', 'EN', 'FR', or 'DE'
      // );


      const emailTargets = [
        {
          key: "invoice",
          filename: `Invoice-${orderNumber}.pdf`,
          content: invoicePdfBuffer,
          contentType: invoicePdfBuffer.contentType || "application/pdf",
          condition: true,
        },
        {
        key: "license",
        filename: `License-${orderNumber}.pdf`,
        content: pdfBuffer,
        contentType: pdfBuffer.contentType || "application/pdf",
        condition: productsWithKeys?.length > 0,
      },
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
        if (billing_documents?.[`${doc.key}_billing_email`] && billing_email) {
          if (!recipientMap[billing_email]) recipientMap[billing_email] = [];
          recipientMap[billing_email].push(attachment);
        }
      }

      // Send one email per recipient with all their attachments
      for (const [email, attachments] of Object.entries(recipientMap)) {
        console.log("sending to:", email, "attachments:", attachments.map(a => a.filename));
        await sendOrderConfirmationEmail(
          data?.name,
          email,
          attachments,
          company_country, // 'NL', 'EN', 'FR', or 'DE'
        );
      }


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
    console.log("webhh", process.env.WEBHOOK_SECRET);

    // Fetch profile from Supabase profiles table
    const { data: profile, error: profileError } = await supabase
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
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        verification_token: null,
        verification_expires_at: null,
        verified_at: now.toISOString(),
      })
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
    const { data: profile, error: profileError } = await supabase
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

    // Check for existing valid verification token (15 minutes)
    const now = new Date();
    const expiryMs = 15 * 60 * 1000; // 15 minutes

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
    const { error: updateError } = await supabase
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
app.post(
  "/api/create-checkout-session",
  requireAuth,
  attachProfile,
  async (req, res) => {
    console.log("profile", req.profile);
    const {
      id,
      email,
      billing_email,
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

    const po_number = req.body?.po_number || null;

    const is_user_pay_by_invoice_enabled = invoice_settings?.enabled || false;

    const currentDate = new Date();
    const over_due_date = new Date(currentDate);
    const over_due_day =
      is_user_pay_by_invoice_enabled && invoice_settings?.over_due_day;

    over_due_date.setDate(currentDate.getDate() + over_due_day);
    const isUSCompany = company_country === "US";
    let currency;
    currency = isUSCompany ? "usd" : "eur";
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
          // tax_id: tax_id,
        };
        description = `Language: ${product.selectedLangObj.lang}  PN: ${product.selectedLangObj.pn}`;
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
            ? `Language: ${product.selectedLangObj.lang} PN: ${product.selectedLangObj.pn}`
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
                },
              },
            },
            quantity: product.calculatequantity || 1,
          };
        });

        // 2. Create the Payment Link
        const orderNumber = await getNextOrderNumber();

        const { data: order, error } = await supabase
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
            pn: item?.price_data?.product_data?.metadata?.pn,
            company_country,
            image_url: item?.price_data?.product_data?.metadata?.image_url,
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
          billing_email,
          billing_documents
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
    password
  } = req.body;

  try {
    // 1. Check if user already exists in Auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId;

    if (existingUser) {
      // User exists - check if they have a pending registration
      const { data: pendingReg } = await supabase
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
    const { error: regError } = await supabase
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


// Function to safely generate the next sequential B2B Account ID
const getNextB2BAccountId = async () => {
  // Use a transaction to ensure atomic increment and prevent race conditions
  // Assumes a 'settings' table with a row where id = 'b2b_account_id_counter'
  let newId;
  const { data: counterRows, error: fetchError } = await supabase
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
  const { error: updateError } = await supabase
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
    const { data: pendingRegistration, error: pendingError } = await supabase
      .from("pending_registrations")
      .select("*")
      .eq("id", docId)
      .single();
    if (pendingError || !pendingRegistration) {
      throw new Error("Pending registration not found");
    }

    const preferredLang = getLangCode(pendingRegistration?.company_country);

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
      status: "active",
      created_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
      lang_code: preferredLang ?? "en",
      invoice_settings: { enabled: false, overDueDay: null },
    };

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert([newUserData]);
    if (profileError) {
      throw new Error(profileError.message);
    }

    // 4. Delete pending registration
    const { error: deleteError } = await supabase
      .from("pending_registrations")
      .delete()
      .eq("id", docId);
    if (deleteError) {
      throw new Error(deleteError.message);
    }

    // 5. Add to registrations_history
    const { error: regHistError } = await supabase
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
    const { data: pendingRegistration } = await supabase
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
    const { error: deleteError } = await supabase
      .from("pending_registrations")
      .delete()
      .eq("id", docId);
    if (deleteError) {
      throw new Error(deleteError.message);
    }

    // 5. Add to registrations_history
    const { error: regHistError } = await supabase
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
