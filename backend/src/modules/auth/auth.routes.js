const express = require('express');
const { body, param } = require('express-validator');
const authService = require('./auth.service');
const rescueService = require('./rescue.service');
const { authenticate, enforcePasswordChanged, authorize } = require('../../middleware/auth');
const { createUploader } = require('../../middleware/upload');
const { ValidationError } = require('../../errors');
const { EMAIL_REGEX } = require('../../utils/validation');

const router = express.Router();
const identityUpload = createUploader();

const REFRESH_COOKIE_NAME = 'refreshToken';

function getRefreshCookieOptions(req) {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function readCookie(req, cookieName) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const parts = cookieHeader.split(';').map(v => v.trim());
  const matched = parts.find(v => v.startsWith(`${cookieName}=`));
  if (!matched) return null;
  return decodeURIComponent(matched.substring(cookieName.length + 1));
}

// Validation helper
function handleValidation(req) {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }
}

// ─── POST /api/v1/auth/login ──────────────────────
router.post(
  '/login',
  [
    body('email').isEmail().matches(EMAIL_REGEX).normalizeEmail(),
    body('password').notEmpty(),
    body('deviceFingerprint').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const result = await authService.login(
        req.body.email,
        req.body.password,
        req.clientIp,
        req.body.deviceFingerprint
      );
      if (result.refreshToken) {
        res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions(req));
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/v1/auth/verify-device ──────────────
router.post(
  '/verify-device',
  identityUpload.single('photo'),
  [
    body('userId').isString(), // Relaxed for debugging
    body('deviceFingerprint').notEmpty(),
  ],
  async (req, res, next) => {
    try {
      console.log(`[VERIFY_LOG] Request Data: ${JSON.stringify({
        body: req.body,
        file: req.file ? { name: req.file.originalname, size: req.file.size } : 'Missing'
      })}`);
      handleValidation(req);
      if (!req.file) throw new ValidationError('Selfie photo is required');

      const result = await authService.verifyDevice(
        req.body.userId,
        req.body.deviceFingerprint,
        req.file.buffer,
        req.clientIp
      );
      if (result.refreshToken) {
        res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions(req));
      }
      res.json(result);
    } catch (err) {
      console.error('[VERIFY_ERROR] Verification failed:', err.message);
      next(err);
    }
  }
);

// ─── POST /api/v1/auth/change-password ────────────
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').notEmpty().isLength({ min: 8 }),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const result = await authService.changePassword(
        req.user.id,
        req.body.currentPassword,
        req.body.newPassword,
        req.clientIp
      );
      if (result.refreshToken) {
        res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions(req));
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/v1/auth/refresh ────────────────────
router.post(
  '/refresh',
  async (req, res, next) => {
    try {
      const refreshToken = req.body?.refreshToken || readCookie(req, REFRESH_COOKIE_NAME);
      if (!refreshToken) throw new ValidationError('Refresh token is required');

      const result = await authService.refreshAccessToken(refreshToken);
      if (result.refreshToken) {
        res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions(req));
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/v1/auth/logout ─────────────────────
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await authService.logout(req.user.id, req.clientIp);
    // Clear current and previous cookie paths for safe migration.
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/auth/me ──────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await authService.getMe(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});



// ─── GET /api/v1/auth/identity/pending ────────────
router.get(
  '/identity/pending',
  authenticate,
  enforcePasswordChanged,
  authorize('admin'),
  async (req, res, next) => {
    try {
      const result = await authService.getPendingVerifications(req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ─── PUT /api/v1/auth/identity/:id/review ─────────
router.put(
  '/identity/:id/review',
  authenticate,
  enforcePasswordChanged,
  authorize('admin'),
  [
    param('id').isUUID(),
    body('action').isIn(['approve', 'reject']),
    body('rejectionReason').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const result = await authService.reviewIdentity(
        req.params.id,
        req.user.id,
        req.body.action,
        req.body.rejectionReason,
        req.clientIp
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/v1/auth/identity/:id/review ───
router.post(
  '/identity/:id/review',
  authenticate,
  enforcePasswordChanged,
  authorize('admin'),
  [
    param('id').isUUID(),
    body('action').isIn(['approve', 'reject']),
    body('rejectionReason').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const result = await authService.reviewIdentity(
        req.params.id,
        req.user.id,
        req.body.action,
        req.body.rejectionReason,
        req.clientIp
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ─── PUT /api/v1/auth/preferences ────────────
router.put(
  '/preferences',
  authenticate,
  [
    body('languagePreference').isIn(['en', 'ar']),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const result = await authService.updatePreferences(req.user.id, req.body, req.clientIp);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/v1/auth/verify-reset-token ───────────
router.get(
  '/verify-reset-token',
  async (req, res, next) => {
    try {
      const { token } = req.query;
      if (!token) throw new ValidationError('Token is required');
      const result = await authService.verifyResetToken(token);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/v1/auth/reset-password ──────────────
router.post(
  '/reset-password',
  [
    body('token').notEmpty(),
    body('newPassword').notEmpty().isLength({ min: 8 }),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const result = await authService.resetPassword(req.body.token, req.body.newPassword, req.clientIp);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/v1/auth/admin/rescue/pending ────────
router.get(
  '/admin/rescue/pending',
  authenticate,
  authorize('admin'),
  async (req, res, next) => {
    try {
      const result = await rescueService.listPendingRescueRequests();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/v1/auth/rescue/request ─────────────
router.post(
  '/rescue/request',
  [body('email').isEmail().matches(EMAIL_REGEX).normalizeEmail()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const result = await rescueService.requestRescue(req.body.email);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/v1/auth/rescue/verify ──────────────
router.post(
  '/rescue/verify',
  [
    body('email').isEmail().matches(EMAIL_REGEX).normalizeEmail(),
    body('code').isLength({ min: 6, max: 6 })
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const result = await rescueService.verifyRescueCode(req.body.email, req.body.code);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/v1/auth/admin/rescue/generate ──────
router.post(
  '/admin/rescue/generate',
  authenticate,
  authorize('admin'),
  [body('requestId').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const result = await rescueService.generateRescueCode(req.user.id, req.body.requestId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
