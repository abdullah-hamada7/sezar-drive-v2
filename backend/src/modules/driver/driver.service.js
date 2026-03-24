const bcrypt = require('bcryptjs');
const prisma = require('../../config/database');
const config = require('../../config');
const fileService = require('../../services/FileService');
const { ValidationError, NotFoundError, ConflictError } = require('../../errors');
const AuditService = require('../../services/audit.service');

/**
 * Admin creates a new driver account with temporary password.
 */
async function createDriver(data, adminId, ipAddress) {
  const { name, email, phone, licenseNumber, avatarUrl, idCardFront, idCardBack } = data;
  const password = data.password || data.temporaryPassword;

  if (!password) {
    throw new ValidationError('Password is required');
  }

  if (!avatarUrl || !idCardFront || !idCardBack) {
    throw new ValidationError('Personal photo and national ID front/back are required');
  }

  validatePasswordPolicy(password);

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
  });
  if (existing) {
    if (!existing.isActive) {
      throw new ConflictError('USER_DEACTIVATED', 'A deactivated user with this email or phone already exists. Please reactivate them instead.');
    }
    if (existing.email === email) {
      throw new ConflictError('EMAIL_ALREADY_EXISTS', 'User with this email already exists');
    }
    if (existing.phone === phone) {
      throw new ConflictError('PHONE_ALREADY_EXISTS', 'User with this phone number already exists');
    }
    throw new ConflictError('USER_ALREADY_EXISTS', 'User with this email or phone already exists');
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  const driver = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      passwordHash,
      role: 'driver',
      licenseNumber,
      avatarUrl,
      idCardFront,
      idCardBack,
      mustChangePassword: true,
      identityVerified: !!(idCardFront && idCardBack), // Verified since Admin provided docs
    },
  });

  await AuditService.log({
    actorId: adminId,
    actionType: 'driver.created',
    entityType: 'driver',
    entityId: driver.id,
    newState: { name, email, phone, licenseNumber },
    ipAddress,
  });

  delete driver.passwordHash;
  return driver;
}

/**
 * Get all drivers with pagination.
 */
async function getDrivers({ page = 1, limit = 20, search = '', status = 'active', startDate, endDate, sortBy, sortOrder }) {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;
  const skip = (pageNum - 1) * limitNum;

  const q = String(search || '').trim();
  const isUuid = q && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(q);

  const createdAt = {};
  if (startDate) {
    const d = new Date(startDate);
    if (!Number.isNaN(d.getTime())) createdAt.gte = d;
  }
  if (endDate) {
    const d = new Date(endDate);
    if (!Number.isNaN(d.getTime())) createdAt.lte = d;
  }

  const where = {
    role: 'driver',
    ...(q && {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        ...(isUuid ? [{ id: { equals: q } }] : []),
      ],
    }),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
  };

  if (status === 'active') where.isActive = true;
  if (status === 'inactive') where.isActive = false;

  const SORT_ALLOWLIST = new Set(['createdAt', 'name', 'email']);
  const normalizedSortBy = SORT_ALLOWLIST.has(String(sortBy)) ? String(sortBy) : 'createdAt';
  const normalizedSortOrder = String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';
  const orderBy = { [normalizedSortBy]: normalizedSortOrder };

  const [drivers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, phone: true, licenseNumber: true,
        identityVerified: true, identityPhotoUrl: true, idCardFront: true, idCardBack: true, mustChangePassword: true,
        lastKnownLat: true, lastKnownLng: true, lastLocationAt: true,
        isActive: true, createdAt: true, avatarUrl: true,
      },
      skip,
      take: limitNum,
      orderBy,
    }),
    prisma.user.count({ where }),
  ]);

  // Sign URLs for all drivers
  const signedDrivers = await Promise.all(drivers.map(d => fileService.signDriverUrls(d)));

  return { drivers: signedDrivers, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
}

/**
 * Get single driver by ID.
 */
async function getDriverById(id) {
  const driver = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, phone: true, licenseNumber: true,
      identityVerified: true, identityPhotoUrl: true, idCardFront: true, idCardBack: true, mustChangePassword: true,
      lastKnownLat: true, lastKnownLng: true, lastLocationAt: true,
      isActive: true, createdAt: true, updatedAt: true, avatarUrl: true,
    },
  });
  if (!driver || driver.role === 'admin') throw new NotFoundError('Driver');
  return await fileService.signDriverUrls(driver);
}

/**
 * Update driver details (admin only).
 */
async function updateDriver(id, data, adminId, ipAddress) {
  const driver = await prisma.user.findUnique({ where: { id } });
  if (!driver) throw new NotFoundError('Driver');

  const previousState = { name: driver.name, email: driver.email, phone: driver.phone };

  // Map frontend/API field 'profilePhotoUrl' to DB field 'avatarUrl'
  const updateData = {
    ...(data.name && { name: data.name }),
    ...(data.phone && { phone: data.phone }),
    ...(data.licenseNumber && { licenseNumber: data.licenseNumber }),
    ...(data.profilePhotoUrl && { avatarUrl: data.profilePhotoUrl }),
    ...(data.avatarUrl && { avatarUrl: data.avatarUrl }), // Handle direct usage too
    ...(data.idCardFront && { idCardFront: data.idCardFront }),
    ...(data.idCardBack && { idCardBack: data.idCardBack }),
    ...(data.identityPhotoUrl && { identityPhotoUrl: data.identityPhotoUrl }),
    ...(data.language_preference && { languagePreference: data.language_preference }),
    ...(data.languagePreference && { languagePreference: data.languagePreference }),
  };

  try {
    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    await AuditService.log({
      actorId: adminId, // NOTE: If self-update, adminId passed is actually driverId
      actionType: 'driver.updated',
      entityType: 'driver',
      entityId: id,
      previousState,
      newState: data,
      ipAddress,
    });

    delete updated.passwordHash;
    return await fileService.signDriverUrls(updated);
  } catch (err) {
    if (err.code === 'P2002') {
      const target = err.meta?.target || [];
      if (target.includes('email')) throw new ConflictError('EMAIL_ALREADY_EXISTS', 'Email already in use');
      if (target.includes('phone')) throw new ConflictError('PHONE_ALREADY_EXISTS', 'Phone number already in use');
      throw new ConflictError('USER_ALREADY_EXISTS', 'User with this email or phone already exists');
    }
    throw err;
  }
}

/**
 * Deactivate driver (soft delete).
 */
async function deactivateDriver(id, adminId, ipAddress) {
  const driver = await prisma.user.findUnique({ where: { id } });
  if (!driver) throw new NotFoundError('Driver');

  // Check no active shift
  const activeShift = await prisma.shift.findFirst({
    where: { driverId: id, status: { in: ['PendingVerification', 'Active'] } },
  });
  if (activeShift) {
    throw new ConflictError('ACTIVE_SHIFT_EXISTS', 'Cannot deactivate driver with an active shift');
  }

  await prisma.user.update({ where: { id }, data: { isActive: false } });

  await AuditService.log({
    actorId: adminId,
    actionType: 'driver.deactivated',
    entityType: 'driver',
    entityId: id,
    previousState: { isActive: true },
    newState: { isActive: false },
    ipAddress,
  });

  return { message: 'Driver deactivated' };
}

function validatePasswordPolicy(password) {
  if (password.length < 8) throw new ValidationError('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password)) throw new ValidationError('Password must contain uppercase letter');
  if (!/[0-9]/.test(password)) throw new ValidationError('Password must contain a number');
}

/**
 * Reactivate a deactivated driver.
 */
async function reactivateDriver(id, adminId, ipAddress) {
  const driver = await prisma.user.findUnique({ where: { id } });
  if (!driver) throw new NotFoundError('Driver');

  if (driver.isActive) {
    throw new ConflictError('ALREADY_ACTIVE', 'Driver is already active');
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: true },
  });

  await AuditService.log({
    actorId: adminId,
    actionType: 'driver.reactivated',
    entityType: 'driver',
    entityId: id,
    previousState: { isActive: false },
    newState: { isActive: true },
    ipAddress,
  });

  delete updated.passwordHash;
  return await fileService.signDriverUrls(updated);
}

/**
 * Permanently delete an archived driver without activity history.
 */
async function deleteDriverPermanently(id, adminId, ipAddress) {
  const driver = await prisma.user.findUnique({ where: { id } });
  if (!driver || driver.role !== 'driver') throw new NotFoundError('Driver');

  if (driver.isActive) {
    throw new ConflictError('DRIVER_MUST_BE_ARCHIVED', 'Driver must be archived before permanent deletion');
  }

  const [
    tripCount,
    shiftCount,
    inspectionCount,
    expenseCount,
    damageCount,
    locationCount,
    assignmentCount,
    auditCount,
  ] = await Promise.all([
    prisma.trip.count({ where: { driverId: id } }),
    prisma.shift.count({ where: { driverId: id } }),
    prisma.inspection.count({ where: { driverId: id } }),
    prisma.expense.count({ where: { driverId: id } }),
    prisma.damageReport.count({ where: { driverId: id } }),
    prisma.locationLog.count({ where: { driverId: id } }),
    prisma.vehicleAssignment.count({ where: { driverId: id } }),
    prisma.auditLog.count({ where: { actorId: id } }),
  ]);

  const hasActivity = [
    tripCount,
    shiftCount,
    inspectionCount,
    expenseCount,
    damageCount,
    locationCount,
    assignmentCount,
    auditCount,
  ].some(count => count > 0);

  if (hasActivity) {
    throw new ConflictError(
      'DRIVER_HAS_ACTIVITY',
      'Driver cannot be permanently deleted because related activity records exist'
    );
  }

  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { userId: id } }),
    prisma.userDevice.deleteMany({ where: { userId: id } }),
    prisma.rescueRequest.deleteMany({ where: { userId: id } }),
    prisma.identityVerification.deleteMany({ where: { driverId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);

  await AuditService.log({
    actorId: adminId,
    actionType: 'driver.deleted_permanently',
    entityType: 'driver',
    entityId: id,
    previousState: { isActive: false },
    newState: { deleted: true },
    ipAddress,
  });

  return { message: 'Driver permanently deleted' };
}

module.exports = {
  createDriver,
  getDrivers,
  getDriverById,
  updateDriver,
  deactivateDriver,
  reactivateDriver,
  deleteDriverPermanently,
};
