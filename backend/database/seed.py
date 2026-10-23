"""
TRIVAANA AI: Database Seeding Engine
Initializes isolated demo tenant workspace, vernacular agents, and audit ledger.
"""

import sqlite3
from datetime import datetime, timezone
from core.security import hash_password, hash_api_key

DEMO_TENANT_ID = "tenant_demo_enterprise"
DEMO_USER_EMAIL = "demo@trivaana.ai"
DEMO_USER_PASSWORD = "Trivaana@2026"

def seed_database(conn: sqlite3.Connection):
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) as cnt FROM tenants WHERE id = ?", (DEMO_TENANT_ID,))
    if cur.fetchone()["cnt"] > 0:
        return

    now = datetime.now(timezone.utc).isoformat()

    # 1. Seed Demo Tenant (₹5,000 = 500,000 paise)
    demo_key_hash = hash_api_key("trv_demo_live_secret_key_2026")
    cur.execute("""
    INSERT OR REPLACE INTO tenants (id, name, api_key_hash, wallet_balance_paise, currency, plan, concurrency_limit, created_at)
    VALUES (?, ?, ?, ?, 'INR', 'growth', 15, ?)
    """, (
        DEMO_TENANT_ID,
        "Trivaana Enterprise Demo Workspace",
        demo_key_hash,
        500000,
        now
    ))

    # 2. Seed Demo Admin User
    cur.execute("""
    INSERT OR IGNORE INTO users (id, tenant_id, email, hashed_password, role, full_name, created_at)
    VALUES (?, ?, ?, ?, 'admin', 'Trivaana Demo Administrator', ?)
    """, (
        "user_demo_admin",
        DEMO_TENANT_ID,
        DEMO_USER_EMAIL,
        hash_password(DEMO_USER_PASSWORD),
        now
    ))

    # 3. Seed 5 Vernacular Dialect Agents (Telugu, Hindi, Indian English)
    agents = [
        (
            "agent_aravind_te",
            DEMO_TENANT_ID,
            "Aravind: Telugu Luxury Real Estate Advisor",
            "Real Estate & Housing",
            "te-IN",
            "Sarvam AI (bulbul:v4-flash)",
            "sarvam",
            "You are Aravind, a courteous and persuasive Telugu property advisor for Trivaana Green Meadows Villas in Hyderabad. Qualify budget (₹1.2 Cr to ₹2.5 Cr) and schedule an on-site walkthrough.",
            1.0,
            "active",
            now,
            now
        ),
        (
            "agent_priya_hi",
            DEMO_TENANT_ID,
            "Priya: Hindi Healthcare & Dental Desk",
            "Healthcare & Clinics",
            "hi-IN",
            "Sarvam AI (bulbul:v4-flash)",
            "sarvam",
            "You are Priya at Apollo Smile Dental Clinics. Qualify dental concern (cleaning, root canal, aligners) and book complimentary consultation with Dr. Radhika for this weekend.",
            1.0,
            "active",
            now,
            now
        ),
        (
            "agent_rohan_edtech",
            DEMO_TENANT_ID,
            "Rohan: EdTech Admissions Counselor",
            "EdTech & Coaching",
            "te-IN",
            "ElevenLabs Multilingual v2",
            "elevenlabs",
            "You are Rohan, senior counselor at Sri Chaitanya JEE/NEET Academy. Invite parents for free Diagnostic Scholarship Test this Sunday.",
            1.0,
            "active",
            now,
            now
        ),
        (
            "agent_vikram_auto",
            DEMO_TENANT_ID,
            "Vikram: Automobile VIP Test Drive Scheduler",
            "Automotive",
            "en-IN",
            "Sarvam AI (bulbul:v4-flash)",
            "sarvam",
            "You are Vikram, representative at Varun Motors EV & Luxury Cars. Book home test drives for the new SUV edition.",
            1.0,
            "active",
            now,
            now
        ),
        (
            "agent_ananya_finance",
            DEMO_TENANT_ID,
            "Ananya: SME Loan & Credit Desk",
            "Finance & Banking",
            "hi-IN",
            "Sarvam AI (bulbul:v4-flash)",
            "sarvam",
            "You are Ananya at HDFC SME Credit Solutions. Check business turnover and initiate pre-approved working capital loan paperwork.",
            1.0,
            "active",
            now,
            now
        )
    ]

    cur.executemany("""
    INSERT OR IGNORE INTO agents (id, tenant_id, name, vertical, language, voice_model, provider, system_prompt, speech_rate, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, agents)

    # 4. Seed Verified Starter Indian Leads
    leads = [
        ("lead_101", DEMO_TENANT_ID, "K. Venkat Rao", "+919848012345", "Hyderabad", "Real Estate", "qualified", "Meta Lead Ads", "opted_in", 0, "Interested in 3BHK East-facing Villa in Gachibowli", now),
        ("lead_102", DEMO_TENANT_ID, "Suresh Chunduri", "+919989054321", "Visakhapatnam", "Healthcare", "qualified", "Web Form", "opted_in", 0, "Dental implants inquiry for mother", now),
        ("lead_103", DEMO_TENANT_ID, "Dr. Sunita Sharma", "+919811098765", "Bangalore", "EdTech", "pending", "Web Form", "opted_in", 0, "Daughter preparing for NEET 2027", now),
        ("lead_104", DEMO_TENANT_ID, "Rajesh Varma", "+919700011223", "Vijayawada", "Real Estate", "converted", "WhatsApp Inbound", "opted_in", 0, "Booked Sunday 11 AM Site Walkthrough", now),
        ("lead_105", DEMO_TENANT_ID, "P. Haritha Reddy", "+919440177889", "Hyderabad", "Automotive", "qualified", "Meta Lead Ads", "opted_in", 0, "SUV test drive requested at Banjara Hills office", now)
    ]

    cur.executemany("""
    INSERT OR IGNORE INTO leads (id, tenant_id, name, phone, city, vertical, status, source, consent_status, opt_out, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, leads)

    # 5. Seed Real Multilingual Completed Calls
    sample_calls = [
        (
            "call_201",
            DEMO_TENANT_ID,
            None,
            "agent_aravind_te",
            "K. Venkat Rao",
            "+919848012345",
            "outbound",
            "mock",
            "mock_call_ref_201",
            142,
            150,  # rounded up to nearest 30s = 150s (2.5 mins * 650 = 1625 paise)
            1625,
            "completed",
            "te-IN",
            "Site Visit Scheduled",
            "Agent: నమస్కారం వెంకట్ గారు! త్రివాణా గ్రీన్ మెడోస్ లగ్జరీ విల్లాస్ నుండి అరవింద్ మాట్లాడుతున్నాను. మీరు మన గేటెడ్ కమ్యూనిటీ గురించి ఎంక్వైరీ చేశారు కదా?\nLead: అవునండి, 3BHK విల్లాస్ ప్రైసింగ్ ఎలా ఉంది?\nAgent: ప్రైసింగ్ ₹1.4 కోట్ల నుండి ప్రారంభమవుతుందండి. ఈ శనివారం మార్నింగ్ 11 గంటలకు సైట్ విజిట్ ప్లాన్ చేసుకుందామా సర్?\nLead: సరే, శనివారం 11 కి వస్తాను, లొకేషన్ పిన్ వాట్సాప్ చేయండి.\nAgent: ఖచ్చితంగా సర్, వెంటనే వాట్సాప్‌లో లొకేషన్ పంపిస్తున్నాను. థాంక్యూ!",
            "https://cdn.trivaana.ai/recordings/call_201.mp3",
            now,
            now
        ),
        (
            "call_202",
            DEMO_TENANT_ID,
            None,
            "agent_rohan_edtech",
            "Dr. Sunita Sharma",
            "+919811098765",
            "outbound",
            "mock",
            "mock_call_ref_202",
            98,
            120,  # rounded up to nearest 30s = 120s (2 mins * 650 = 1300 paise)
            1300,
            "completed",
            "hi-IN",
            "Diagnostic Test Booked",
            "Agent: नमस्ते सुनीता जी! श्री चैतन्या एकेडमी से रोहन बात कर रहा हूँ। आपकी बेटी के NEET 2027 की तैयारी के लिए फ्री स्कॉलरशिप टेस्ट इस रविवार सुबह 10 बजे है।\nLead: टेस्ट ऑनलाइन होगा या ऑफलाइन?\nAgent: दोनों ऑप्शन्स उपलब्ध हैं। मैं आपके नंबर पर टेस्ट का लिंक भेज दूँ?\nLead: हाँ, प्लीज़ लिंक भेज दीजिए।",
            "https://cdn.trivaana.ai/recordings/call_202.mp3",
            now,
            now
        )
    ]

    cur.executemany("""
    INSERT OR IGNORE INTO calls (id, tenant_id, campaign_id, agent_id, contact_name, phone, direction, provider, provider_call_id, duration_seconds, billable_duration_seconds, cost_paise, status, language, outcome, transcript, recording_url, created_at, ended_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, sample_calls)

    # 6. Seed Ledger Transactions
    # 500,000 - 1,625 - 1,300 = 497,075 paise
    txs = [
        (
            "tx_1001",
            DEMO_TENANT_ID,
            "credit",
            500000,
            "Welcome Credit: Trivaana AI Demo Workspace",
            "TAX-2026-001",
            500000,
            "seed_credit_001",
            now
        ),
        (
            "tx_1002",
            DEMO_TENANT_ID,
            "debit",
            1625,
            "Outbound Vernacular Call (Venkat Rao - 142s, billed 150s)",
            "INV-2026-101",
            498375,
            "seed_call_201",
            now
        ),
        (
            "tx_1003",
            DEMO_TENANT_ID,
            "debit",
            1300,
            "Outbound Hindi Dialect Call (Sunita Sharma - 98s, billed 120s)",
            "INV-2026-102",
            497075,
            "seed_call_202",
            now
        )
    ]

    cur.executemany("""
    INSERT OR IGNORE INTO transactions (id, tenant_id, type, amount_paise, description, invoice_id, running_balance_paise, idempotency_key, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, txs)

    # Update tenant balance to reflect transactions
    cur.execute("UPDATE tenants SET wallet_balance_paise = 497075 WHERE id = ?", (DEMO_TENANT_ID,))

    # 7. Seed Active Phone Number
    cur.execute("""
    INSERT OR IGNORE INTO phone_numbers (id, tenant_id, phone_number, provider, status, monthly_rental_paise, assigned_agent_id, created_at)
    VALUES (?, ?, ?, 'exotel', 'active', 79900, 'agent_aravind_te', ?)
    """, ("num_101", DEMO_TENANT_ID, "+918047361234", now))

    conn.commit()

seed_demo_data = seed_database
