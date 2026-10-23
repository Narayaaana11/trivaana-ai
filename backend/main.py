"""
TRIVAANA AI: Enterprise Voice Calling REST API Server
Outpero-Grade Speed to Lead, Vernacular Dialects (Telugu/Hindi/English),
OSM Lead Scout, Batch Campaign Dialing & Zero-Float Integer-Paise Accounting.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from core.config import settings
from database import init_db, get_connection
from database.seed import seed_demo_data
from routers.auth import router as auth_router
from routers.tenant import router as tenant_router
from routers.agents import router as agents_router
from routers.leads import router as leads_router
from routers.calls import router as calls_router
from routers.campaigns import router as campaigns_router
from routers.billing import router as billing_router
from routers.health import router as health_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize SQLite schema, perform migrations, and seed demo tenant
    init_db()
    conn = get_connection()
    try:
        seed_demo_data(conn)
    finally:
        conn.close()
    yield
    # Shutdown logic (if any)

app = FastAPI(
    title="Trivaana AI Telephony & Calling Agent API",
    description="Enterprise Multilingual Telecalling SaaS with Real Telephony, Verifiable Ledger, and TRAI Compliance",
    version="2.1.0-enterprise",
    lifespan=lifespan
)

# Production-configured CORS middleware
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
app.include_router(tenant_router)
app.include_router(agents_router)
app.include_router(leads_router)
app.include_router(calls_router)
app.include_router(campaigns_router)
app.include_router(billing_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
