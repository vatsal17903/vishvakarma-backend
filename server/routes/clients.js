import express from 'express';
import { db } from '../database/init.js';
import { authenticateToken, requireCompany } from '../middleware/auth.js';

const router = express.Router();

// Get all clients for current company
router.get('/', authenticateToken, requireCompany, async (req, res) => {
    try {
        const [clients] = await db.execute(`
      SELECT * FROM clients 
      WHERE company_id = ? 
      ORDER BY created_at DESC
    `, [req.user.companyId]);
        res.json(clients);
    } catch (error) {
        console.error('Get clients error:', error);
        res.status(500).json({ error: 'Failed to fetch clients' });
    }
});

// Get single client
router.get('/:id', authenticateToken, requireCompany, async (req, res) => {
    try {
        const [clients] = await db.execute(`
      SELECT * FROM clients 
      WHERE id = ? AND company_id = ?
    `, [req.params.id, req.user.companyId]);

        const client = clients[0];

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        res.json(client);
    } catch (error) {
        console.error('Get client error:', error);
        res.status(500).json({ error: 'Failed to fetch client' });
    }
});

// Create client
router.post('/', requireCompany, async (req, res) => {
    try {
        const { name, address, phone, email, project_location, notes } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Client name is required' });
        }

        const [result] = await db.execute(`
      INSERT INTO clients (company_id, name, address, phone, email, project_location, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [req.user.companyId, name, address || null, phone || null, email || null, project_location || null, notes || null]);

        const [clients] = await db.execute('SELECT * FROM clients WHERE id = ?', [result.insertId]);
        res.status(201).json(clients[0]);
    } catch (error) {
        console.error('Create client error:', error);
        res.status(500).json({ error: 'Failed to create client' });
    }
});

// Update client
router.put('/:id', requireCompany, async (req, res) => {
    try {
        const { name, address, phone, email, project_location, notes } = req.body;

        await db.execute(`
      UPDATE clients 
      SET name = ?, address = ?, phone = ?, email = ?, project_location = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND company_id = ?
    `, [name, address, phone, email, project_location, notes, req.params.id, req.user.companyId]);

        const [clients] = await db.execute('SELECT * FROM clients WHERE id = ?', [req.params.id]);
        res.json(clients[0]);
    } catch (error) {
        console.error('Update client error:', error);
        res.status(500).json({ error: 'Failed to update client' });
    }
});

// Delete client
router.delete('/:id', requireCompany, async (req, res) => {
    try {
        // Check if client has quotations
        const [quotations] = await db.execute('SELECT COUNT(*) as count FROM quotations WHERE client_id = ?', [req.params.id]);

        if (quotations[0].count > 0) {
            return res.status(400).json({ error: 'Cannot delete client with existing quotations' });
        }

        await db.execute('DELETE FROM clients WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);
        res.json({ success: true, message: 'Client deleted successfully' });
    } catch (error) {
        console.error('Delete client error:', error);
        res.status(500).json({ error: 'Failed to delete client' });
    }
});

// Search clients
router.get('/search/:query', requireCompany, async (req, res) => {
    try {
        const query = `%${req.params.query}%`;
        const [clients] = await db.execute(`
      SELECT * FROM clients 
      WHERE company_id = ? AND (name LIKE ? OR phone LIKE ? OR project_location LIKE ?)
      ORDER BY name
      LIMIT 20
    `, [req.user.companyId, query, query, query]);
        res.json(clients);
    } catch (error) {
        console.error('Search clients error:', error);
        res.status(500).json({ error: 'Failed to search clients' });
    }
});

export default router;
