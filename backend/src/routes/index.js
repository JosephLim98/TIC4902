import express from 'express';
const router =  express.Router();
import flinkRoutes from './flinkRoutes.js';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import jarRoutes from './jarRoutes.js';

router.use('/flink', flinkRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/jars', jarRoutes);

export default router;