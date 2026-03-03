const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Dummy Test Driver Generation...');

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const email = `test_driver_${timestamp}@fleet.com`;
    const password = 'Driver123!';
    const passwordHash = await bcrypt.hash(password, 12);

    // 1. Create User
    console.log(`  👤 Creating user: ${email}`);
    const user = await prisma.user.create({
      data: {
        email,
        phone: `+9665${timestamp.toString().slice(-8)}`,
        name: `Test Driver ${timestamp.toString().slice(-4)}`,
        passwordHash,
        role: 'driver',
        licenseNumber: `DL-${timestamp}`,
        mustChangePassword: false, // Set to false so user can login immediately
        identityVerified: true,
        isActive: true,
        languagePreference: 'en',
      }
    });

    // 2. Find an available vehicle
    console.log('  🚘 Finding available vehicle...');
    let vehicle = await prisma.vehicle.findFirst({
      where: { status: 'available', isActive: true }
    });

    if (!vehicle) {
      console.log('  ⚠️ No available vehicle found. Creating a temporary one...');
      vehicle = await prisma.vehicle.create({
        data: {
          plateNumber: `TEST-${timestamp.toString().slice(-4)}`,
          model: 'Tesla Model S',
          year: 2024,
          capacity: 4,
          qrCode: `QR-TEST-${timestamp}`,
          status: 'available',
        }
      });
    }
    console.log(`  ✅ Using vehicle: ${vehicle.plateNumber}`);

    // 3. Create Shift
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
    console.log('  🔗 Assigning vehicle to shift...');
    await prisma.vehicleAssignment.create({
      data: {
        shiftId: shift.id,
        vehicleId: vehicle.id,
        driverId: user.id,
        active: true,
        assignedAt: new Date(),
      }
    });

    // 5. Create Dummy Inspection
    console.log('  📋 Creating completed inspection...');
    const inspection = await prisma.inspection.create({
      data: {
        shiftId: shift.id,
        vehicleId: vehicle.id,
        driverId: user.id,
        type: 'start_shift',
        status: 'completed',
        mileage: 1000,
        checklistData: {
          lights: true,
          tires: true,
          brakes: true,
          oil: true,
        },
        completedAt: new Date(),
      }
    });

    // Add 4 dummy photos
    const directions = ['front', 'back', 'left', 'right'];
    for (const direction of directions) {
      await prisma.inspectionPhoto.create({
        data: {
          inspectionId: inspection.id,
          direction,
          photoUrl: `https://placeholder.com/${direction}.jpg`,
        }
      });
    }

    // 6. Update Vehicle Status
    console.log('  🔒 Marking vehicle as in_use...');
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { status: 'in_use' }
    });

    console.log('\n✨ Dummy Driver Generated Successfully!');
    console.log('----------------------------------------');
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Driver ID: ${user.id}`);
    console.log(`Shift ID:  ${shift.id}`);
    console.log(`Vehicle:   ${vehicle.plateNumber}`);
    console.log('----------------------------------------');
    console.log('You can now log in with these credentials.');

  } catch (error) {
    console.error('\n❌ Error generating dummy driver:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
