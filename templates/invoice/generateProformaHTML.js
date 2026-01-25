import { invoiceTranslationTemplates } from "./translationTemplates.js";
function escapeHtml(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
export function generateProformaHTML(
    data,
    orderNumber,
    productsWithKeys,
    companyCountryCode = "EN",
    taxId,
) {
    console.log("123", data);

    // Get template based on country code, fallback to EN if not found
    const template =
        invoiceTranslationTemplates[companyCountryCode.toUpperCase()] || invoiceTranslationTemplates.EN;
    const t = template.translations;

    const customer = data.customer_details || {};
    console.log("customer", customer);
    const address = customer.address || {};
    const total = (data.total || 0);
    const currency = (data.currency || "eur").toUpperCase();
    const poNumber = data?.poNumber
    const overdueDate = data?.overdueDate
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
    const invoiceDate = new Date(data.createdAt).toLocaleDateString(
        template.language,
        {
            day: "2-digit",
            month: "long",
            year: "numeric",
        },
    );

    // Due date is 30 days after invoice date
    const dueDate = new Date(data.created * 1000);
    dueDate.setDate(dueDate.getDate() + 30);
    const dueDateFormatted = overdueDate.toLocaleDateString(template.language, {
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
        /* CHANGED: 95vh leaves room for printer margins so it doesn't overflow */
        min-height: 95vh; 
        font-family: Arial, sans-serif;
        color: #333;
        line-height: 1.4; /* Slightly tighter lines */
      }
      body {
        display: flex;
        flex-direction: column;
        /* Ensure the body takes full height for the footer push to work */
        height: 100%;
      }
      .banner {
        width: 100%;
        /* CHANGED: Reduced height from Aspect Ratio to 120px to save space */
        height: 120px; 
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
        font-size: 14px;
        line-height: 1.4;
        font-family: "Helvetica", "Arial", sans-serif;
        font-weight: 400;
      }
      .content {
        /* CHANGED: Reduced top/bottom padding to fit more content */
        padding: 10px 40px 0 40px;
        width: 100%;
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .top-section {
        display: flex;
        justify-content: space-between;
        margin-bottom: 15px; /* Reduced from 20px */
      }
      .customer-info { font-size: 14px; line-height: 1.4; }
      .customer-info div { margin-bottom: 1px; }
      
      .invoice-info { text-align: right; }
      .invoice-number {
        background: #8BC34A;
        color: white;
        padding: 6px 14px; /* Slightly smaller padding */
        font-weight: bold;
        font-size: 16px;
        display: inline-block;
        margin-bottom: 8px;
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
      .invoice-dates { font-size: 13px; line-height: 1.6; }
      
      .pro-forma-label {
        margin-bottom: 5px;
        font-size: 18px;
        font-weight: bold;
        margin-top: 5px;
      }
      
      .invoice-table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0; /* Reduced margin */
        font-size: 13px;
      }
      .invoice-table thead { background: #00A9E0; color: white; }
      .invoice-table th {
        padding: 8px;
        text-align: left;
        font-weight: bold;
        text-transform: uppercase;
        font-size: 12px;
      }
      .invoice-table td {
        padding: 8px;
        border-bottom: 1px solid #e0e0e0;
      }
      
      .text-right { text-align: right; }
      .text-center { text-align: center; }
      
      .totals-section {
        margin: 10px 0;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: flex-end;
      }
      .totals-table { width: 300px; font-size: 13px; }
      .totals-table td { padding: 4px 8px; }
      .totals-table .total-row td {
        background: #00A9E0;
        color: white;
        font-weight: bold;
        font-size: 15px;
        padding: 8px;
      }
      
      .payment-info { margin: 10px 0; font-size: 12px; }
      .payment-info h3, .professional-info h3, .terms-section h3 {
        color: #8BC34A;
        font-size: 13px;
        margin-bottom: 4px;
        font-weight: bold;
      }
      .professional-info { text-align: right; font-size: 12px; margin-top: 10px; }
      
      .bottom-section {
        margin-top: 15px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 10px;
      }
      .terms-section { flex: 1; font-size: 12px; padding-right: 15px; }
      .terms-section p { margin-bottom: 5px; white-space: pre-line; }
      
      .signature-section {
        text-align: center;
        width: 180px;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .signature-image {
        width: 70px;
        height: 70px;
        border-bottom: 2px solid #333;
        margin: 0 auto 5px auto;
        display: block;
      }
      .signature-image img { width: 100%; display: block; }
      .signature-label { font-size: 12px; font-weight: bold; }

      .footer {
        text-align: center;
        padding: 10px 0 20px 0;
        background: white;
        width: 100%;
        /* KEEPS FOOTER AT BOTTOM */
        margin-top: auto; 
      }
      .footer img { max-width: 180px; height: auto; }
      
      .currency-note, .tax-note {
        font-size: 11px;
        font-style: italic;
        color: #666;
        margin-top: 5px;
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
        customer.name || customer.business_name || data?.companyName || "COMPANY NAME",
    )}</strong></div>
            <div>${escapeHtml(address.country || data?.country || "COUNTRY")}</div>
            ${taxId
            ? `<div>${escapeHtml(taxId)}</div>`
            : "<div>Company Tax ID</div>"
        }
          </div>
          
          <div class="invoice-info">
                 ${poNumber ? `
              <div class="po-number">"PO": ${escapeHtml(poNumber)}</div>
            ` : ""}
            <div class="invoice-number">${t.invoiceNumber}: #${escapeHtml(
            orderNumber,
        )}</div>
    
            <div class="invoice-dates">
              <div><strong>${t.invoiceDate}:</strong> ${invoiceDate}</div>
              <div><strong>${t.overdueDate}:</strong> ${dueDateFormatted}</div>
            </div>
          </div>
        </div>
        <h2 class="pro-forma-label">Pro Forma</h2>
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
          <strong>${t.notPaid}</strong>
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