# DevOps & Deployment Setup

## Infrastructure

The project uses **Docker Compose** to orchestrate the services:

- **Backend**: Node.js (v22) with Prisma 7 + PostgreSQL Adapter
- **Frontend**: Nginx serving React (Vite build)
- **Database**: PostgreSQL 16 (RDS or Container)

## AWS Infrastructure (Terraform)

The production environment is managed via Terraform (`infrastructure/terraform/`):

- **VPC**: Scoped public/private subnets with Security Groups.
- **EC2**: Hardened Linux instance with Docker & IMDSv2 enforced.
- **S3**: Private bucket for media with Intelligent-Tiering and Versioning. Public access blocked. SSL mandated for all requests.
- **Secrets**: Automated generation (24-char DB passwords, 64-char JWT secrets).
- **Rekognition**: Biometric face comparison service.
- **IAM Roles**: Scoped policies for S3, Rekognition, and CloudWatch.

## Observability & Logging

- **Centralized Logging**: CloudWatch Agent is installed on the EC2 host.
- **Docker Logs**: Container logs are automatically shipped to `/sezar-drive/docker`.
- **System Logs**: Backup and deployment logs are shipped to `/sezar-drive/backups`.

## CI/CD Pipeline

- **GitHub Actions**: Automated workflow (`.github/workflows/ci.yml`) runs on push/PR to `main`.
- **Checks**: Linting, unit tests, Docker build validation, and Terraform plan/format checks.

## Data Protection & Backups

- **Database Backups**: Daily cron job. Backups are compressed and automatically uploaded to an S3 backup bucket.
- **Retention**: Indefinite (Forever)

## Configuration Files

- `docker-compose.yml`: Main orchestration file
- `backend/Dockerfile`: Multi-stage build for API & WebSocket server
- `frontend/Dockerfile`: Multi-stage build for React + Nginx
- `frontend/nginx.conf`: Nginx reverse proxy configuration

## Quick Start

1. **Start all services**:

   ```bash
   docker-compose up -d --build
   ```

2. **Database Setup** (First time only):

   ```bash
   # Run migrations
   docker-compose exec backend npx prisma migrate deploy

   # Seed initial data (Admin user + default expense categories)
   docker-compose exec backend npm run seed
   ```

3. **Access**:
   - Web App: [http://localhost](http://localhost)
   - API: [http://localhost/api/v1](http://localhost/api/v1)
   - Database: Port 5432 (mapped to host)

## Environment Variables

Ensure your environment variables are set. For Compose-based dev/prod, place them in a root `.env`.
For running the backend directly, you can use `backend/.env`.

- `DATABASE_URL`: `postgresql://postgres:postgres@postgres:5432/sezar_drive?schema=public&connection_limit=10&pool_timeout=10` (hostname `postgres` works on the internal docker network)
