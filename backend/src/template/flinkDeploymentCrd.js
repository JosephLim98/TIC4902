import { FLINK_CRD, FLINK_MODE, DEPLOYMENT_STATUS } from "../utils/constants.js";

export function generateFlinkDeployment(deploymentName, namespace, config, jarSpec = null, environmentVariables = null) {
    const { image, flinkVersion, serviceAccount, jobManager, taskManager } = config;
    const flinkConfiguration = { 
        'taskmanager.numberOfTaskSlots': taskManager.taskSlots.toString(),
        ...(jarSpec && { 'user.artifacts.raw-http-enabled': 'true' }),
        ...config.flinkConfiguration
    };

    const crd = {
        apiVersion: `${FLINK_CRD.GROUP}/${FLINK_CRD.VERSION}`,
        kind: FLINK_CRD.KIND,
        metadata: {
          name: deploymentName,
          namespace,
          labels: {
            app: FLINK_CRD.APP,
            deployedBy: FLINK_CRD.FLINK_API,
            deploymentMode: jarSpec ? FLINK_MODE.APPLICATION : FLINK_MODE.SESSION
          }
        },
        spec: {
          image,
          flinkVersion,
          serviceAccount,
          flinkConfiguration,
          jobManager: {
            resource: {
              memory: jobManager.memory,
              cpu: Number(jobManager.cpu)
            },
            replicas: jobManager.replicas
          },
          taskManager: {
            resource: {
              memory: taskManager.memory,
              cpu: Number(taskManager.cpu)
            },
            replicas: taskManager.replicas
          }
        }
      };
    
    if (jarSpec) {
    crd.spec.job = {
        jarURI: jarSpec.jarUrl,
        state: DEPLOYMENT_STATUS.RUNNING,
        upgradeMode: FLINK_CRD.SAVEPOINT_UPGRADE,
        ...(jarSpec.parallelism && { parallelism: jarSpec.parallelism }),
        ...(jarSpec.mainClass && { entryClass: jarSpec.mainClass })
        };
    }
    if (environmentVariables && Object.keys(environmentVariables).length > 0) {
        crd.spec.podTemplate = {
            spec: {
            containers: [{
                name: FLINK_CRD.FLINK_CONTAINER_NAME,
                env: Object.entries(environmentVariables).map(([key, value]) => ({
                name: key,
                value: String(value)
                }))
            }]
            }
        };
    }
    return crd;
}