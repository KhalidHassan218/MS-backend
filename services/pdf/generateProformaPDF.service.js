import { generateProformaHTML } from "../../templates/invoice/generateProformaHTML.js";
import generateLicenceHTML from "../../templates/licence/generateLicenceHTML.js";
import generateReplacmentLicenseHTML from "../../templates/licence/generateReplacmentLicenseHTML.js";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import chromium from "@sparticuz/chromium";

puppeteer.use(StealthPlugin());

const isLocalMac =
    process.platform === "darwin" && process.arch === "arm64";
export async function generateProformaPDFBuffer(
    data,
    orderNumber,
    productsWithKeys,
    companyCountryCode,
    taxId,
    company_city,
    company_house_number,
    company_street,
    company_zip_code,
    company_name,
    over_due_date
) {
    let browser;
    try {
        const htmlContent = generateProformaHTML(
            data,
            orderNumber,
            productsWithKeys,
            companyCountryCode,
            taxId,
            company_city,
            company_house_number,
            company_street,
            company_zip_code,
            company_name,
            over_due_date
        );

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
                }
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

        console.log("✅ proforma PDF buffer generated");
        return pdfBuffer;
    } catch (error) {
        console.error("❌ Error generating proforma PDF buffer:", error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}