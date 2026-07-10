import { describe, expect, it } from '@jest/globals';
import { isDashboardAvailable } from '../src/service/flinkService.js';

describe('isDashboardAvailable', () => {
  it('returns true when Flink CRD exists and JobManager is READY', () => {
    const deployment = {
      resources: [{ name: 'test-flink5' }],
      kubernetesStatus: { jobManagerDeploymentStatus: 'READY' },
    };

    expect(isDashboardAvailable(deployment)).toBe(true);
  });

  it('returns false when JobManager is not READY', () => {
    const deployment = {
      resources: [{ name: 'test-flink5' }],
      kubernetesStatus: { jobManagerDeploymentStatus: 'MISSING' },
    };

    expect(isDashboardAvailable(deployment)).toBe(false);
  });

  it('returns false when no Flink CRD resource exists', () => {
    const deployment = {
      resources: [],
      kubernetesStatus: { jobManagerDeploymentStatus: 'READY' },
    };

    expect(isDashboardAvailable(deployment)).toBe(false);
  });
});
