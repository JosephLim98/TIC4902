import * as flinkService from '../service/flinkService.js'
import logger from '../utils/logger.js'

function formatDeploymentResponse(deployment) {
    const crdResource = deployment.resources?.[0];
    const ks = deployment.kubernetesStatus; 
    return {
        id: deployment.id,
        deploymentName: deployment.deploymentName,
        namespace: deployment.namespace,
        status: deployment.status,
        pendingAction: deployment.pendingAction,
        deploymentMode: deployment.deploymentMode,
        config: deployment.config,
        createdAt: deployment.createdAt,
        kubernetesStatus: deployment.kubernetesStatus ?? undefined,
        flinkDeployment: crdResource && {
            name: crdResource.name,
            uid: crdResource.uid,
            apiVersion: crdResource.apiVersion
        },
        hasSavepoint: (ks?.jobStatus?.savepointInfo?.savepointHistory?.length > 0) || !!ks?.jobStatus?.upgradeSavepointPath,
        ...(deployment.jar && { jar: { id: deployment.jar.id, name: deployment.jar.name } }),
        ...(deployment.environmentVariables && { environmentVariables: deployment.environmentVariables }),
        ...(deployment.jobParallelism     && { jobParallelism: deployment.jobParallelism }),
        ...(deployment.stateBucketName    && { stateBucketName: deployment.stateBucketName }),
        ...(deployment.lastSavepointPath  && { lastSavepointPath: deployment.lastSavepointPath }),
    };
}

export async function createDeployment(req, res, next) {
    try {
        const flinkDto =  req.body;
        logger.info('Received deployment creation request', {
            deploymentName: flinkDto.deploymentName,
            namespace: flinkDto.namespace,
            mode: flinkDto.jarId ? 'application' : 'session',
            jarId: flinkDto.jarId || undefined
          });
        
          const deployment = await flinkService.createDeployment(flinkDto);
          const responseData = {
            ...formatDeploymentResponse(deployment),
            ...(deployment.jar && { jar: deployment.jar })
          };
          res.status(201).json(responseData);
    }   catch(error){
        next(error);
    }
}

export async function deleteDeployment(req, res, next) {
    try {
        const { deploymentName } = req.params;
        logger.info('Received deployment deletion request', { deploymentName });
        const deployment = await flinkService.deleteDeployment(deploymentName);
        res.status(200).json(formatDeploymentResponse(deployment));
    } catch (error) {
        next(error);
    }
}

export async function getDeployment(req, res, next) {
    try {
        const { deploymentName } = req.params;
        logger.info('Received get deployment request', { deploymentName });
        const deployment = await flinkService.getDeployment(deploymentName);
        res.status(200).json(formatDeploymentResponse(deployment));
    } catch(error) {
        next(error);
    }
}

export async function listDeployments(req, res, next) {
    try {
        logger.info('Received list deployments request');
        const deployments = await flinkService.listDeployments();
        res.status(200).json({
            deployments: deployments.map(formatDeploymentResponse),
            total: deployments.length
        });
    } catch(error) {
        next(error);
    }
}

export async function triggerSavepoint(req, res, next) {
    try {
        const { deploymentName } = req.params;
        logger.info('Received savepoint trigger request', { deploymentName });
        const result = await flinkService.triggerSavepoint(deploymentName);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}

export async function updateDeployment(req, res, next) {
    try {
        const { deploymentName } = req.params;
        console.log('BACKEND RECEIVED BODY: ', JSON.stringify(req.body, null, 2));
        logger.info('Received deployment update request', { deploymentName });
        const deployment = await flinkService.updateDeployment(deploymentName, req.body);
        res.status(200).json(formatDeploymentResponse(deployment));
    } catch (error) {
        next(error);
    }
}

export async function resumeDeployment(req, res, next) {
    try {
        const { deploymentName } = req.params;
        const { savepointId, skipSavepoint } = req.body ?? {};
        logger.info('Received resume deployment request', { deploymentName, savepointId: savepointId ?? null, skipSavepoint: !!skipSavepoint });
        const deployment = await flinkService.resumeDeployment(deploymentName, { savepointId, skipSavepoint });
        res.status(200).json(formatDeploymentResponse(deployment));
    } catch (error) {
        next(error);
    }
}

export async function listSavepoints(req, res, next) {
    try {
        const { deploymentName } = req.params;
        logger.info('Received list savepoints request', { deploymentName });
        const savepoints = await flinkService.listSavepoints(deploymentName);
        res.status(200).json({
            savepoints: savepoints.map(sp => ({
                id: sp.id,
                path: sp.path,
                source: sp.source,
                createdAt: sp.createdAt,
            })),
            total: savepoints.length,
        });
    } catch (error) {
        next(error);
    }
}

// graceful stop but takes a savepoint first
export async function stopDeployment(req, res, next) {
    try {
        const { deploymentName } = req.params;
        logger.info('Received stop deployment request', { deploymentName });
        const deployment = await flinkService.stopDeployment(deploymentName, false);
        res.status(200).json(formatDeploymentResponse(deployment));
    } catch (error) {
        next(error);
    }
}

// no savepoint, immediate kill
export async function forceStopDeployment(req, res, next) {
    try {
        const { deploymentName } = req.params;
        logger.info(`Received force stop deployment request for ${deploymentName}`, { deploymentName });
        const deployment = await flinkService.stopDeployment(deploymentName, true);
        res.status(200).json(formatDeploymentResponse(deployment));
    } catch (error) {
        next(error);
    }
}

export async function getDeploymentDiagnostics(req, res, next) {
    try {
      const { deploymentName } = req.params;
  
      logger.info('Received deployment diagnostics request', { deploymentName });
  
      const diagnostics = await flinkService.getDeploymentDiagnostics(deploymentName);
  
      res.status(200).json(diagnostics);
    } catch (error) {
      next(error);
    }
  }