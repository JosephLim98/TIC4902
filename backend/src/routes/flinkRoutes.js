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
router.post('/deployments/:deploymentName/resume', flinkController.resumeDeployment);
router.post('/deployments/:deploymentName/stop', flinkController.stopDeployment);
router.post('/deployments/:deploymentName/force-stop', flinkController.forceStopDeployment);
router.post('/deployments/:deploymentName/savepoint', flinkController.triggerSavepoint);
router.get('/deployments/:deploymentName/savepoints', flinkController.listSavepoints);

export default router;