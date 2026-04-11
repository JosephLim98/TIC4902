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
