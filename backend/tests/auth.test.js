const request = require('supertest');

/**
 * Auth Module Tests
 * Tests: login, forced password change, RBAC enforcement
 */
describe('Auth Module', () => {
  // Mock app — these tests validate route and middleware logic 
  // without requiring a running database
  let app;

  beforeAll(async () => {
    // Import app (without starting server)
    app = require('../src/app');
  });

  describe('POST /api/v1/auth/login', () => {
    it('should return 400 when email is missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ password: 'test123' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when password is missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@test.com' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'test123' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    it('should return 401 without authorization header', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .send({ currentPassword: 'old', newPassword: 'newpassword123' });

      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', 'Bearer invalid-token')
        .send({ currentPassword: 'old', newPassword: 'newpassword123' });

      expect(res.status).toBe(401);
    });
  });
});

describe('RBAC Enforcement', () => {
  let app;

  beforeAll(() => {
    app = require('../src/app');
  });

  describe('Admin-only endpoints require authentication', () => {
    const adminEndpoints = [
      ['GET', '/api/v1/drivers'],
      ['POST', '/api/v1/drivers'],
      ['GET', '/api/v1/vehicles'],
      ['POST', '/api/v1/vehicles'],
      ['GET', '/api/v1/shifts'],
      ['GET', '/api/v1/trips'],
      ['GET', '/api/v1/expenses'],
      ['GET', '/api/v1/audit-logs'],
    ];

    test.each(adminEndpoints)('%s %s should return 401 without token', async (method, path) => {
      const res = await request(app)[method.toLowerCase()](path);
      expect(res.status).toBe(401);
    });
  });

  describe('Protected endpoints reject invalid tokens', () => {
    const endpoints = [
      ['GET', '/api/v1/shifts'],
      ['POST', '/api/v1/shifts'],
    ];

    test.each(endpoints)('%s %s should return 401 with bad token', async (method, path) => {
      const res = await request(app)[method.toLowerCase()](path)
        .set('Authorization', 'Bearer fake-token-123');

      expect(res.status).toBe(401);
    });
  });
});
