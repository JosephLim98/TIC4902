import express from 'express';
const router = express.Router();
import * as flinkController from '../controller/flinkController.js'
import validateRequest from '../middleware/validateRequest.js';
import {createDeploymentSchema} from '../validators/flinkValidator.js'


router.get('/deployments', flinkController.listDeployments);
router.get('/deployments/:deploymentName', flinkController.getDeployment);
router.post(
    '/deployments',
    validateRequest(createDeploymentSchema),
    flinkController.createDeployment
)

export default router;