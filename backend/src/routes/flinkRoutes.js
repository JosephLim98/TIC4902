import express from "express";
import * as flinkController from "../controller/flinkController.js";
import * as logController from "../controller/logController.js";
import authMiddleware from "../middleware/auth.js";
import dashboardAuth from "../middleware/dashboardAuth.js";
import validateRequest from "../middleware/validateRequest.js";
import {
  createDeploymentSchema,
  updateDeploymentSchema,
} from "../validators/flinkValidator.js";
const router = express.Router();

// Dashboard proxy — accepts dash_token query param or JWT (registered before global auth)
router.use(
  "/deployments/:deploymentName/dashboard",
  dashboardAuth,
  flinkController.proxyDashboard,
);

// These endpoints can create, stop, resume or delete live infrastructure, so they must never be reachable unauthenticated
router.use(authMiddleware);

router.get("/deployments", flinkController.listDeployments);
router.get("/deployments/:deploymentName", flinkController.getDeployment);
router.get(
  "/deployments/:deploymentName/dashboard-url",
  flinkController.getDashboardUrl,
);
router.delete("/deployments/:deploymentName", flinkController.deleteDeployment);
router.post(
  "/deployments",
  validateRequest(createDeploymentSchema),
  flinkController.createDeployment,
);
router.put(
  "/deployments/:deploymentName",
  validateRequest(updateDeploymentSchema),
  flinkController.updateDeployment,
);
router.post(
  "/deployments/:deploymentName/resume",
  flinkController.resumeDeployment,
);
router.post(
  "/deployments/:deploymentName/stop",
  flinkController.stopDeployment,
);
router.post(
  "/deployments/:deploymentName/force-stop",
  flinkController.forceStopDeployment,
);
router.post(
  "/deployments/:deploymentName/savepoint",
  flinkController.triggerSavepoint,
);
router.get(
  "/deployments/:deploymentName/savepoints",
  flinkController.listSavepoints,
);
router.get(
  "/deployments/:deploymentName/diagnostics",
  flinkController.getDeploymentDiagnostics,
);

router.get(
  "/deployments/:deploymentName/logs",
  logController.streamDeploymentLogs,
);

export default router;
