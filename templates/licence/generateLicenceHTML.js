import templates from "./templates.js";
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function generateLicenceHTML(
    licenseData,
    companyCountryCode = "EN",
  ) {
    const {customer, order, products} = licenseData;
    const template = templates[companyCountryCode.toUpperCase()] || templates.EN;
    const t = template.translations;
    const address = customer.address || {};
    const invoiceDate = new Date(order.date * 1000).toLocaleDateString(
      template.language,
      {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }
    );
  
    // Map products to HTML blocks
    const productsHtml = (products || [])
      .map((product, idx) => {
        const keysHtml = (product.licenseKeys || [])
          .map((k) => `<div class="license-key">${k.key}</div>`)
          .join("");
        return `
      <div class="product-section">
        <div class="product-title">${escapeHtml(product.name || "")} (x${
          product.quantity || 0
        })</div>
        <div class="license-keys-title">${t.licenseKeys}:</div>
        <div class="license-keys-grid">
          ${keysHtml}
        </div>
        <div class="installation-support">
          <strong>${t.installationMedia}</strong><br>
          <strong>${escapeHtml(product.name || "")}</strong><br>
          <a href="${template.downloadUrl}">
            ${template.downloadUrl}
          </a>
        </div>
      </div>
    `;
      })
      .join("");
  
    return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>${t.documentTitle}</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html, body {
        width: 100%;
        min-height: 100%;
        font-family: Arial, sans-serif;
        color: #333;
        line-height: 1.4;
        position: relative;
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
      .left h1 {
        font-size: 32px;
        margin: 0;
        font-family: "Helvetica", "Arial", sans-serif;
        font-weight: 800;
      }
      .right {
        text-align: right;
        font-size: 16px;
        line-height: 1.4;
        font-family: "Helvetica", "Arial", sans-serif;
        font-weight: 400;
      }
      .text-icon {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
      }
      .text-icon .text {
        text-align: right;
      }
      .icon-block {
        margin-top: 20px;
        font-size: 30px;
      }
      .icon-block span {
        display: block;
        margin-bottom: 10px;
      }
      .header-image {
        width: 100%;
        height: auto;
        display: block;
      }
      .content {
        padding: 15mm;
        width: 100%;
        height: auto;
        flex: 1;
        padding-bottom: 100px;
      }
      .company-address {
        margin-bottom: 15px;
        font-size: 14px;
      }
      .company-address div:first-child {
        font-weight: bold;
        font-size: 16px;
      }
      .document-header {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 5px;
        align-items: flex-end;
        font-size: 14px;
        margin-bottom: 15px;
      }
      .document-number {
        background: #2c5aa0;
        color: white;
        font-weight: bold;
        padding: 4px 8px;
        font-size: 14px;
      }
      .document-title {
        font-size: 18px;
        font-weight: bold;
        margin: 10px 0 15px 0;
      }
      .items-section {
        margin-bottom: 30px;
        font-size: 14px;
      }
      .items-header, .items-row {
        display: grid;
        grid-template-columns: 200px 1fr 100px;
        gap: 10px;
        padding: 8px 0;
      }
      .items-header {
        font-weight: bold;
        border-top: 2px solid #ddd;
        border-bottom: 1px solid #ddd;
        background: #f8f9fa;
      }
      .items-row {
        border-bottom: 1px solid #eee;
      }
      .items-row a {
        color: #2c5aa0;
        text-decoration: none;
        font-weight: bold;
      }
      .text-right {
        text-align: right;
      }
      .product-section {
        margin: 10px 0;
        font-size: 14px;
      }
      .product-title {
        color: #2c5aa0;
        font-weight: bold;
        margin-bottom: 10px;
        font-size: 16px;
      }
      .license-keys-title {
        font-weight: bold;
        margin-bottom: 10px;
        font-size: 14px;
      }
      .license-keys-grid {
        display: grid;
        grid-template-columns: repeat(2, max-content);
        gap: 5px;
      }
      .license-key {
        background: #000;
        color: white;
        padding: 2px 5px;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        letter-spacing: 1px;
        font-weight: bold;
        border-radius: 3px;
        width: fit-content;
      }
      .installation-support {
        border: 2px solid #2c5aa0;
        padding: 10px;
        margin: 15px 0 0;
        font-size: 13px;
        background: #f8f9fa;
        width: 70%;
      }
      .installation-support strong {
        color: #2c5aa0;
        font-size: 14px;
      }
      .installation-support a {
        color: #2c5aa0;
        word-break: break-all;
        font-weight: bold;
      }
      .footer {
        margin-top: 20px;
        text-align: center;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: white;
        padding: 20px 0;
      }
      .footer img {
        max-width: 200px;
        height: auto;
      }
    </style>
  </head>
  <body>
    <div class="banner">
      <div class="left">
        <h1>Sertic</h1>
      </div>
      <div class="right">
        <div class='text-icon'>
          <span class='text'>Sertic.nl</span>
        </div>
        <div class='text-icon'>
          <span class='text'>info@sertic.nl</span>
        </div>
        <div class='text-icon'>
          <span class='text'>${t.location}</span>
        </div>
        <div>${t.city}</div>
      </div>
    </div>
    <div class="content">
      <div class="company-address">
        <div>${escapeHtml(customer.name || customer.business_name || "")}</div>
        <div>${escapeHtml(address.line1 || "")}</div>
        <div>${escapeHtml(address.postal_code || "")}</div>
        <div>${escapeHtml(address.country || "")}</div>
      </div>
      
      <div class="document-header">
        <div class="document-number">${t.documentTitle}: ${escapeHtml(
            order.number
    )}</div>
        <div class="document-date">${t.date}: ${invoiceDate}</div>
      </div>
      
      <div class="document-title">${t.documentTitle}: ${escapeHtml(
        order.number
    )}</div>
      
      <div class="items-section">
        <div class="items-header">
          <div>${t.position} ${t.itemNo}</div>
          <div>${t.description}</div>
          <div class="text-right">${t.quantity}</div>
        </div>
        ${(products || [])
          .map(
            (p, i) => `
          <div class="items-row">
            <div>${i + 1}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${escapeHtml(
              p.PN || ""
            )}</div>
            <div><a href="#">${escapeHtml(p.name || "")}</a></div>
            <div class="text-right">${p.quantity || 0}</div>
          </div>
        `
          )
          .join("")}
      </div>
      
      ${productsHtml}
      
      <div class="footer">
        <img src="https://firebasestorage.googleapis.com/v0/b/supplier-34b95.appspot.com/o/assets%2FMSlogo.png?alt=media&token=f5524581-bc40-41c6-8c56-61906b61b4b0" alt="Microsoft Supplier Logo">
      </div>
    </div>
  </body>
  </html>
    `;
  }


  export default generateLicenceHTML