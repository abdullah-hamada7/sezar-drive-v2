const express = require('express');
const { body, param, query } = require('express-validator');
const { validationResult } = require('express-validator');
const driverService = require('./driver.service');
const { authenticate, enforcePasswordChanged, authorize, authorizeSuperAdmin } = require('../../middleware/auth');
const { ValidationError } = require('../../errors');
const { createUploader } = require('../../middleware/upload');
const fileService = require('../../services/FileService');
const upload = createUploader();

const router = express.Router();

function handleValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ValidationError('Validation failed', errors.array());
}

// ─── PUT /api/v1/drivers/profile ──────────────────
router.put(
  '/profile',
  authenticate,
  upload.single('avatar'),
  [
    body('phone').optional().trim(),
    body('language_preference').optional().isString().isIn(['en', 'ar']).withMessage('Invalid language preference'),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const data = { ...req.body };
      if (req.file) {
        data.profilePhotoUrl = await fileService.upload(req.file, 'profiles');
      }

      const driver = await driverService.updateDriver(req.user.id, data, req.user.id, req.clientIp);
      res.json(driver);
    } catch (err) { next(err); }
  }
);

// ─── POST /api/v1/drivers ─────────────────────────
router.post(
  '/',
  authenticate, enforcePasswordChanged, authorizeSuperAdmin,
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'idCardFront', maxCount: 1 },
    { name: 'idCardBack', maxCount: 1 }
  ]),
  [
    body('name').notEmpty().withMessage('Name is required').trim().escape(),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('phone').notEmpty().withMessage('Phone number is required').matches(/^\+?[0-9]{10,15}$/).withMessage('Invalid phone number format').trim().escape(),
    body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('temporaryPassword').optional().isLength({ min: 8 }).withMessage('Temporary password must be at least 8 characters long'),
    body('licenseNumber').notEmpty().withMessage('License number is required').matches(/^[A-Z0-9-]+$/i).withMessage('Invalid license number format').trim().escape(),
    body().custom((value, { req }) => {
      if (!req.body.password && !req.body.temporaryPassword) {
        throw new Error('Either password or temporaryPassword is required');
      }
      return true;
    }),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const data = { ...req.body };

      const files = req.files || {};
      if (files.avatar?.[0]) data.avatarUrl = await fileService.upload(files.avatar[0], 'profiles');
      if (files.idCardFront?.[0]) data.idCardFront = await fileService.upload(files.idCardFront[0], 'identity');
      if (files.idCardBack?.[0]) data.idCardBack = await fileService.upload(files.idCardBack[0], 'identity');

      const driver = await driverService.createDriver(data, req.user.id, req.clientIp);
      res.status(201).json(driver);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/drivers ──────────────────────────
router.get(
  '/',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().trim(),
  ],
  async (req, res, next) => {
    try {
      const result = await driverService.getDrivers(req.query);
      res.json(result);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/drivers/:id ──────────────────────
router.get(
  '/:id',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const driver = await driverService.getDriverById(req.params.id);
      res.json(driver);
    } catch (err) { next(err); }
  }
);

// ─── PUT /api/v1/drivers/:id ──────────────────────
router.put(
  '/:id',
  authenticate, enforcePasswordChanged, authorizeSuperAdmin,
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'idCardFront', maxCount: 1 },
    { name: 'idCardBack', maxCount: 1 }
  ]),
  [
    param('id').isUUID(),
    body('name').optional().trim().escape(),
    body('phone').optional().matches(/^\+?[0-9]{10,15}$/).withMessage('Invalid phone number format').trim().escape(),
    body('licenseNumber').optional().matches(/^[A-Z0-9-]+$/i).withMessage('Invalid license number format').trim().escape(),
    body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('language_preference').optional().isString().isIn(['en', 'ar']).withMessage('Invalid language preference'),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const data = { ...req.body };

      const files = req.files || {};
      if (files.avatar?.[0]) data.avatarUrl = await fileService.upload(files.avatar[0], 'profiles');
      if (files.idCardFront?.[0]) data.idCardFront = await fileService.upload(files.idCardFront[0], 'identity');
      if (files.idCardBack?.[0]) data.idCardBack = await fileService.upload(files.idCardBack[0], 'identity');

      const driver = await driverService.updateDriver(req.params.id, data, req.user.id, req.clientIp);
      res.json(driver);
    } catch (err) { next(err); }
  }
);

// ─── DELETE /api/v1/drivers/:id ───────────────────
router.delete(
  '/:id',
  authenticate, enforcePasswordChanged, authorizeSuperAdmin,
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const result = await driverService.deactivateDriver(req.params.id, req.user.id, req.clientIp);
      res.json(result);
    } catch (err) { next(err); }
  }
);

// ─── PATCH /api/v1/drivers/:id/reactivate ──────────
router.patch(
  '/:id/reactivate',
  authenticate, enforcePasswordChanged, authorizeSuperAdmin,
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const result = await driverService.reactivateDriver(req.params.id, req.user.id, req.clientIp);
      res.json(result);
    } catch (err) { next(err); }
  }
);

module.exports = router;
