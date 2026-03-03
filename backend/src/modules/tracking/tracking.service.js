const prisma = require('../../config/database');

/**
 * Store a GPS location update from a driver.
 */
async function updateLocation(driverId, data, shiftId, tripId) {
  const { latitude, longitude, speed, recordedAt } = data;

  // Update driver's last known position
  await prisma.user.update({
    where: { id: driverId },
    data: {
      lastKnownLat: latitude,
      lastKnownLng: longitude,
      lastLocationAt: new Date(recordedAt || Date.now()),
    },
  });

  // Store in location log
  await prisma.locationLog.create({
    data: {
      driverId,
      shiftId,
      tripId,
      latitude,
      longitude,
      speed,
      recordedAt: new Date(recordedAt || Date.now()),
    },
  });
}

/**
 * Batch store multiple location updates.
 */
async function batchUpdateLocations(driverId, locations, shiftId, tripId) {
  const data = locations.map((loc) => ({
    driverId,
    shiftId,
    tripId,
    latitude: loc.latitude,
    longitude: loc.longitude,
    speed: loc.speed || null,
    recordedAt: new Date(loc.recordedAt || Date.now()),
  }));

  await prisma.locationLog.createMany({ data });

  // Update last known from most recent
  const latest = locations[locations.length - 1];
  if (latest) {
    await prisma.user.update({
      where: { id: driverId },
      data: {
        lastKnownLat: latest.latitude,
        lastKnownLng: latest.longitude,
        lastLocationAt: new Date(latest.recordedAt || Date.now()),
      },
    });
  }
}

/**
 * Get all active driver positions (for admin map).
 */
async function getActiveDriverPositions() {
  return prisma.user.findMany({
    where: {
      role: 'driver',
      isActive: true,
      lastKnownLat: { not: null },
      shifts: { some: { status: 'Active' } },
    },
    select: {
      id: true,
      name: true,
      lastKnownLat: true,
      lastKnownLng: true,
      lastLocationAt: true,
      shifts: {
        where: { status: 'Active' },
        select: { id: true, vehicleId: true },
        take: 1,
      },
    },
  });
}

/**
 * Get location history for a shift or trip.
 */
async function getLocationHistory({ driverId, shiftId, tripId, startDate, endDate, limit = 1000 }) {
  const where = {
    ...(driverId && { driverId }),
    ...(shiftId && { shiftId }),
    ...(tripId && { tripId }),
    ...(startDate && endDate && {
      recordedAt: { gte: new Date(startDate), lte: new Date(endDate) },
    }),
  };

  return prisma.locationLog.findMany({
    where,
    orderBy: { recordedAt: 'asc' },
    take: limit,
  });
}

module.exports = { updateLocation, batchUpdateLocations, getActiveDriverPositions, getLocationHistory };
