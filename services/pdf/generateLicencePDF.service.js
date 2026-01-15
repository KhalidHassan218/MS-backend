import generateLicenceHTML from "../../templates/licence/generateLicenceHTML.js";
import generateReplacmentLicenseHTML from "../../templates/licence/generateReplacmentLicenseHTML.js";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import chromium from "@sparticuz/chromium";
puppeteer.use(StealthPlugin());

async function generateLicencePDFBuffer(
  licenseData,
  companyCountryCode,
  keyReplacement = false
) {
  let browser;
  try {
    let htmlContent;
    if (keyReplacement) {
      htmlContent = generateReplacmentLicenseHTML(
        licenseData,
        companyCountryCode,
        true
      );
    } else {
      htmlContent = generateLicenceHTML(licenseData, companyCountryCode);
    }

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent);

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
    });

    console.log("✅ PDF buffer generated, ready for download");
    return pdfBuffer;
  } catch (error) {
    console.error("❌ Error generating PDF buffer:", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export default generateLicencePDFBuffer;
