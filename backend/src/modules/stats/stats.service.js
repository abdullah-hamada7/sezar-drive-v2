const prisma = require('../../config/database');

/**
 * Get revenue trends (daily revenue for the last 7 days).
 */
async function getRevenueStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Query hourly revenue for today.
  const rawRevenue = await prisma.$queryRaw`
    SELECT 
      EXTRACT(HOUR FROM actual_end_time) as hour, 
      SUM(price) as total 
    FROM trips 
    WHERE status = 'COMPLETED' 
      AND actual_end_time >= ${today}
      AND actual_end_time < ${tomorrow}
    GROUP BY EXTRACT(HOUR FROM actual_end_time)
    ORDER BY hour ASC
  `;

  const result = [];
  // 00:00 to 23:00
  for (let i = 0; i < 24; i++) {
    const match = rawRevenue.find(r => Number(r.hour) === i);
    result.push({
      name: `${i}:00`,
      value: match ? Number(match.total) : 0
    });
  }

  return result;
}

/**
 * Get driver activity stats (Active vs Offline).
 */
async function getActivityStats() {
  const totalDrivers = await prisma.user.count({ where: { role: 'driver', isActive: true } });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Use groupBy/count to avoid fetching records
  const activeCountResult = await prisma.shift.groupBy({
    by: ['driverId'],
    where: {
      OR: [
        { createdAt: { gte: today, lt: tomorrow } },
        { closedAt: { gte: today, lt: tomorrow } },
        {
          createdAt: { lt: today },
          closedAt: null
        },
        {
          createdAt: { lt: today },
          closedAt: { gt: today }
        }
      ]
    },
  });

  const activeCount = activeCountResult.length;

  return [
    { name: 'Active Today', value: activeCount },
    { name: 'Offline', value: Math.max(0, totalDrivers - activeCount) }
  ];
}

/**
 * Get weekly revenue for a specific driver.
 */
async function getDriverWeeklyStats(driverId) {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));
  monday.setHours(0, 0, 0, 0);

  const rawRevenue = await prisma.$queryRaw`
    SELECT 
      EXTRACT(ISODOW FROM actual_end_time) as day_num, 
      SUM(price) as total 
    FROM trips 
    WHERE status = 'COMPLETED' 
      AND driver_id = ${driverId}::uuid
      AND actual_end_time >= ${monday}
    GROUP BY EXTRACT(ISODOW FROM actual_end_time), date_trunc('day', actual_end_time)
    ORDER BY date_trunc('day', actual_end_time) ASC
  `;

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const result = days.map((d, index) => {
    const match = rawRevenue.find(r => Number(r.day_num) === index + 1);
    return {
      day: d,
      amount: match ? Number(match.total) : 0
    };
  });

  return result;
}

/**
 * Get daily revenue (hourly) for a specific driver.
 */
async function getDriverDailyStats(driverId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rawRevenue = await prisma.$queryRaw`
    SELECT 
      EXTRACT(HOUR FROM actual_end_time) as hour_num, 
      SUM(price) as total 
    FROM trips 
    WHERE status = 'COMPLETED' 
      AND driver_id = ${driverId}::uuid
      AND actual_end_time >= ${today}
    GROUP BY EXTRACT(HOUR FROM actual_end_time)
    ORDER BY hour_num ASC
  `;

  const result = Array.from({ length: 24 }, (_, i) => {
    const match = rawRevenue.find(r => Number(r.hour_num) === i);
    return {
      hour: `${i}:00`,
      amount: match ? Number(match.total) : 0
    };
  });

  return result;
}

async function getSummaryStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    totalDrivers,
    totalVehicles,
    totalTrips,
    activeShifts,
    pendingExpenses,
    pendingVerifications,
    pendingDamagesTotal,
    todayTripsAggr,
    todayExpensesAggr,
    todayPendingExpenses,
    todayDamages
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'driver', isActive: true } }),
    prisma.vehicle.count({ where: { isActive: true } }),
    prisma.trip.count(),
    prisma.shift.count({ where: { status: 'Active' } }),
    prisma.expense.count({ where: { status: 'pending' } }),
    prisma.identityVerification.count({ where: { status: 'pending' } }),
    prisma.damageReport.count({ where: { status: 'reported' } }),
    // Daily Stats - use aggregate for efficiency
    prisma.trip.aggregate({
      where: {
        status: 'COMPLETED',
        actualEndTime: { gte: today, lt: tomorrow }
      },
      _sum: { price: true }
    }),
    // Today's total expenses (approved + pending)
    prisma.expense.aggregate({
      where: {
        createdAt: { gte: today, lt: tomorrow }
      },
      _sum: { amount: true }
    }),
    // Today's pending expenses count
    prisma.expense.count({
      where: {
        status: 'pending',
        createdAt: { gte: today, lt: tomorrow }
      }
    }),
    prisma.damageReport.count({
      where: { createdAt: { gte: today, lt: tomorrow } }
    })
  ]);

  const todayRevenue = todayTripsAggr._sum.price ? Number(todayTripsAggr._sum.price) : 0;
  const todayExpensesTotal = todayExpensesAggr._sum.amount ? Number(todayExpensesAggr._sum.amount) : 0;

  return {
    totalDrivers,
    totalVehicles,
    totalTrips,
    activeShifts,
    totalPendingExpenses: pendingExpenses,
    todayPendingExpenses,
    pendingExpenses: todayPendingExpenses,
    pendingVerifications,
    pendingDamages: pendingDamagesTotal,
    todayRevenue,
    todayExpenses: todayExpensesTotal,
    todayDamages
  };
}

/**
 * Get shift performance breakdown for a specific driver.
 */
async function getDriverShiftStats(driverId) {
  const shift = await prisma.shift.findFirst({
    where: { driverId, status: 'Active' },
    include: { trips: true }
  });

  if (!shift || !shift.startedAt) {
    return [
      { name: 'Active', value: 0, color: '#00E676' },
      { name: 'Idle', value: 100, color: '#161B22' }
    ];
  }

  const shiftDurationMinutes = (new Date() - new Date(shift.startedAt)) / (1000 * 60);

  let activeMinutes = 0;
  for (const trip of shift.trips) {
    if (trip.status === 'COMPLETED' && trip.actualStartTime && trip.actualEndTime) {
      activeMinutes += (new Date(trip.actualEndTime) - new Date(trip.actualStartTime)) / (1000 * 60);
    } else if (trip.status === 'IN_PROGRESS' && trip.actualStartTime) {
      activeMinutes += (new Date() - new Date(trip.actualStartTime)) / (1000 * 60);
    }
  }

  const activePercent = shiftDurationMinutes > 0
    ? Math.min(100, Math.round((activeMinutes / shiftDurationMinutes) * 100))
    : (activeMinutes > 0 ? 100 : 0);

  const idlePercent = Math.max(0, 100 - activePercent);

  return [
    { name: 'Active', value: activePercent, color: '#00E676' },
    { name: 'Idle', value: idlePercent, color: '#161B22' },
  ];
}

/**
 * Get recent activity feed for a driver.
 */
async function getDriverActivity(driverId, limit = 10) {
  const [trips, expenses] = await Promise.all([
    prisma.trip.findMany({
      where: { driverId },
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.expense.findMany({
      where: { shift: { driverId } },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { category: true }
    })
  ]);

  const activity = [
    ...trips.map(t => ({
      id: `trip-${t.id}`,
      type: 'trip',
      title: `Trip to ${t.dropoffLocation}`,
      amount: Number(t.price),
      status: t.status,
      timestamp: t.createdAt
    })),
    ...expenses.map(e => ({
      id: `exp-${e.id}`,
      type: 'expense',
      title: e.category?.name || 'Expense',
      amount: -Number(e.amount),
      status: e.status,
      timestamp: e.createdAt
    }))
  ];

  return activity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
}

/**
 * Get driver daily report with violation deductions.
 */
async function getDriverDailyReport(driverId, date) {
  const targetDate = date ? new Date(date) : new Date();
  targetDate.setHours(0, 0, 0, 0);
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);

  const [tripsAgg, violationsAgg, cashAgg, uncollectedCashAgg] = await Promise.all([
    prisma.trip.aggregate({
      where: {
        driverId,
        status: 'COMPLETED',
        actualEndTime: { gte: targetDate, lt: nextDate }
      },
      _sum: { price: true },
      _count: { id: true }
    }),
    prisma.trafficViolation.aggregate({
      where: {
        driverId,
        date: { gte: targetDate, lt: nextDate }
      },
      _sum: { fineAmount: true }
    }),
    prisma.trip.aggregate({
      where: {
        driverId,
        status: 'COMPLETED',
        paymentMethod: 'CASH',
        actualEndTime: { gte: targetDate, lt: nextDate },
      },
      _sum: { price: true },
      _count: { id: true },
    }),
    prisma.trip.aggregate({
      where: {
        driverId,
        status: 'COMPLETED',
        paymentMethod: 'CASH',
        cashCollectedAt: null,
        actualEndTime: { gte: targetDate, lt: nextDate },
      },
      _sum: { price: true },
      _count: { id: true },
    }),
  ]);

  const tripRevenue = tripsAgg._sum.price ? Number(tripsAgg._sum.price) : 0;
  const tripCount = tripsAgg._count.id || 0;
  const totalFines = violationsAgg._sum.fineAmount ? Number(violationsAgg._sum.fineAmount) : 0;

  const cashToCollectTotal = cashAgg._sum.price ? Number(cashAgg._sum.price) : 0;
  const cashTripsCount = cashAgg._count.id || 0;
  const uncollectedCashTotal = uncollectedCashAgg._sum.price ? Number(uncollectedCashAgg._sum.price) : 0;
  const uncollectedCashTripsCount = uncollectedCashAgg._count.id || 0;
  const cashCollectedTotal = Math.max(0, cashToCollectTotal - uncollectedCashTotal);
  const cashCollectedTripsCount = Math.max(0, cashTripsCount - uncollectedCashTripsCount);

  return {
    driverId,
    date: targetDate.toISOString(),
    tripsCompleted: tripCount,
    tripRevenue,
    totalFines,
    netRevenue: tripRevenue - totalFines,
    cashTripsCount,
    cashToCollectTotal,
    cashCollectedTripsCount,
    cashCollectedTotal,
    uncollectedCashTripsCount,
    uncollectedCashTotal
  };
}

/**
 * Get all drivers' daily reports for a date.
 */
async function getAllDriversDailyReport(date) {
  const targetDate = date ? new Date(date) : new Date();
  targetDate.setHours(0, 0, 0, 0);
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);

  const drivers = await prisma.user.findMany({
    where: { role: 'driver', isActive: true },
    select: { id: true, name: true }
  });

  const [tripsAggByDriver, violationsAggByDriver, cashAggByDriver, uncollectedCashAggByDriver] = await Promise.all([
    prisma.trip.groupBy({
      by: ['driverId'],
      where: {
        status: 'COMPLETED',
        actualEndTime: { gte: targetDate, lt: nextDate }
      },
      _sum: { price: true },
      _count: { id: true }
    }),
    prisma.trafficViolation.groupBy({
      by: ['driverId'],
      where: {
        date: { gte: targetDate, lt: nextDate }
      },
      _sum: { fineAmount: true }
    }),
    prisma.trip.groupBy({
      by: ['driverId'],
      where: {
        status: 'COMPLETED',
        paymentMethod: 'CASH',
        actualEndTime: { gte: targetDate, lt: nextDate }
      },
      _sum: { price: true },
      _count: { id: true }
    }),
    prisma.trip.groupBy({
      by: ['driverId'],
      where: {
        status: 'COMPLETED',
        paymentMethod: 'CASH',
        cashCollectedAt: null,
        actualEndTime: { gte: targetDate, lt: nextDate }
      },
      _sum: { price: true },
      _count: { id: true }
    })
  ]);

  const tripMap = Object.fromEntries(tripsAggByDriver.map(t => [t.driverId, { revenue: Number(t._sum.price) || 0, count: t._count.id || 0 }]));
  const violationMap = Object.fromEntries(violationsAggByDriver.map(v => [v.driverId, Number(v._sum.fineAmount) || 0]));
  const cashMap = Object.fromEntries(cashAggByDriver.map(t => [t.driverId, { total: Number(t._sum.price) || 0, count: t._count.id || 0 }]));
  const uncollectedCashMap = Object.fromEntries(uncollectedCashAggByDriver.map(t => [t.driverId, { total: Number(t._sum.price) || 0, count: t._count.id || 0 }]));

  return drivers.map(driver => ({
    driverId: driver.id,
    driverName: driver.name,
    date: targetDate.toISOString().split('T')[0],
    tripsCompleted: tripMap[driver.id]?.count || 0,
    tripRevenue: tripMap[driver.id]?.revenue || 0,
    totalFines: violationMap[driver.id] || 0,
    netRevenue: (tripMap[driver.id]?.revenue || 0) - (violationMap[driver.id] || 0),
    cashTripsCount: cashMap[driver.id]?.count || 0,
    cashToCollectTotal: cashMap[driver.id]?.total || 0,
    uncollectedCashTripsCount: uncollectedCashMap[driver.id]?.count || 0,
    uncollectedCashTotal: uncollectedCashMap[driver.id]?.total || 0,
    cashCollectedTripsCount: Math.max(0, (cashMap[driver.id]?.count || 0) - (uncollectedCashMap[driver.id]?.count || 0)),
    cashCollectedTotal: Math.max(0, (cashMap[driver.id]?.total || 0) - (uncollectedCashMap[driver.id]?.total || 0)),
  }));
}

module.exports = {
  getRevenueStats,
  getActivityStats,
  getDriverWeeklyStats,
  getDriverDailyStats,
  getSummaryStats,
  getDriverShiftStats,
  getDriverActivity,
  getDriverDailyReport,
  getAllDriversDailyReport
};
