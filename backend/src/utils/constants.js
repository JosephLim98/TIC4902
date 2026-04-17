import { DEPLOYMENT_STATUS } from '../../../utils/constants.ts';

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

export const REGEX = {
    DNS_PATTERN: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, //Kube dependencies
    MEMORY_PATTERN: /^[1-9][0-9]*(m|g|M|G)$/ //Memory validation
}

export const ERROR_MESSAGES = {
    DNS_ERROR: 'must be lowercase alphanumeric, may contain hyphens, cannot start/end with hyphen',
    MEMORY_ERROR: 'must be number + unit. E.g., "1600m", "2g"'
}

// Maps kubernetes deployment status back to DB DEPLOYMENT_STATUS
export const FLINK_LIFECYCLE_TO_STATUS = {
    CREATED:      DEPLOYMENT_STATUS.CREATING,      // operator accepted, not yet deployed
    DEPLOYED:     DEPLOYMENT_STATUS.CREATING,      // pods starting up
    STABLE:       DEPLOYMENT_STATUS.RUNNING,       // healthy and processing
    ROLLING_BACK: DEPLOYMENT_STATUS.ROLLING_BACK,  // actively rolling back — show this!
    SUSPENDED:    DEPLOYMENT_STATUS.SUSPENDED,     // stopped with savepoint, NOT running
    FAILING:      DEPLOYMENT_STATUS.FAILED,        // failing but not yet terminal
    FAILED:       DEPLOYMENT_STATUS.FAILED,        // terminal failure
    DELETING:     DEPLOYMENT_STATUS.DELETING,
};