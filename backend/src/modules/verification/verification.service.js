const prisma = require('../../config/database');
const faceVerificationService = require('../../services/FaceVerificationService');
const fileService = require('../../services/FileService');
const NotificationAdapter = require('../../services/notificationAdapter.service');
const ShiftNotifier = require('../shift/shift.notifier');
const { DriverVerificationStatus } = require('../../config/constants');
const { ValidationError } = require('../../errors');

async function verifyFace(referenceUrl, liveBuffer) {
  if (!referenceUrl) {
    throw new Error('No reference photo available for comparison');
  }

  const verification = await faceVerificationService.verify(referenceUrl, liveBuffer);

  return {
    status: verification.status,
    similarity: verification.similarity,
    matched: verification.status === DriverVerificationStatus.VERIFIED
  };
}

async function processIdentityUpload(driverId, files) {
  if (!files.photo?.[0]) {
    throw new ValidationError('Identity photo is required');
  }

  const photoUrl = await fileService.upload(files.photo[0], 'identity');
  const idCardFront = files.idCardFront?.[0] ? await fileService.upload(files.idCardFront[0], 'identity') : null;
  const idCardBack = files.idCardBack?.[0] ? await fileService.upload(files.idCardBack[0], 'identity') : null;

  await prisma.user.update({
    where: { id: driverId },
    data: {
      identityPhotoUrl: photoUrl,
      idCardFront,
      idCardBack,
      identityVerified: false
    }
  });

  const verification = await prisma.identityVerification.create({
    data: {
      driverId: driverId,
      photoUrl: photoUrl,
      idCardFront,
      idCardBack,
      status: DriverVerificationStatus.PENDING
    }
  });

  NotificationAdapter.notifyAdmins(
    'identity_upload',
    'New Identity Verification',
    `Driver ${driverId} uploaded identity documents for review.`,
    { driverId }
  );

  return { verificationId: verification.id };
}

async function processShiftSelfie(driverId, file) {
  if (!file) {
    throw new ValidationError('Selfie photo is required');
  }

  const user = await prisma.user.findUnique({ where: { id: driverId } });
  const referencePhoto = user.avatarUrl || user.identityPhotoUrl;

  if (!referencePhoto) {
    throw new ValidationError('No reference photo found. Please set up your profile photo first.');
  }

  let shift = await prisma.shift.findFirst({
    where: {
      driverId: driverId,
      status: 'PendingVerification',
      closedAt: null
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!shift) {
    throw new ValidationError('No pending shift found. Please start a shift first.');
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const folder = `inspections/${driverId}/${dateStr}`;
  const selfieUrl = await fileService.upload(file, folder);

  const verification = await verifyFace(referencePhoto, file.buffer);

  shift = await prisma.shift.update({
    where: { id: shift.id },
    data: {
      startSelfieUrl: selfieUrl,
      verificationStatus: verification.status
    }
  });

  return {
    status: verification.status,
    similarity: verification.similarity,
    photoUrl: selfieUrl,
    shiftId: shift.id
  };
}

module.exports = {
  verifyFace,
  processIdentityUpload,
  processShiftSelfie,
};
