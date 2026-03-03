const prisma = require('../../config/database');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const { notifyAdmins } = require('../tracking/tracking.ws');
const { ValidationError, NotFoundError, ConflictError } = require('../../errors');

/**
 * Driver requests a rescue code because they forgot their password.
 */
async function requestRescue(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== 'driver') {
    // Generic message for security, don't reveal if user exists unless it's a driver
    return { message: 'If this account is eligible, a request has been sent to the admins.' };
  }

  // Check if there's already a pending request
  const existing = await prisma.rescueRequest.findFirst({
    where: { userId: user.id, status: 'pending' }
  });

  if (existing) {
    throw new ConflictError('RESCUE_REQUEST_PENDING', 'A rescue request is already pending. Please wait for an admin.');
  }

  const request = await prisma.rescueRequest.create({
    data: {
      userId: user.id,
      status: 'pending'
    }
  });

  // Notify admins via WebSocket
  notifyAdmins('rescue_request', 'Password Rescue Requested', `Driver ${user.name} is requesting a password rescue code.`, {
    requestId: request.id,
    driverId: user.id,
    driverName: user.name,
    driverEmail: user.email
  });

  return { message: 'Your request has been sent. An admin will provide you with a rescue code shortly.' };
}

/**
 * Admin generates a 6-digit code for a pending request.
 */
async function generateRescueCode(adminId, requestId) {
  const request = await prisma.rescueRequest.findUnique({
    where: { id: requestId },
    include: { user: true }
  });

  if (!request) throw new NotFoundError('Rescue Request');
  if (request.status !== 'pending') throw new ValidationError('Request is no longer pending');

  const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 60); // Valid for 60 mins

  await prisma.rescueRequest.update({
    where: { id: requestId },
    data: {
      code,
      status: 'active',
      expiresAt
    }
  });

  return {
    code,
    driverName: request.user.name,
    requestId: request.id
  };
}

/**
 * Driver verifies the code provided by admin to get a reset token.
 */
async function verifyRescueCode(email, code) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new ValidationError('Invalid email or code', 'INVALID_RESCUE_CODE');

  const request = await prisma.rescueRequest.findFirst({
    where: {
      userId: user.id,
      code,
      status: 'active',
      expiresAt: { gt: new Date() }
    }
  });

  if (!request) {
    throw new ValidationError('Invalid or expired rescue code', 'INVALID_RESCUE_CODE');
  }

  // Mark as used
  await prisma.rescueRequest.update({
    where: { id: request.id },
    data: { status: 'used' }
  });

  // Generate a standard password reset token (10 min expiry)
  const resetToken = jwt.sign(
    { id: user.id, email: user.email, type: 'password_reset' },
    config.jwtSecret,
    { expiresIn: '30m' }
  );

  return { token: resetToken, resetToken };
}

async function listPendingRescueRequests() {
  return prisma.rescueRequest.findMany({
    where: { status: 'pending' },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

module.exports = {
  requestRescue,
  generateRescueCode,
  verifyRescueCode,
  listPendingRescueRequests
};
