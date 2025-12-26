import express from 'express';
import { db } from '../database/init.js';

import { authenticateToken, requireCompany } from '../middleware/auth.js';

const router = express.Router();

// Maximum discount allowed (30%)
const MAX_DISCOUNT_PERCENT = 30;

// Generate quotation number
async function generateQuotationNumber(companyCode) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    const [rows] = await db.execute(`
    SELECT quotation_number FROM quotations 
    WHERE quotation_number LIKE ? 
    ORDER BY id DESC LIMIT 1
  `, [`${companyCode}/${year}${month}%`]);

    const lastQuotation = rows[0];

    let sequence = 1;
    if (lastQuotation) {
        const parts = lastQuotation.quotation_number.split('/');
        sequence = parseInt(parts[parts.length - 1]) + 1;
    }

    return `${companyCode}/${year}${month}/${sequence.toString().padStart(4, '0')}`;
}

// Validate discount
function validateDiscount(discountType, discountValue, subtotal) {
    if (!discountType || discountValue <= 0) {
        return { valid: true, discountAmount: 0 };
    }

    let discountAmount = 0;
    let discountPercent = 0;

    if (discountType === 'percentage') {
        discountPercent = discountValue;
        discountAmount = (subtotal * discountValue) / 100;
    } else {
        discountAmount = discountValue;
        discountPercent = (discountValue / subtotal) * 100;
    }

    if (discountPercent > MAX_DISCOUNT_PERCENT) {
        return {
            valid: false,
            error: `Discount cannot exceed ${MAX_DISCOUNT_PERCENT}%. Current discount is ${discountPercent.toFixed(2)}%`
        };
    }

    return { valid: true, discountAmount };
}

// Get all quotations for current company
router.get('/', requireCompany, async (req, res) => {
    try {
        const [quotations] = await db.execute(`
      SELECT q.*, c.name as client_name, c.phone as client_phone
      FROM quotations q
      LEFT JOIN clients c ON q.client_id = c.id
      WHERE q.company_id = ?
      ORDER BY q.created_at DESC
    `, [req.user.companyId]);
        res.json(quotations);
    } catch (error) {
        console.error('Get quotations error:', error);
        res.status(500).json({ error: 'Failed to fetch quotations' });
    }
});

// Get defaults for SqFt packages (Turnkey items)
router.get('/defaults/sqft', requireCompany, async (req, res) => {
    try {
        const items = [];

        // Helper to fetch and map items
        const fetchItems = async (table, roomLabel) => {
            try {
                // Check if table exists first to avoid errors if script wasn't run
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
                    description: '', // Could be empty or mapped differently
                    quantity: isNaN(parseFloat(row.qty_or_value)) ? 1 : parseFloat(row.qty_or_value),
                    unit: row.unit,
                    rate: 0,
                    amount: 0,
                    remarks: isNaN(parseFloat(row.qty_or_value)) ? row.qty_or_value : ''
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
                    description: `Finish: ${row.finish_description}`,
                    quantity: 1,
                    unit: '-',
                    rate: 0,
                    amount: 0,
                    remarks: ''
                }));
            } catch (err) {
                return [];
            }
        }


        // Fetch all sections
        const commonWorks = await fetchItems('common_works', 'Common Work');
        const entryArea = await fetchItems('entry_area_works', 'Entry Area');
        const drawingRoom = await fetchItems('drawing_room_works', 'Drawing Room');
        const diningArea = await fetchItems('dining_area_works', 'Dining Area');
        const kitchen = await fetchItems('kitchen_works', 'Kitchen');
        const masterBedroom = await fetchItems('master_bedroom_works', 'Master Bedroom');
        const guestBedroom = await fetchItems('guest_bedroom_works', 'Guest Bedroom');
        const provisions = await fetchProvisions();

        // Combine all
        const allItems = [
            ...provisions,
            ...commonWorks,
            ...entryArea,
            ...drawingRoom,
            ...diningArea,
            ...kitchen,
            ...masterBedroom,
            ...guestBedroom
        ];

        res.json({ items: allItems });
    } catch (error) {
        console.error('Get sqft defaults error:', error);
        res.status(500).json({ error: 'Failed to fetch default items' });
    }
});

// Get recent quotations
router.get('/recent', requireCompany, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        // mysql2 prepares limit as string if passed in params sometimes, better interpolate or ensure int
        // Actually mysql2 handles numbers fine in execute parameters, but LIMIT in prepared statements can be tricky in some SQL versions.
        // It's safer to use integer directly in the array.
        const [quotations] = await db.execute(`
      SELECT q.*, c.name as client_name
      FROM quotations q
      LEFT JOIN clients c ON q.client_id = c.id
      WHERE q.company_id = ?
      ORDER BY q.created_at DESC
      LIMIT ?
    `, [req.user.companyId, limit]);
        // Note: if LIMIT ? fails with 'Undeclared variable', cast to int. mysql2 usually handles it.
        res.json(quotations);
    } catch (error) {
        console.error('Get recent quotations error:', error);
        res.status(500).json({ error: 'Failed to fetch recent quotations' });
    }
});

// Get single quotation with items
router.get('/:id', requireCompany, async (req, res) => {
    try {
        const [quotations] = await db.execute(`
      SELECT q.*, c.name as client_name, c.address as client_address, 
             c.phone as client_phone, c.email as client_email, c.project_location
      FROM quotations q
      LEFT JOIN clients c ON q.client_id = c.id
      WHERE q.id = ? AND q.company_id = ?
    `, [req.params.id, req.user.companyId]);

        const quotation = quotations[0];

        if (!quotation) {
            return res.status(404).json({ error: 'Quotation not found' });
        }

        const [items] = await db.execute(`
      SELECT * FROM quotation_items 
      WHERE quotation_id = ?
      ORDER BY sort_order, id
    `, [req.params.id]);

        const [columnConfigs] = await db.execute(`
      SELECT columns_config FROM quotation_column_config 
      WHERE quotation_id = ?
    `, [req.params.id]);
        const columnConfig = columnConfigs[0];

        // Get related receipts
        const [receipts] = await db.execute(`
      SELECT * FROM receipts 
      WHERE quotation_id = ?
      ORDER BY date DESC
    `, [req.params.id]);

        // Get related bill
        const [bills] = await db.execute(`
      SELECT * FROM bills 
      WHERE quotation_id = ?
    `, [req.params.id]);
        const bill = bills[0];

        res.json({
            ...quotation,
            items,
            columnConfig: columnConfig ? JSON.parse(columnConfig.columns_config) : null,
            receipts,
            bill
        });
    } catch (error) {
        console.error('Get quotation error:', error);
        res.status(500).json({ error: 'Failed to fetch quotation' });
    }
});

// Create quotation
router.post('/', requireCompany, async (req, res) => {
    try {
        const {
            client_id, date, total_sqft, rate_per_sqft, package_id,
            bedroom_count, bedroom_config, items, column_config,
            discount_type, discount_value, cgst_percent, sgst_percent,
            terms_conditions, payment_plan, notes, status
        } = req.body;

        // Calculate subtotal from items
        let subtotal = 0;
        if (items && items.length > 0) {
            subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        } else if (total_sqft && rate_per_sqft) {
            subtotal = total_sqft * rate_per_sqft;
        }

        // Validate discount (BACKEND ENFORCEMENT)
        const discountValidation = validateDiscount(discount_type, discount_value || 0, subtotal);
        if (!discountValidation.valid) {
            return res.status(400).json({ error: discountValidation.error });
        }

        const discount_amount = discountValidation.discountAmount;
        const taxable_amount = subtotal - discount_amount;
        const cgst = cgst_percent || 9;
        const sgst = sgst_percent || 9;
        const cgst_amount = (taxable_amount * cgst) / 100;
        const sgst_amount = (taxable_amount * sgst) / 100;
        const total_tax = cgst_amount + sgst_amount;
        const grand_total = taxable_amount + total_tax;

        // Fetch company defaults if terms or payment plan are missing
        let finalTerms = terms_conditions;
        let finalPayment = payment_plan;

        if (!finalTerms || !finalPayment) {
            const [companyRows] = await db.execute(
                'SELECT default_terms_conditions, default_payment_plan FROM companies WHERE id = ?',
                [req.user.companyId]
            );

            if (companyRows.length > 0) {
                if (!finalTerms) finalTerms = companyRows[0].default_terms_conditions;
                if (!finalPayment) finalPayment = companyRows[0].default_payment_plan;
            }
        }

        // Generate quotation number
        const quotation_number = await generateQuotationNumber(req.user.companyCode);

        const [result] = await db.execute(`
      INSERT INTO quotations (
        company_id, client_id, quotation_number, date, total_sqft, rate_per_sqft,
        package_id, bedroom_count, bedroom_config, subtotal, discount_type,
        discount_value, discount_amount, taxable_amount, cgst_percent, cgst_amount,
        sgst_percent, sgst_amount, total_tax, grand_total, terms_conditions, payment_plan, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            req.user.companyId, client_id, quotation_number, date,
            (total_sqft && !isNaN(parseFloat(total_sqft))) ? parseFloat(total_sqft) : null,
            (rate_per_sqft && !isNaN(parseFloat(rate_per_sqft))) ? parseFloat(rate_per_sqft) : null,
            (parseInt(package_id) > 0) ? parseInt(package_id) : null,
            bedroom_count || 1, JSON.stringify(bedroom_config || []),
            subtotal || 0, discount_type || null, discount_value || 0, discount_amount || 0, taxable_amount || 0,
            cgst || 0, cgst_amount || 0, sgst || 0, sgst_amount || 0, total_tax || 0, grand_total || 0,
            finalTerms || null, finalPayment || null, notes || null, status || 'draft'
        ]);

        const quotationId = result.insertId;

        // Insert items
        if (items && items.length > 0) {
            const query = `
        INSERT INTO quotation_items (
          quotation_id, room_label, item_name, description, material, brand,
          unit, quantity, rate, amount, remarks, custom_columns, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

            for (const [index, item] of items.entries()) {
                await db.execute(query, [
                    quotationId,
                    item.room_label || null,
                    item.item_name || '',
                    item.description || null,
                    item.material || null,
                    item.brand || null,
                    item.unit || null,
                    item.quantity || 0,
                    item.rate || 0,
                    item.amount || 0,
                    item.remarks || null,
                    JSON.stringify(item.custom_columns || {}),
                    index
                ]);
            }
        }

        // Save column config
        if (column_config) {
            await db.execute(`
        INSERT INTO quotation_column_config (quotation_id, columns_config)
        VALUES (?, ?)
      `, [quotationId, JSON.stringify(column_config)]);
        }

        const [quotations] = await db.execute('SELECT * FROM quotations WHERE id = ?', [quotationId]);
        res.status(201).json(quotations[0]);
    } catch (error) {
        console.error('Create quotation error:', error);
        res.status(500).json({ error: 'Failed to create quotation' });
    }
});

// Update quotation
router.put('/:id', requireCompany, async (req, res) => {
    try {
        const {
            client_id, date, total_sqft, rate_per_sqft, package_id,
            bedroom_count, bedroom_config, items, column_config,
            discount_type, discount_value, cgst_percent, sgst_percent,
            terms_conditions, payment_plan, notes, status
        } = req.body;

        // Calculate subtotal from items
        let subtotal = 0;
        if (items && items.length > 0) {
            subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        } else if (total_sqft && rate_per_sqft) {
            subtotal = total_sqft * rate_per_sqft;
        }

        // Validate discount (BACKEND ENFORCEMENT)
        const discountValidation = validateDiscount(discount_type, discount_value || 0, subtotal);
        if (!discountValidation.valid) {
            return res.status(400).json({ error: discountValidation.error });
        }

        const discount_amount = discountValidation.discountAmount;
        const taxable_amount = subtotal - discount_amount;
        const cgst = cgst_percent || 9;
        const sgst = sgst_percent || 9;
        const cgst_amount = (taxable_amount * cgst) / 100;
        const sgst_amount = (taxable_amount * sgst) / 100;
        const total_tax = cgst_amount + sgst_amount;
        const grand_total = taxable_amount + total_tax;

        await db.execute(`
      UPDATE quotations SET
        client_id = ?, date = ?, total_sqft = ?, rate_per_sqft = ?,
        package_id = ?, bedroom_count = ?, bedroom_config = ?, subtotal = ?,
        discount_type = ?, discount_value = ?, discount_amount = ?, taxable_amount = ?,
        cgst_percent = ?, cgst_amount = ?, sgst_percent = ?, sgst_amount = ?,
        total_tax = ?, grand_total = ?, terms_conditions = ?, payment_plan = ?, notes = ?,
        status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND company_id = ?
    `, [
            client_id, date, total_sqft, rate_per_sqft, package_id,
            bedroom_count || 1, JSON.stringify(bedroom_config || []),
            subtotal, discount_type, discount_value, discount_amount, taxable_amount,
            cgst, cgst_amount, sgst, sgst_amount, total_tax, grand_total,
            terms_conditions, payment_plan, notes, status, req.params.id, req.user.companyId
        ]);

        // Update items
        if (items) {
            await db.execute('DELETE FROM quotation_items WHERE quotation_id = ?', [req.params.id]);

            const query = `
        INSERT INTO quotation_items (
          quotation_id, room_label, item_name, description, material, brand,
          unit, quantity, rate, amount, remarks, custom_columns, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

            for (const [index, item] of items.entries()) {
                await db.execute(query, [
                    req.params.id, item.room_label, item.item_name, item.description,
                    item.material, item.brand, item.unit, item.quantity, item.rate,
                    item.amount, item.remarks, JSON.stringify(item.custom_columns || {}), index
                ]);
            }
        }

        // Update column config
        if (column_config) {
            await db.execute('DELETE FROM quotation_column_config WHERE quotation_id = ?', [req.params.id]);
            await db.execute(`
        INSERT INTO quotation_column_config (quotation_id, columns_config)
        VALUES (?, ?)
      `, [req.params.id, JSON.stringify(column_config)]);
        }

        const [quotations] = await db.execute('SELECT * FROM quotations WHERE id = ?', [req.params.id]);
        res.json(quotations[0]);
    } catch (error) {
        console.error('Update quotation error:', error);
        res.status(500).json({ error: 'Failed to update quotation' });
    }
});

// Delete quotation
router.delete('/:id', requireCompany, async (req, res) => {
    try {
        // Check for receipts
        const [receipts] = await db.execute('SELECT COUNT(*) as count FROM receipts WHERE quotation_id = ?', [req.params.id]);
        if (receipts[0].count > 0) {
            return res.status(400).json({ error: 'Cannot delete quotation with receipts' });
        }

        // Check for bills
        const [bills] = await db.execute('SELECT COUNT(*) as count FROM bills WHERE quotation_id = ?', [req.params.id]);
        if (bills[0].count > 0) {
            return res.status(400).json({ error: 'Cannot delete quotation with bills' });
        }

        await db.execute('DELETE FROM quotation_items WHERE quotation_id = ?', [req.params.id]);
        await db.execute('DELETE FROM quotation_column_config WHERE quotation_id = ?', [req.params.id]);
        await db.execute('DELETE FROM quotations WHERE id = ? AND company_id = ?', [req.params.id, req.user.companyId]);

        res.json({ success: true, message: 'Quotation deleted successfully' });
    } catch (error) {
        console.error('Delete quotation error:', error);
        res.status(500).json({ error: 'Failed to delete quotation' });
    }
});

// Calculate project cost
router.post('/calculate', (req, res) => {
    try {
        const { total_sqft, rate_per_sqft, discount_type, discount_value, cgst_percent, sgst_percent } = req.body;

        const subtotal = (total_sqft || 0) * (rate_per_sqft || 0);

        const discountValidation = validateDiscount(discount_type, discount_value || 0, subtotal);
        if (!discountValidation.valid) {
            return res.status(400).json({ error: discountValidation.error });
        }

        const discount_amount = discountValidation.discountAmount;
        const taxable_amount = subtotal - discount_amount;
        const cgst = cgst_percent || 9;
        const sgst = sgst_percent || 9;
        const cgst_amount = (taxable_amount * cgst) / 100;
        const sgst_amount = (taxable_amount * sgst) / 100;
        const total_tax = cgst_amount + sgst_amount;
        const grand_total = taxable_amount + total_tax;

        res.json({
            subtotal,
            discount_amount,
            taxable_amount,
            cgst_amount,
            sgst_amount,
            total_tax,
            grand_total
        });
    } catch (error) {
        console.error('Calculate error:', error);
        res.status(500).json({ error: 'Failed to calculate' });
    }
});

export default router;
