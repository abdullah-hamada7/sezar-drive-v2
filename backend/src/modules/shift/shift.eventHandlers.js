const prisma = require('../../config/database');
const eventBus = require('../../services/eventBus');
const vehicleService = require('../vehicle/vehicle.service');
const shiftService = require('./shift.service');

function register() {
  eventBus.on('vehicle:qrScanned', async ({ vehicle, driverId, clientIp }) => {
    let shift = await prisma.shift.findFirst({
      where: { driverId, status: { in: ['PendingVerification', 'Active'] } },
      orderBy: { createdAt: 'desc' }
    });

    if (!shift) {
      shift = await shiftService.createShift(driverId, clientIp);
    }

    const assignment = await vehicleService.assignVehicle(
      vehicle.id, driverId, shift.id, driverId, clientIp
    );

    await prisma.shift.update({
      where: { id: shift.id },
      data: { vehicleId: vehicle.id }
    });

    return { assignment, shift };
  });
}

module.exports = { register };
