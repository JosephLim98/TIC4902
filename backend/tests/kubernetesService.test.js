import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockGet = jest.fn();
const mockDelete = jest.fn();
const mockCreate = jest.fn();
const mockPatch = jest.fn();
const mockList = jest.fn();

jest.unstable_mockModule('../src/config/kubernetes.js', () => ({
    k8sCustomApi: {
        getNamespacedCustomObject: mockGet,
        deleteNamespacedCustomObject: mockDelete,
        createNamespacedCustomObject: mockCreate,
        patchNamespacedCustomObject: mockPatch,
        listNamespacedCustomObject: mockList,
    },
}));

jest.unstable_mockModule('../src/template/flinkDeploymentCrd.js', () => ({
    generateFlinkDeployment: jest.fn(() => ({
        spec: {}
    })),
}));

const k8sService = await import('../src/service/kubernetesService.js');

beforeEach(() => {
    jest.clearAllMocks();
});

describe('kubernetesService getFlinkDeploymentStatus', () => {
    it('maps the relevant status fields out of the raw CRD response', async () => {
        mockGet.mockResolvedValueOnce({
            status: {
                lifecycleState: 'STABLE',
                jobManagerDeploymentStatus: 'READY',
                jobStatus: {
                    state: 'RUNNING'
                },
                error: null,
            },
            spec: {
                job: {
                    state: 'running'
                }
            },
        });

        const result = await k8sService.getFlinkDeploymentStatus('my-job', 'default');

        expect(result).toEqual({
            lifecycleState: 'STABLE',
            jobManagerDeploymentStatus: 'READY',
            jobStatus: {
                state: 'RUNNING'
            },
            specJobState: 'running',
            error: null,
        });
    });

    it('returns null instead of throwing when the CRD cannot be fetched (e.g. deleted, or a transient API error)', async () => {
        mockGet.mockRejectedValueOnce(new Error('HTTP-Code: 404 not found'));
        const result = await k8sService.getFlinkDeploymentStatus('missing-job', 'default');
        expect(result).toBeNull();
    });
});

describe('kubernetesService deleteFlinkDeployment', () => {
    it('treats a 404 as already deleted rather than throwing', async () => {
        mockDelete.mockRejectedValueOnce(new Error('HTTP-Code: 404 Not Found'));
        await expect(k8sService.deleteFlinkDeployment('my-job', 'default')).resolves.toBeUndefined();
    });

    it('wraps a real failure in KubernetesError using error.body.message when present', async () => {
        const err = new Error('raw message');
        err.body = {
            message: 'operator rejected the delete'
        };
        mockDelete.mockRejectedValueOnce(err);

        await expect(k8sService.deleteFlinkDeployment('my-job', 'default')).rejects.toMatchObject({
            name: 'KubernetesError',
            message: expect.stringContaining('operator rejected the delete'),
        });
    });

    it('falls back to error.message when there is no error.body (e.g. a raw network error)', async () => {
        // Simulates something like ECONNRESET
        mockDelete.mockRejectedValueOnce(new Error('socket hang up'));

        await expect(k8sService.deleteFlinkDeployment('my-job', 'default')).rejects.toMatchObject({
            name: 'KubernetesError',
            message: expect.stringContaining('socket hang up'),
        });
    });
});

describe('kubernetesService suspendFlinkDeployment', () => {
    it('patches upgradeMode to "savepoint" for a graceful stop', async () => {
        mockPatch.mockResolvedValueOnce({});

        await k8sService.suspendFlinkDeployment('my-job', 'default', false);

        const [{ body: patch }] = mockPatch.mock.calls[0];
        expect(patch).toEqual(
            expect.arrayContaining([
                { op: 'replace', path: '/spec/job/state', value: 'suspended' },
                { op: 'replace', path: '/spec/job/upgradeMode', value: 'savepoint' },
            ])
        );
    });

    it('patches upgradeMode to "stateless" for a force stop', async () => {
        mockPatch.mockResolvedValueOnce({});
        await k8sService.suspendFlinkDeployment('my-job', 'default', true);

        const [{ body: patch }] = mockPatch.mock.calls[0];
        expect(patch).toEqual(
            expect.arrayContaining([
                { op: 'replace', path: '/spec/job/state', value: 'suspended' },
                { op: 'replace', path: '/spec/job/upgradeMode', value: 'stateless' },
            ])
        );
    });

    it('throws KubernetesError when the patch call fails', async () => {
        mockPatch.mockRejectedValueOnce(new Error('conflict'));
        await expect(k8sService.suspendFlinkDeployment('my-job', 'default', false)).rejects.toMatchObject({
            name: 'KubernetesError',
        });
    });
});

describe('kubernetesService resumeFlinkDeployment (without savepoint)', () => {
    it('resumeFlinkDeployment patches state=running with upgradeMode=savepoint', async () => {
        mockPatch.mockResolvedValueOnce({});
        await k8sService.resumeFlinkDeployment('my-job', 'default');
        const [{ body: patch }] = mockPatch.mock.calls[0];
        
        expect(patch).toEqual([
            { op: 'replace', path: '/spec/job/state', value: 'running' },
            { op: 'replace', path: '/spec/job/upgradeMode', value: 'savepoint' },
        ]);
    });

    it('resumeWithoutSavepoint patches state=running with upgradeMode=stateless', async () => {
        mockPatch.mockResolvedValueOnce({});
        await k8sService.resumeWithoutSavepoint('my-job', 'default');

        const [{ body: patch }] = mockPatch.mock.calls[0];

        expect(patch).toEqual([
            { op: 'replace', path: '/spec/job/state', value: 'running' },
            { op: 'replace', path: '/spec/job/upgradeMode', value: 'stateless' },
        ]);
    });
});

describe('kubernetesService resumeFromSavepoint', () => {
    it('uses "add" ops when the live CRD has no initialSavepointPath/savepointRedeployNonce yet', async () => {
        mockGet.mockResolvedValueOnce({
            spec: {
                job: {}
            }
        });
        mockPatch.mockResolvedValueOnce({});

        await k8sService.resumeFromSavepoint('my-job', 'default', 's3://bucket/sp-1');

        const [{ body: patch }] = mockPatch.mock.calls[0];

        expect(patch[0]).toMatchObject({
            op: 'add', path: '/spec/job/initialSavepointPath', value: 's3://bucket/sp-1'
        });

        expect(patch[1]).toMatchObject({
            op: 'add', path: '/spec/job/savepointRedeployNonce'
        });
    });

    it('uses "replace" ops when the live CRD already has those fields', async () => {
        mockGet.mockResolvedValueOnce({
            spec: {
                job: {
                    initialSavepointPath: 's3://bucket/old', savepointRedeployNonce: 123
                }
            },
        });
        mockPatch.mockResolvedValueOnce({});

        await k8sService.resumeFromSavepoint('my-job', 'default', 's3://bucket/sp-2');

        const [{ body: patch }] = mockPatch.mock.calls[0];

        expect(patch[0]).toMatchObject({
            op: 'replace',
            path: '/spec/job/initialSavepointPath',
            value: 's3://bucket/sp-2'
        });
        expect(patch[1]).toMatchObject({
            op: 'replace',
            path: '/spec/job/savepointRedeployNonce'
        });
    });
});

describe('kubernetesService triggerSavepoint', () => {
    it('patches a fresh nonce and returns it', async () => {
        mockPatch.mockResolvedValueOnce({});
        const before = Date.now();
        const nonce = await k8sService.triggerSavepoint('my-job', 'default');
        expect(nonce).toBeGreaterThanOrEqual(before);
        const [{ body: patch }] = mockPatch.mock.calls[0];
        expect(patch).toEqual([{
            op: 'add',
            path: '/spec/job/savepointTriggerNonce',
            value: nonce
        }]);
    });

    it('throws KubernetesError when the patch fails', async () => {
        mockPatch.mockRejectedValueOnce(new Error('down'));
        await expect(k8sService.triggerSavepoint('my-job', 'default')).rejects.toMatchObject({ name: 'KubernetesError' });
    });

});

describe('kubernetesService getSavepointStatus', () => {
    it('returns a not-completed result instead of throwing when the list call fails', async () => {
        mockList.mockRejectedValueOnce(new Error('timeout'));
        const result = await k8sService.getSavepointStatus('my-job', 'default', Date.now());
        expect(result).toEqual({
            lastSavepointPath: null,
            timestamp: null,
            completed: false,
            failed: false,
            failureReason: null
        });
    });

    it('ignores snapshots created before the trigger time', async () => {
        mockList.mockResolvedValueOnce({
            items: [
                {
                    metadata: { 
                        creationTimestamp: new Date (Date.now() - 60_000).toISOString()
                    },
                    status: {
                        state: 'COMPLETED',
                        path: 's3://bucket/stale',
                        resultTimestamp: new Date().toISOString()
                    },
                },
            ],
        });

        const result = await k8sService.getSavepointStatus('my-job', 'default', Date.now());
        expect(result.completed).toBe(false);
        expect(result.lastSavepointPath).toBeNull();
    });

    it('reports a completed savepoint created after the trigger time', async () => {
        const triggerTime = Date.now();
        mockList.mockResolvedValueOnce({
            items: [
                {
                    metadata: {
                        creationTimestamp: new Date(triggerTime + 1000).toISOString()
                    },
                    status: {
                        state: 'COMPLETED',
                        path: 's3://bucket/fresh',
                        resultTimestamp: new Date(triggerTime + 2000).toISOString()
                    },
                },
            ],
        });

        const result = await k8sService.getSavepointStatus('my-job', 'default', triggerTime);
        expect(result.completed).toBe(true);
        expect(result.lastSavepointPath).toBe('s3://bucket/fresh');
    });

    it('surfaces a failure reason when the snapshot failed', async () => {
        mockList.mockResolvedValueOnce({
            items: [
                {
                    metadata: {
                        creationTimestamp: new Date().toISOString()
                    },
                    status: {
                        state: 'FAILED',
                        error: 'disk full'
                    },
                },
            ],
        });

        const result = await k8sService.getSavepointStatus('my-job', 'default', Date.now() - 500);
        expect(result.failed).toBe(true);
        expect(result.failureReason).toBe('disk full');
    });
});