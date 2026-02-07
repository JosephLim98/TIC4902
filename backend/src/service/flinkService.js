import sequelize from '../config/database.js';
import { FlinkConfig } from '../models/flinkConfigModel.js';
import { Deployment } from '../models/index.js';
import logger from '../utils/logger.js';
import { DEPLOYMENT_STATUS } from '../utils/constants.js';
import * as k8sService from './kubernetesService.js';
import { ConflictError, KubernetesError } from '../utils/errors.js';


async function getFlinkConfig() {
    const config = await FlinkConfig.findOne({oreder: [['id', 'ASC']]})
    return config;
}

async function applyConfigDefaults(deploymentData) {
    const defaults = await getFlinkConfig();
  
    return {
      namespace: deploymentData.namespace || defaults.namespace,
      image: deploymentData.config?.image || defaults.image,
      flinkVersion: deploymentData.config?.flinkVersion || defaults.flinkVersion,
      serviceAccount: deploymentData.config?.serviceAccount || defaults.serviceAccount,
      jobManager: {
        memory: deploymentData.config?.jobManager?.memory || defaults.jobManagerMemory,
        cpu: deploymentData.config?.jobManager?.cpu || defaults.jobManagerCpu,
        replicas: deploymentData.config?.jobManager?.replicas || defaults.jobManagerReplicas
      },
      taskManager: {
        memory: deploymentData.config?.taskManager?.memory || defaults.taskManagerMemory,
        cpu: deploymentData.config?.taskManager?.cpu || defaults.taskManagerCpu,
        replicas: deploymentData.config?.taskManager?.replicas || defaults.taskManagerReplicas,
        taskSlots: deploymentData.config?.taskManager?.taskSlots || defaults.taskManagerSlots
      },
      flinkConfiguration: deploymentData.config?.flinkConfiguration || {}
    };
  }

  function validateParallelism(parallelism, taskManagerConfig) {
    if (!parallelism) return;
  
    const totalSlots = taskManagerConfig.replicas * taskManagerConfig.taskSlots;
    if (parallelism > totalSlots) {
      throw new ValidationError(
        `Job parallelism (${parallelism}) exceeds available task slots (${totalSlots}). ` +
        `With ${taskManagerConfig.replicas} TaskManagers and ${taskManagerConfig.taskSlots} slots each, ` +
        `maximum parallelism is ${totalSlots}.`
      );
    }
  }


export async function createDeployment(deploymentData){
    const fullConfig = await applyConfigDefaults(deploymentData);
    const {
        deploymentName,
        jarName,      
        jarId,       
        programArgs,
        environmentVariables,
        jobParallelism
      } = deploymentData;

      const deploymentMode = (jarName || jarId) ? 'application' : 'session';

      validateParallelism(jobParallelism, fullConfig.taskManager);

      logger.info('Starting FlinkDeployment creation', {
        deploymentName,
        namespace: fullConfig.namespace,
        deploymentMode,
        jarName: jarName || undefined,
        jarId: jarId || undefined,
        config: fullConfig
      });

      // Used to ensure atomicity
      const transaction = await sequelize.transaction();

      //TODO: Add Jar logic manipulation here

      try {
        const existingDeployment = await Deployment.findOne({
            where: {deploymentName},
            transaction
          })
          if(existingDeployment){
            throw new ConflictError(`Deployment with name '${deploymentName}' already exists`, deploymentName)
          }
    
          const deployment = await Deployment.create({
            deploymentName,
            namespace: fullConfig.namespace,
            status: DEPLOYMENT_STATUS.CREATING,
            config: fullConfig,
            deploymentMode,
            jarId: jarId || null,
            programArgs: programArgs || null,
            environmentVariables: environmentVariables || null,
            jobParallelism: jobParallelism || null
          }, { transaction });
    
          logger.info('Created database record', {id: deployment.id, deploymentName, deploymentMode});
    
          let crdMetadata;
          try {
            crdMetadata = await k8sService.createFlinkCluster(deploymentName, fullConfig.namespace, fullConfig, null, environmentVariables);
            logger.info('Created FlinkDeployment CRD', {deploymentName, deploymentMode, uid: crdMetadata.uid});
          } catch (k8sError) {
            logger.error('FlinkDeployment CRD creation failed', {deploymentName, error: k8sError.message});
            throw new KubernetesError(k8sError.message, k8sError);
          }
    
          deployment.resources = [crdMetadata];
          deployment.status = DEPLOYMENT_STATUS.RUNNING;
          await deployment.save({transaction});
          await transaction.commit();
    
          logger.info('Deployment creation is successful', {deploymentName, deploymentMode, id: deployment.id});
          await deployment.reload();
    
          const result = deployment.toJSON();
          //TODO: Add jar details when applicable to result
          return result;
      } catch (error) {
        if (!transaction.finished) {
          await transaction.rollback();
          logger.error('Deployment failed, transaction rolled back', {deploymentName, error: error.message});
        }
        throw error;
      }


}