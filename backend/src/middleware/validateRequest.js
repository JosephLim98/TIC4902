import { ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';

export default function validateRequest(schema) {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });
  
      if (error) {
        const details = error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message
        }));
  
        return next(new ValidationError('Request validation failed', details));
      }
  
      req.body = value;
      next();
    };
  }
  