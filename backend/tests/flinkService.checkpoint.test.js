import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// ── Backend constants ─────────────────────────────────────────────────────────
jest.unstable_mockModule('../src/utils/constants.js', () => ({
  DEPLOYMENT_STATUS: {
    CREATING:      'creating',
    RUNNING:       'running',
    FAILED:        'failed',
    DELETED:       'deleted',
    DELETING:      'deleting',
    SUSPENDED:     'suspended',
    ROLLING_BACK:  'rolling_back',
  },
  FLINK_MODE: {
    SESSION:     'session',
    APPLICATION: 'application',
  },
  FLINK_LIFECYCLE_TO_STATUS: {},
  FLINK_CRD: {
    GROUP: 'flink.apache.org', VERSION: 'v1beta1', PLURAL: 'flinkdeployments',
    KIND: 'FlinkDeployment', APP: 'flink', FLINK_API: 'flink-api',
    SAVEPOINT_UPGRADE: 'savepoint', STATELESS_UPGRADE: 'stateless',
    LAST_STATE_UPGRADE: 'last-state', FLINK_CONTAINER_NAME: 'flink-main-container',
  },
  REGEX: {},
  ERROR_MESSAGES: {},
}));

// ── MinIO mocks ───────────────────────────────────────────────────────────────
const mockBuildStateBucketName    = jest.fn((name) => `flink-${name}`);
const mockEnsureStateBucketExists = jest.fn();
const mockDeleteStateBucket       = jest.fn();

jest.unstable_mockModule('../src/service/minioService.js', () => ({
  buildStateBucketName:    mockBuildStateBucketName,
  ensureStateBucketExists: mockEnsureStateBucketExists,
  deleteStateBucket:       mockDeleteStateBucket,
  buildJarUrl:             jest.fn((o) => `http://minio/${o}`),
  ensureBucketExists:      jest.fn(),
  uploadJar:               jest.fn(),
  deleteJar:               jest.fn(),
}));

// ── Kubernetes service mocks ──────────────────────────────────────────────────
const mockCreateFlinkCluster       = jest.fn();
const mockDeleteFlinkDeployment    = jest.fn();
const mockK8sTriggerSavepoint      = jest.fn();
const mockGetSavepointStatus       = jest.fn();
const mockGetFlinkDeploymentStatus = jest.fn();

jest.unstable_mockModule('../src/service/kubernetesService.js', () => ({
  createFlinkCluster:       mockCreateFlinkCluster,
  deleteFlinkDeployment:    mockDeleteFlinkDeployment,
  triggerSavepoint:         mockK8sTriggerSavepoint,
  getSavepointStatus:       mockGetSavepointStatus,
  patchFlinkDeployment:     jest.fn(),
  getFlinkDeploymentStatus: mockGetFlinkDeploymentStatus,
}));

// ── JAR service mock ──────────────────────────────────────────────────────────
const mockGetJarById = jest.fn();
jest.unstable_mockModule('../src/service/jarService.js', () => ({
  getJarById: mockGetJarById,
}));

// ── Sequelize / model mocks ───────────────────────────────────────────────────
const mockDeploymentCreate  = jest.fn();
const mockDeploymentFindOne = jest.fn();
const mockDeploymentSave    = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  Deployment: {
    create:  mockDeploymentCreate,
    findOne: mockDeploymentFindOne,
    findAll: jest.fn().mockResolvedValue([]),
  },
  Jar: {},
}));

const mockTransaction = {
  commit:   jest.fn(),
  rollback: jest.fn(),
  finished: false,
};

jest.unstable_mockModule('../src/config/database.js', () => ({
  default: { transaction: jest.fn().mockResolvedValue(mockTransaction) },
}));

jest.unstable_mockModule('../src/models/flinkConfigModel.js', () => ({
  FlinkConfig: {
    findOne: jest.fn().mockResolvedValue({
      namespace:           'default',
      image:               'flink:1.19',
      flinkVersion:        'v1_19',
      serviceAccount:      'flink',
      jobManagerMemory:    '1024m',
      jobManagerCpu:       1,
      jobManagerReplicas:  1,
      taskManagerMemory:   '1024m',
      taskManagerCpu:      1,
      taskManagerReplicas: 1,
      taskManagerSlots:    1,
    }),
  },
}));

const { createDeployment, deleteDeployment, triggerSavepoint, getDeployment } =
  await import('../src/service/flinkService.js');

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeRecord(overrides = {}) {
  const base = {
    id: 1,
    deploymentName:    'my-app',
    namespace:         'default',
    status:            'running',
    deploymentMode:    'application',
    stateBucketName:   'flink-my-app',
    lastSavepointPath: null,
    resources:         null,
    save:              mockDeploymentSave,
    reload:            jest.fn().mockResolvedValue(undefined),
    toJSON() { return { ...this }; },
  };
  return { ...base, ...overrides };
}

function mockCrd() {
  return {
    kind: 'FlinkDeployment', name: 'my-app', namespace: 'default',
    uid: 'abc-123', apiVersion: 'flink.apache.org/v1beta1',
  };
}

describe('flinkService — checkpoint / state bucket wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeploymentSave.mockResolvedValue(undefined);
    mockTransaction.finished = false;
    mockTransaction.commit.mockResolvedValue(undefined);
    mockTransaction.rollback.mockResolvedValue(undefined);
    mockGetFlinkDeploymentStatus.mockResolvedValue(null);
  });

  // ── createDeployment — application mode ────────────────────────────────────
  describe('createDeployment — application mode', () => {
    beforeEach(() => {
      mockGetJarById.mockResolvedValue({
        id: 42, name: 'job.jar', objectName: 'uuid-job.jar',
        url: 'http://minio/flink-jars/uuid-job.jar',
      });
      mockCreateFlinkCluster.mockResolvedValue(mockCrd());
    });

    it('calls ensureStateBucketExists with the computed bucket name', async () => {
      const record = makeRecord();
      mockDeploymentFindOne.mockResolvedValueOnce(null);
      mockDeploymentCreate.mockResolvedValueOnce(record);

      await createDeployment({ deploymentName: 'my-app', jarId: 42 });

      expect(mockBuildStateBucketName).toHaveBeenCalledWith('my-app');
      expect(mockEnsureStateBucketExists).toHaveBeenCalledWith('flink-my-app');
    });

    it('passes stateBucketName to Deployment.create', async () => {
      const record = makeRecord();
      mockDeploymentFindOne.mockResolvedValueOnce(null);
      mockDeploymentCreate.mockResolvedValueOnce(record);

      await createDeployment({ deploymentName: 'my-app', jarId: 42 });

      expect(mockDeploymentCreate).toHaveBeenCalledWith(
        expect.objectContaining({ stateBucketName: 'flink-my-app' }),
        expect.anything()
      );
    });

    it('passes stateBucketName to createFlinkCluster', async () => {
      const record = makeRecord();
      mockDeploymentFindOne.mockResolvedValueOnce(null);
      mockDeploymentCreate.mockResolvedValueOnce(record);

      await createDeployment({ deploymentName: 'my-app', jarId: 42 });

      expect(mockCreateFlinkCluster).toHaveBeenCalledWith(
        'my-app', 'default',
        expect.any(Object),
        expect.any(Object),
        undefined,
        'flink-my-app'
      );
    });
  });

  // ── createDeployment — session mode ────────────────────────────────────────
  describe('createDeployment — session mode', () => {
    it('does NOT provision a state bucket', async () => {
      const record = makeRecord({ deploymentMode: 'session', stateBucketName: null });
      mockDeploymentFindOne.mockResolvedValueOnce(null);
      mockDeploymentCreate.mockResolvedValueOnce(record);
      mockCreateFlinkCluster.mockResolvedValue(mockCrd());

      await createDeployment({ deploymentName: 'my-session' });

      expect(mockEnsureStateBucketExists).not.toHaveBeenCalled();
      expect(mockDeploymentCreate).toHaveBeenCalledWith(
        expect.objectContaining({ stateBucketName: null }),
        expect.anything()
      );
    });
  });

  // ── deleteDeployment ────────────────────────────────────────────────────────
  describe('deleteDeployment', () => {
    it('deletes the state bucket after successful K8s CRD deletion', async () => {
      const record = makeRecord({ status: 'running', stateBucketName: 'flink-my-app' });
      mockDeploymentFindOne.mockResolvedValueOnce(record);
      mockDeleteFlinkDeployment.mockResolvedValueOnce(undefined);

      await deleteDeployment('my-app');

      expect(mockDeleteStateBucket).toHaveBeenCalledWith('flink-my-app');
    });

    it('does NOT call deleteStateBucket when stateBucketName is null', async () => {
      const record = makeRecord({ status: 'running', stateBucketName: null });
      mockDeploymentFindOne.mockResolvedValueOnce(record);
      mockDeleteFlinkDeployment.mockResolvedValueOnce(undefined);

      await deleteDeployment('my-app');

      expect(mockDeleteStateBucket).not.toHaveBeenCalled();
    });
  });

  // ── triggerSavepoint ────────────────────────────────────────────────────────
  describe('triggerSavepoint', () => {
    it('throws NotFoundError when deployment does not exist', async () => {
      mockDeploymentFindOne.mockResolvedValueOnce(null);

      await expect(triggerSavepoint('missing')).rejects.toMatchObject({
        name: 'NotFoundError',
      });
    });

    it('throws ValidationError for session-mode deployments', async () => {
      mockDeploymentFindOne.mockResolvedValueOnce(
        makeRecord({ deploymentMode: 'session' })
      );

      await expect(triggerSavepoint('my-app')).rejects.toMatchObject({
        name: 'ValidationError',
      });
    });

    it('throws ValidationError when deployment is not running', async () => {
      mockDeploymentFindOne.mockResolvedValueOnce(
        makeRecord({ status: 'failed' })
      );

      await expect(triggerSavepoint('my-app')).rejects.toMatchObject({
        name: 'ValidationError',
      });
    });

    it('happy path: triggers savepoint, polls, stores path, returns it', async () => {
      jest.useFakeTimers();
      const now = Date.now();

      const record = makeRecord();
      mockDeploymentFindOne.mockResolvedValueOnce(record);
      mockK8sTriggerSavepoint.mockResolvedValueOnce(now);
      mockGetSavepointStatus
        .mockResolvedValueOnce({ lastSavepointPath: null, timestamp: null, completed: false })
        .mockResolvedValueOnce({
          lastSavepointPath: 's3://flink-my-app/savepoints/sp-1',
          timestamp: now + 10000,
          completed: true,
        });

      const resultPromise = triggerSavepoint('my-app');
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(mockK8sTriggerSavepoint).toHaveBeenCalledWith('my-app', 'default');
      expect(mockDeploymentSave).toHaveBeenCalled();
      expect(record.lastSavepointPath).toBe('s3://flink-my-app/savepoints/sp-1');
      expect(result).toEqual({ savepointPath: 's3://flink-my-app/savepoints/sp-1' });

      jest.useRealTimers();
    });

    it('ignores a stale savepoint predating the trigger and waits for a fresh one', async () => {
      jest.useFakeTimers();
      const now = Date.now();

      const record = makeRecord();
      mockDeploymentFindOne.mockResolvedValueOnce(record);
      mockK8sTriggerSavepoint.mockResolvedValueOnce(now);
      mockGetSavepointStatus
        // Stale: a savepoint already existed from an earlier Stop/trigger, timestamped before this trigger call
        .mockResolvedValueOnce({
          lastSavepointPath: 's3://flink-my-app/savepoints/sp-OLD',
          timestamp: now - 60000,
          completed: true,
        })
        // Fresh: this is the savepoint actually produced by this trigger
        .mockResolvedValueOnce({
          lastSavepointPath: 's3://flink-my-app/savepoints/sp-NEW',
          timestamp: now + 10000,
          completed: true,
        });

      const resultPromise = triggerSavepoint('my-app');
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(record.lastSavepointPath).toBe('s3://flink-my-app/savepoints/sp-NEW');
      expect(result).toEqual({ savepointPath: 's3://flink-my-app/savepoints/sp-NEW' });

      jest.useRealTimers();
    });
  });

  // ── syncDeployment (via getDeployment) — Stop savepoint sync ───────────────────
  describe('syncDeployment — savepoint sync on Stop completion', () => {
    it('stores lastSavepointPath when a plain stop resolves to SUSPENDED', async () => {
      const record = makeRecord({
        status: 'running',
        pendingAction: 'stop',
        lastSavepointPath: null,
      });
      mockDeploymentFindOne.mockResolvedValueOnce(record);
      mockGetFlinkDeploymentStatus.mockResolvedValueOnce({
        lifecycleState: 'DEPLOYED',
        jobStatus: {
          state: 'FINISHED',
          savepointInfo: {
            lastSavepoint: { location: 's3://flink-my-app/savepoints/stop-sp-1' },
          },
        },
        specJobState: 'suspended',
        error: null,
      });

      await getDeployment('my-app');

      expect(record.lastSavepointPath).toBe('s3://flink-my-app/savepoints/stop-sp-1');
      expect(mockDeploymentSave).toHaveBeenCalled();
    });

    it('does not touch lastSavepointPath when a force_stop resolves to SUSPENDED', async () => {
      const record = makeRecord({
        status: 'running',
        pendingAction: 'force_stop',
        lastSavepointPath: null,
      });
      mockDeploymentFindOne.mockResolvedValueOnce(record);
      mockGetFlinkDeploymentStatus.mockResolvedValueOnce({
        lifecycleState: 'DEPLOYED',
        jobStatus: {
          state: 'FINISHED',
          // Leftover location from an earlier stop cycle - must not be picked up by force_stop
          savepointInfo: {
            lastSavepoint: { location: 's3://flink-my-app/savepoints/leftover' },
          },
        },
        specJobState: 'suspended',
        error: null,
      });

      await getDeployment('my-app');

      expect(record.lastSavepointPath).toBeNull();
    });
  });
});
