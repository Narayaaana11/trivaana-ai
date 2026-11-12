# TRIVAANA AI — Production Deployment Readiness (`HEAD d1d4319`)

**Audit Date:** 2026-11-11  
**Commit:** `d1d4319b47a9fa3bbcec2ac02b4a7eca63e92fff`  
**Deployment Verdict:** **NO-GO for Production** (`Sandbox / Local Demo Only` until P0 security, billing, voice, PostgreSQL, worker, and IaC blockers are resolved and verified in staging).

---

## 1. Container, Worker & Compose Audit

| Component | File(s) | Status | Critical Gaps & Fixes Required |
|---|---|---|---|
| **Backend API** | `backend/Dockerfile`, `docker-compose.yml:27-57` | `PARTIALLY_WORKING` | Uses `uvicorn main:app --host 0.0.0.0 --port 8001` with `HEALTHCHECK` on `/health`. **Gap (`P2`):** `docker-compose.yml:36-37` embeds fallback `JWT_SECRET` (`47` chars) and `ENCRYPTION_MASTER_KEY` that bypass `validate_production_security()` (`config.py:286-293`). Also bundles heavy `livekit-agents` + `torch`-adjacent deps in `backend/requirements.txt:24-26` across all 3 Python images. |
| **Background Worker** | `workers/Dockerfile`, `docker-compose.yml:59-83`, `workers/campaigns/dispatcher.py`, `backend/worker/tasks.py` | `BROKEN` (`P1`) | `workers/Dockerfile:12` executes `CMD ["python", "/app/workers/campaigns/dispatcher.py"]` (a synchronous DB polling loop `run_worker_loop()`), **not** a Celery worker (`celery -A worker.tasks worker`). Yet `docker-compose.yml:72` injects `REDIS_URL`, causing `tasks.py:38` & `dispatcher.py:21` to enqueue delayed calls/webhooks into Redis via `celery_app.send_task` **with zero Celery workers running to consume them**. Also lacks `HEALTHCHECK` and has leading whitespace on `Dockerfile:1`. |
| **Voice Engine** | `voice-engine/Dockerfile`, `voice-engine/agents/worker.py`, `backend/voice_engine/livekit_agent_worker.py` | `BROKEN` (`P1`) | `voice-engine/Dockerfile:12` executes `CMD ["python", "/app/voice-engine/agents/worker.py"]` without a LiveKit `cli.run_app(...)` subcommand (`start` / `dev`), causing Click/LiveKit CLI exit/usage errors if booted without overrides. Lacks `HEALTHCHECK`. |
| **Frontend & Nginx** | `frontend/Dockerfile`, `frontend/nginx.conf`, `docker-compose.yml:85-101` | `PARTIALLY_WORKING` | Multi-stage Node 20 -> Nginx Alpine build. `nginx.conf` sets `limit_req_zone` on `/api/auth/` (`30r/m`) & `/api/public/` (`60r/m`), WebSocket proxy headers on `/api/`, and `try_files` SPA fallback. Lacks container `HEALTHCHECK` and TLS termination (expected behind ALB/LB). |
| **Postgres & Redis** | `docker-compose.yml:2-25` | `NOT_VERIFIED` | Uses `pgvector/pgvector:pg16` + `redis:7-alpine` with healthchecks. Not verified on this host (`docker`/`psql`/`redis-cli` not installed). |

---

## 2. Terraform Infrastructure Foundation (`infrastructure/terraform/`)

- **Files:** `infrastructure/terraform/main.tf` (`66` lines), `variables.tf` (`15` lines).
- **Status:** `STUBBED` / Skeleton Only (`P1` for cloud deployment).
- **What Exists:** `aws_ecs_cluster`, `aws_s3_bucket` (versioned + AES256 + public access block), `aws_sqs_queue` (`campaign_jobs` + `campaign_dlq`), `aws_secretsmanager_secret`, `aws_cloudwatch_log_group`.
- **What Is Missing:**
  1. Networking: VPC, public/private subnets, NAT gateways, security groups.
  2. Data Layer: RDS PostgreSQL (`pgvector`), ElastiCache Redis, automated backup/PITR policies.
  3. Compute & Ingress: ECR repositories, IAM task/execution roles, ECS task definitions & services (`backend`, `worker`, `voice-engine`, `frontend`), ALB with HTTPS ACM certificates, autoscaling policies.
  4. Architecture mismatch: Terraform provisions `aws_sqs_queue` (`campaign_jobs`), whereas application code in `workers/` & `backend/worker/tasks.py` uses Redis/Celery + SQLite/Postgres polling (zero `boto3` SQS code exists).

---

## 3. CI/CD Pipeline Audit (`.github/workflows/ci.yml`)

- **Current Steps:**
  1. `backend-and-postgres`: boots `pgvector/pgvector:pg16` service, runs `alembic upgrade head` against `DATABASE_URL=postgresql://...`, then runs `python -m pytest -v tests`.
  2. `frontend`: runs `npm ci`, `npm run lint`, `npm run test`, `npm run build`.
- **Critical CI Gap (`P1`):** Lines `37-39` run `pytest` **without setting `DATABASE_URL`**, so all 61 backend tests execute against ephemeral SQLite (`conftest.py:14-19`). Consequently, CI gives a false green signal while hiding the `P0` PostgreSQL `MAX(a, b)` crash (`call_service.py:163`) and missing `UNIQUE` constraints (`postgres_pgvector_schema.sql`).
- **Missing CI Gates:** Docker image build checks, `terraform fmt/validate`, Playwright Chromium E2E tests, and dependency/SAST vulnerability scanning (`pip-audit` / `npm audit`).

---

## 4. Production Environment & Security Readiness Checklist

| Requirement | Current State | Blocking? |
|---|---|---|
| `ENVIRONMENT=production` enforced with fail-closed startup | Defaults to `"development"` (`config.py:60`); `ENCRYPTION_MASTER_KEY` not checked in `validate_production_security()` | **YES (`P1`)** |
| Secrets separated (`JWT_SECRET`, `ENCRYPTION_MASTER_KEY`, no compose defaults) | Compose defaults pass `validate_production_security()` (`docker-compose.yml:36-37`) | **YES (`P2`)** |
| Real PostgreSQL + `pgvector` test execution & RLS activation | `CallService` crashes on Postgres; RLS `SET LOCAL` never called; 4 `UNIQUE` constraints missing | **YES (`P0`)** |
| Worker topology aligned (`Celery` + `Redis` vs DB polling) | `workers/Dockerfile` runs DB loop while `REDIS_URL` triggers unconsumed `celery_app.send_task` | **YES (`P1`)** |
| LiveKit worker CLI & SIP trunk config | `voice-engine/Dockerfile` misses `start` arg; `LIVEKIT_SIP_CONFIG` unused | **YES (`P1`)** |
| Payments & Emergency Kill Switch | Live Razorpay `NameError`; unguarded sandbox fallback; kill switch ignored | **YES (`P0`)** |
| Observability (`/health`, `/api/readiness`, `/metrics`, Sentry, Langfuse) | `/metrics` & `/api/readiness` unauthenticated (`P3`); Langfuse/Sentry SDKs wired cleanly in config (`P2` verification needed in staging) | Partial |

