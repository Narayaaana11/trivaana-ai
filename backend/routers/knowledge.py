"""
TRIVAANA AI: Knowledge Base & Retrieval Sandbox Router
"""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from typing import Optional
import sqlite3
from datetime import datetime, timezone
import uuid

from database.connection import get_db
from core.dependencies import get_current_tenant
from services.knowledge_service import (
    KnowledgeService,
    extract_text_from_bytes,
    extract_text_from_url,
)
from services.storage_service import StorageService

router = APIRouter(prefix="/api/knowledge", tags=["Knowledge Base"])


class CreateSourceRequest(BaseModel):
    name: str
    source_type: str = "text"
    agent_id: Optional[str] = None
    description: Optional[str] = None


class AddTextDocumentRequest(BaseModel):
    title: str
    content: str
    source_type: str = "text"  # 'text', 'faq', 'policy', 'pricelist'
    agent_id: Optional[str] = None
    source_id: Optional[str] = None


class AddUrlDocumentRequest(BaseModel):
    title: Optional[str] = None
    url: str
    agent_id: Optional[str] = None
    source_id: Optional[str] = None


class SearchKnowledgeRequest(BaseModel):
    query: str
    agent_id: Optional[str] = None
    top_k: int = Field(4, ge=1, le=20)


@router.get("/sources")
def list_sources(
    agent_id: Optional[str] = None,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    q = "SELECT * FROM knowledge_sources WHERE tenant_id = ?"
    params = [tenant["id"]]
    if agent_id:
        q += " AND (agent_id = ? OR agent_id IS NULL)"
        params.append(agent_id)
    q += " ORDER BY updated_at DESC"
    cur.execute(q, params)
    sources = [dict(r) for r in cur.fetchall()]
    return {"sources": sources, "count": len(sources)}


@router.post("/sources")
def create_source(
    req: CreateSourceRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    now = datetime.now(timezone.utc).isoformat()
    source_id = f"kbs_{uuid.uuid4().hex[:8]}"
    cur = db.cursor()
    cur.execute(
        """
        INSERT INTO knowledge_sources (id, tenant_id, agent_id, name, source_type, status, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'ready', ?, ?, ?)
        """,
        (source_id, tenant["id"], req.agent_id, req.name.strip(), req.source_type, req.description, now, now),
    )
    db.commit()
    return {"status": "success", "source_id": source_id}


@router.get("/documents")
def list_documents(
    agent_id: Optional[str] = None,
    source_id: Optional[str] = None,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    q = "SELECT id, source_id, tenant_id, agent_id, title, source_type, source_url, status, error_message, chunk_count, created_at, updated_at FROM knowledge_documents WHERE tenant_id = ?"
    params = [tenant["id"]]
    if agent_id:
        q += " AND (agent_id = ? OR agent_id IS NULL)"
        params.append(agent_id)
    if source_id:
        q += " AND source_id = ?"
        params.append(source_id)
    q += " ORDER BY created_at DESC"
    cur.execute(q, params)
    docs = [dict(r) for r in cur.fetchall()]
    return {"documents": docs, "count": len(docs)}


@router.post("/documents/text")
def add_text_document(
    req: AddTextDocumentRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    if not req.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")
    return KnowledgeService.ingest_document(
        conn=db,
        tenant_id=tenant["id"],
        title=req.title.strip(),
        raw_text=req.content,
        source_type=req.source_type,
        agent_id=req.agent_id,
        source_id=req.source_id,
    )


@router.post("/documents/url")
def add_url_document(
    req: AddUrlDocumentRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    try:
        text = extract_text_from_url(req.url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL content: {str(e)}")
    return KnowledgeService.ingest_document(
        conn=db,
        tenant_id=tenant["id"],
        title=(req.title or req.url).strip(),
        raw_text=text,
        source_type="url",
        agent_id=req.agent_id,
        source_id=req.source_id,
        source_url=req.url,
    )


@router.post("/documents/upload")
async def upload_knowledge_file(
    file: UploadFile = File(...),
    agent_id: Optional[str] = Form(None),
    source_id: Optional[str] = Form(None),
    source_type: Optional[str] = Form(None),
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Knowledge document file is empty")
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Knowledge file exceeds maximum allowed size of 10 MB")
    filename = file.filename or "document.txt"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"
    if ext not in ("txt", "md", "csv", "json", "pdf", "docx"):
        raise HTTPException(status_code=400, detail=f"Unsupported knowledge file extension '.{ext}'")
    stored = StorageService.save_file(
        tenant_id=tenant["id"],
        category="knowledge",
        filename=filename,
        content=content,
        content_type=file.content_type or "application/octet-stream",
    )
    extracted = extract_text_from_bytes(filename, content)
    res = KnowledgeService.ingest_document(
        conn=db,
        tenant_id=tenant["id"],
        title=filename,
        raw_text=extracted,
        source_type=source_type or ext,
        agent_id=agent_id,
        source_id=source_id,
    )
    cur = db.cursor()
    cur.execute(
        "UPDATE knowledge_documents SET storage_key = ? WHERE id = ? AND tenant_id = ?",
        (stored["storage_key"], res["document_id"], tenant["id"]),
    )
    db.commit()
    res["storage_key"] = stored["storage_key"]
    res["storage_url"] = stored["url"]
    return res


@router.delete("/documents/{doc_id}")
def delete_document(
    doc_id: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT source_id FROM knowledge_documents WHERE id = ? AND tenant_id = ?", (doc_id, tenant["id"]))
    doc = cur.fetchone()
    if not doc:
        raise HTTPException(status_code=404, detail="Knowledge document not found")

    source_id = doc["source_id"]
    cur.execute("DELETE FROM knowledge_chunks WHERE document_id = ? AND tenant_id = ?", (doc_id, tenant["id"]))
    cur.execute("DELETE FROM knowledge_documents WHERE id = ? AND tenant_id = ?", (doc_id, tenant["id"]))
    cur.execute(
        """
        UPDATE knowledge_sources
        SET document_count = (SELECT COUNT(*) FROM knowledge_documents WHERE source_id = ?),
            chunk_count = (SELECT COUNT(*) FROM knowledge_chunks WHERE source_id = ?),
            updated_at = ?
        WHERE id = ?
        """,
        (source_id, source_id, datetime.now(timezone.utc).isoformat(), source_id),
    )
    db.commit()
    return {"status": "deleted", "document_id": doc_id}


@router.post("/documents/{doc_id}/reindex")
def reindex_document(
    doc_id: str,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    cur = db.cursor()
    cur.execute("SELECT * FROM knowledge_documents WHERE id = ? AND tenant_id = ?", (doc_id, tenant["id"]))
    doc = cur.fetchone()
    if not doc:
        raise HTTPException(status_code=404, detail="Knowledge document not found")

    raw_text = doc["raw_content"] or ""
    if not raw_text and doc["source_url"]:
        raw_text = extract_text_from_url(doc["source_url"])

    cur.execute("DELETE FROM knowledge_chunks WHERE document_id = ? AND tenant_id = ?", (doc_id, tenant["id"]))
    cur.execute("DELETE FROM knowledge_documents WHERE id = ? AND tenant_id = ?", (doc_id, tenant["id"]))
    db.commit()

    return KnowledgeService.ingest_document(
        conn=db,
        tenant_id=tenant["id"],
        title=doc["title"],
        raw_text=raw_text,
        source_type=doc["source_type"],
        agent_id=doc["agent_id"],
        source_id=doc["source_id"],
        source_url=doc["source_url"],
    )


@router.post("/search")
def search_knowledge(
    req: SearchKnowledgeRequest,
    tenant: dict = Depends(get_current_tenant),
    db: sqlite3.Connection = Depends(get_db),
):
    results = KnowledgeService.search(
        conn=db,
        tenant_id=tenant["id"],
        query=req.query,
        agent_id=req.agent_id,
        top_k=req.top_k,
    )
    return {"query": req.query, "results": results, "count": len(results)}

