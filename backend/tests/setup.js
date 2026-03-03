// Jest test setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

// Mock FaceVerificationService
jest.mock('../src/services/FaceVerificationService', () => ({
  verify: jest.fn().mockResolvedValue({ status: 'VERIFIED', similarity: 95, matched: true })
}));
