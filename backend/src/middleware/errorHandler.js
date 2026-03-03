const { AppError } = require('../errors');
const config = require('../config');

/**
 * Global error handler middleware.
 * Converts all errors into the standardized error response format.
 */
function errorHandler(err, req, res, next) {
  void next;
  // Log error in development only — avoid leaking stack/details in production
  if (config.nodeEnv === 'development') {
    console.error('Error:', err);
  }

  // Handle known operational errors
  if (err instanceof AppError) {
    const localizedMessage = req.t(`errors.${err.code}`);
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: localizedMessage !== `errors.${err.code}` ? localizedMessage : err.message,
        details: err.details || undefined,
      },
    });
  }

  // Handle Prisma known errors
  if (err.code === 'P2002') {
    // Unique constraint violation
    const target = err.meta?.target;
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'A record with this value already exists',
        details: { fields: target },
      },
    });
  }

  if (err.code === 'P2025') {
    // Record not found
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Record not found',
      },
    });
  }

  // Handle multer file size errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: `File exceeds maximum allowed size (${config.maxFileSize / (1024 * 1024)}MB)`,
      },
    });
  }

  // CORS rejections from the cors origin callback
  if (typeof err.message === 'string' && err.message.startsWith('CORS blocked for origin:')) {
    return res.status(403).json({
      error: {
        code: 'CORS_BLOCKED',
        message: 'Origin is not allowed',
      },
    });
  }

  // Unknown errors — mask details in production
  const statusCode = err.statusCode || 500;

  // Log all unhandled errors server-side for debugging
  console.error(`[${new Date().toISOString()}] Unhandled Error:`, err.message, err.stack);

  return res.status(statusCode).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: config.isProduction
        ? 'An unexpected error occurred'
        : (err.message || 'An unexpected error occurred'),
    },
  });
}

module.exports = errorHandler;
