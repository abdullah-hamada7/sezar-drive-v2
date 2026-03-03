const prisma = require('../../config/database');
const { ConflictError, NotFoundError, ValidationError, ForbiddenError } = require('../../errors');
const AuditService = require('../../services/audit.service');
const FileService = require('../../services/FileService');

/**
 * Create a full or checklist inspection for a shift.
 */
async function createInspection(data, driverId, ipAddress) {
  const { shiftId, vehicleId, type, mileage } = data;

  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift || shift.driverId !== driverId) throw new NotFoundError('Shift');

  const isChecklist = type === 'checklist';
  const inspection = await prisma.inspection.create({
    data: {
      shiftId,
      vehicleId,
      driverId,
      type,
      mileage,
      status: isChecklist ? 'completed' : 'pending',
      completedAt: isChecklist ? new Date() : null,
    },
  });

  await AuditService.log({
    actorId: driverId,
    actionType: 'inspection.created',
    entityType: 'inspection',
    entityId: inspection.id,
    newState: { type, status: inspection.status },
    ipAddress,
  });

  return inspection;
}

/**
 * Upload inspection photo (for full inspection).
 */
async function uploadInspectionPhoto(inspectionId, direction, photoUrl, driverId) {
  const inspection = await prisma.inspection.findUnique({ where: { id: inspectionId } });
  if (!inspection || inspection.driverId !== driverId) throw new NotFoundError('Inspection');
  if (inspection.status === 'completed') {
    throw new ConflictError('INSPECTION_COMPLETED', 'Cannot add photos to completed inspection');
  }

  const photo = await prisma.inspectionPhoto.create({
    data: { inspectionId, direction, photoUrl },
  });

  return { ...photo, photoUrl: await FileService.getUrl(photo.photoUrl) };
}

/**
 * Complete a full inspection (verify all 4 directions have photos).
 */
async function completeInspection(inspectionId, driverId, checklistData, ipAddress) {
  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { photos: true },
  });
  if (!inspection || inspection.driverId !== driverId) throw new NotFoundError('Inspection');
  if (inspection.status === 'completed') {
    throw new ConflictError('ALREADY_COMPLETED', 'Inspection already completed');
  }

  if (['full', 'pre', 'post'].includes(inspection.type)) {
    const directions = inspection.photos.map((p) => p.direction);
    const required = ['front', 'back', 'left', 'right'];
    const missing = required.filter((d) => !directions.includes(d));
    if (missing.length > 0) {
      throw new ValidationError('Missing inspection photos', { missingDirections: missing });
    }
  }

  await prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      status: 'completed',
      completedAt: new Date(),
      checklistData: checklistData || null,
    },
  });

  await AuditService.log({
    actorId: driverId,
    actionType: 'inspection.completed',
    entityType: 'inspection',
    entityId: inspectionId,
    newState: { status: 'completed' },
    ipAddress,
  });

  const finalInspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { photos: true },
  });

  return FileService.signInspection(finalInspection);
}

/**
 * Get inspections for a shift. Enforces ownership for drivers.
 */
async function getInspections(shiftId, requestingUser = null) {
  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) throw new NotFoundError('Shift');

  // Enforce ownership if requester is a driver
  if (requestingUser && requestingUser.role === 'driver') {
    if (shift.driverId !== requestingUser.id) {
      throw new ForbiddenError('FORBIDDEN', 'Access Denied: You can only view inspections for your own shifts');
    }
  }

  const inspections = await prisma.inspection.findMany({
    where: { shiftId },
    include: { photos: true },
    orderBy: { createdAt: 'desc' },
  });

  return FileService.signInspections(inspections);
}

module.exports = { createInspection, uploadInspectionPhoto, completeInspection, getInspections };
