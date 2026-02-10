import { uploadPDFToSupabaseStorage } from "../../services/supabaseStorage.service.js";
import chromium from "@sparticuz/chromium";


import { getOrderWithProfile, updateOrder } from "../../Utils/supabaseOrderService.js";
import puppeteer from "puppeteer";
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
function escapeHtml(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
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


    // Get template based on country code, fallback to EN if not found
    const template =
        invoiceTemplates[companyCountryCode.toUpperCase()] || invoiceTemplates.EN;
    const t = template.translations;

    const customer = session.customer_details || {};
    const address = customer.address || {};
    const total = (session.total_amount || 0);
    const formattedTotal = total.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    const currency = (session.currency || "eur").toUpperCase();
    const po_number = session?.po_number;
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
    const invoiceDate = new Date().toLocaleDateString(
        template.language,
        {
            day: "2-digit",
            month: "long",
            year: "numeric",
        },
    );

    // Due date is 30 days after invoice date
    const dueDate = new Date(session.created_at);
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
        const isLocalMac = process.platform === "darwin" && process.arch === "arm64";

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
const generateInvoicePdf = async (req, res) => {
    const {
        orderId
    } = req.params;

    try {
        if (!orderId) throw new Error('Order ID is required');
        const userProfileFields = ['company_name', 'email', 'company_country', 'company_city', 'tax_id', 'company_house_number', 'company_street', 'company_zip_code'];
        const orderData = await getOrderWithProfile(orderId, userProfileFields);
        const {
            user_id,
            order_number,
            internal_status,
            payment_status,
            po_number,
            total_amount,
            currency,
            created_at,
            products,
            payment_due_date,
            profiles: {
                company_name,
                email,
                company_country,
                company_city,
                tax_id,
                company_house_number,
                company_street,
                company_zip_code
            } = {}
        } = orderData || {};



        const invoicePdfBuffer = await generateInvoicePDFBuffer(
            orderData,
            orderId,
            order_number,
            products,
            company_country,
            tax_id,
            company_city,
            company_house_number,
            company_street,
            company_zip_code,
            company_name,
        );

        const invoicePdfUrl = await uploadPDFToSupabaseStorage(
            order_number,
            invoicePdfBuffer,
            "Invoice",
        );



         await updateOrder(orderId, {
            invoice_generated_at: new Date(),
            payment_status: "paid",
            invoice_url: invoicePdfUrl,
        });

        res.status(200).json({
            success: true,
            message: 'proforma generated successfully',
        });
    } catch (error) {
        console.error('❌ Error generate proforma:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export default {
    generateInvoicePdf,
};
