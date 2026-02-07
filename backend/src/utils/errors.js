export class ValidationError extends Error {
    constructor(message, details = null) {
        super(message);
        this.name = 'ValidationError';
        this.statusCode = 400;
        this.details = details;
    }
}

export class KubernetesError extends Error {
    constructor(message, originalError = null) {
        super(message);
        this.name = 'KubernetesError';
        this.statusCode = 500;
        this.originalError = originalError;
    }
}

export class ConflictError extends Error {
    constructor(message, resource = null) {
        super(message);
        this.name = 'ConflictError';
        this.statusCode = 409;
        this.resource = resource;
    }
}