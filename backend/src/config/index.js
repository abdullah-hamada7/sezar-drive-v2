require("dotenv").config();

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

const databaseUrl = process.env.DATABASE_URL;
if (isProduction && !databaseUrl) {
  throw new Error("DATABASE_URL must be set in production");
}

// In production, JWT_SECRET must be set explicitly — no default to prevent weak secrets
const jwtSecret = process.env.JWT_SECRET;
if (isProduction && (!jwtSecret || jwtSecret.length < 32)) {
  throw new Error("JWT_SECRET must be set and at least 32 characters in production");
}

// In production, never allow wildcard CORS from browsers.
if (isProduction && String(process.env.CORS_ORIGIN || '').includes('*')) {
  throw new Error("CORS_ORIGIN must not include '*' in production");
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  jwtSecret: jwtSecret || "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  nodeEnv,
  isProduction,
  databaseUrl,
  bcryptRounds: 12,
  maxFileSize: 15 * 1024 * 1024, // 15MB
  allowedImageTypes: ["image/jpeg", "image/png", "image/webp"],
  shiftAutoTimeoutHours: 14,
  trackingIntervalSeconds: 30,
  maxReportDays: 90,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  s3: {
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION || "us-east-1",
  },
};
