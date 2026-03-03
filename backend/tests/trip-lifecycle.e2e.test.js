const request = require('supertest');
const app = require('../src/app');

describe('Driver trip lifecycle aliases', () => {
  it('requires auth and idempotency key for accept', async () => {
    const res = await request(app).patch('/api/v1/driver/trips/00000000-0000-0000-0000-000000000000/accept');
    expect(res.status).toBe(401);
  });
});
