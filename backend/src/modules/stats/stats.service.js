const prisma = require('../../config/database');

/**
 * Get revenue trends (daily revenue for the last 7 days).
 */
async function getRevenueStats() {
  // In a real production app with massive data, we'd use raw SQL for aggregation or a dedicated analytics DB.
  // For this scale, Prisma groupBy or raw query is fine.

  // For "Current Day Only":
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Group by hour for today's chart? Or just return total?
  // The frontend expects [{ name: 'Mon', value: 1000 }] format for a bar chart.
  // If we want "Daily Revenue" chart for *today*, maybe we show hourly breakdown?
  // Or if the requirement is just "the current day only", the existing chart might look weird if it expects 7 days.
  // BUT the PRD says: "Daily Revenue (Line chart) - Current Day View." => Implies hourly breakdown for today.

  // Let's query hourly revenue for today.
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
 * Uses a more efficient distinct count query.
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
  // Get Monday of current week
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
    // ISODOW: 1=Monday, 7=Sunday. index+1 matches this.
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

  // Create array for 24 hours
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
    todayTrips,
    todayExpenses,
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
    // Daily Stats
    prisma.trip.findMany({
      where: {
        status: 'COMPLETED',
        actualEndTime: { gte: today, lt: tomorrow }
      },
      select: { price: true }
    }),
    // Today's total expenses (approved + pending)
    prisma.expense.findMany({
      where: {
        createdAt: { gte: today, lt: tomorrow }
      },
      select: { amount: true }
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

  const todayRevenue = todayTrips.reduce((sum, t) => sum + Number(t.price), 0);
  const todayExpensesTotal = todayExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return {
    totalDrivers,
    totalVehicles,
    totalTrips,
    activeShifts,
    totalPendingExpenses: pendingExpenses, // Retain total pending for clarity if needed, but summary uses today
    todayPendingExpenses,
    pendingExpenses: todayPendingExpenses, // Keep original key but with filtered value for dashboard compatibility
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

  // Calculate active time from trips
  let activeMinutes = 0;
  for (const trip of shift.trips) {
    if (trip.status === 'COMPLETED' && trip.actualStartTime && trip.actualEndTime) {
      activeMinutes += (new Date(trip.actualEndTime) - new Date(trip.actualStartTime)) / (1000 * 60);
    } else if (trip.status === 'IN_PROGRESS' && trip.actualStartTime) {
      activeMinutes += (new Date() - new Date(trip.actualStartTime)) / (1000 * 60);
    }
  }

  // Safety guard against 0 or negative duration
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

module.exports = {
  getRevenueStats,
  getActivityStats,
  getDriverWeeklyStats,
  getDriverDailyStats,
  getSummaryStats,
  getDriverShiftStats,
  getDriverActivity
};


