# TRIVAANA AI — Production Deployment Guide

## 1. Environment Hardening
- Set `ENVIRONMENT=production` and `DEBUG=false`.
- Generate a strong 64+ character `JWT_SECRET` (`python -c "import secrets; print(secrets.token_hex(32))"`). Startup rejects default/short secrets in production.
- Configure explicit `ALLOWED_ORIGINS` (never wildcard with credentials).
- Keep `ALLOW_DEMO_SEEDING=false` and `ALLOW_SANDBOX_TOPUP=false` in production.

## 2. Container Deployment
```bash
cp .env.example .env
# Fill production credentials in .env
docker compose up --build -d
```
- `postgres`: PostgreSQL 16 with `pgvector` extension enabled.
- `redis`: Queue & state cache.
- `backend`: FastAPI server on port `8001` with `/health` and `/api/readiness` probes.
- `worker`: Background campaign & webhook processor (`python -m worker.tasks`).
- `frontend`: Nginx serving the Vite production build and proxying `/api/` to `backend:8001`.

## 3. Backups & Monitoring
- Schedule daily `pg_dump` backups of the `trivaana` database and snapshot S3 media storage.
- Monitor `/health` and `/api/readiness` from your load balancer or uptime monitor.

