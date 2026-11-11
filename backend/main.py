"""
TRIVAANA AI: Enterprise Voice Calling REST API Server
Outpero-parity AI Telecalling SaaS: AI Employees, Prompt Architect, Voice Library,
LiveKit Real-Time Voice Engine, 4 Calling Modes, Knowledge Base RAG, AI Actions,
Integrations, Compliance, Billing, and Super Admin.
"""

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import time

from core.config import settings
from core.rate_limit import RateLimitMiddleware
from database import init_db, get_connection
from database.seed import seed_demo_data
from routers.auth import router as auth_router
from routers.workspaces import router as workspaces_router
from routers.tenant import router as tenant_router
from routers.agents import router as agents_router
from routers.voices import router as voices_router
from routers.voice_engine import router as voice_engine_router
from routers.leads import router as leads_router
from routers.calls import router as calls_router
from routers.campaigns import router as campaigns_router
from routers.broadcasts import router as broadcasts_router
from routers.inbound import router as inbound_router
from routers.public_intake import router as public_intake_router
from routers.knowledge import router as knowledge_router
from routers.actions import router as actions_router
from routers.integrations import router as integrations_router
from routers.phone_numbers import router as phone_numbers_router
from routers.compliance import router as compliance_router
from routers.billing import router as billing_router
from routers.admin import router as admin_router
from routers.appointments import router as appointments_router
from routers.workflows import router as workflows_router
from routers.support import router as support_router
from routers.health import router as health_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    conn = get_connection()
    try:
        seed_demo_data(conn)
    finally:
        conn.close()
    yield


app = FastAPI(
    title="Trivaana AI Telephony & Calling Agent API",
    description="Enterprise Multilingual AI Telecalling SaaS with Real-Time Voice Engine, RAG Knowledge Base, Verifiable Integer-Paise Ledger, and TRAI Compliance",
    version="2.2.0-enterprise",
    lifespan=lifespan
)

app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Modular Routers
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(workspaces_router)
app.include_router(tenant_router)
app.include_router(agents_router)
app.include_router(voices_router)
app.include_router(voice_engine_router)
app.include_router(leads_router)
app.include_router(calls_router)
app.include_router(campaigns_router)
app.include_router(broadcasts_router)
app.include_router(inbound_router)
app.include_router(public_intake_router)
app.include_router(knowledge_router)
app.include_router(actions_router)
app.include_router(integrations_router)
app.include_router(phone_numbers_router)
app.include_router(compliance_router)
app.include_router(billing_router)
app.include_router(admin_router)
app.include_router(appointments_router)
app.include_router(workflows_router)
app.include_router(support_router)


try:
    from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST  # type: ignore

    HTTP_REQUESTS_TOTAL = Counter("trivaana_http_requests_total", "Total HTTP requests", ["method", "status"])
    HTTP_REQUEST_DURATION = Histogram("trivaana_http_request_duration_seconds", "HTTP request latency", ["method"])

    @app.middleware("http")
    async def prometheus_metrics_middleware(request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        HTTP_REQUESTS_TOTAL.labels(method=request.method, status=str(response.status_code)).inc()
        HTTP_REQUEST_DURATION.labels(method=request.method).observe(time.perf_counter() - start)
        return response

    @app.get("/metrics", include_in_schema=False)
    def metrics_endpoint():
        return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
except ImportError:
    pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
