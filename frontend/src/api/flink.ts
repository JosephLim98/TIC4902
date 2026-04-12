import client from './client';
import type { Deployment, ListDeploymentsResponse } from '../types';

export async function listDeployments(signal?: AbortSignal): Promise<ListDeploymentsResponse> {
  const { data } = await client.get<ListDeploymentsResponse>('/api/flink/deployments', { signal });
  return data;
}

export async function getDeployment(name: string, signal?: AbortSignal): Promise<Deployment> {
  const { data } = await client.get<Deployment>(`/api/flink/deployments/${name}`, { signal });
  return data;
}

export interface CreateDeploymentPayload {
  deploymentName: string;
  namespace?: string;
  jarName?: string;
  jarId?: number;
  jobParallelism?: number;
  environmentVariables?: Record<string, string>;
  config?: {
    image?: string;
    flinkVersion?: string;
    serviceAccount?: string;
    jobManager?: { memory?: string; cpu?: number; replicas?: number };
    taskManager?: { memory?: string; cpu?: number; replicas?: number; taskSlots?: number };
    flinkConfiguration?: Record<string, string>;
  };
}

export async function createDeployment(payload: CreateDeploymentPayload): Promise<Deployment> {
  const { data } = await client.post<Deployment>('/api/flink/deployments', payload);
  return data;
}
