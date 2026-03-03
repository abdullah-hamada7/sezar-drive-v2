const prisma = require('../../config/database');
const { NotFoundError, ConflictError } = require('../../errors');
const AuditService = require('../../services/audit.service');

/**
 * Create a new vehicle (admin only).
 */
async function createVehicle(data, adminId, ipAddress) {
  const plateNumber = data.plateNumber || data.plate;
  const qrCode = data.qrCode || data.qrIdentifier;

  try {
    const vehicle = await prisma.vehicle.create({
      data: {
        plateNumber,
        model: data.model,
        year: data.year,
        capacity: data.capacity || 4,
        qrCode,
      },
    });

    await AuditService.log({
      actorId: adminId,
      actionType: 'vehicle.created',
      entityType: 'vehicle',
      entityId: vehicle.id,
      newState: data,
      ipAddress,
    });

    return vehicle;
  } catch (err) {
    if (err.code === 'P2002') {
      const target = err.meta?.target || [];
      if (target.includes('plateNumber')) throw new ConflictError('VEHICLE_PLATE_EXISTS', 'Vehicle with this plate number already exists');
      if (target.includes('qrCode')) throw new ConflictError('VEHICLE_QR_EXISTS', 'Vehicle with this QR code already exists');
      throw new ConflictError('VEHICLE_ALREADY_EXISTS', 'A vehicle with this plate or QR already exists');
    }
    throw err;
  }
}

/**
 * Get all vehicles with filters.
 */
async function getVehicles({ page = 1, limit = 20, status, search, availableOnly }) {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;
  const skip = (pageNum - 1) * limitNum;

  const isAvailableOnly = availableOnly === 'true' || availableOnly === true;

  const where = {
    isActive: true,
    ...(status && { status }),
    ...(isAvailableOnly && { status: 'available' }),
    ...(search && {
      OR: [
        { plateNumber: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { qrCode: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [vehicles, total] = await Promise.all([
    prisma.vehicle.findMany({ where, skip, take: limitNum, orderBy: { createdAt: 'desc' } }),
    prisma.vehicle.count({ where }),
  ]);

  return { vehicles, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
}

/**
 * Get vehicle by ID.
 */
async function getVehicleById(id) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle || !vehicle.isActive) throw new NotFoundError('Vehicle');
  return vehicle;
}

/**
 * Update vehicle details.
 */
async function updateVehicle(id, data, adminId, ipAddress) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) throw new NotFoundError('Vehicle');

  const previousState = {
    plateNumber: vehicle.plateNumber,
    model: vehicle.model,
    year: vehicle.year,
    capacity: vehicle.capacity,
    qrCode: vehicle.qrCode
  };

  try {
    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        ...(data.plateNumber && { plateNumber: data.plateNumber }),
        ...(data.model && { model: data.model }),
        ...(data.year && { year: data.year }),
        ...(data.capacity && { capacity: data.capacity }),
        ...(data.qrCode && { qrCode: data.qrCode }),
      },
    });

    await AuditService.log({
      actorId: adminId,
      actionType: 'vehicle.updated',
      entityType: 'vehicle',
      entityId: id,
      previousState,
      newState: data,
      ipAddress,
    });

    return updated;
  } catch (err) {
    if (err.code === 'P2002') {
      const target = err.meta?.target || [];
      if (target.includes('plateNumber')) throw new ConflictError('VEHICLE_PLATE_EXISTS', 'Vehicle with this plate number already exists');
      if (target.includes('qrCode')) throw new ConflictError('VEHICLE_QR_EXISTS', 'Vehicle with this QR code already exists');
      throw new ConflictError('VEHICLE_ALREADY_EXISTS', 'A vehicle with this plate or QR already exists');
    }
    throw err;
  }
}

/**
 * Validate vehicle by QR code scan.
 */
async function validateQrCode(qrCode) {
  // Use findFirst with insensitive mode for better UX
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      qrCode: { equals: qrCode, mode: 'insensitive' }
    }
  });
  if (!vehicle || !vehicle.isActive) throw new NotFoundError('Vehicle with this QR code');
  if (['damaged', 'maintenance'].includes(vehicle.status)) {
    throw new ConflictError('VEHICLE_LOCKED', `Vehicle is ${vehicle.status}`, { status: vehicle.status });
  }
  return vehicle;
}

/**
 * Assign vehicle to driver for a shift.
 */
async function assignVehicle(vehicleId, driverId, shiftId, adminId, ipAddress) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new NotFoundError('Vehicle');
  if (['damaged', 'maintenance'].includes(vehicle.status)) {
    throw new ConflictError('VEHICLE_LOCKED', `Vehicle is ${vehicle.status}`);
  }

  // Check for open damage reports
  const openDamage = await prisma.damageReport.findFirst({
    where: { vehicleId, status: { notIn: ['resolved'] } },
  });
  if (openDamage) {
    throw new ConflictError('VEHICLE_HAS_OPEN_DAMAGE', 'Vehicle has an open damage report and cannot be assigned');
  }

  return prisma.$transaction(async (tx) => {
    // Check vehicle not already assigned (atomic check)
    const existingVehicleAssignment = await tx.vehicleAssignment.findFirst({
      where: { vehicleId, active: true },
    });
    if (existingVehicleAssignment) {
      throw new ConflictError('VEHICLE_ALREADY_ASSIGNED', 'Vehicle is already assigned to another driver');
    }

    // Check driver doesn't already have a vehicle
    const existingDriverAssignment = await tx.vehicleAssignment.findFirst({
      where: { driverId, active: true },
    });
    if (existingDriverAssignment) {
      throw new ConflictError('DRIVER_ALREADY_HAS_VEHICLE', 'Driver already has an assigned vehicle');
    }

    const assignment = await tx.vehicleAssignment.create({
      data: { vehicleId, driverId, shiftId },
    });

    await tx.vehicle.update({ where: { id: vehicleId }, data: { status: 'assigned' } });

    await AuditService.log({
      actorId: adminId || driverId,
      actionType: 'vehicle.assigned',
      entityType: 'vehicle',
      entityId: vehicleId,
      newState: { driverId, shiftId },
      ipAddress,
    }, tx);

    return assignment;
  });
}

/**
 * Release vehicle assignment.
 */
async function releaseVehicle(assignmentId, actorId, ipAddress) {
  const assignment = await prisma.vehicleAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment || !assignment.active) throw new NotFoundError('Active assignment');

  await prisma.vehicleAssignment.update({
    where: { id: assignmentId },
    data: { active: false, releasedAt: new Date() },
  });

  await prisma.vehicle.update({
    where: { id: assignment.vehicleId },
    data: { status: 'available' },
  });

  await AuditService.log({
    actorId,
    actionType: 'vehicle.released',
    entityType: 'vehicle',
    entityId: assignment.vehicleId,
    previousState: { driverId: assignment.driverId, active: true },
    newState: { active: false },
    ipAddress,
  });
}

/**
 * Lock/unlock vehicle (damage or maintenance).
 */
async function updateVehicleStatus(vehicleId, newStatus, adminId, ipAddress) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new NotFoundError('Vehicle');

  const previousStatus = vehicle.status;
  await prisma.vehicle.update({ where: { id: vehicleId }, data: { status: newStatus } });

  await AuditService.log({
    actorId: adminId,
    actionType: `vehicle.status_changed`,
    entityType: 'vehicle',
    entityId: vehicleId,
    previousState: { status: previousStatus },
    newState: { status: newStatus },
    ipAddress,
  });
}

/**
 * Deactivate vehicle (soft delete).
 */
async function deactivateVehicle(id, adminId, ipAddress) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) throw new NotFoundError('Vehicle');

  const activeAssignment = await prisma.vehicleAssignment.findFirst({
    where: { vehicleId: id, active: true },
  });
  if (activeAssignment) {
    throw new ConflictError('VEHICLE_ASSIGNED', 'Cannot deactivate a vehicle with an active assignment');
  }

  await prisma.vehicle.update({ where: { id }, data: { isActive: false } });

  await AuditService.log({
    actorId: adminId,
    actionType: 'vehicle.deactivated',
    entityType: 'vehicle',
    entityId: id,
    ipAddress,
  });

  return { message: 'Vehicle deactivated' };
}

module.exports = {
  createVehicle, getVehicles, getVehicleById, updateVehicle,
  validateQrCode, assignVehicle, releaseVehicle, updateVehicleStatus, deactivateVehicle,
};
