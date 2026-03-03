const request = require('supertest');
const app = require('../src/app');

describe('Fleet live fallback endpoint', () => {
  it('requires authentication on /admin/fleet/live', async () => {
    const res = await request(app).get('/api/v1/admin/fleet/live');
    expect(res.status).toBe(401);
  });
});
