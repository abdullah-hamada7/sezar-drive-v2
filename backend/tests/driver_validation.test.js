const request = require('supertest');
const app = require('../src/app');

// Mock Auth Middleware to bypass checks
jest.mock('../src/middleware/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 'admin-id', role: 'admin' };
    next();
  },
  enforcePasswordChanged: (req, res, next) => next(),
  authorize: () => (req, res, next) => next(),
  requireIdentityVerified: (req, res, next) => next(),
}));

// Mock Driver Service
jest.mock('../src/modules/driver/driver.service', () => ({
  createDriver: jest.fn().mockResolvedValue({ id: 'driver-123', name: 'Test Driver' }),
  updateDriver: jest.fn().mockResolvedValue({ id: 'driver-123', name: 'Updated Driver' }),
}));

// Mock Upload Middleware
jest.mock('../src/middleware/upload', () => ({
  createUploader: () => ({
    single: () => (req, res, next) => next(),
    fields: () => (req, res, next) => next(),
    array: () => (req, res, next) => next(),
  }),
}));

describe('Driver Validation', () => {
  describe('POST /api/v1/drivers', () => {
    it('should fail if phone number is not digits', async () => {
      const res = await request(app)
        .post('/api/v1/drivers')
        .send({
          name: 'Test Driver',
          email: 'test@example.com',
          phone: '123-abc-456', // Invalid
          licenseNumber: 'DL12345',
          password: 'password123'
        });
      
      expect(res.status).toBe(400); // Bad Request (Validation Error) (changed from 422 because app usually throws ValidationError which maps to 400 or 422 depending on error handler, checking express-validator)
      // Actually ValidationError usually maps to 400 in many setups, let's see.
      // If it fails, checks the body.
    });

    it('should fail if phone number is too short', async () => {
      const res = await request(app)
        .post('/api/v1/drivers')
        .send({
          name: 'Test Driver',
          email: 'test@example.com',
          phone: '12345', // Too short
          licenseNumber: 'DL12345',
          password: 'password123'
        });
      expect(res.status).not.toBe(201);
    });

    it('should fail if license number has special characters', async () => {
      const res = await request(app)
        .post('/api/v1/drivers')
        .send({
          name: 'Test Driver',
          email: 'test@example.com',
          phone: '1234567890',
          licenseNumber: 'DL@#$%', // Invalid
          password: 'password123'
        });
      expect(res.status).not.toBe(201);
    });

    it('should pass with valid data', async () => {
      const res = await request(app)
        .post('/api/v1/drivers')
        .send({
          name: 'Valid Driver',
          email: 'valid@example.com',
          phone: '1234567890',
          licenseNumber: 'DL12345',
          password: 'password123'
        });
      
      if (res.status !== 201) {
        console.log(res.body);
      }
      expect(res.status).toBe(201);
    });
  });

  describe('PUT /api/v1/drivers/:id', () => {
    const validId = '123e4567-e89b-12d3-a456-426614174000';
    it('should fail if password is too short', async () => {
      const res = await request(app)
        .put(`/api/v1/drivers/${validId}`)
        .send({
          name: 'Updated Driver',
          password: 'short'
        });
      expect(res.status).not.toBe(200);
    });

    it('should pass with valid password', async () => {
        const res = await request(app)
          .put(`/api/v1/drivers/${validId}`)
          .send({
            name: 'Updated Driver',
            password: 'newpassword123'
          });
        expect(res.status).toBe(200);
    });
  });
});
