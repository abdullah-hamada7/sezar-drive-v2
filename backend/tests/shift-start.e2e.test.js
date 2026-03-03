const request = require('supertest');
const app = require('../src/app');

describe('Driver shift start alias', () => {
  it('requires authentication on /driver/shifts/start', async () => {
    const res = await request(app).post('/api/v1/driver/shifts/start').send({});
    expect(res.status).toBe(401);
  });
});
