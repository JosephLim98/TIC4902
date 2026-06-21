import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockMinioUpload = jest.fn();
const mockMinioDelete = jest.fn();
const mockBuildJarUrl = jest.fn((objectName) => `http://host.minikube.internal:9000/flink-jars/${objectName}`);

jest.unstable_mockModule("../src/service/minioService.js", () => ({
  uploadJar: mockMinioUpload,
  deleteJar: mockMinioDelete,
  buildJarUrl: mockBuildJarUrl,
}));

const mockJarCreate = jest.fn();
const mockJarFindAll = jest.fn();
const mockJarFindByPk = jest.fn();

jest.unstable_mockModule("../src/models/jarModel.js", () => ({
  default: {
    create: mockJarCreate,
    findAll: mockJarFindAll,
    findByPk: mockJarFindByPk,
  },
}));

const { uploadJar, listJars, getJarById } = await import("../src/service/jarService.js");

describe("Jar Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("uploadJar", () => {
    const mockFile = {
      originalname: "my-job.jar",
      size: 2048,
      buffer: Buffer.from("fake-jar-content"),
    };

    it("should upload to MinIO then create DB record and return jar with url", async () => {
      const objectNameCapture = [];
      mockMinioUpload.mockImplementation(async (objectName) => {
        objectNameCapture.push(objectName);
        return `http://host.minikube.internal:9000/flink-jars/${objectName}`;
      });
      const createdJar = {
        id: 1,
        name: "my-job.jar",
        objectName: "uuid-my-job.jar",
        sizeBytes: 2048,
        uploadedBy: 5,
        toJSON() { return { ...this }; },
      };
      mockJarCreate.mockResolvedValueOnce(createdJar);

      const result = await uploadJar(mockFile, 5);

      expect(mockMinioUpload).toHaveBeenCalledTimes(1);
      const [calledObjectName, calledBuffer, calledSize] = mockMinioUpload.mock.calls[0];
      expect(calledObjectName).toMatch(/^[a-f0-9-]+-my-job\.jar$/);
      expect(calledBuffer).toBe(mockFile.buffer);
      expect(calledSize).toBe(2048);

      expect(mockJarCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "my-job.jar", sizeBytes: 2048, uploadedBy: 5 })
      );
      expect(result.url).toMatch(/flink-jars\//);
    });

    it("should roll back MinIO object if DB create fails", async () => {
      mockMinioUpload.mockResolvedValueOnce("http://minio/flink-jars/some-obj.jar");
      mockMinioDelete.mockResolvedValueOnce(undefined);
      const dbError = new Error("unique constraint violation");
      mockJarCreate.mockRejectedValueOnce(dbError);

      await expect(uploadJar(mockFile)).rejects.toThrow("unique constraint violation");

      expect(mockMinioDelete).toHaveBeenCalledTimes(1);
    });

    it("should not call MinIO delete if MinIO upload itself fails", async () => {
      mockMinioUpload.mockRejectedValueOnce(new Error("MinIO unreachable"));

      await expect(uploadJar(mockFile)).rejects.toThrow("MinIO unreachable");

      expect(mockMinioDelete).not.toHaveBeenCalled();
      expect(mockJarCreate).not.toHaveBeenCalled();
    });
  });

  describe("listJars", () => {
    it("should return jars with url appended via buildJarUrl", async () => {
      const jarsFromDb = [
        {
          toJSON() {
            return { id: 1, name: "job.jar", objectName: "uuid-job.jar", sizeBytes: 1024 };
          },
        },
      ];
      mockJarFindAll.mockResolvedValueOnce(jarsFromDb);

      const result = await listJars();

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe("http://host.minikube.internal:9000/flink-jars/uuid-job.jar");
      expect(mockBuildJarUrl).toHaveBeenCalledWith("uuid-job.jar");
    });

    it("should return empty array when no jars exist", async () => {
      mockJarFindAll.mockResolvedValueOnce([]);

      const result = await listJars();

      expect(result).toEqual([]);
    });
  });

  describe("getJarById", () => {
    it("should return jar with url when found", async () => {
      const jar = {
        toJSON() {
          return { id: 3, name: "found.jar", objectName: "xyz-found.jar", sizeBytes: 512 };
        },
      };
      mockJarFindByPk.mockResolvedValueOnce(jar);

      const result = await getJarById(3);

      expect(result.id).toBe(3);
      expect(result.url).toBe("http://host.minikube.internal:9000/flink-jars/xyz-found.jar");
    });

    it("should throw NotFoundError when jar does not exist", async () => {
      mockJarFindByPk.mockResolvedValueOnce(null);

      await expect(getJarById(999)).rejects.toMatchObject({
        name: "NotFoundError",
        statusCode: 404,
      });
    });
  });
});
