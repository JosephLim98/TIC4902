import jwt from 'jsonwebtoken'

// Middleware to verify JWT token from Authorization header. Attaches decoded user payload to req.user

export default function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];       // Bearer <token>

    if (!token) {
        return res.status(401).json({ status: 401, message: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;        // { id, username, email, ...}
        next();
    } catch (err) {
        return res.status(403).json({ status: 403, message: 'Invalid or expired token' });
    }
}