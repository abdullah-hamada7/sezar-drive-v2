const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const prisma = require('./config/database');
const { attachIp } = require('./middleware/audit');
const errorHandler = require('./middleware/errorHandler');
const i18n = require('./middleware/i18n');

// Rate limit auth endpoints to mitigate brute force and token abuse
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.isProduction ? 120 : 2000,
  // Isolate budgets per auth endpoint so /auth/me and /auth/refresh
  // do not exhaust login/reset request quota.
  keyGenerator: (req) => `${rateLimit.ipKeyGenerator(req.ip)}:${req.path}`,
  // Keep brute-force controls on sensitive endpoints only.
  skip: (req) => ['/me', '/preferences', '/logout'].includes(req.path),
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Try again later.' } },
  standardHeaders: true,
  legacyHeaders: false,
});

// Biometric rate limiter for expensive Rekognition calls
const biometricLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: config.isProduction ? 10 : 200, // Very strict in production
  message: { 
    error: { 
      code: 'TOO_MANY_BIOMETRIC_REQUESTS', 
      message: 'Too many face verification attempts. Please try again in an hour.' 
    } 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Module routes
const authRoutes = require('./modules/auth/auth.routes');
const driverRoutes = require('./modules/driver/driver.routes');
const vehicleRoutes = require('./modules/vehicle/vehicle.routes');
const shiftRoutes = require('./modules/shift/shift.routes');
const tripRoutes = require('./modules/trip/trip.routes');
const inspectionRoutes = require('./modules/inspection/inspection.routes');
const expenseRoutes = require('./modules/expense/expense.routes');
const damageRoutes = require('./modules/damage/damage.routes');
const trackingRoutes = require('./modules/tracking/tracking.routes');
const reportRoutes = require('./modules/report/report.routes');
const statsRoutes = require('./modules/stats/stats.routes');
const verificationRoutes = require('./modules/verification/verification.routes');
const auditRoutes = require('./modules/audit/audit.routes');
const trackingService = require('./modules/tracking/tracking.service');
const adminRoutes = require('./modules/admin/admin.routes');
const violationRoutes = require('./modules/violation/violation.routes');

const app = express();

// Trust proxy only when behind a reverse proxy (e.g., Caddy)
const trustProxy = config.isProduction || ['1', 'true', 'yes'].includes(String(process.env.TRUST_PROXY || '').toLowerCase());
app.set('trust proxy', trustProxy ? 1 : false);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'https://*.s3.amazonaws.com'],
        connectSrc: ["'self'", 'https://*.s3.amazonaws.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);

// CORS configuration
const configuredOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowNullOrigin = process.env.CORS_ALLOW_NULL_ORIGIN !== 'false';

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (!config.isProduction && configuredOrigins.length === 0) return callback(null, true);
    if (configuredOrigins.includes('*') || configuredOrigins.includes(origin)) return callback(null, true);
    if (origin === 'null' && (allowNullOrigin || configuredOrigins.includes('null'))) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

if (config.nodeEnv !== 'test') {
  app.use(morgan('combined'));
}

app.use(attachIp);
app.use(i18n);

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/v1/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'not_ready', timestamp: new Date().toISOString() });
  }
});

app.use('/api/v1/auth/verify-device', biometricLimiter);
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/drivers', driverRoutes);
app.use('/api/v1/vehicles', vehicleRoutes);
app.use('/api/v1/shifts', shiftRoutes);
app.use('/api/v1/trips', tripRoutes);
app.use('/api/v1/inspections', inspectionRoutes);
app.use('/api/v1/expenses', expenseRoutes);
app.use('/api/v1/damage-reports', damageRoutes);
app.use('/api/v1/tracking', trackingRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/stats', statsRoutes);
app.use('/api/v1/verify', biometricLimiter, verificationRoutes);
app.use('/api/v1/audit-logs', auditRoutes);
app.use('/api/v1/admins', adminRoutes);
app.use('/api/v1/violations', violationRoutes);

// Spec-compatible aliases (existing modules reused)
app.use('/api/v1/admin/drivers', driverRoutes);
app.use('/api/v1/admin/trips', tripRoutes);
app.use('/api/v1/driver/trips', tripRoutes);
app.use('/api/v1/driver/shifts', shiftRoutes);
app.use('/api/v1/driver/expenses', expenseRoutes);
app.use('/api/v1/driver/damage', damageRoutes);

app.post('/api/v1/driver/location/batch', authenticateForAlias, async (req, res, next) => {
  try {
    if (req.user.role !== 'driver') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Driver role required' } });
    }
    await trackingService.batchUpdateLocations(
      req.user.id,
      req.body.locations || req.body.points || [],
      req.body.shiftId,
      req.body.tripId,
    );
    res.json({ message: 'Locations updated' });
  } catch (err) {
    next(err);
  }
});

app.get('/api/v1/admin/fleet/live', authenticateForAlias, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin role required' } });
    }
    const positions = await trackingService.getActiveDriverPositions();
    res.json(positions);
  } catch (err) {
    next(err);
  }
});

app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
});

app.use(errorHandler);

module.exports = app;

function authenticateForAlias(req, res, next) {
  const { authenticate, enforcePasswordChanged } = require('./middleware/auth');
  authenticate(req, res, (authErr) => {
    if (authErr) return next(authErr);
    enforcePasswordChanged(req, res, (pwdErr) => {
      if (pwdErr) return next(pwdErr);
      next();
    });
  });
}
