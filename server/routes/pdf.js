import express from 'express';
import PDFDocument from 'pdfkit';
import { db } from '../database/init.js';
import { renderWhyChooseUs } from './pdf_helpers.js';

import { authenticateToken, requireCompany } from '../middleware/auth.js';

const router = express.Router();


// Helper to format currency (using Rs. for PDF compatibility - ₹ symbol not supported in Helvetica)
function formatCurrency(amount) {
    const formatted = new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount || 0);
    return `Rs. ${formatted}`;
}

// Helper to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

// Generate Quotation PDF
router.get('/quotation/:id', authenticateToken, requireCompany, async (req, res) => {
    try {
        const [quotations] = await db.execute(`
      SELECT q.*, c.name as client_name, c.address as client_address, 
             c.phone as client_phone, c.project_location,
             comp.name as company_name, comp.address as company_address,
             comp.phone as company_phone, comp.gst_number, comp.bank_details
      FROM quotations q
      LEFT JOIN clients c ON q.client_id = c.id
      LEFT JOIN companies comp ON q.company_id = comp.id
      WHERE q.id = ? AND q.company_id = ?
    `, [req.params.id, req.user.companyId]);

        const quotation = quotations[0];

        if (!quotation) {
            return res.status(404).json({ error: 'Quotation not found' });
        }

        const [items] = await db.execute(`
      SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order
    `, [req.params.id]);

        // Create PDF
        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Quotation-${quotation.quotation_number.replace(/\//g, '-')}.pdf"`);

        doc.pipe(res);

        // Header - Company Branding
        doc.rect(50, 40, 500, 60).fill('#1e3a5f'); // Dark blue header bar
        doc.fillColor('#ffffff');
        doc.fontSize(22).font('Helvetica-Bold').text(quotation.company_name, 50, 52, { width: 500, align: 'center' });
        doc.fontSize(9).font('Helvetica').text(quotation.company_address, 50, 78, { width: 500, align: 'center' });
        doc.text(`Phone: ${quotation.company_phone} | GST: ${quotation.gst_number}`, 50, 90, { width: 500, align: 'center' });

        doc.y = 115;

        // Quotation Title Badge
        doc.roundedRect(220, doc.y, 160, 30, 5).fill('#c0392b'); // Accent red badge
        doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold');
        doc.text('QUOTATION', 220, doc.y + 8, { width: 160, align: 'center' });
        doc.y += 45;

        // Quotation Meta - Clean layout
        doc.fillColor('#333333').fontSize(10).font('Helvetica');
        const metaY = doc.y;
        doc.roundedRect(50, metaY, 240, 28, 4).fill('#f8f9fa');
        doc.roundedRect(310, metaY, 240, 28, 4).fill('#f8f9fa');
        doc.fillColor('#666666').fontSize(9);
        doc.text('Quotation No:', 60, metaY + 5);
        doc.text('Date:', 320, metaY + 5);
        doc.fillColor('#1e3a5f').fontSize(11).font('Helvetica-Bold');
        doc.text(quotation.quotation_number, 60, metaY + 15);
        doc.text(formatDate(quotation.date), 320, metaY + 15);
        doc.y = metaY + 38;

        // Client Details Box - Modern card style
        doc.roundedRect(50, doc.y, 500, 75, 6).lineWidth(1).stroke('#ddd');
        const clientBoxY = doc.y + 8;
        doc.fillColor('#c0392b').fontSize(10).font('Helvetica-Bold').text('BILL TO', 60, clientBoxY);
        doc.fillColor('#1e3a5f').fontSize(12).font('Helvetica-Bold').text(quotation.client_name, 60, clientBoxY + 14);
        doc.fillColor('#555555').fontSize(9).font('Helvetica');
        doc.text(quotation.client_address || '', 60, clientBoxY + 30);
        doc.text(`📞 ${quotation.client_phone || 'N/A'}`, 60, clientBoxY + 48);

        doc.fillColor('#666666').fontSize(9).font('Helvetica');
        doc.text('📍 Project Location:', 300, clientBoxY + 14);
        doc.fillColor('#333333').font('Helvetica-Bold').text(quotation.project_location || 'N/A', 300, clientBoxY + 26);
        doc.fillColor('#666666').font('Helvetica').text(`Area: ${quotation.total_sqft || 'N/A'} sqft`, 300, clientBoxY + 42);
        doc.text(`Rate: ${formatCurrency(quotation.rate_per_sqft)}/sqft`, 300, clientBoxY + 54);

        doc.y = clientBoxY + 85;

        // Insert "Why Choose Us" Page as Page 2
        renderWhyChooseUs(doc, quotation);
        doc.addPage();
        doc.y = 50;

        // Group Items by Room
        const groupedItems = {};
        items.forEach(item => {
            const room = item.room_label || 'General';
            if (!groupedItems[room]) groupedItems[room] = [];
            groupedItems[room].push(item);
        });

        let yPos = 50;

        const isSqFtBased = quotation.rate_per_sqft > 0;
        let colWidths, tableHeaders;

        if (isSqFtBased) {
            colWidths = [30, 380, 50, 40]; // Total 500
            tableHeaders = ['#', 'Description', 'Unit', 'Qty'];
        } else {
            colWidths = [30, 270, 50, 40, 50, 60]; // Total 500
            tableHeaders = ['#', 'Description', 'Unit', 'Qty', 'MM', 'Rate'];
        }

        Object.keys(groupedItems).forEach(room => {
            const roomItems = groupedItems[room];
            let groupTotal = 0;

            // Pre-calculate height to prevent splitting
            doc.font('Helvetica').fontSize(9); // Set font for accurate calculation
            let sectionHeight = 60; // Title(20) + Header(20) + Footer(20)

            roomItems.forEach(item => {
                const descWidth = colWidths[1] - 10;
                const descHeight = doc.heightOfString(item.item_name || '', { width: descWidth });
                sectionHeight += Math.max(20, descHeight + 8);
            });

            const fitsOnSinglePage = sectionHeight < 680;
            const hasSpaceOnCurrent = (yPos + sectionHeight) < 750;

            // Decision: Move to next page if it fits there nicely, OR if we are forced to split but starting too low
            if ((fitsOnSinglePage && !hasSpaceOnCurrent) || (!fitsOnSinglePage && yPos > 600)) {
                doc.addPage();
                yPos = 50;
            }

            // Room Title - Section header with accent
            doc.rect(50, yPos, 4, 18).fill('#c0392b'); // Left accent bar
            doc.fillColor('#1e3a5f').font('Helvetica-Bold').fontSize(11);
            doc.text(room.toUpperCase(), 60, yPos + 3);
            yPos += 26;

            // Table Header - Dark blue header
            let xPos = 50;
            doc.roundedRect(50, yPos, 500, 22, 3).fill('#1e3a5f');
            doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
            tableHeaders.forEach((h, i) => {
                doc.text(h, xPos + 5, yPos + 7, { width: colWidths[i] - 10, align: i >= 3 ? 'right' : 'left' });
                xPos += colWidths[i];
            });
            yPos += 22;

            // Items Check loop (inner page breaks still needed for LARGE tables)

            // Items
            doc.font('Helvetica');
            roomItems.forEach((item, index) => {
                const descWidth = colWidths[1] - 10;
                const descHeight = doc.heightOfString(item.item_name || '', { width: descWidth });
                const rowHeight = Math.max(20, descHeight + 8); // Reduced padding +8

                if (yPos + rowHeight > 750) {
                    doc.addPage();
                    yPos = 50;
                }

                const rowColor = index % 2 === 0 ? '#f2f2f2' : '#ffffff';
                doc.rect(50, yPos, 500, rowHeight).fill(rowColor);
                doc.fillColor('#000000');

                xPos = 50;
                // Vertically center text if height is 20, else top align with padding
                const textY = yPos + 6;

                doc.text((index + 1).toString(), xPos + 5, textY, { width: colWidths[0] - 10 });
                xPos += colWidths[0];

                doc.text(item.item_name || '', xPos + 5, textY, { width: descWidth });
                xPos += colWidths[1];

                doc.text(item.unit || '', xPos + 5, textY, { width: colWidths[2] - 10 });
                xPos += colWidths[2];
                doc.text((item.quantity || 0).toString(), xPos + 5, textY, { width: colWidths[3] - 10, align: 'right' });

                if (!isSqFtBased) {
                    xPos += colWidths[3];
                    doc.text(item.material || '', xPos + 5, textY, { width: colWidths[4] - 10, align: 'center' });
                    xPos += colWidths[4];
                    doc.text(formatCurrency(item.rate), xPos + 5, textY, { width: colWidths[5] - 10, align: 'right' });
                }

                groupTotal += parseFloat(item.amount) || 0;
                yPos += rowHeight;
            });

            // Component Total (Only for Item/Package based, not SqFt based)
            if (!isSqFtBased) {
                doc.rect(50, yPos, 500, 20).stroke();
                doc.font('Helvetica-Bold').fillColor('#000000');
                doc.text('Component Total', 50, yPos + 6, { width: 410, align: 'right' });
                doc.text(formatCurrency(groupTotal), 460, yPos + 6, { width: 90, align: 'right' });
                yPos += 30;
            } else {
                yPos += 10; // Simple gap for SqFt based
            }
        });

        // Summary - Modern card style
        if (yPos > 650) {
            doc.addPage();
            yPos = 50;
        }
        yPos += 15;

        // Summary Box with header
        doc.roundedRect(330, yPos, 220, 115, 6).lineWidth(1).stroke('#ddd');
        doc.roundedRect(330, yPos, 220, 22, 6).fill('#1e3a5f');
        doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold');
        doc.text('SUMMARY', 330, yPos + 6, { width: 220, align: 'center' });

        const summaryX = 345;
        const summaryStartY = yPos + 28;
        doc.fillColor('#555555').fontSize(9).font('Helvetica');

        doc.text('Subtotal:', summaryX, summaryStartY);
        doc.text(formatCurrency(quotation.subtotal), 470, summaryStartY, { align: 'right', width: 70 });

        if (quotation.discount_amount > 0) {
            doc.fillColor('#10b981');
            doc.text(`Discount (${quotation.discount_type === 'percentage' ? quotation.discount_value + '%' : 'Flat'}):`, summaryX, summaryStartY + 13);
            doc.text(`-${formatCurrency(quotation.discount_amount)}`, 470, summaryStartY + 13, { align: 'right', width: 70 });
            doc.fillColor('#555555');
        }

        doc.text('Taxable Amount:', summaryX, summaryStartY + 26);
        doc.text(formatCurrency(quotation.taxable_amount), 470, summaryStartY + 26, { align: 'right', width: 70 });

        doc.text(`CGST (${quotation.cgst_percent}%):`, summaryX, summaryStartY + 39);
        doc.text(formatCurrency(quotation.cgst_amount), 470, summaryStartY + 39, { align: 'right', width: 70 });

        doc.text(`SGST (${quotation.sgst_percent}%):`, summaryX, summaryStartY + 52);
        doc.text(formatCurrency(quotation.sgst_amount), 470, summaryStartY + 52, { align: 'right', width: 70 });

        // Grand Total highlight
        doc.roundedRect(335, yPos + 88, 210, 22, 4).fill('#c0392b');
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11);
        doc.text('Grand Total:', 345, yPos + 93);
        doc.text(formatCurrency(quotation.grand_total), 470, yPos + 93, { align: 'right', width: 70 });

        yPos += 130; // Move past Summary Box

        // Payment Plan & Milestone
        if (quotation.payment_plan) {
            yPos += 15;
            doc.rect(50, yPos, 4, 16).fill('#c0392b'); // Left accent bar
            doc.fillColor('#1e3a5f').font('Helvetica-Bold').fontSize(11);
            doc.text('Payment Plan & Milestones', 60, yPos + 2);
            yPos += 22;

            let isJson = false;
            let planItems = [];
            try {
                planItems = JSON.parse(quotation.payment_plan);
                if (Array.isArray(planItems)) isJson = true;
            } catch (e) { }

            if (isJson) {
                // Table Config
                const colX = [50, 350, 430];
                const colWidths = [300, 80, 120];
                const rowHeight = 25;

                // Header
                doc.rect(50, yPos, 500, rowHeight).stroke();
                doc.font('Helvetica').fontSize(10);

                doc.text('Milestone', colX[0], yPos + 8, { width: colWidths[0], align: 'center' });
                doc.text('Percent', colX[1], yPos + 8, { width: colWidths[1], align: 'center' });
                doc.text('Amount', colX[2], yPos + 8, { width: colWidths[2] - 5, align: 'center' });

                // Vertical lines Header
                doc.moveTo(colX[1], yPos).lineTo(colX[1], yPos + rowHeight).stroke();
                doc.moveTo(colX[2], yPos).lineTo(colX[2], yPos + rowHeight).stroke();

                yPos += rowHeight;

                // Rows
                doc.font('Helvetica').fontSize(9);
                planItems.forEach(item => {
                    if (yPos > 750) { doc.addPage(); yPos = 50; }
                    doc.rect(50, yPos, 500, rowHeight).stroke();

                    doc.text(item.stage || '', colX[0] + 5, yPos + 8, { width: colWidths[0] - 10, align: 'left' });
                    doc.text((item.percent || 0), colX[1], yPos + 8, { width: colWidths[1], align: 'center' });
                    doc.text(formatCurrency(item.amount), colX[2], yPos + 8, { width: colWidths[2] - 5, align: 'center' });

                    // Vertical lines Row
                    doc.moveTo(colX[1], yPos).lineTo(colX[1], yPos + rowHeight).stroke();
                    doc.moveTo(colX[2], yPos).lineTo(colX[2], yPos + rowHeight).stroke();

                    yPos += rowHeight;
                });
                yPos += 20;
            } else {
                doc.font('Helvetica').fontSize(9).text(quotation.payment_plan, 50, yPos, { width: 500 });
                yPos += doc.heightOfString(quotation.payment_plan, { width: 500 }) + 30;
            }
        } else {
            yPos += 50;
        }

        // Terms & Conditions Of Company
        if (quotation.terms_conditions) {
            doc.font('Helvetica-Bold').fontSize(11).text('Terms & Conditions Of Company', 50, yPos);
            yPos += 15;
            doc.font('Helvetica').fontSize(9).text(quotation.terms_conditions, 50, yPos, { width: 500 });
            yPos += doc.heightOfString(quotation.terms_conditions, { width: 500 }) + 30;
        }

        // Bank Account Details Of Company
        if (quotation.bank_details) {
            doc.font('Helvetica-Bold').fontSize(11).text('Bank Account Details Of Company', 50, yPos);
            doc.font('Helvetica').fontSize(8).text(quotation.bank_details, 50, yPos + 15, { width: 500 });
        }

        // Footer
        doc.fontSize(8).text('This is a computer generated quotation.', 50, 780, { align: 'center' });

        doc.end();
    } catch (error) {
        console.error('Generate quotation PDF error:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

// Generate Receipt PDF
router.get('/receipt/:id', authenticateToken, requireCompany, async (req, res) => {
    try {
        const [receipts] = await db.execute(`
      SELECT r.*, q.quotation_number, q.grand_total as total_amount,
             c.name as client_name, c.address as client_address, c.phone as client_phone,
             comp.name as company_name, comp.address as company_address,
             comp.phone as company_phone, comp.gst_number
      FROM receipts r
      LEFT JOIN quotations q ON r.quotation_id = q.id
      LEFT JOIN clients c ON q.client_id = c.id
      LEFT JOIN companies comp ON r.company_id = comp.id
      WHERE r.id = ? AND r.company_id = ?
    `, [req.params.id, req.user.companyId]);

        const receipt = receipts[0];

        if (!receipt) {
            return res.status(404).json({ error: 'Receipt not found' });
        }

        // Get total paid for balance calculation
        const [totalPaid] = await db.execute(`
      SELECT SUM(amount) as total FROM receipts WHERE quotation_id = ?
    `, [receipt.quotation_id]);

        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Receipt-${receipt.receipt_number.replace(/\//g, '-')}.pdf"`);

        doc.pipe(res);

        // Header
        doc.fontSize(20).font('Helvetica-Bold').text(receipt.company_name, { align: 'center' });
        doc.fontSize(10).font('Helvetica').text(receipt.company_address, { align: 'center' });
        doc.text(`Phone: ${receipt.company_phone} | GST: ${receipt.gst_number}`, { align: 'center' });
        doc.moveDown();

        // Receipt Title
        doc.fontSize(16).font('Helvetica-Bold').text('PAYMENT RECEIPT', { align: 'center' });
        doc.moveDown();

        // Receipt Details Box
        doc.rect(50, doc.y, 500, 150).stroke();
        const boxY = doc.y + 15;

        doc.fontSize(10).font('Helvetica-Bold');
        doc.text(`Receipt No: ${receipt.receipt_number}`, 60, boxY);
        doc.text(`Date: ${formatDate(receipt.date)}`, 400, boxY);

        doc.moveDown();
        doc.font('Helvetica');
        doc.text('Received From:', 60, boxY + 30);
        doc.font('Helvetica-Bold').text(receipt.client_name, 150, boxY + 30);

        doc.font('Helvetica');
        doc.text('Address:', 60, boxY + 50);
        doc.text(receipt.client_address || 'N/A', 150, boxY + 50);

        doc.text('Phone:', 60, boxY + 70);
        doc.text(receipt.client_phone || 'N/A', 150, boxY + 70);

        doc.text('Quotation Ref:', 60, boxY + 90);
        doc.text(receipt.quotation_number, 150, boxY + 90);

        doc.text('Payment Mode:', 60, boxY + 110);
        doc.text(receipt.payment_mode, 150, boxY + 110);

        if (receipt.transaction_reference) {
            doc.text('Transaction Ref:', 300, boxY + 110);
            doc.text(receipt.transaction_reference, 400, boxY + 110);
        }

        doc.y = boxY + 180;

        // Amount Box
        doc.rect(150, doc.y, 300, 60).fill('#333333');
        doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold');
        doc.text('Amount Received', 200, doc.y + 15, { width: 200, align: 'center' });
        doc.fontSize(20).text(formatCurrency(receipt.amount), 200, doc.y + 35, { width: 200, align: 'center' });

        doc.fillColor('#000000');
        doc.y += 80;

        // Summary
        doc.fontSize(10).font('Helvetica');
        doc.text(`Total Quotation Amount: ${formatCurrency(receipt.total_amount)}`, 60);
        doc.text(`Total Amount Paid: ${formatCurrency(totalPaid[0].total)}`, 60);
        doc.text(`Balance Due: ${formatCurrency(receipt.total_amount - totalPaid[0].total)}`, 60);

        // Notes
        if (receipt.notes) {
            doc.moveDown();
            doc.text(`Notes: ${receipt.notes}`);
        }

        // Signature
        doc.y = 650;
        doc.text('____________________', 400);
        doc.text('Authorized Signature', 400);

        // Footer
        doc.fontSize(8).text('This is a computer generated receipt.', 50, 780, { align: 'center' });

        doc.end();
    } catch (error) {
        console.error('Generate receipt PDF error:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

// Generate Bill/Invoice PDF
router.get('/bill/:id', authenticateToken, requireCompany, async (req, res) => {
    try {
        const [bills] = await db.execute(`
      SELECT b.*, q.quotation_number, q.total_sqft, q.rate_per_sqft, q.bedroom_count,
             c.name as client_name, c.address as client_address, 
             c.phone as client_phone, c.project_location,
             comp.name as company_name, comp.address as company_address,
             comp.phone as company_phone, comp.gst_number
      FROM bills b
      LEFT JOIN quotations q ON b.quotation_id = q.id
      LEFT JOIN clients c ON q.client_id = c.id
      LEFT JOIN companies comp ON b.company_id = comp.id
      WHERE b.id = ? AND b.company_id = ?
    `, [req.params.id, req.user.companyId]);

        const bill = bills[0];

        if (!bill) {
            return res.status(404).json({ error: 'Bill not found' });
        }

        const [items] = await db.execute(`
      SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order
    `, [bill.quotation_id]);

        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Invoice-${bill.bill_number.replace(/\//g, '-')}.pdf"`);

        doc.pipe(res);

        // Header
        doc.fontSize(20).font('Helvetica-Bold').text(bill.company_name, { align: 'center' });
        doc.fontSize(10).font('Helvetica').text(bill.company_address, { align: 'center' });
        doc.text(`Phone: ${bill.company_phone} | GST: ${bill.gst_number}`, { align: 'center' });
        doc.moveDown();

        // Invoice Title
        doc.fontSize(16).font('Helvetica-Bold').text('TAX INVOICE', { align: 'center' });
        doc.moveDown(0.5);

        // Invoice Details
        doc.fontSize(10).font('Helvetica');
        const startY = doc.y;

        doc.text(`Invoice No: ${bill.bill_number}`, 50, startY);
        doc.text(`Date: ${formatDate(bill.date)}`, 400, startY);
        doc.text(`Quotation Ref: ${bill.quotation_number}`, 50, startY + 15);
        doc.moveDown();

        // Client Details Box
        doc.rect(50, doc.y, 500, 60).stroke();
        const clientBoxY = doc.y + 10;
        doc.text('Bill To:', 60, clientBoxY);
        doc.font('Helvetica-Bold').text(bill.client_name, 60, clientBoxY + 15);
        doc.font('Helvetica').text(bill.client_address || '', 60, clientBoxY + 30);
        doc.text(`Phone: ${bill.client_phone || 'N/A'}`, 300, clientBoxY + 15);
        doc.text(`Project: ${bill.project_location || 'N/A'}`, 300, clientBoxY + 30);

        doc.y = clientBoxY + 70;

        // Items Table
        const tableTop = doc.y;
        const tableHeaders = ['#', 'Description', 'Room', 'Qty', 'Rate', 'Amount'];
        const colWidths = [30, 180, 80, 50, 70, 90];
        let xPos = 50;

        doc.rect(50, tableTop, 500, 20).fill('#333333');
        doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');

        tableHeaders.forEach((header, i) => {
            doc.text(header, xPos + 5, tableTop + 6, { width: colWidths[i] - 10 });
            xPos += colWidths[i];
        });

        doc.fillColor('#000000').font('Helvetica');

        let yPos = tableTop + 25;
        items.forEach((item, index) => {
            if (yPos > 650) {
                doc.addPage();
                yPos = 50;
            }

            xPos = 50;
            const rowColor = index % 2 === 0 ? '#f2f2f2' : '#ffffff';
            doc.rect(50, yPos - 5, 500, 20).fill(rowColor);
            doc.fillColor('#000000');

            doc.text((index + 1).toString(), xPos + 5, yPos, { width: colWidths[0] - 10 });
            xPos += colWidths[0];
            doc.text(item.item_name, xPos + 5, yPos, { width: colWidths[1] - 10 });
            xPos += colWidths[1];
            doc.text(item.room_label || '-', xPos + 5, yPos, { width: colWidths[2] - 10 });
            xPos += colWidths[2];
            doc.text((item.quantity || 1).toString(), xPos + 5, yPos, { width: colWidths[3] - 10 });
            xPos += colWidths[3];
            doc.text(formatCurrency(item.rate), xPos + 5, yPos, { width: colWidths[4] - 10 });
            xPos += colWidths[4];
            doc.text(formatCurrency(item.amount), xPos + 5, yPos, { width: colWidths[5] - 10 });

            yPos += 20;
        });

        // Summary
        yPos += 10;
        doc.rect(350, yPos, 200, 120).stroke();

        const summaryX = 360;
        doc.fontSize(9);
        doc.text('Subtotal:', summaryX, yPos + 10);
        doc.text(formatCurrency(bill.subtotal), 470, yPos + 10, { align: 'right', width: 70 });

        doc.text(`CGST (${bill.cgst_percent}%):`, summaryX, yPos + 25);
        doc.text(formatCurrency(bill.cgst_amount), 470, yPos + 25, { align: 'right', width: 70 });

        doc.text(`SGST (${bill.sgst_percent}%):`, summaryX, yPos + 40);
        doc.text(formatCurrency(bill.sgst_amount), 470, yPos + 40, { align: 'right', width: 70 });

        doc.font('Helvetica-Bold');
        doc.text('Grand Total:', summaryX, yPos + 60);
        doc.text(formatCurrency(bill.grand_total), 470, yPos + 60, { align: 'right', width: 70 });

        doc.font('Helvetica');
        doc.text('Amount Paid:', summaryX, yPos + 80);
        doc.text(formatCurrency(bill.paid_amount), 470, yPos + 80, { align: 'right', width: 70 });

        doc.font('Helvetica-Bold');
        doc.text('Balance Due:', summaryX, yPos + 100);
        doc.text(formatCurrency(bill.balance_amount), 470, yPos + 100, { align: 'right', width: 70 });

        // Payment Status
        const statusColors = { paid: '#333333', partial: '#666666', pending: '#999999' };
        const statusColor = statusColors[bill.status] || '#cccccc';
        doc.rect(50, yPos + 20, 80, 25).fill(statusColor);
        doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold');
        doc.text(bill.status.toUpperCase(), 55, yPos + 28);

        // Footer
        doc.fillColor('#000000');
        doc.fontSize(8).text('This is a computer generated invoice.', 50, 780, { align: 'center' });

        doc.end();
    } catch (error) {
        console.error('Generate bill PDF error:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

// WhatsApp share URL generator
router.get('/whatsapp/:type/:id', authenticateToken, requireCompany, async (req, res) => {
    try {
        const { type, id } = req.params;
        let message = '';
        let document = null;

        if (type === 'quotation') {
            const [docs] = await db.execute(`
        SELECT q.quotation_number, q.grand_total, c.name as client_name, c.phone
        FROM quotations q
        LEFT JOIN clients c ON q.client_id = c.id
        WHERE q.id = ? AND q.company_id = ?
      `, [id, req.user.companyId]);
            document = docs[0];

            if (document) {
                message = `Dear ${document.client_name},\n\nPlease find your quotation:\n\nQuotation No: ${document.quotation_number}\nTotal Amount: ${formatCurrency(document.grand_total)}\n\nThank you for your business!\n\n- ${req.user.companyName}`;
            }
        } else if (type === 'receipt') {
            const [docs] = await db.execute(`
        SELECT r.receipt_number, r.amount, c.name as client_name, c.phone
        FROM receipts r
        LEFT JOIN quotations q ON r.quotation_id = q.id
        LEFT JOIN clients c ON q.client_id = c.id
        WHERE r.id = ? AND r.company_id = ?
      `, [id, req.user.companyId]);
            document = docs[0];

            if (document) {
                message = `Dear ${document.client_name},\n\nPayment Received:\n\nReceipt No: ${document.receipt_number}\nAmount: ${formatCurrency(document.amount)}\n\nThank you!\n\n- ${req.user.companyName}`;
            }
        } else if (type === 'bill') {
            const [docs] = await db.execute(`
        SELECT b.bill_number, b.grand_total, b.balance_amount, c.name as client_name, c.phone
        FROM bills b
        LEFT JOIN quotations q ON b.quotation_id = q.id
        LEFT JOIN clients c ON q.client_id = c.id
        WHERE b.id = ? AND b.company_id = ?
      `, [id, req.user.companyId]);
            document = docs[0];

            if (document) {
                message = `Dear ${document.client_name},\n\nInvoice Details:\n\nInvoice No: ${document.bill_number}\nTotal: ${formatCurrency(document.grand_total)}\nBalance Due: ${formatCurrency(document.balance_amount)}\n\nThank you!\n\n- ${req.user.companyName}`;
            }
        }

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const phone = document.phone ? document.phone.replace(/[^0-9]/g, '') : '';
        const whatsappUrl = `https://wa.me/${phone.startsWith('91') ? phone : '91' + phone}?text=${encodeURIComponent(message)}`;

        res.json({
            whatsappUrl,
            message,
            phone: document.phone
        });
    } catch (error) {
        console.error('WhatsApp share error:', error);
        res.status(500).json({ error: 'Failed to generate WhatsApp link' });
    }
});

export default router;
