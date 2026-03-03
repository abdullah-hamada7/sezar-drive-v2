require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');
const fs = require('fs');

const shouldRunIntegration = ['1', 'true', 'yes'].includes(
  String(process.env.RUN_INTEGRATION_TESTS || '').toLowerCase()
);
const adminEmail = process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;
const hasAdminCreds = Boolean(adminEmail && adminPassword);
const describeIntegration = shouldRunIntegration && hasAdminCreds ? describe : describe.skip;

const logFile = 'test_debug.log';
if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
const log = (msg) => {
  try { fs.appendFileSync(logFile, msg + '\n'); } catch (e) {
    console.error('Logging failed:', e);
  }
};

describeIntegration('API Integration Tests (E2E)', () => {
  let adminToken;
  let driverToken;
  let driverId;
  let vehicleId;
  let shiftId;
  let tripId;

  // Set a longer timeout for the whole suite
  jest.setTimeout(30000);

  beforeAll(async () => {
    await prisma.$connect();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword });

    expect(res.status).toBe(200);
    adminToken = res.body.accessToken;
    log('Admin Login Success');

    // Clean start: Delete all test data with try-catch to handle missing models or constraints
    const cleanup = async () => {
      const models = [
        'locationLog', 'trip', 'vehicleAssignment', 'expense',
        'damagePhoto', 'damageReport', 'inspectionPhoto', 'inspection',
        'userDevice', 'refreshToken', 'identityVerification', 'shift'
      ];
      for (const model of models) {
        try {
          if (prisma[model]) await prisma[model].deleteMany({});
        } catch (e) {
          log(`Cleanup Warning for ${model}: ${e.message}`);
        }
      }
      try { await prisma.user.deleteMany({ where: { role: 'driver' } }); } catch (e) { log(e.message); }
      try { await prisma.vehicle.deleteMany({}); } catch (e) { log(e.message); }
    };

    await cleanup();
  });

  afterAll(async () => {
    try {
      if (tripId) await prisma.trip.deleteMany({ where: { id: tripId } });
      if (driverId) await prisma.vehicleAssignment.deleteMany({ where: { driverId } });
      if (shiftId) await prisma.shift.deleteMany({ where: { id: shiftId } });
      if (vehicleId) await prisma.vehicle.deleteMany({ where: { id: vehicleId } });

      if (driverId) {
        try { await prisma.refreshToken.deleteMany({ where: { userId: driverId } }); } catch (e) { log(`Refresh Token Cleanup Error: ${e.message}`); }
        try { await prisma.auditLog.deleteMany({ where: { actorId: driverId } }); } catch (e) { log(`Audit Log Cleanup Error: ${e.message}`); }
        await prisma.user.deleteMany({ where: { id: driverId } });
      }
    } catch (e) {
      log(`Cleanup Error: ${e.message}`);
    }
    await prisma.$disconnect();
  });

  test('Admin Flow: Create Driver & Vehicle', async () => {
    const driverRes = await request(app)
      .post('/api/v1/drivers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: `driver_${Date.now()}@test.com`,
        password: 'Password123!',
        name: 'Test Driver',
        phone: `555${Math.floor(Math.random() * 1000000)}`,
        licenseNumber: `LIC${Date.now()}`
      });

    expect(driverRes.status).toBe(201);
    driverId = driverRes.body.id;

    // IMPORTANT: In production, drivers must be verified by an admin.
    // For test flow, we manually verify the driver in the DB.
    await prisma.user.update({
      where: { id: driverId },
      data: { identityVerified: true }
    });

    // 3. Create Vehicle
    const vehicleRes = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plateNumber: `PLATE${Date.now()}`,
        model: 'Tesla Model 3',
        year: 2024,
        capacity: 4,
        qrCode: `QR${Date.now()}`
      });

    expect(vehicleRes.status).toBe(201);
    vehicleId = vehicleRes.body.id;
  });

  test('Driver Auth Flow: Login & Activate Shift', async () => {
    // 1. Driver Login
    // Since we just created the driver, we need their email. 
    // Wait, the driver_res has it.
    const driverEmail = (await prisma.user.findUnique({ where: { id: driverId } })).email;

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: driverEmail, password: 'Password123!' });

    expect(loginRes.status).toBe(200);
    driverToken = loginRes.body.accessToken;

    // 2. Start Shift (PendingVerification)
    const shiftRes = await request(app)
      .post('/api/v1/shifts')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ vehicleId });

    if (shiftRes.status !== 201) {
      log(`Create Shift Failed: ${shiftRes.status} - ${JSON.stringify(shiftRes.body)}`);
    }
    expect(shiftRes.status).toBe(201);
    shiftId = shiftRes.body.id;

    // 3. SECURE INVARIANT: Bypass Biometric & Vehicle Gate for test
    // Create assignment and update shift status directly in DB
    await prisma.vehicleAssignment.create({
      data: {
        driverId,
        vehicleId,
        shiftId,
        status: 'active',
        active: true,
        assignedAt: new Date()
      }
    });

    await prisma.shift.update({
      where: { id: shiftId },
      data: {
        status: 'Active',
        verificationStatus: 'VERIFIED',
        vehicleId,
        startedAt: new Date()
      }
    });
  });

  test('Operations Flow: Create Trip', async () => {
    // Debug: Check shift status
    if (shiftId) {
      const debugShift = await prisma.shift.findUnique({ where: { id: shiftId } });
      log(`Debug: verifying shift for driverId=${driverId}, shiftId=${shiftId}`);
      log(`Debug Shift Status from DB: ${JSON.stringify(debugShift)}`);
    } else {
      log('Debug: shiftId is undefined in Create Trip test');
    }

    // Explicitly verify the condition expected by trip.service
    const activeShiftCheck = await prisma.shift.findFirst({
      where: { driverId, status: 'Active' }
    });
    log(`Debug: activeShiftCheck result: ${JSON.stringify(activeShiftCheck)}`);

    const tripRes = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        driverId,
        vehicleId,
        shiftId,
        pickupLocation: 'Test Pickup',
        dropoffLocation: 'Test Dropoff',
        price: 100,
        scheduledTime: new Date().toISOString()
      });

    if (tripRes.status !== 201) log(`Create Trip Failed: ${JSON.stringify(tripRes.body)}`);
    expect(tripRes.status).toBe(201);
    tripId = tripRes.body.id;
  });

  test('Trip Execution: Start & Complete', async () => {
    // Ensure tripId is set
    expect(tripId).toBeDefined();

    const startRes = await request(app)
      .put(`/api/v1/trips/${tripId}/start`)
      .set('Authorization', `Bearer ${driverToken}`);

    if (startRes.status !== 200) log(`Start Trip Body: ${JSON.stringify(startRes.body)}`);
    expect(startRes.status).toBe(200);
    expect(startRes.body.status).toBe('IN_PROGRESS');

    const completeRes = await request(app)
      .put(`/api/v1/trips/${tripId}/complete`)
      .set('Authorization', `Bearer ${driverToken}`);

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.status).toBe('COMPLETED');
  });
});
