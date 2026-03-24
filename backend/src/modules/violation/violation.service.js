const prisma = require('../../config/database');
const { NotFoundError } = require('../../errors');
const AuditService = require('../../services/audit.service');
const FileService = require('../../services/FileService');

async function signViolation(violation) {
  if (!violation) return violation;
  const v = { ...violation };
  if (v.photoUrl) {
    v.photoUrl = await FileService.getUrl(v.photoUrl);
  }
  return v;
}

async function createViolation(data, adminId, ipAddress) {
  const { driverId, vehicleId, date, time, location, violationNumber, fineAmount, photoUrl } = data;

  const driver = await prisma.user.findUnique({ where: { id: driverId } });
  if (!driver || driver.role !== 'driver') throw new NotFoundError('Driver not found');

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new NotFoundError('Vehicle not found');

  const violation = await prisma.trafficViolation.create({
    data: {
      driverId,
      vehicleId,
      date: new Date(date),
      time,
      location,
      violationNumber,
      fineAmount: parseFloat(fineAmount),
      photoUrl: photoUrl || null,
    },
    include: {
      driver: { select: { id: true, name: true } },
      vehicle: { select: { id: true, plateNumber: true } },
    },
  });

  await AuditService.log({
    actorId: adminId,
    actionType: 'violation.created',
    entityType: 'traffic_violation',
    entityId: violation.id,
    newState: { driverId, violationNumber, fineAmount },
    ipAddress,
  });

  return await signViolation(violation);
}

async function updateViolation(id, data, adminId, ipAddress) {
  const existing = await prisma.trafficViolation.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Violation not found');

  const { driverId, vehicleId, date, time, location, violationNumber, fineAmount, photoUrl } = data;

  if (driverId) {
    const driver = await prisma.user.findUnique({ where: { id: driverId } });
    if (!driver || driver.role !== 'driver') throw new NotFoundError('Driver not found');
  }

  if (vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundError('Vehicle not found');
  }

  const violation = await prisma.trafficViolation.update({
    where: { id },
    data: {
      ...(driverId && { driverId }),
      ...(vehicleId && { vehicleId }),
      ...(date && { date: new Date(date) }),
      ...(time && { time }),
      ...(location && { location }),
      ...(violationNumber && { violationNumber }),
      ...(fineAmount !== undefined && { fineAmount: parseFloat(fineAmount) }),
      ...(photoUrl && { photoUrl }),
    },
    include: {
      driver: { select: { id: true, name: true } },
      vehicle: { select: { id: true, plateNumber: true } },
    },
  });

  await AuditService.log({
    actorId: adminId,
    actionType: 'violation.updated',
    entityType: 'traffic_violation',
    entityId: violation.id,
    previousState: existing,
    newState: violation,
    ipAddress,
  });

  return await signViolation(violation);
}

async function deleteViolation(id, adminId, ipAddress) {
  const existing = await prisma.trafficViolation.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Violation not found');

  await prisma.trafficViolation.delete({ where: { id } });

  await AuditService.log({
    actorId: adminId,
    actionType: 'violation.deleted',
    entityType: 'traffic_violation',
    entityId: id,
    previousState: existing,
    ipAddress,
  });

  return { message: 'Violation deleted successfully' };
}

async function getViolations({ page = 1, limit = 15, driverId, vehicleId, startDate, endDate, search, sortBy, sortOrder }) {
  const where = {};

  if (driverId) where.driverId = driverId;
  if (vehicleId) where.vehicleId = vehicleId;
  if (startDate || endDate) {
    where.date = {
      ...(startDate ? { gte: new Date(startDate) } : {}),
      ...(endDate ? { lte: new Date(endDate) } : {}),
    };
  }
  if (search) {
    where.OR = [
      { violationNumber: { contains: search, mode: 'insensitive' } },
      { location: { contains: search, mode: 'insensitive' } },
      { driver: { name: { contains: search, mode: 'insensitive' } } },
      { vehicle: { plateNumber: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const SORT_ALLOWLIST = new Set(['date', 'fineAmount', 'createdAt']);
  const normalizedSortBy = SORT_ALLOWLIST.has(String(sortBy)) ? String(sortBy) : 'date';
  const normalizedSortOrder = String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';
  const orderBy = { [normalizedSortBy]: normalizedSortOrder };

  const [violations, total] = await Promise.all([
    prisma.trafficViolation.findMany({
      where,
      include: {
        driver: { select: { id: true, name: true } },
        vehicle: { select: { id: true, plateNumber: true } },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.trafficViolation.count({ where }),
  ]);

  const signed = await Promise.all(violations.map((v) => signViolation(v)));

  return {
    data: signed,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getViolationById(id) {
  const violation = await prisma.trafficViolation.findUnique({
    where: { id },
    include: {
      driver: { select: { id: true, name: true, email: true, phone: true } },
      vehicle: { select: { id: true, plateNumber: true, model: true } },
    },
  });
  if (!violation) throw new NotFoundError('Violation not found');
  return await signViolation(violation);
}

async function getDriverDailyStats(date) {
  const targetDate = date ? new Date(date) : new Date();
  targetDate.setHours(0, 0, 0, 0);
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);

  const drivers = await prisma.user.findMany({
    where: { role: 'driver', isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const tripCounts = await prisma.trip.groupBy({
    by: ['driverId'],
    where: {
      status: 'COMPLETED',
      actualEndTime: {
        gte: targetDate,
        lt: nextDate,
      },
    },
    _count: { id: true },
  });

  const violationAmounts = await prisma.trafficViolation.groupBy({
    by: ['driverId'],
    where: {
      date: {
        gte: targetDate,
        lt: nextDate,
      },
    },
    _sum: { fineAmount: true },
  });

  const tripCountMap = Object.fromEntries(tripCounts.map(t => [t.driverId, t._count.id]));
  const violationMap = Object.fromEntries(violationAmounts.map(v => [v.driverId, parseFloat(v._sum.fineAmount) || 0]));

  return drivers.map(driver => ({
    driverId: driver.id,
    driverName: driver.name,
    tripsCompleted: tripCountMap[driver.id] || 0,
    totalFines: violationMap[driver.id] || 0,
  }));
}

async function getDrivers() {
  return prisma.user.findMany({
    where: { role: 'driver', isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

async function getVehicles() {
  return prisma.vehicle.findMany({
    where: { isActive: true },
    select: { id: true, plateNumber: true, model: true },
    orderBy: { plateNumber: 'asc' },
  });
}

module.exports = {
  createViolation,
  updateViolation,
  deleteViolation,
  getViolations,
  getViolationById,
  getDriverDailyStats,
  getDrivers,
  getVehicles,
};
