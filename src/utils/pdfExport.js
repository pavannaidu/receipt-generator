import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Check if running in Tauri v2
const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;

/**
 * Generate PDF from receipt data
 * @param {Object} receipt - The receipt object
 * @param {Object} businessInfo - Business information
 * @param {Function} formatCurrency - Currency formatting function
 * @param {Function} formatDate - Date formatting function
 * @param {boolean} openAfterSave - Whether to open PDF in default viewer after saving
 */
export async function exportReceiptToPDF(receipt, businessInfo, formatCurrency, formatDate, openAfterSave = false) {
  // Create a temporary container for the receipt HTML
  const container = document.createElement('div');
  container.style.cssText = 'position: fixed; left: -9999px; top: 0; width: 400px; background: white; padding: 20px; font-family: Arial, sans-serif;';

  const itemsTotal = receipt.items.reduce((sum, item) => sum + item.amount, 0);

  container.innerHTML = `
    <div style="max-width: 400px; margin: 0 auto; color: #333;">
      <div style="text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #333;">
        <div style="font-size: 32px; font-weight: 700; color: #e94560;">ba</div>
        <div style="font-size: 18px; font-weight: 500; letter-spacing: 2px;">${businessInfo.name}</div>
        ${businessInfo.address ? `<div style="font-size: 12px; color: #666;">${businessInfo.address}</div>` : ''}
        ${businessInfo.phone ? `<div style="font-size: 12px; color: #666;">Ph: ${businessInfo.phone}</div>` : ''}
        ${businessInfo.gstin ? `<div style="font-size: 12px; color: #666;">GSTIN: ${businessInfo.gstin}</div>` : ''}
        <div style="font-size: 14px; text-decoration: underline; margin-top: 10px;">ESTIMATE</div>
      </div>

      <div style="margin: 15px 0; padding: 10px 0; border-bottom: 1px dashed #ccc;">
        <div style="display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px;">
          <span><strong>To:</strong> ${receipt.customerName || 'Walk-in Customer'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px;">
          <span><strong>Bill Date:</strong> ${formatDate(receipt.date)}</span>
          <span><strong>Bill No:</strong> ${receipt.billNo}</span>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px;">
        <thead>
          <tr>
            <th style="background: #f8f8f8; padding: 10px 5px; text-align: left; border-bottom: 2px solid #333; width: 45%;">Particulars</th>
            <th style="background: #f8f8f8; padding: 10px 5px; text-align: right; border-bottom: 2px solid #333; width: 15%;">Qty</th>
            <th style="background: #f8f8f8; padding: 10px 5px; text-align: right; border-bottom: 2px solid #333; width: 20%;">Rate</th>
            <th style="background: #f8f8f8; padding: 10px 5px; text-align: right; border-bottom: 2px solid #333; width: 20%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${receipt.items.map(item => `
            <tr>
              <td style="padding: 8px 5px; border-bottom: 1px solid #eee;">${item.name}</td>
              <td style="padding: 8px 5px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.qty)}</td>
              <td style="padding: 8px 5px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.rate)}</td>
              <td style="padding: 8px 5px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.amount)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="margin-top: 20px; border-top: 2px solid #333; padding-top: 15px;">
        <div style="display: flex; justify-content: space-between; padding: 5px 0; font-size: 14px;">
          <span>Bill Total</span>
          <span>${formatCurrency(itemsTotal)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 5px 0; font-size: 14px;">
          <span>Others</span>
          <span>${formatCurrency(receipt.others || 0)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 5px 0; font-size: 14px;">
          <span>Round Off</span>
          <span>${formatCurrency(receipt.roundOff || 0)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 10px 0; font-size: 16px; font-weight: 700; border-top: 1px solid #333; margin-top: 10px;">
          <span>Net Amount</span>
          <span>₹ ${formatCurrency(receipt.total)}</span>
        </div>
      </div>

      <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #666;">
        <p>Thank you for your business!</p>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    // Convert HTML to canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });

    // Create PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);

    // Generate filename
    const dateStr = receipt.date.replace(/-/g, '');
    const filename = `Receipt-${receipt.billNo}-${dateStr}.pdf`;

    if (isTauri && openAfterSave) {
      // In Tauri: save to temp directory and open with default PDF viewer
      try {
        const { tempDir } = await import('@tauri-apps/api/path');
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        const { open } = await import('@tauri-apps/plugin-shell');

        // Get temp directory and create file path
        const tempPath = await tempDir();
        const filePath = `${tempPath}${filename}`;

        // Get PDF as array buffer
        const pdfArrayBuffer = pdf.output('arraybuffer');
        const pdfBytes = new Uint8Array(pdfArrayBuffer);

        // Write file to temp directory
        await writeFile(filePath, pdfBytes);

        // Open with default PDF viewer
        await open(filePath);
      } catch (error) {
        console.error('Error saving/opening PDF in Tauri:', error);
        // Fallback to browser download
        pdf.save(filename);
      }
    } else {
      // Browser: download PDF
      pdf.save(filename);
    }

    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    return false;
  } finally {
    // Clean up
    document.body.removeChild(container);
  }
}
