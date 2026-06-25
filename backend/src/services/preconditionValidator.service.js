const prisma = require('../config/database');
const { ConflictError, ForbiddenError } = require('../errors');

const REQUIRED_INSPECTION_DIRECTIONS = ['front', 'back', 'left', 'right', 'dashboard', 'tank'];

const PreconditionValidator = {
  async driverIdentityVerified(driverId) {
    const driver = await prisma.user.findUnique({ where: { id: driverId } });
    if (!driver || !driver.identityVerified) {
      throw new ForbiddenError('IDENTITY_NOT_VERIFIED', 'Identity not verified');
    }
    return driver;
  },

  async biometricVerified(verificationStatus) {
    if (verificationStatus === 'MANUAL_REVIEW') {
      throw new ForbiddenError('BIOMETRIC_MANUAL_REVIEW', 'Your face verification requires manual review by an administrator before shift activation.');
    }
    if (verificationStatus !== 'VERIFIED') {
      throw new ForbiddenError('BIOMETRIC_FAILED', 'Face verification must be passed before activating shift');
    }
  },

  async vehicleAssigned(shiftId, driverId) {
    const assignment = await prisma.vehicleAssignment.findFirst({
      where: { shiftId, active: true },
    });
    if (!assignment) {
      throw new ConflictError('NO_VEHICLE_ASSIGNED', 'Vehicle QR must be scanned and assigned before proceeding');
    }
    return assignment;
  },

  async inspectionCompleted(shiftId, driverId, opts = {}) {
    const { createdAtAfter, requiredDirections = REQUIRED_INSPECTION_DIRECTIONS } = opts;
    const whereClause = { shiftId, driverId, status: 'completed' };
    if (createdAtAfter) {
      whereClause.createdAt = { gt: createdAtAfter };
    }

    const inspection = await prisma.inspection.findFirst({
      where: whereClause,
      include: { photos: true },
    });
    if (!inspection) {
      throw new ConflictError('INSPECTION_REQUIRED', 'Vehicle inspection must be completed before proceeding');
    }
    const availableDirections = new Set((inspection.photos || []).map((photo) => photo.direction));
    const missingDirections = requiredDirections.filter((d) => !availableDirections.has(d));
    if (missingDirections.length > 0) {
      throw new ConflictError('INSPECTION_PHOTOS_REQUIRED', 'Required vehicle photos are missing');
    }
    return inspection;
  },

  async noActiveTrip(shiftId) {
    const activeTrip = await prisma.trip.findFirst({
      where: { shiftId, status: 'IN_PROGRESS' },
    });
    if (activeTrip) {
      throw new ConflictError('ACTIVE_TRIP_EXISTS', 'Cannot close shift while a trip is in progress', { tripId: activeTrip.id });
    }
    return true;
  },

  async shiftOpen(shiftId, driverId) {
    const shift = await prisma.shift.findFirst({
      where: { id: shiftId, driverId, status: { in: ['PendingVerification', 'Active'] } },
    });
    if (!shift) {
      throw new ConflictError('SHIFT_NOT_OPEN', 'Shift must be Active or PendingVerification');
    }
    return shift;
  },
};

module.exports = PreconditionValidator;
