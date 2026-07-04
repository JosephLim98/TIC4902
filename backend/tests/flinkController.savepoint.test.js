import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockTriggerSavepoint = jest.fn();

jest.unstable_mockModule('../src/service/flinkService.js', () => ({
  triggerSavepoint: mockTriggerSavepoint,
  createDeployment: jest.fn(),
  getDeployment:    jest.fn(),
  listDeployments:  jest.fn(),
  deleteDeployment: jest.fn(),
  updateDeployment: jest.fn(),
}));

const { triggerSavepoint } = await import('../src/controller/flinkController.js');

describe('Flink Controller — triggerSavepoint', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq  = { params: { deploymentName: 'my-app' }, body: {} };
    mockRes  = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    mockNext = jest.fn();
  });

  it('returns 200 with savepointPath on success', async () => {
    const path = 's3://flink-my-app/savepoints/savepoint-abc';
    mockTriggerSavepoint.mockResolvedValueOnce({ savepointPath: path });

    await triggerSavepoint(mockReq, mockRes, mockNext);

    expect(mockTriggerSavepoint).toHaveBeenCalledWith('my-app');
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({ savepointPath: path });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('calls next with error when service throws', async () => {
    const error = new Error('Savepoint timed out');
    mockTriggerSavepoint.mockRejectedValueOnce(error);

    await triggerSavepoint(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('calls next with ValidationError for non-application mode', async () => {
    const error = new Error('Savepoints are only supported for application mode deployments');
    error.name = 'ValidationError';
    error.statusCode = 400;
    mockTriggerSavepoint.mockRejectedValueOnce(error);

    await triggerSavepoint(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('calls next with NotFoundError when deployment does not exist', async () => {
    const error = new Error("Deployment 'my-app' not found");
    error.name = 'NotFoundError';
    error.statusCode = 404;
    mockTriggerSavepoint.mockRejectedValueOnce(error);

    await triggerSavepoint(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });
});
