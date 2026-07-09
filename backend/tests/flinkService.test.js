import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSuspend = jest.fn();
const mockResume = jest.fn();
const mockDelete = jest.fn();
const mockGetStatus = jest.fn();
const mockGetDiagnostics = jest.fn();

jest.unstable_mockModule('../src/service/kubernetesService.js', () => ({
    suspendFlinkDeployment: mockSuspend,
    resumeFlinkDeployment: mockResume,
    deleteFlinkDeployment: mockDelete,
    getFlinkDeploymentStatus: mockGetStatus,
    getDeploymentDiagnostics: mockGetDiagnostics,
    createFlinkCluster: jest.fn(),
    patchFlinkDeployment: jest.fn(),
    triggerSavepoint: jest.fn(),
    getSavepointStatus: jest.fn(),
    resumeFromSavepoint: jest.fn(),
    resumeWithoutSavepoint: jest.fn(),
}));

const mockFindOne = jest.fn();
const mockSavepointFindOrCreate = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
    Deployment: { findOne: mockFindOne },
    Jar: {},
    Savepoint: { findOrCreate: mockSavepointFindOrCreate, findOne: jest.fn(), findAll: jest.fn() },
}));

jest.unstable_mockModule('../src/models/flinkConfigModel.js', () => ({
    FlinkConfig: { findOne: jest.fn() },
}));

jest.unstable_mockModule('../src/config/database.js', () => ({
    default: { transaction: jest.fn() },
}));

jest.unstable_mockModule('../src/service/jarService.js', () => ({
    getJarById: jest.fn(),
}));

jest.unstable_mockModule('../src/service/minioService.js', () => ({
    buildStateBucketName: jest.fn(),
    ensureStateBucketExists: jest.fn(),
    deleteStateBucket: jest.fn(),
}));

const { deleteStateBucket } = await import('../src/service/minioService.js');
const { stopDeployment, deleteDeployment, getDeployment, getDeploymentDiagnostics } = await import('../src/service/flinkService.js');

// Minimal Sequelize model instance that mutates in place
function fakeDeployment(overrides = {}) {
    const deployment = {
        id: 1,
        deploymentName: 'my-job',
        namespace: 'default',
        deploymentMode: 'application',
        status: 'running',
        pendingAction: null,
        errorMessage: null,
        lastSavepointPath: null,
        ...overrides,
    };
    deployment.save = jest.fn(async () => deployment);
    deployment.toJSON = () => {
        const { save, toJSON, ...plain } = deployment;
        return { ...plain };
    };
    return deployment;
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('flinkService stopDeployment', () => {
    it('throws NotFoundError when the deployment does not exist', async () => {
        mockFindOne.mockResolvedValueOnce(null);
        await expect(stopDeployment('missing')).rejects.toMatchObject({ name: 'NotFoundError' });
    });

    it('throws ValidationError for session mode deployments', async () => {
        mockFindOne.mockResolvedValueOnce(fakeDeployment({
            deploymentMode: 'session'
        }));
        await expect(stopDeployment('my-job')).rejects.toMatchObject({ name: 'ValidationError' });
        expect(mockSuspend).not.toHaveBeenCalled();
    });

    it('throws ConflictError when another action is already pending', async () => {
        mockFindOne.mockResolvedValueOnce(fakeDeployment({ pendingAction: 'resume' }));
        await expect(stopDeployment('my-job')).rejects.toMatchObject({ name: 'ConflictError' });
        expect(mockSuspend).not.toHaveBeenCalled();
    });

    it('throws ConflictError when the deployment is not currently running', async () => {
        mockFindOne.mockResolvedValueOnce(fakeDeployment({ status: 'suspended' }));
        await expect(stopDeployment('my-job')).rejects.toMatchObject({ name: 'ConflictError' });
        expect(mockSuspend).not.toHaveBeenCalled();
    });

    it('sets pendingAction to "stop" and calls suspend with forceStop=false', async () => {
        const deployment = fakeDeployment();
        mockFindOne.mockResolvedValueOnce(deployment);
        mockSuspend.mockResolvedValueOnce(undefined);

        const result = await stopDeployment('my-job', false);
        
        expect(deployment.pendingAction).toBe('stop');
        expect(mockSuspend).toHaveBeenCalledWith('my-job', 'default', false);
        expect(result.pendingAction).toBe('stop');
    });

    it('sets pendingAction to "force_stop" and calls suspend with forceStop=true', async () => {
        const deployment = fakeDeployment();
        mockFindOne.mockResolvedValueOnce(deployment);
        mockSuspend.mockResolvedValueOnce(undefined);

        await stopDeployment('my-job', true);

        expect(deployment.pendingAction).toBe('force_stop');
        expect(mockSuspend).toHaveBeenCalledWith('my-job', 'default', true);
    });

    it('clears pendingAction and rethrows if the k8s suspend call fails', async () => {
        const deployment = fakeDeployment();
        mockFindOne.mockResolvedValueOnce(deployment);
        mockSuspend.mockRejectedValueOnce(new Error('k8s unreachable'));

        await expect(stopDeployment('my-job')).rejects.toThrow('k8s unreachable');
        expect(deployment.pendingAction).toBeNull();
    });
    
});

describe('flinkService deleteDeployment', () => {
    it('throws NotFoundError when the deployment does not exist', async () => {
        mockFindOne.mockResolvedValueOnce(null);
        await expect(deleteDeployment('missing')).rejects.toMatchObject({ name: 'NotFoundError' });
    });

    it('throws ConflictError when already deleted', async () => {
        mockFindOne.mockResolvedValueOnce(fakeDeployment({ status: 'deleted' }));
        await expect(deleteDeployment('my-job')).rejects.toMatchObject({ name: 'ConflictError' });
    });

    it('throws ConflictError when another action is already pending', async () => {
        mockFindOne.mockResolvedValueOnce(fakeDeployment({ pendingAction: 'stop' }));
        await expect(deleteDeployment('my-job')).rejects.toMatchObject({ name: 'ConflictError' });
        expect(mockDelete).not.toHaveBeenCalled();
    });

    it('sets pendingAction to "delete", calls k8s delete, and cleans up the state bucket', async () => {
        const deployment = fakeDeployment({ status: 'suspended', stateBucketName: 'flink-my-job' });
        mockFindOne.mockResolvedValueOnce(deployment);
        mockDelete.mockResolvedValueOnce(undefined);

        const result = await deleteDeployment('my-job');

        expect(deployment.pendingAction).toBe('delete');
        expect(mockDelete).toHaveBeenCalledWith('my-job', 'default');
        expect(deleteStateBucket).toHaveBeenCalledWith('flink-my-job');

        // Deletion is asynchronous in k8s. pendingAction should not be cleared yet
        expect(result.pendingAction).toBe('delete');
    });

    it('does not touch the state bucket when the deployment has none', async () => {
        const deployment = fakeDeployment({ status: 'suspended', stateBucketName: null });
        mockFindOne.mockResolvedValueOnce(deployment);
        mockDelete.mockResolvedValueOnce(undefined);

        await deleteDeployment('my-job');

        expect(deleteStateBucket).not.toHaveBeenCalled();
    });

    it('marks the deployment FAILED and clears pendingAction if the k8s delete call fails', async () => {
        const deployment = fakeDeployment({ status: 'suspended' });
        mockFindOne.mockResolvedValueOnce(deployment);
        mockDelete.mockRejectedValueOnce(new Error('k8s unreachable'));

        await expect(deleteDeployment('my-job')).rejects.toThrow('k8s unreachable');
        expect(deployment.pendingAction).toBeNull();
        expect(deployment.status).toBe('failed');
        expect(deleteStateBucket).not.toHaveBeenCalled();
    });
});

describe('flinkService getDeployment (syncDeployment reconciliation)', () => {
    it('marks the deployment DELETED when the CRD is gone and nothing is pending', async () => {
        const deployment = fakeDeployment({ status: 'suspended' });
        mockFindOne.mockResolvedValueOnce(deployment);
        mockGetStatus.mockResolvedValueOnce(null);

        const result = await getDeployment('my-job');

        expect(deployment.status).toBe('deleted');
        expect(result.kubernetesStatus).toBeNull();
    });

    it('resolves a pending "stop" once k8s reports the job suspended, and records the savepoint', async () => {
        const deployment = fakeDeployment({ status: 'running', pendingAction: 'stop' });
        mockFindOne.mockResolvedValueOnce(deployment);
        mockGetStatus.mockResolvedValueOnce({
            lifecycleState: 'STABLE',
            jobStatus: {
                state: 'FINISHED',
                upgradeSavepointPath: 's3://bucket/sp-1'
            },
            specJobState: 'suspended',
            error: null,
        });

        const result = await getDeployment('my-job');

        expect(deployment.status).toBe('suspended');
        expect(deployment.pendingAction).toBeNull();
        expect(deployment.lastSavepointPath).toBe('s3://bucket/sp-1');
        expect(mockSavepointFindOrCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    deploymentId: 1,
                    path: 's3://bucket/sp-1'
                },
            })
        );
        expect(result.status).toBe('suspended');
    });

    it('resolves a pending "resume" once k8s reports the job running', async () => {
        const deployment = fakeDeployment({
            status: 'suspended',
            pendingAction: 'resume'
        });
        mockFindOne.mockResolvedValueOnce(deployment);
        mockGetStatus.mockResolvedValueOnce({
            lifecycleState: 'STABLE',
            jobStatus: {
                state: 'RUNNING'
            },
            specJobState: 'running',
            error: null,
        });

        await getDeployment('my-job');

        expect(deployment.status).toBe('running');
        expect(deployment.pendingAction).toBeNull();
    });

    it('resolves out of a pending action if the job fails while waiting, instead of polling forever', async () => {
        const deployment = fakeDeployment({
            status: 'running',
            pendingAction: 'stop'
        });
        mockFindOne.mockResolvedValueOnce(deployment);
        mockGetStatus.mockResolvedValueOnce({
            lifecycleState: 'FAILED',
            jobStatus: {
                state: 'FAILED'
            },
            error: 'org.apache.flink.SomeException: task crashed',
        });

        await getDeployment('my-job');

        expect(deployment.status).toBe('failed');
        expect(deployment.pendingAction).toBeNull();
        expect(deployment.errorMessage).toBe('task crashed');
    });

    it('keeps pendingAction set and returns the stale status while an action is still in flight', async () => {
        const deployment = fakeDeployment({
            status: 'running',
            pendingAction: 'stop'
        });

        mockFindOne.mockResolvedValueOnce(deployment);
        mockGetStatus.mockResolvedValueOnce({
            lifecycleState: 'STABLE',
            jobStatus: {
                state: 'RUNNING'
            },
            error: null,
        });

        const result = await getDeployment('my-job');

        expect(deployment.pendingAction).toBe('stop');
        expect(deployment.status).toBe('running');
        expect(result.pendingAction).toBe('stop');
    });

    it('syncs status from k8s when nothing is pending and the mapped status changed', async () => {
        const deployment = fakeDeployment({
            status: 'creating',
            pendingAction: null
        });
        
        mockFindOne.mockResolvedValueOnce(deployment);
        mockGetStatus.mockResolvedValueOnce({
            lifecycleState: 'STABLE',
            jobStatus: { state: 'RUNNING' },
            error: null,
        });

        const result = await getDeployment('my-job');

        expect(deployment.status).toBe('running');
        expect(result.status).toBe('running');
    });
});

describe('flinkService getDeploymentDiagnostics', () => {
    it('throws NotFoundError when the deployment does not exist', async () => {
        mockFindOne.mockResolvedValueOnce(null);

        await expect(getDeploymentDiagnostics('missing')).rejects.toMatchObject({
            name: 'NotFoundError',
        });

        expect(mockGetDiagnostics).not.toHaveBeenCalled();
    });

    it('delegates to kubernetesService with the deployment namespace', async () => {
        const deployment = fakeDeployment({
            deploymentName: 'my-job',
            namespace: 'custom-namespace',
        });

        const diagnostics = {
            deploymentName: 'my-job',
            namespace: 'custom-namespace',
            status: {
                lifecycleState: 'STABLE',
                jobManagerDeploymentStatus: 'READY',
                jobStatus: {},
                error: null,
            },
            conditions: [],
            pods: [],
            events: [],
            recommendations: [],
        };

        mockFindOne.mockResolvedValueOnce(deployment);
        mockGetDiagnostics.mockResolvedValueOnce(diagnostics);

        const result = await getDeploymentDiagnostics('my-job');

        expect(mockGetDiagnostics).toHaveBeenCalledWith('my-job', 'custom-namespace');
        expect(result).toBe(diagnostics);
    });
});