const request = require('supertest');
const app = require('../src/app');

describe('Driver provision endpoint', () => {
  it('rejects unauthenticated admin driver creation', async () => {
    const res = await request(app).post('/api/v1/admin/drivers').send({
      name: 'Test Driver',
      email: 'driver@example.com',
      phone: '+10000000001',
      licenseNumber: 'ABC123',
      temporaryPassword: 'Temp12345',
    });

    expect(res.status).toBe(401);
  });
});
