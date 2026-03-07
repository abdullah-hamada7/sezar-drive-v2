const express = require('express');
const { body, param, query } = require('express-validator');
const { validationResult } = require('express-validator');
const shiftService = require('./shift.service');
const { authenticate, enforcePasswordChanged, authorize, requireIdentityVerified } = require('../../middleware/auth');
const { ValidationError } = require('../../errors');

const router = express.Router();

function handleValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ValidationError('Validation failed', errors.array());
}

// ─── POST /api/v1/shifts ──────────────────────────
router.post(
  '/',
  authenticate, enforcePasswordChanged, authorize('driver'), requireIdentityVerified,
  async (req, res, next) => {
    try {
      const shift = await shiftService.createShift(req.user.id, req.clientIp);
      res.status(201).json(shift);
    } catch (err) { next(err); }
  }
);

// ─── POST /api/v1/driver/shifts/start (alias) ─────
router.post(
  '/driver/start',
  authenticate, enforcePasswordChanged, authorize('driver'), requireIdentityVerified,
  async (req, res, next) => {
    try {
      const shift = await shiftService.createShift(req.user.id, req.clientIp);
      res.status(201).json(shift);
    } catch (err) { next(err); }
  }
);

router.post(
  '/start',
  authenticate, enforcePasswordChanged, authorize('driver'), requireIdentityVerified,
  async (req, res, next) => {
    try {
      const shift = await shiftService.createShift(req.user.id, req.clientIp);
      res.status(201).json(shift);
    } catch (err) { next(err); }
  }
);

// ─── PUT /api/v1/shifts/:id/activate ──────────────
router.put(
  '/:id/activate',
  authenticate, enforcePasswordChanged, authorize('driver'),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const shift = await shiftService.activateShift(req.params.id, req.user.id, req.clientIp);
      res.json(shift);
    } catch (err) { next(err); }
  }
);

// ─── POST /api/v1/driver/shifts/close (alias) ─────
router.post(
  '/driver/close',
  authenticate, enforcePasswordChanged, authorize('driver'),
  [body('shiftId').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const shift = await shiftService.closeShift(req.body.shiftId, req.user.id, req.clientIp);
      res.json(shift);
    } catch (err) { next(err); }
  }
);

router.post(
  '/close',
  authenticate, enforcePasswordChanged, authorize('driver'),
  async (req, res, next) => {
    try {
      const activeShift = await shiftService.getActiveShift(req.user.id);
      if (!activeShift) {
        throw new ValidationError('No active shift found to close');
      }
      const shift = await shiftService.closeShift(activeShift.id, req.user.id, req.clientIp);
      res.json(shift);
    } catch (err) { next(err); }
  }
);

// ─── PUT /api/v1/shifts/:id/close ─────────────────
router.put(
  '/:id/close',
  authenticate, enforcePasswordChanged, authorize('driver'),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const shift = await shiftService.closeShift(req.params.id, req.user.id, req.clientIp);
      res.json(shift);
    } catch (err) { next(err); }
  }
);

// ─── PUT /api/v1/shifts/:id/admin-close ───────────
router.put(
  '/:id/admin-close',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [
    param('id').isUUID(),
    body('reason').optional().isString().escape(),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const shift = await shiftService.adminCloseShift(
        req.params.id, req.user.id, req.body.reason, req.clientIp
      );
      res.json(shift);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/shifts/active ────────────────────
router.get(
  '/active',
  authenticate, enforcePasswordChanged, authorize('driver'),
  async (req, res, next) => {
    try {
      const shift = await shiftService.getActiveShift(req.user.id);
      res.json({ shift: shift || null });
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/shifts ───────────────────────────
router.get(
  '/',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('driverId').optional().isUUID(),
    query('status').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const result = await shiftService.getShifts(req.query);
      res.json(result);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/shifts/:id ──────────────────────
router.get(
  '/:id',
  authenticate, enforcePasswordChanged,
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const shift = await shiftService.getShiftById(req.params.id, req.user);
      res.json(shift);
    } catch (err) { next(err); }
  }
);

module.exports = router;
