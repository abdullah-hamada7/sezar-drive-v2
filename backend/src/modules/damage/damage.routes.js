const express = require('express');
const { body, param, query } = require('express-validator');
const { validationResult } = require('express-validator');
const damageService = require('./damage.service');
const { authenticate, enforcePasswordChanged, authorize } = require('../../middleware/auth');
const { createUploader } = require('../../middleware/upload');
const fileService = require('../../services/FileService');
const { ValidationError } = require('../../errors');
const { sendCsv } = require('../../utils/csv');

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
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('vehicleId').optional().isUUID(),
    query('status').optional().isIn(['reported', 'acknowledged', 'maintenance', 'resolved', 'closed']),
    query('search').optional().isString().trim().isLength({ min: 1, max: 200 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('sortBy').optional().isIn(['createdAt', 'status']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const result = await damageService.getDamageReports(req.query);
      res.json(result);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/damage-reports/export (CSV) ───────
router.get(
  '/export',
  authenticate, enforcePasswordChanged, authorize('admin'),
  async (req, res, next) => {
    try {
      const query = {
        ...req.query,
        page: 1,
        limit: Math.min(Math.max(parseInt(req.query.limit) || 5000, 1), 10000),
      };
      const result = await damageService.getDamageReports(query);

      sendCsv(res, {
        filename: `damage-reports-${new Date().toISOString().slice(0, 10)}.csv`,
        columns: [
          { header: 'id', value: (r) => r.id },
          { header: 'created_at', value: (r) => r.createdAt?.toISOString?.() ?? r.createdAt },
          { header: 'status', value: (r) => r.status },
          { header: 'vehicle', value: (r) => r.vehicle?.plateNumber || '' },
          { header: 'driver', value: (r) => r.driver?.name || '' },
          { header: 'description', value: (r) => r.description || '' },
          { header: 'photos', value: (r) => (Array.isArray(r.photos) ? r.photos.length : 0) },
          { header: 'reviewer', value: (r) => r.reviewer?.name || '' },
          { header: 'resolved_at', value: (r) => (r.resolvedAt?.toISOString?.() ?? r.resolvedAt) || '' },
        ],
        rows: result.reports || [],
      });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
