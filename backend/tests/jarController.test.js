import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockUploadJar = jest.fn();
const mockListJars = jest.fn();

jest.unstable_mockModule("../src/service/jarService.js", () => ({
  uploadJar: mockUploadJar,
  listJars: mockListJars,
  getJarById: jest.fn(),
}));

const { uploadJar, listJars } = await import("../src/controller/jarController.js");

const mockJar = {
  id: 1,
  name: "my-job.jar",
  objectName: "abc-my-job.jar",
  sizeBytes: 1024,
  uploadedBy: 42,
  createdAt: new Date("2026-06-21T00:00:00.000Z"),
  url: "http://host.minikube.internal:9000/flink-jars/abc-my-job.jar",
};

describe("Jar Controller", () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = { body: {}, user: { id: 42 } };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
    mockNext = jest.fn();
  });

  describe("uploadJar", () => {
    it("should return 400 when no file is provided", async () => {
      mockReq.file = undefined;

      await uploadJar(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "No file uploaded" });
      expect(mockUploadJar).not.toHaveBeenCalled();
    });

    it("should return 201 with formatted jar on success", async () => {
      mockReq.file = {
        originalname: "my-job.jar",
        size: 1024,
        buffer: Buffer.from("fake-jar"),
      };
      mockUploadJar.mockResolvedValueOnce(mockJar);

      await uploadJar(mockReq, mockRes, mockNext);

      expect(mockUploadJar).toHaveBeenCalledWith(mockReq.file, 42);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      const json = mockRes.json.mock.calls[0][0];
      expect(json.id).toBe(1);
      expect(json.name).toBe("my-job.jar");
      expect(json.url).toBe("http://host.minikube.internal:9000/flink-jars/abc-my-job.jar");
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should call next with error when service throws", async () => {
      mockReq.file = { originalname: "bad.jar", size: 0, buffer: Buffer.alloc(0) };
      const err = new Error("MinIO connection refused");
      mockUploadJar.mockRejectedValueOnce(err);

      await uploadJar(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe("listJars", () => {
    it("should return 200 with jars array and total", async () => {
      mockListJars.mockResolvedValueOnce([mockJar]);

      await listJars(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const json = mockRes.json.mock.calls[0][0];
      expect(json.total).toBe(1);
      expect(json.jars).toHaveLength(1);
      expect(json.jars[0].id).toBe(1);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 200 with empty list when no jars", async () => {
      mockListJars.mockResolvedValueOnce([]);

      await listJars(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ jars: [], total: 0 });
    });

    it("should call next with error when service throws", async () => {
      const err = new Error("Database error");
      mockListJars.mockRejectedValueOnce(err);

      await listJars(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
    });
  });
});
