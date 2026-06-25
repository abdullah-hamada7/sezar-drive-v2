const express = require('express');
const router = express.Router();
const prisma = require('../../config/database');
const { authenticate, authorize } = require('../../middleware/auth');
const { createUploader } = require('../../middleware/upload');
const fileService = require('../../services/FileService');
const verificationService = require('./verification.service');
const { DriverVerificationStatus } = require('../../config/constants');
const { ValidationError } = require('../../errors');
const ShiftNotifier = require('../shift/shift.notifier');

const upload = createUploader();

router.post('/identity', authenticate, upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'idCardFront', maxCount: 1 },
  { name: 'idCardBack', maxCount: 1 }
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
    const statusParam = (req.query.status || 'pending').toString().toLowerCase();
    const nameParam = req.query.name ? req.query.name.toString() : '';
    const statusMap = {
      pending: DriverVerificationStatus.PENDING,
      approved: DriverVerificationStatus.VERIFIED,
      rejected: DriverVerificationStatus.REJECTED,
    };
    const verificationStatus = statusParam === 'all' ? undefined : statusMap[statusParam] || DriverVerificationStatus.PENDING;

    const where = {
      ...(verificationStatus && { verificationStatus }),
      ...(verificationStatus === DriverVerificationStatus.PENDING && { status: 'PendingVerification' }),
      ...(nameParam && {
        driver: {
          name: { contains: nameParam, mode: 'insensitive' },
        },
      }),
    };

    const pendingShifts = await prisma.shift.findMany({
      where,
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const signedShifts = await Promise.all(pendingShifts.map(async shift => {
      if (shift.driver) {
        shift.driver = await fileService.signDriverUrls(shift.driver);
      }
      if (shift.startSelfieUrl) {
        shift.startSelfieUrl = await fileService.getUrl(shift.startSelfieUrl);
      }
      return shift;
    }));

    res.json(signedShifts);
  } catch (error) {
    next(error);
  }
});

router.post('/review', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { shiftId, decision, reason } = req.body;

    if (!shiftId || !decision) {
      return res.status(400).json({ error: 'Shift ID and decision are required' });
    }

    const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
    if (!shift) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    if (decision === 'APPROVE') {
      await prisma.shift.update({
        where: { id: shiftId },
        data: {
          verificationStatus: DriverVerificationStatus.VERIFIED,
          status: 'Active',
          startedAt: new Date()
        }
      });
      ShiftNotifier.onShiftActivated(shiftId, shift.driverId, shift.vehicleId);
      res.json({ message: 'Shift approved and active' });
    } else if (decision === 'REJECT') {
      await prisma.shift.update({
        where: { id: shiftId },
        data: {
          verificationStatus: DriverVerificationStatus.REJECTED,
          rejectionReason: reason || 'Identity verification failed',
          status: 'Closed',
          closedAt: new Date(),
          closeReason: 'admin_override'
        }
      });
      ShiftNotifier.onShiftClosed(
        shiftId,
        shift.driverId,
        'admin',
        reason || 'Identity verification failed',
        req.user.id,
      );
      res.json({ message: 'Shift rejected and closed' });
    } else {
      res.status(400).json({ error: 'Invalid decision. Use APPROVE or REJECT' });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
