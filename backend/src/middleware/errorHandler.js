import logger from '../utils/logger.js';

export default function errorHandler(err, req, res, next) {
  logger.error('Error', { message: err.message, stack: err.stack });

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal Server Error' : err.message
  });
}
