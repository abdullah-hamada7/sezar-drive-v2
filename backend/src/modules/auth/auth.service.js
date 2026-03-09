const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../../config/database');
const config = require('../../config');
const fileService = require('../../services/FileService');
const faceVerificationService = require('../../services/FaceVerificationService');
const { UnauthorizedError, ForbiddenError, ValidationError, ConflictError, NotFoundError } = require('../../errors');
const AuditService = require('../../services/audit.service');
const { notifyAdmins, notifyDriver } = require('../tracking/tracking.ws');

const REFRESH_TOKEN_LIFETIME_DAYS = 7;
const REFRESH_ROTATION_GRACE_SECONDS = 20;
const ABSOLUTE_SESSION_MAX_DAYS = 30;

/**
 * Login with email and password. Returns JWT access + refresh tokens.
 * Now supports device fingerprinting for security.
 */
async function login(email, password, ipAddress, deviceFingerprint) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    console.log(`Login failed for ${email}: User not found or inactive`);
    throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    console.log(`Login failed for ${email}: Invalid password`);
    throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Device Security & Mandatory Biometric Check (Drivers only)
  let requiresVerification = false;
  if (user.role === 'driver') {
    requiresVerification = true;

    // Still track device used
    if (deviceFingerprint) {
      const device = await prisma.userDevice.findUnique({
        where: { userId_deviceFingerprint: { userId: user.id, deviceFingerprint } }
      });

      if (!device) {
        await prisma.userDevice.create({
          data: { userId: user.id, deviceFingerprint, isVerified: false }
        });
      } else {
        await prisma.userDevice.update({
          where: { id: device.id },
          data: { lastUsedAt: new Date() }
        });
      }
    }
  }

  if (requiresVerification) {
    return {
      requiresVerification: true,
      message: 'Face verification required to complete login.',
      userId: user.id
    };
  }


  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user.id);

  await AuditService.log({
    actorId: user.id,
    actionType: 'auth.login',
    entityType: 'auth',
    entityId: user.id,
    newState: { role: user.role, deviceFingerprint },
    ipAddress,
  });

  return {
    token: accessToken,
    accessToken,
    refreshToken,
    user: await fileService.signDriverUrls(sanitizeUser(user)),
  };
}

/**
 * Verify a new device using face comparison.
 */
async function verifyDevice(userId, deviceFingerprint, selfieBuffer, ipAddress) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User');
  if (!user.avatarUrl) throw new ValidationError('No profile photo (avatar) found for this user');

  const device = await prisma.userDevice.findUnique({
    where: { userId_deviceFingerprint: { userId, deviceFingerprint } }
  });

  if (!device) throw new NotFoundError('Device');

  // Face comparison using AWS Rekognition against Profile Photo
  const verification = await faceVerificationService.verify(user.avatarUrl, selfieBuffer);

  if (verification.status !== 'VERIFIED') {
    throw new ForbiddenError('FACE_VERIFICATION_FAILED', 'Face verification failed. Please ensure your face is clearly visible and matches your profile photo.');
  }

  // Success — mark device as verified
  await prisma.userDevice.update({
    where: { id: device.id },
    data: { isVerified: true, lastUsedAt: new Date() }
  });

  await AuditService.log({
    actorId: userId,
    actionType: 'auth.device_verified',
    entityType: 'auth',
    entityId: device.id,
    newState: { deviceFingerprint },
    ipAddress,
  });

  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user.id);

  return {
    token: accessToken,
    accessToken,
    refreshToken,
    user: await fileService.signDriverUrls(sanitizeUser(user)),
  };
}

/**
 * Change password (forced on first login).
 */
async function changePassword(userId, currentPassword, newPassword, ipAddress) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UnauthorizedError('User not found');

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new ValidationError('Current password is incorrect');

  if (currentPassword === newPassword) {
    throw new ValidationError('New password must be different from current password');
  }

  validatePasswordPolicy(newPassword);

  const passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });

  await AuditService.log({
    actorId: userId,
    actionType: 'auth.password_changed',
    entityType: 'auth',
    entityId: userId,
    ipAddress,
  });

  const accessToken = generateAccessToken(updatedUser);
  const refreshToken = await generateRefreshToken(updatedUser.id);

  return {
    message: 'Password changed successfully',
    token: accessToken,
    accessToken,
    refreshToken,
    user: await fileService.signDriverUrls(sanitizeUser(updatedUser)),
  };
}

/**
 * Refresh access token using refresh token.
 */
async function refreshAccessToken(refreshTokenValue) {
  const tokenHash = hashToken(refreshTokenValue);
  const storedToken = await prisma.refreshToken.findFirst({
    where: { tokenHash },
    include: { user: true },
  });

  if (!storedToken) {
    throw new UnauthorizedError('Invalid or expired refresh token', 'INVALID_TOKEN');
  }

  const now = new Date();

  if (storedToken.expiresAt < now) {
    throw new UnauthorizedError('Invalid or expired refresh token', 'INVALID_TOKEN');
  }

  const sessionStartedAtMs = extractSessionStartedAt(refreshTokenValue) || storedToken.createdAt.getTime();
  const absoluteSessionDeadline = sessionStartedAtMs + (ABSOLUTE_SESSION_MAX_DAYS * 24 * 60 * 60 * 1000);
  if (Date.now() > absoluteSessionDeadline) {
    await prisma.refreshToken.updateMany({
      where: { userId: storedToken.userId, revoked: false },
      data: { revoked: true },
    });

    throw new UnauthorizedError('Session maximum age reached. Please login again.', 'SESSION_MAX_AGE_EXCEEDED');
  }

  if (storedToken.revoked) {
    const graceWindowMs = REFRESH_ROTATION_GRACE_SECONDS * 1000;
    const isWithinGrace = (storedToken.expiresAt.getTime() - now.getTime()) <= graceWindowMs;

    if (!isWithinGrace) {
      await prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId, revoked: false },
        data: { revoked: true },
      });

      await AuditService.log({
        actorId: storedToken.userId,
        actionType: 'auth.refresh_replay_detected',
        entityType: 'auth',
        entityId: storedToken.userId,
        newState: { tokenId: storedToken.id, revokedTokenReused: true },
      });

      throw new UnauthorizedError('Refresh token replay detected. All sessions were revoked.', 'TOKEN_THEFT_DETECTED');
    }

    // Allow one grace use only.
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { expiresAt: now },
    });

    const accessToken = generateAccessToken(storedToken.user);
    const newRefreshToken = await generateRefreshToken(storedToken.userId, sessionStartedAtMs);
    return { token: accessToken, accessToken, refreshToken: newRefreshToken };
  }

  // Revoke old token and create new one (rotate)
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: {
      revoked: true,
      expiresAt: new Date(now.getTime() + (REFRESH_ROTATION_GRACE_SECONDS * 1000)),
    },
  });

  const accessToken = generateAccessToken(storedToken.user);
  const newRefreshToken = await generateRefreshToken(storedToken.userId, sessionStartedAtMs);

  return { token: accessToken, accessToken, refreshToken: newRefreshToken };
}

/**
 * Logout — revoke all refresh tokens for user.
 */
async function logout(userId, ipAddress) {
  await prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data: { revoked: true },
  });

  await AuditService.log({
    actorId: userId,
    actionType: 'auth.logout',
    entityType: 'auth',
    entityId: userId,
    ipAddress,
  });
}

/**
 * Upload identity photo for verification.
 */
async function uploadIdentityPhoto(driverId, { photoUrl, idCardFront, idCardBack }, ipAddress) {
  const user = await prisma.user.findUnique({ where: { id: driverId } });
  if (!user || user.role !== 'driver') {
    throw new ValidationError('Invalid driver');
  }

  // Cancel any pending verification
  await prisma.identityVerification.updateMany({
    where: { driverId, status: 'pending' },
    data: { status: 'rejected', rejectionReason: 'Superseded by new upload' },
  });

  const verification = await prisma.identityVerification.create({
    data: {
      driverId,
      photoUrl,
      idCardFront,
      idCardBack,
      status: 'pending'
    },
  });

  // Also update user profile photo reference and ID card references
  const updatedUser = await prisma.user.update({
    where: { id: driverId },
    data: {
      identityPhotoUrl: photoUrl,
      idCardFront,
      idCardBack
    },
  });

  await AuditService.log({
    actorId: driverId,
    actionType: 'identity.uploaded',
    entityType: 'identity',
    entityId: verification.id,
    newState: { photoUrl, idCardFront, idCardBack },
    ipAddress,
  });

  notifyAdmins('identity_upload', 'New Identity Verification', `Driver ${user.name} has uploaded a new identity photo for review.`, { driverId });

  return {
    verification,
    user: await fileService.signDriverUrls(sanitizeUser(updatedUser)),
  };
}

/**
 * Admin: review identity verification (approve/reject).
 */
async function reviewIdentity(id, adminId, action, rejectionReason, ipAddress) {
  let verification = await prisma.identityVerification.findFirst({
    where: {
      OR: [
        { id },
        { driverId: id }
      ],
      status: 'pending'
    },
  });

  // If no pending verification found and action is approve, create a placeholder one
  if (!verification && action === 'approve') {
    const driver = await prisma.user.findUnique({ where: { id: id } });
    if (!driver || driver.role !== 'driver') throw new NotFoundError('Driver');

    verification = await prisma.identityVerification.create({
      data: {
        driverId: id,
        photoUrl: 'manual_verification',
        status: 'pending'
      }
    });
  }

  if (!verification) {
    throw new ConflictError('INVALID_STATE', 'No pending verification found for this driver');
  }

  const status = action === 'approve' ? 'approved' : 'rejected';
  const updated = await prisma.identityVerification.update({
    where: { id: verification.id },
    data: {
      status,
      reviewedBy: adminId,
      reviewedAt: new Date(),
      rejectionReason: status === 'rejected' ? rejectionReason : null,
    },
  });

  if (status === 'approved') {
    await prisma.user.update({
      where: { id: verification.driverId },
      data: { identityVerified: true },
    });
  }

  await AuditService.log({
    actorId: adminId,
    actionType: `identity.${status}`,
    entityType: 'identity',
    entityId: verification.id,
    previousState: { status: 'pending' },
    newState: { status, rejectionReason },
    ipAddress,
  });

  // Real-time Notification
  notifyDriver(verification.driverId, {
    type: 'identity_update',
    status,
    reason: rejectionReason
  });

  notifyAdmins(
    'identity_reviewed',
    'Identity Review Updated',
    `Driver identity was ${status}.`,
    { driverId: verification.driverId, status, actorId: adminId }
  );

  return updated;
}

/**
 * Get pending identity verifications (admin view).
 */
async function getPendingVerifications(query = {}) {
  const { sortBy = 'createdAt', sortOrder = 'asc', status, name } = query;

  const validSortFields = ['createdAt', 'updatedAt'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const order = sortOrder === 'desc' ? 'desc' : 'asc';

  const where = {};
  if (status && status !== 'all') where.status = status;
  if (!status) where.status = 'pending'; // Default to pending if not specified

  if (name) {
    where.driver = {
      name: { contains: name, mode: 'insensitive' }
    };
  }

  const verifications = await prisma.identityVerification.findMany({
    where,
    include: { driver: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true, identityPhotoUrl: true, idCardFront: true, idCardBack: true } } },
    orderBy: { [sortField]: order },
  });

  // Sign URLs for all drivers in the list
  const signed = await Promise.all(verifications.map(async v => {
    if (v.driver) v.driver = await fileService.signDriverUrls(v.driver);
    return v;
  }));

  return signed;
}

// ─── Helpers ──────────────────────────────────

function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      adminRole: user.adminRole,
      mustChangePassword: user.mustChangePassword,
      identityVerified: user.identityVerified,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

async function generateRefreshToken(userId, sessionStartedAtMs = Date.now()) {
  const token = crypto.randomBytes(40).toString('hex');
  const tokenWithSession = `${token}.${sessionStartedAtMs}`;
  const tokenHash = hashToken(tokenWithSession);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_LIFETIME_DAYS);

  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return tokenWithSession;
}

function extractSessionStartedAt(refreshToken) {
  if (!refreshToken || typeof refreshToken !== 'string') return null;
  const parts = refreshToken.split('.');
  if (parts.length !== 2) return null;
  const sessionTs = Number(parts[1]);
  if (!Number.isFinite(sessionTs) || sessionTs <= 0) return null;
  return sessionTs;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function validatePasswordPolicy(password) {
  if (password.length < 8) throw new ValidationError('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password)) throw new ValidationError('Password must contain at least one uppercase letter');
  if (!/[0-9]/.test(password)) throw new ValidationError('Password must contain at least one number');
}

/**
 * Get current user from DB with fresh token (for post-approval refresh).
 */
async function getMe(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User');
  const accessToken = generateAccessToken(user);
  return { user: await fileService.signDriverUrls(sanitizeUser(user)), accessToken };
}

function sanitizeUser(user) {
  const safe = { ...user };
  delete safe.passwordHash;
  return safe;
}

/**
 * Update user preferences (e.g., language).
 */
async function updatePreferences(userId, data, ipAddress) {
  const { languagePreference } = data;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { languagePreference },
  });

  await AuditService.log({
    actorId: userId,
    actionType: 'user.preferences_updated',
    entityType: 'user',
    entityId: userId,
    newState: { languagePreference },
    ipAddress,
  });

  return {
    user: await fileService.signDriverUrls(sanitizeUser(updatedUser)),
    message: 'Preferences updated successfully'
  };
}


/**
 * Verify reset token.
 */
async function verifyResetToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (decoded.type !== 'password_reset') throw new Error('Invalid token type');

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.isActive) throw new Error('User not found');

    return { email: user.email };
  } catch {
    throw new UnauthorizedError('Invalid or expired reset link', 'INVALID_RESET_TOKEN');
  }
}

/**
 * Reset password using token.
 */
async function resetPassword(token, newPassword, ipAddress) {
  const decoded = await verifyResetToken(token);
  const user = await prisma.user.findUnique({ where: { email: decoded.email } });

  validatePasswordPolicy(newPassword);

  const passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  await AuditService.log({
    actorId: user.id,
    actionType: 'auth.password_reset',
    entityType: 'auth',
    entityId: user.id,
    ipAddress,
  });

  return { message: 'Password has been reset successfully. You can now log in with your new password.' };
}


module.exports = {
  login,
  verifyDevice,
  changePassword,
  refreshAccessToken,
  logout,
  uploadIdentityPhoto,
  reviewIdentity,
  getPendingVerifications,
  getMe,
  updatePreferences,
  verifyResetToken,
  resetPassword,
};
