const pdfService = require('../services/pdfService');
const fileUtils = require('../utils/fileUtils');

const pdfController = {
  
  // Generate PDF from generic webhook data
  async generatePDFFromData(req, res) {
    try {
      const { data, filename, template = 'default' } = req.body;
      
      if (!data) {
        return res.status(400).json({ 
          success: false, 
          error: 'Data is required in request body' 
        });
      }

      const pdfResult = await pdfService.generatePDF(data, template, filename);
      
      res.json({
        success: true,
        message: 'PDF generated successfully',
        downloadUrl: `/webhook/pdf/${pdfResult.filename}`,
        filename: pdfResult.filename,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  },

  // Generate invoice PDF
  async generateInvoice(req, res) {
    try {
      const invoiceData = req.body;
      
      const pdfResult = await pdfService.generateInvoicePDF(invoiceData);
      
      res.json({
        success: true,
        message: 'Invoice generated successfully',
        downloadUrl: `/webhook/pdf/${pdfResult.filename}`,
        filename: pdfResult.filename
      });

    } catch (error) {
      console.error('Invoice generation error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  },

  // Generate report PDF
  async generateReport(req, res) {
    try {
      const reportData = req.body;
      
      const pdfResult = await pdfService.generateReportPDF(reportData);
      
      res.json({
        success: true,
        message: 'Report generated successfully',
        downloadUrl: `/webhook/pdf/${pdfResult.filename}`,
        filename: pdfResult.filename
      });

    } catch (error) {
      console.error('Report generation error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  },

  // Generate PDF with custom template
  async generateCustomPDF(req, res) {
    try {
      const { data, customTemplate, filename } = req.body;
      
      if (!data || !customTemplate) {
        return res.status(400).json({ 
          success: false, 
          error: 'Data and customTemplate are required' 
        });
      }

      const pdfResult = await pdfService.generateCustomPDF(data, customTemplate, filename);
      
      res.json({
        success: true,
        message: 'Custom PDF generated successfully',
        downloadUrl: `/webhook/pdf/${pdfResult.filename}`,
        filename: pdfResult.filename
      });

    } catch (error) {
      console.error('Custom PDF generation error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  },

  // Serve generated PDF file
  async getPDF(req, res) {
    try {
      const { filename } = req.params;
      const filePath = await fileUtils.getPDFFilePath(filename);
      
      res.download(filePath, filename, (err) => {
        if (err) {
          console.error('File download error:', err);
          res.status(404).json({ 
            success: false, 
            error: 'PDF file not found' 
          });
        }
      });

    } catch (error) {
      console.error('Get PDF error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
};

module.exports = pdfController;