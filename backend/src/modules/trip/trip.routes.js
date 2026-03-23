const express = require('express');
const { body, param, query } = require('express-validator');
const { validationResult } = require('express-validator');
const tripService = require('./trip.service');
const { authenticate, enforcePasswordChanged, authorize } = require('../../middleware/auth');
const { requireIdempotencyKey } = require('../../middleware/idempotency');
const { ValidationError } = require('../../errors');

const router = express.Router();

function handleValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ValidationError('Validation failed', errors.array());
}

// ─── POST /api/v1/trips (admin assigns) ───────────
router.post(
  '/',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [
    body('driverId').isUUID().withMessage('Valid driver ID is required'),
    body('shiftId').optional().isUUID().withMessage('shiftId must be a valid UUID'),
    body('vehicleId').optional().isUUID().withMessage('vehicleId must be a valid UUID'),
    body('pickupLocation').optional().notEmpty().withMessage('Pickup location is required').trim().escape(),
    body('pickup').optional().notEmpty().withMessage('Pickup location is required').trim().escape(),
    body('dropoffLocation').optional().notEmpty().withMessage('Dropoff location is required').trim().escape(),
    body('dropoff').optional().notEmpty().withMessage('Dropoff location is required').trim().escape(),
    body('pickupLat').optional().isFloat({ min: -90, max: 90 }).withMessage('pickupLat must be between -90 and 90'),
    body('pickupLng').optional().isFloat({ min: -180, max: 180 }).withMessage('pickupLng must be between -180 and 180'),
    body('dropoffLat').optional().isFloat({ min: -90, max: 90 }).withMessage('dropoffLat must be between -90 and 90'),
    body('dropoffLng').optional().isFloat({ min: -180, max: 180 }).withMessage('dropoffLng must be between -180 and 180'),
    body('paymentMethod').optional().isIn(['CASH', 'E_WALLET', 'E_PAYMENT', 'cash', 'e_wallet', 'e_payment']).withMessage('paymentMethod must be one of CASH, E_WALLET, E_PAYMENT'),
    body('price').isFloat({ min: 0.01 }).withMessage('Price must be greater than 0'),
    body('scheduledTime').optional().isISO8601().withMessage('Invalid scheduled time format'),
    body().custom(body => {
      if (!body.pickupLocation && !body.pickup) throw new Error('Pickup location is required');
      if (!body.dropoffLocation && !body.dropoff) throw new Error('Dropoff location is required');
      return true;
    }),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const trip = await tripService.assignTrip(req.body, req.user.id, req.clientIp);
      res.status(201).json(trip);
    } catch (err) { next(err); }
  }
);

// ─── POST /api/v1/admin/trips (alias) ─────────────
router.post(
  '/admin',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [
    body('driverId').isUUID().withMessage('Valid driver ID is required'),
    body('shiftId').optional().isUUID().withMessage('shiftId must be a valid UUID'),
    body('vehicleId').optional().isUUID().withMessage('vehicleId must be a valid UUID'),
    body('pickupLocation').optional().notEmpty().withMessage('Pickup location is required').trim().escape(),
    body('pickup').optional().notEmpty().withMessage('Pickup location is required').trim().escape(),
    body('dropoffLocation').optional().notEmpty().withMessage('Dropoff location is required').trim().escape(),
    body('dropoff').optional().notEmpty().withMessage('Dropoff location is required').trim().escape(),
    body('pickupLat').optional().isFloat({ min: -90, max: 90 }).withMessage('pickupLat must be between -90 and 90'),
    body('pickupLng').optional().isFloat({ min: -180, max: 180 }).withMessage('pickupLng must be between -180 and 180'),
    body('dropoffLat').optional().isFloat({ min: -90, max: 90 }).withMessage('dropoffLat must be between -90 and 90'),
    body('dropoffLng').optional().isFloat({ min: -180, max: 180 }).withMessage('dropoffLng must be between -180 and 180'),
    body('paymentMethod').optional().isIn(['CASH', 'E_WALLET', 'E_PAYMENT', 'cash', 'e_wallet', 'e_payment']).withMessage('paymentMethod must be one of CASH, E_WALLET, E_PAYMENT'),
    body('price').isFloat({ min: 0.01 }).withMessage('Price must be greater than 0'),
    body('scheduledTime').optional().isISO8601().withMessage('Invalid scheduled time format'),
    body().custom(payload => {
      if (!payload.pickupLocation && !payload.pickup) throw new Error('Pickup location is required');
      if (!payload.dropoffLocation && !payload.dropoff) throw new Error('Dropoff location is required');
      return true;
    }),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const trip = await tripService.assignTrip(req.body, req.user.id, req.clientIp);
      res.status(201).json(trip);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/trips/assignment-charge (admin) ──
router.get(
  '/assignment-charge',
  authenticate, enforcePasswordChanged, authorize('admin'),
  async (req, res, next) => {
    try {
      const settings = await tripService.getTripAssignmentCharge();
      res.json(settings);
    } catch (err) { next(err); }
  }
);

// ─── PATCH /api/v1/trips/assignment-charge (admin) ─
router.patch(
  '/assignment-charge',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [
    body('charge').isFloat({ min: 0 }).withMessage('charge must be a non-negative number'),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const settings = await tripService.updateTripAssignmentCharge(req.body.charge, req.user.id, req.clientIp);
      res.json(settings);
    } catch (err) { next(err); }
  }
);

// ─── PATCH /api/v1/admin/trips/:id/override ───────
router.patch(
  '/admin/:id/override',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [
    param('id').isUUID(),
    body('state').isIn(['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
    body('reason').optional().isString().trim().escape(),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const trip = await tripService.overrideTrip(
        req.params.id,
        req.body.state,
        req.body.reason,
        req.user.id,
        req.clientIp,
      );
      res.json(trip);
    } catch (err) { next(err); }
  }
);

router.patch(
  '/:id/override',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [
    param('id').isUUID(),
    body('state').isIn(['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
    body('reason').optional().isString().trim().escape(),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const trip = await tripService.overrideTrip(
        req.params.id,
        req.body.state,
        req.body.reason,
        req.user.id,
        req.clientIp,
      );
      res.json(trip);
    } catch (err) { next(err); }
  }
);

// ─── PATCH /api/v1/driver/trips/:id/accept ────────
router.patch(
  '/driver/:id/accept',
  authenticate, enforcePasswordChanged, authorize('driver'), requireIdempotencyKey,
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const trip = await tripService.acceptTrip(req.params.id, req.user.id, req.clientIp);
      res.json(trip);
    } catch (err) { next(err); }
  }
);

router.patch(
  '/:id/accept',
  authenticate, enforcePasswordChanged, authorize('driver'), requireIdempotencyKey,
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const trip = await tripService.acceptTrip(req.params.id, req.user.id, req.clientIp);
      res.json(trip);
    } catch (err) { next(err); }
  }
);

router.patch(
  '/driver/:id/reject',
  authenticate, enforcePasswordChanged, authorize('driver'), requireIdempotencyKey,
  [param('id').isUUID(), body('reason').notEmpty().isString().trim().escape()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const trip = await tripService.rejectAssignedTrip(req.params.id, req.user.id, req.body.reason, req.clientIp);
      res.json(trip);
    } catch (err) { next(err); }
  }
);

router.patch(
  '/:id/reject',
  authenticate, enforcePasswordChanged, authorize('driver'), requireIdempotencyKey,
  [param('id').isUUID(), body('reason').notEmpty().isString().trim().escape()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const trip = await tripService.rejectAssignedTrip(req.params.id, req.user.id, req.body.reason, req.clientIp);
      res.json(trip);
    } catch (err) { next(err); }
  }
);

// ─── PUT /api/v1/trips/:id/start ──────────────────
router.put(
  '/:id/start',
  authenticate, enforcePasswordChanged, authorize('driver'), requireIdempotencyKey,
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const trip = await tripService.startTrip(req.params.id, req.user.id, req.clientIp);
      res.json(trip);
    } catch (err) { next(err); }
  }
);

// ─── PATCH /api/v1/driver/trips/:id/start ─────────
router.patch(
  '/driver/:id/start',
  authenticate, enforcePasswordChanged, authorize('driver'), requireIdempotencyKey,
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const trip = await tripService.startTrip(req.params.id, req.user.id, req.clientIp);
      res.json(trip);
    } catch (err) { next(err); }
  }
);

router.patch(
  '/:id/start',
  authenticate, enforcePasswordChanged, authorize('driver'), requireIdempotencyKey,
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const trip = await tripService.startTrip(req.params.id, req.user.id, req.clientIp);
      res.json(trip);
    } catch (err) { next(err); }
  }
);

// ─── PUT /api/v1/trips/:id/complete ───────────────
router.put(
  '/:id/complete',
  authenticate, enforcePasswordChanged, authorize('driver'), requireIdempotencyKey,
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const trip = await tripService.completeTrip(req.params.id, req.user.id, req.clientIp);
      res.json(trip);
    } catch (err) { next(err); }
  }
);

// ─── PATCH /api/v1/driver/trips/:id/complete ──────
router.patch(
  '/driver/:id/complete',
  authenticate, enforcePasswordChanged, authorize('driver'), requireIdempotencyKey,
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const trip = await tripService.completeTrip(req.params.id, req.user.id, req.clientIp);
      res.json(trip);
    } catch (err) { next(err); }
  }
);

router.patch(
  '/:id/complete',
  authenticate, enforcePasswordChanged, authorize('driver'), requireIdempotencyKey,
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const trip = await tripService.completeTrip(req.params.id, req.user.id, req.clientIp);
      res.json(trip);
    } catch (err) { next(err); }
  }
);

// ─── PUT /api/v1/trips/:id/cancel ─────────────────
router.put(
  '/:id/cancel',
  authenticate, enforcePasswordChanged,
  [
    param('id').isUUID(),
    body('reason').optional().isString().escape(),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const trip = await tripService.cancelTrip(
        req.params.id, req.user.id, req.user.role, req.body.reason, req.clientIp
      );
      res.json(trip);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/trips/active ─────────────────────
router.get(
  '/active',
  authenticate, enforcePasswordChanged, authorize('driver'),
  async (req, res, next) => {
    try {
      const trip = await tripService.getActiveTrip(req.user.id);
      res.json({ trip: trip || null });
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/trips ────────────────────────────
router.get(
  '/',
  authenticate, enforcePasswordChanged,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isIn(['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
    query('driverId').optional().isUUID(),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const queryParams = { ...req.query };
      if (req.user.role === 'driver') {
        queryParams.driverId = req.user.id;
      }
      const result = await tripService.getTrips(queryParams);
      res.json(result);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/trips/:id ────────────────────────
router.get(
  '/:id',
  authenticate, enforcePasswordChanged,
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const trip = await tripService.getTripById(req.params.id, req.user);
      res.json(trip);
    } catch (err) { next(err); }
  }
);

module.exports = router;
