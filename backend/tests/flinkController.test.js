import { beforeEach, describe, expect, it, jest } from "@jest/globals";

// Mock the service
const mockCreateDeployment = jest.fn();
const mockGetDeployment = jest.fn();
const mockListDeployments = jest.fn();

jest.unstable_mockModule("../src/service/flinkService.js", () => ({
  createDeployment: mockCreateDeployment,
  getDeployment: mockGetDeployment,
  listDeployments: mockListDeployments,
}));

// Import after mocking
const { getDeployment, listDeployments } = await import(
  "../src/controller/flinkController.js"
);

const mockK8sStatus = {
  lifecycleState: "STABLE",
  jobManagerDeploymentStatus: "READY",
  jobStatus: null,
  error: null,
};

const mockDeployment = {
  id: 1,
  deploymentName: "my-flink-job",
  namespace: "default",
  status: "running",
  deploymentMode: "session",
  config: { image: "flink:1.19" },
  createdAt: new Date("2026-04-11T00:00:00.000Z"),
  kubernetesStatus: mockK8sStatus,
  resources: [
    {
      name: "my-flink-job",
      uid: "abc-123",
      apiVersion: "flink.apache.org/v1beta1",
    },
  ],
};

describe("Flink Controller Tests", () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = { params: {}, body: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  describe("getDeployment", () => {
    it("should return 200 with deployment details on success", async () => {
      mockReq.params = { deploymentName: "my-flink-job" };
      mockGetDeployment.mockResolvedValueOnce(mockDeployment);

      await getDeployment(mockReq, mockRes, mockNext);

      expect(mockGetDeployment).toHaveBeenCalledWith("my-flink-job");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      const jsonCall = mockRes.json.mock.calls[0][0];
      expect(jsonCall.deploymentName).toBe("my-flink-job");
      expect(jsonCall.status).toBe("running");
      expect(jsonCall.kubernetesStatus).toEqual(mockK8sStatus);
      expect(jsonCall.flinkDeployment).toEqual({
        name: "my-flink-job",
        uid: "abc-123",
        apiVersion: "flink.apache.org/v1beta1",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should call next with NotFoundError when deployment does not exist", async () => {
      const error = new Error("Deployment 'missing' not found");
      error.name = "NotFoundError";
      error.statusCode = 404;

      mockReq.params = { deploymentName: "missing" };
      mockGetDeployment.mockRejectedValueOnce(error);

      await getDeployment(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should call next with error on unexpected failure", async () => {
      const error = new Error("Database error");

      mockReq.params = { deploymentName: "my-flink-job" };
      mockGetDeployment.mockRejectedValueOnce(error);

      await getDeployment(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe("listDeployments", () => {
    it("should return 200 with deployments array and total on success", async () => {
      const mockDeployment2 = {
        ...mockDeployment,
        id: 2,
        deploymentName: "second-job",
        resources: [],
      };
      mockListDeployments.mockResolvedValueOnce([mockDeployment, mockDeployment2]);

      await listDeployments(mockReq, mockRes, mockNext);

      expect(mockListDeployments).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      const jsonCall = mockRes.json.mock.calls[0][0];
      expect(jsonCall.total).toBe(2);
      expect(jsonCall.deployments).toHaveLength(2);
      expect(jsonCall.deployments[0].deploymentName).toBe("my-flink-job");
      expect(jsonCall.deployments[0].kubernetesStatus).toEqual(mockK8sStatus);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 200 with empty array when no deployments exist", async () => {
      mockListDeployments.mockResolvedValueOnce([]);

      await listDeployments(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const jsonCall = mockRes.json.mock.calls[0][0];
      expect(jsonCall.total).toBe(0);
      expect(jsonCall.deployments).toHaveLength(0);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should call next with error on unexpected failure", async () => {
      const error = new Error("Database error");
      mockListDeployments.mockRejectedValueOnce(error);

      await listDeployments(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});
