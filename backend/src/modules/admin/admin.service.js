const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../../config/database');
const config = require('../../config');
const { ValidationError, NotFoundError, ConflictError } = require('../../errors');
const AuditService = require('../../services/audit.service');

async function createAdmin(data, superAdminId, ipAddress) {
    const { name, email, temporaryPassword, adminRole } = data;
    const password = data.password || temporaryPassword;

    if (!password) {
        throw new ValidationError('Password is required');
    }

    const uniqueConditions = [{ email }];
    if (data.phone) uniqueConditions.push({ phone: data.phone });

    const existing = await prisma.user.findFirst({
        where: { OR: uniqueConditions },
    });
    if (existing) {
        if (!existing.isActive) {
            throw new ConflictError('USER_DEACTIVATED', 'A deactivated user with this email or phone exists. Please reactivate them instead.');
        }

        if (existing.email === email) {
            throw new ConflictError('EMAIL_ALREADY_EXISTS', 'User with this email already exists');
        }
        throw new ConflictError('USER_ALREADY_EXISTS', 'User with this email or phone already exists');
    }

    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    const generatedPhone = `admin-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    let admin;
    try {
        admin = await prisma.user.create({
            data: {
                name,
                email,
                phone: generatedPhone, // Temporary unique phone for admins not requiring one
                passwordHash,
                role: 'admin',
                adminRole: adminRole || 'SYSTEM_ADMIN',
                mustChangePassword: true,
                identityVerified: true,
            },
        });
    } catch (err) {
        if (err?.code === 'P2002') {
            throw new ConflictError('USER_ALREADY_EXISTS', 'User with this email or phone already exists');
        }
        throw err;
    }

    await AuditService.log({
        actorId: superAdminId,
        actionType: 'admin.created',
        entityType: 'admin',
        entityId: admin.id,
        newState: { name, email, adminRole },
        ipAddress,
    });

    delete admin.passwordHash;
    return admin;
}

async function getAdmins({ page = 1, limit = 20, search = '' }) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;
    const where = {
        role: 'admin',
        isActive: true,
        ...(search && {
            OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ],
        }),
    };

    const [admins, total] = await Promise.all([
        prisma.user.findMany({
            where,
            select: {
                id: true, name: true, email: true, adminRole: true,
                isActive: true, createdAt: true,
            },
            skip,
            take: limitNum,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count({ where }),
    ]);

    return { admins, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
}

async function deactivateAdmin(id, superAdminId, ipAddress) {
    const admin = await prisma.user.findUnique({ where: { id } });
    if (!admin) throw new NotFoundError('Admin');

    if (admin.id === superAdminId) {
        throw new ConflictError('CANNOT_DELETE_SELF', 'Cannot deactivate yourself');
    }

    await prisma.user.update({ where: { id }, data: { isActive: false } });

    await AuditService.log({
        actorId: superAdminId,
        actionType: 'admin.deactivated',
        entityType: 'admin',
        entityId: id,
        previousState: { isActive: true },
        newState: { isActive: false },
        ipAddress,
    });

    return { message: 'Admin deactivated' };
}

async function reactivateAdmin(id, superAdminId, ipAddress) {
    const admin = await prisma.user.findUnique({ where: { id } });
    if (!admin) throw new NotFoundError('Admin');

    if (admin.isActive) {
        throw new ConflictError('ALREADY_ACTIVE', 'Admin is already active');
    }

    const updated = await prisma.user.update({
        where: { id },
        data: { isActive: true },
    });

    await AuditService.log({
        actorId: superAdminId,
        actionType: 'admin.reactivated',
        entityType: 'admin',
        entityId: id,
        previousState: { isActive: false },
        newState: { isActive: true },
        ipAddress,
    });

    delete updated.passwordHash;
    return updated;
}

module.exports = { createAdmin, getAdmins, deactivateAdmin, reactivateAdmin };
