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

  // Verify category
  const category = await prisma.expenseCategory.findUnique({ where: { id: categoryId } });
  if (!category || !category.isActive) throw new NotFoundError('Expense category');

  const status = category.requiresApproval ? 'pending' : 'approved';

  const expense = await prisma.expense.create({
    data: {
      shiftId,
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
    newState: { amount, category: category.name, status },
    expenseId: expense.id,
    ipAddress,
  });

  if (status === 'pending') {
    notifyAdmins('expense_pending', 'New Expense Approval', `Driver ${shift.driver.name} submitted a EGP${amount} expense for ${category.name}.`, { expenseId: expense.id });
  }

  return FileService.signExpense(expense);
}

/**
 * Get expenses with filters.
 */
async function getExpenses({ page = 1, limit = 20, driverId, shiftId, status }) {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;
  const skip = (pageNum - 1) * limitNum;
  const where = {
    ...(driverId && { driverId }),
    ...(shiftId && { shiftId }),
    ...(status && { status }),
  };

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where, skip, take: limitNum,
      include: {
        category: { select: { id: true, name: true } },
        driver: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.expense.count({ where }),
  ]);

  const signedExpenses = await FileService.signExpenses(expenses);

  return { expenses: signedExpenses, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
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
    status,
    reason: rejectionReason
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
  getCategories, createCategory, updateCategory,
};
