const express = require('express');
const { body, param } = require('express-validator');
const { validationResult } = require('express-validator');
const damageService = require('./damage.service');
const { authenticate, enforcePasswordChanged, authorize } = require('../../middleware/auth');
const { createUploader } = require('../../middleware/upload');
const fileService = require('../../services/FileService');
const { ValidationError } = require('../../errors');

const router = express.Router();
const damageUpload = createUploader();

function handleValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ValidationError('Validation failed', errors.array());
}

// ─── POST /api/v1/damage-reports ──────────────────
router.post(
  '/',
  authenticate, enforcePasswordChanged, authorize('driver'),
  [
    body('vehicleId').isUUID(),
    body('shiftId').isUUID(),
    body('description').notEmpty().trim().escape(),
    body('tripId').optional().isUUID(),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const report = await damageService.createDamageReport(req.body, req.user.id, req.clientIp);
      res.status(201).json(report);
    } catch (err) { next(err); }
  }
);

// ─── POST /api/v1/damage-reports/:id/photos ───────
router.post(
  '/:id/photos',
  authenticate, enforcePasswordChanged, authorize('driver'),
  damageUpload.single('photo'),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      if (!req.file) throw new ValidationError('Photo is required');
      
      const photoUrl = await fileService.upload(req.file, 'damage');
      
      const photo = await damageService.uploadDamagePhoto(req.params.id, photoUrl, req.user.id);
      res.status(201).json(photo);
    } catch (err) { next(err); }
  }
);

// ─── PUT /api/v1/damage-reports/:id/review ────────
router.put(
  '/:id/review',
  authenticate, enforcePasswordChanged, authorize('admin'),
  [
    param('id').isUUID(),
    body('action').isIn(['acknowledge', 'maintenance', 'resolve', 'acknowledged', 'resolved', 'closed']),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const report = await damageService.reviewDamageReport(
        req.params.id, req.user.id, req.body.action, req.clientIp
      );
      res.json(report);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/damage-reports ───────────────────
router.get(
  '/',
  authenticate, enforcePasswordChanged,
  async (req, res, next) => {
    try {
      const result = await damageService.getDamageReports(req.query);
      res.json(result);
    } catch (err) { next(err); }
  }
);

module.exports = router;
