import express from 'express';
import { db } from '../database/init.js';

const router = express.Router();

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

// Select company (set in session)
router.post('/select', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { companyId } = req.body;

        const [companies] = await db.execute('SELECT * FROM companies WHERE id = ?', [companyId]);
        const company = companies[0];

        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }

        req.session.companyId = company.id;
        req.session.companyName = company.name;
        req.session.companyCode = company.code;

        res.json({
            success: true,
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
        if (!req.session.companyId) {
            return res.json({ company: null });
        }

        const [companies] = await db.execute('SELECT * FROM companies WHERE id = ?', [req.session.companyId]);
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
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

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
