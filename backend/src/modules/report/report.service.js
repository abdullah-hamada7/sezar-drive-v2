const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const prisma = require('../../config/database');
const { ValidationError } = require('../../errors');

/**
 * Generate revenue report for a date range.
 */
async function generateRevenueData({ startDate, endDate, driverId }) {
  if (!startDate || !endDate) throw new ValidationError('Start and end dates required');

  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ValidationError('Invalid date format');
  }

  end.setHours(23, 59, 59, 999); // Set to end of the day

  const dayDiff = (end - start) / (1000 * 60 * 60 * 24);
  if (dayDiff > 90) throw new ValidationError('Date range cannot exceed 90 days');

  const where = {
    status: 'COMPLETED',
    actualEndTime: { gte: start, lte: end },
    ...(driverId && { driverId }),
  };

  const trips = await prisma.trip.findMany({
    where,
    include: {
      driver: { select: { id: true, name: true, email: true } },
      vehicle: { select: { id: true, plateNumber: true } },
    },
    orderBy: { actualEndTime: 'asc' },
  });

  if (trips.length === 0) {
    throw new ValidationError('REPORT_EMPTY_DATA', 'No completed trips found in this period');
  }


  // Get approved expenses in range
  const expenseWhere = {
    status: { equals: 'approved', mode: 'insensitive' },
    createdAt: { gte: start, lte: end },
    ...(driverId && { driverId }),
  };

  const expenses = await prisma.expense.findMany({
    where: expenseWhere,
    include: {
      category: { select: { name: true } },
      driver: { select: { id: true, name: true } },
    },
  });

  // Aggregate by driver
  const driverMap = {};
  for (const trip of trips) {
    const did = trip.driverId;
    if (!driverMap[did]) {
      driverMap[did] = {
        driverId: did,
        driverName: trip.driver.name,
        totalRevenue: 0,
        totalExpenses: 0,
        tripCount: 0,
        trips: [],
      };
    }
    driverMap[did].totalRevenue += parseFloat(trip.price);
    driverMap[did].tripCount += 1;
    driverMap[did].trips.push(trip);
  }

  for (const expense of expenses) {
    const did = expense.driverId;
    if (!driverMap[did]) {
      driverMap[did] = {
        driverId: did,
        driverName: expense.driver.name,
        totalRevenue: 0,
        totalExpenses: 0,
        tripCount: 0,
        trips: [],
      };
    }
    driverMap[did].totalExpenses += parseFloat(expense.amount);
  }

  const driverSummaries = Object.values(driverMap).map((d) => ({
    ...d,
    netRevenue: d.totalRevenue - d.totalExpenses,
  }));

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    totalRevenue: driverSummaries.reduce((s, d) => s + d.totalRevenue, 0),
    totalExpenses: driverSummaries.reduce((s, d) => s + d.totalExpenses, 0),
    netRevenue: driverSummaries.reduce((s, d) => s + d.netRevenue, 0),
    driverSummaries,
    tripCount: trips.length,
    trips,
    expenses,
  };
}

const REPORT_I18N = {
  en: {
    title: 'Fleet Management — Revenue Report',
    period: 'Period',
    summary: 'Summary',
    totalRevenue: 'Total Revenue',
    totalExpenses: 'Total Expenses',
    netRevenue: 'Net Revenue',
    totalTrips: 'Total Trips',
    driverBreakdown: 'Driver Breakdown',
    revenue: 'Revenue',
    expenses: 'Expenses',
    net: 'Net',
    trips: 'Trips',
    metric: 'Metric',
    value: 'Value',
    periodStart: 'Period Start',
    periodEnd: 'Period End',
    driversSheet: 'Drivers',
    tripsSheet: 'Trips',
    driver: 'Driver',
    vehicle: 'Vehicle',
    pickup: 'Pickup',
    dropoff: 'Dropoff',
    price: 'Price',
    status: 'Status',
    date: 'Date',
    fileName: 'revenue_report'
  }
};

function resolveLang() {
  return 'en';
}

function getReportStrings(lang) {
  return REPORT_I18N[resolveLang(lang)];
}

function getPdfFonts() {
  return { regular: 'Helvetica', bold: 'Helvetica-Bold' };
}

/**
 * Generate PDF report.
 */
async function generatePDF(reportData, res, { lang } = {}) {
  const strings = getReportStrings(lang);
  const fonts = getPdfFonts();
  const textAlign = 'left';
  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${strings.fileName}.pdf`);
  doc.pipe(res);

  if (fonts.regularPath) {
    doc.registerFont(fonts.regular, fonts.regularPath);
  }
  if (fonts.boldPath) {
    doc.registerFont(fonts.bold, fonts.boldPath);
  }

  // Header
  doc.fontSize(20).font(fonts.bold).text(strings.title, { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).font(fonts.regular).text(`${strings.period}: ${reportData.startDate.slice(0, 10)} - ${reportData.endDate.slice(0, 10)}`, { align: 'center' });
  doc.moveDown();

  // Summary table
  doc.fontSize(14).font(fonts.bold).text(strings.summary, { underline: true, align: textAlign });
  doc.moveDown(0.5);
  doc.fontSize(11).font(fonts.regular);
  doc.text(`${strings.totalRevenue}: ${reportData.totalRevenue.toFixed(2)} EGP`, { align: textAlign });
  doc.text(`${strings.totalExpenses}: ${reportData.totalExpenses.toFixed(2)} EGP`, { align: textAlign });
  doc.text(`${strings.netRevenue}: ${reportData.netRevenue.toFixed(2)} EGP`, { align: textAlign });
  doc.text(`${strings.totalTrips}: ${reportData.tripCount}`, { align: textAlign });
  doc.moveDown();

  // Driver breakdown
  doc.fontSize(14).font(fonts.bold).text(strings.driverBreakdown, { underline: true, align: textAlign });
  doc.moveDown(0.5);
  doc.fontSize(11).font(fonts.regular);
  for (const driver of reportData.driverSummaries) {
    doc.text(`${driver.driverName}: ${strings.revenue} ${driver.totalRevenue.toFixed(2)} EGP | ${strings.expenses} ${driver.totalExpenses.toFixed(2)} EGP | ${strings.net} ${driver.netRevenue.toFixed(2)} EGP | ${strings.trips}: ${driver.tripCount}`, { align: textAlign });
  }

  doc.end();
}

/**
 * Generate Excel report.
 */
async function generateExcel(reportData, res, { lang } = {}) {
  const strings = getReportStrings(lang);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Fleet Management System';

  // Summary sheet
  const summarySheet = workbook.addWorksheet(strings.summary);
  summarySheet.columns = [
    { header: strings.metric, key: 'metric', width: 30 },
    { header: strings.value, key: 'value', width: 25 },
  ];
  summarySheet.addRow({ metric: strings.periodStart, value: reportData.startDate.slice(0, 10) });
  summarySheet.addRow({ metric: strings.periodEnd, value: reportData.endDate.slice(0, 10) });
  summarySheet.addRow({ metric: `${strings.totalRevenue} (EGP)`, value: reportData.totalRevenue });
  summarySheet.addRow({ metric: `${strings.totalExpenses} (EGP)`, value: reportData.totalExpenses });
  summarySheet.addRow({ metric: `${strings.netRevenue} (EGP)`, value: reportData.netRevenue });
  summarySheet.addRow({ metric: strings.totalTrips, value: reportData.tripCount });

  // Drivers sheet
  const driverSheet = workbook.addWorksheet(strings.driversSheet);
  driverSheet.columns = [
    { header: strings.driver, key: 'name', width: 25 },
    { header: `${strings.revenue} (EGP)`, key: 'revenue', width: 20 },
    { header: `${strings.expenses} (EGP)`, key: 'expenses', width: 20 },
    { header: `${strings.net} (EGP)`, key: 'net', width: 20 },
    { header: strings.trips, key: 'trips', width: 15 },
  ];
  for (const d of reportData.driverSummaries) {
    driverSheet.addRow({
      name: d.driverName, revenue: d.totalRevenue,
      expenses: d.totalExpenses, net: d.netRevenue, trips: d.tripCount,
    });
  }

  // Trips sheet
  const tripsSheet = workbook.addWorksheet(strings.tripsSheet);
  tripsSheet.columns = [
    { header: strings.date, key: 'date', width: 25 },
    { header: strings.driver, key: 'driver', width: 25 },
    { header: strings.vehicle, key: 'vehicle', width: 20 },
    { header: strings.pickup, key: 'pickup', width: 35 },
    { header: strings.dropoff, key: 'dropoff', width: 35 },
    { header: strings.price, key: 'price', width: 15 },
    { header: strings.status, key: 'status', width: 15 },
  ];
  for (const t of reportData.trips) {
    tripsSheet.addRow({
      date: t.actualEndTime?.toISOString().slice(0, 19),
      driver: t.driver.name,
      vehicle: t.vehicle?.plateNumber || '-',
      pickup: t.pickupLocation,
      dropoff: t.dropoffLocation,
      price: parseFloat(t.price),
      status: t.status,
    });
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${strings.fileName}.xlsx`);
  await workbook.xlsx.write(res);
}

module.exports = { generateRevenueData, generatePDF, generateExcel };
