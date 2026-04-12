import * as flinkService from '../service/flinkService.js'
import logger from '../utils/logger.js'

function formatDeploymentResponse(deployment) {
    const crdResource = deployment.resources?.[0];
    return {
        id: deployment.id,
        deploymentName: deployment.deploymentName,
        namespace: deployment.namespace,
        status: deployment.status,
        deploymentMode: deployment.deploymentMode,
        config: deployment.config,
        createdAt: deployment.createdAt,
        kubernetesStatus: deployment.kubernetesStatus ?? undefined,
        flinkDeployment: crdResource && {
            name: crdResource.name,
            uid: crdResource.uid,
            apiVersion: crdResource.apiVersion
        },
        ...(deployment.environmentVariables && { environmentVariables: deployment.environmentVariables }),
        ...(deployment.jobParallelism && { jobParallelism: deployment.jobParallelism })
    };
}

export async function createDeployment(req, res, next) {
    try {
        const flinkDto =  req.body;
        const isApplicationMode = flinkDto.jarName || flinkDto.jarId;
        
        logger.info('Received deployment creation request', {
            deploymentName: flinkDto.deploymentName,
            namespace: flinkDto.namespace,
            mode: isApplicationMode ? 'application' : 'session',
            jarName: flinkDto.jarName || undefined,
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