const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const violationService = require('./violation.service');
const { authenticate, enforcePasswordChanged, authorize } = require('../../middleware/auth');
const { ValidationError } = require('../../errors');

const router = express.Router();

function handleValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ValidationError('Validation failed', errors.array());
}

const violationValidation = [
  body('driverId').isUUID().withMessage('Valid driver ID is required'),
  body('vehicleId').isUUID().withMessage('Valid vehicle ID is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('time').notEmpty().withMessage('Time is required').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Time must be in HH:MM format'),
  body('location').notEmpty().withMessage('Location is required').isLength({ max: 255 }),
  body('violationNumber').notEmpty().withMessage('Violation number is required').isLength({ max: 50 }),
  body('fineAmount').isFloat({ min: 0 }).withMessage('Fine amount must be a positive number'),
];

const updateValidation = [
  param('id').isUUID().withMessage('Valid violation ID is required'),
  body('driverId').optional().isUUID().withMessage('Valid driver ID is required'),
  body('vehicleId').optional().isUUID().withMessage('Valid vehicle ID is required'),
  body('date').optional().isISO8601().withMessage('Valid date is required'),
  body('time').optional().notEmpty().withMessage('Time is required'),
  body('location').optional().notEmpty().withMessage('Location is required').isLength({ max: 255 }),
  body('violationNumber').optional().notEmpty().withMessage('Violation number is required').isLength({ max: 50 }),
  body('fineAmount').optional().isFloat({ min: 0 }).withMessage('Fine amount must be a positive number'),
];

const listValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('driverId').optional().isUUID(),
  query('vehicleId').optional().isUUID(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('search').optional().isString(),
];

const myListValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('search').optional().isString(),
];

// ─── POST /api/v1/violations ─────────────────────
router.post(
  '/',
  authenticate, enforcePasswordChanged, authorize('admin'),
  violationValidation,
  async (req, res, next) => {
    try {
      handleValidation(req);
      const violation = await violationService.createViolation(req.body, req.user.id, req.clientIp);
      res.status(201).json(violation);
    } catch (err) { next(err); }
  }
);

// ─── PUT /api/violations/:id ─────────────────────
router.put(
  '/:id',
  authenticate, enforcePasswordChanged, authorize('admin'),
  updateValidation,
  async (req, res, next) => {
    try {
      handleValidation(req);
      const violation = await violationService.updateViolation(req.params.id, req.body, req.user.id, req.clientIp);
      res.json(violation);
    } catch (err) { next(err); }
  }
);

// ─── DELETE /api/violations/:id ─────────────────────
router.delete(
  '/:id',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const result = await violationService.deleteViolation(req.params.id, req.user.id, req.clientIp);
      res.json(result);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/violations ─────────────────────────
router.get(
  '/',
  authenticate, enforcePasswordChanged, authorize('admin'),
  listValidation,
  async (req, res, next) => {
    try {
      handleValidation(req);
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 15;
      const data = await violationService.getViolations({
        page,
        limit,
        driverId: req.query.driverId,
        vehicleId: req.query.vehicleId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        search: req.query.search,
      });
      res.json(data);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/violations/my ─────────────────────
router.get(
  '/my',
  authenticate, enforcePasswordChanged, authorize('driver'),
  myListValidation,
  async (req, res, next) => {
    try {
      handleValidation(req);
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 15;
      const data = await violationService.getViolations({
        page,
        limit,
        driverId: req.user.id,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        search: req.query.search,
      });
      res.json(data);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/violations/options/drivers ──────────
router.get(
  '/options/drivers',
  authenticate, enforcePasswordChanged, authorize('admin'),
  async (req, res, next) => {
    try {
      const drivers = await violationService.getDrivers();
      res.json(drivers);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/violations/options/vehicles ─────────
router.get(
  '/options/vehicles',
  authenticate, enforcePasswordChanged, authorize('admin'),
  async (req, res, next) => {
    try {
      const vehicles = await violationService.getVehicles();
      res.json(vehicles);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/violations/driver-stats ──────────────
router.get(
  '/driver-stats',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [query('date').optional().isISO8601()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const stats = await violationService.getDriverDailyStats(req.query.date);
      res.json(stats);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/violations/:id ───────────────────────
router.get(
  '/:id',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const violation = await violationService.getViolationById(req.params.id);
      res.json(violation);
    } catch (err) { next(err); }
  }
);

module.exports = router;
