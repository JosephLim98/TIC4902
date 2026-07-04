import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockBucketExists  = jest.fn();
const mockMakeBucket    = jest.fn();
const mockListObjects   = jest.fn();
const mockRemoveObjects = jest.fn();
const mockRemoveBucket  = jest.fn();

jest.unstable_mockModule('minio', () => ({
  Client: jest.fn().mockImplementation(() => ({
    bucketExists:  mockBucketExists,
    makeBucket:    mockMakeBucket,
    listObjects:   mockListObjects,
    removeObjects: mockRemoveObjects,
    removeBucket:  mockRemoveBucket,
    putObject:     jest.fn(),
    removeObject:  jest.fn(),
  })),
}));

const { buildStateBucketName, ensureStateBucketExists, deleteStateBucket } =
  await import('../src/service/minioService.js');

function makeListStream(objectNames) {
  const stream = new EventEmitter();
  process.nextTick(() => {
    objectNames.forEach(name => stream.emit('data', { name }));
    stream.emit('end');
  });
  return stream;
}

describe('MinIO state bucket helpers', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── buildStateBucketName ────────────────────────────────────────────────────
  describe('buildStateBucketName', () => {
    it('prefixes short names with flink-', () => {
      expect(buildStateBucketName('my-job')).toBe('flink-my-job');
    });

    it('keeps result at or under 63 chars for a 63-char deployment name', () => {
      const longName = 'a'.repeat(63);
      const result = buildStateBucketName(longName);
      expect(result.length).toBeLessThanOrEqual(63);
      expect(result.startsWith('flink-')).toBe(true);
    });
  });

  // ── ensureStateBucketExists ─────────────────────────────────────────────────
  describe('ensureStateBucketExists', () => {
    it('creates the bucket when it does not exist', async () => {
      mockBucketExists.mockResolvedValueOnce(false);
      mockMakeBucket.mockResolvedValueOnce(undefined);

      await ensureStateBucketExists('flink-my-job');

      expect(mockMakeBucket).toHaveBeenCalledWith('flink-my-job', 'us-east-1');
    });

    it('skips creation when bucket already exists', async () => {
      mockBucketExists.mockResolvedValueOnce(true);

      await ensureStateBucketExists('flink-my-job');

      expect(mockMakeBucket).not.toHaveBeenCalled();
    });
  });

  // ── deleteStateBucket ───────────────────────────────────────────────────────
  describe('deleteStateBucket', () => {
    it('removes all objects then deletes the bucket', async () => {
      mockListObjects.mockReturnValueOnce(makeListStream(['checkpoints/cp1', 'savepoints/sp1']));
      mockRemoveObjects.mockResolvedValueOnce(undefined);
      mockRemoveBucket.mockResolvedValueOnce(undefined);

      await deleteStateBucket('flink-my-job');

      expect(mockRemoveObjects).toHaveBeenCalledWith(
        'flink-my-job',
        expect.arrayContaining(['checkpoints/cp1', 'savepoints/sp1'])
      );
      expect(mockRemoveBucket).toHaveBeenCalledWith('flink-my-job');
    });

    it('still calls removeBucket when bucket is empty', async () => {
      mockListObjects.mockReturnValueOnce(makeListStream([]));
      mockRemoveBucket.mockResolvedValueOnce(undefined);

      await deleteStateBucket('flink-my-job');

      expect(mockRemoveObjects).not.toHaveBeenCalled();
      expect(mockRemoveBucket).toHaveBeenCalledWith('flink-my-job');
    });

    it('swallows errors instead of throwing', async () => {
      mockListObjects.mockReturnValueOnce(makeListStream([]));
      mockRemoveBucket.mockRejectedValueOnce(new Error('bucket not found'));

      await expect(deleteStateBucket('flink-my-job')).resolves.toBeUndefined();
    });
  });
});
