const prisma = require('../../config/database');
const { ConflictError, ForbiddenError } = require('../../errors');
const PreconditionValidator = require('../../services/preconditionValidator.service');

class ShiftValidator {
  static async validateActivationPreconditions(shiftId, driverId) {
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: { driver: true }
    });

    await PreconditionValidator.driverIdentityVerified(driverId);
    await PreconditionValidator.biometricVerified(shift.verificationStatus);
    const assignment = await PreconditionValidator.vehicleAssigned(shiftId, driverId);
    await PreconditionValidator.inspectionCompleted(shiftId, driverId);

    return { shift, assignment, inspection: undefined };
  }

  static async validateClosurePreconditions(shiftId, driverId, startedAt) {
    if (!startedAt) {
      return { endInspection: null, activeTrip: null };
    }

    const endInspection = await PreconditionValidator.inspectionCompleted(shiftId, driverId, {
      createdAtAfter: startedAt,
    });

    await PreconditionValidator.noActiveTrip(shiftId);

    return { endInspection, activeTrip: null };
  }
}

module.exports = ShiftValidator;
