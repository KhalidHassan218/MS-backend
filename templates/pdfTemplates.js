const pdfTemplates = {

    getTemplate(templateType, data) {
      const templates = {
        default: this.defaultTemplate,
        invoice: this.invoiceTemplate,
        report: this.reportTemplate,
        minimal: this.minimalTemplate
      };
  
      const template = templates[templateType] || templates.default;
      return template(data);
    },
  
    defaultTemplate(data) {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 40px;
              line-height: 1.6;
              color: #333;
            }
            .header { 
              background: #f8f9fa; 
              padding: 30px; 
              border-radius: 8px;
              margin-bottom: 30px;
              border-left: 5px solid #007bff;
            }
            .data-section { 
              margin: 20px 0; 
            }
            .data-item { 
              margin: 10px 0; 
              padding: 10px;
              background: #f8f9fa;
              border-radius: 4px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th, td {
              border: 1px solid #dee2e6;
              padding: 12px;
              text-align: left;
            }
            th {
              background-color: #e9ecef;
              font-weight: bold;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #dee2e6;
              color: #6c757d;
              font-size: 0.9em;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Document Report</h1>
            <p>Generated on: ${new Date().toLocaleString()}</p>
          </div>
          
          ${this._renderData(data)}
          
          <div class="footer">
            <p>Generated automatically by PDF Service</p>
          </div>
        </body>
        </html>
      `;
    },
  
    invoiceTemplate(invoiceData) {
      const items = invoiceData.items || [];
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      const tax = invoiceData.taxRate ? subtotal * invoiceData.taxRate : 0;
      const total = subtotal + tax;
  
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .invoice-header { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 40px; 
            }
            .company-info, .client-info { flex: 1; }
            .invoice-details { margin: 20px 0; }
            .invoice-table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 30px 0; 
            }
            .invoice-table th, .invoice-table td { 
              border: 1px solid #ddd; 
              padding: 12px; 
              text-align: left; 
            }
            .invoice-table th { 
              background-color: #f8f9fa; 
              font-weight: bold;
            }
            .totals { 
              margin-left: auto; 
              width: 300px; 
            }
            .total-row { 
              display: flex; 
              justify-content: space-between; 
              margin: 5px 0; 
            }
            .grand-total { 
              font-size: 1.2em; 
              font-weight: bold; 
              border-top: 2px solid #333;
              padding-top: 10px;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="invoice-header">
            <div class="company-info">
              <h1>INVOICE</h1>
              <p><strong>${invoiceData.fromCompany || 'Your Company Name'}</strong></p>
              <p>${invoiceData.fromAddress || '123 Business Street, City, State 12345'}</p>
              <p>${invoiceData.fromEmail || 'email@company.com'}</p>
            </div>
            <div class="client-info">
              <p><strong>Bill To:</strong></p>
              <p>${invoiceData.toCompany || 'Client Company'}</p>
              <p>${invoiceData.toAddress || '456 Client Avenue, City, State 67890'}</p>
            </div>
          </div>
  
          <div class="invoice-details">
            <p><strong>Invoice #:</strong> ${invoiceData.invoiceNumber || 'N/A'}</p>
            <p><strong>Date:</strong> ${invoiceData.date || new Date().toLocaleDateString()}</p>
            <p><strong>Due Date:</strong> ${invoiceData.dueDate || 'Upon receipt'}</p>
          </div>
  
          <table class="invoice-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.quantity}</td>
                  <td>$${item.price.toFixed(2)}</td>
                  <td>$${(item.quantity * item.price).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
  
          <div class="totals">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>$${subtotal.toFixed(2)}</span>
            </div>
            ${invoiceData.taxRate ? `
              <div class="total-row">
                <span>Tax (${(invoiceData.taxRate * 100)}%):</span>
                <span>$${tax.toFixed(2)}</span>
              </div>
            ` : ''}
            <div class="total-row grand-total">
              <span>Total:</span>
              <span>$${total.toFixed(2)}</span>
            </div>
          </div>
        </body>
        </html>
      `;
    },
  
    reportTemplate(reportData) {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .report-header { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 40px;
              border-radius: 8px;
              margin-bottom: 30px;
            }
            .metric-grid { 
              display: grid; 
              grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
              gap: 20px; 
              margin: 30px 0; 
            }
            .metric-card { 
              background: #f8f9fa; 
              padding: 20px; 
              border-radius: 8px;
              border-left: 4px solid #007bff;
            }
            .chart-placeholder {
              background: #e9ecef;
              padding: 40px;
              text-align: center;
              border-radius: 8px;
              margin: 20px 0;
              color: #6c757d;
            }
          </style>
        </head>
        <body>
          <div class="report-header">
            <h1>${reportData.title || 'Analytics Report'}</h1>
            <p>${reportData.subtitle || 'Performance Overview'}</p>
            <p>Period: ${reportData.period || 'N/A'} | Generated: ${new Date().toLocaleString()}</p>
          </div>
  
          <div class="metric-grid">
            ${(reportData.metrics || []).map(metric => `
              <div class="metric-card">
                <h3>${metric.name}</h3>
                <p style="font-size: 2em; font-weight: bold; color: #007bff; margin: 10px 0;">
                  ${metric.value}
                </p>
                <small>${metric.description || ''}</small>
              </div>
            `).join('')}
          </div>
  
          ${reportData.summary ? `
            <div style="background: #e8f4fd; padding: 25px; border-radius: 8px; margin: 30px 0;">
              <h3>Executive Summary</h3>
              <p>${reportData.summary}</p>
            </div>
          ` : ''}
        </body>
        </html>
      `;
    },
  
    minimalTemplate(data) {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 60px;
              line-height: 1.8;
              color: #2c3e50;
            }
            .content {
              max-width: 600px;
              margin: 0 auto;
            }
          </style>
        </head>
        <body>
          <div class="content">
            ${this._renderSimpleData(data)}
          </div>
        </body>
        </html>
      `;
    },
  
    generateCustom(data, customTemplate) {
      // For custom templates, you can extend this to handle more complex scenarios
      return customTemplate.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return data[key] || match;
      });
    },
  
    _renderData(data) {
      if (Array.isArray(data)) {
        return `
          <h2>Data Items (${data.length})</h2>
          <table>
            <thead>
              <tr>
                ${Object.keys(data[0] || {}).map(key => `<th>${key}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.map(item => `
                <tr>
                  ${Object.values(item).map(value => `
                    <td>${typeof value === 'object' ? JSON.stringify(value) : value}</td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      } else if (typeof data === 'object') {
        return `
          <div class="data-section">
            ${Object.entries(data).map(([key, value]) => `
              <div class="data-item">
                <strong>${key}:</strong> 
                <span>${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}</span>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        return `<p>${data}</p>`;
      }
    },
  
    _renderSimpleData(data) {
      if (typeof data === 'object') {
        return Object.entries(data).map(([key, value]) => `
          <p><strong>${key}:</strong> ${value}</p>
        `).join('');
      }
      return `<p>${data}</p>`;
    }
  };
  
  module.exports = pdfTemplates;