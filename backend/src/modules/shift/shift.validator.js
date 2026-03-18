const prisma = require('../../config/database');
const { ConflictError, ForbiddenError } = require('../../errors');

/**
 * ShiftValidator
 * Decouples validation logic from ShiftService.
 */
class ShiftValidator {
  /**
    * Validate preconditions for activating a shift.
    */
  static async validateActivationPreconditions(shiftId, driverId) {
    const shift = await prisma.shift.findUnique({ 
      where: { id: shiftId },
      include: { driver: true }
    });

    if (!shift.driver.identityVerified) {
      throw new ForbiddenError('IDENTITY_NOT_VERIFIED', 'Identity not verified');
    }

    // Check biometric verification
    if (shift.verificationStatus === 'MANUAL_REVIEW') {
      throw new ForbiddenError('BIOMETRIC_MANUAL_REVIEW', 'Your face verification requires manual review by an administrator before shift activation.');
    }
    if (shift.verificationStatus !== 'VERIFIED') {
      throw new ForbiddenError('BIOMETRIC_FAILED', 'Face verification must be passed before activating shift');
    }

    // Check vehicle assignment
    const assignment = await prisma.vehicleAssignment.findFirst({
      where: { shiftId, active: true },
    });
    if (!assignment) {
      throw new ConflictError('NO_VEHICLE_ASSIGNED', 'Vehicle QR must be scanned and assigned before activating shift');
    }

    // Check inspection completed with required directional photos
    const inspection = await prisma.inspection.findFirst({
      where: { shiftId, driverId, status: 'completed' },
      include: { photos: true },
    });
    if (!inspection) {
      throw new ConflictError('INSPECTION_REQUIRED', 'Vehicle inspection must be completed before activating shift');
    }
    const requiredDirections = ['front', 'back', 'left', 'right', 'dashboard', 'tank'];
    const availableDirections = new Set((inspection.photos || []).map((photo) => photo.direction));
    const missingDirections = requiredDirections.filter((direction) => !availableDirections.has(direction));
    if (missingDirections.length > 0) {
      throw new ConflictError('INSPECTION_PHOTOS_REQUIRED', 'Required vehicle photos are missing');
    }

    return { shift, assignment, inspection };
  }

  /**
    * Validate preconditions for closing a shift.
    */
  static async validateClosurePreconditions(shiftId, driverId, startedAt) {
    // If shift hasn't started, no end inspection is required.
    if (!startedAt) {
      return { endInspection: null, activeTrip: null };
    }

    // Check end-of-shift inspection
    const endInspection = await prisma.inspection.findFirst({
      where: { 
        shiftId, 
        driverId, 
        status: 'completed',
        createdAt: { gt: startedAt } 
      },
      include: { photos: true }
    });

    if (!endInspection) {
      throw new ConflictError('INSPECTION_REQUIRED', 'End-of-shift inspection required');
    }
    const requiredDirections = ['front', 'back', 'left', 'right', 'dashboard', 'tank'];
    const availableDirections = new Set((endInspection.photos || []).map((photo) => photo.direction));
    const missingDirections = requiredDirections.filter((direction) => !availableDirections.has(direction));
    if (missingDirections.length > 0) {
      throw new ConflictError('INSPECTION_PHOTOS_REQUIRED', 'Required vehicle photos are missing for end-shift inspection');
    }

    // Check no in-progress trip
    const activeTrip = await prisma.trip.findFirst({
      where: { shiftId, status: 'IN_PROGRESS' },
    });
    if (activeTrip) {
      throw new ConflictError('ACTIVE_TRIP_EXISTS', 'Cannot close shift while a trip is in progress', { tripId: activeTrip.id });
    }

    return { endInspection, activeTrip };
  }
}

module.exports = ShiftValidator;
