const prisma = require('../../config/database');
const { ConflictError, ForbiddenError, NotFoundError } = require('../../errors');
const AuditService = require('../../services/audit.service');
const { SHIFT_STATE_MACHINE } = require('../../services/state-machine');
const FileService = require('../../services/FileService');
const vehicleService = require('../vehicle/vehicle.service');
const ShiftValidator = require('./shift.validator');
const ShiftNotifier = require('./shift.notifier');

async function signShiftStartSelfie(shift) {
  if (!shift) return shift;
  const s = { ...shift };

  if (s.startSelfieUrl) {
    try {
      s.startSelfieUrl = await FileService.getUrl(s.startSelfieUrl);
    } catch (err) {
      console.error('Failed to sign shift selfie URL:', err.message);
    }
  }

  return s;
}

/**
 * Validate shift state transition.
 */
function validateShiftTransition(from, to) {
  if (!SHIFT_STATE_MACHINE.isValidTransition(from, to)) {
    throw new ConflictError('INVALID_STATE_TRANSITION', `Invalid shift state transition from ${from} to ${to}`);
  }
}

/**
 * Create a new shift (driver only). Starts in PendingVerification.
 */
async function createShift(driverId, ipAddress) {
  // Check identity verified
  const driver = await prisma.user.findUnique({ where: { id: driverId } });
  if (!driver.identityVerified) {
    throw new ForbiddenError('IDENTITY_NOT_VERIFIED', 'Your identity must be verified by an administrator before you can start a shift.');
  }

  // Check no active shift
  const existing = await prisma.shift.findFirst({
    where: { driverId, status: { in: ['PendingVerification', 'Active'] } },
  });
  if (existing) {
    throw new ConflictError('ACTIVE_SHIFT_EXISTS', 'You already have an active shift. Please close it before starting a new one.', { shiftId: existing.id });
  }

  const shift = await prisma.shift.create({
    data: { driverId, status: 'PendingVerification' },
  });

  await AuditService.log({
    actorId: driverId,
    actionType: 'shift.created',
    entityType: 'shift',
    entityId: shift.id,
    newState: { status: 'PendingVerification' },
    ipAddress,
  });

  ShiftNotifier.onShiftStarted(driver.name, shift.id, driverId);

  return shift;
}

/**
 * Activate shift after all verifications pass.
 * Preconditions: vehicle assigned, inspection completed.
 */
async function activateShift(shiftId, driverId, ipAddress) {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) throw new NotFoundError('Shift');
  if (shift.driverId !== driverId) throw new ForbiddenError('FORBIDDEN', 'Not your shift');

  validateShiftTransition(shift.status, 'Active');

  const { assignment } = await ShiftValidator.validateActivationPreconditions(shiftId, driverId);

  // Optimistic locking
  const updated = await prisma.shift.updateMany({
    where: { id: shiftId, version: shift.version },
    data: {
      status: 'Active',
      startedAt: new Date(),
      vehicleId: assignment.vehicleId,
      version: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    throw new ConflictError('CONCURRENT_MODIFICATION', 'Shift was modified by another request');
  }

  // Update vehicle status
  await prisma.vehicle.update({
    where: { id: assignment.vehicleId },
    data: { status: 'in_use' },
  });

  await AuditService.log({
    actorId: driverId,
    actionType: 'shift.activated',
    entityType: 'shift',
    entityId: shiftId,
    previousState: { status: 'PendingVerification' },
    newState: { status: 'Active', vehicleId: assignment.vehicleId },
    ipAddress,
  });

  ShiftNotifier.onShiftActivated(shiftId, driverId, assignment.vehicleId);

  return prisma.shift.findUnique({ where: { id: shiftId } });
}

/**
 * Close shift (driver). Cannot close if active trip exists.
 */
async function closeShift(shiftId, driverId, ipAddress) {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) throw new NotFoundError('Shift');
  if (shift.driverId !== driverId) throw new ForbiddenError('FORBIDDEN', 'Not your shift');

  validateShiftTransition(shift.status, 'Closed');

  await ShiftValidator.validateClosurePreconditions(shiftId, driverId, shift.startedAt);

  // Optimistic locking
  const updated = await prisma.shift.updateMany({
    where: { id: shiftId, version: shift.version },
    data: {
      status: 'Closed',
      closedAt: new Date(),
      closeReason: 'driver_closed',
      version: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    throw new ConflictError('CONCURRENT_MODIFICATION', 'Shift was modified concurrently');
  }

  // Release vehicle
  const assignment = await prisma.vehicleAssignment.findFirst({
    where: { shiftId, active: true },
  });
  if (assignment) {
    await vehicleService.releaseVehicle(assignment.id, driverId, ipAddress);
  }

  await AuditService.log({
    actorId: driverId,
    actionType: 'shift.closed',
    entityType: 'shift',
    entityId: shiftId,
    previousState: { status: 'Active' },
    newState: { status: 'Closed', closeReason: 'driver_closed' },
    ipAddress,
  });

  ShiftNotifier.onShiftClosed(shiftId, driverId, 'driver', 'driver_closed', driverId);

  return prisma.shift.findUnique({ where: { id: shiftId } });
}

/**
 * Admin emergency close shift. Bypasses active trip check.
 */
async function adminCloseShift(shiftId, adminId, reason, ipAddress) {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) throw new NotFoundError('Shift');

  validateShiftTransition(shift.status, 'Closed');

  // Force-complete any active trips
  const activeTrips = await prisma.trip.findMany({
    where: { shiftId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
  });
  for (const trip of activeTrips) {
    await prisma.trip.update({
      where: { id: trip.id },
      data: {
        status: 'CANCELLED',
        cancellationReason: 'Admin emergency shift close',
        cancelledBy: adminId,
        version: { increment: 1 }
      },
    });

    await AuditService.logOverride({
      actorId: adminId,
      actionType: 'trip.cancelled',
      entityType: 'trip',
      entityId: trip.id,
      previousState: { status: trip.status },
      newState: { status: 'CANCELLED', reason: 'Admin emergency shift close' },
      ipAddress,
    }, 'Admin emergency shift close');
  }

  const updated = await prisma.shift.updateMany({
    where: { id: shiftId, version: shift.version },
    data: {
      status: 'Closed',
      closedAt: new Date(),
      closeReason: 'admin_override',
      version: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    throw new ConflictError('CONCURRENT_MODIFICATION', 'Shift was modified concurrently');
  }

  // Release vehicle
  const assignment = await prisma.vehicleAssignment.findFirst({
    where: { shiftId, active: true },
  });
  if (assignment) {
    await vehicleService.releaseVehicle(assignment.id, adminId, ipAddress);
  }

  await AuditService.log({
    actorId: adminId,
    actionType: 'shift.admin_closed',
    entityType: 'shift',
    entityId: shiftId,
    previousState: { status: shift.status },
    newState: { status: 'Closed', closeReason: 'admin_override' },
    ipAddress,
    metadata: { override: true, reason, cancelledTrips: activeTrips.length },
  });

  ShiftNotifier.onShiftClosed(shiftId, shift.driverId, 'admin', reason || 'admin_override', adminId);

  return prisma.shift.findUnique({ where: { id: shiftId } });
}

/**
 * Get driver's active shift.
 */
async function getActiveShift(driverId) {
  const shift = await prisma.shift.findFirst({
    where: { driverId, status: { in: ['PendingVerification', 'Active'] } },
    include: {
      vehicle: true,
      assignments: { where: { active: true }, include: { vehicle: true } },
    },
  });

  return await signShiftStartSelfie(shift);
}

/**
 * Get all shifts with filters.
 */
async function getShifts({ page = 1, limit = 20, driverId, status, date }) {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;
  const skip = (pageNum - 1) * limitNum;
  const where = {
    ...(driverId && { driverId }),
    ...(status && { status }),
    ...(date && {
      createdAt: {
        gte: new Date(date),
        lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1)),
      },
    }),
  };

  const [shifts, total] = await Promise.all([
    prisma.shift.findMany({
      where, skip, take: limitNum,
      include: {
        driver: { select: { id: true, name: true, email: true } },
        vehicle: true,
        assignments: { where: { active: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.shift.count({ where }),
  ]);

  const signedShifts = await Promise.all(shifts.map(signShiftStartSelfie));

  return { shifts: signedShifts, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
}

/**
 * Get shift by ID. Enforces ownership for drivers.
 */
async function getShiftById(id, requestingUser = null) {
  const shift = await prisma.shift.findUnique({
    where: { id },
    include: {
      driver: { select: { id: true, name: true, email: true } },
      vehicle: true,
      assignments: { include: { vehicle: true } },
      inspections: { include: { photos: true } },
      trips: true,
      expenses: { include: { category: true } },
    },
  });

  if (!shift) throw new NotFoundError('Shift');

  // Enforce ownership if requester is a driver
  if (requestingUser && requestingUser.role === 'driver') {
    if (shift.driverId !== requestingUser.id) {
      throw new ForbiddenError('FORBIDDEN', 'Access Denied: You can only view your own shifts');
    }
  }

  const signedShift = await signShiftStartSelfie(shift);
  signedShift.inspections = await FileService.signInspections(signedShift.inspections);
  signedShift.expenses = await FileService.signExpenses(signedShift.expenses);

  return signedShift;
}

module.exports = {
  createShift, activateShift, closeShift, adminCloseShift,
  getActiveShift, getShifts, getShiftById,
};
