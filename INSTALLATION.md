# TRIVAANA AI — Installation Guide

## Prerequisites
- Python 3.10+
- Node.js 20+ & npm
- Optional for production container stack: Docker & Docker Compose

## Local Development Setup

### 1. Backend
```bash
cd backend
python -m venv venv
# Windows: .\venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```
- Swagger / OpenAPI Docs: `http://127.0.0.1:8001/docs`
- Health Check: `http://127.0.0.1:8001/health`
- Integration Readiness: `http://127.0.0.1:8001/api/readiness`

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
- Application UI: `http://localhost:5173`
- Seeded Demo Login (dev mode): `demo@trivaana.ai` / `Trivaana@2026`

### 3. Docker Compose (PostgreSQL + pgvector, Redis, Backend, Worker, Frontend)
```bash
cp .env.example .env
docker compose up --build -d
```

