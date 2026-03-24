const prisma = require('../../config/database');
const { NotFoundError, ConflictError, ValidationError, ForbiddenError } = require('../../errors');
const AuditService = require('../../services/audit.service');
const FileService = require('../../services/FileService');
const { notifyAdmins, notifyDriver } = require('../tracking/tracking.ws');

/**
 * Create an expense for a shift.
 */
async function createExpense(data, driverId, ipAddress) {
  const shiftId = data.shiftId;
  const tripId = data.tripId || null;
  const categoryId = data.categoryId || data.category;
  const amount = data.amount;
  const description = data.description;
  const receiptUrl = data.receiptUrl;

  if (parseFloat(amount) <= 0) {
    throw new ValidationError('Amount must be greater than zero', [{ path: 'amount', msg: 'INVALID_AMOUNT' }]);
  }

  // Verify shift belongs to driver
  const shift = await prisma.shift.findUnique({ where: { id: shiftId }, include: { driver: true } });
  if (!shift || shift.driverId !== driverId) {
    throw new ConflictError('INVALID_SHIFT', 'Invalid or inactive shift');
  }

  // Verify linked trip (optional)
  if (tripId) {
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip || trip.driverId !== driverId) {
      throw new ConflictError('INVALID_TRIP', 'Invalid trip selection');
    }
    if (trip.shiftId && trip.shiftId !== shiftId) {
      throw new ConflictError('TRIP_SHIFT_MISMATCH', 'Trip does not belong to selected shift');
    }
    const allowedExpenseTripStates = new Set(['ACCEPTED', 'IN_PROGRESS', 'COMPLETED']);
    if (!allowedExpenseTripStates.has(trip.status)) {
      throw new ConflictError('INVALID_TRIP_STATE', 'Expenses can only be linked to active or completed trips');
    }
  }

  // Verify category
  const category = await prisma.expenseCategory.findUnique({ where: { id: categoryId } });
  if (!category || !category.isActive) throw new NotFoundError('Expense category');

  const status = category.requiresApproval ? 'pending' : 'approved';

  const expense = await prisma.expense.create({
    data: {
      shiftId,
      tripId,
      driverId,
      categoryId,
      amount,
      description,
      receiptUrl,
      status,
    },
  });

  await AuditService.log({
    actorId: driverId,
    actionType: 'expense.created',
    entityType: 'expense',
    entityId: expense.id,
    newState: { amount, category: category.name, status, tripId },
    expenseId: expense.id,
    ipAddress,
  });

  if (status === 'pending') {
    notifyAdmins('expense_pending', 'New Expense Approval', `Driver ${shift.driver.name} submitted a EGP${amount} expense for ${category.name}.`, {
      expenseId: expense.id,
      status,
      tripId,
      driverId,
      categoryId,
    });
  } else {
    notifyAdmins('expense_update', 'Expense Submitted', `Driver ${shift.driver.name} submitted an expense for ${category.name}.`, {
      expenseId: expense.id,
      status,
      tripId,
      driverId,
      categoryId,
    });
  }

  notifyDriver(driverId, {
    type: 'expense_update',
    expenseId: expense.id,
    status,
    categoryId,
    amount,
  });

  return FileService.signExpense(expense);
}

/**
 * Get expenses with filters.
 */
async function getExpenses({
  page = 1,
  limit = 20,
  driverId,
  shiftId,
  tripId,
  status,
  tripSearch,
  categoryId,
  startDate,
  endDate,
  minAmount,
  maxAmount,
  hasReceipt,
  sortBy,
  sortOrder,
  expenseId,
}) {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;
  const skip = (pageNum - 1) * limitNum;

  const isTripSearchUuid = typeof tripSearch === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tripSearch);

  const tripSearchFilters = tripSearch
    ? [
      { pickupLocation: { contains: tripSearch, mode: 'insensitive' } },
      { dropoffLocation: { contains: tripSearch, mode: 'insensitive' } },
      ...(isTripSearchUuid ? [{ id: { equals: tripSearch } }] : []),
    ]
    : [];

  const createdAt = {};
  if (startDate) {
    const d = new Date(startDate);
    if (!Number.isNaN(d.getTime())) createdAt.gte = d;
  }
  if (endDate) {
    const d = new Date(endDate);
    if (!Number.isNaN(d.getTime())) createdAt.lte = d;
  }

  const amount = {};
  if (minAmount !== undefined && minAmount !== null && minAmount !== '') {
    const n = Number(minAmount);
    if (Number.isFinite(n)) amount.gte = n;
  }
  if (maxAmount !== undefined && maxAmount !== null && maxAmount !== '') {
    const n = Number(maxAmount);
    if (Number.isFinite(n)) amount.lte = n;
  }

  const where = {
    ...(expenseId && { id: expenseId }),
    ...(driverId && { driverId }),
    ...(shiftId && { shiftId }),
    ...(tripId && { tripId }),
    ...(categoryId && { categoryId }),
    ...(status && { status }),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
    ...(Object.keys(amount).length ? { amount } : {}),
    ...(hasReceipt === true || hasReceipt === 'true' ? { receiptUrl: { not: null } } : {}),
    ...(hasReceipt === false || hasReceipt === 'false' ? { receiptUrl: null } : {}),
    ...(tripSearch && {
      trip: {
        OR: tripSearchFilters,
      },
    }),
  };

  const SORT_ALLOWLIST = new Set(['createdAt', 'amount', 'status']);
  const normalizedSortBy = SORT_ALLOWLIST.has(String(sortBy)) ? String(sortBy) : 'createdAt';
  const normalizedSortOrder = String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';
  const orderBy = { [normalizedSortBy]: normalizedSortOrder };

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where, skip, take: limitNum,
      include: {
        category: { select: { id: true, name: true } },
        trip: { select: { id: true, pickupLocation: true, dropoffLocation: true, status: true, passengers: true } },
        driver: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
      },
      orderBy,
    }),
    prisma.expense.count({ where }),
  ]);

  const signedExpenses = await FileService.signExpenses(expenses);

  return { expenses: signedExpenses, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
}

/**
 * Admin bulk approves or rejects expenses.
 */
async function reviewExpensesBulk({ expenseIds, action, rejectionReason }, adminId, ipAddress) {
  const ids = Array.isArray(expenseIds) ? expenseIds.filter(Boolean) : [];
  if (ids.length === 0) {
    throw new ValidationError('No expenses selected', [{ path: 'expenseIds', msg: 'REQUIRED' }]);
  }
  if (ids.length > 200) {
    throw new ValidationError('Too many expenses selected', [{ path: 'expenseIds', msg: 'TOO_MANY' }]);
  }

  const status = (action === 'approve' || action === 'approved') ? 'approved' : 'rejected';
  if (status === 'rejected' && !rejectionReason) {
    throw new ValidationError('Rejection reason is required', [{ path: 'rejectionReason', msg: 'REQUIRED' }]);
  }

  const expenses = await prisma.expense.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true, driverId: true },
  });

  const pending = expenses.filter((e) => e.status === 'pending');
  const pendingIds = pending.map((e) => e.id);

  if (pendingIds.length === 0) {
    return { updated: 0, skipped: ids };
  }

  await prisma.expense.updateMany({
    where: { id: { in: pendingIds } },
    data: {
      status,
      reviewedBy: adminId,
      reviewedAt: new Date(),
      rejectionReason: status === 'rejected' ? rejectionReason : null,
    },
  });

  for (const id of pendingIds) {
    await AuditService.log({
      actorId: adminId,
      actionType: `expense.${status}`,
      entityType: 'expense',
      entityId: id,
      previousState: { status: 'pending' },
      newState: { status, rejectionReason: status === 'rejected' ? rejectionReason : null },
      ipAddress,
    });
  }

  // Notifications: best-effort, batched by driver.
  const byDriver = new Map();
  for (const e of pending) {
    if (!byDriver.has(e.driverId)) byDriver.set(e.driverId, []);
    byDriver.get(e.driverId).push(e.id);
  }
  for (const [driverId, updatedIds] of byDriver.entries()) {
    notifyDriver(driverId, {
      type: 'expense_reviewed',
      expenseIds: updatedIds,
      status,
      reason: status === 'rejected' ? rejectionReason : null,
    });
  }

  notifyAdmins(
    'expense_reviewed',
    'Expense Review Updated',
    `${pendingIds.length} expense(s) were ${status}.`,
    { expenseIds: pendingIds, status, actorId: adminId },
  );

  return { updated: pendingIds.length, skipped: ids.filter((id) => !pendingIds.includes(id)) };
}

/**
 * Update a pending expense (driver only).
 */
async function updateExpense(expenseId, data, driverId, ipAddress) {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) throw new NotFoundError('Expense');
  if (expense.driverId !== driverId) throw new ForbiddenError('FORBIDDEN', 'Not your expense');
  if (expense.status !== 'pending') {
    throw new ConflictError('CANNOT_MODIFY', 'Only pending expenses can be modified');
  }

  const previousState = { amount: expense.amount, description: expense.description };
  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      ...(data.amount && { amount: data.amount }),
      ...(data.description !== undefined && { description: data.description }),
    },
  });

  await AuditService.log({
    actorId: driverId,
    actionType: 'expense.updated',
    entityType: 'expense',
    entityId: expenseId,
    previousState,
    newState: data,
    ipAddress,
  });

  return FileService.signExpense(updated);
}

/**
 * Admin approves or rejects an expense.
 */
async function reviewExpense(expenseId, adminId, action, rejectionReason, ipAddress) {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) throw new NotFoundError('Expense');
  if (expense.status !== 'pending') {
    throw new ConflictError('INVALID_STATE', 'Expense is not in pending state');
  }

  const status = (action === 'approve' || action === 'approved') ? 'approved' : 'rejected';
  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      status,
      reviewedBy: adminId,
      reviewedAt: new Date(),
      rejectionReason: status === 'rejected' ? rejectionReason : null,
    },
  });

  await AuditService.log({
    actorId: adminId,
    actionType: `expense.${status}`,
    entityType: 'expense',
    entityId: expenseId,
    previousState: { status: 'pending' },
    newState: { status, rejectionReason },
    ipAddress,
  });

  // Real-time Notification
  notifyDriver(expense.driverId, {
    type: 'expense_update',
    expenseId,
    status,
    reason: rejectionReason,
  });

  notifyDriver(expense.driverId, {
    type: 'expense_reviewed',
    expenseId,
    status,
    reason: rejectionReason,
  });

  notifyAdmins(
    'expense_reviewed',
    'Expense Review Updated',
    `Expense ${expenseId} was ${status}.`,
    { expenseId, status, actorId: adminId }
  );

  return FileService.signExpense(updated);
}

// ─── Expense Categories ───────────────────────────

async function getCategories() {
  return prisma.expenseCategory.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
}

async function createCategory(data, adminId, ipAddress) {
  const category = await prisma.expenseCategory.create({
    data: {
      name: data.name,
      requiresApproval: data.requiresApproval || false,
    },
  });

  await AuditService.log({
    actorId: adminId,
    actionType: 'expense_category.created',
    entityType: 'expense_category',
    entityId: category.id,
    newState: data,
    ipAddress,
  });

  return category;
}

async function updateCategory(id, data, adminId, ipAddress) {
  const category = await prisma.expenseCategory.findUnique({ where: { id } });
  if (!category) throw new NotFoundError('Category');

  const updated = await prisma.expenseCategory.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.requiresApproval !== undefined && { requiresApproval: data.requiresApproval }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  await AuditService.log({
    actorId: adminId,
    actionType: 'expense_category.updated',
    entityType: 'expense_category',
    entityId: id,
    previousState: { name: category.name },
    newState: data,
    ipAddress,
  });

  return updated;
}

module.exports = {
  createExpense, getExpenses, updateExpense, reviewExpense,
  reviewExpensesBulk,
  getCategories, createCategory, updateCategory,
};
