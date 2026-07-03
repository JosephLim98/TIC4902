import { randomUUID } from 'crypto';
import { Op } from 'sequelize';
import Jar from '../models/jarModel.js';
import Deployment from '../models/deploymentModel.js';
import { buildJarUrl, uploadJar as minioUpload, deleteJar as minioDelete } from './minioService.js';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors.js';
import { DEPLOYMENT_STATUS } from '../utils/constants.js';
import logger from '../utils/logger.js';

function validateId(id) {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId) || parsedId <= 0) {
      throw new ValidationError(`Invalid id ${id}. ID must be a positive integer`);
    }
    return parsedId;
}

export async function uploadJar(file, uploadedBy = null, entryClass = null) {
  const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const objectName = `${randomUUID()}-${safeName}`;

  const url = await minioUpload(objectName, file.buffer, file.size);

  try {
    const jar = await Jar.create({
      name: file.originalname,
      objectName,
      sizeBytes: file.size,
      uploadedBy,
      entryClass: entryClass || null
    });
    logger.info('JAR uploaded', { id: jar.id, name: jar.name, entryClass: jar.entryClass });
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

export async function getJarById(id) {
  const jarId = validateId(id);
  const jar = await Jar.findByPk(jarId);
  if (!jar) throw new NotFoundError(`Jar with id '${jarId}' not found`, jarId);
  const plain = jar.toJSON();
  plain.url = buildJarUrl(plain.objectName);
  return plain;
}

export async function deleteJar(id) {
  const jarId = validateId(id);
  const jar = await Jar.findByPk(jarId);
  if (!jar) throw new NotFoundError(`Jar with id '${jarId}' not found`, jarId);

  // Only block deletion of deployments that are still active (not deleted or failed ones)
  const activeDeployments = await Deployment.count({
    where: {
      jarId: jarId,
      status: { [Op.notIn]: [DEPLOYMENT_STATUS.DELETED, DEPLOYMENT_STATUS.FAILED] }
    }
  });
  if (activeDeployments > 0) {
    const label = activeDeployments === 1 ? 'deployment' : 'deployments';
    throw new ConflictError(`Cannot delete JAR '${jar.name}' as ${activeDeployments} active ${label} reference it`, jarId);
  }

  await minioDelete(jar.objectName).catch(() => {});
  await jar.destroy();
  logger.info('JAR deleted', { jarId: jar.id, name: jar.name })
}
