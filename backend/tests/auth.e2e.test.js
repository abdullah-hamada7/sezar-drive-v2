const request = require('supertest');
const app = require('../src/app');

describe('Auth endpoint contracts', () => {
  it('returns validation error for malformed login payload', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'bad-email',
      password: '',
    });

    expect(res.status).toBe(400);
  });
});
