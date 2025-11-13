import express from 'express'
import {registerUser, loginUser} from '../controller/authController.js';

const router = express.Router();

//register
router.post("/auth/register", registerUser);

//login
router.post("/auth/login", loginUser);

export default router;