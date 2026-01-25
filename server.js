import "dotenv/config";
import licenseRoutes from "./routes/license/license.routes.js";
import express from "express";
const stripeSecretKey = process.env.STRIPE_SECRET_KEY; //sergio test
// "sk_test_51LbU1MHfTVIOkODVDGnp8QhsHfVIMExL6SS0UajaTfhs8ytFXrFw7X2raMn26h2QJWFTjHU4fClQUelQ4PAxmXg700PZ4tyKYv" omar test
import Stripe from "stripe";
import cors from "cors";
import bodyParser from "body-parser";
import sendEmail from "./Utils/sendEmail.js";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fetch from "node-fetch";

const stripe = new Stripe(stripeSecretKey);

import { getFirestore, FieldValue } from "firebase-admin/firestore";

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import chromium from "@sparticuz/chromium";
import sendEmailWithAttachment from "./Utils/sendEmailWithAttachment.js";
import generateRegistrationEmailHTML from "./templates/Emails/newRegisteredCompaniesrequest.js";
import sendEmailToClient from "./Utils/sendEmailToClient.js";
import sendEmailToAdmin from "./Utils/sendAdminEmail.js";
import generateClientStatusEmailHTML from "./templates/Emails/ClientNewRegisterationResponse.js";
import { uploadPDFToFirebaseStorage } from "./services/firebaseStorage.service.js";
import generateLicencePDFBuffer from "./services/pdf/generateLicencePDF.service.js";
import { generateProformaPDFBuffer } from "./services/pdf/generateProformaPDF.service.js";
// import savePDFRecord from "./services/pdf/savePdfRecord.service.js";
puppeteer.use(StealthPlugin());

// const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set.",
  );
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: "supplier-34b95.appspot.com", // ← ADD THIS LINE
  // databaseURL: "https://supplier-34b95-default-rtdb.firebaseio.com" // only if using Realtime DB
});
const db = getFirestore();
// YOUR_DOMAIN = "https://microsoftsupplier.com";
// YOUR_DOMAIN = "http://localhost:3000";
const YOUR_DOMAIN = "https://ms-test-ser.vercel.app";
const app = express();

app.use(cors());
app.use(express.static("public"));

async function getNextOrderNumber() {
  const counterRef = db.collection("counters").doc("orderCounter");

  return await db.runTransaction(async (transaction) => {
    const counterDoc = await transaction.get(counterRef);

    if (!counterDoc.exists) {
      // Initialize if doesn't exist
      transaction.set(counterRef, { current: 6250 });
      return 6250;
    }

    const current = counterDoc.data().current;
    const next = current + 1;

    transaction.update(counterRef, {
      current: next,
      lastUpdated: new Date(),
    });

    return next;
  });
}
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
  taxId
) {
  try {
    // const taxId = session?.metadata?.taxId;

    // Assign keys to products (this will update licenseKeys docs in firestore)

    const allProducts = [...productsWithKeys, ...phisycalProducts];
    // Update stored order to include the assigned keys per product (so DB has complete record)
    await db.collection("orders").doc(orderId).update({
      products: allProducts,
      internalEntryStatus: "keys_assigned",
    });
    const adaptedSession = {
      created: Math.floor(data.createdAt.getTime() / 1000), // match Stripe session timestamp
      currency: data.currency,
      metadata: {
        email: data.email,
        poNumber: data.poNumber,
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
    );
    const proformaPdfBuffer = await generateProformaPDFBuffer(
      data,
      orderNumber,
      allProducts,
      companyCountry,
      taxId
    );

    const licensePdfUrl = await uploadPDFToFirebaseStorage(
      orderNumber,
      pdfBuffer,
      "License"
    );
    const proformaPdfUrl = await uploadPDFToFirebaseStorage(
      orderNumber,
      proformaPdfBuffer,
      "Proforma"
    );

    // Save Firestore PDF record
    // await savePDFRecord(`${orderNumber}-license`, licensePdfUrl);
    // await savePDFRecord(`${orderNumber}-invoice`, invoicePdfUrl);
    let emailAttachemnts = [
      {
        filename: `Proforma-${orderNumber}.pdf`,
        content: proformaPdfBuffer, // Buffer or string
        contentType: proformaPdfBuffer.contentType || "application/pdf",
      },
    ];
    if (productsWithKeys?.length > 0) {
      emailAttachemnts.push({
        filename: `License-${orderNumber}.pdf`,
        content: pdfBuffer, // Buffer or string
        contentType: pdfBuffer.contentType || "application/pdf",
      });
    }
    await sendOrderConfirmationEmail(
      data?.name,
      data?.email,
      emailAttachemnts,
      companyCountry, // 'NL', 'EN', 'FR', or 'DE'
    );

    // Update order as completed with both URLs
    await db.collection("orders").doc(orderId).update({
      proFormaGenerateddAt: new Date(),
      internalEntryStatus: "completed",
      proformaUrl: proformaPdfUrl,
      licenseUrl: licensePdfUrl,
    });
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
      poNumber: "Bestelnummer",
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
      poNumber: "PO number",
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
      poNumber: "Numéro de commande",
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
      poNumber: "Bestellnummer",
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
) {
  // Get template based on country code, fallback to EN if not found
  const template =
    invoiceTemplates[companyCountryCode.toUpperCase()] || invoiceTemplates.EN;
  const t = template.translations;

  const customer = session.customer_details || {};
  const address = customer.address || {};
  const total = (session.amount_total || 0) / 100;
  const currency = (session.currency || "eur").toUpperCase();
  const poNumber = session?.metadata?.poNumber
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
      const quantity = product.quantity || 0;
      const totalPrice = product?.totalPrice;

      return `
      <tr>
        <td>${invoiceDate}</td>
        <td>${escapeHtml(product.name || "")}</td>
        <td class="text-right">${currencySymbol} ${unitPrice.toFixed(2)}</td>
        <td class="text-center">${quantity}</td>
        <td class="text-right">${currencySymbol} ${totalPrice.toFixed(2)}</td>
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
    customer.name || customer.business_name || "COMPANY NAME",
  )}</strong></div>
            <div>${escapeHtml(
    address.line1 || "STREET NAME & STREET NUMBER",
  )}</div>
            <div>${escapeHtml(
    address.postal_code || "POSTAL CODE",
  )} ${escapeHtml(address.city || "CITY")}</div>
            <div>${escapeHtml(address.country || "COUNTRY")}</div>
            ${taxId
      ? `<div>${escapeHtml(taxId)}</div>`
      : "<div>Company Tax ID</div>"
    }
          </div>
          
          <div class="invoice-info">
                           ${poNumber ? `
              <div class="po-number">PO: ${escapeHtml(poNumber)}</div>
            ` : ""}
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
              <th class="text-right">${t.price}</th>
              <th class="text-center">${t.amount}</th>
              <th class="text-right">${t.total}</th>
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
              <td class="text-right">${currencySymbol} ${subtotal.toFixed(
      2,
    )}</td>
            </tr>
            <tr class="tax-row">
              <td>${vatLabel}:</td>
              <td class="text-right">${currencySymbol} ${tax.toFixed(2)}</td>
            </tr>
            <tr class="total-row">
              <td>${t.finalTotal}:</td>
              <td class="text-right">${currencySymbol} ${total.toFixed(2)}</td>
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
  products,
  b2bSupplierId,
  uid,
) {
  const results = [];
  for (const product of products) {
    const needed = product.quantity || 0;
    const productId = product?.productId; // or product.productId (whichever your data uses)

    // Reserve keys for this specific product
    const assignedKeys = await reserveLicenseKeys(
      orderId,
      orderNumber,
      productId,
      needed,
      b2bSupplierId,
      uid,
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
  b2bSupplierId,
  uid,
) {
  if (neededQty <= 0) return [];

  const licenseKeysRef = db.collection("licenseKeys");

  return await db.runTransaction(async (tx) => {
    console.log(
      `🔄 Transaction started: order=${orderId}, product=${productId}`,
    );

    // 1️⃣ Read available keys ONLY for this product
    const snapshot = await tx.get(
      licenseKeysRef
        .where("status", "==", "available")
        .where("productId", "==", productId)
        .limit(neededQty),
    );

    console.log(
      `📦 Needed=${neededQty}, Found=${snapshot.size} for product=${productId}`,
    );

    if (snapshot.size < neededQty) {
      throw new Error(
        `Not enough keys for product ${productId} (needed ${neededQty}, found ${snapshot.size})`,
      );
    }

    const reservedKeys = [];

    // 2️⃣ Update them atomically
    snapshot.docs.forEach((doc) => {
      const data = doc.data();

      // reservedKeys.push(data.key);

      reservedKeys.push({
        key: data.key,
        status: "active",
        isReplacement: false,
        addedAt: Date.now(),
        replacedAt: null,
        replacementReason: null,
        licenseDocId: doc.id, // Optional: keep reference to license doc
      });

      tx.update(doc.ref, {
        status: "used",
        orderId,
        orderNumber,
        usedAt: FieldValue.serverTimestamp(),
        b2bSupplierId: b2bSupplierId,
        uid: uid,
      });
    });

    console.log(`✅ Reserved keys for product ${productId}:`, reservedKeys);

    return reservedKeys;
  });
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
        // 'whsec_ed16e1c24a67aaf05721441157b18ea73c196a633594f43803fca553ba780c9d'
        // "whsec_n9vgs7GOQKS1uOzF9Ufoxct5NMX11inK" //omar test webook
        "whsec_3v6ak8Zl2sGGPyoBt2XUxdJEzGsIHLP9", //sertic test webook
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

function generateEmailContent(customerName, companyCountryCode = "EN") {
  // Get template based on country code, fallback to EN if not found
  const template =
    emailTemplates[companyCountryCode.toUpperCase()] || emailTemplates.EN;

  const name = customerName || "";

  // Build important info list
  const importantInfoList = template.importantInfo
    .map((info) => `<li>${info}</li>`)
    .join("\n         ");

  const htmlContent = `<p>${template.greeting}${name ? " " + name : ""},</p>
       <p>${template.thankYou}<br>
       ${template.processed}</p>
    
       <p>${template.attachmentsIntro}</p>
       <ul>
         <li>${template.attachments.invoice}</li>
         <li>${template.attachments.license}</li>
       </ul>
    
       <p><strong>${template.importantInfoTitle}</strong></p>
       <ul>
         ${importantInfoList}
       </ul>
    
       <p>${template.contactText}
       <a href="mailto:info@sertic.nl">info@sertic.nl</a></p>
    
       <p>${template.closing},<br>
       S.R. (Sergio) Eersel<br>
       ${template.founder}</p>`;

  return {
    subject: template.subject,
    html: htmlContent,
  };
}

// Main function to send email with attachments
async function sendOrderConfirmationEmail(
  customerName = '',
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

    const companyCountry =
      fullSession?.line_items?.data?.[0].price?.product?.metadata
        ?.companyCountry || "US";
    const taxId = fullSession?.metadata?.taxId;
    const b2bSupplierId = fullSession?.metadata?.b2bSupplierId;
    const uid = fullSession?.metadata?.uid;


    if (fullSession?.metadata && fullSession?.metadata?.orderId) {
      const orderId = fullSession?.metadata?.orderId
      const orderNumber = fullSession?.metadata?.orderNumber

      const orderRef = db.collection("orders").doc(orderId);
      const orderSnap = await orderRef.get();
      const orderData = orderSnap.data();
      const allProducts = orderData.products ?? [];

      const invoicePdfBuffer = await generateInvoicePDFBuffer(
        fullSession,
        orderId,
        orderNumber,
        allProducts,
        companyCountry,
        taxId,
      );

      const invoicePdfUrl = await uploadPDFToFirebaseStorage(
        orderNumber,
        invoicePdfBuffer,
        "Invoice"
      );

      let emailAttachemnts = [
        {
          filename: `Invoice-${orderNumber}.pdf`,
          content: invoicePdfBuffer, // Buffer or string
          contentType: invoicePdfBuffer.contentType || "application/pdf",
        },
      ];

      // Update order as completed with both URLs

      await orderRef.update({
        invoiceGeneratedAt: new Date(),
        paymentStatus: "paid",
        invoiceUrl: invoicePdfUrl,
      });
      await sendOrderConfirmationEmail(
        "",
        fullSession?.metadata?.email,
        emailAttachemnts,
        companyCountry, // 'NL', 'EN', 'FR', or 'DE'
      );

    } else {
      const orderNumber = await getNextOrderNumber();
      console.log("fullSession12",fullSession);
      
      const data = {
        uid: uid,
        orderNumber: orderNumber,
        poNumber: fullSession?.metadata?.poNumber,
        internalEntryStatus: "pending",
        email: fullSession?.customer_details?.email,
        country: fullSession?.customer_details?.address?.country,
        city: fullSession?.customer_details?.address?.city,
        address1: fullSession?.customer_details?.address?.line1,
        address2: fullSession?.customer_details?.address?.line2,
        postal_code: fullSession?.customer_details?.address?.postal_code,
        bussinessName: fullSession?.customer_details?.business_name,
        total: fullSession?.amount_total / 100,
        currency: fullSession?.currency,
        createdAt: new Date(fullSession?.created * 1000),
        products: fullSession?.line_items?.data?.map((item) => ({
          productId: item?.price?.product?.metadata?.id,
          name: item?.price?.product?.name,
          quantity: item?.quantity,
          unitPrice: item?.price?.unit_amount / 100,
          totalPrice: item?.amount_total / 100,
          isDigital: item?.price?.product?.metadata?.isDigital === "true", // Retrieve from metadata
          PN: item?.price?.product?.metadata?.PN,
          companyCountry,
        })),
      };

      let digitalProducts =
        data.products?.filter((product) => product.isDigital) ?? [];
      let phisycalProducts =
        data.products?.filter((product) => !product.isDigital) ?? [];
      const orderDocRef = await db.collection("orders").add(data);
      const orderId = orderDocRef.id;
      let productsWithKeys;
      try {
        productsWithKeys = await assignKeysToProducts(
          orderId,
          orderNumber,
          digitalProducts,
          b2bSupplierId,
          uid,
        );
      } catch (err) {
        console.error(
          "❌ Not enough license keys or error reserving keys:",
          err.message,
        );

        // Update order as failed or out-of-stock
        await db.collection("orders").doc(orderId).update({
          internalEntryStatus: "failed",
          failureReason: err.message,
          invoiceGeneratedAt: null,
        });

        // optional: notify admin or send email to customer here
        return;
      }
      const allProducts = [...productsWithKeys, ...phisycalProducts];
      await db.collection("orders").doc(orderId).update({
        products: allProducts,
        internalEntryStatus: "keys_assigned",
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
        companyCountry,
      );
      const invoicePdfBuffer = await generateInvoicePDFBuffer(
        fullSession,
        orderId,
        orderNumber,
        allProducts,
        companyCountry,
        taxId,
      );

      const licensePdfUrl = await uploadPDFToFirebaseStorage(
        orderNumber,
        pdfBuffer,
        "License"
      );
      const invoicePdfUrl = await uploadPDFToFirebaseStorage(
        orderNumber,
        invoicePdfBuffer,
        "Invoice"
      );
      let emailAttachemnts = [
        {
          filename: `Invoice-${orderNumber}.pdf`,
          content: invoicePdfBuffer, // Buffer or string
          contentType: invoicePdfBuffer.contentType || "application/pdf",
        },
      ];
      if (productsWithKeys?.length > 0) {
        emailAttachemnts.push({
          filename: `License-${orderNumber}.pdf`,
          content: pdfBuffer, // Buffer or string
          contentType: pdfBuffer.contentType || "application/pdf",
        });
      }
      await sendOrderConfirmationEmail(
        data?.name,
        data?.email,
        emailAttachemnts,
        companyCountry, // 'NL', 'EN', 'FR', or 'DE'
      );

      // Update order as completed with both URLs
      await db.collection("orders").doc(orderId).update({
        invoiceGeneratedAt: new Date(),
        internalEntryStatus: "completed",
        paymentStatus: "paid",
        invoiceUrl: invoicePdfUrl,
        licenseUrl: licensePdfUrl,
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
    );

    browser = await puppeteer.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"], // Use chromium's recommended args
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(), // <-- THIS is the key line
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

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

app.use(express.json());
app.use(bodyParser.json());

const calculateOrderAmount = (price) => {
  return price * 100;
};

app.get("/", (req, res) => {
  res.send("welcome to microsoftsupplier website");
});

app.post("/create-checkout-session", async (req, res) => {
  const cart = req.body.cart;
  const useremail = req.body.useremail;
  const cat = req.body.foundUser;
  const userData = req.body.userData;
  const b2bSupplierId = userData?.b2bSupplierId;
  const companyCountry = userData?.companyCountry;
  const poNumber = req.body?.poNumber || null;
  const isUserPayByInvoiceEnabled = req.body?.isUserPayByInvoiceEnabled;
  const userInvoiceSettings =
    isUserPayByInvoiceEnabled && req.body?.userInvoiceSettings;
  const currentDate = new Date();
  const overdueDate = new Date(currentDate);
  const overDueDay = userInvoiceSettings && userInvoiceSettings?.overDueDay
  overdueDate.setDate(currentDate.getDate() + overDueDay);
  const isUSCompany = userData?.companyCountry === "US";
  let currency;
  currency = isUSCompany ? "usd" : "eur";
  const lineItems = cart?.map((product) => {
    let b2bpriceWVat = parseFloat(
      isUSCompany ? product?.["b2bpriceWVat_USD"] : product?.b2bpriceWVat,
    );
    const priceCopy = b2bpriceWVat.toFixed(2);
    const isDigital = product?.type === "digital software";
    let customFields = null;
    let description = "";
    const PN = product?.PN;
    if (product?.selectedLangObj?.id) {
      customFields = {
        PN: product.selectedLangObj.PN,
        language: product.selectedLangObj.lang,
        isDigital: isDigital,
        PN: PN,
        id: product?.id,
        companyCountry: userData.companyCountry,
        b2bSupplierId: userData.b2bSupplierId,
        poNumber: poNumber
        // taxId: userData.taxId,
      };
      description = `Language: ${product.selectedLangObj.lang}  PN: ${product.selectedLangObj.PN}`;
    } else {
      customFields = {
        language: `Language: English`,
        isDigital: isDigital,
        PN: PN,
        id: product?.id,
        companyCountry: userData?.companyCountry,
        b2bSupplierId: userData.b2bSupplierId,
        poNumber: poNumber
        // taxId: userData.taxId,
      };
      description = `Language: English`;
    }

    return {
      price_data: {
        currency: currency,
        product_data: {
          name: product.name,
          images: [product.imageUrl],
          metadata: customFields,
          description: description,
        },
        unit_amount: priceCopy * 100,
      },
      quantity: product.calculatequantity || 1,
    };
  });

  if (isUserPayByInvoiceEnabled) {
    try {
      // 1. Prepare line items using your exact existing logic for metadata and pricing
      const paymentLinkLineItems = cart.map((product) => {
        const b2bpriceWVat = parseFloat(
          isUSCompany ? product?.["b2bpriceWVat_USD"] : product?.b2bpriceWVat,
        );
        const isDigital = product?.type === "digital software";
        const description = product?.selectedLangObj?.id
          ? `Language: ${product.selectedLangObj.lang} PN: ${product.selectedLangObj.PN}`
          : `Language: English`;
        const unit_amount = parseFloat(b2bpriceWVat * 100);
        return {
          price_data: {
            currency: currency,
            unit_amount: unit_amount,
            product_data: {
              name: product.name,
              description: description,
              images: [product.imageUrl],
              metadata: {
                amount_total: product?.quantity * unit_amount,
                PN: product?.selectedLangObj?.PN || product.PN,
                id: product?.id,
                isDigital: String(isDigital),
                language: product?.selectedLangObj?.lang || "English",
              },
            },
          },
          quantity: product.calculatequantity || 1,
        };
      });

      // 2. Create the Payment Link
      // This creates a permanent URL (no 24h limit) that you can store in Firebase
      const orderNumber = await getNextOrderNumber();
      const orderDocRef = await db.collection("orders").add({
        orderNumber,
        createdAt: new Date(),
      });
      const orderId = orderDocRef.id;

      const payByLinkSessionData = {
        line_items: paymentLinkLineItems,
        currency: currency,
        metadata: {
          poNumber: poNumber || "N/A",
          orderType: "pay_by_invoice",
          orderNumber: orderNumber,
          orderId: orderId,
          uid: userData?.uid,
          b2bSupplierId: userData?.b2bSupplierId,
          taxId: userData?.taxId,
          companyCountry: userData?.companyCountry,
          email: userData?.email,
        },
        // You can disable manual tax or promotion codes to keep the UI minimal
        billing_address_collection: "required",
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

      const uid = userData?.uid;

      const data = {
        uid: uid,
        internalEntryStatus: "pending",
        paymentStatus: "payment due",
        paymentUrl: paymentLinkUrl,
        email: userData?.email,
        country: userData?.companyCountry,
        poNumber: poNumber,
        companyName: userData?.companyName,
        // city: fullSession?.customer_details?.address?.city,
        // address1: fullSession?.customer_details?.address?.line1,
        // address2: fullSession?.customer_details?.address?.line2,
        // postal_code: fullSession?.customer_details?.address?.postal_code,
        // bussinessName: fullSession?.customer_details?.business_name,
        total: totalAmountMainCurrency,
        currency: currency,
        createdAt: new Date(),
        overdueDate: overdueDate,
        products: paymentLinkLineItems.map((item) => ({
          productId: item?.price_data?.product_data?.metadata?.id,
          name: item?.price_data?.product_data?.name,
          quantity: item?.quantity,
          unitPrice: item?.price_data?.unit_amount / 100,
          totalPrice:
            item?.price_data?.product_data?.metadata?.amount_total / 100,
          isDigital:
            item?.price_data?.product_data?.metadata?.isDigital === "true", // Retrieve from metadata
          PN: item?.price_data?.product_data?.metadata?.PN,
          companyCountry,
        })),
      };

      // Store order as pending
      await orderDocRef.update(data);
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
          b2bSupplierId,
          uid,
        );
      } catch (err) {
        console.error(
          "❌ Not enough license keys or error reserving keys:",
          err.message,
        );

        // Update order as failed or out-of-stock
        await db.collection("orders").doc(orderId).update({
          internalEntryStatus: "failed",
          failureReason: err.message,
          invoiceGeneratedAt: null,
        });

        // optional: notify admin or send email to customer here
        return;
      }
      let taxId = userData?.taxId

      processPayByInvoiceOrder(
        data,
        orderNumber,
        companyCountry,
        productsWithKeys,
        phisycalProducts,
        orderId,
        taxId
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
      billing_address_collection: "required",
      name_collection: {
        business: {
          enabled: true, // show Business Name field
          optional: false, // make it required
        },
      },
      metadata: {
        taxId: userData?.taxId,
        b2bSupplierId: userData?.b2bSupplierId,
        uid: userData?.uid,
        poNumber: poNumber || "N/A",
      },
      expires_at: expirationTime,
      success_url: `${YOUR_DOMAIN}/success`,
      cancel_url: `${YOUR_DOMAIN}?canceled=true`,
    };

    if (useremail) {
      sessionData.customer_email = useremail;
    }

    const session = await stripe.checkout.sessions.create(sessionData);
    res.status(200).send(session.url);
  }
});

app.post("/api/sendemail", async (req, res) => {
  const { email, companyName, messages } = req.body;

  try {
    const send_to = process.env.EMAIL_USER;
    const sent_from = process.env.EMAIL_USER;
    const reply_to = email;
    const subject = `Asking regarding buying`;
    const message = `
      <p>Dear MicrosoftSupplier team</p>
      <p>Please click on reply to contact me regarding the GigaSupplier Plan:</p>
      <h5>My Email Address: </h5>
      <p>${email}</p>
      <h5>Company Name : </h5>
      <p>${companyName}</p>
      <p>${messages}</p>
    `;

    await sendEmail(subject, message, send_to, sent_from, reply_to);
    res.status(200).json({ success: true, message: "Email Sent" });
  } catch (error) {
    res.status(500).json(error.message);
  }
});
app.post("/api/registerNewPendingUser", async (req, res) => {
  const { email, companyName, taxId, companyCountry, password } = req.body;
  let userFound;
  try {
    await getAuth()
      .createUser({
        email: email,
        emailVerified: false,
        disabled: true,
        password: password,
      })
      .then((createdUser) => {
        db.collection("pending_registrations").add({
          uid: createdUser?.uid,
          email: email,
          taxId: taxId,
          companyName: companyName,
          companyCountry: companyCountry,
          createdAt: Date.now(),
        });
      })
      .catch((error) => {
        console.log("error creating a new registered user", error);
        return null;
      });
    res.status(200).json({ success: true, userFound: userFound });
  } catch (error) {
    res.status(500).json(error.message);
  }
});
app.post("/api/send-admin-email-pendingRegistrations", async (req, res) => {
  const { email, companyName, taxId, companyCountry } = req.body;

  let userFound;
  try {
    await sendEmailToAdmin(
      `pending Registration`,
      generateRegistrationEmailHTML({
        email: email,
        company: companyName,
        country: companyCountry,
        type: taxId,
      }),
      "info@microsoftsupplier.com",
      process.env.EMAIL_USER,
      process.env.EMAIL_USER,
    );
    res
      .status(200)
      .json({ success: true, message: "email to admin sent successfully" });
  } catch (error) {
    res.status(500).json(error.message);
  }
});
app.use("/api/licenses", licenseRoutes);
async function getPendingDetails(docId) {
  const docRef = db.collection("pending_registrations").doc(docId);

  // Await the promise to get the DocumentSnapshot
  const pendingRegistrationSnapshot = await docRef.get();

  if (pendingRegistrationSnapshot.exists) {
    // Access the data using .data()
    const pendingRegistrationDetails = pendingRegistrationSnapshot.data();
    return pendingRegistrationDetails;
  } else {
    return null;
  }
}

// Function to safely generate the next sequential B2B Account ID
const getNextB2BAccountId = async () => {
  const counterRef = db.collection("settings").doc("b2b_account_id_counter");

  // Use a transaction to ensure atomic increment and prevent race conditions
  const newId = await db.runTransaction(async (t) => {
    const doc = await t.get(counterRef);

    // Check if the counter exists (initial setup check)
    if (!doc.exists) {
      throw new Error("B2B ID counter not set up!");
    }

    const currentId = doc.data().last_id;
    const prefix = doc.data().prefix || "";

    // 1. Increment the ID number
    const nextIdNumber = currentId + 1;

    // 2. Update the counter in the transaction
    t.update(counterRef, { last_id: nextIdNumber });

    // 3. Return the fully formatted ID
    // Example: 'B2B-10001'
    return `${prefix}${nextIdNumber}`;
  });

  return newId;
};

app.post("/api/accept-pendingRegistration", async (req, res) => {
  const { uid, email, docId } = req.body;

  try {
    const b2bSupplierId = await getNextB2BAccountId();
    // 1. Enable the user account in Firebase Auth
    await getAuth()
      .updateUser(uid, {
        disabled: false,
      })
      .then(async (userRecord) => {
        // 2. Send Acceptance Email
        sendEmailToClient(
          `pending Registration response`,
          generateClientStatusEmailHTML(email, "accepted"),
          email,
          process.env.EMAIL_USER,
          process.env.EMAIL_USER,
        );

        // 3. Get Pending Registration Details
        const pendingRegistrationSnapshot = await getPendingDetails(docId);

        // 4. *** CONSOLIDATE AND CREATE USER DOCUMENT ***
        const newUserData = {
          uid: uid,
          email: email,
          isB2B: true,
          b2bSupplierId: b2bSupplierId,
          companyName: pendingRegistrationSnapshot.companyName,
          companyCountry: pendingRegistrationSnapshot.companyCountry,
          taxId: pendingRegistrationSnapshot.taxId,
          status: "active", // Set the initial status
          creationTime: userRecord.metadata.creationTime, // From Auth metadata
          acceptedAt: Date.now(), // Timestamp for acceptance
          langCode: "en",
          invoiceSettings: { enabled: false, overDueDay: null },
        };

        await db
          .collection("users")
          .doc(uid) // Use UID as the document ID
          .set(newUserData);
        await db.collection("pending_registrations").doc(docId).delete();
        await db.collection("registrations_history").add({
          uid: uid,
          email: email,
          status: "Accepted",
          createdAt: Date.now(),
        });
      })
      .catch((error) => {
        console.log("Error updating user:", error);
        throw new Error(`Auth Update Error: ${error.message}`);
      });

    // Success Response
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
app.post("/api/decline-pendingRegistration", async (req, res) => {
  const { uid, email, docId } = req.body;

  let userFound;
  try {
    await sendEmailToClient(
      `pending Registration response`,
      generateClientStatusEmailHTML(email, "declined"),
      email,
      process.env.EMAIL_USER,
      process.env.EMAIL_USER,
    );
    await db.collection("pending_registrations").doc(docId).delete();

    await db.collection("registrations_history").add({
      uid: uid,
      email: email,
      status: "Declined",
      createdAt: Date.now(),
    });
    res
      .status(200)
      .json({ success: true, message: "email to admin sent successfully" });
  } catch (error) {
    res.status(500).json(error.message);
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
