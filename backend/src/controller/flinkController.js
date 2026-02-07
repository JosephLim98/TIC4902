import * as flinkService from '../service/flinkService.js'
import logger from '../utils/logger.js'

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
          const crdResource = deployment.resources?.[0];

          const responseData = {
            id: deployment.id,
            deploymentName: deployment.deploymentName,
            namespace: deployment.namespace,
            status: deployment.status,
            deploymentMode: deployment.deploymentMode,
            config: deployment.config,
            createdAt: deployment.createdAt,
            flinkDeployment: crdResource && {
                name: crdResource.name,
                uid: crdResource.uid,
                apiVersion: crdResource.apiVersion
            },
            ...(deployment.jar && {jar: deployment.jar}),
            ...(deployment.environmentVariables && {environmentVariables: deployment.environmentVariables}),
            ...(deployment.jobParallelism && {jobParallelism: deployment.jobParallelism})
          };
          res.status(201).json(responseData);
    }   catch(error){
        next(error);
    }
}