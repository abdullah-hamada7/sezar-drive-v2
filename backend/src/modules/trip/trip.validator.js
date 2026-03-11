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
  static async validateAssignmentPreconditions(driverId, options = {}) {
    const { shiftId, vehicleId, allowUnassigned = false } = options;
    const driver = await prisma.user.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundError('Driver');

    const openShiftStatuses = ['PendingVerification', 'Active'];

    if (shiftId) {
      const shift = await prisma.shift.findUnique({
        where: { id: shiftId },
        include: {
          assignments: {
            where: { active: true },
            orderBy: { assignedAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!shift || shift.driverId !== driverId) {
        throw new ConflictError('SHIFT_MISMATCH', 'Provided shift does not belong to the selected driver');
      }

      if (!openShiftStatuses.includes(shift.status)) {
        throw new ConflictError('SHIFT_NOT_OPEN', 'Provided shift must be Active or PendingVerification');
      }

      const activeAssignment = shift.assignments[0] || null;
      const resolvedVehicleId = vehicleId || activeAssignment?.vehicleId || shift.vehicleId;

      if (!resolvedVehicleId) {
        if (allowUnassigned) {
          return {
            driver,
            shift: { id: shift.id, status: shift.status },
            assignment: { vehicleId: null, shiftId: shift.id },
          };
        }
        throw new ConflictError(
          'NO_SHIFT_ASSIGNMENT',
          'Driver does not have an active or pending shift assignment. Assign a vehicle first.',
        );
      }

      if (vehicleId) {
        const matchesActiveAssignment = activeAssignment && activeAssignment.vehicleId === vehicleId;
        const matchesShiftVehicle = shift.vehicleId && shift.vehicleId === vehicleId;
        if (!matchesActiveAssignment && !matchesShiftVehicle) {
          throw new ConflictError('VEHICLE_SHIFT_MISMATCH', 'Provided vehicle does not match the selected shift');
        }
      }

      return {
        driver,
        shift: { id: shift.id, status: shift.status },
        assignment: { vehicleId: resolvedVehicleId, shiftId: shift.id },
      };
    }

    let assignment = await prisma.vehicleAssignment.findFirst({
      where: {
        driverId,
        active: true,
        shift: {
          status: { in: openShiftStatuses },
        },
      },
      include: {
        shift: {
          select: { id: true, status: true },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    if (!assignment) {
      const latestOpenShiftWithVehicle = await prisma.shift.findFirst({
        where: {
          driverId,
          status: { in: openShiftStatuses },
          vehicleId: { not: null },
        },
        select: { id: true, status: true, vehicleId: true },
        orderBy: { createdAt: 'desc' },
      });

      if (latestOpenShiftWithVehicle) {
        assignment = {
          vehicleId: latestOpenShiftWithVehicle.vehicleId,
          shift: {
            id: latestOpenShiftWithVehicle.id,
            status: latestOpenShiftWithVehicle.status,
          },
        };
      }
    }

    if (!assignment || !assignment.shift) {
      if (allowUnassigned) {
        return {
          driver,
          shift: null,
          assignment: { vehicleId: null, shiftId: null },
        };
      }
      throw new ConflictError(
        'NO_SHIFT_ASSIGNMENT',
        'Driver does not have an active or pending shift assignment. Assign a vehicle first.',
      );
    }

    return { driver, shift: assignment.shift, assignment };
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
