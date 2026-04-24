const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generates a professional invoice PDF
 * @param {Object} order - The order object with populated product
 * @param {Object} tenant - Tenant details (name, etc.)
 * @returns {Promise<string>} - Path to the generated PDF
 */
const generateInvoice = async (order, tenantName = "ZEPOBIZ MERCHANT") => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const fileName = `Invoice_${order.orderNumber}.pdf`;
      const filePath = path.join(__dirname, '../temp', fileName);

      // Ensure temp directory exists
      if (!fs.existsSync(path.join(__dirname, '../temp'))) {
        fs.mkdirSync(path.join(__dirname, '../temp'));
      }

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // --- HEADER ---
      doc.fillColor('#444444').fontSize(20).text('ZEPOMART', 50, 50);
      doc.fontSize(10).text('Nikol, Ahmedabad, Gujarat, India', 50, 80);
      doc.text('Phone: +91 9408511651', 50, 95);
      
      doc.fontSize(25).fillColor('#3b82f6').text('INVOICE', 400, 50, { align: 'right' });
      doc.fontSize(10).fillColor('#444444').text(`Order #: ${order.orderNumber}`, 400, 85, { align: 'right' });
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 400, 100, { align: 'right' });

      doc.moveDown(4);
      doc.strokeColor('#eeeeee').lineWidth(1).moveTo(50, 130).lineTo(550, 130).stroke();

      // --- BILL TO ---
      doc.fontSize(12).text('BILL TO:', 50, 150);
      doc.fontSize(14).fillColor('#000000').text(order.customerName || 'Valued Customer', 50, 170);
      doc.fontSize(10).fillColor('#444444').text(order.address || 'N/A', 50, 190, { width: 250 });
      doc.text(`Phone: ${order.customer}`, 50, 220);

      doc.moveDown(4);

      // --- TABLE HEADER ---
      const tableTop = 270;
      doc.fillColor('#f8fafc').rect(50, tableTop, 500, 25).fill();
      doc.fillColor('#475569').fontSize(10).font('Helvetica-Bold');
      doc.text('ITEM DESCRIPTION', 60, tableTop + 8);
      doc.text('QTY', 300, tableTop + 8);
      doc.text('PRICE', 380, tableTop + 8);
      doc.text('TOTAL', 480, tableTop + 8, { align: 'right' });

      // --- TABLE ROWS ---
      let y = tableTop + 35;
      doc.font('Helvetica').fillColor('#000000');
      
      const itemTotal = (order.price || 0) * (order.quantity || 0);
      doc.text(order.product?.name || 'Product', 60, y);
      doc.text(order.quantity.toString(), 300, y);
      doc.text(`₹${order.price}`, 380, y);
      doc.text(`₹${itemTotal}`, 480, y, { align: 'right' });

      // --- SUMMARY ---
      const summaryY = y + 50;
      doc.strokeColor('#eeeeee').lineWidth(1).moveTo(300, summaryY).lineTo(550, summaryY).stroke();
      
      doc.fontSize(12).font('Helvetica-Bold').text('GRAND TOTAL:', 300, summaryY + 20);
      doc.fontSize(16).fillColor('#3b82f6').text(`₹${itemTotal}`, 480, summaryY + 18, { align: 'right' });

      // --- FOOTER ---
      doc.fontSize(10).fillColor('#94a3b8').text('This is a computer-generated invoice. No signature required.', 50, 700, { align: 'center' });
      doc.text('Thank you for your business!', 50, 715, { align: 'center' });

      doc.end();
      stream.on('finish', () => resolve(filePath));
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generateInvoice };
