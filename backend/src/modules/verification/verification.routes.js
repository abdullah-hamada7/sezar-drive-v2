const express = require('express');
const router = express.Router();
const prisma = require('../../config/database');
const { authenticate, authorize } = require('../../middleware/auth');
const { createUploader } = require('../../middleware/upload');
const fileService = require('../../services/FileService');
const { DriverVerificationStatus } = require('../../config/constants');
const { ValidationError } = require('../../errors');
const { notifyAdmins, notifyDriver } = require('../tracking/tracking.ws');

const upload = createUploader();

// POST /verify/identity
// Driver uploads identity photo for initial onboarding verification
router.post('/identity', authenticate, upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'idCardFront', maxCount: 1 },
  { name: 'idCardBack', maxCount: 1 }
]), async (req, res, next) => {
  try {
    const driverId = req.user.id;
    const files = req.files || {};

    if (!files.photo?.[0]) {
      return res.status(400).json({ error: 'Identity photo is required' });
    }

    const photoUrl = await fileService.upload(files.photo[0], 'identity');
    const idCardFront = files.idCardFront?.[0] ? await fileService.upload(files.idCardFront[0], 'identity') : null;
    const idCardBack = files.idCardBack?.[0] ? await fileService.upload(files.idCardBack[0], 'identity') : null;

    // 1. Update User
    await prisma.user.update({
      where: { id: driverId },
      data: {
        identityPhotoUrl: photoUrl,
        idCardFront,
        idCardBack,
        identityVerified: false
      }
    });

    // 2. Create Verification Record
    const verification = await prisma.identityVerification.create({
      data: {
        driverId: driverId,
        photoUrl: photoUrl,
        idCardFront,
        idCardBack,
        status: DriverVerificationStatus.PENDING
      }
    });

    notifyAdmins(
      'identity_upload',
      'New Identity Verification',
      `Driver ${driverId} uploaded identity documents for review.`,
      { driverId }
    );

    res.json({ message: 'Identity photo uploaded, waiting for admin approval', verificationId: verification.id });
  } catch (error) {
    next(error);
  }
});

// POST /verify/shift-selfie
// Driver uploads selfie to verify shift start
router.post('/shift-selfie', authenticate, upload.single('photo'), async (req, res, next) => {
  try {
    const driverId = req.user.id;
    const file = req.file;

    if (!file) {
      throw new ValidationError('Selfie photo is required');
    }

    // Check if user has a reference photo (Profile Photo or Identity Photo)
    const user = await prisma.user.findUnique({ where: { id: driverId } });
    const referencePhoto = user.avatarUrl || user.identityPhotoUrl;
    
    if (!referencePhoto) {
      throw new ValidationError('No reference photo found. Please set up your profile photo first.');
    }

    // 1. Find active PendingVerification shift
    let shift = await prisma.shift.findFirst({
      where: {
        driverId: driverId,
        status: 'PendingVerification',
        closedAt: null
      },
      orderBy: { createdAt: 'desc' }
    });

    // If no pending shift, maybe Create one? (Based on logic in DriverShift.jsx which calls verifyShift)
    // Actually DriverShift.jsx creates shift FIRST then verifies.
    // So shift SHOULD exist.
    if (!shift) {
        throw new ValidationError('No pending shift found. Please start a shift first.');
    }

    // 2. Upload selfie
    const dateStr = new Date().toISOString().split('T')[0];
    const folder = `inspections/${driverId}/${dateStr}`;
    const selfieUrl = await fileService.upload(file, folder);

    // 3. Run Rekognition CompareFaces
    const { verifyFace } = require('./verification.service');
    const verification = await verifyFace(referencePhoto, file.buffer);

    // 4. Update Shift
    shift = await prisma.shift.update({
      where: { id: shift.id },
      data: {
        startSelfieUrl: selfieUrl,
        verificationStatus: verification.status
      }
    });

    res.json({
      status: verification.status,
      similarity: verification.similarity,
      photoUrl: selfieUrl,
      shiftId: shift.id
    });

  } catch (error) {
    next(error);
  }
});

// GET /verify/pending
// Admin lists all pending shift verifications
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

    // Sign URLs for all drivers and selfie photos in the list
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

// POST /verify/review
// Admin approves or rejects a shift
router.post('/review', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { shiftId, decision, reason } = req.body; // decision: 'APPROVE' | 'REJECT'

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
          status: 'Active', // Shift becomes active
          startedAt: new Date()
        }
      });
      notifyDriver(shift.driverId, {
        type: 'shift_activated',
        shiftId
      });
      notifyAdmins('shift_activated', 'Shift Activated', 'Shift verification approved and activated.', {
        shiftId,
        driverId: shift.driverId,
        actorId: req.user.id
      });
      res.json({ message: 'Shift approved and active' });
    } else if (decision === 'REJECT') {
      await prisma.shift.update({
        where: { id: shiftId },
        data: {
          verificationStatus: DriverVerificationStatus.REJECTED,
          rejectionReason: reason || 'Identity verification failed',
          status: 'Closed', // Close the shift immediately
          closedAt: new Date(),
          closeReason: 'admin_override' 
        }
      });
      notifyDriver(shift.driverId, {
        type: 'shift_closed',
        shiftId,
        reason: reason || 'Identity verification failed',
        closedBy: 'admin'
      });
      notifyAdmins('shift_closed', 'Shift Closed', 'Shift verification rejected and closed.', {
        shiftId,
        driverId: shift.driverId,
        reason: reason || 'Identity verification failed',
        actorId: req.user.id
      });
      res.json({ message: 'Shift rejected and closed' });
    } else {
      res.status(400).json({ error: 'Invalid decision. Use APPROVE or REJECT' });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
