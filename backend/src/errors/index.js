class AppError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(401, code, message);
  }
}

class ForbiddenError extends AppError {
  constructor(code = 'FORBIDDEN', message = 'Access denied') {
    super(403, code, message);
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, 'NOT_FOUND', `${resource} not found`);
  }
}

class ConflictError extends AppError {
  constructor(code, message, details = null) {
    super(409, code, message, details);
  }
}

class PayloadTooLargeError extends AppError {
  constructor(message = 'File too large') {
    super(413, 'PAYLOAD_TOO_LARGE', message);
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  PayloadTooLargeError,
};
