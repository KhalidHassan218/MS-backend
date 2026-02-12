import { licenceTranslationTemplate } from "./translationTemplates.js";

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** * Splits array into chunks of 20 to ensure exactly 20 keys per page
 */
const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

function generateLicenceHTML(licenseData, companyCountryCode = "EN") {
  const { customer, order, products } = licenseData;
  const template = licenceTranslationTemplate[companyCountryCode.toUpperCase()] || licenceTranslationTemplate.EN;
  const t = template.translations;
  const address = customer.address || {};
  const invoiceDate = new Date().toLocaleDateString(
    template.language,
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  );

  // Define the dynamic title string for reuse in head and content
  const dynamicDocTitle = `${t.documentTitle}: ${escapeHtml(order.number)}`;

  // Map products to HTML blocks with 20-key chunking
  const productsHtml = (products || []).map((product) => {
    const keyChunks = chunkArray(product.licenseKeys || [], 20);
    const totalChunks = keyChunks.length;

    return keyChunks.map((chunk, index) => {
      const keysHtml = chunk
        .map((k) => `<code class="license-key-code">${k.key}</code>`)
        .join("");

      const isLastChunkOfThisProduct = index === totalChunks - 1;
      
      // Forces a new page for every group of 20 keys
      const pageBreakClass = "page-break";

      return `
      <div class="product-section ${pageBreakClass}">
        <div class="product-title-blue">
          ${escapeHtml(product.name || "")} ${totalChunks > 1 ? `(${index + 1}/${totalChunks})` : ""} (x${product.quantity || 0})
        </div>
        
        <div class="license-keys-grid">
          ${keysHtml}
        </div>

        ${isLastChunkOfThisProduct ? `
        <div class="installation-support-box">
          <div class="support-header">*${t.installationMedia || "Support d'installation"}</div>
          <div class="support-product-name">${escapeHtml(product.name || "")}</div>
          <a href="${template.downloadUrl}" class="support-link">${template.downloadUrl}</a>
        </div>` : ""}
      </div>
    `;
    }).join("");
  }).join("");

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>${dynamicDocTitle}</title>
    <style>
      @page { size: A4; margin: 0; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      
      html, body {
        width: 100%;
        font-family: Arial, sans-serif;
        color: #333;
        line-height: 1.4;
      }

      /* Fixed Footer Logo - Will repeat on every page */
      .footer {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 45mm; 
        background: white;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999;
      }
      .footer img { max-width: 220px; }

      /* The Content Buffer to prevent footer overlap */
      .content {
        padding: 15mm;
        padding-bottom: 70mm; 
      }

      .banner {
        width: 100%;
        aspect-ratio: 4 / 1;
        background-image: url("https://firebasestorage.googleapis.com/v0/b/supplier-34b95.appspot.com/o/assets%2Fimage.png?alt=media&token=104e6658-bbf5-482e-8f0a-314a9d3875e0");
        background-size: cover;
        background-position: center;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 40px;
        color: white;
      }
      .banner h1 { font-size: 32px; font-weight: 800; }
      .banner-right { text-align: right; font-size: 16px; }

      .customer-info { margin-bottom: 20px; font-size: 15px; font-weight: bold; }

      .doc-header-container {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        margin-bottom: 10px;
      }
      .blue-doc-box {
        background: #2c5aa0;
        color: white;
        font-weight: bold;
        padding: 8px 15px;
        font-size: 16px;
        border-radius: 2px;
      }

      /* Main Title above table */
      .document-main-title {
        font-size: 24px;
        font-weight: bold;
        color: #333;
        margin: 20px 0 15px 0;
      }

      .first-page-section {
        page-break-after: always;
      }

      .items-table {
        width: 100%;
        margin-bottom: 30px;
        font-size: 14px;
        border-collapse: collapse;
      }
      .items-table th {
        text-align: left;
        background: #f8f9fa;
        border-top: 2px solid #ddd;
        border-bottom: 1px solid #ddd;
        padding: 10px 5px;
      }
      .items-table td { padding: 10px 5px; border-bottom: 1px solid #eee; }

      .product-title-blue { 
        color: #2c5aa0; 
        font-weight: bold; 
        font-size: 18px; 
        margin: 20px 0 15px 0; 
      }
      
      .license-keys-grid { 
        display: grid; 
        grid-template-columns: repeat(2, 1fr); 
        gap: 10px;
        margin-bottom: 15px;
      }

      /* Black Key Cards with White Text */
      .license-key-code {
        display: inline-block;
        padding: 4px 8px;
        background-color: #000;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        font-family: 'Courier New', monospace;
        font-size: 13px;
        color: white;
        text-align: center;
      }

      .page-break {
        page-break-before: always;
        padding-top: 25mm;
      }

      .installation-support-box {
        border: 2px solid #2c5aa0;
        padding: 15px;
        margin-top: 25px;
        background: #fff;
        page-break-inside: avoid;
      }
      .support-header, .support-product-name { 
        color: #2c5aa0; 
        font-weight: bold; 
        font-size: 16px; 
        margin-bottom: 3px; 
      }
      .support-link { 
        color: #2c5aa0; 
        text-decoration: underline; 
        font-weight: bold; 
        font-size: 14px; 
      }
    </style>
  </head>
  <body>
    <div class="footer">
      <img src="https://firebasestorage.googleapis.com/v0/b/supplier-34b95.appspot.com/o/assets%2FMSlogo.png?alt=media&token=f5524581-bc40-41c6-8c56-61906b61b4b0">
    </div>

    <div class="banner">
      <div class="left"><h1>Sertic</h1></div>
      <div class="banner-right"><div class='text-icon'>
          <span class='text'>Sertic.nl</span>
        </div>
        <div class='text-icon'>
          <span class='text'>info@sertic.nl</span>
        </div>
        <div class='text-icon'>
          <span class='text'>${t.location}</span>
        </div>
        <div>${t.city}</div></div>
    </div>

    <div class="content">
      <div class="first-page-section">
        <div class="customer-info">
          <div>${escapeHtml(customer.name || customer.business_name || "")}</div>
          <div>${escapeHtml(address.line1 || "")}</div>
          <div>${escapeHtml(address.country || "")}</div>
        </div>

        <div class="doc-header-container">
          <div class="blue-doc-box">${dynamicDocTitle}</div>
          <div style="margin-top:5px; font-size:14px;">${t.date}: ${invoiceDate}</div>
        </div>

        <div class="document-main-title">${dynamicDocTitle}</div>

        <table class="items-table">
          <thead>
            <tr><th>Pos Item-no.</th><th>Beschrijving</th><th style="text-align: right;">Aantal</th></tr>
          </thead>
          <tbody>
            ${(products || []).map((p, i) => `
              <tr>
                <td>${i + 1}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${escapeHtml(p.pn || "")}</td>
                <td style="color: #2c5aa0; font-weight: bold;">${escapeHtml(p.name || "")}</td>
                <td style="text-align: right;">${p.quantity || 0}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      ${productsHtml}
    </div>
  </body>
  </html>
    `;
}

export default generateLicenceHTML;