const jwt = require('jsonwebtoken');
const config = require('../config');
const { UnauthorizedError, ForbiddenError } = require('../errors');

/**
 * JWT authentication middleware.
 * Extracts and verifies Bearer token from Authorization header.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or invalid authorization header', 'MISSING_HEADER'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (decoded && decoded.role) {
      decoded.role = String(decoded.role).toLowerCase();
    }
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Token expired', 'TOKEN_EXPIRED'));
    }
    return next(new UnauthorizedError('Invalid token', 'INVALID_TOKEN'));
  }
}

/**
 * Password change enforcement middleware.
 * Blocks all requests (except password change) if user must change password.
 */
function enforcePasswordChanged(req, res, next) {
  if (req.user && req.user.mustChangePassword) {
    return next(new ForbiddenError('MUST_CHANGE_PASSWORD', 'You must change your password before accessing this resource'));
  }
  next();
}

/**
 * Role-based access control middleware.
 * @param  {...string} roles - Allowed roles
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ForbiddenError('FORBIDDEN', 'Insufficient permissions'));
    }
    next();
  };
}

/**
 * Ensures the driver's identity has been verified by admin.
 */
function requireIdentityVerified(req, res, next) {
  if (req.user && req.user.role === 'driver' && !req.user.identityVerified) {
    return next(new ForbiddenError('IDENTITY_NOT_VERIFIED', 'Identity verification required'));
  }
  next();
}

/**
 * Ensures the admin is a SUPER_ADMIN.
 */
function authorizeSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin' || req.user.adminRole !== 'SUPER_ADMIN') {
    return next(new ForbiddenError('FORBIDDEN', 'Super Admin privileges required'));
  }
  next();
}

module.exports = {
  authenticate,
  enforcePasswordChanged,
  authorize,
  requireIdentityVerified,
  authorizeSuperAdmin,
};
