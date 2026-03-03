const express = require('express');
const { body, param } = require('express-validator');
const { validationResult } = require('express-validator');
const inspectionService = require('./inspection.service');
const { authenticate, enforcePasswordChanged, authorize } = require('../../middleware/auth');
const { createUploader } = require('../../middleware/upload');
const fileService = require('../../services/FileService');
const { ValidationError } = require('../../errors');

const router = express.Router();
const inspectionUpload = createUploader();

function handleValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ValidationError('Validation failed', errors.array());
}

// ─── POST /api/v1/inspections ─────────────────────
router.post(
  '/',
  authenticate, enforcePasswordChanged, authorize('driver'),
  [
    body('shiftId').isUUID(),
    body('vehicleId').isUUID(),
    body('type').isIn(['full', 'checklist', 'pre', 'post']),
    body('mileage').optional().isInt({ min: 0 }),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const inspection = await inspectionService.createInspection(req.body, req.user.id, req.clientIp);
      res.status(201).json(inspection);
    } catch (err) { next(err); }
  }
);

// ─── POST /api/v1/inspections/:id/photos ──────────
router.post(
  '/:id/photos',
  authenticate, enforcePasswordChanged, authorize('driver'),
  inspectionUpload.single('photo'),
  [
    param('id').isUUID(),
    body('direction').isIn(['front', 'back', 'left', 'right']),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      if (!req.file) throw new ValidationError('Photo is required');
      
      const photoUrl = await fileService.upload(req.file, 'inspections');
      
      const photo = await inspectionService.uploadInspectionPhoto(
        req.params.id, req.body.direction, photoUrl, req.user.id, req.clientIp
      );
      res.status(201).json(photo);
    } catch (err) { next(err); }
  }
);

// ─── POST /api/v1/inspections/:id/photos/:direction ──
router.post(
  '/:id/photos/:direction',
  authenticate, enforcePasswordChanged, authorize('driver'),
  inspectionUpload.single('photo'),
  [
    param('id').isUUID(),
    param('direction').isIn(['front', 'back', 'left', 'right']),
  ],
  async (req, res, next) => {
    try {
      handleValidation(req);
      if (!req.file) throw new ValidationError('Photo is required');
      
      const photoUrl = await fileService.upload(req.file, 'inspections');
      
      const photo = await inspectionService.uploadInspectionPhoto(
        req.params.id, req.params.direction, photoUrl, req.user.id, req.clientIp
      );
      res.status(201).json(photo);
    } catch (err) { next(err); }
  }
);

// ─── PUT /api/v1/inspections/:id/complete ─────────
router.put(
  '/:id/complete',
  authenticate, enforcePasswordChanged, authorize('driver'),
  [param('id').isUUID()],
  async (req, res, next) => {
    try {
      handleValidation(req);
      const inspection = await inspectionService.completeInspection(
        req.params.id, req.user.id, req.body.checklistData, req.clientIp
      );
      res.json(inspection);
    } catch (err) { next(err); }
  }
);

// ─── GET /api/v1/inspections?shiftId= ─────────────
router.get(
  '/',
  authenticate, enforcePasswordChanged,
  async (req, res, next) => {
    try {
      const inspections = await inspectionService.getInspections(req.query.shiftId, req.user);
      res.json(inspections);
    } catch (err) { next(err); }
  }
);

module.exports = router;
