"""
TRIVAANA AI: Provider-Independent LLM & Observability Adapter
Supports Google Gemini (primary), OpenAI (fallback), and optional Langfuse tracing.
"""

import time
from typing import Any, Dict, List, Optional
import httpx
from core.config import settings


def emit_langfuse_generation(
    name: str,
    model: str,
    input_payload: Any,
    output_text: str,
    latency_ms: int,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """Best-effort Langfuse ingestion trace when LANGFUSE_PUBLIC_KEY & SECRET_KEY are configured."""
    if not settings.has_langfuse:
        return
    try:
        httpx.post(
            f"{settings.LANGFUSE_HOST.rstrip('/')}/api/public/ingestion",
            auth=(settings.LANGFUSE_PUBLIC_KEY, settings.LANGFUSE_SECRET_KEY),
            json={
                "batch": [
                    {
                        "type": "generation-create",
                        "body": {
                            "name": name,
                            "model": model,
                            "input": input_payload,
                            "output": output_text,
                            "metadata": {**(metadata or {}), "latency_ms": latency_ms},
                        },
                    }
                ]
            },
            timeout=2.0,
        )
    except Exception:
        pass


class LLMAdapter:
    """Unified chat completion adapter across Gemini and OpenAI with automatic failover."""

    @staticmethod
    def _call_gemini(
        messages: List[Dict[str, str]],
        temperature: float = 0.4,
        max_tokens: int = 512,
        json_mode: bool = False,
    ) -> Optional[Dict[str, Any]]:
        if not settings.has_gemini:
            return None
        system_parts = [m["content"] for m in messages if m["role"] == "system"]
        contents = []
        for m in messages:
            if m["role"] == "system":
                continue
            role = "model" if m["role"] == "assistant" else "user"
            contents.append({"role": role, "parts": [{"text": m["content"]}]})

        payload: Dict[str, Any] = {
            "contents": contents or [{"role": "user", "parts": [{"text": "Hello"}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }
        if json_mode:
            payload["generationConfig"]["responseMimeType"] = "application/json"
        if system_parts:
            payload["systemInstruction"] = {"parts": [{"text": "\n".join(system_parts)}]}

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent"
        resp = httpx.post(url, params={"key": settings.GEMINI_API_KEY}, json=payload, timeout=20.0)
        if resp.status_code != 200:
            raise RuntimeError(f"Gemini API error {resp.status_code}: {resp.text[:200]}")
        data = resp.json()
        text = (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
            .strip()
        )
        return {"provider": "gemini", "model": settings.GEMINI_MODEL, "text": text}

    @staticmethod
    def _call_openai(
        messages: List[Dict[str, str]],
        temperature: float = 0.4,
        max_tokens: int = 512,
        json_mode: bool = False,
    ) -> Optional[Dict[str, Any]]:
        if not settings.has_openai:
            return None
        body: Dict[str, Any] = {
            "model": settings.OPENAI_MODEL,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        resp = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json=body,
            timeout=20.0,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"OpenAI API error {resp.status_code}: {resp.text[:200]}")
        text = resp.json()["choices"][0]["message"]["content"].strip()
        return {"provider": "openai", "model": settings.OPENAI_MODEL, "text": text}

    @classmethod
    def complete(
        cls,
        messages: List[Dict[str, str]],
        preferred_provider: str = "gemini",
        temperature: float = 0.4,
        max_tokens: int = 512,
        json_mode: bool = False,
        trace_name: str = "trivaana.llm",
    ) -> Optional[Dict[str, Any]]:
        order = ["gemini", "openai"] if preferred_provider != "openai" else ["openai", "gemini"]
        last_err: Optional[Exception] = None
        for provider in order:
            t0 = time.perf_counter()
            try:
                res = (
                    cls._call_gemini(messages, temperature, max_tokens, json_mode)
                    if provider == "gemini"
                    else cls._call_openai(messages, temperature, max_tokens, json_mode)
                )
                if res and res.get("text"):
                    latency_ms = int((time.perf_counter() - t0) * 1000)
                    emit_langfuse_generation(
                        name=trace_name,
                        model=res["model"],
                        input_payload=messages[-1:] if messages else [],
                        output_text=res["text"],
                        latency_ms=latency_ms,
                        metadata={"provider": res["provider"]},
                    )
                    return res
            except Exception as exc:
                last_err = exc
                continue
        if last_err:
            raise last_err
        return None

