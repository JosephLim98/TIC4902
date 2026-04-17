export const DEPLOYMENT_STATUS = {
    CREATING:     'creating',
    RUNNING:      'running',
    SUSPENDED:    'suspended',
    FAILED:       'failed',
    ROLLING_BACK: 'rolling_back',
    DELETING:     'deleting',
    DELETED:      'deleted',
    UNKNOWN:      'unknown',
} as const;

// Helper type for the frontend
export type DeploymentStatus = typeof DEPLOYMENT_STATUS[keyof typeof DEPLOYMENT_STATUS];

export const FLINK_MODE = {
    APPLICATION: 'application',
    SESSION: 'session'
} as const; 

export type FlinkMode = typeof FLINK_MODE[keyof typeof FLINK_MODE];