import sequelize from '../config/database.js';
import { FlinkConfig } from '../models/flinkConfigModel.js';
import { Deployment, Jar } from '../models/index.js';
import logger from '../utils/logger.js';
import { DEPLOYMENT_STATUS, FLINK_MODE, SAVEPOINT_POLL } from '../utils/constants.js';
import * as k8sService from './kubernetesService.js';
import { ConflictError, KubernetesError, NotFoundError, ValidationError } from '../utils/errors.js';
import { getJarById } from './jarService.js';
import { buildStateBucketName, ensureStateBucketExists, deleteStateBucket } from './minioService.js';

async function getFlinkConfig() {
    const config = await FlinkConfig.findOne({order: [['id', 'ASC']]})
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
        jarId,
        programArgs,
        environmentVariables,
        jobParallelism
      } = deploymentData;

      const deploymentMode = jarId ? 'application' : 'session';

      validateParallelism(jobParallelism, fullConfig.taskManager);

      logger.info('Starting FlinkDeployment creation', {
        deploymentName,
        namespace: fullConfig.namespace,
        deploymentMode,
        jarId: jarId || undefined,
        config: fullConfig
      });

      let resolvedJar = null;
      if (deploymentMode === FLINK_MODE.APPLICATION) {
        if (jarId) {
          resolvedJar = await getJarById(jarId);
        } else {
          throw new ValidationError('Application mode requires jarId');
        }
      }

      let stateBucketName = null;
      if (deploymentMode === 'application') {
        stateBucketName = buildStateBucketName(deploymentName);
        await ensureStateBucketExists(stateBucketName);
        logger.info('Provisioned state bucket', { stateBucketName });
      }

      // Used to ensure atomicity
      const transaction = await sequelize.transaction();

      try {
        const existingDeployment = await Deployment.findOne({
            where: {deploymentName},
            transaction
          })
          if(existingDeployment){
            throw new ConflictError(`Deployment with name '${deploymentName}' already exists`, deploymentName)
          }

          /*
          // Application mode requires a registered JAR. Need to find it and build the JAR spec object that the CRD template needs to populate spec.job.
          let jarSpec = null;
          let jar = null;
          if (deploymentMode === 'application') {
            if (!jarId) {
              throw new ValidationError('Application mode deployments require a jarId');
            }
            jar = await Jar.findByPk(jarId, { transaction });

            if (!jar) {
              throw new NotFoundError(`JAR with id '${jarId}' not found`, jarId);
            }

            jarSpec = {
              jarUrl: jar.uri,
              ...(jobParallelism && { parallelism: jobParallelism }),
              ...(jar.entryClass && { mainClass: jar.entryClass })
            };
          }
          */
    
          const deployment = await Deployment.create({
            deploymentName,
            namespace: fullConfig.namespace,
            status: DEPLOYMENT_STATUS.CREATING,
            config: fullConfig,
            deploymentMode,
            jarId: jarId || null,
            programArgs: programArgs || null,
            environmentVariables: environmentVariables || null,
            jobParallelism: jobParallelism || null,
            stateBucketName: stateBucketName || null,
          }, { transaction });
    
          logger.info('Created database record', {id: deployment.id, deploymentName, deploymentMode});
    
          const jarSpec = resolvedJar
            ? { jarUrl: resolvedJar.url, parallelism: jobParallelism || null }
            : null;

          let crdMetadata;
          try {
            crdMetadata = await k8sService.createFlinkCluster(deploymentName, fullConfig.namespace, fullConfig, jarSpec, environmentVariables, stateBucketName);
            logger.info('Created FlinkDeployment CRD', {deploymentName, deploymentMode, uid: crdMetadata.uid});
          } catch (k8sError) {
            logger.error('FlinkDeployment CRD creation failed', {deploymentName, error: k8sError.message});
            throw new KubernetesError(k8sError.message, k8sError);
          }
    
          deployment.resources = [crdMetadata];
          await deployment.save({transaction});
          await transaction.commit();
    
          logger.info('Deployment creation is successful', {deploymentName, deploymentMode, id: deployment.id});
          await deployment.reload();
    
          const result = deployment.toJSON();
          if (resolvedJar?.id) {
            result.jar = { id: resolvedJar.id, name: resolvedJar.name, url: resolvedJar.url };
          }
          return result;
      } catch (error) {
        if (!transaction.finished) {
          await transaction.rollback();
          logger.error('Deployment failed, transaction rolled back', {deploymentName, error: error.message});
        }
        throw error;
      }
}

// Map the combination of K8s lifecycleState and Flink's own job state to our app-level DEPLOYMENT_STATUS
// lifecycleState along is not enough. A healthy and long-running job sits in lifecycleState "DEPLOYED" for forever, which is the operator's normal steady state, not really "still starting up"
// Without also checking the jobStatus.state, we'd show "CREATING" forever even for jobs that have been running fine for hours
function resolveDeploymentStatus(kubernetesStatus, deploymentMode) {
  const lifecycleState = kubernetesStatus?.lifecycleState;
  const jobState = kubernetesStatus?.jobStatus?.state;
  const specJobState = kubernetesStatus?.specJobState;

  // Rollback/deleting or explicit terminal failure take priority regardless of job state
  if (lifecycleState === 'ROLLING_BACK') {
  // if (lifecycleState === DEPLOYMENT_STATUS.ROLLING_BACK) {
    return DEPLOYMENT_STATUS.ROLLING_BACK;
  }
  if (lifecycleState === 'DELETING') {
  // if (lifecycleState === DEPLOYMENT_STATUS.DELETING) {
    return DEPLOYMENT_STATUS.DELETING;
  }
  if (lifecycleState === 'FAILED') {
  // if (lifecycleState === DEPLOYMENT_STATUS.FAILED) {
    return DEPLOYMENT_STATUS.FAILED;
  }

  // Session mode deployments have no Flink job to track. lifecycleState is authoritative
  if (deploymentMode === FLINK_MODE.SESSION) {
    if (lifecycleState === 'DEPLOYED' || lifecycleState === 'STABLE') {
      return DEPLOYMENT_STATUS.RUNNING;
    }
    if (lifecycleState === 'CREATED') {
      return DEPLOYMENT_STATUS.CREATING;
    }
    return null;
  }

  // Application mode. Flink's own job state is the more accurate signal
  if (jobState === 'RUNNING') {
    return DEPLOYMENT_STATUS.RUNNING;
  }
  if (jobState === 'FINISHED') {
    return specJobState === 'suspended' ? DEPLOYMENT_STATUS.SUSPENDED : DEPLOYMENT_STATUS.SUCCEEDED;
  }
  if (jobState === 'FAILED') {
    return DEPLOYMENT_STATUS.FAILED;
  }

  if (kubernetesStatus?.error) {
    return DEPLOYMENT_STATUS.FAILED;
  }

  // If no conclusive job state yet (RECONCILING, CREATED, or null), then just fall back to lifecycleState, only to decide between "still creating" and "suspended". "running" should not be claimed purely from lifecycleState alone
  if (lifecycleState === 'SUSPENDED') {
    return DEPLOYMENT_STATUS.SUSPENDED;
  }

  if (lifecycleState === 'CREATED' || lifecycleState === 'DEPLOYED') {
    return DEPLOYMENT_STATUS.CREATING;
  }

  return null;
  
}

// Extract a user-friendly error message from the operator's status.error object. 
// The field can be a plain string or an object like 
// Strip the leading Java class name prefix when present ("a.b.Class: message -> message")
function extractK8sErrorMessage(error) {
  if (!error) {
    return null;
  }
  if (typeof error === 'string') {
    const colonIdx = error.indexOf(': ');
    return (colonIdx > 0 && error.substring(0, colonIdx).includes('.')) ? error.substring(colonIdx + 2) : error;
  }
  if (error.message) {
    const message = error.message;
    const colonIdx = message.indexOf(': ');
    return (colonIdx > 0 && message.substring(0, colonIdx).includes('.')) ? message.substring(colonIdx + 2) : message;
  }
  return JSON.stringify(error);
}

async function syncDeployment(deployment) {
  if (deployment.status === DEPLOYMENT_STATUS.DELETED) {
    const result = deployment.toJSON();
    result.kubernetesStatus = null;
    return result;
  }

  // While an action is in flight, don't let a concurrent k8s poll overwrite the in-progress state out from under it
  // if (deployment.pendingAction) {
  //   const result = deployment.toJSON();
  //   const kubernetesStatus = await k8sService.getFlinkDeploymentStatus(deployment.deploymentName, deployment.namespace);
  //   result.kubernetesStatus = kubernetesStatus;
  //   return result;
  // }

  const kubernetesStatus = await k8sService.getFlinkDeploymentStatus(
    deployment.deploymentName,
    deployment.namespace
  );

  // When CRD cannot be found, the resources created will be marked as deleted
  if (!kubernetesStatus && !deployment.pendingAction && deployment.status !== DEPLOYMENT_STATUS.DELETED) {
    deployment.status = DEPLOYMENT_STATUS.DELETED;
    deployment.errorMessage = null;
    await deployment.save();
    logger.info('CRD not found in k8s, marking deployment as deleted', { deploymentName: deployment.deploymentName });
    const done = deployment.toJSON();
    done.kubernetesStatus = null;
    return done;
  }

  // While an action (stop/force-stop/resume/delete) is in flight, we still poll K8s,
  // but we must not clear the pendingAction or update status until K8s confirms completion of the requested transition.
  // Until then, we keep returning the pre-action status alongside the still-set pendingAction, 
  // which is what the frontend uses to know to keep polling and shows a 'Stopping...'/'Resuming...'/'Deleting...' indicator 
  // instead of a stale badge that looks like the action silently did nothing
  if (deployment.pendingAction) {

    const staleResult = deployment.toJSON();
    staleResult.kubernetesStatus = kubernetesStatus;

    // const lifecycleState = kubernetesStatus?.lifecycleState;
    // const jobState = kubernetesStatus?.jobStatus?.state;

    // delete: CRD confirmed gone once k8s API can no longer find it
    if (deployment.pendingAction === 'delete') {
      if (!kubernetesStatus) {
        deployment.status = DEPLOYMENT_STATUS.DELETED;
        deployment.pendingAction = null;
        deployment.errorMessage = null;
        
        await deployment.save();
        logger.info('Deletion confirmed by k8s', { deploymentName: deployment.deploymentName });
        const done = deployment.toJSON();
        done.kubernetesStatus = null;

        return done;
      }

      return staleResult;
    }

    const mappedStatus = resolveDeploymentStatus(kubernetesStatus, deployment.deploymentMode);
    const k8sErrorMessage = extractK8sErrorMessage(kubernetesStatus?.error);

    const isStopComplete = (deployment.pendingAction === 'stop' || deployment.pendingAction === 'force_stop') && mappedStatus === DEPLOYMENT_STATUS.SUSPENDED;
    const isResumeComplete = deployment.pendingAction === 'resume' && mappedStatus === DEPLOYMENT_STATUS.RUNNING;

    // Resolve out of pending state if job outright fails while we're waiting on it (e.g. stop requested but the job crashes instead of suspending cleanly), so the frontend doesn't spin on 'Stopping... or 'Resuming...' forever
    const failedWhilePending = mappedStatus === DEPLOYMENT_STATUS.FAILED;

    if (isStopComplete || isResumeComplete || failedWhilePending) {
      // Location can be undefined if  k8s status not sync yet skip update than use a undefined value
      if (isStopComplete && deployment.pendingAction === 'stop') {
        const location = kubernetesStatus?.jobStatus?.savepointInfo?.lastSavepoint?.location;
        if (location) {
          deployment.lastSavepointPath = location;
        }
      }
      deployment.status = mappedStatus;
      deployment.pendingAction = null;
      deployment.errorMessage = k8sErrorMessage;
      await deployment.save();
      logger.info('Pending action resolved', {
        deploymentName: deployment.deploymentName,
        pendingAction: deployment.pendingAction,
        resolvedStatus: mappedStatus,
      })
      const done = deployment.toJSON();
      done.kubernetesStatus = kubernetesStatus;
      return done;
    }

    // still in flight. keep pendingAction set as frontend keeps polling
    return staleResult;
  }
  
  const mappedStatus = resolveDeploymentStatus(kubernetesStatus, deployment.deploymentMode);

  // Extract operator's error message (null means no error / error was cleared)
  const k8sErrorMessage = extractK8sErrorMessage(kubernetesStatus?.error);
  const statusChanged = mappedStatus && mappedStatus !== deployment.status;
  const errorChanged = k8sErrorMessage !== deployment.errorMessage;

  if (statusChanged || errorChanged) {
    if (statusChanged) {
      deployment.status = mappedStatus;
      deployment.errorMessage = k8sErrorMessage;
      await deployment.save();

      if (statusChanged) {
        deployment.status = mappedStatus;
        deployment.errorMessage = k8sErrorMessage;
        await deployment.save();
        logger.info('Synced deployment status from K8s', {
          deploymentName: deployment.deploymentName,
          mappedStatus,
          lifecycleState: kubernetesStatus?.lifecycleState,
          jobState: kubernetesStatus?.jobStatus?.state,
          error: k8sErrorMessage ?? undefined,
        });
      }
    }
  }

  const result = deployment.toJSON();
  result.kubernetesStatus = kubernetesStatus;
  return result;
}

export async function deleteDeployment(deploymentName) {
    const deployment = await Deployment.findOne({ where: { deploymentName } });
    if (!deployment) {
        throw new NotFoundError(`Deployment '${deploymentName}' not found`, deploymentName);
    }
    if (deployment.status === DEPLOYMENT_STATUS.DELETED) {
        throw new ConflictError(`Deployment '${deploymentName}' is already deleted`, deploymentName);
    }

    if (deployment.pendingAction) {
      throw new ConflictError(`Deployment '${deploymentName} has a '${deployment.pendingAction} operation already in progress`, deploymentName);
    }

    deployment.pendingAction = 'delete';
    await deployment.save();

    try {
        await k8sService.deleteFlinkDeployment(deploymentName, deployment.namespace);
    } catch (k8sError) {
        deployment.status = DEPLOYMENT_STATUS.FAILED;
        deployment.errorMessage = k8sError.message;
        deployment.pendingAction = null;
        await deployment.save();
        logger.error('K8s delete failed, marked deployment as failed', { deploymentName, error: k8sError.message });
        throw k8sError;
    }

    if (deployment.stateBucketName) {
        await deleteStateBucket(deployment.stateBucketName);
    }

    // Intentionally not marking this as DELETED yet and do not clear pendingAction. k8s API call only means deletion was accepted. The operator may still be finalizing it, e.g. draining/tearing down the pods, before hte CRD actually disappears
    // syncDeployment() flips status to DELETED and clears pendingAction once k8s confirms CRD is actually gone
    // Same pattern is used for stop/force-stop/resume above.
    logger.info('Deletion requested for deployment, awaiting k8s confirmation', { deploymentName, id: deployment.id });
    return deployment.toJSON();

    // deployment.status = DEPLOYMENT_STATUS.DELETED;
    // deployment.errorMessage = null;
    // deployment.pendingAction = null;
    // await deployment.save();

    // logger.info('Deployment deletion successful', { deploymentName, id: deployment.id });
    return deployment.toJSON();
}

export async function getDeployment(deploymentName) {
    const deployment = await Deployment.findOne({ 
      where: { deploymentName },
      include: [{ model: Jar, as: 'jar', attributes: ['id', 'name' ]}]
    });
    if (!deployment) throw new NotFoundError(`Deployment '${deploymentName}' not found`, deploymentName);

    return await syncDeployment(deployment);
}

export async function listDeployments() {
    const deployments = await Deployment.findAll({ 
      order: [['created_at', 'DESC']],
      include: [{ model: Jar, as: 'jar', attributes: ['id', 'name' ]}]
    });
    return Promise.all(deployments.map(d => syncDeployment(d)));
}

export async function triggerSavepoint(deploymentName) {
  const deployment = await Deployment.findOne({ where: { deploymentName } });
  if (!deployment) throw new NotFoundError(`Deployment '${deploymentName}' not found`, deploymentName);
  if (deployment.deploymentMode !== 'application') {
    throw new ValidationError('Savepoints are only supported for application mode deployments');
  }
  if (deployment.status !== DEPLOYMENT_STATUS.RUNNING) {
    throw new ValidationError(`Savepoint can only be triggered on a running deployment (current: ${deployment.status})`);
  }
  
  const triggerTimeMs = Date.now();
  await k8sService.triggerSavepoint(deploymentName, deployment.namespace);
  logger.info('Savepoint triggered, polling for completion', { deploymentName });

  const deadline = Date.now() + SAVEPOINT_POLL.TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, SAVEPOINT_POLL.INTERVAL_MS));
    const statusResult = await k8sService.getSavepointStatus(deploymentName, deployment.namespace, triggerTimeMs);
    if (statusResult.failed) {
      throw new KubernetesError(`Savepoint failed for deployment '${deploymentName}': ${statusResult.failureReason || 'unknown error'}`);
    }
    const isFreshCompletion = statusResult.completed && statusResult.lastSavepointPath
      && statusResult.timestamp != null && statusResult.timestamp >= triggerTimeMs;
    if (isFreshCompletion) {
      deployment.lastSavepointPath = statusResult.lastSavepointPath;
      await deployment.save();
      logger.info('Savepoint completed and path stored', { deploymentName, path: statusResult.lastSavepointPath });
      return { savepointPath: statusResult.lastSavepointPath };
    }
  }

  throw new KubernetesError(`Savepoint timed out after ${SAVEPOINT_POLL.TIMEOUT_MS / 1000}s for deployment '${deploymentName}'`);
}

export async function updateDeployment(deploymentName, updateData) {
  const deployment = await Deployment.findOne({ where: { deploymentName } });
  if (!deployment) {
    throw new NotFoundError(`Deployment '${deploymentName}' not found`, deploymentName);
  }
  if ([DEPLOYMENT_STATUS.DELETED, DEPLOYMENT_STATUS.DELETING].includes(deployment.status)) {
    throw new ConflictError(`Cannot update a deployment in status '${deployment.status}'`, deploymentName);
  }

  // Editing only makes sense once the pipeline has settled into a terminal non-running state (excluding succeeded). A completed pipeline shuold be left as-is and shouldn't be edited
  if (![DEPLOYMENT_STATUS.SUSPENDED, DEPLOYMENT_STATUS.FAILED].includes(deployment.status)) {
    throw new ConflictError(`Cannot update a deployment in status '${deployment.status}'. Only suspended or failed deployments can be edited.`, deploymentName);
  }

  if (deployment.pendingAction) {
    throw new ConflictError(`Deployment ${deploymentName} has a '${deployment.pendingAction}' operation already in progress`, deploymentName);
  }

  // Immutable fields (namespace, flinkVersion, serviceAccount, deploymentMode, deploymentName) are intentionally excluded from updateData by the validator. We should not overwrite them here.
  const existingConfig = deployment.config;
  const mergedConfig = {
    // Preserve all existing top-level config fields (includes immutable: namespace, flinkVersion, serviceAccount which should never change after creation)
    ...existingConfig,

    // Only allow image to be patched at top level
    ...(updateData.config?.image !== undefined && { image: updateData.config.image }),
    jobManager: { ...existingConfig.jobManager, ...updateData.config?.jobManager },
    taskManager: { ...existingConfig.taskManager, ...updateData.config?.taskManager },

    // Deep-merge flinkConfiguration so collers can add/override individual keys without wiping out keys they didn't mention
    flinkConfiguration: {
      ...existingConfig.flinkConfiguration,
      ...updateData.config?.flinkConfiguration
    }

  };

  // console.log('FINAL MERGED CONFIG: ', JSON.stringify(mergedConfig, null, 2));

  const newParallelism = updateData.jobParallelism ?? deployment.jobParallelism;
  validateParallelism(newParallelism, mergedConfig.taskManager);

  const transaction = await sequelize.transaction();
  try {
    await deployment.update({
      // namespace is intentionally omitted - immutable in Kubernetes
      config: mergedConfig,
      ...(updateData.environmentVariables !== undefined && { environmentVariables: updateData.environmentVariables }),
      ...(updateData.jobParallelism !== undefined && { jobParallelism: updateData.jobParallelism }),
    }, { transaction });
    
    try {
      await k8sService.patchFlinkDeployment(
        deploymentName,
        deployment.namespace,
        mergedConfig,
        updateData.environmentVariables ?? deployment.environmentVariables,
      );
    } catch (k8sError) {
      logger.error('K8s patch failed', { deploymentName, error: k8sError.message });
      throw new KubernetesError(k8sError.message, k8sError);
    }
  
    await transaction.commit();
    logger.info('Deployment updated successfully', { deploymentName });
    await deployment.reload();
    return deployment.toJSON();
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }

}

export async function stopDeployment(deploymentName, forceStop = false) {
  const deployment = await Deployment.findOne({ where: { deploymentName } });

  if (!deployment) {
    throw new NotFoundError(`Deployment '${deploymentName}' not found`, deploymentName);
  }

  // TODO: Don't display the stop/force stop button for session mode deployments in frontend
  if (deployment.deploymentMode !== FLINK_MODE.APPLICATION) {
    throw new ValidationError('Stop/Force Stop operation is only supported for application mode deployments');
    // throw new ValidationError(`Stop operation is only applicable for application mode deployments`, deploymentName);
  }

  if (deployment.pendingAction) {
    throw new ConflictError(`Deployment '${deploymentName} has a '${deployment.pendingAction}' operation already in progress`, deploymentName);
  }

  // Stop/Force Stop only makes sense while the pipeline is actively running. It doesn't make sense to stop something that's already suspended, failed, still creating, rolling back, in an unknown state, or being deleted
  if (deployment.status !== DEPLOYMENT_STATUS.RUNNING) {
    throw new ConflictError(`Deployment '${deploymentName}' is not running. Current status is '${deployment.status}'`, deploymentName);
  }

  // if ([DEPLOYMENT_STATUS.SUSPENDED, DEPLOYMENT_STATUS.SUCCEEDED].includes(deployment.status)) {
  //   throw new ConflictError(`Deployment '${deploymentName}' is already ${deployment.status}`, deploymentName);
  // }

  // if ([DEPLOYMENT_STATUS.DELETED, DEPLOYMENT_STATUS.DELETING].includes(deployment.status)) {
  //   throw new ConflictError(`Cannot stop the deployment '${deploymentName}' in status '${deployment.status}'`, deploymentName);
  // }

  deployment.pendingAction = forceStop ? 'force_stop' : 'stop';
  await deployment.save();

  try {
    await k8sService.suspendFlinkDeployment(deploymentName, deployment.namespace, forceStop);
  } catch (k8sError) {
    deployment.pendingAction = null;
    await deployment.save();
    throw k8sError;
  }

  // deployment.pendingAction = null;
  // await deployment.save();
  
  // Intentionally leave pendingAction set here. k8s API call only means suspend request was accepted. Operator still must take a savepoint and tear the job down, which happens asynchronously
  // Clearing pendingAction before that finishes will make the frontend stop polling and show a stale "Running" status. Instead, syncDeployment() clears pendingAction and updates status once k8s confirms the job has reached suspended (or failed while waiting)
  logger.info(`Stop requested for deployment ${deploymentName}`, { deploymentName, forceStop });
  return deployment.toJSON();
  
}

export async function resumeDeployment(deploymentName) {
  const deployment = await Deployment.findOne({ where: { deploymentName } });
  if (!deployment) {
    throw new NotFoundError(`Deployment '${deploymentName}' not found`, deploymentName);
  }
  if (deployment.deploymentMode !== FLINK_MODE.APPLICATION) {
    throw new ValidationError('Resume is only supported for application mode deployments')
  }

  if (deployment.pendingAction) {
    throw new ConflictError(`Deployment '${deploymentName}' has a '${deployment.pendingAction}' operation already in progress`, deploymentName);
  }

  // Resume only makes sense from suspended (stopped/force stopped). Failed and unkonwon pipelines can also be (re)run via the same underlying k8s patch. A succeeded pipeline is done. Re-running it doesn't make sense, so it's intentionally excluded
  if (![DEPLOYMENT_STATUS.SUSPENDED, DEPLOYMENT_STATUS.FAILED, DEPLOYMENT_STATUS.UNKNOWN].includes(deployment.status)) {
    throw new ConflictError(`Aborting operation... Deployment '${deploymentName}' is not suspended, failed, or in an unknown state`, deploymentName);
  }

  // if (![DEPLOYMENT_STATUS.SUSPENDED, DEPLOYMENT_STATUS.FAILED, DEPLOYMENT_STATUS.SUCCEEDED].includes(deployment.status)) {
  //   throw new ConflictError(`Deployment '${deploymentName}' is not suspended, failed, or succeeded`, deploymentName);
  // }

  deployment.pendingAction = 'resume';
  await deployment.save();
  
  try {
    await k8sService.resumeFlinkDeployment(deploymentName, deployment.namespace);
  } catch (k8sError) {
    deployment.pendingAction = null;
    await deployment.save();
    throw k8sError;
  }

  // deployment.pendingAction = null;
  // await deployment.save();

  // Intentionally leave pendingAction set, similar to stopDeployment. Job hasn't actually restarted yet. It's only been asked to.
  // syncDeployment() clears pendingAction and flips status to RUNNING once k8s confirms the job actually came back up.
  logger.info(`Resume requested for deployment ${deploymentName}`, { deploymentName });
  return deployment.toJSON();
}