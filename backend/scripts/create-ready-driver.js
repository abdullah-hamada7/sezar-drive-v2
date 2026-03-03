const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Ready-to-Test Driver Generation...');

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const email = `ready_driver_${timestamp}@fleet.com`;
    const password = 'Driver123!';
    const passwordHash = await bcrypt.hash(password, 12);

    // 1. Create User (Fully Verified)
    console.log(`  👤 Creating user: ${email}`);
    const user = await prisma.user.create({
      data: {
        email,
        phone: `+201${timestamp.toString().slice(-8)}`,
        name: `Ready Driver ${timestamp.toString().slice(-4)}`,
        passwordHash,
        role: 'driver',
        licenseNumber: `DL-READY-${timestamp}`,
        mustChangePassword: false,
        identityVerified: true,
        isActive: true,
        languagePreference: 'en',
      }
    });

    // 2. Find/Create an available vehicle
    let vehicle = await prisma.vehicle.findFirst({
      where: { status: 'available', isActive: true }
    });

    if (!vehicle) {
      vehicle = await prisma.vehicle.create({
        data: {
          plateNumber: `VHL-${timestamp.toString().slice(-4)}`,
          model: 'Toyota Hiace',
          year: 2023,
          capacity: 14,
          qrCode: `QR-READY-${timestamp}`,
          status: 'available',
        }
      });
    }
    console.log(`  ✅ Using vehicle: ${vehicle.plateNumber}`);

    // 3. Create Active Shift
    console.log('  🕒 Creating active shift...');
    const shift = await prisma.shift.create({
      data: {
        driverId: user.id,
        vehicleId: vehicle.id,
        status: 'Active',
        startedAt: new Date(),
        verificationStatus: 'VERIFIED',
      }
    });

    // 4. Create Vehicle Assignment
    await prisma.vehicleAssignment.create({
      data: {
        shiftId: shift.id,
        vehicleId: vehicle.id,
        driverId: user.id,
        active: true,
        assignedAt: new Date(),
      }
    });

    // 5. Create Completed Inspection
    const inspection = await prisma.inspection.create({
      data: {
        shiftId: shift.id,
        vehicleId: vehicle.id,
        driverId: user.id,
        type: 'start_shift',
        status: 'completed',
        mileage: 5000,
        checklistData: { lights: true, tires: true, brakes: true, oil: true },
        completedAt: new Date(),
      }
    });

    // Add dummy inspection photos
    const directions = ['front', 'back', 'left', 'right'];
    for (const dir of directions) {
      await prisma.inspectionPhoto.create({
        data: {
          inspectionId: inspection.id,
          direction: dir,
          photoUrl: `https://placeholder.pics/svg/300/verify/000000/${dir}`,
        }
      });
    }

    // 6. Update Vehicle Status
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { status: 'in_use' }
    });

    console.log('\n✨ Ready-to-Test Driver Generated Successfully!');
    console.log('----------------------------------------');
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Driver ID: ${user.id}`);
    console.log('----------------------------------------');
    console.log('NOTE: Since "Device Security" is enabled, you will still need to verify your device ONCE when you login.');
    console.log('OR you can run: node scripts/verify-device.js ' + email + ' AFTER your first login attempt.');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
