const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const reportService = require('../src/modules/report/report.service');
const prisma = require('../src/config/database');

async function main() {
  console.log('--- Testing Report Formula ---');
  
  // Mock data setup would be complex with DB.
  // Instead, let's just create a quick unit test of the logic by mocking prisma response if possible, 
  // or just inserting temporary data.
  
  // Insert 1 Trip and 1 Expense
  const driver = await prisma.user.findFirst({ where: { role: 'driver' } });
  if (!driver) { console.log('No driver found'); return; }
  
  const v = await prisma.vehicle.findFirst();
  
  // Clean up old test data
  await prisma.trip.deleteMany({ where: { status: 'Completed', price: 1000 } });
  await prisma.expense.deleteMany({ where: { status: 'approved', amount: 200 } });
  
  await prisma.trip.create({
    data: {
      driverId: driver.id,
      vehicleId: v?.id,
      status: 'Completed',
      pickupLocation: 'A',
      dropoffLocation: 'B',
      actualEndTime: new Date(),
      price: 1000,
    }
  });
  
  await prisma.expense.create({
    data: {
      driverId: driver.id,
      amount: 200,
      status: 'approved',
      category: { create: { name: 'TestCat' } }, // simplified
      date: new Date(),
    }
  });
  
  const start = new Date();
  start.setHours(0,0,0,0);
  const end = new Date();
  end.setHours(23,59,59,999);
  
  console.log(`Created Trip: 1000, Expense: 200`);
  
  const report = await reportService.generateRevenueData({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    driverId: driver.id
  });
  
  const dSummary = report.driverSummaries.find(d => d.driverId === driver.id);
  console.log('Driver Summary:', dSummary);
  console.log('Net Revenue:', dSummary.netRevenue);
  
  if (Math.abs(dSummary.netRevenue - 800) < 0.1) {
      console.log('✅ Formula is (Revenue - Expenses) -> 1000 - 200 = 800');
  } else if (Math.abs(dSummary.netRevenue - 1200) < 0.1) {
      console.log('❌ Formula is (Revenue + Expenses) -> 1000 + 200 = 1200');
  } else {
      console.log('❓ Formula is something else');
  }
}

main().catch(console.error);
