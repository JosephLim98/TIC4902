import { FLINK_CRD, FLINK_MODE, DEPLOYMENT_STATUS } from "../utils/constants.js";
// import { FLINK_CRD, FLINK_MODE, DEPLOYMENT_STATUS, FLINK_S3_PLUGIN_JAR } from "../utils/constants.js";

export function generateFlinkDeployment(deploymentName, namespace, config, jarSpec = null, environmentVariables = null, stateBucketName = null) {
    const { image, flinkVersion, serviceAccount, jobManager, taskManager } = config;

    if (!stateBucketName) {
        throw new Error(`generateFlinkDeployment: stateBucketName is required (deployment: ${deploymentName})`);
    }

    const checkpointConfig = {
        's3.endpoint':                       `http://${process.env.MINIO_INTERNAL_HOST || 'host.minikube.internal'}:${process.env.MINIO_INTERNAL_PORT || '9000'}`,
        's3.access-key':                     process.env.MINIO_ROOT_USER     || 'minioadmin',
        's3.secret-key':                     process.env.MINIO_ROOT_PASSWORD || 'minioadmin',
        's3.path.style.access':              'true',
        'state.backend.type':                'hashmap',
        'state.checkpoints.dir':             `s3://${stateBucketName}/checkpoints`,
        'state.savepoints.dir':              `s3://${stateBucketName}/savepoints`,
        'execution.checkpointing.interval':  '30000',
        'execution.checkpointing.mode':      'EXACTLY_ONCE',
        'execution.checkpointing.min-pause': '10000',
    };

    const flinkConfiguration = {
        'taskmanager.numberOfTaskSlots': taskManager.taskSlots.toString(),
        ...(jarSpec && { 'user.artifacts.raw-http-enabled': 'true' }),
        ...checkpointConfig,
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
        upgradeMode: FLINK_CRD.LAST_STATE_UPGRADE,
        ...(jarSpec.parallelism && { parallelism: jarSpec.parallelism }),
        ...(jarSpec.mainClass && { entryClass: jarSpec.mainClass })
        };
    }

    // const podEnv = [
    //   { name: 'ENABLE_BUILTIN_PLUGINS', value: 'flink-s3-fs-hadoop-1.19.3.jar' },
    //   ...(environmentVariables
    //     ? Object.entries(environmentVariables).map(([key, value]) => ({ name: key, value: String(value) }))
    //     : [])
    // ];

    crd.spec.podTemplate = {
      spec: {
        containers: [{
          name: FLINK_CRD.FLINK_CONTAINER_NAME,
          // env: podEnv
          ...(environmentVariables && Object.keys(environmentVariables).length > 0 && {
            env: Object.entries(environmentVariables).map(([key, value]) => ({
              name: key,
              value: String(value)
            }))
          })
        }]
      }
    };

    return crd;
}