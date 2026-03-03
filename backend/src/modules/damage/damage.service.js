const prisma = require('../../config/database');
const { NotFoundError, ValidationError } = require('../../errors');
const AuditService = require('../../services/audit.service');
const FileService = require('../../services/FileService');
const { notifyAdmins, notifyDriver } = require('../tracking/tracking.ws');

/**
 * Create a damage report. Auto-locks the vehicle.
 */
async function createDamageReport(data, driverId, ipAddress) {
  const { vehicleId, tripId, shiftId, description } = data;

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new NotFoundError('Vehicle');

  const driver = await prisma.user.findUnique({ where: { id: driverId } });

  const report = await prisma.damageReport.create({
    data: { vehicleId, driverId, tripId, shiftId, description },
  });

  // Auto-lock vehicle
  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: { status: 'damaged' },
  });

  await AuditService.log({
    actorId: driverId,
    actionType: 'damage.reported',
    entityType: 'damage_report',
    entityId: report.id,
    newState: { vehicleId, description, vehicleStatus: 'damaged' },
    ipAddress,
  });

  notifyAdmins('damage_reported', 'Vehicle Damage Reported!', `Driver ${driver?.name || 'Unknown'} reported damage on vehicle ${vehicle.plateNumber}. Vehicle has been locked.`, { reportId: report.id });

  return report;
}

/**
 * Upload damage photo.
 */
async function uploadDamagePhoto(reportId, photoUrl, driverId) {
  const report = await prisma.damageReport.findUnique({ where: { id: reportId } });
  if (!report || report.driverId !== driverId) throw new NotFoundError('Damage report');

  const photo = await prisma.damagePhoto.create({
    data: { damageReportId: reportId, photoUrl },
  });

  return { ...photo, photoUrl: await FileService.getUrl(photo.photoUrl) };
}

/**
 * Admin reviews damage report.
 */
async function reviewDamageReport(reportId, adminId, action, ipAddress) {
  const report = await prisma.damageReport.findUnique({ where: { id: reportId } });
  if (!report) throw new NotFoundError('Damage report');

  let newStatus;
  if (action === 'acknowledge' || action === 'acknowledged') newStatus = 'acknowledged';
  else if (action === 'maintenance') newStatus = 'maintenance';
  else if (action === 'resolve' || action === 'resolved' || action === 'closed') newStatus = 'resolved';
  else throw new ValidationError('Invalid action');

  const updated = await prisma.damageReport.update({
    where: { id: reportId },
    data: {
      status: newStatus,
      reviewedBy: adminId,
      ...(newStatus === 'resolved' && { resolvedAt: new Date() }),
    },
  });

  // If resolved, unlock vehicle
  if (newStatus === 'resolved') {
    // Check no other open damage reports for same vehicle
    const otherReports = await prisma.damageReport.count({
      where: { vehicleId: report.vehicleId, status: { notIn: ['resolved'] }, id: { not: reportId } },
    });
    if (otherReports === 0) {
      await prisma.vehicle.update({
        where: { id: report.vehicleId },
        data: { status: 'available' },
      });
    }
  } else if (newStatus === 'maintenance') {
    await prisma.vehicle.update({
      where: { id: report.vehicleId },
      data: { status: 'maintenance' },
    });
  }

  await AuditService.log({
    actorId: adminId,
    actionType: `damage.${newStatus}`,
    entityType: 'damage_report',
    entityId: reportId,
    previousState: { status: report.status },
    newState: { status: newStatus },
    ipAddress,
  });

  // Real-time Notification
  notifyDriver(report.driverId, {
    type: 'damage_update',
    status: newStatus,
    reportId
  });

  notifyAdmins(
    'damage_reviewed',
    'Damage Report Updated',
    `Damage report ${reportId} was ${newStatus}.`,
    { reportId, status: newStatus, actorId: adminId }
  );

  return FileService.signDamageReport(updated);
}

/**
 * Get damage reports with filters.
 */
async function getDamageReports({ page = 1, limit = 20, vehicleId, status }) {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;
  const skip = (pageNum - 1) * limitNum;
  const where = {
    ...(vehicleId && { vehicleId }),
    ...(status && { status }),
  };

  const [reports, total] = await Promise.all([
    prisma.damageReport.findMany({
      where, skip, take: limitNum,
      include: {
        photos: true,
        driver: { select: { id: true, name: true } },
        vehicle: { select: { id: true, plateNumber: true } },
        reviewer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.damageReport.count({ where }),
  ]);

  const signedReports = await FileService.signDamageReports(reports);

  return { reports: signedReports, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
}

module.exports = { createDamageReport, uploadDamagePhoto, reviewDamageReport, getDamageReports };
