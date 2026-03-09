const prisma = require('../../config/database');
const { ConflictError, NotFoundError, ForbiddenError, ValidationError } = require('../../errors');
const AuditService = require('../../services/audit.service');
const { TRIP_STATE_MACHINE } = require('../../services/state-machine');
const TripValidator = require('./trip.validator');
const TripNotifier = require('./trip.notifier');
const { EGYPT_PHONE_REGEX } = require('../../utils/validation');

/**
 * Validate trip state transition.
 */
function validateTripTransition(from, to) {
  if (!TRIP_STATE_MACHINE.isValidTransition(from, to)) {
    throw new ConflictError('INVALID_STATE_TRANSITION', `Invalid trip state transition from ${from} to ${to}`);
  }
}

/**
 * Admin assigns a trip to a driver.
 */
async function assignTrip(data, adminId, ipAddress) {
  const { driverId, scheduledTime, price } = data;
  const pickupLocation = data.pickupLocation || data.pickup;
  const dropoffLocation = data.dropoffLocation || data.dropoff;

  if (!pickupLocation || !dropoffLocation) {
    throw new ValidationError('Pickup and dropoff locations are required');
  }

  const { shift, assignment } = await TripValidator.validateAssignmentPreconditions(driverId);

  const incomingPassengers = Array.isArray(data.passengers)
    ? data.passengers
    : (data.passenger ? [data.passenger] : []);

  if (incomingPassengers.length > 1) {
    throw new ValidationError('Only one passenger is allowed per trip');
  }

  const normalizedPassengers = incomingPassengers
    .map(passenger => {
      const companionCount = Number(
        passenger?.companionCount ??
        passenger?.companionsCount ??
        0
      );

      if (!passenger?.name || !String(passenger.name).trim()) {
        throw new ValidationError('Passenger name is required');
      }

      if (!passenger?.phone || !String(passenger.phone).trim()) {
        throw new ValidationError('Passenger phone is required');
      }

      if (!EGYPT_PHONE_REGEX.test(String(passenger.phone).trim())) {
        throw new ValidationError('Passenger phone must be a valid Egyptian mobile number (01XXXXXXXXX or +201XXXXXXXXX)');
      }

      if (!Number.isInteger(companionCount) || companionCount < 0) {
        throw new ValidationError('Companion count must be a non-negative integer');
      }

      return {
        name: String(passenger.name).trim(),
        phone: String(passenger.phone).trim(),
        companionCount,
      };
    });

  const trip = await prisma.trip.create({
    data: {
      driverId,
      shiftId: shift.id,
      vehicleId: assignment.vehicleId,
      pickupLocation,
      dropoffLocation,
      scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
      price,
      passengers: normalizedPassengers,
      status: 'ASSIGNED',
    },
  });

  await AuditService.log({
    actorId: adminId,
    actionType: 'trip.assigned',
    entityType: 'trip',
    entityId: trip.id,
    newState: { status: 'ASSIGNED', driverId, price },
    ipAddress,
  });

  TripNotifier.onTripAssigned(driverId, trip, adminId);

  return trip;
}

/**
 * Driver starts trip. Enforces all preconditions.
 */
async function startTrip(tripId, driverId, ipAddress) {
  const { trip, driver, assignment } = await TripValidator.validateStartPreconditions(tripId, driverId);
  validateTripTransition(trip.status, 'IN_PROGRESS');

  const updated = await prisma.trip.updateMany({
    where: {
      id: tripId,
      driverId,
      status: { in: ['ASSIGNED', 'ACCEPTED'] },
    },
    data: {
      status: 'IN_PROGRESS',
      actualStartTime: new Date(),
      version: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    const latest = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!latest) throw new NotFoundError('Trip');

    if (latest.status === 'IN_PROGRESS' || latest.status === 'COMPLETED') {
      return latest;
    }

    throw new ConflictError('CONFLICT', 'Trip cannot be started in its current state');
  }

  await AuditService.log({
    actorId: driverId,
    actionType: 'trip.started',
    entityType: 'trip',
    entityId: tripId,
    previousState: { status: 'ASSIGNED' },
    newState: { status: 'IN_PROGRESS', price: trip.price },
    ipAddress,
  });

  TripNotifier.onTripStarted(driver.name, {
    tripId,
    driverId,
    vehicleId: assignment.vehicleId
  });

  return prisma.trip.findUnique({ where: { id: tripId } });
}

/**
 * Driver completes trip.
 */
async function completeTrip(tripId, driverId, ipAddress) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw new NotFoundError('Trip');
  if (trip.driverId !== driverId) throw new ForbiddenError('FORBIDDEN', 'Not your trip');
  
  validateTripTransition(trip.status, 'COMPLETED');

  const updated = await prisma.trip.updateMany({
    where: { id: tripId, version: trip.version },
    data: {
      status: 'COMPLETED',
      actualEndTime: new Date(),
      version: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    throw new ConflictError('CONCURRENT_MODIFICATION', 'Trip was modified concurrently');
  }

  await AuditService.log({
    actorId: driverId,
    actionType: 'trip.completed',
    entityType: 'trip',
    entityId: tripId,
    previousState: { status: 'IN_PROGRESS' },
    newState: { status: 'COMPLETED' },
    ipAddress,
  });

  TripNotifier.onTripCompleted(driverId, tripId);

  return prisma.trip.findUnique({ where: { id: tripId } });
}

/**
 * Cancel trip. Driver can cancel in Assigned state; admin can cancel with override.
 */
async function cancelTrip(tripId, userId, role, reason, ipAddress) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw new NotFoundError('Trip');

  const isAdmin = role === 'admin';
  const isAssignedDriver = trip.driverId === userId;

  validateTripTransition(trip.status, 'CANCELLED');

  if (trip.status === 'IN_PROGRESS' && !isAdmin) {
    throw new ForbiddenError('ADMIN_OVERRIDE_REQUIRED', 'Only admin can cancel a started trip');
  }

  if (trip.status === 'ASSIGNED' && !isAdmin && !isAssignedDriver) {
    throw new ForbiddenError('FORBIDDEN', 'Only assigned driver or admin can cancel');
  }

  await prisma.trip.update({
    where: { id: tripId },
    data: {
      status: 'CANCELLED',
      cancellationReason: reason || 'Cancelled',
      cancelledBy: userId,
      version: { increment: 1 },
    },
  });

  const isOverride = isAdmin && trip.status === 'IN_PROGRESS';
  const logMethod = isOverride ? AuditService.logOverride : AuditService.log;

  await logMethod.call(AuditService, {
    actorId: userId,
    actionType: 'trip.cancelled',
    entityType: 'trip',
    entityId: tripId,
    previousState: { status: trip.status },
    newState: { status: 'CANCELLED', reason },
    ipAddress,
  }, isOverride ? reason : undefined);

  TripNotifier.onTripCancelled(trip, userId, isAdmin, reason);

  return prisma.trip.findUnique({ where: { id: tripId } });
}

/**
 * Get driver's active trip.
 */
async function getActiveTrip(driverId) {
  return prisma.trip.findFirst({
    where: { driverId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
    include: { vehicle: true },
  });
}

/**
 * Driver accepts assigned trip.
 */
async function acceptTrip(tripId, driverId, ipAddress) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw new NotFoundError('Trip');
  if (trip.driverId !== driverId) throw new ForbiddenError('FORBIDDEN', 'Not your trip');

  validateTripTransition(trip.status, 'ACCEPTED');

  const updated = await prisma.trip.updateMany({
    where: { id: tripId, version: trip.version },
    data: {
      status: 'ACCEPTED',
      version: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    throw new ConflictError('CONCURRENT_MODIFICATION', 'Trip was modified concurrently');
  }

  await AuditService.log({
    actorId: driverId,
    actionType: 'trip.accepted',
    entityType: 'trip',
    entityId: tripId,
    previousState: { status: trip.status },
    newState: { status: 'ACCEPTED' },
    ipAddress,
  });

  TripNotifier.onTripAccepted(driverId, tripId);
  return prisma.trip.findUnique({ where: { id: tripId } });
}

/**
 * Driver rejects an assigned/accepted trip with mandatory reason.
 */
async function rejectAssignedTrip(tripId, driverId, reason, ipAddress) {
  const trimmedReason = String(reason || '').trim();
  if (!trimmedReason) {
    throw new ValidationError('Rejection reason is required', 'REJECTION_REASON_REQUIRED');
  }

  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw new NotFoundError('Trip');
  if (trip.driverId !== driverId) throw new ForbiddenError('FORBIDDEN', 'Not your trip');

  if (!['ASSIGNED', 'ACCEPTED'].includes(trip.status)) {
    throw new ConflictError('INVALID_STATE_TRANSITION', 'Only assigned or accepted trips can be rejected');
  }

  const updated = await prisma.trip.updateMany({
    where: {
      id: tripId,
      driverId,
      status: { in: ['ASSIGNED', 'ACCEPTED'] },
    },
    data: {
      status: 'CANCELLED',
      cancellationReason: trimmedReason,
      cancelledBy: driverId,
      version: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    throw new ConflictError('CONCURRENT_MODIFICATION', 'Trip was modified concurrently');
  }

  await AuditService.log({
    actorId: driverId,
    actionType: 'trip.rejected',
    entityType: 'trip',
    entityId: tripId,
    previousState: { status: trip.status },
    newState: { status: 'CANCELLED', reason: trimmedReason },
    ipAddress,
  });

  TripNotifier.onTripCancelled(trip, driverId, false, trimmedReason);
  return prisma.trip.findUnique({ where: { id: tripId } });
}

/**
 * Admin override for trip state mutation.
 */
async function overrideTrip(tripId, nextStatus, reason, adminId, ipAddress) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw new NotFoundError('Trip');

  const allowed = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  if (!allowed.includes(nextStatus)) {
    throw new ValidationError('Invalid override status');
  }

  await prisma.trip.update({
    where: { id: tripId },
    data: {
      status: nextStatus,
      cancellationReason: nextStatus === 'CANCELLED' ? reason || 'Admin override' : trip.cancellationReason,
      cancelledBy: nextStatus === 'CANCELLED' ? adminId : trip.cancelledBy,
      version: { increment: 1 },
    },
  });

  await AuditService.logOverride(
    {
      actorId: adminId,
      actionType: 'trip.override',
      entityType: 'trip',
      entityId: tripId,
      previousState: { status: trip.status },
      newState: { status: nextStatus, reason: reason || null },
      ipAddress,
    },
    reason || 'Admin override',
  );

  return prisma.trip.findUnique({ where: { id: tripId } });
}

/**
 * Get trips with filters.
 */
async function getTrips({ page = 1, limit = 20, driverId, status, date }) {
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

  const [trips, total] = await Promise.all([
    prisma.trip.findMany({
      where, skip, take: limitNum,
      include: {
        driver: { select: { id: true, name: true, email: true } },
        vehicle: { select: { id: true, plateNumber: true, model: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.trip.count({ where }),
  ]);

  return { trips, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
}

/**
 * Get trip by ID. Enforces ownership for drivers.
 */
async function getTripById(id, requestingUser = null) {
  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      driver: { select: { id: true, name: true } },
      vehicle: { select: { id: true, plateNumber: true, model: true } },
      shift: { select: { id: true, status: true, driverId: true } },
    },
  });

  if (!trip) throw new NotFoundError('Trip');

  // Enforce ownership if requester is a driver
  if (requestingUser && requestingUser.role === 'driver') {
    if (trip.driverId !== requestingUser.id) {
      throw new ForbiddenError('FORBIDDEN', 'Access Denied: You can only view your own trips');
    }
  }

  return trip;
}

module.exports = {
  assignTrip, acceptTrip, rejectAssignedTrip, startTrip, completeTrip, cancelTrip, overrideTrip,
  getActiveTrip, getTrips, getTripById,
};
