import express from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../database/init.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Get all companies
router.get('/', async (req, res) => {
    try {
        const [companies] = await db.execute('SELECT * FROM companies');
        res.json(companies);
    } catch (error) {
        console.error('Get companies error:', error);
        res.status(500).json({ error: 'Failed to fetch companies' });
    }
});

// Select company (generate new token with company info)
router.post('/select', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const { companyId } = req.body;

        const [companies] = await db.execute('SELECT * FROM companies WHERE id = ?', [companyId]);
        const company = companies[0];

        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }

        // Generate new token with company info
        const newToken = jwt.sign(
            {
                userId: decoded.userId,
                userName: decoded.userName,
                companyId: company.id,
                companyName: company.name,
                companyCode: company.code
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token: newToken,
            company: {
                id: company.id,
                name: company.name,
                code: company.code
            }
        });
    } catch (error) {
        console.error('Select company error:', error);
        res.status(500).json({ error: 'Failed to select company' });
    }
});

// Get current company
router.get('/current', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.json({ company: null });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        if (!decoded.companyId) {
            return res.json({ company: null });
        }

        const [companies] = await db.execute('SELECT * FROM companies WHERE id = ?', [decoded.companyId]);
        const company = companies[0];
        res.json({ company });
    } catch (error) {
        console.error('Get current company error:', error);
        res.status(500).json({ error: 'Failed to fetch current company' });
    }
});

// Update company details
router.put('/:id', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        jwt.verify(token, JWT_SECRET);

        const { id } = req.params;
        const { name, address, phone, email, gst_number, bank_details, default_terms_conditions, default_payment_plan } = req.body;

        await db.execute(`
      UPDATE companies
      SET name = ?, address = ?, phone = ?, email = ?, gst_number = ?, bank_details = ?, default_terms_conditions = ?, default_payment_plan = ?
      WHERE id = ?
    `, [name, address, phone, email, gst_number, bank_details, default_terms_conditions, default_payment_plan, id]);

        const [companies] = await db.execute('SELECT * FROM companies WHERE id = ?', [id]);
        res.json(companies[0]);
    } catch (error) {
        console.error('Update company error:', error);
        res.status(500).json({ error: 'Failed to update company' });
    }
});

export default router;
