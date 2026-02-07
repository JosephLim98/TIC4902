import { KubernetesError } from "../utils/errors.js";
import { FLINK_CRD, FLINK_MODE } from "../utils/constants.js";
import { generateFlinkDeployment } from "../template/flinkDeploymentCrd.js";
import { k8sCustomApi } from "../config/kubernetes.js";
import logger from "../utils/logger.js";


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