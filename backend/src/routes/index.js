import express from 'express';
const router =  express.Router();
import flinkRoutes from './flinkRoutes.js';
import authRoutes from './authRoutes.js';

router.use('/flink', flinkRoutes);
router.use('/auth', authRoutes);

export default router;