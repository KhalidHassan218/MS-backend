const fs = require('fs').promises;
const path = require('path');

const fileUtils = {

  // Ensure PDFs directory exists
  async ensurePDFsDirectory() {
    const pdfsDir = path.join(__dirname, '../pdfs');
    try {
      await fs.access(pdfsDir);
    } catch {
      await fs.mkdir(pdfsDir, { recursive: true });
    }
    return pdfsDir;
  },

  // Save PDF buffer to file
  async savePDF(pdfBuffer, filename) {
    try {
      const pdfsDir = await this.ensurePDFsDirectory();
      const filePath = path.join(pdfsDir, filename);
      
      await fs.writeFile(filePath, pdfBuffer);
      console.log(`PDF saved: ${filePath}`);
      
      return filePath;
    } catch (error) {
      throw new Error(`Failed to save PDF: ${error.message}`);
    }
  },

  // Get PDF file path
  async getPDFFilePath(filename) {
    const pdfsDir = await this.ensurePDFsDirectory();
    const filePath = path.join(pdfsDir, filename);
    
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      throw new Error(`PDF file not found: ${filename}`);
    }
  },

  // List all generated PDFs
  async listPDFs() {
    try {
      const pdfsDir = await this.ensurePDFsDirectory();
      const files = await fs.readdir(pdfsDir);
      return files.filter(file => file.endsWith('.pdf'));
    } catch (error) {
      throw new Error(`Failed to list PDFs: ${error.message}`);
    }
  },

  // Delete PDF file
  async deletePDF(filename) {
    try {
      const filePath = await this.getPDFFilePath(filename);
      await fs.unlink(filePath);
      console.log(`PDF deleted: ${filename}`);
      return true;
    } catch (error) {
      throw new Error(`Failed to delete PDF: ${error.message}`);
    }
  }
};

export default fileUtils;