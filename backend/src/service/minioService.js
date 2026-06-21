import * as Minio from 'minio';
import logger from '../utils/logger.js';

const minioClient = new Minio.Client({
  endPoint:  process.env.MINIO_ENDPOINT  || 'localhost',
  port:      parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL:    process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ROOT_USER     || 'minioadmin',
  secretKey: process.env.MINIO_ROOT_PASSWORD || 'minioadmin',
});

const BUCKET      = process.env.MINIO_BUCKET      || 'flink-jars';
const PUBLIC_HOST = process.env.MINIO_PUBLIC_HOST || 'host.minikube.internal';
const PUBLIC_PORT = process.env.MINIO_PORT        || '9000';

export function buildJarUrl(objectName) {
  return `http://${PUBLIC_HOST}:${PUBLIC_PORT}/${BUCKET}/${objectName}`;
}

export async function ensureBucketExists() {
  const exists = await minioClient.bucketExists(BUCKET);
  if (exists) {
    logger.info('MinIO bucket ready', { bucket: BUCKET });
    return;
  }
  await minioClient.makeBucket(BUCKET, 'us-east-1');
  const policy = JSON.stringify({
    Version: '2012-10-17',
    Statement: [{
      Effect: 'Allow',
      Principal: { AWS: ['*'] },
      Action: ['s3:GetObject'],
      Resource: [`arn:aws:s3:::${BUCKET}/*`],
    }],
  });
  await minioClient.setBucketPolicy(BUCKET, policy);
  logger.info('Created MinIO bucket with public-read policy', { bucket: BUCKET });
}

export async function uploadJar(objectName, buffer, size) {
  await minioClient.putObject(BUCKET, objectName, buffer, size, {
    'Content-Type': 'application/java-archive',
  });
  logger.info('Uploaded JAR to MinIO', { bucket: BUCKET, objectName });
  return buildJarUrl(objectName);
}

export async function deleteJar(objectName) {
  await minioClient.removeObject(BUCKET, objectName);
  logger.info('Deleted JAR from MinIO', { bucket: BUCKET, objectName });
}
