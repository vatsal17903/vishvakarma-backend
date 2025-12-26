import express from 'express';
import { db } from '../database/init.js';

import { authenticateToken, requireCompany } from '../middleware/auth.js';

const router = express.Router();

// Generate receipt number
async function generateReceiptNumber(companyCode) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    const [rows] = await db.execute(`
    SELECT receipt_number FROM receipts 
    WHERE receipt_number LIKE ? 
    ORDER BY id DESC LIMIT 1
  `, [`RCP/${companyCode}/${year}${month}%`]);
    const lastReceipt = rows[0];

    let sequence = 1;
    if (lastReceipt) {
        const parts = lastReceipt.receipt_number.split('/');
        sequence = parseInt(parts[parts.length - 1]) + 1;
    }

    return `RCP/${companyCode}/${year}${month}/${sequence.toString().padStart(4, '0')}`;
}

// Get all receipts for current company
router.get('/', authenticateToken, requireCompany, async (req, res) => {
    try {
        const [receipts] = await db.execute(`
      SELECT r.*, q.quotation_number, c.name as client_name
      FROM receipts r
      LEFT JOIN quotations q ON r.quotation_id = q.id
      LEFT JOIN clients c ON q.client_id = c.id
      WHERE r.company_id = ?
      ORDER BY r.created_at DESC
    `, [req.user.companyId]);
        res.json(receipts);
    } catch (error) {
        console.error('Get receipts error:', error);
        res.status(500).json({ error: 'Failed to fetch receipts' });
    }
});

// Get recent receipts
router.get('/recent', authenticateToken, requireCompany, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        const [receipts] = await db.execute(`
      SELECT r.*, q.quotation_number, c.name as client_name
      FROM receipts r
      LEFT JOIN quotations q ON r.quotation_id = q.id
      LEFT JOIN clients c ON q.client_id = c.id
      WHERE r.company_id = ?
      ORDER BY r.created_at DESC
      LIMIT ?
    `, [req.user.companyId, limit]);
        res.json(receipts);
    } catch (error) {
        console.error('Get recent receipts error:', error);
        res.status(500).json({ error: 'Failed to fetch recent receipts' });
    }
});

// Get receipts by quotation
router.get('/quotation/:quotationId', authenticateToken, requireCompany, async (req, res) => {
    try {
        const [receipts] = await db.execute(`
      SELECT * FROM receipts 
      WHERE quotation_id = ? AND company_id = ?
      ORDER BY date DESC
    `, [req.params.quotationId, req.user.companyId]);

        const totalReceived = receipts.reduce((sum, r) => sum + r.amount, 0);

        const [quotations] = await db.execute('SELECT grand_total FROM quotations WHERE id = ?', [req.params.quotationId]);
        const quotation = quotations[0];

        const balance = quotation ? quotation.grand_total - totalReceived : 0;

        res.json({ receipts, totalReceived, balance });
    } catch (error) {
        console.error('Get receipts by quotation error:', error);
        res.status(500).json({ error: 'Failed to fetch receipts' });
    }
});

// Get single receipt
router.get('/:id', authenticateToken, requireCompany, async (req, res) => {
    try {
        const [receipts] = await db.execute(`
      SELECT r.*, q.quotation_number, q.grand_total as quotation_total,
             c.name as client_name, c.address as client_address, c.phone as client_phone
      FROM receipts r
      LEFT JOIN quotations q ON r.quotation_id = q.id
      LEFT JOIN clients c ON q.client_id = c.id
      WHERE r.id = ? AND r.company_id = ?
    `, [req.params.id, req.user.companyId]);

        const receipt = receipts[0];

        if (!receipt) {
            return res.status(404).json({ error: 'Receipt not found' });
        }

        // Get all receipts for this quotation to calculate balance
        const [allReceiptTotal] = await db.execute(`
      SELECT SUM(amount) as total FROM receipts WHERE quotation_id = ?
    `, [receipt.quotation_id]);

        receipt.total_received = allReceiptTotal[0].total || 0;
        receipt.balance = receipt.quotation_total - receipt.total_received;

        res.json(receipt);
    } catch (error) {
        console.error('Get receipt error:', error);
        res.status(500).json({ error: 'Failed to fetch receipt' });
    }
});

// Create receipt
router.post('/', authenticateToken, requireCompany, async (req, res) => {
    try {
        const { quotation_id, date, amount, payment_mode, transaction_reference, notes } = req.body;

        if (!quotation_id || !amount || !payment_mode) {
            return res.status(400).json({ error: 'Quotation, amount, and payment mode are required' });
        }

        // Verify quotation exists and belongs to current company
        const [quotations] = await db.execute(`
      SELECT * FROM quotations WHERE id = ? AND company_id = ?
    `, [quotation_id, req.user.companyId]);

        const quotation = quotations[0];

        if (!quotation) {
            return res.status(404).json({ error: 'Quotation not found' });
        }

        // Generate receipt number
        const receipt_number = await generateReceiptNumber(req.user.companyCode);

        const [result] = await db.execute(`
      INSERT INTO receipts (company_id, quotation_id, receipt_number, date, amount, payment_mode, transaction_reference, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [req.user.companyId, quotation_id, receipt_number, date, amount, payment_mode, transaction_reference, notes]);

        // Update bill status if exists
        const [bills] = await db.execute('SELECT * FROM bills WHERE quotation_id = ?', [quotation_id]);
        const bill = bills[0];
        if (bill) {
            const [totalRec] = await db.execute('SELECT SUM(amount) as total FROM receipts WHERE quotation_id = ?', [quotation_id]);
            const newPaidAmount = totalRec[0].total || 0;
            const newBalance = bill.grand_total - newPaidAmount;

            let newStatus = 'pending';
            if (newBalance <= 0) {
                newStatus = 'paid';
            } else if (newPaidAmount > 0) {
                newStatus = 'partial';
            }

            await db.execute(`
        UPDATE bills SET paid_amount = ?, balance_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newPaidAmount, newBalance, newStatus, bill.id]);
        }

        const [newReceipts] = await db.execute('SELECT * FROM receipts WHERE id = ?', [result.insertId]);
        res.status(201).json(newReceipts[0]);
    } catch (error) {
        console.error('Create receipt error:', error);
        res.status(500).json({ error: 'Failed to create receipt' });
    }
});

// Update receipt
router.put('/:id', authenticateToken, requireCompany, async (req, res) => {
    try {
        const { date, amount, payment_mode, transaction_reference, notes } = req.body;

        await db.execute(`
      UPDATE receipts SET date = ?, amount = ?, payment_mode = ?, transaction_reference = ?, notes = ?
      WHERE id = ? AND company_id = ?
    `, [date, amount, payment_mode, transaction_reference, notes, req.params.id, req.user.companyId]);

        const [receipts] = await db.execute('SELECT * FROM receipts WHERE id = ?', [req.params.id]);
        const receipt = receipts[0];

        // Update bill if exists
        const [bills] = await db.execute('SELECT * FROM bills WHERE quotation_id = ?', [receipt.quotation_id]);
        const bill = bills[0];
        if (bill) {
            const [totalRec] = await db.execute('SELECT SUM(amount) as total FROM receipts WHERE quotation_id = ?', [receipt.quotation_id]);
            const newPaidAmount = totalRec[0].total || 0;
            const newBalance = bill.grand_total - newPaidAmount;

            let newStatus = 'pending';
            if (newBalance <= 0) {
                newStatus = 'paid';
            } else if (newPaidAmount > 0) {
                newStatus = 'partial';
            }

            await db.execute(`
        UPDATE bills SET paid_amount = ?, balance_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newPaidAmount, newBalance, newStatus, bill.id]);
        }

        res.json(receipt);
    } catch (error) {
        console.error('Update receipt error:', error);
        res.status(500).json({ error: 'Failed to update receipt' });
    }
});

// Delete receipt
router.delete('/:id', authenticateToken, requireCompany, async (req, res) => {
    try {
        const [receipts] = await db.execute('SELECT * FROM receipts WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
        const receipt = receipts[0];

        if (!receipt) {
            return res.status(404).json({ error: 'Receipt not found' });
        }

        await db.execute('DELETE FROM receipts WHERE id = ?', [req.params.id]);

        // Update bill if exists
        const [bills] = await db.execute('SELECT * FROM bills WHERE quotation_id = ?', [receipt.quotation_id]);
        const bill = bills[0];
        if (bill) {
            const [totalRec] = await db.execute('SELECT SUM(amount) as total FROM receipts WHERE quotation_id = ?', [receipt.quotation_id]);
            const newPaidAmount = totalRec[0].total || 0;
            const newBalance = bill.grand_total - newPaidAmount;

            let newStatus = 'pending';
            if (newBalance <= 0) {
                newStatus = 'paid';
            } else if (newPaidAmount > 0) {
                newStatus = 'partial';
            }

            await db.execute(`
        UPDATE bills SET paid_amount = ?, balance_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newPaidAmount, newBalance, newStatus, bill.id]);
        }

        res.json({ success: true, message: 'Receipt deleted successfully' });
    } catch (error) {
        console.error('Delete receipt error:', error);
        res.status(500).json({ error: 'Failed to delete receipt' });
    }
});

export default router;
