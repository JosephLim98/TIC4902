import { KubernetesError } from "../utils/errors.js";
import { FLINK_CRD } from "../utils/constants.js";
import { FLINK_MODE } from "../../../utils/constants.ts";
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

export async function createFlinkCluster(deploymentName, namespace, config, jarSpec = null, environmentVariables = null){
    try {
        const mode = jarSpec ? FLINK_MODE.APPLICATION : FLINK_MODE.SESSION
        logger.info('Creating FlinkDeployment CRD', {deploymentName, namespace, mode});

        const flinkDeployment = generateFlinkDeployment(deploymentName, namespace, config, jarSpec, environmentVariables);
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

export async function patchFlinkDeployment(deploymentName, namespace, config, environmentVariables) {
    try {
        logger.info('Patching FlinkDeployment CRD via JSON Patch', { deploymentName });

        const patch = [];

        if (config.image) {
            patch.push({ op: 'replace', path: '/spec/image', value: config.image });
        }

        if (config.flinkConfiguration || config.taskManager?.taskSlots) {
            const slots = String(config.taskManager?.taskSlots || '');
            patch.push({ 
                op: 'replace', 
                path: '/spec/flinkConfiguration/taskmanager.numberOfTaskSlots', 
                value: slots 
            });
            // Add other flink configs if they exist
            if (config.flinkConfiguration) {
                Object.entries(config.flinkConfiguration).forEach(([key, value]) => {
                    patch.push({ op: 'replace', path: `/spec/flinkConfiguration/${key}`, value: String(value) });
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
            patch.push({
                op: 'replace',
                path: `/spec/podTemplate/spec/containers/0/env`, // Assuming the first container
                value: envArray
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