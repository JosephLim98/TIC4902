import rateLimit from 'express-rate-limit';

// Standard brute-force baseline: 5 attempts per 15 minutes per IP
export const loginLimiter = rateLimit({
    windowMs: 2 * 60 * 1000,
    // windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,      // RateLimit-* response headers
    legacyHeaders: false,
    message: { status: 429, message: 'Too many login attempts. Please try again later.' },
});

// Registration abuse (mass account creation)
export const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: true,      // RateLimit-* response headers
    legacyHeaders: false,
    message: { status: 429, message: 'Too many registration attempts. Please try again later.' },
});