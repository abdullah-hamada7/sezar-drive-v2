const prisma = require('../../config/database');
const { ConflictError, NotFoundError, ForbiddenError } = require('../../errors');

/**
 * TripValidator
 * Decouples validation logic from TripService.
 */
class TripValidator {
  /**
   * Validate preconditions for assigning a trip.
   */
  static async validateAssignmentPreconditions(driverId) {
    const driver = await prisma.user.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundError('Driver');

    // Verify driver has active shift
    const shift = await prisma.shift.findFirst({
      where: { driverId, status: 'Active' },
    });
    if (!shift) {
      throw new ConflictError('NO_ACTIVE_SHIFT', `Driver ${driver.name} does not have an active shift.`);
    }

    // Verify no active trip
    const activeTrip = await prisma.trip.findFirst({
      where: { driverId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
    });
    if (activeTrip) {
      throw new ConflictError('ACTIVE_TRIP_EXISTS', `Driver ${driver.name} already has an active trip.`);
    }

    // Get driver's vehicle
    const assignment = await prisma.vehicleAssignment.findFirst({
      where: { driverId, shiftId: shift.id, active: true },
    });
    if (!assignment) {
      throw new ConflictError('NO_VEHICLE_ASSIGNED', 'Driver has no assigned vehicle');
    }

    return { driver, shift, assignment };
  }

  /**
   * Validate preconditions for starting a trip.
   */
  static async validateStartPreconditions(tripId, driverId) {
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundError('Trip');
    if (trip.driverId !== driverId) throw new ForbiddenError('FORBIDDEN', 'Not your trip');

    // Verify active shift
    const shift = await prisma.shift.findFirst({
      where: { driverId, status: 'Active' },
    });
    if (!shift) {
      throw new ConflictError('NO_ACTIVE_SHIFT', 'No active shift');
    }

    // Verify identity
    const driver = await prisma.user.findUnique({ where: { id: driverId } });
    if (!driver.identityVerified) {
      throw new ForbiddenError('IDENTITY_NOT_VERIFIED', 'Identity not verified');
    }

    // Verify vehicle assigned
    const assignment = await prisma.vehicleAssignment.findFirst({
      where: { driverId, shiftId: shift.id, active: true },
    });
    if (!assignment) {
      throw new ConflictError('NO_VEHICLE_ASSIGNED', 'No vehicle assigned');
    }

    // Verify inspection completed
    const inspection = await prisma.inspection.findFirst({
      where: { shiftId: shift.id, driverId, status: 'completed' },
    });
    if (!inspection) {
      throw new ConflictError('INSPECTION_REQUIRED', 'Inspection not completed');
    }

    // Verify scheduled time (don't start too early)
    if (trip.scheduledTime) {
      const now = new Date();
      const scheduled = new Date(trip.scheduledTime);
      const diffMs = scheduled - now;
      const oneHourMs = 60 * 60 * 1000;

      if (diffMs > oneHourMs) {
        throw new ConflictError('TRIP_TOO_EARLY', `Trip is scheduled for ${scheduled.toLocaleString()}. You can only start 1 hour before.`);
      }
    }

    return { trip, shift, driver, assignment, inspection };
  }
}

module.exports = TripValidator;
