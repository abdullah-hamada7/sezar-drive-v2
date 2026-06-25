# Development Workflow

**Version:** 1.1  
**Date:** 2026-06-25  

This repo uses PostgreSQL + Prisma for schema migrations and seeding. Three application packages share one API: **backend**, **frontend** (React PWA), and **mobile** (Flutter).

---

## Local (Docker Compose)

### 1. Environment

Create an `.env` in the repo root (used by `compose.yml`) with at least:

```bash
POSTGRES_PASSWORD=postgres
JWT_SECRET=dev-secret-change-me-dev-secret-change-me-dev-secret
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/sezar_drive?schema=public
```

Optional AWS vars for S3/Rekognition in local testing — see `backend/.env.example` if present.

### 2. Start services

```bash
docker compose up -d
```

By default, `compose.yml` enables:

- `RUN_MIGRATIONS_ON_STARTUP=true` (runs `prisma migrate deploy`)
- `RUN_SEED_ON_STARTUP=true` (runs `npm run seed`)

The seed prints the admin credentials in non-production. You can control them via:

- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PHONE`
- `SEED_ADMIN_PASSWORD`
- `SEED_OVERWRITE_ADMIN_PASSWORD=true` (explicitly updates an existing admin password)
- `SEED_OVERWRITE_CONFIG=true` (explicitly overwrites `admin_config` defaults)

### 3. Verify

| Check | URL / command |
|-------|----------------|
| API health | http://localhost:3000/api/v1/health |
| Migrations applied | `docker compose logs backend \| grep -i migrate` |
| Admin login | Use seeded credentials from logs |

---

## Backend (Manual)

From `backend/`:

```bash
npm install
npm run prisma:generate

# Apply migrations (safe for prod too)
npm run prisma:migrate:prod

# Seed (idempotent)
npm run seed

# Development server (outside Docker)
npm run dev
```

### After pulling schema changes

Always apply migrations before testing features that depend on new tables:

```bash
cd backend && npx prisma migrate deploy
```

> **Recent:** Migration `20260625120000_add_notifications` creates the `notifications` table required by the mobile notification inbox and driver alert persistence.

---

## Frontend (React)

From `frontend/`:

```bash
npm install
npm run dev          # Vite dev server; proxies /api/v1 to backend
npm run build        # Production bundle
npm run test:e2e     # Playwright (requires running stack)
```

The dev server expects the backend at `localhost:3000`. Start Docker Compose first, or point the Vite proxy at your remote API in `vite.config.js`.

---

## Mobile (Flutter)

From `mobile/`:

```bash
flutter pub get
flutter analyze
flutter test
```

### Run against local backend (emulator)

```bash
flutter run --dart-define=FLAVOR=dev --dart-define=DEV_HOST=10.0.2.2
```

`10.0.2.2` maps to the host machine from the Android emulator.

### Production APK

```bash
flutter build apk --release
```

### Push notifications (local)

FCM requires Firebase project configuration. See [../mobile/docs/FCM_SETUP.md](../mobile/docs/FCM_SETUP.md). Without FCM, in-app notifications and WebSocket alerts still work when the app is open.

### UI journey tests (device)

Requires `adb` and an installed APK:

```bash
python3 test/journeys/run_journey.py test/journeys/driver_login_smoke.xml
```

See [../mobile/test/journeys/README.md](../mobile/test/journeys/README.md).

---

## Production Notes

- Prefer `prisma migrate deploy` (not `migrate dev`).
- Seed should typically be run once, intentionally (or keep `RUN_SEED_ON_STARTUP` disabled).
- Rebuild and redeploy the Flutter APK after mobile changes; the PWA auto-updates on next `npm run build` + deploy.
- After deploying backend with new migrations, verify notifications load: `GET /api/v1/notifications` as a driver user.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Mobile "Could not load notifications" | `notifications` table missing | `npx prisma migrate deploy` |
| Push not received on Android 13+ | Runtime permission not granted | Reinstall app; grant notification permission |
| Inspection photos lost mid-shift | Old tab-navigation bug | Use latest mobile build (pushed route + draft persistence) |
| WebSocket disconnects in dev | Backend restart / network | App reconnects automatically; shift state refetched silently |

---

## Change Log

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-02-17 | Initial Docker + Prisma workflow |
| 1.1 | 2026-06-25 | Added Flutter/mobile section, migration notes, troubleshooting |
