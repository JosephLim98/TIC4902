import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.unstable_mockModule('../src/utils/constants.js', () => ({
  DEPLOYMENT_STATUS: {
    CREATING:      'creating',
    RUNNING:       'running',
    FAILED:        'failed',
    DELETED:       'deleted',
    DELETING:      'deleting',
    SUSPENDED:     'suspended',
    UNKNOWN:       'unknown',
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
  SAVEPOINT_POLL: { INTERVAL_MS: 5000, TIMEOUT_MS: 120000 },
}));

jest.unstable_mockModule('../src/service/minioService.js', () => ({
  buildStateBucketName:    jest.fn(),
  ensureStateBucketExists: jest.fn(),
  deleteStateBucket:       jest.fn(),
  buildJarUrl:             jest.fn(),
  ensureBucketExists:      jest.fn(),
  uploadJar:               jest.fn(),
  deleteJar:               jest.fn(),
}));

const mockResumeFlinkDeployment  = jest.fn();
const mockResumeFromSavepoint    = jest.fn();
const mockResumeWithoutSavepoint = jest.fn();

jest.unstable_mockModule('../src/service/kubernetesService.js', () => ({
  createFlinkCluster:        jest.fn(),
  deleteFlinkDeployment:     jest.fn(),
  triggerSavepoint:          jest.fn(),
  getSavepointStatus:        jest.fn(),
  patchFlinkDeployment:      jest.fn(),
  getFlinkDeploymentStatus:  jest.fn(),
  resumeFlinkDeployment:     mockResumeFlinkDeployment,
  resumeFromSavepoint:       mockResumeFromSavepoint,
  resumeWithoutSavepoint:    mockResumeWithoutSavepoint,
}));

jest.unstable_mockModule('../src/service/jarService.js', () => ({
  getJarById: jest.fn(),
}));

const mockDeploymentFindOne = jest.fn();
const mockDeploymentSave    = jest.fn();
const mockSavepointFindOne  = jest.fn();
const mockSavepointFindAll  = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  Deployment: { findOne: mockDeploymentFindOne, findAll: jest.fn().mockResolvedValue([]), create: jest.fn() },
  Jar: {},
  Savepoint: { findOne: mockSavepointFindOne, findAll: mockSavepointFindAll, findOrCreate: jest.fn() },
}));

jest.unstable_mockModule('../src/config/database.js', () => ({
  default: { transaction: jest.fn() },
}));

jest.unstable_mockModule('../src/models/flinkConfigModel.js', () => ({
  FlinkConfig: { findOne: jest.fn() },
}));

const { resumeDeployment, listSavepoints } = await import('../src/service/flinkService.js');

function makeDeployment(overrides = {}) {
  return {
    id: 1,
    deploymentName: 'my-app',
    namespace: 'default',
    deploymentMode: 'application',
    status: 'suspended',
    pendingAction: null,
    save: mockDeploymentSave,
    toJSON() { return { ...this }; },
    ...overrides,
  };
}

describe('flinkService — resumeDeployment savepoint selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeploymentSave.mockResolvedValue(undefined);
  });

  it('uses resumeFlinkDeployment (no options) for the default/no-selection case', async () => {
    mockDeploymentFindOne.mockResolvedValueOnce(makeDeployment());

    await resumeDeployment('my-app');

    expect(mockResumeFlinkDeployment).toHaveBeenCalledWith('my-app', 'default');
    expect(mockResumeFromSavepoint).not.toHaveBeenCalled();
    expect(mockResumeWithoutSavepoint).not.toHaveBeenCalled();
  });

  it('uses resumeFlinkDeployment when the selected savepointId is the most recent one', async () => {
    mockDeploymentFindOne.mockResolvedValueOnce(makeDeployment());
    mockSavepointFindOne
      .mockResolvedValueOnce({ id: 5, path: 's3://bucket/sp-5' }) // lookup of chosen id
      .mockResolvedValueOnce({ id: 5, path: 's3://bucket/sp-5' }); // most-recent query

    await resumeDeployment('my-app', { savepointId: 5 });

    expect(mockResumeFlinkDeployment).toHaveBeenCalledWith('my-app', 'default');
    expect(mockResumeFromSavepoint).not.toHaveBeenCalled();
  });

  it('uses resumeFromSavepoint with the chosen path when an older savepointId is selected', async () => {
    mockDeploymentFindOne.mockResolvedValueOnce(makeDeployment());
    mockSavepointFindOne
      .mockResolvedValueOnce({ id: 3, path: 's3://bucket/sp-3' }) // lookup of chosen id
      .mockResolvedValueOnce({ id: 5, path: 's3://bucket/sp-5' }); // most-recent query (different id)

    await resumeDeployment('my-app', { savepointId: 3 });

    expect(mockResumeFromSavepoint).toHaveBeenCalledWith('my-app', 'default', 's3://bucket/sp-3');
    expect(mockResumeFlinkDeployment).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when savepointId does not belong to the deployment', async () => {
    mockDeploymentFindOne.mockResolvedValueOnce(makeDeployment());
    mockSavepointFindOne.mockResolvedValueOnce(null);

    await expect(resumeDeployment('my-app', { savepointId: 999 })).rejects.toMatchObject({
      name: 'NotFoundError',
    });
    expect(mockResumeFlinkDeployment).not.toHaveBeenCalled();
    expect(mockResumeFromSavepoint).not.toHaveBeenCalled();
  });

  it('uses resumeWithoutSavepoint when skipSavepoint is true, ignoring any savepointId lookup', async () => {
    mockDeploymentFindOne.mockResolvedValueOnce(makeDeployment());

    await resumeDeployment('my-app', { skipSavepoint: true });

    expect(mockResumeWithoutSavepoint).toHaveBeenCalledWith('my-app', 'default');
    expect(mockResumeFlinkDeployment).not.toHaveBeenCalled();
    expect(mockResumeFromSavepoint).not.toHaveBeenCalled();
    expect(mockSavepointFindOne).not.toHaveBeenCalled();
  });

  it('throws ValidationError when both savepointId and skipSavepoint are given', async () => {
    mockDeploymentFindOne.mockResolvedValueOnce(makeDeployment());

    await expect(resumeDeployment('my-app', { savepointId: 1, skipSavepoint: true })).rejects.toMatchObject({
      name: 'ValidationError',
    });
    expect(mockResumeFlinkDeployment).not.toHaveBeenCalled();
    expect(mockResumeFromSavepoint).not.toHaveBeenCalled();
    expect(mockResumeWithoutSavepoint).not.toHaveBeenCalled();
  });

  it('clears pendingAction and rethrows if the k8s call fails', async () => {
    const deployment = makeDeployment();
    mockDeploymentFindOne.mockResolvedValueOnce(deployment);
    mockResumeFlinkDeployment.mockRejectedValueOnce(new Error('k8s down'));

    await expect(resumeDeployment('my-app')).rejects.toThrow('k8s down');
    expect(deployment.pendingAction).toBeNull();
  });
});

describe('flinkService — listSavepoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns savepoints for the deployment ordered by createdAt DESC', async () => {
    mockDeploymentFindOne.mockResolvedValueOnce(makeDeployment());
    const rows = [
      { id: 2, path: 's3://bucket/sp-2', source: 'manual', createdAt: '2026-01-02', toJSON() { return this; } },
      { id: 1, path: 's3://bucket/sp-1', source: 'stop', createdAt: '2026-01-01', toJSON() { return this; } },
    ];
    mockSavepointFindAll.mockResolvedValueOnce(rows);

    const result = await listSavepoints('my-app');

    expect(mockSavepointFindAll).toHaveBeenCalledWith({
      where: { deploymentId: 1 },
      order: [['created_at', 'DESC']],
    });
    expect(result).toEqual(rows);
  });

  it('throws NotFoundError when the deployment does not exist', async () => {
    mockDeploymentFindOne.mockResolvedValueOnce(null);

    await expect(listSavepoints('missing')).rejects.toMatchObject({ name: 'NotFoundError' });
  });
});
