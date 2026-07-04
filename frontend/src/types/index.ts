import type { DeploymentStatus } from '@/utils/constants.js';
export type { DeploymentStatus };
import type { Jar } from '../api/jar';

export type JarSummary = Pick<Jar, 'id' | 'name' | 'url'>

export interface JobManagerConfig {
  memory: string;
  cpu: number;
  replicas: number;
}

export interface TaskManagerConfig {
  memory: string;
  cpu: number;
  replicas: number;
  taskSlots: number;
}

export interface DeploymentConfig {
  namespace: string;
  image: string;
  flinkVersion: string;
  serviceAccount: string;
  jobManager: JobManagerConfig;
  taskManager: TaskManagerConfig;
  flinkConfiguration?: Record<string, string>;
}

export type DeploymentMode = 'session' | 'application';

export interface Deployment {
  id: number;
  deploymentName: string;
  namespace: string;
  status: DeploymentStatus;
  pendingAction?: 'stop' | 'force_stop' | 'resume' | 'delete' | null;
  deploymentMode: DeploymentMode;
  config: DeploymentConfig;
  createdAt: string;
  environmentVariables?: Record<string, string>;
  jobParallelism?: number;
  kubernetesStatus?: Record<string, unknown>;
  flinkDeployment?: {
    name: string;
    uid: string;
    apiVersion: string;
  };
  errorMessage?: string;
  jar?: JarSummary;
  hasSavepoint?: boolean;
  stateBucketName?: string;
  lastSavepointPath?: string;
}

export interface ListDeploymentsResponse {
  deployments: Deployment[];
  total: number;
}

export interface Savepoint {
  id: number;
  path: string;
  source: 'manual' | 'stop';
  createdAt: string;
}

export interface ListSavepointsResponse {
  savepoints: Savepoint[];
  total: number;
}
