import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT and add user info to req
export const authenticateToken = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Add user info to request object (similar to session)
        req.user = {
            userId: decoded.userId,
            userName: decoded.userName,
            companyId: decoded.companyId,
            companyName: decoded.companyName,
            companyCode: decoded.companyCode
        };

        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// Middleware to check if company is selected
export const requireCompany = (req, res, next) => {
    if (!req.user.companyId) {
        return res.status(403).json({ error: 'Company selection required' });
    }
    next();
};
