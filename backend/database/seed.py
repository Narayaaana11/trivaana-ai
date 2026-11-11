"""
TRIVAANA AI: Database Seeding Engine
Initializes isolated demo tenant workspace, voice library, vernacular AI employees,
knowledge base samples, compliance records, and audit ledger (strictly disabled in production).
"""

import json
import sqlite3
from datetime import datetime, timezone
from core.security import hash_password, hash_api_key
from core.config import settings
from services.knowledge_service import KnowledgeService

DEMO_TENANT_ID = "tenant_demo_enterprise"
DEMO_USER_EMAIL = "demo@trivaana.ai"
DEMO_USER_PASSWORD = "Trivaana@2026"


def _seed_voice_profiles(cur: sqlite3.Cursor, now: str):
    voices = [
        ("vp_sarvam_meera_te", "sarvam", "meera", "Ananya (Meera)", "te-IN", "female", "standard", "Warm Telugu female conversational voice", 1.0, 0.6, "sandbox_only"),
        ("vp_sarvam_aravind_te", "sarvam", "arvind", "Aravind", "te-IN", "male", "standard", "Confident Telugu male advisor voice", 1.0, 0.6, "sandbox_only"),
        ("vp_sarvam_priya_hi", "sarvam", "meera", "Priya", "hi-IN", "female", "standard", "Polite Hindi female customer desk voice", 1.0, 0.6, "sandbox_only"),
        ("vp_sarvam_karthik_ta", "sarvam", "arvind", "Karthik", "ta-IN", "male", "standard", "Clear Tamil male voice", 1.0, 0.6, "sandbox_only"),
        ("vp_sarvam_rohan_kn", "sarvam", "arvind", "Rohan", "kn-IN", "male", "standard", "Friendly Kannada male voice", 1.0, 0.6, "sandbox_only"),
        ("vp_sarvam_sneha_ml", "sarvam", "meera", "Sneha", "ml-IN", "female", "standard", "Natural Malayalam female voice", 1.0, 0.6, "sandbox_only"),
        ("vp_sarvam_pooja_mr", "sarvam", "meera", "Pooja", "mr-IN", "female", "standard", "Crisp Marathi female voice", 1.0, 0.6, "sandbox_only"),
        ("vp_sarvam_vikram_en", "sarvam", "arvind", "Vikram", "en-IN", "male", "standard", "Indian English corporate voice", 1.0, 0.6, "sandbox_only"),
        ("vp_eleven_rachel_en", "elevenlabs", "21m00Tcm4TlvDq8ikWAM", "Rachel (Multilingual v2)", "en-IN", "female", "premium", "Studio-grade ultra-low-latency multilingual voice", 1.0, 0.55, "untested"),
        ("vp_eleven_adam_hi", "elevenlabs", "pNInz6obpgDQGcFmaJgB", "Adam (Multilingual v2)", "hi-IN", "male", "premium", "Deep authoritative multilingual male voice", 1.0, 0.55, "untested"),
        ("vp_openai_alloy_en", "openai", "alloy", "Alloy (OpenAI TTS)", "en-IN", "neutral", "standard", "Balanced natural OpenAI voice", 1.0, 0.6, "untested"),
        ("vp_openai_nova_en", "openai", "nova", "Nova (OpenAI TTS)", "en-IN", "female", "standard", "Warm expressive OpenAI female voice", 1.0, 0.6, "untested"),
        ("vp_indicf5_te", "indicf5", "indic_te_f1", "IndicF5 Telugu Experimental", "te-IN", "female", "standard", "AI4Bharat IndicF5 open-weights local synthesis", 1.0, 0.6, "untested"),
    ]
    cur.executemany(
        """
        INSERT OR IGNORE INTO voice_profiles (
            id, provider, provider_voice_id, name, language, gender, quality_tier,
            description, default_speed, default_stability, verified_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [(*v, now) for v in voices],
    )


def _seed_platform_defaults(cur: sqlite3.Cursor, now: str):
    flags = [
        ("livekit_realtime_voice", 1, "Enable LiveKit Agents WebRTC & SIP voice rooms"),
        ("openai_prompt_architect", 1, "Enable OpenAI structured JSON agent generation"),
        ("knowledge_base_rag", 1, "Enable vector Knowledge Base ingestion & retrieval"),
        ("voice_broadcast_module", 1, "Enable one-way Voice Broadcast campaigns"),
        ("caller_memory_opt_in", 1, "Allow opt-in returning caller memory recall"),
        ("trai_tcccpr_guard", 1, "Enforce Indian TRAI TCCCPR calling hours & DND suppression"),
    ]
    cur.executemany(
        "INSERT OR IGNORE INTO feature_flags (key, enabled, description, updated_at) VALUES (?, ?, ?, ?)",
        [(k, e, d, now) for k, e, d in flags],
    )


def seed_database(conn: sqlite3.Connection):
    now = datetime.now(timezone.utc).isoformat()
    cur = conn.cursor()

    # Voice profiles & feature flags are capability catalogs safe in all environments
    _seed_voice_profiles(cur, now)
    _seed_platform_defaults(cur, now)
    conn.commit()

    # Strictly prevent demo seeding, demo accounts, fake leads, and fake calls in production
    if settings.ENVIRONMENT.lower() in ("production", "prod") and not settings.ALLOW_DEMO_SEEDING:
        return

    cur.execute("SELECT COUNT(*) as cnt FROM tenants WHERE id = ?", (DEMO_TENANT_ID,))
    if cur.fetchone()["cnt"] > 0:
        cur.execute(
            "UPDATE users SET is_super_admin = 1 WHERE email = ? AND tenant_id = ?",
            (DEMO_USER_EMAIL, DEMO_TENANT_ID),
        )
        conn.commit()
        return

    # 1. Seed Demo Tenant (₹5,000 = 500,000 paise)
    demo_key_hash = hash_api_key("trv_demo_live_secret_key_2026")
    cur.execute("""
    INSERT INTO tenants (
        id, name, api_key_hash, wallet_balance_paise, currency, plan,
        concurrency_limit, status, billing_email, is_demo, created_at
    ) VALUES (?, ?, ?, ?, 'INR', 'growth', 15, 'active', ?, 1, ?)
    ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        api_key_hash = excluded.api_key_hash,
        billing_email = excluded.billing_email,
        is_demo = 1
    """, (
        DEMO_TENANT_ID,
        "Trivaana Enterprise Demo Workspace",
        demo_key_hash,
        500000,
        DEMO_USER_EMAIL,
        now
    ))

    # 2. Seed Demo Admin User (also flagged super_admin in dev demo mode for evaluation)
    cur.execute("""
    INSERT OR IGNORE INTO users (
        id, tenant_id, email, hashed_password, role, full_name, email_verified, is_super_admin, created_at
    ) VALUES (?, ?, ?, ?, 'owner', 'Trivaana Demo Administrator', 1, 1, ?)
    """, (
        "user_demo_admin",
        DEMO_TENANT_ID,
        DEMO_USER_EMAIL,
        hash_password(DEMO_USER_PASSWORD),
        now
    ))

    cur.execute("""
    INSERT OR IGNORE INTO workspace_members (
        id, tenant_id, user_id, email, full_name, role, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'Trivaana Demo Administrator', 'owner', 'active', ?, ?)
    """, ("mem_demo_owner", DEMO_TENANT_ID, "user_demo_admin", DEMO_USER_EMAIL, now, now))

    cur.execute(
        "INSERT OR IGNORE INTO compliance_policies (id, tenant_id, updated_at) VALUES (?, ?, ?)",
        ("pol_demo_001", DEMO_TENANT_ID, now),
    )

    # 3. Seed 5 Vernacular Dialect AI Employees
    demo_intake_hash = hash_api_key("trv_demo_intake_secret")
    agents = [
        (
            "agent_aravind_te", DEMO_TENANT_ID, "Aravind: Telugu Luxury Real Estate Advisor",
            "aravind-real-estate", demo_intake_hash, "Real Estate & Housing", "Trivaana Green Meadows",
            "Senior Property Advisor", "Qualify villa leads and schedule site visits", "lead_qualification", "both",
            "te-IN", "Sarvam AI (bulbul:v4-flash)", "arvind", "male", "sarvam", "warm_professional",
            "Courteous, consultative, concise",
            "నమస్కారం! త్రివాణా గ్రీన్ మెడోస్ నుండి అరవింద్ మాట్లాడుతున్నాను. నాణ్యత కోసం ఈ కాల్ రికార్డ్ చేయబడుతోంది.",
            "You are Aravind, a courteous and persuasive Telugu property advisor for Trivaana Green Meadows Villas in Hyderabad. Qualify budget (₹1.2 Cr to ₹2.5 Cr) and schedule an on-site walkthrough.",
            json.dumps(["What configuration are you looking for (3BHK or 4BHK Villa)?", "What is your approximate budget range?", "When would you like to visit the site?"]),
            json.dumps([{"key": "budget", "label": "Budget", "type": "string", "required": True}, {"key": "site_visit_slot", "label": "Site Visit Date/Time", "type": "string", "required": False}]),
            json.dumps(["Never guarantee bank loan approval", "Never quote unverified discounts"]),
            1.0, "active", now, now
        ),
        (
            "agent_priya_hi", DEMO_TENANT_ID, "Priya: Hindi Healthcare & Dental Desk",
            "priya-healthcare", demo_intake_hash, "Healthcare & Clinics", "Apollo Smile Dental",
            "Patient Care Coordinator", "Confirm dental consultations and OPD slots", "appointment_booking", "both",
            "hi-IN", "Sarvam AI (bulbul:v4-flash)", "meera", "female", "sarvam", "empathetic_calm",
            "Caring, clear, reassuring",
            "नमस्ते! अपोलो स्माइल डेंटल क्लिनिक से प्रिया बात कर रही हूँ। यह कॉल गुणवत्ता के लिए रिकॉर्ड की जा रही है।",
            "You are Priya at Apollo Smile Dental Clinics. Qualify dental concern (cleaning, root canal, aligners) and book complimentary consultation with Dr. Radhika for this weekend.",
            json.dumps(["Which dental service are you inquiring about?", "Do you prefer morning or evening consultation?"]),
            json.dumps([{"key": "treatment", "label": "Treatment Type", "type": "string", "required": True}, {"key": "slot", "label": "Appointment Slot", "type": "string", "required": True}]),
            json.dumps(["Never provide medical prescriptions or diagnosis"]),
            1.0, "active", now, now
        ),
        (
            "agent_rohan_edtech", DEMO_TENANT_ID, "Rohan: EdTech Admissions Counselor",
            "rohan-edtech", demo_intake_hash, "EdTech & Coaching", "Sri Chaitanya Academy",
            "Academic Counselor", "Enroll students for free diagnostic scholarship test", "lead_qualification", "outbound",
            "te-IN", "ElevenLabs Multilingual v2", "21m00Tcm4TlvDq8ikWAM", "male", "elevenlabs", "energetic_helpful",
            "Encouraging, structured, informative",
            "Hello! This is Rohan from Sri Chaitanya Academy admissions desk.",
            "You are Rohan, senior counselor at Sri Chaitanya JEE/NEET Academy. Invite parents for free Diagnostic Scholarship Test this Sunday.",
            json.dumps(["Which grade and exam target is the student preparing for?", "Would you prefer online or campus test mode?"]),
            json.dumps([{"key": "target_exam", "label": "Target Exam", "type": "string", "required": True}]),
            json.dumps(["Never guarantee specific rank outcomes"]),
            1.0, "active", now, now
        ),
        (
            "agent_vikram_auto", DEMO_TENANT_ID, "Vikram: Automobile VIP Test Drive Scheduler",
            "vikram-auto", demo_intake_hash, "Automotive", "Varun Motors EV",
            "VIP Test Drive Concierge", "Schedule home or showroom SUV test drives", "appointment_booking", "outbound",
            "en-IN", "Sarvam AI (bulbul:v4-flash)", "arvind", "male", "sarvam", "executive_crisp",
            "Polite, efficient, product-savvy",
            "Hello! Vikram calling from Varun Motors EV regarding your SUV test drive request.",
            "You are Vikram, representative at Varun Motors EV & Luxury Cars. Book home test drives for the new SUV edition.",
            json.dumps(["Would you prefer a home test drive or showroom visit?", "Which variant are you most interested in?"]),
            json.dumps([{"key": "test_drive_mode", "label": "Home/Showroom", "type": "string", "required": True}]),
            json.dumps(["Never promise unapproved delivery dates"]),
            1.0, "active", now, now
        ),
        (
            "agent_ananya_finance", DEMO_TENANT_ID, "Ananya: SME Loan & Credit Desk",
            "ananya-finance", demo_intake_hash, "Finance & Banking", "Trivaana FinServe",
            "SME Credit Advisor", "Check business eligibility and schedule KYC callback", "service_follow_up", "outbound",
            "hi-IN", "Sarvam AI (bulbul:v4-flash)", "meera", "female", "sarvam", "professional_trustworthy",
            "Respectful, transparent, compliant",
            "नमस्ते! मैं फाइनेंस सपोर्ट डेस्क से अनन्या बात कर रही हूँ।",
            "You are Ananya at SME Credit Solutions. Check business turnover and initiate pre-approved working capital loan paperwork.",
            json.dumps(["What is your approximate annual business turnover?", "Would you like a relationship manager to call back?"]),
            json.dumps([{"key": "turnover_band", "label": "Annual Turnover", "type": "string", "required": True}]),
            json.dumps(["Never ask for OTPs, CVV, or banking passwords"]),
            1.0, "active", now, now
        ),
    ]

    cur.executemany("""
    INSERT OR IGNORE INTO agents (
        id, tenant_id, name, slug, intake_secret_hash, vertical, business_name, designation,
        objective, calling_purpose, call_direction, language, voice_model, voice_id, voice_gender,
        provider, speaking_style, personality, greeting_message, system_prompt,
        questions_json, extraction_schema_json, never_say_json, speech_rate, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, agents)

    # Seed initial versions for demo agents
    for a in agents:
        cur.execute(
            """
            INSERT OR IGNORE INTO agent_versions (id, agent_id, tenant_id, version_number, system_prompt, structured_config_json, change_note, created_by, created_at)
            VALUES (?, ?, ?, 1, ?, '{}', 'Initial seeded configuration', 'user_demo_admin', ?)
            """,
            (f"ver_{a[0]}_1", a[0], DEMO_TENANT_ID, a[19], now),
        )

    # 4. Seed Starter Demo Leads
    leads = [
        ("lead_101", DEMO_TENANT_ID, "K. Venkat Rao", "+919848012345", "venkat.rao@example.com", "Hyderabad", "Real Estate", "qualified", "interested", "Meta Lead Ads", "opted_in", "service", 0, "Interested in 3BHK East-facing Villa in Gachibowli", now, now),
        ("lead_102", DEMO_TENANT_ID, "Suresh Chunduri", "+919989054321", "suresh.c@example.com", "Visakhapatnam", "Healthcare", "qualified", "callback_required", "Web Form", "opted_in", "service", 0, "Dental implants inquiry for mother", now, now),
        ("lead_103", DEMO_TENANT_ID, "Dr. Sunita Sharma", "+919811098765", "sunita.s@example.com", "Bangalore", "EdTech", "pending", "contacted", "Web Form", "opted_in", "service", 0, "Daughter preparing for NEET 2027", now, now),
        ("lead_104", DEMO_TENANT_ID, "Rajesh Varma", "+919700011223", "rajesh.v@example.com", "Vijayawada", "Real Estate", "converted", "converted", "WhatsApp Inbound", "opted_in", "service", 0, "Booked Sunday 11 AM Site Walkthrough", now, now),
        ("lead_105", DEMO_TENANT_ID, "P. Haritha Reddy", "+919440177889", "haritha.r@example.com", "Hyderabad", "Automotive", "qualified", "interested", "Meta Lead Ads", "opted_in", "service", 0, "SUV test drive requested at Banjara Hills office", now, now),
    ]

    cur.executemany("""
    INSERT OR IGNORE INTO leads (
        id, tenant_id, name, phone, email, city, vertical, status, lead_status,
        source, consent_status, call_category, opt_out, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, leads)

    # 5. Seed Simulated Demo Calls
    sample_calls = [
        (
            "call_201", DEMO_TENANT_ID, None, "agent_aravind_te", "lead_101",
            "K. Venkat Rao", "+919848012345", "outbound", "service", "mock", "mock_call_ref_201",
            142, 150, 1625, "completed", "te-IN", "Site Visit Scheduled",
            "Prospect confirmed interest in 3BHK East-facing Villa (₹1.4 Cr+) and booked site visit for Saturday 11 AM.",
            "positive",
            json.dumps({"budget": "1.4 Cr - 1.8 Cr", "property_type": "3BHK Villa", "site_visit": "Saturday 11:00 AM"}),
            "Agent: నమస్కారం వెంకట్ గారు! త్రివాణా గ్రీన్ మెడోస్ లగ్జరీ విల్లాస్ నుండి అరవింద్ మాట్లాడుతున్నాను. మీరు మన గేటెడ్ కమ్యూనిటీ గురించి ఎంక్వైరీ చేశారు కదా?\nLead: అవునండి, 3BHK విల్లాస్ ప్రైసింగ్ ఎలా ఉంది?\nAgent: ప్రైసింగ్ ₹1.4 కోట్ల నుండి ప్రారంభమవుతుందండి. ఈ శనివారం మార్నింగ్ 11 గంటలకు సైట్ విజిట్ ప్లాన్ చేసుకుందామా సర్?\nLead: సరే, శనివారం 11 కి వస్తాను, లొకేషన్ పిన్ వాట్సాప్ చేయండి.\nAgent: ఖచ్చితంగా సర్, వెంటనే వాట్సాప్‌లో లొకేషన్ పంపిస్తున్నాను. థాంక్యూ!",
            "sandbox://recordings/call_201.mp3", 1, 218, now, now
        ),
        (
            "call_202", DEMO_TENANT_ID, None, "agent_rohan_edtech", "lead_103",
            "Dr. Sunita Sharma", "+919811098765", "outbound", "service", "mock", "mock_call_ref_202",
            98, 120, 1300, "completed", "hi-IN", "Diagnostic Test Booked",
            "Parent confirmed interest in online NEET 2027 scholarship test this Sunday 10 AM.",
            "positive",
            json.dumps({"target_exam": "NEET 2027", "mode": "Online", "test_date": "Sunday 10:00 AM"}),
            "Agent: नमस्ते सुनीता जी! श्री चैतन्या एकेडमी से रोहन बात कर रहा हूँ। आपकी बेटी के NEET 2027 की तैयारी के लिए फ्री स्कॉलरशिप टेस्ट इस रविवार सुबह 10 बजे है।\nLead: टेस्ट ऑनलाइन होगा या ऑफलाइन?\nAgent: दोनों ऑप्शन्स उपलब्ध हैं। मैं आपके नंबर पर टेस्ट का लिंक भेज दूँ?\nLead: हाँ, प्लीज़ लिंक भेज दीजिए।",
            "sandbox://recordings/call_202.mp3", 1, 240, now, now
        ),
    ]

    cur.executemany("""
    INSERT OR IGNORE INTO calls (
        id, tenant_id, campaign_id, agent_id, lead_id, contact_name, phone, direction,
        call_category, provider, provider_call_id, duration_seconds, billable_duration_seconds,
        cost_paise, status, language, outcome, summary, sentiment, extracted_data_json,
        transcript, recording_url, is_sandbox, latency_ms, created_at, ended_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, sample_calls)

    # 6. Seed Ledger Transactions
    txs = [
        ("tx_1001", DEMO_TENANT_ID, "credit", 500000, "Welcome Credit: Trivaana AI Demo Workspace", "TAX-2026-001", 500000, "seed_credit_001", now),
        ("tx_1002", DEMO_TENANT_ID, "debit", 1625, "Outbound Vernacular Call (Venkat Rao - 142s, billed 150s)", "INV-2026-101", 498375, "seed_call_201", now),
        ("tx_1003", DEMO_TENANT_ID, "debit", 1300, "Outbound Hindi Dialect Call (Sunita Sharma - 98s, billed 120s)", "INV-2026-102", 497075, "seed_call_202", now),
    ]
    cur.executemany("""
    INSERT OR IGNORE INTO transactions (id, tenant_id, type, amount_paise, description, invoice_id, running_balance_paise, idempotency_key, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, txs)
    cur.execute("UPDATE tenants SET wallet_balance_paise = 497075 WHERE id = ?", (DEMO_TENANT_ID,))

    # 7. Seed Demo Phone Number + Channel Pool
    cur.execute("""
    INSERT OR IGNORE INTO phone_numbers (
        id, tenant_id, phone_number, caller_id, provider, status, kyc_status,
        compliance_category, monthly_rental_paise, assigned_agent_id, inbound_agent_id, channel_count, created_at
    ) VALUES (?, ?, ?, ?, 'exotel', 'active', 'verified', 'service_140_160', 79900, 'agent_aravind_te', 'agent_aravind_te', 5, ?)
    """, ("num_101", DEMO_TENANT_ID, "+918047361234", "+918047361234", now))

    cur.execute("""
    INSERT OR IGNORE INTO calling_channels (
        id, tenant_id, phone_number_id, provider, channel_capacity, monthly_rental_paise, status, created_at, updated_at
    ) VALUES (?, ?, 'num_101', 'exotel', 5, 64900, 'active', ?, ?)
    """, ("chn_101", DEMO_TENANT_ID, now, now))

    # 8. Seed Sample Knowledge Base Document & WhatsApp Template
    KnowledgeService.ingest_document(
        conn=conn,
        tenant_id=DEMO_TENANT_ID,
        title="Trivaana Green Meadows Villa Brochure & Pricing",
        raw_text=(
            "Trivaana Green Meadows is a gated 3BHK and 4BHK villa community in Gachibowli, Hyderabad. "
            "3BHK East-facing villas start at Rs 1.40 Crore (2,450 sq.ft). 4BHK Corner Villas start at Rs 2.15 Crore (3,200 sq.ft). "
            "Site visits are available daily from 9:30 AM to 6:30 PM with complimentary pickup from Financial District."
        ),
        source_type="pricelist",
        agent_id="agent_aravind_te",
    )

    cur.execute("""
    INSERT OR IGNORE INTO whatsapp_templates (id, tenant_id, name, category, language, body_text, approval_status, created_at)
    VALUES (?, ?, 'site_visit_confirmation', 'UTILITY', 'en', 'Namaskaram {{1}}, your site visit is confirmed for {{2}}. Location pin: {{3}}.', 'approved', ?)
    """, ("wat_demo_1", DEMO_TENANT_ID, now))

    conn.commit()


seed_demo_data = seed_database
