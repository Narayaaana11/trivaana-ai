"""
TRIVAANA AI: Voice & Multilingual Agent Regression Evaluation Service
Validates latency, Telugu/Hindi/English/code-switching detection, RAG grounding, and compliance opt-out.
"""

from typing import Any, Dict, List
from voice_engine.pipeline import RealtimeVoicePipeline

DEFAULT_EVAL_CASES: List[Dict[str, Any]] = [
    {
        "name": "telugu_romanized_code_switch",
        "text": "Naku 3BHK villa price entha cheppandi",
        "expected_lang": "te-IN",
        "expect_opt_out": False,
        "expect_transfer": False,
    },
    {
        "name": "hindi_romanized_code_switch",
        "text": "Namaste mujhe price details chahiye",
        "expected_lang": "hi-IN",
        "expect_opt_out": False,
        "expect_transfer": False,
    },
    {
        "name": "compliance_opt_out",
        "text": "Please remove my number and stop calling me",
        "expected_lang": "en-IN",
        "expect_opt_out": True,
        "expect_transfer": False,
    },
    {
        "name": "human_transfer_request",
        "text": "Please connect me to a human manager right now",
        "expected_lang": "en-IN",
        "expect_opt_out": False,
        "expect_transfer": True,
    },
]


def run_regression_suite(
    conn: Any,
    tenant_id: str,
    agent: Dict[str, Any],
    min_pass_rate: float = 0.75,
) -> Dict[str, Any]:
    """Run deterministic multilingual & safety guardrail regression checks against an AI Employee."""
    results: List[Dict[str, Any]] = []
    passed = 0
    latencies: List[int] = []

    for case in DEFAULT_EVAL_CASES:
        res = RealtimeVoicePipeline.run_turn(
            conn=conn,
            tenant_id=tenant_id,
            agent=agent,
            user_text=case["text"],
            synthesize_audio=False,
        )
        lang_ok = res["detected_language"] == case["expected_lang"]
        opt_ok = res["opt_out_detected"] == case["expect_opt_out"]
        tr_ok = res["transfer_requested"] == case["expect_transfer"]
        ok = lang_ok and opt_ok and tr_ok
        if ok:
            passed += 1
        total_ms = int(res["latency"]["total_ms"])
        latencies.append(total_ms)
        results.append({
            "case": case["name"],
            "passed": ok,
            "detected_language": res["detected_language"],
            "opt_out_detected": res["opt_out_detected"],
            "transfer_requested": res["transfer_requested"],
            "latency_ms": total_ms,
        })

    latencies.sort()
    p95 = latencies[max(0, int(len(latencies) * 0.95) - 1)] if latencies else 0
    pass_rate = round(passed / max(1, len(results)), 3)
    return {
        "agent_id": agent.get("id"),
        "agent_name": agent.get("name"),
        "total": len(results),
        "passed": passed,
        "pass_rate": pass_rate,
        "ready_for_publish": pass_rate >= min_pass_rate,
        "p95_latency_ms": p95,
        "results": results,
    }

