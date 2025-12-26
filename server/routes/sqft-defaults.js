import express from 'express';
import { db } from '../database/init.js';

import { authenticateToken, requireCompany } from '../middleware/auth.js';

const router = express.Router();

// Get all sqft default items
router.get('/', authenticateToken, requireCompany, async (req, res) => {
    try {
        // Check if sqft_defaults table exists
        const [tableExists] = await db.execute(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = ? AND table_name = 'sqft_defaults'
        `, [process.env.DB_NAME || 'Vishvakarma']);

        if (tableExists[0].count === 0) {
            // Table doesn't exist, return items from legacy tables
            return await getLegacyItems(req, res);
        }

        // Get items from sqft_defaults table
        const [items] = await db.execute(`
            SELECT * FROM sqft_defaults 
            WHERE company_id = ? 
            ORDER BY section_name, sort_order
        `, [req.user.companyId]);

        res.json({
            items: items.map(i => ({
                id: i.id,
                room_label: i.section_name,
                item_name: i.item_name,
                unit: i.unit,
                quantity: i.quantity
            }))
        });
    } catch (error) {
        console.error('Get sqft defaults error:', error);
        res.status(500).json({ error: 'Failed to fetch sqft defaults' });
    }
});

// Helper to get items from legacy tables
async function getLegacyItems(req, res) {
    try {
        const items = [];

        const fetchItems = async (table, roomLabel) => {
            try {
                const [tableExists] = await db.execute(`
                    SELECT COUNT(*) as count 
                    FROM information_schema.tables 
                    WHERE table_schema = ? AND table_name = ?
                `, [process.env.DB_NAME || 'Vishvakarma', table]);

                if (tableExists[0].count === 0) return [];

                const [rows] = await db.execute(`SELECT * FROM ${table} ORDER BY sort_order`);
                return rows.map(row => ({
                    room_label: roomLabel,
                    item_name: row.description,
                    quantity: isNaN(parseFloat(row.qty_or_value)) ? 1 : parseFloat(row.qty_or_value),
                    unit: row.unit || '-'
                }));
            } catch (err) {
                console.warn(`Failed to fetch from ${table}:`, err.message);
                return [];
            }
        };

        const fetchProvisions = async () => {
            try {
                const [tableExists] = await db.execute(`
                    SELECT COUNT(*) as count 
                    FROM information_schema.tables 
                    WHERE table_schema = ? AND table_name = ?
                `, [process.env.DB_NAME || 'Vishvakarma', 'room_finish_provisions']);

                if (tableExists[0].count === 0) return [];

                const [rows] = await db.execute('SELECT * FROM room_finish_provisions ORDER BY sort_order');
                return rows.map(row => ({
                    room_label: 'Provisions / Finishes',
                    item_name: `Area: ${row.area_name}`,
                    quantity: 1,
                    unit: '-'
                }));
            } catch (err) {
                return [];
            }
        };

        const allItems = [
            ...(await fetchProvisions()),
            ...(await fetchItems('common_works', 'Common Work')),
            ...(await fetchItems('entry_area_works', 'Entry Area')),
            ...(await fetchItems('drawing_room_works', 'Drawing Room')),
            ...(await fetchItems('dining_area_works', 'Dining Area')),
            ...(await fetchItems('kitchen_works', 'Kitchen')),
            ...(await fetchItems('master_bedroom_works', 'Master Bedroom')),
            ...(await fetchItems('guest_bedroom_works', 'Guest Bedroom'))
        ];

        res.json({ items: allItems });
    } catch (error) {
        console.error('Get legacy items error:', error);
        res.status(500).json({ error: 'Failed to fetch defaults' });
    }
}

// Save sqft default items
router.put('/', authenticateToken, requireCompany, async (req, res) => {
    const { items } = req.body;
    const companyId = req.user.companyId;

    try {
        // Create table if not exists
        await db.execute(`
            CREATE TABLE IF NOT EXISTS sqft_defaults (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                section_name VARCHAR(100) NOT NULL,
                item_name VARCHAR(255) NOT NULL,
                unit VARCHAR(50) DEFAULT '-',
                quantity DECIMAL(10,2) DEFAULT 1,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id)
            )
        `);

        // Delete existing items for this company
        await db.execute('DELETE FROM sqft_defaults WHERE company_id = ?', [companyId]);

        // Insert new items
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            await db.execute(`
                INSERT INTO sqft_defaults (company_id, section_name, item_name, unit, quantity, sort_order)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                companyId,
                item.room_label,
                item.item_name,
                item.unit || '-',
                item.quantity || 1,
                i
            ]);
        }

        res.json({ success: true, message: 'Sqft defaults saved successfully' });
    } catch (error) {
        console.error('Save sqft defaults error:', error);
        res.status(500).json({ error: 'Failed to save sqft defaults' });
    }
});

export default router;
