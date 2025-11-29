const puppeteer = require('puppeteer');
const pdfTemplates = require('../templates/pdfTemplates');
const fileUtils = require('../utils/fileUtils');

const pdfService = {

  async generatePDF(data, templateType = 'default', customFilename = null) {
    try {
      // Get HTML template based on type
      const htmlContent = pdfTemplates.getTemplate(templateType, data);
      
      // Generate PDF buffer
      const pdfBuffer = await this._generatePDFBuffer(htmlContent);
      
      // Generate filename
      const filename = customFilename || `pdf-${templateType}-${Date.now()}.pdf`;
      
      // Save PDF to file system
      await fileUtils.savePDF(pdfBuffer, filename);
      
      return {
        filename,
        size: pdfBuffer.length,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`PDF generation failed: ${error.message}`);
    }
  },

  async generateInvoicePDF(invoiceData) {
    const htmlContent = pdfTemplates.generateInvoice(invoiceData);
    const pdfBuffer = await this._generatePDFBuffer(htmlContent);
    
    const filename = `invoice-${invoiceData.invoiceNumber || Date.now()}.pdf`;
    await fileUtils.savePDF(pdfBuffer, filename);
    
    return { filename, size: pdfBuffer.length };
  },

  async generateReportPDF(reportData) {
    const htmlContent = pdfTemplates.generateReport(reportData);
    const pdfBuffer = await this._generatePDFBuffer(htmlContent);
    
    const filename = `report-${Date.now()}.pdf`;
    await fileUtils.savePDF(pdfBuffer, filename);
    
    return { filename, size: pdfBuffer.length };
  },

  async generateCustomPDF(data, customTemplate, filename = null) {
    const htmlContent = pdfTemplates.generateCustom(data, customTemplate);
    const pdfBuffer = await this._generatePDFBuffer(htmlContent);
    
    const finalFilename = filename || `custom-pdf-${Date.now()}.pdf`;
    await fileUtils.savePDF(pdfBuffer, finalFilename);
    
    return { filename: finalFilename, size: pdfBuffer.length };
  },

  // Private method to generate PDF buffer
  async _generatePDFBuffer(htmlContent) {
    let browser;
    
    try {
      browser = await puppeteer.launch({ 
        headless: 'new',
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      });
      
      const page = await browser.newPage();
      
      // Set viewport for better rendering
      await page.setViewport({ width: 1200, height: 800 });
      
      await page.setContent(htmlContent, { 
        waitUntil: ['networkidle0', 'domcontentloaded'] 
      });
      
      // Wait a bit for any dynamic content
      await page.waitForTimeout(1000);
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });

      return pdfBuffer;

    } catch (error) {
      throw new Error(`PDF buffer generation failed: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
};

module.exports = pdfService;