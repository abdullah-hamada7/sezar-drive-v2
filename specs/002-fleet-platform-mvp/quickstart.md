# Quickstart: Local Development & Testing

**Feature**: 002-fleet-platform-mvp

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Native environment (Android Studio / Expo Go) for mobile

## Local Setup

1. **Spin up Infrastructure:**

   ```bash
   cd infra/
   docker-compose up -d
   ```

   > Starts PostgreSQL, Redis, and optionally LocalStack (for local S3 emulation).

2. **Database Migrations (Prisma):**

   ```bash
   cd apps/api
   npx prisma migrate dev
   ```

3. **Start Backend API:**

   ```bash
   npm run start:dev
   ```

4. **Start React Admin Web:**

   ```bash
   cd apps/admin-web
   npm run dev
   ```

5. **Start Driver Mobile App:**

   ```bash
   cd apps/driver-mobile
   npm run android
   ```

## Key Test Scenarios to Verify

1. **Authentication Flow**:
   - Create a driver in Admin dashboard.
   - Login on mobile with temporary credentials and change password.

2. **Shift Initialization (State Machine)**:
   - Scan QR Code (can be simulated via a debug button in dev environment).
   - Take a selfie to match face.
   - Upload 4 photo inspections.
   - Verify shift becomes `ACTIVE`.

3. **Trip Lifecycle (Concurrency)**:
   - Admin assigns a trip.
   - Driver accepts and starts the trip.
   - Send simultaneous overlapping requests to `POST /trips/:id/accept` to ensure only one succeeds and the other returns `409 Conflict`.

4. **Websocket Fallback**:
   - Turn off Wi-Fi on local machine momentarily or stop the local Redis container.
   - Verify the admin dashboard falls back to standard HTTP polling within 10 seconds for real-time tracking updates.
