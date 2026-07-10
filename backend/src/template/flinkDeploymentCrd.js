import dns from 'node:dns';
import net from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { FLINK_CRD, FLINK_MODE, DEPLOYMENT_STATUS } from "../utils/constants.js";
import logger from '../utils/logger.js';

const execFileAsync = promisify(execFile);

async function resolveHostAlias(hostname) {
    if (net.isIP(hostname)) {
        return null; // already a literal IP, nothing to alias
    }

    if (hostname.endsWith('.minikube.internal')) {
        try {
            const profile = process.env.MINIKUBE_PROFILE || 'minikube';
            const { stdout } = await execFileAsync(
                'minikube', ['ssh', '-p', profile, '--', 'getent', 'hosts', hostname],
                { timeout: 5000 }
            );
            const ip = stdout.trim().split(/\s+/)[0];
            if (ip && net.isIP(ip)) {
                return { ip, hostnames: [hostname] };
            }
            logger.warn(`generateFlinkDeployment: "minikube ssh getent hosts ${hostname}" returned no usable IP`, { stdout });
        } catch (err) {
            logger.warn(`generateFlinkDeployment: could not ask minikube for "${hostname}"'s address — pods may fail to reach it`, { error: err.message });
        }
        return null;
    }

    try {
        const { address } = await dns.promises.lookup(hostname, { family: 4 });
        return { ip: address, hostnames: [hostname] };
    } catch (err) {
        logger.warn(`generateFlinkDeployment: could not resolve host alias for "${hostname}" — pods may fail to reach it`, { error: err.message });
        return null;
    }
}

const LOG4J_CONSOLE_PROPERTIES = `rootLogger.level = INFO
rootLogger.appenderRef.console.ref = ConsoleAppender
rootLogger.appenderRef.rolling.ref = RollingFileAppender

appender.console.name = ConsoleAppender
appender.console.type = CONSOLE
appender.console.layout.type = PatternLayout
appender.console.layout.pattern = %d{yyyy-MM-dd HH:mm:ss,SSS} %-5level %logger{60} - %msg%n

appender.rolling.name = RollingFileAppender
appender.rolling.type = RollingFile
appender.rolling.append = false
appender.rolling.fileName = \${sys:log.file}
appender.rolling.filePattern = \${sys:log.file}.%i
appender.rolling.layout.type = PatternLayout
appender.rolling.layout.pattern = %d{yyyy-MM-dd HH:mm:ss,SSS} %-5level %logger{60} - %msg%n
appender.rolling.policies.type = Policies
appender.rolling.policies.size.type = SizeBasedTriggeringPolicy
appender.rolling.policies.size.size = 100MB
appender.rolling.strategy.type = DefaultRolloverStrategy
appender.rolling.strategy.max = 10

logger.akka.name = akka
logger.akka.level = INFO
logger.kafka.name = org.apache.kafka
logger.kafka.level = INFO
logger.hadoop.name = org.apache.hadoop
logger.hadoop.level = WARN
logger.zookeeper.name = org.apache.zookeeper
logger.zookeeper.level = WARN
`;

export async function generateFlinkDeployment(deploymentName, namespace, config, jarSpec = null, environmentVariables = null, stateBucketName = null) {
    const { image, flinkVersion, serviceAccount, jobManager, taskManager } = config;

    if (!stateBucketName) {
        throw new Error(`generateFlinkDeployment: stateBucketName is required (deployment: ${deploymentName})`);
    }

    const minioHost = process.env.MINIO_INTERNAL_HOST || 'host.minikube.internal';
    const hostAlias = await resolveHostAlias(minioHost);

    const checkpointConfig = {
        's3.endpoint':                       `http://${minioHost}:${process.env.MINIO_INTERNAL_PORT || '9000'}`,
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
        args: ['_'],
        ...(jarSpec.parallelism && { parallelism: jarSpec.parallelism }),
        ...(jarSpec.mainClass && { entryClass: jarSpec.mainClass })
        };
    }

    crd.spec.logConfiguration = {
      'log4j-console.properties': LOG4J_CONSOLE_PROPERTIES,
    };

    const podSpec = {
      initContainers: [{
        name: 's3-plugin-init',
        image,
        command: ['sh', '-c', 'cp /opt/flink/opt/flink-s3-fs-hadoop-*.jar /opt/flink/plugins/s3-fs-hadoop/'],
        volumeMounts: [
          { name: 's3-fs-hadoop-plugin', mountPath: '/opt/flink/plugins/s3-fs-hadoop' },
        ],
      }],
      containers: [{
        name: FLINK_CRD.FLINK_CONTAINER_NAME,
        volumeMounts: [
          { name: 's3-fs-hadoop-plugin', mountPath: '/opt/flink/plugins/s3-fs-hadoop' },
        ],
        ...(environmentVariables && Object.keys(environmentVariables).length > 0 && {
          env: Object.entries(environmentVariables).map(
            ([key, value]) => ({ name: key, value: String(value) })
          ),
        }),
      }],
      volumes: [
        { name: 's3-fs-hadoop-plugin', emptyDir: {} },
      ],
    };
    if (hostAlias) {
      podSpec.hostAliases = [hostAlias];
    }

    crd.spec.podTemplate = {
      metadata: {
        labels: {
          flinkDeployment: deploymentName
        }
      },
      spec: podSpec,
    };

    return crd;
}