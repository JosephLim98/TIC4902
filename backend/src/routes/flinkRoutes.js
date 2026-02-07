import express from 'express';
const router = express.Router();
import * as flinkController from '../controller/flinkController.js'
import validateRequest from '../middleware/validateRequest.js';
import {createDeploymentSchema} from '../validators/flinkValidator.js'


router.post(
    '/deployments',
    validateRequest(createDeploymentSchema),
    flinkController.createDeployment
)

export default router;