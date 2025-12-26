import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './database/init.js';
import authRoutes from './routes/auth.js';
import companyRoutes from './routes/company.js';
import clientRoutes from './routes/clients.js';
import packageRoutes from './routes/packages.js';
import quotationRoutes from './routes/quotations.js';
import receiptRoutes from './routes/receipts.js';
import billRoutes from './routes/bills.js';
import reportRoutes from './routes/reports.js';
import pdfRoutes from './routes/pdf.js';
import sqftDefaultsRoutes from './routes/sqft-defaults.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// CORS Configuration - Allow frontend domain
const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];

// Middleware
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session management
app.use(session({
    secret: process.env.SESSION_SECRET || 'crm-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProduction, // Use secure cookies in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: isProduction ? 'none' : 'lax' // Required for cross-domain cookies
    }
}));

// Initialize database
await initializeDatabase();

// Test/Health Check Route
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Vishvakarma CRM Backend is running',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        port: PORT,
        database: {
            name: process.env.DB_NAME,
            host: process.env.DB_HOST
        }
    });
});

// Root API endpoint
app.get('/api', (req, res) => {
    res.json({
        message: 'Vishvakarma CRM API',
        version: '1.0.0',
        endpoints: [
            '/api/health',
            '/api/auth',
            '/api/company',
            '/api/clients',
            '/api/packages',
            '/api/quotations',
            '/api/receipts',
            '/api/bills',
            '/api/reports',
            '/api/pdf',
            '/api/sqft-defaults'
        ]
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/sqft-defaults', sqftDefaultsRoutes);

// Serve static files in production
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// Handle SPA routing
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(distPath, 'index.html'));
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 API available at http://localhost:${PORT}/api`);
});
