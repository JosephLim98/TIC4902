import type { Deployment } from '@/types'

export function isFlinkDashboardAvailable(deployment: Deployment): boolean {
  const jmStatus = (deployment.kubernetesStatus as { jobManagerDeploymentStatus?: string } | undefined)
    ?.jobManagerDeploymentStatus
  return Boolean(deployment.flinkDeployment) && jmStatus === 'READY'
}
