import generateLicenceHTML from "../../templates/licence/generateLicenceHTML.js";
import generateReplacmentLicenseHTML from "../../templates/licence/generateReplacmentLicenseHTML.js";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import chromium from "@sparticuz/chromium";

puppeteer.use(StealthPlugin());

const isLocalMac = process.platform === "darwin" && process.arch === "arm64";

async function generateLicencePDFBuffer(
  licenseData,
  companyCountryCode,
  keyReplacement = false
) {
  let browser;

  try {
    const htmlContent = keyReplacement
      ? generateReplacmentLicenseHTML(licenseData, companyCountryCode, true)
      : generateLicenceHTML(licenseData, companyCountryCode);

    browser = await puppeteer.launch(
      isLocalMac
        ? {
          executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          headless: "new",
        }
        : {
          args: chromium.args,
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
        }
    );

    const page = await browser.newPage();
    
    // Set viewport to ensure consistent rendering
    await page.setViewport({ width: 794, height: 1122 }); 

    await page.setContent(htmlContent, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    return await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: false, // We are using HTML/CSS for the footer instead
      preferCSSPageSize: true, // This respects the @page margins defined in HTML
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
    });
  } catch (error) {
    console.error("❌ Error generating PDF buffer:", error);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

export default generateLicencePDFBuffer;