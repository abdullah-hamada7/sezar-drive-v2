const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth');
const { createUploader } = require('../../middleware/upload');
const verificationService = require('./verification.service');

const upload = createUploader();

router.post('/identity', authenticate, upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'idCardFront', maxCount: 1 },
  { name: 'idCardBack', maxCount: 1 },
]), async (req, res, next) => {
  try {
    const result = await verificationService.processIdentityUpload(req.user.id, req.files || {});
    res.json({ message: 'Identity photo uploaded, waiting for admin approval', verificationId: result.verificationId });
  } catch (error) {
    next(error);
  }
});

router.post('/shift-selfie', authenticate, upload.single('photo'), async (req, res, next) => {
  try {
    const result = await verificationService.processShiftSelfie(req.user.id, req.file);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/pending', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const shifts = await verificationService.getPendingVerificationShifts({
      status: req.query.status,
      name: req.query.name ? req.query.name.toString() : '',
    });
    res.json(shifts);
  } catch (error) {
    next(error);
  }
});

router.post('/review', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { shiftId, decision, reason } = req.body;
    await verificationService.adminReviewShiftVerification(
      shiftId,
      req.user.id,
      decision,
      reason,
      req.clientIp,
    );

    const normalized = String(decision).toUpperCase();
    if (normalized === 'APPROVE') {
      res.json({ message: 'Shift approved and active' });
    } else {
      res.json({ message: 'Shift rejected and closed' });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
