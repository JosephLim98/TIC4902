import express from 'express'
import { registerUser, loginUser } from '../controller/authController.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

//register
router.post("/register", registerLimiter, registerUser);

//login
router.post("/login", loginLimiter, loginUser);

export default router;