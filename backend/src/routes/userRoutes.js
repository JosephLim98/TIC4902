import express from 'express';
import authMiddleware from '../middleware/auth.js';
import { getProfile, updateProfile, changePassword, deleteAccount } from '../controller/userController.js';

const router = express.Router();

// All user routes require a valid JWT
router.use(authMiddleware);

router.get('/profile', getProfile)              // READ

router.patch('/profile', updateProfile);        // UPDATE username / email
router.patch('/password', changePassword);      // UPDATE password

router.delete('/account', deleteAccount);

export default router;