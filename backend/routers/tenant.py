"""
TRIVAANA AI: Tenant Profile & Database-Driven Analytics Router
Aggregates real persisted records under authenticated tenant scope with filtering; never invents metrics.
"""

from fastapi import APIRouter, Depends, Query
from typing import Any, Dict, List, Optional
import sqlite3
from database.connection import get_db
from core.dependencies import get_current_tenant
from core.config import settings

router = APIRouter(prefix="/api", tags=["Tenant & Analytics"])


@router.get("/tenant")
def get_tenant_details(tenant: dict = Depends(get_current_tenant)):
    paise = tenant.get("wallet_balance_paise", 0)
    return {
        "id": tenant["id"],
        "name": tenant["name"],
        "wallet_balance": paise / 100.0,
        "wallet_balance_paise": paise,
        "wallet_balance_inr": paise / 100.0,
        "currency": tenant.get("currency", "INR"),
        "rate_per_min": settings.RATE_STANDARD_PAISE_PER_MIN / 100.0,
        "rate_standard_paise": settings.RATE_STANDARD_PAISE_PER_MIN,
        "rate_premium_paise": settings.RATE_PREMIUM_PAISE_PER_MIN,
        "plan": tenant.get("plan", "growth"),
        "concurrency_limit": tenant.get("concurrency_limit", 10),
        "status": tenant.get("status", "active"),
        "gstin": tenant.get("gstin") or "",
        "created_at": tenant["created_at"]
    }


@router.get("/stats")
@router.get("/analytics")
def get_tenant_stats(
    days: int = Query(30, ge=1, le=365),
    agent_id: Optional[str] = None,
    campaign_id: Optional[str] = None,
    direction: Optional[str] = None,
    outcome: Optional[str] = None,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db)
):
    """
    Compute real business performance metrics and chart series from tenant-scoped database records.
    Empty accounts display truthful zeros rather than synthetic conversion rates.
    """
    cur = db.cursor()
    tenant_id = tenant["id"]

    # 1. AI Employees count
    cur.execute(
        """
        SELECT COUNT(*) as total_agents,
               COUNT(CASE WHEN status IN ('active', 'published') THEN 1 END) as active_agents
        FROM agents WHERE tenant_id = ?
        """,
        (tenant_id,),
    )
    a_row = cur.fetchone()

    # 2. Total leads
    cur.execute("SELECT COUNT(*) as total FROM leads WHERE tenant_id = ?", (tenant_id,))
    total_leads = cur.fetchone()["total"]

    # 3. Filtered calls query
    where = "WHERE tenant_id = ?"
    params: List[Any] = [tenant_id]
    if agent_id:
        where += " AND agent_id = ?"
        params.append(agent_id)
    if campaign_id:
        where += " AND campaign_id = ?"
        params.append(campaign_id)
    if direction:
        where += " AND direction = ?"
        params.append(direction)
    if outcome:
        where += " AND outcome LIKE ?"
        params.append(f"%{outcome}%")

    cur.execute(f"""
    SELECT COUNT(*) as total_calls,
           COUNT(CASE WHEN status IN ('completed', 'answered', 'connected') AND duration_seconds > 0 THEN 1 END) as connected_calls,
           COALESCE(SUM(duration_seconds), 0) as total_dur_sec,
           COALESCE(SUM(cost_paise), 0) as total_cost_paise,
           COUNT(CASE WHEN status IN ('initiated', 'ringing', 'connected') THEN 1 END) as active_calls,
           COUNT(CASE WHEN LOWER(COALESCE(outcome,'')) LIKE '%interested%' OR LOWER(COALESCE(outcome,'')) LIKE '%scheduled%' OR LOWER(COALESCE(outcome,'')) LIKE '%booked%' THEN 1 END) as interested_leads,
           COUNT(CASE WHEN LOWER(COALESCE(outcome,'')) LIKE '%scheduled%' OR LOWER(COALESCE(outcome,'')) LIKE '%booked%' THEN 1 END) as appointments_booked,
           AVG(CASE WHEN latency_ms IS NOT NULL THEN latency_ms END) as avg_latency_ms
    FROM calls
    {where}
    """, params)
    c_row = cur.fetchone()

    total_calls = c_row["total_calls"]
    connected_calls = c_row["connected_calls"]
    total_duration_sec = c_row["total_dur_sec"]
    total_duration_mins = round(total_duration_sec / 60.0, 1)
    avg_duration_sec = round(total_duration_sec / connected_calls, 1) if connected_calls > 0 else 0.0
    connection_rate = round((connected_calls / total_calls) * 100, 1) if total_calls > 0 else 0.0
    demos_booked = c_row["appointments_booked"]
    interested_leads = c_row["interested_leads"]
    conversion_rate_str = f"{round((demos_booked / total_calls) * 100, 1)}%" if total_calls > 0 else "0.0%"
    total_usage_paise = c_row["total_cost_paise"]

    # 4. Daily call series from real calls
    cur.execute(f"""
    SELECT substr(created_at, 1, 10) as day,
           COUNT(*) as total,
           COUNT(CASE WHEN status IN ('completed', 'answered', 'connected') AND duration_seconds > 0 THEN 1 END) as connected,
           COUNT(CASE WHEN status NOT IN ('completed', 'answered', 'connected') OR duration_seconds = 0 THEN 1 END) as unanswered,
           COALESCE(SUM(cost_paise), 0) as spend_paise
    FROM calls
    {where}
    GROUP BY substr(created_at, 1, 10)
    ORDER BY day ASC
    LIMIT ?
    """, [*params, days])
    daily_series = [
        {
            "date": r["day"],
            "total": r["total"],
            "connected": r["connected"],
            "unanswered": r["unanswered"],
            "spend_inr": round(r["spend_paise"] / 100.0, 2),
        }
        for r in cur.fetchall()
    ]

    # 5. Outcome distribution
    cur.execute(f"""
    SELECT COALESCE(outcome, 'Pending') as outcome, COUNT(*) as count
    FROM calls {where}
    GROUP BY COALESCE(outcome, 'Pending')
    ORDER BY count DESC
    """, params)
    outcome_distribution = [dict(r) for r in cur.fetchall()]

    # 6. Language distribution
    cur.execute(f"""
    SELECT COALESCE(language, 'unknown') as language, COUNT(*) as count
    FROM calls {where}
    GROUP BY COALESCE(language, 'unknown')
    ORDER BY count DESC
    """, params)
    language_distribution = [dict(r) for r in cur.fetchall()]

    # 7. AI Employee performance
    cur.execute("""
    SELECT a.id as agent_id, a.name as agent_name, a.language, a.status,
           COUNT(c.id) as total_calls,
           COUNT(CASE WHEN c.duration_seconds > 0 THEN 1 END) as connected_calls,
           COALESCE(SUM(c.duration_seconds), 0) as total_duration_seconds
    FROM agents a
    LEFT JOIN calls c ON c.agent_id = a.id AND c.tenant_id = a.tenant_id
    WHERE a.tenant_id = ?
    GROUP BY a.id
    ORDER BY total_calls DESC
    """, (tenant_id,))
    agent_performance = [dict(r) for r in cur.fetchall()]

    # 8. Campaign performance
    cur.execute("""
    SELECT id as campaign_id, name, status, total_contacts, placed, connected, interested_count, callback_count, failed
    FROM campaigns WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 20
    """, (tenant_id,))
    campaign_performance = [dict(r) for r in cur.fetchall()]

    wallet_paise = tenant.get("wallet_balance_paise", 0)
    voice_engine = (
        "Sarvam AI (bulbul:v4-flash)" if settings.has_sarvam
        else ("ElevenLabs Multilingual v2" if settings.has_elevenlabs
              else ("OpenAI TTS" if settings.has_openai else "Trivaana Vernacular Sandbox Engine"))
    )

    return {
        "wallet_balance_inr": round(wallet_paise / 100.0, 2),
        "wallet_balance_paise": wallet_paise,
        "total_ai_employees": a_row["total_agents"],
        "active_ai_employees": a_row["active_agents"],
        "total_leads": total_leads,
        "total_calls_placed": total_calls,
        "connected_calls": connected_calls,
        "connection_rate_pct": connection_rate,
        "total_duration_minutes": total_duration_mins,
        "total_duration_seconds": total_duration_sec,
        "average_call_duration_seconds": avg_duration_sec,
        "interested_leads": interested_leads,
        "demos_booked": demos_booked,
        "appointments_booked": demos_booked,
        "demo_conversion_rate": conversion_rate_str,
        "total_usage_paise": total_usage_paise,
        "total_usage_inr": round(total_usage_paise / 100.0, 2),
        "turn_taking_latency_ms": round(c_row["avg_latency_ms"]) if c_row["avg_latency_ms"] is not None else None,
        "active_concurrency": c_row["active_calls"],
        "voice_engine": voice_engine,
        "has_live_telephony": settings.has_exotel or settings.has_twilio,
        "daily_series": daily_series,
        "outcome_distribution": outcome_distribution,
        "language_distribution": language_distribution,
        "agent_performance": agent_performance,
        "campaign_performance": campaign_performance,
    }
