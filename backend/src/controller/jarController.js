import * as jarService from '../service/jarService.js';
import logger from '../utils/logger.js';

function formatJar(jar) {
  return {
    id: jar.id,
    name: jar.name,
    objectName: jar.objectName,
    sizeBytes: jar.sizeBytes,
    uploadedBy: jar.uploadedBy,
    entryClass: jar.entryClass ?? null,
    createdAt: jar.createdAt,
    url: jar.url,
  };
}

export async function uploadJar(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    logger.info('Received JAR upload', {
      originalName: req.file.originalname,
      size: req.file.size,
      userId: req.user?.id,
      entryClass: req.body?.entryClass
    });
    const jar = await jarService.uploadJar(req.file, req.user?.id);
    res.status(201).json(formatJar(jar));
  } catch (err) {
    next(err);
  }
}

export async function listJars(req, res, next) {
  try {
    const jars = await jarService.listJars();
    res.status(200).json({ jars: jars.map(formatJar), total: jars.length });
  } catch (err) {
    next(err);
  }
}

export async function deleteJar(req, res, next) {
  try {
    await jarService.deleteJar(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
