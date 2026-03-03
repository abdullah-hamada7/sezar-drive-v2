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

  validatePasswordPolicy(password);

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
  });
  if (existing) {
    if (!existing.isActive) {
      // Reactivate and update existing soft-deleted driver
      const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          name,
          email, // potentially same
          phone, // potentially same
          passwordHash,
          licenseNumber,
          avatarUrl,
          idCardFront,
          idCardBack,
          isActive: true,
          mustChangePassword: true,
          identityVerified: !!(idCardFront && idCardBack), // Verify only if docs are provided
        },
      });

      await AuditService.log({
        actorId: adminId,
        actionType: 'driver.reactivated',
        entityType: 'driver',
        entityId: existing.id,
        newState: { name, email, phone, licenseNumber, isActive: true },
        ipAddress,
      });

      delete updated.passwordHash;
      return updated;
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
async function getDrivers({ page = 1, limit = 20, search = '' }) {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;
  const skip = (pageNum - 1) * limitNum;
  const where = {
    role: 'driver',
    isActive: true,
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ],
    }),
  };

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
      orderBy: { createdAt: 'desc' },
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

module.exports = { createDriver, getDrivers, getDriverById, updateDriver, deactivateDriver };
