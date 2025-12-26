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

// Dashboard summary
router.get('/dashboard', requireCompany, async (req, res) => {
  try {
    const companyId = req.session.companyId;

    // Total quotations count and value
    const [quotationStats] = await db.execute(`
      SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total
      FROM quotations WHERE company_id = ?
    `, [companyId]);

    // Total bills count and value
    const [billStats] = await db.execute(`
      SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total
      FROM bills WHERE company_id = ?
    `, [companyId]);

    // Total receipts amount
    const [receiptStats] = await db.execute(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
      FROM receipts WHERE company_id = ?
    `, [companyId]);

    // Pending balance
    const [pendingBalance] = await db.execute(`
      SELECT COALESCE(SUM(balance_amount), 0) as total
      FROM bills WHERE company_id = ? AND status != 'paid'
    `, [companyId]);

    // Monthly stats (current month)
    const currentMonth = new Date().toISOString().slice(0, 7);
    const [monthlyQuotations] = await db.execute(`
      SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as total
      FROM quotations WHERE company_id = ? AND date LIKE ?
    `, [companyId, `${currentMonth}%`]);

    const [monthlyReceipts] = await db.execute(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
      FROM receipts WHERE company_id = ? AND date LIKE ?
    `, [companyId, `${currentMonth}%`]);

    // Client count
    const [clientCount] = await db.execute(`
      SELECT COUNT(*) as count FROM clients WHERE company_id = ?
    `, [companyId]);

    res.json({
      quotations: quotationStats[0],
      bills: billStats[0],
      receipts: receiptStats[0],
      pendingBalance: pendingBalance[0].total,
      monthly: {
        quotations: monthlyQuotations[0],
        receipts: monthlyReceipts[0]
      },
      clients: clientCount[0].count
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Report with date filters
router.get('/summary', requireCompany, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const companyId = req.session.companyId;

    let dateFilter = '';
    const params = [companyId];

    if (start_date && end_date) {
      dateFilter = ' AND date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    // Quotation totals
    const [quotationTotals] = await db.execute(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(grand_total), 0) as total_value,
        COALESCE(SUM(discount_amount), 0) as total_discount,
        COALESCE(SUM(total_tax), 0) as total_tax
      FROM quotations 
      WHERE company_id = ?${dateFilter}
    `, params);

    // Bill totals
    const billParams = [...params];
    const [billTotals] = await db.execute(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(grand_total), 0) as total_billed,
        COALESCE(SUM(paid_amount), 0) as total_paid,
        COALESCE(SUM(balance_amount), 0) as total_pending
      FROM bills 
      WHERE company_id = ?${dateFilter}
    `, billParams);

    // Receipt totals
    const receiptParams = [...params];
    const [receiptTotals] = await db.execute(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_received,
        COALESCE(SUM(CASE WHEN payment_mode = 'Cash' THEN amount ELSE 0 END), 0) as cash_total,
        COALESCE(SUM(CASE WHEN payment_mode = 'Bank' THEN amount ELSE 0 END), 0) as bank_total,
        COALESCE(SUM(CASE WHEN payment_mode = 'UPI' THEN amount ELSE 0 END), 0) as upi_total
      FROM receipts 
      WHERE company_id = ?${dateFilter}
    `, receiptParams);

    res.json({
      dateRange: { start_date, end_date },
      quotations: quotationTotals[0],
      bills: billTotals[0],
      receipts: receiptTotals[0]
    });
  } catch (error) {
    console.error('Report summary error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Bedroom-wise report
router.get('/bedroom-wise', requireCompany, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const companyId = req.session.companyId;

    let dateFilter = '';
    const params = [companyId];

    if (start_date && end_date) {
      dateFilter = ' AND date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    const [bedroomStats] = await db.execute(`
      SELECT 
        bedroom_count,
        COUNT(*) as count,
        COALESCE(SUM(grand_total), 0) as total_value,
        COALESCE(AVG(grand_total), 0) as avg_value
      FROM quotations 
      WHERE company_id = ?${dateFilter}
      GROUP BY bedroom_count
      ORDER BY bedroom_count
    `, params);

    res.json(bedroomStats);
  } catch (error) {
    console.error('Bedroom-wise report error:', error);
    res.status(500).json({ error: 'Failed to generate bedroom report' });
  }
});

// Project-wise report
router.get('/project-wise', requireCompany, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const companyId = req.session.companyId;

    let dateFilter = '';
    const params = [companyId];

    if (start_date && end_date) {
      dateFilter = ' AND q.date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    const [projectStats] = await db.execute(`
      SELECT 
        c.project_location,
        c.name as client_name,
        q.quotation_number,
        q.grand_total as quotation_value,
        COALESCE(b.grand_total, 0) as billed_value,
        COALESCE(b.paid_amount, 0) as paid_amount,
        COALESCE(b.balance_amount, q.grand_total) as pending_amount,
        COALESCE(b.status, 'unbilled') as status
      FROM quotations q
      LEFT JOIN clients c ON q.client_id = c.id
      LEFT JOIN bills b ON q.id = b.quotation_id
      WHERE q.company_id = ?${dateFilter}
      ORDER BY q.created_at DESC
    `, params);

    res.json(projectStats);
  } catch (error) {
    console.error('Project-wise report error:', error);
    res.status(500).json({ error: 'Failed to generate project report' });
  }
});

// Monthly trend report
router.get('/monthly-trend', requireCompany, async (req, res) => {
  try {
    const companyId = req.session.companyId;
    const year = req.query.year || new Date().getFullYear();

    // MySQL uses DATE_FORMAT instead of strftime.
    // strftime('%m', date) -> DATE_FORMAT(date, '%m')
    // strftime('%Y', date) -> DATE_FORMAT(date, '%Y')

    const [monthlyTrend] = await db.execute(`
      SELECT 
        DATE_FORMAT(date, '%m') as month,
        COUNT(*) as quotation_count,
        COALESCE(SUM(grand_total), 0) as quotation_value
      FROM quotations 
      WHERE company_id = ? AND DATE_FORMAT(date, '%Y') = ?
      GROUP BY DATE_FORMAT(date, '%m')
      ORDER BY month
    `, [companyId, year.toString()]);

    const [monthlyReceipts] = await db.execute(`
      SELECT 
        DATE_FORMAT(date, '%m') as month,
        COUNT(*) as receipt_count,
        COALESCE(SUM(amount), 0) as receipt_value
      FROM receipts 
      WHERE company_id = ? AND DATE_FORMAT(date, '%Y') = ?
      GROUP BY DATE_FORMAT(date, '%m')
      ORDER BY month
    `, [companyId, year.toString()]);

    // Merge data
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const trend = months.map(month => {
      const quotation = monthlyTrend.find(q => q.month === month) || { quotation_count: 0, quotation_value: 0 };
      const receipt = monthlyReceipts.find(r => r.month === month) || { receipt_count: 0, receipt_value: 0 };
      return {
        month,
        ...quotation,
        ...receipt
      };
    });

    res.json({ year, trend });
  } catch (error) {
    console.error('Monthly trend error:', error);
    res.status(500).json({ error: 'Failed to generate trend report' });
  }
});

export default router;
