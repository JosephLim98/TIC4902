import { ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';

export default function validateRequest(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abort
        })
    }
}