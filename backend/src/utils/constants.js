
//Deployment Statuses
export const DEPLOYMENT_STATUS = {
    CREATING: 'creating',
    RUNNING: 'running',
    FAILED: 'failed',
    DELETING: 'deleting',
    DELETED: 'deleted'
  };

//Flink k8s Operator CRD
export const FLINK_CRD = {
    GROUP: 'flink.apache.org',
    VERSION: 'v1beta1',
    PLURAL: 'flinkdeployments',
    KIND: 'FlinkDeployment',
    APP: 'flink',
    FLINK_API: 'flink-api',
    SAVEPOINT_UPGRADE: 'savepoint',
    FLINK_CONTAINER_NAME: 'flink-main-container'
  };

export const FLINK_MODE = {
    APPLICATION: 'application',
    SESSION: 'session'
 }; 

export const REGEX = {
    DNS_PATTERN: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, //Kube dependencies
    MEMORY_PATTERN: /^[1-9][0-9]*(m|g|M|G)$/ //Memory validation
}

export const ERROR_MESSAGES = {
    DNS_ERROR: 'must be lowercase alphanumeric, may contain hyphens, cannot start/end with hyphen',
    MEMORY_ERROR: 'must be number + unit. E.g., "1600m", "2g"'
}