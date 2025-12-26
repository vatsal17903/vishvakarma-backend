import express from 'express';
import { db } from '../database/init.js';

import { authenticateToken, requireCompany } from '../middleware/auth.js';

const router = express.Router();

// Generate bill number
async function generateBillNumber(companyCode) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    const [rows] = await db.execute(`
    SELECT bill_number FROM bills 
    WHERE bill_number LIKE ? 
    ORDER BY id DESC LIMIT 1
  `, [`INV/${companyCode}/${year}${month}%`]);
    const lastBill = rows[0];

    let sequence = 1;
    if (lastBill) {
        const parts = lastBill.bill_number.split('/');
        sequence = parseInt(parts[parts.length - 1]) + 1;
    }

    return `INV/${companyCode}/${year}${month}/${sequence.toString().padStart(4, '0')}`;
}

// Get all bills for current company
router.get('/', authenticateToken, requireCompany, async (req, res) => {
    try {
        const [bills] = await db.execute(`
      SELECT b.*, q.quotation_number, c.name as client_name
      FROM bills b
      LEFT JOIN quotations q ON b.quotation_id = q.id
      LEFT JOIN clients c ON q.client_id = c.id
      WHERE b.company_id = ?
      ORDER BY b.created_at DESC
    `, [req.user.companyId]);
        res.json(bills);
    } catch (error) {
        console.error('Get bills error:', error);
        res.status(500).json({ error: 'Failed to fetch bills' });
    }
});

// Get recent bills
router.get('/recent', authenticateToken, requireCompany, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        const [bills] = await db.execute(`
      SELECT b.*, q.quotation_number, c.name as client_name
      FROM bills b
      LEFT JOIN quotations q ON b.quotation_id = q.id
      LEFT JOIN clients c ON q.client_id = c.id
      WHERE b.company_id = ?
      ORDER BY b.created_at DESC
      LIMIT ?
    `, [req.user.companyId, limit]);
        res.json(bills);
    } catch (error) {
        console.error('Get recent bills error:', error);
        res.status(500).json({ error: 'Failed to fetch recent bills' });
    }
});

// Get single bill
router.get('/:id', authenticateToken, requireCompany, async (req, res) => {
    try {
        const [bills] = await db.execute(`
      SELECT b.*, q.quotation_number, q.total_sqft, q.rate_per_sqft, q.bedroom_count, q.bedroom_config,
             c.name as client_name, c.address as client_address, c.phone as client_phone, c.project_location
      FROM bills b
      LEFT JOIN quotations q ON b.quotation_id = q.id
      LEFT JOIN clients c ON q.client_id = c.id
      WHERE b.id = ? AND b.company_id = ?
    `, [req.params.id, req.user.companyId]);

        const bill = bills[0];

        if (!bill) {
            return res.status(404).json({ error: 'Bill not found' });
        }

        // Get quotation items
        const [items] = await db.execute(`
      SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order
    `, [bill.quotation_id]);

        // Get receipts
        const [receipts] = await db.execute(`
      SELECT * FROM receipts WHERE quotation_id = ? ORDER BY date
    `, [bill.quotation_id]);

        res.json({ ...bill, items, receipts });
    } catch (error) {
        console.error('Get bill error:', error);
        res.status(500).json({ error: 'Failed to fetch bill' });
    }
});

// Create bill from quotation
router.post('/', authenticateToken, requireCompany, async (req, res) => {
    try {
        const { quotation_id, date, notes } = req.body;

        // Check if bill already exists for quotation
        const [existingBills] = await db.execute('SELECT * FROM bills WHERE quotation_id = ?', [quotation_id]);
        if (existingBills.length > 0) {
            return res.status(400).json({ error: 'Bill already exists for this quotation' });
        }

        // Get quotation
        const [quotations] = await db.execute(`
      SELECT * FROM quotations WHERE id = ? AND company_id = ?
    `, [quotation_id, req.user.companyId]);

        const quotation = quotations[0];

        if (!quotation) {
            return res.status(404).json({ error: 'Quotation not found' });
        }

        // Calculate paid amount from receipts
        const [receiptTokens] = await db.execute('SELECT SUM(amount) as total FROM receipts WHERE quotation_id = ?', [quotation_id]);
        const paid_amount = receiptTokens[0].total || 0;
        const balance_amount = quotation.grand_total - paid_amount;

        let status = 'pending';
        if (balance_amount <= 0) {
            status = 'paid';
        } else if (paid_amount > 0) {
            status = 'partial';
        }

        // Generate bill number
        const bill_number = await generateBillNumber(req.user.companyCode);

        const [result] = await db.execute(`
      INSERT INTO bills (
        company_id, quotation_id, bill_number, date, subtotal,
        cgst_percent, cgst_amount, sgst_percent, sgst_amount, total_tax,
        grand_total, paid_amount, balance_amount, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            req.user.companyId, quotation_id, bill_number, date || new Date().toISOString().split('T')[0],
            quotation.taxable_amount, quotation.cgst_percent, quotation.cgst_amount,
            quotation.sgst_percent, quotation.sgst_amount, quotation.total_tax,
            quotation.grand_total, paid_amount, balance_amount, status, notes
        ]);

        // Update quotation status
        await db.execute('UPDATE quotations SET status = ? WHERE id = ?', ['billed', quotation_id]);

        const [newBills] = await db.execute('SELECT * FROM bills WHERE id = ?', [result.insertId]);
        res.status(201).json(newBills[0]);
    } catch (error) {
        console.error('Create bill error:', error);
        res.status(500).json({ error: 'Failed to create bill' });
    }
});

// Update bill
router.put('/:id', authenticateToken, requireCompany, async (req, res) => {
    try {
        const { date, notes } = req.body;

        await db.execute(`
      UPDATE bills SET date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND company_id = ?
    `, [date, notes, req.params.id, req.user.companyId]);

        const [bills] = await db.execute('SELECT * FROM bills WHERE id = ?', [req.params.id]);
        res.json(bills[0]);
    } catch (error) {
        console.error('Update bill error:', error);
        res.status(500).json({ error: 'Failed to update bill' });
    }
});

// Delete bill
router.delete('/:id', authenticateToken, requireCompany, async (req, res) => {
    try {
        const [bills] = await db.execute('SELECT * FROM bills WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
        const bill = bills[0];

        if (!bill) {
            return res.status(404).json({ error: 'Bill not found' });
        }

        await db.execute('DELETE FROM bills WHERE id = ?', [req.params.id]);

        // Update quotation status back to confirmed
        await db.execute('UPDATE quotations SET status = ? WHERE id = ?', ['confirmed', bill.quotation_id]);

        res.json({ success: true, message: 'Bill deleted successfully' });
    } catch (error) {
        console.error('Delete bill error:', error);
        res.status(500).json({ error: 'Failed to delete bill' });
    }
});

export default router;
