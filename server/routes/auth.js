import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../database/init.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const [users] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
        const user = users[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                userId: user.id,
                userName: user.name
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name
            },
            requireCompanySelection: true
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Logout (with JWT, logout is handled on frontend by removing token)
router.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

// Check session/token
router.get('/session', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.json({ authenticated: false });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({
            authenticated: true,
            user: {
                id: decoded.userId,
                name: decoded.userName
            },
            companyId: decoded.companyId || null,
            companyName: decoded.companyName || null
        });
    } catch (error) {
        res.json({ authenticated: false });
    }
});

// Change password
router.post('/change-password', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const { currentPassword, newPassword } = req.body;

        const [users] = await db.execute('SELECT * FROM users WHERE id = ?', [decoded.userId]);
        const user = users[0];

        if (!await bcrypt.compare(currentPassword, user.password)) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, decoded.userId]);

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

export default router;
