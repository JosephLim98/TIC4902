import { KubernetesError } from "../utils/errors.js";
import { FLINK_CRD, FLINK_MODE } from "../utils/constants.js";
import { generateFlinkDeployment } from "../template/flinkDeploymentCrd.js";
import { k8sCustomApi } from "../config/kubernetes.js";
import logger from "../utils/logger.js";


export async function getFlinkDeploymentStatus(deploymentName, namespace) {
    try {
        const response = await k8sCustomApi.getNamespacedCustomObject({
            group: FLINK_CRD.GROUP,
            version: FLINK_CRD.VERSION,
            namespace,
            plural: FLINK_CRD.PLURAL,
            name: deploymentName
        });
        return {
            lifecycleState: response.status?.lifecycleState || null,
            jobManagerDeploymentStatus: response.status?.jobManagerDeploymentStatus || null,
            jobStatus: response.status?.jobStatus || null,
            specJobState: response.spec?.job?.state || null,
            error: response.status?.error || null
        };
    } catch (error) {
        logger.warn('Could not fetch K8s status', { deploymentName, namespace, error: error.message });
        return null;
    }
}

export async function deleteFlinkDeployment(deploymentName, namespace) {
    try {
        logger.info('Deleting FlinkDeployment CRD', { deploymentName, namespace });
        await k8sCustomApi.deleteNamespacedCustomObject({
            group: FLINK_CRD.GROUP,
            version: FLINK_CRD.VERSION,
            namespace,
            plural: FLINK_CRD.PLURAL,
            name: deploymentName
        });
        logger.info('Successfully deleted FlinkDeployment CRD', { deploymentName, namespace });
    } catch (error) {
        if (error.message?.includes('HTTP-Code: 404')) {
            logger.warn('FlinkDeployment CRD not found, treating as already deleted', { deploymentName, namespace });
            return;
        }
        const errorMsg = error.body?.message || error.message;
        logger.error('Failed to delete FlinkDeployment', { deploymentName, namespace, error: errorMsg });
        throw new KubernetesError(`Failed to delete FlinkDeployment: ${errorMsg}`, error);
    }
}

export async function createFlinkCluster(deploymentName, namespace, config, jarSpec = null, environmentVariables = null, stateBucketName = null){
    try {
        const mode = jarSpec ? FLINK_MODE.APPLICATION : FLINK_MODE.SESSION
        logger.info('Creating FlinkDeployment CRD', {deploymentName, namespace, mode});

        const flinkDeployment = generateFlinkDeployment(deploymentName, namespace, config, jarSpec, environmentVariables, stateBucketName);
        const response = await k8sCustomApi.createNamespacedCustomObject({
            group: FLINK_CRD.GROUP,
            version: FLINK_CRD.VERSION,
            namespace,
            plural: FLINK_CRD.PLURAL,
            body: flinkDeployment
          });
        logger.info('Successfully created FlinkDeployment', { deploymentName, namespace, mode, uid: response.metadata.uid, hasJob: !!jarSpec});

        return {
            kind: FLINK_CRD.KIND,
            name: deploymentName,
            namespace,
            uid: response.metadata.uid,
            apiVersion: `${FLINK_CRD.GROUP}/${FLINK_CRD.VERSION}`
          };
    } catch (error){
        const errorMsg = error.body?.message || error.message;
        logger.error('Failed to create FlinkDeployment', { deploymentName, namespace, error: errorMsg });
        throw new KubernetesError(`Failed to create FlinkDeployment: ${errorMsg}`, error);
    }
}

async function patchCustomObjectHelper({ group, version, namespace, plural, name, body }) {
    return await k8sCustomApi.patchNamespacedCustomObject({
        group,
        version,
        namespace,
        plural,
        name,
        body
    });
}

// Fetch live CRD as is (unlike getFlinkDeploymentStatus, which only extracts status fields)
// Used before patching so we know whether optional sub-objects (podTemplate) already exist
// JSON fetch 'replaces'/'add' cannot create missing intermediate parent objects, only the final key
async function getRawFlinkDeployment(deploymentName, namespace) {
    return await k8sCustomApi.getNamespacedCustomObject({
        group: FLINK_CRD.GROUP,
        version: FLINK_CRD.VERSION,
        namespace,
        plural: FLINK_CRD.PLURAL,
        name: deploymentName
    });
}

export async function triggerSavepoint(deploymentName, namespace) {
    const nonce = Date.now();
    const patch = [
        { op: 'add', path: '/spec/job/savepointTriggerNonce', value: nonce }
    ];
    try {
        await patchCustomObjectHelper({
            group: FLINK_CRD.GROUP,
            version: FLINK_CRD.VERSION,
            namespace,
            plural: FLINK_CRD.PLURAL,
            name: deploymentName,
            body: patch,
        });
        logger.info('Savepoint trigger nonce applied', { deploymentName, nonce });
        return nonce;
    } catch (error) {
        const errorMsg = error.body?.message || error.message;
        logger.error('Failed to trigger savepoint', { deploymentName, error: errorMsg });
        throw new KubernetesError(`Failed to trigger savepoint: ${errorMsg}`, error);
    }
}

// Nonced triggered savepoint shows up as a seperate FlinkStateSnapshot resource, found using label and creation time
export async function getSavepointStatus(deploymentName, namespace, triggerTimeMs) {
    try {
        const response = await k8sCustomApi.listNamespacedCustomObject({
            group: FLINK_CRD.GROUP,
            version: FLINK_CRD.VERSION,
            namespace,
            plural: FLINK_CRD.SNAPSHOT_PLURAL,
            labelSelector: `job-reference.name=${deploymentName},snapshot.trigger-type=MANUAL,snapshot.type=SAVEPOINT`,
        });
        const items = response.items || [];

        //Only search for savepoint after creationTime
        const CREATION_TIMESTAMP_TOLERANCE_MS = 1000;
        const candidates = items.filter(item => {
            const created = Date.parse(item.metadata?.creationTimestamp);
            return !Number.isNaN(created) && created >= triggerTimeMs - CREATION_TIMESTAMP_TOLERANCE_MS;
        });
        if (candidates.length === 0) {
            return { lastSavepointPath: null, timestamp: null, completed: false, failed: false, failureReason: null };
        }

        candidates.sort((a, b) => Date.parse(b.metadata.creationTimestamp) - Date.parse(a.metadata.creationTimestamp));
        const snapshot = candidates[0];
        const state = snapshot.status?.state ?? null;
        const lastSavepointPath = snapshot.status?.path ?? null;
        const timestamp = snapshot.status?.resultTimestamp ? Date.parse(snapshot.status.resultTimestamp) : null;
        return {
            lastSavepointPath,
            timestamp,
            completed: state === 'COMPLETED',
            failed: state === 'FAILED',
            failureReason: state === 'FAILED' ? (snapshot.status?.error ?? null) : null,
        };
    } catch (error) {
        logger.warn('Could not fetch savepoint status', { deploymentName, error: error.message });
        return { lastSavepointPath: null, timestamp: null, completed: false, failed: false, failureReason: null };
    }
}

export async function patchFlinkDeployment(deploymentName, namespace, config, environmentVariables) {
    try {
        logger.info('Patching FlinkDeployment CRD via JSON Patch', { deploymentName });

        const current = await getRawFlinkDeployment(deploymentName, namespace);
        const currentContainers = current?.spec?.podTemplate?.spec?.containers;
        const hasPodTemplateContainer = Array.isArray(currentContainers) && currentContainers.length > 0;

        const patch = [];

        if (config.image) {
            patch.push({ op: 'replace', path: '/spec/image', value: config.image });
        }

        if (config.flinkConfiguration || config.taskManager?.taskSlots) {
            const slots = String(config.taskManager?.taskSlots || '');
            patch.push({ 
                op: 'add', 
                path: '/spec/flinkConfiguration/taskmanager.numberOfTaskSlots', 
                value: slots 
            });
            // Add other flink configs if they exist
            if (config.flinkConfiguration) {
                Object.entries(config.flinkConfiguration).forEach(([key, value]) => {
                    patch.push({ op: 'add', path: `/spec/flinkConfiguration/${key}`, value: String(value) });
                });
            }
        }

        if (config.jobManager) {
            patch.push({ op: 'replace', path: '/spec/jobManager/resource/memory', value: config.jobManager.memory });
            patch.push({ op: 'replace', path: '/spec/jobManager/resource/cpu', value: Number(config.jobManager.cpu) });
            patch.push({ op: 'replace', path: '/spec/jobManager/replicas', value: config.jobManager.replicas });
        }

        if (config.taskManager) {
            patch.push({ op: 'replace', path: '/spec/taskManager/resource/memory', value: config.taskManager.memory });
            patch.push({ op: 'replace', path: '/spec/taskManager/resource/cpu', value: Number(config.taskManager.cpu) });
            patch.push({ op: 'replace', path: '/spec/taskManager/replicas', value: config.taskManager.replicas });
        }

        if (environmentVariables && Object.keys(environmentVariables).length > 0) {
            const envArray = Object.entries(environmentVariables).map(([key, value]) => ({ 
                name: key, 
                value: String(value) 
            }));

            if (hasPodTemplateContainer) {
                // Container object already exists on live CRD (created with env vars)
                patch.push({
                    op: 'add',
                    path:'/spec/podTemplate/spec/containers/0/env',
                    value: envArray
                });
            } else {
                // No podTemplate exists yet (Deployment was created without env vars)
                // Since JSON Patch can't create missing intermediate objects one level at a time, 
                // the whole podTemplate object must be added in a single operation instead of patching a sub-path of something that isn't there yet
                patch.push({
                    op: 'add',
                    path: '/spec/podTemplate',
                    value: {
                        spec: {
                            containers: [{
                                name: FLINK_CRD.FLINK_CONTAINER_NAME,
                                env: envArray
                            }]
                        }
                    }
                });
            }
        } else if (environmentVariables && hasPodTemplateContainer) {
            // Caller explicitly cleared all env vars (environmentVariables === {}) on a deployment that previously had some
            // Clear live array too instead of leaving it stale
            patch.push({
                op: 'add',
                path: '/spec/podTemplate/spec/containers/0/env',
                value: []
            });
        }

        console.log(`JSON Patch payload:`, JSON.stringify(patch, null, 2));

        await patchCustomObjectHelper({
            group: FLINK_CRD.GROUP,
            version: FLINK_CRD.VERSION,
            namespace,
            plural: FLINK_CRD.PLURAL,
            name: deploymentName,
            body: patch, // This is now an array
        });
        
        logger.info('Successfully patched FlinkDeployment CRD', { deploymentName });
    } catch (error) {
        const errorMsg = error.body?.message || error.message;
        logger.error('Failed to patch FlinkDeployment', { deploymentName, namespace, error: errorMsg });
        throw new KubernetesError(`Failed to patch FlinkDeployment: ${errorMsg}`, error);
    }
}

export async function suspendFlinkDeployment(deploymentName, namespace, forceStop = false) {
    try {
        const patch = [
            { op: 'replace', path: '/spec/job/state', value: 'suspended' },
            { op: 'replace', path: '/spec/job/upgradeMode', value: forceStop ? 'stateless' : 'savepoint' }
        ];
        // if (forceStop) {
        //     patch.push({
        //         op: 'replace', path: '/spec/job/upgradeMode', value: 'stateless'
        //     });
        // }
        await patchCustomObjectHelper({
            group: FLINK_CRD.GROUP,
            version: FLINK_CRD.VERSION,
            namespace,
            plural: FLINK_CRD.PLURAL,
            name: deploymentName,
            body: patch,
        });
        logger.info('Successfully suspended FlinkDeployment', { deploymentName, forceStop });
    } catch (error) {
        const errorMsg = error.body?.message || error.message;
        logger.error('Failed to suspend FlinkDeployment', { deploymentName, error: errorMsg });
        throw new KubernetesError(`Failed to suspend FlinkDeployment: ${errorMsg}`);
    }
}

export async function resumeFlinkDeployment(deploymentName, namespace) {
    try {
        const patch = [
            { op: 'replace', path: '/spec/job/state', value: 'running' },
            { op: 'replace', path: '/spec/job/upgradeMode', value: 'savepoint' }
        ];

        await patchCustomObjectHelper({
            group: FLINK_CRD.GROUP, version: FLINK_CRD.VERSION,
            namespace, plural: FLINK_CRD.PLURAL, name: deploymentName, body: patch,
        });

        logger.info('Successfully resumed FlinkDeployment', { deploymentName });
    } catch (error) {
        const errorMsg = error.body?.message || error.message;
        logger.error('Failed to resume FlinkDeployment', { deploymentName, error: errorMsg });
        throw new KubernetesError(`Failed to resume FlinkDeployment: ${errorMsg}`);
    }
}

export async function resumeFromSavepoint(deploymentName, namespace, savepointPath) {
    try {
        const current = await getRawFlinkDeployment(deploymentName, namespace);
        const hasInitialSavepointPath = current?.spec?.job?.initialSavepointPath !== undefined;
        const hasSavepointRedeployNonce = current?.spec?.job?.savepointRedeployNonce !== undefined;

        const nonce = Date.now();
        const patch = [
            { op: hasInitialSavepointPath ? 'replace' : 'add', path: '/spec/job/initialSavepointPath', value: savepointPath },
            { op: hasSavepointRedeployNonce ? 'replace' : 'add', path: '/spec/job/savepointRedeployNonce', value: nonce },
            { op: 'replace', path: '/spec/job/state', value: 'running' },
            { op: 'replace', path: '/spec/job/upgradeMode', value: FLINK_CRD.SAVEPOINT_UPGRADE },
        ];

        await patchCustomObjectHelper({
            group: FLINK_CRD.GROUP, version: FLINK_CRD.VERSION,
            namespace, plural: FLINK_CRD.PLURAL, name: deploymentName, body: patch,
        });

        logger.info('Successfully triggered redeploy from savepoint', { deploymentName, savepointPath, nonce });
    } catch (error) {
        const errorMsg = error.body?.message || error.message;
        logger.error('Failed to resume from savepoint', { deploymentName, savepointPath, error: errorMsg });
        throw new KubernetesError(`Failed to resume from savepoint: ${errorMsg}`);
    }
}

export async function resumeWithoutSavepoint(deploymentName, namespace) {
    try {
        const patch = [
            { op: 'replace', path: '/spec/job/state', value: 'running' },
            { op: 'replace', path: '/spec/job/upgradeMode', value: 'stateless' }
        ];

        await patchCustomObjectHelper({
            group: FLINK_CRD.GROUP, version: FLINK_CRD.VERSION,
            namespace, plural: FLINK_CRD.PLURAL, name: deploymentName, body: patch,
        });

        logger.info('Successfully resumed FlinkDeployment without savepoint', { deploymentName });
    } catch (error) {
        const errorMsg = error.body?.message || error.message;
        logger.error('Failed to resume FlinkDeployment without savepoint', { deploymentName, error: errorMsg });
        throw new KubernetesError(`Failed to resume without savepoint: ${errorMsg}`);
    }
}