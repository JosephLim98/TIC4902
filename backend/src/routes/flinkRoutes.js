import express from 'express';
const router = express.Router();
import * as flinkController from '../controller/flinkController.js'
import validateRequest from '../middleware/validateRequest.js';
import { createDeploymentSchema, updateDeploymentSchema } from '../validators/flinkValidator.js'


router.get('/deployments', flinkController.listDeployments);
router.get('/deployments/:deploymentName', flinkController.getDeployment);
router.delete('/deployments/:deploymentName', flinkController.deleteDeployment);
router.post(
    '/deployments',
    validateRequest(createDeploymentSchema),
    flinkController.createDeployment
)
router.put(
    '/deployments/:deploymentName', 
    validateRequest(updateDeploymentSchema), 
    flinkController.updateDeployment
);

export default router;