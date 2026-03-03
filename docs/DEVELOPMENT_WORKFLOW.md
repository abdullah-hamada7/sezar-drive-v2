
# Development Workflow

This repo uses PostgreSQL + Prisma for schema migrations and seeding.

## Local (Docker Compose)

1. Create an `.env` in the repo root (used by `compose.yml`) with at least:

```bash
POSTGRES_PASSWORD=postgres
JWT_SECRET=dev-secret-change-me-dev-secret-change-me
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/sezar_drive?schema=public
```

2. Start services:

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

## Manual DB Commands (Backend)

From `backend/`:

```bash
npm install
npm run prisma:generate

# Apply migrations (safe for prod too)
npm run prisma:migrate:prod

# Seed (idempotent)
npm run seed
```

## Production Notes

- Prefer `prisma migrate deploy` (not `migrate dev`).
- Seed should typically be run once, intentionally (or keep `RUN_SEED_ON_STARTUP` disabled).
