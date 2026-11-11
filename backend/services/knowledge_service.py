"""
TRIVAANA AI: Knowledge Base & Vector RAG Pipeline
Extracts text (TXT, CSV, DOCX, PDF, URL, FAQ), chunks with overlap,
generates OpenAI or deterministic local embeddings, and performs cosine similarity retrieval.
"""

import hashlib
import io
import json
import math
import re
import sqlite3
import uuid
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import requests

from core.config import settings


def clean_text(raw: str) -> str:
    text = re.sub(r"\r\n?", "\n", raw or "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_chunks(text: str, chunk_size: int = 600, overlap: int = 100) -> List[str]:
    cleaned = clean_text(text)
    if not cleaned:
        return []
    if len(cleaned) <= chunk_size:
        return [cleaned]

    chunks: List[str] = []
    start = 0
    while start < len(cleaned):
        end = min(len(cleaned), start + chunk_size)
        if end < len(cleaned):
            # Prefer breaking on sentence or whitespace boundary
            boundary = max(cleaned.rfind(".", start, end), cleaned.rfind("\n", start, end), cleaned.rfind(" ", start, end))
            if boundary > start + chunk_size // 2:
                end = boundary + 1
        chunk = cleaned[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(cleaned):
            break
        start = max(end - overlap, start + 1)
    return chunks


def _local_deterministic_embedding(text: str, dims: int = 128) -> List[float]:
    """Local normalized feature-hash embedding for offline/sandbox cosine similarity."""
    vec = [0.0] * dims
    tokens = re.findall(r"[a-zA-Z0-9\u0900-\u0DFF]+", text.lower())
    if not tokens:
        return vec
    for tok in tokens:
        digest = hashlib.sha256(tok.encode("utf-8")).digest()
        idx = int.from_bytes(digest[:2], "big") % dims
        sign = 1.0 if (digest[2] % 2 == 0) else -1.0
        vec[idx] += sign
        # Also add character 3-grams for partial/morphological matching
        if len(tok) >= 4:
            for i in range(len(tok) - 2):
                gram = tok[i : i + 3]
                gd = hashlib.md5(gram.encode("utf-8")).digest()
                gidx = int.from_bytes(gd[:2], "big") % dims
                vec[gidx] += 0.35
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [round(v / norm, 6) for v in vec]


def generate_embedding(text: str) -> Dict[str, Any]:
    """Generate vector embedding via OpenAI if configured, else deterministic local vector."""
    if settings.has_openai:
        try:
            resp = requests.post(
                "https://api.openai.com/v1/embeddings",
                headers={
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={"model": settings.OPENAI_EMBEDDING_MODEL, "input": text[:8000]},
                timeout=10.0,
            )
            if resp.status_code == 200:
                data = resp.json()
                emb = data["data"][0]["embedding"]
                return {"vector": emb, "provider": "openai"}
        except Exception:
            pass
    return {"vector": _local_deterministic_embedding(text), "provider": "local_hash_vector"}


def cosine_similarity(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (na * nb)


def extract_text_from_bytes(filename: str, content: bytes) -> str:
    lower = (filename or "").lower()
    if lower.endswith(".docx"):
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            xml_bytes = zf.read("word/document.xml")
        root = ET.fromstring(xml_bytes)
        texts = [elem.text for elem in root.iter() if elem.text]
        return clean_text(" ".join(texts))

    if lower.endswith(".pdf"):
        try:
            import pypdf  # type: ignore
            reader = pypdf.PdfReader(io.BytesIO(content))
            return clean_text("\n".join(page.extract_text() or "" for page in reader.pages))
        except Exception:
            # Fallback ASCII/UTF-8 readable string extraction for simple PDFs
            decoded = content.decode("latin-1", errors="ignore")
            parens = re.findall(r"\(([^()]{3,200})\)", decoded)
            if parens:
                return clean_text(" ".join(parens))
            return clean_text(re.sub(r"[^\x20-\x7E\n]", " ", decoded))

    try:
        return clean_text(content.decode("utf-8-sig"))
    except UnicodeDecodeError:
        return clean_text(content.decode("latin-1", errors="ignore"))


def extract_text_from_url(url: str) -> str:
    from urllib.parse import urljoin
    from services.webhook_service import is_safe_public_url

    current_url = (url or "").strip()
    for _ in range(4):
        if not is_safe_public_url(current_url):
            raise ValueError("URL blocked by SSRF security policy: must be a public HTTP/HTTPS host")
        resp = requests.get(
            current_url,
            timeout=10.0,
            allow_redirects=False,
            headers={"User-Agent": "TrivaanaAI-KB-Crawler/1.0"},
        )
        if resp.is_redirect or resp.is_permanent_redirect:
            loc = resp.headers.get("location")
            if not loc:
                break
            current_url = urljoin(current_url, loc)
            continue
        resp.raise_for_status()
        html = resp.text
        html = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
        text = re.sub(r"<[^>]+>", " ", html)
        return clean_text(text)
    raise ValueError("Too many redirects while fetching URL")


class KnowledgeService:
    @staticmethod
    def ingest_document(
        conn: sqlite3.Connection,
        tenant_id: str,
        title: str,
        raw_text: str,
        source_type: str = "text",
        agent_id: Optional[str] = None,
        source_id: Optional[str] = None,
        source_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        cur = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()

        if not source_id:
            source_id = f"kbs_{uuid.uuid4().hex[:8]}"
            cur.execute(
                """
                INSERT INTO knowledge_sources (id, tenant_id, agent_id, name, source_type, status, document_count, chunk_count, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'ready', 0, 0, ?, ?)
                """,
                (source_id, tenant_id, agent_id, title, source_type, now, now),
            )

        cleaned = clean_text(raw_text)
        chunks = split_chunks(cleaned)
        doc_id = f"kbd_{uuid.uuid4().hex[:8]}"
        doc_status = "ready" if chunks else "failed"
        error_msg = None if chunks else "No extractable text found in document"

        cur.execute(
            """
            INSERT INTO knowledge_documents (
                id, source_id, tenant_id, agent_id, title, source_type,
                source_url, raw_content, status, error_message, chunk_count, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (doc_id, source_id, tenant_id, agent_id, title, source_type, source_url, cleaned, doc_status, error_msg, len(chunks), now, now),
        )

        emb_provider = "local_hash_vector"
        for idx, chunk_text in enumerate(chunks):
            emb = generate_embedding(chunk_text)
            emb_provider = emb["provider"]
            cur.execute(
                """
                INSERT INTO knowledge_chunks (
                    id, document_id, source_id, tenant_id, agent_id, chunk_index, content, embedding_json, metadata_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    f"kbc_{uuid.uuid4().hex[:10]}",
                    doc_id,
                    source_id,
                    tenant_id,
                    agent_id,
                    idx,
                    chunk_text,
                    json.dumps(emb["vector"]),
                    json.dumps({"title": title, "source_type": source_type, "embedding_provider": emb_provider}),
                    now,
                ),
            )

        cur.execute(
            """
            UPDATE knowledge_sources
            SET document_count = (SELECT COUNT(*) FROM knowledge_documents WHERE source_id = ?),
                chunk_count = (SELECT COUNT(*) FROM knowledge_chunks WHERE source_id = ?),
                status = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (source_id, source_id, doc_status, now, source_id),
        )
        conn.commit()

        return {
            "document_id": doc_id,
            "source_id": source_id,
            "title": title,
            "source_type": source_type,
            "status": doc_status,
            "chunk_count": len(chunks),
            "embedding_provider": emb_provider,
            "error_message": error_msg,
        }

    @staticmethod
    def search(
        conn: sqlite3.Connection,
        tenant_id: str,
        query: str,
        agent_id: Optional[str] = None,
        top_k: int = 4,
    ) -> List[Dict[str, Any]]:
        cur = conn.cursor()
        sql = """
        SELECT c.id, c.document_id, c.source_id, c.agent_id, c.chunk_index, c.content, c.embedding_json, c.metadata_json, d.title
        FROM knowledge_chunks c
        JOIN knowledge_documents d ON c.document_id = d.id
        WHERE c.tenant_id = ?
        """
        params: List[Any] = [tenant_id]
        if agent_id:
            sql += " AND (c.agent_id = ? OR c.agent_id IS NULL)"
            params.append(agent_id)

        cur.execute(sql, params)
        rows = cur.fetchall()
        if not rows:
            return []

        q_vec_openai = generate_embedding(query)["vector"]
        q_vec_local = _local_deterministic_embedding(query)
        q_terms = {t for t in re.findall(r"[a-zA-Z0-9\u0900-\u0DFF]+", query.lower()) if len(t) > 2}

        scored: List[Dict[str, Any]] = []
        for r in rows:
            emb = json.loads(r["embedding_json"] or "[]")
            q_vec = q_vec_openai if len(emb) == len(q_vec_openai) else q_vec_local
            vec_score = cosine_similarity(q_vec, emb)
            # Lexical overlap boost for exact product/price/term hits
            content_lower = r["content"].lower()
            lexical_hits = sum(1 for t in q_terms if t in content_lower)
            lexical_score = (lexical_hits / max(1, len(q_terms))) * 0.4
            total_score = round(vec_score + lexical_score, 4)

            scored.append({
                "chunk_id": r["id"],
                "document_id": r["document_id"],
                "source_id": r["source_id"],
                "title": r["title"],
                "agent_id": r["agent_id"],
                "content": r["content"],
                "score": total_score,
            })

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]

    @staticmethod
    def search_pgvector(
        conn: Any,
        tenant_id: str,
        query: str,
        agent_id: Optional[str] = None,
        top_k: int = 4,
    ) -> List[Dict[str, Any]]:
        """Query `knowledge_chunks_pg` using pgvector `<=>` cosine distance when running on PostgreSQL."""
        if getattr(conn, "engine_name", "sqlite3") != "postgresql":
            return KnowledgeService.search(conn, tenant_id, query, agent_id=agent_id, top_k=top_k)

        emb = generate_embedding(query)["vector"]
        vec_literal = "[" + ",".join(str(v) for v in emb) + "]"
        cur = conn.cursor()
        sql = """
        SELECT c.id AS chunk_id, c.document_id, c.source_id, d.title, c.agent_id, c.content,
               (1.0 - (c.embedding <=> %s::vector)) AS score
        FROM knowledge_chunks_pg c
        JOIN knowledge_documents d ON c.document_id = d.id
        WHERE c.tenant_id = %s
        """
        params: List[Any] = [vec_literal, tenant_id]
        if agent_id:
            sql += " AND (c.agent_id = %s OR c.agent_id IS NULL)"
            params.append(agent_id)
        sql += " ORDER BY c.embedding <=> %s::vector LIMIT %s"
        params.extend([vec_literal, top_k])
        cur.execute(sql, params)
        return [dict(r) for r in cur.fetchall()]

