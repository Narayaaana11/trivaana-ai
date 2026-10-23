"""
TRIVAANA AI: Billing & Integer-Paise Ledger Tests
"""

import pytest
from services.billing_service import BillingService, InsufficientBalanceError
from database.connection import get_connection

def test_pricing_catalog(client):
    resp = client.get("/api/billing/pricing")
    assert resp.status_code == 200
    data = resp.json()
    assert data["currency"] == "INR"
    assert data["tariffs"]["standard_ai_call_paise_per_min"] == 650
    assert data["tariffs"]["standard_ai_call_inr_per_min"] == 6.50
    assert data["tariffs"]["premium_ai_call_paise_per_min"] == 850
    assert data["billing_rules"]["rounding_increment_seconds"] == 30
    assert data["billing_rules"]["sac_code"] == "998313"

def test_calculate_call_cost_rounding():
    # 0 seconds / unconnected
    c0 = BillingService.calculate_call_cost(0, connected=False)
    assert c0["billable_seconds"] == 0
    assert c0["cost_paise"] == 0

    # 15 seconds connected -> rounds up to 30 seconds
    # (30 / 60) * 650 paise = 325 paise (₹3.25)
    c1 = BillingService.calculate_call_cost(15, rate_paise_per_min=650, connected=True)
    assert c1["billable_seconds"] == 30
    assert c1["cost_paise"] == 325

    # 45 seconds connected -> rounds up to 60 seconds
    # (60 / 60) * 650 paise = 650 paise (₹6.50)
    c2 = BillingService.calculate_call_cost(45, rate_paise_per_min=650, connected=True)
    assert c2["billable_seconds"] == 60
    assert c2["cost_paise"] == 650

    # 65 seconds connected -> rounds up to 90 seconds
    # (90 / 60) * 650 paise = 975 paise (₹9.75)
    c3 = BillingService.calculate_call_cost(65, rate_paise_per_min=650, connected=True)
    assert c3["billable_seconds"] == 90
    assert c3["cost_paise"] == 975

def test_sandbox_topup_and_ledger(client, demo_auth_headers):
    # Initial balance check
    t_before = client.get("/api/tenant", headers=demo_auth_headers).json()
    initial_balance = t_before["wallet_balance"]

    topup_resp = client.post("/api/billing/sandbox-topup", headers=demo_auth_headers, json={
        "amount_inr": 250.0
    })
    assert topup_resp.status_code == 200
    topup_data = topup_resp.json()
    assert topup_data["status"] == "success"
    assert topup_data["amount_paise"] == 25000
    assert topup_data["amount_inr"] == 250.0

    # Verify updated balance
    t_after = client.get("/api/tenant", headers=demo_auth_headers).json()
    assert t_after["wallet_balance"] == round(initial_balance + 250.0, 2)

    # Check transaction appears in ledger
    tx_resp = client.get("/api/billing/transactions", headers=demo_auth_headers)
    assert tx_resp.status_code == 200
    txs = tx_resp.json()["transactions"]
    matching = [tx for tx in txs if tx["id"] == topup_data["transaction_id"]]
    assert len(matching) == 1
    assert matching[0]["amount_paise"] == 25000

def test_idempotent_transaction_prevention(client, demo_auth_headers):
    conn = get_connection()
    try:
        t = client.get("/api/tenant", headers=demo_auth_headers).json()
        tenant_id = t["id"]
        idemp_key = "unique_key_test_123"

        # 1st credit
        res1 = BillingService.credit_wallet(
            conn=conn,
            tenant_id=tenant_id,
            amount_paise=10000,
            description="First credit",
            idempotency_key=idemp_key
        )
        assert res1["status"] == "success"

        # 2nd credit with same key -> MUST NOT duplicate credit
        res2 = BillingService.credit_wallet(
            conn=conn,
            tenant_id=tenant_id,
            amount_paise=10000,
            description="Duplicate credit attempt",
            idempotency_key=idemp_key
        )
        assert res2["status"] == "already_processed"
    finally:
        conn.close()
