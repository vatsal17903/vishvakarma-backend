import express from 'express';
import { db } from '../database/init.js';

const router = express.Router();

// Middleware to check company selection
const requireCompany = (req, res, next) => {
    if (!req.session.companyId) {
        return res.status(400).json({ error: 'Please select a company first' });
    }
    next();
};

// Get all packages for current company
router.get('/', requireCompany, async (req, res) => {
    try {
        const [packages] = await db.execute(`
      SELECT * FROM packages 
      WHERE company_id = ? AND is_active = 1
      ORDER BY tier, bhk_type
    `, [req.session.companyId]);
        res.json(packages);
    } catch (error) {
        console.error('Get packages error:', error);
        res.status(500).json({ error: 'Failed to fetch packages' });
    }
});

// Get package with items
router.get('/:id', requireCompany, async (req, res) => {
    try {
        const [packages] = await db.execute(`
      SELECT * FROM packages 
      WHERE id = ? AND company_id = ?
    `, [req.params.id, req.session.companyId]);

        const pkg = packages[0];

        if (!pkg) {
            return res.status(404).json({ error: 'Package not found' });
        }

        const [items] = await db.execute(`
      SELECT * FROM package_items 
      WHERE package_id = ?
      ORDER BY sort_order, id
    `, [req.params.id]);

        res.json({ ...pkg, items });
    } catch (error) {
        console.error('Get package error:', error);
        res.status(500).json({ error: 'Failed to fetch package' });
    }
});

// Create package
router.post('/', requireCompany, async (req, res) => {
    try {
        const { name, bhk_type, tier, base_rate_sqft, description, items } = req.body;

        const [result] = await db.execute(`
      INSERT INTO packages (company_id, name, bhk_type, tier, base_rate_sqft, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [req.session.companyId, name, bhk_type, tier, base_rate_sqft, description]);

        const packageId = result.insertId;

        // Insert items
        if (items && items.length > 0) {
            const query = `
        INSERT INTO package_items (package_id, item_name, description, unit, sq_foot, quantity, rate, amount, room_type, sort_order, mm, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

            for (const [index, item] of items.entries()) {
                await db.execute(query, [
                    packageId, item.item_name, item.description, item.unit, item.sq_foot,
                    item.quantity, item.rate, item.amount, item.room_type, index, item.mm, item.status
                ]);
            }
        }

        const [packages] = await db.execute('SELECT * FROM packages WHERE id = ?', [packageId]);
        res.status(201).json(packages[0]);
    } catch (error) {
        console.error('Create package error:', error);
        res.status(500).json({ error: 'Failed to create package' });
    }
});

// Update package
router.put('/:id', requireCompany, async (req, res) => {
    try {
        const { name, bhk_type, tier, base_rate_sqft, description, items } = req.body;

        await db.execute(`
      UPDATE packages 
      SET name = ?, bhk_type = ?, tier = ?, base_rate_sqft = ?, description = ?
      WHERE id = ? AND company_id = ?
    `, [name, bhk_type, tier, base_rate_sqft, description, req.params.id, req.session.companyId]);

        // Update items
        if (items) {
            await db.execute('DELETE FROM package_items WHERE package_id = ?', [req.params.id]);

            const query = `
        INSERT INTO package_items (package_id, item_name, description, unit, sq_foot, quantity, rate, amount, room_type, sort_order, mm, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

            for (const [index, item] of items.entries()) {
                await db.execute(query, [
                    req.params.id, item.item_name, item.description, item.unit, item.sq_foot,
                    item.quantity, item.rate, item.amount, item.room_type, index, item.mm, item.status
                ]);
            }
        }

        const [packages] = await db.execute('SELECT * FROM packages WHERE id = ?', [req.params.id]);
        res.json(packages[0]);
    } catch (error) {
        console.error('Update package error:', error);
        res.status(500).json({ error: 'Failed to update package' });
    }
});

// Delete package (soft delete)
router.delete('/:id', requireCompany, async (req, res) => {
    try {
        await db.execute('UPDATE packages SET is_active = 0 WHERE id = ? AND company_id = ?', [req.params.id, req.session.companyId]);
        res.json({ success: true, message: 'Package deleted successfully' });
    } catch (error) {
        console.error('Delete package error:', error);
        res.status(500).json({ error: 'Failed to delete package' });
    }
});

// Get packages by tier
router.get('/tier/:tier', requireCompany, async (req, res) => {
    try {
        const [packages] = await db.execute(`
      SELECT * FROM packages 
      WHERE company_id = ? AND tier = ? AND is_active = 1
      ORDER BY bhk_type
    `, [req.session.companyId, req.params.tier]);
        res.json(packages);
    } catch (error) {
        console.error('Get packages by tier error:', error);
        res.status(500).json({ error: 'Failed to fetch packages' });
    }
});

export default router;
