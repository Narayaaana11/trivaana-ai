"""
TRIVAANA AI: Lead Validation & CSV Ingestion Engine
Strict validation, E.164 normalization, row-level error reporting, and truthful lead discovery.
"""

import sqlite3
import csv
import io
import uuid
import re
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from services.call_service import normalize_phone

class LeadService:
    @staticmethod
    def validate_and_import_csv(
        conn: sqlite3.Connection,
        tenant_id: str,
        csv_text: str,
        filename: str = "upload.csv"
    ) -> Dict[str, Any]:
        """
        Validates CSV content row-by-row.
        Never fills missing numbers with fake defaults.
        Returns detailed summary and row-by-row rejection reasons.
        """
        reader = csv.DictReader(io.StringIO(csv_text))
        cur = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()

        total_rows = 0
        imported_count = 0
        rejected_count = 0
        errors: List[Dict[str, Any]] = []

        # Find column mappings flexibly (case-insensitive)
        headers = reader.fieldnames or []
        name_col = next((h for h in headers if h.lower() in ("name", "full_name", "contact_name")), None)
        phone_col = next((h for h in headers if h.lower() in ("phone", "mobile", "contact_number", "telephone")), None)
        city_col = next((h for h in headers if h.lower() in ("city", "location", "town")), None)
        vertical_col = next((h for h in headers if h.lower() in ("vertical", "industry", "sector")), None)
        notes_col = next((h for h in headers if h.lower() in ("notes", "note", "remarks")), None)

        if not phone_col:
            return {
                "status": "error",
                "message": "CSV missing required 'phone' column header. Found headers: " + ", ".join(headers),
                "total_rows": 0,
                "imported_count": 0,
                "rejected_count": 0,
                "errors": [{"row": 0, "error": "Missing 'phone' column header"}]
            }

        for row_idx, row in enumerate(reader, start=2):  # row 1 is header
            total_rows += 1
            raw_name = (row.get(name_col) if name_col else "") or ""
            raw_phone = (row.get(phone_col) if phone_col else "") or ""
            city = (row.get(city_col) if city_col else "") or "Hyderabad"
            vertical = (row.get(vertical_col) if vertical_col else "") or "General"
            notes = (row.get(notes_col) if notes_col else "") or "Imported via CSV batch"

            # Validation 1: Phone must exist
            if not raw_phone.strip():
                rejected_count += 1
                msg = f"Phone number is empty for '{raw_name}'" if raw_name else "Phone number is empty"
                errors.append({"row": row_idx, "name": raw_name, "error": msg, "reason": msg})
                continue

            # Validation 2: Phone format
            clean_phone = normalize_phone(raw_phone)
            digits_only = re.sub(r"[^\d]", "", clean_phone)
            if len(digits_only) < 10 or len(digits_only) > 15:
                rejected_count += 1
                msg = f"Invalid phone length ({len(digits_only)} digits)"
                errors.append({"row": row_idx, "name": raw_name, "phone": raw_phone, "error": msg, "reason": msg})
                continue

            # Validation 3: Name fallback
            name = raw_name.strip() or f"Contact {clean_phone[-4:]}"

            # Check duplicate within tenant
            cur.execute("SELECT id FROM leads WHERE tenant_id = ? AND phone = ?", (tenant_id, clean_phone))
            if cur.fetchone():
                rejected_count += 1
                msg = f"Duplicate contact already exists for {clean_phone}"
                errors.append({"row": row_idx, "name": name, "phone": clean_phone, "error": msg, "reason": msg})
                continue

            # Insert lead
            lead_id = f"lead_{uuid.uuid4().hex[:8]}"
            cur.execute("""
            INSERT INTO leads (id, tenant_id, name, phone, city, vertical, status, source, consent_status, opt_out, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', 'CSV Import', 'opted_in', 0, ?, ?)
            """, (lead_id, tenant_id, name, clean_phone, city, vertical, notes, now))
            imported_count += 1

        conn.commit()

        return {
            "status": "success" if imported_count > 0 else "partial_success",
            "success": imported_count > 0,
            "filename": filename,
            "total_rows": total_rows,
            "imported_count": imported_count,
            "rejected_count": rejected_count,
            "failed_count": rejected_count,
            "errors": errors[:50]  # Cap error list to first 50
        }

    @staticmethod
    def discover_leads_scout(
        conn: sqlite3.Connection,
        tenant_id: str,
        city: str = "Hyderabad",
        vertical: str = "Real Estate",
        limit: int = 15
    ) -> Dict[str, Any]:
        """
        Truthful Lead Scout:
        Never fabricates random names or phone numbers.
        If an authorized provider integration is absent, returns 'not_configured'.
        """
        # When no genuine external lead provider credentials exist:
        return {
            "status": "not_configured",
            "message": "External Lead Scout integration is not configured. To automatically harvest verified business contacts, configure a licensed provider API key (e.g. Apollo / Google Places) in your environment settings.",
            "leads_found": 0,
            "leads_added": 0,
            "leads": [],
            "action_required": "Configure LEAD_SCOUT_API_KEY in backend/.env or upload verified contact lists via CSV Import."
        }
