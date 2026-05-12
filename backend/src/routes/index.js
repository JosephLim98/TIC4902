import express from 'express';
const router =  express.Router();
import flinkRoutes from './flinkRoutes.js';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';

router.use('/flink', flinkRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);

export default router;