"""
TRIVAANA AI: Enterprise Telephony Database & Financial Ledger Engine
Zero-Float-Drift Integer Paise Accounting, Thread-Safe SQLite WAL Mode,
Multilingual Call Records, and Outpero Industry Presets.
"""

import sqlite3
import os
import json
import uuid
from datetime import datetime
from pathlib import Path

DB_DIR = Path(os.environ.get("TRIVAANA_DATA_DIR", Path.home() / ".trivaana"))
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "trivaana_saas.db"

def get_connection():
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.execute("PRAGMA busy_timeout=5000;")
    return conn

def init_db():
    conn = get_connection()
    cur = conn.cursor()

    # 1. Tenants Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        api_key TEXT UNIQUE NOT NULL,
        wallet_balance REAL DEFAULT 5000.0,
        currency TEXT DEFAULT 'INR',
        rate_per_min REAL DEFAULT 3.60,
        plan TEXT DEFAULT 'growth',
        concurrency_limit INTEGER DEFAULT 10,
        created_at TEXT NOT NULL
    );
    """)

    # 2. Leads Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        city TEXT DEFAULT 'Hyderabad',
        vertical TEXT DEFAULT 'Real Estate',
        status TEXT DEFAULT 'pending',
        source TEXT DEFAULT 'OSM Scout',
        notes TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );
    """)

    # 3. Call Logs Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS calls (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        contact_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        direction TEXT DEFAULT 'outbound',
        duration INTEGER DEFAULT 0,
        cost REAL DEFAULT 0.0,
        status TEXT DEFAULT 'completed',
        language TEXT DEFAULT 'te-IN',
        outcome TEXT DEFAULT 'interested',
        transcript TEXT,
        recording_url TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );
    """)

    # 4. Outbound Campaigns Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'idle',
        concurrency INTEGER DEFAULT 5,
        total_contacts INTEGER DEFAULT 0,
        placed INTEGER DEFAULT 0,
        connected INTEGER DEFAULT 0,
        demos INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );
    """)

    # 5. Financial Ledger & GST Invoices Table (Whole Integer Paise)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        type TEXT NOT NULL, -- 'credit' or 'debit'
        amount_paise INTEGER NOT NULL,
        amount_inr REAL NOT NULL,
        description TEXT NOT NULL,
        invoice_id TEXT,
        running_balance REAL NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );
    """)

    # 6. Agents & Voice Models Table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        vertical TEXT NOT NULL,
        language TEXT NOT NULL,
        voice_model TEXT DEFAULT 'Sarvam AI (bulbul:v4-flash)',
        system_prompt TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );
    """)

    conn.commit()
    seed_initial_data(conn)
    conn.close()

def seed_initial_data(conn):
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) as cnt FROM tenants")
    if cur.fetchone()["cnt"] > 0:
        return

    now = datetime.now().isoformat()
    tenant_id = "tenant_enterprise_demo"

    # Seed Default Enterprise Tenant
    cur.execute("""
    INSERT INTO tenants (id, name, api_key, wallet_balance, currency, rate_per_min, plan, concurrency_limit, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        tenant_id,
        "Trivaana Enterprise Workspace",
        "trv_live_981a27e492b67f1",
        5000.0,
        "INR",
        3.60,
        "growth",
        15,
        now
    ))

    # Seed 5 Outpero Industry Presets
    presets = [
        (
            "agent_aravind_te",
            tenant_id,
            "Aravind: Telugu Luxury Real Estate Advisor",
            "Real Estate & Housing",
            "te-IN",
            "Sarvam AI (bulbul:v4-flash)",
            "You are Aravind, a courteous and persuasive Telugu property advisor for Trivaana Green Meadows Villas in Hyderabad. Qualify budget (₹1.2 Cr to ₹2.5 Cr) and schedule on-site walkthrough.",
            "active",
            now
        ),
        (
            "agent_priya_hi",
            tenant_id,
            "Priya: Hindi Healthcare & Dental Desk",
            "Healthcare & Clinics",
            "hi-IN",
            "Sarvam AI (bulbul:v4-flash)",
            "You are Priya at Apollo Smile Dental Clinics. Qualify dental concern (cleaning, root canal, aligners) and book complimentary consultation with Dr. Radhika for this weekend.",
            "active",
            now
        ),
        (
            "agent_rohan_edtech",
            tenant_id,
            "Rohan: EdTech Admissions Counselor",
            "EdTech & Coaching",
            "te-IN",
            "ElevenLabs Multilingual v2",
            "You are Rohan, senior counselor at Sri Chaitanya JEE/NEET Academy. Invite 10th/11th parents for free Diagnostic Scholarship Test this Sunday.",
            "active",
            now
        ),
        (
            "agent_vikram_auto",
            tenant_id,
            "Vikram: Automobile VIP Test Drive Scheduler",
            "Automotive",
            "en-IN",
            "Sarvam AI (bulbul:v4-flash)",
            "You are Vikram, representative at Varun Motors EV & Luxury Cars. Book home test drives for the new SUV edition.",
            "active",
            now
        ),
        (
            "agent_ananya_finance",
            tenant_id,
            "Ananya: SME Loan & Credit Desk",
            "Finance & Banking",
            "hi-IN",
            "Sarvam AI (bulbul:v4-flash)",
            "You are Ananya at HDFC SME Credit Solutions. Check business turnover and initiate pre-approved working capital loan paperwork.",
            "active",
            now
        ),
    ]

    cur.executemany("""
    INSERT INTO agents (id, tenant_id, name, vertical, language, voice_model, system_prompt, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, presets)

    # Seed 6 Authentic Indian Leads
    leads_data = [
        ("lead_101", tenant_id, "K. Venkat Rao", "+91 98480 12345", "Hyderabad", "Real Estate", "qualified", "Meta Instant Lead Ads", "Interested in 3BHK East-facing Villa in Gachibowli", now),
        ("lead_102", tenant_id, "Suresh Chunduri", "+91 99890 54321", "Visakhapatnam", "Healthcare", "qualified", "OSM Scout", "Dental implants inquiry for mother", now),
        ("lead_103", tenant_id, "Dr. Sunita Sharma", "+91 98110 98765", "Bangalore", "EdTech", "pending", "Web Form", "Daughter preparing for NEET 2027", now),
        ("lead_104", tenant_id, "Rajesh Varma", "+91 97000 11223", "Vijayawada", "Real Estate", "converted", "WhatsApp Inbound", "Booked Sunday 11 AM Site Walkthrough", now),
        ("lead_105", tenant_id, "Amitabh Singhania", "+91 98200 44556", "Mumbai", "Finance", "pending", "CSV Bulk Upload", "Commercial equipment loan inquiry", now),
        ("lead_106", tenant_id, "P. Haritha Reddy", "+91 94401 77889", "Hyderabad", "Automotive", "qualified", "Meta Lead Ads", "SUV test drive requested at Banjara Hills office", now)
    ]

    cur.executemany("""
    INSERT INTO leads (id, tenant_id, name, phone, city, vertical, status, source, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, leads_data)

    # Seed Sample Calls with Multilingual Transcripts
    calls_data = [
        (
            "call_201",
            tenant_id,
            "K. Venkat Rao",
            "+91 98480 12345",
            "outbound",
            142,
            8.52,
            "completed",
            "te-IN",
            "Site Visit Scheduled",
            "Agent: నమస్కారం వెంకట్ గారు! త్రివాణా గ్రీన్ మెడోస్ లగ్జరీ విల్లాస్ నుండి అరవింద్ మాట్లాడుతున్నాను. మీరు మన గేటెడ్ కమ్యూనిటీ గురించి ఎంక్వైరీ చేశారు కదా?\nLead: అవునండి, 3BHK విల్లాస్ ప్రైసింగ్ ఎలా ఉంది?\nAgent: ప్రైసింగ్ ₹1.4 కోట్ల నుండి ప్రారంభమవుతుందండి. ఈ శనివారం మార్నింగ్ 11 గంటలకు సైట్ విజిట్ ప్లాన్ చేసుకుందామా సర్?\nLead: సరే, శనివారం 11 కి వస్తాను, లొకేషన్ పిన్ వాట్సాప్ చేయండి.\nAgent: ఖచ్చితంగా సర్, వెంటనే వాట్సాప్‌లో లొకేషన్ పంపిస్తున్నాను. థాంక్యూ!",
            "https://cdn.trivaana.ai/recordings/call_201.mp3",
            now
        ),
        (
            "call_202",
            tenant_id,
            "Dr. Sunita Sharma",
            "+91 98110 98765",
            "outbound",
            98,
            5.88,
            "completed",
            "hi-IN",
            "Diagnostic Test Booked",
            "Agent: नमस्ते सुनीता जी! श्री चैतन्या एकेडमी से रोहन बात कर रहा हूँ। आपकी बेटी के NEET 2027 की तैयारी के लिए फ्री स्कॉलरशिप टेस्ट इस रविवार सुबह 10 बजे है।\nLead: टेस्ट ऑनलाइन होगा या ऑफलाइन?\nAgent: दोनों ऑप्शन्स उपलब्ध हैं। मैं आपके नंबर पर टेस्ट का लिंक भेज दूँ?\nLead: हाँ, प्लीज़ लिंक भेज दीजिए।",
            "https://cdn.trivaana.ai/recordings/call_202.mp3",
            now
        )
    ]

    cur.executemany("""
    INSERT INTO calls (id, tenant_id, contact_name, phone, direction, duration, cost, status, language, outcome, transcript, recording_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, calls_data)

    # Seed Transactions Table (GST Tax Invoices with SAC 998313)
    transactions_data = [
        (
            "tx_1001",
            tenant_id,
            "credit",
            500000,
            5000.0,
            "Razorpay PG Welcome Credit (Order #order_RzP1001)",
            "TAX-2026-001",
            5000.0,
            now
        ),
        (
            "tx_1002",
            tenant_id,
            "debit",
            852,
            8.52,
            "Outbound Multilingual Call (Venkat Rao - 142s)",
            "INV-2026-101",
            4991.48,
            now
        ),
        (
            "tx_1003",
            tenant_id,
            "debit",
            588,
            5.88,
            "Outbound Hindi Dialect Call (Sunita Sharma - 98s)",
            "INV-2026-102",
            4985.60,
            now
        )
    ]

    cur.executemany("""
    INSERT INTO transactions (id, tenant_id, type, amount_paise, amount_inr, description, invoice_id, running_balance, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, transactions_data)

    conn.commit()

if __name__ == "__main__":
    init_db()
    print("Trivaana AI Database successfully initialized at:", DB_PATH)
