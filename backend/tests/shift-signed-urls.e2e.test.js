const request = require('supertest');

// Mock Auth Middleware to bypass checks.
jest.mock('../src/middleware/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 'admin-id', role: 'admin' };
    next();
  },
  enforcePasswordChanged: (req, res, next) => next(),
  authorize: () => (req, res, next) => next(),
  requireIdentityVerified: (req, res, next) => next(),
  authorizeSuperAdmin: (req, res, next) => next(),
}));

const mockPrisma = {
  shift: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

jest.mock('../src/config/database', () => mockPrisma);

const mockFileService = {
  getUrl: jest.fn(async (key) => `signed:${key}`),
  signInspections: jest.fn(async (inspections) => {
    if (!Array.isArray(inspections)) return inspections;
    return Promise.all(inspections.map(async (i) => {
      const next = { ...i };
      if (Array.isArray(next.photos)) {
        next.photos = await Promise.all(next.photos.map(async (p) => ({
          ...p,
          photoUrl: `signed:${p.photoUrl}`,
        })));
      }
      return next;
    }));
  }),
  signExpenses: jest.fn(async (expenses) => {
    if (!Array.isArray(expenses)) return expenses;
    return Promise.all(expenses.map(async (e) => ({
      ...e,
      receiptUrl: e.receiptUrl ? `signed:${e.receiptUrl}` : e.receiptUrl,
    })));
  }),
};

jest.mock('../src/services/FileService', () => mockFileService);

const app = require('../src/app');

describe('Shift signed URL responses', () => {
  const shiftId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/v1/shifts/:id signs selfie, inspection photos, and expense receipts', async () => {
    mockPrisma.shift.findUnique.mockResolvedValue({
      id: shiftId,
      driverId: 'driver-1',
      startSelfieUrl: 'identity/selfie.jpg',
      driver: { id: 'driver-1', name: 'Driver One', email: 'd1@example.com' },
      vehicle: { id: 'veh-1' },
      assignments: [],
      inspections: [
        {
          id: 'insp-1',
          photos: [
            { id: 'p1', photoUrl: 'inspections/front.jpg' },
          ],
        },
      ],
      trips: [],
      expenses: [
        { id: 'exp-1', receiptUrl: 'receipts/r1.jpg' },
      ],
    });

    const res = await request(app)
      .get(`/api/v1/shifts/${shiftId}`);

    expect(res.status).toBe(200);
    expect(res.body.startSelfieUrl).toBe('signed:identity/selfie.jpg');
    expect(res.body.inspections[0].photos[0].photoUrl).toBe('signed:inspections/front.jpg');
    expect(res.body.expenses[0].receiptUrl).toBe('signed:receipts/r1.jpg');

    expect(mockFileService.getUrl).toHaveBeenCalledWith('identity/selfie.jpg');
    expect(mockFileService.signInspections).toHaveBeenCalledTimes(1);
    expect(mockFileService.signExpenses).toHaveBeenCalledTimes(1);
  });
});
