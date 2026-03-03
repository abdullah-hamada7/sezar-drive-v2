const express = require('express');
const { body, param } = require('express-validator');
const { validationResult } = require('express-validator');
const vehicleService = require('./vehicle.service');
const shiftService = require('../shift/shift.service');
const prisma = require('../../config/database');
const { authenticate, enforcePasswordChanged, authorize } = require('../../middleware/auth');
const { ValidationError } = require('../../errors');

const router = express.Router();

function handleValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ValidationError('Validation failed', errors.array());
}

// ─── POST /api/v1/vehicles ────────────────────────
router.post(
  '/',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [
    body('plateNumber').optional().notEmpty().trim(),
    body('plate').optional().notEmpty().trim(),
    body('model').notEmpty().trim(),
    body('year').isInt({ min: 2000, max: 2030 }),
    body('qrCode').optional().notEmpty().trim(),
    body('qrIdentifier').optional().notEmpty().trim(),
    body('capacity').optional().isInt({ min: 1 }),
    body().custom(body => {
      if (!body.plateNumber && !body.plate) throw new Error('Plate number is required');
      if (!body.qrCode && !body.qrIdentifier) throw new Error('QR code is required');
      return true;
    }),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const vehicle = await vehicleService.createVehicle(req.body, req.user.id, req.clientIp);
      res.status(201).json(vehicle);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/vehicles ─────────────────────────
router.get(
  '/',
  authenticate, enforcePasswordChanged, authorize('admin'),
  async (req, res, next) => {
    try {
      const result = await vehicleService.getVehicles(req.query);
      res.json(result);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/vehicles/:id ─────────────────────
router.get(
  '/:id',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const vehicle = await vehicleService.getVehicleById(req.params.id);
      res.json(vehicle);
    } catch (err) { next(err); }
  }
);

// ─── PUT /api/v1/vehicles/:id ─────────────────────
router.put(
  '/:id',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const vehicle = await vehicleService.updateVehicle(req.params.id, req.body, req.user.id, req.clientIp);
      res.json(vehicle);
    } catch (err) { next(err); }
  }
);

// ─── POST /api/v1/vehicles/validate-qr ────────────
router.post(
  '/validate-qr',
  authenticate, enforcePasswordChanged, authorize('driver'),
  [body('qrCode').notEmpty()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const vehicle = await vehicleService.validateQrCode(req.body.qrCode);
      res.json(vehicle);
    } catch (err) { next(err); }
  }
);

// ─── PUT /api/v1/vehicles/:id/status ──────────────
router.put(
  '/:id/status',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [
    param('id').isUUID(),
    body('status').isIn(['available', 'damaged', 'maintenance']),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      await vehicleService.updateVehicleStatus(req.params.id, req.body.status, req.user.id, req.clientIp);
      res.json({ message: 'Vehicle status updated' });
    } catch (err) { next(err); }
  }
);

// ─── DELETE /api/v1/vehicles/:id ──────────────────
router.delete(
  '/:id',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const result = await vehicleService.deactivateVehicle(req.params.id, req.user.id, req.clientIp);
      res.json(result);
    } catch (err) { next(err); }
  }
);

// ─── POST /api/v1/vehicles/:id/assign ───────────
router.post(
  '/:id/assign',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [
    param('id').isUUID(),
    body('driverId').isUUID(),
    body('shiftId').isUUID(),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const assignment = await vehicleService.assignVehicle(
        req.params.id, req.body.driverId, req.body.shiftId, req.user.id, req.clientIp
      );
      res.json(assignment);
    } catch (err) { next(err); }
  }
);

// ─── POST /api/v1/vehicles/scan-qr ──────────────
router.post(
  '/scan-qr',
  authenticate, enforcePasswordChanged, authorize('driver'),
  [body('qrCode').notEmpty().trim()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const vehicle = await vehicleService.validateQrCode(req.body.qrCode);

      let shift = await prisma.shift.findFirst({
        where: { driverId: req.user.id, status: { in: ['PendingVerification', 'Active'] } },
        orderBy: { createdAt: 'desc' }
      });

      if (!shift) {
        // Auto-create shift if none exists, as requested for the Home -> Assign flow
        shift = await shiftService.createShift(req.user.id, req.clientIp);
      }

      // Assign vehicle
      const assignment = await vehicleService.assignVehicle(
        vehicle.id, req.user.id, shift.id, req.user.id, req.clientIp
      );

      // Also update shift with vehicleId
      await prisma.shift.update({
        where: { id: shift.id },
        data: { vehicleId: vehicle.id }
      });

      res.json(assignment);
    } catch (err) { next(err); }
  }
);

// ─── POST /api/v1/vehicles/:id/release ──────────
router.post(
  '/:id/release',
  authenticate, enforcePasswordChanged,
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const assignment = await prisma.vehicleAssignment.findFirst({
        where: { vehicleId: req.params.id, active: true }
      });
      if (!assignment) throw new ValidationError('No active assignment found');

      await vehicleService.releaseVehicle(assignment.id, req.user.id, req.clientIp);
      res.json({ message: 'Vehicle released' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
