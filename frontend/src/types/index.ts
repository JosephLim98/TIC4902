
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

export type DeploymentStatus = 'creating' | 'running' | 'failed' | 'deleting' | 'deleted';
export type DeploymentMode = 'session' | 'application';

export interface Deployment {
  id: number;
  deploymentName: string;
  namespace: string;
  status: DeploymentStatus;
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
}

export interface ListDeploymentsResponse {
  deployments: Deployment[];
  total: number;
}
