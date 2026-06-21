import { randomUUID } from 'crypto';
import Jar from '../models/jarModel.js';
import { buildJarUrl, uploadJar as minioUpload, deleteJar as minioDelete } from './minioService.js';
import { NotFoundError } from '../utils/errors.js';
import logger from '../utils/logger.js';

export async function uploadJar(file, uploadedBy = null) {
  const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const objectName = `${randomUUID()}-${safeName}`;

  const url = await minioUpload(objectName, file.buffer, file.size);

  try {
    const jar = await Jar.create({
      name: file.originalname,
      objectName,
      sizeBytes: file.size,
      uploadedBy,
    });
    const result = jar.toJSON();
    result.url = url;
    return result;
  } catch (dbError) {
    logger.error('DB insert failed after MinIO upload, rolling back', { objectName });
    await minioDelete(objectName).catch(() => {});
    throw dbError;
  }
}

export async function listJars() {
  const jars = await Jar.findAll({ order: [['created_at', 'DESC']] });
  return jars.map(j => {
    const plain = j.toJSON();
    plain.url = buildJarUrl(plain.objectName);
    return plain;
  });
}

export async function getJarById(jarId) {
  const jar = await Jar.findByPk(jarId);
  if (!jar) throw new NotFoundError(`Jar with id '${jarId}' not found`, jarId);
  const plain = jar.toJSON();
  plain.url = buildJarUrl(plain.objectName);
  return plain;
}
