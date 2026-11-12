"""
TRIVAANA AI: Shared Durable Workflow Execution Engine & Graph Evaluator
Evaluates React Flow nodes, conditional branches, and side-effect actions deterministically,
with optional Temporal server dispatch when configured and reachable.
Lives inside `backend/services` so both API containers and worker containers share one implementation.
"""

import asyncio
from datetime import datetime, timezone
import json
import uuid
from typing import Any, Dict, List, Optional
from core.config import settings


def _evaluate_condition(node: Dict[str, Any], context: Dict[str, Any]) -> bool:
    data = node.get("data") or {}
    cond = data.get("condition")
    if isinstance(cond, dict):
        field = str(cond.get("field") or "interested").strip()
        op = str(cond.get("operator") or "eq").lower()
        expected = cond.get("value")
        actual = context.get(field)
        if op in ("eq", "==", "equals"):
            return str(actual).lower() == str(expected).lower() if actual is not None else False
        if op in ("ne", "!=", "not_equals"):
            return str(actual).lower() != str(expected).lower()
        if op == "contains":
            return str(expected or "").lower() in str(actual or "").lower()
        if op == "truthy":
            return bool(actual)

    expr = str(cond or data.get("expression") or data.get("label") or "").lower()
    if "not_interested" in expr or "declined" in expr:
        return str(context.get("classification") or context.get("outcome") or "").lower() in ("not_interested", "declined")
    if "interested" in expr or "qualified" in expr:
        if "interested" in context:
            return bool(context["interested"])
        if "qualified" in context:
            return bool(context["qualified"])
        return str(context.get("classification") or context.get("outcome") or "").lower() in ("interested", "qualified", "yes")
    return bool(context.get("condition_result", True))


def _execute_workflow_node(conn: Any, tenant_id: str, node: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    data = node.get("data") or {}
    label = str(data.get("label") or "Step")
    node_kind = str(data.get("actionType") or data.get("kind") or node.get("type") or "").lower()
    lower_label = label.lower()

    if node_kind == "condition" or "interested?" in lower_label or lower_label.startswith("if "):
        passed = _evaluate_condition(node, context)
        return {"node_id": node.get("id"), "label": label, "type": "condition", "status": "completed", "branch": "yes" if passed else "no"}

    if node_kind in ("notify", "notification") or "notify" in lower_label or "alert" in lower_label:
        try:
            from services.audit_service import AuditService
            AuditService.notify(
                conn,
                tenant_id=tenant_id,
                title=f"Workflow: {label}",
                message=str(data.get("message") or context.get("summary") or f"Workflow notification for lead {context.get('lead_name') or context.get('lead') or ''}"),
                category="workflow",
                severity="info",
                commit=False,
            )
            return {"node_id": node.get("id"), "label": label, "type": "notify", "status": "executed"}
        except Exception as exc:
            return {"node_id": node.get("id"), "label": label, "type": "notify", "status": "failed", "error": str(exc)}

    if node_kind in ("appointment", "google_calendar") or "book" in lower_label or "calendar" in lower_label:
        try:
            from services.action_service import ActionService
            if context.get("call_id"):
                act = ActionService.execute_action(
                    conn=conn,
                    tenant_id=tenant_id,
                    call_id=context["call_id"],
                    action_type="google_calendar",
                    action_name=label,
                    arguments=dict(data.get("arguments") or {"operation": "book_appointment", "title": context.get("title", "Scheduled Consultation")}),
                    is_sandbox=bool(context.get("is_sandbox", True)),
                )
            else:
                act = ActionService.sync_google_calendar_event(
                    conn=conn,
                    tenant_id=tenant_id,
                    arguments=dict(data.get("arguments") or {"operation": "book_appointment", "title": context.get("title", "Scheduled Consultation")}),
                    is_sandbox=bool(context.get("is_sandbox", True)),
                )
            return {"node_id": node.get("id"), "label": label, "type": "calendar", "status": act.get("status", "executed"), "result": act}
        except Exception as exc:
            return {"node_id": node.get("id"), "label": label, "type": "calendar", "status": "failed", "error": str(exc)}

    if node_kind in ("whatsapp", "whatsapp_template", "custom_api") and context.get("call_id"):
        try:
            from services.action_service import ActionService
            act = ActionService.execute_action(
                conn=conn,
                tenant_id=tenant_id,
                call_id=context["call_id"],
                action_type="whatsapp_template" if "whatsapp" in node_kind else node_kind,
                action_name=label,
                arguments=dict(data.get("arguments") or context),
                is_sandbox=bool(context.get("is_sandbox", True)),
            )
            return {"node_id": node.get("id"), "label": label, "type": node_kind, "status": act.get("status", "executed"), "result": act}
        except Exception as exc:
            return {"node_id": node.get("id"), "label": label, "type": node_kind, "status": "failed", "error": str(exc)}

    if (node_kind in ("followup", "delay", "schedule_call") or "follow-up" in lower_label or "followup" in lower_label) and context.get("phone") and context.get("agent_id"):
        try:
            from worker.tasks import schedule_delayed_intake_call
            delay_s = int(data.get("delay_seconds") or context.get("delay_seconds") or 3600)
            sch = schedule_delayed_intake_call(
                delay_seconds=delay_s,
                tenant_id=tenant_id,
                lead_id=str(context.get("lead_id") or ""),
                contact_name=str(context.get("lead_name") or context.get("lead") or "Contact"),
                phone=str(context["phone"]),
                language=str(context.get("language") or "te-IN"),
                agent_id=str(context["agent_id"]),
                is_sandbox=bool(context.get("is_sandbox", True)),
            )
            return {"node_id": node.get("id"), "label": label, "type": "schedule_followup", "status": "scheduled", "result": sch}
        except Exception as exc:
            return {"node_id": node.get("id"), "label": label, "type": "schedule_followup", "status": "failed", "error": str(exc)}

    if (node_kind in ("call", "start_call") or "ai calling" in lower_label or "start call" in lower_label) and context.get("execute_live_calls") and context.get("phone"):
        try:
            from services.call_service import CallService
            c_res = CallService.initiate_call(
                conn=conn,
                tenant_id=tenant_id,
                contact_name=str(context.get("lead_name") or context.get("lead") or "Lead"),
                phone=str(context["phone"]),
                language=str(context.get("language") or "te-IN"),
                agent_id=context.get("agent_id"),
                is_sandbox=bool(context.get("is_sandbox", True)),
            )
            return {"node_id": node.get("id"), "label": label, "type": "call", "status": "dispatched", "call_id": c_res.get("call_id")}
        except Exception as exc:
            return {"node_id": node.get("id"), "label": label, "type": "call", "status": "failed", "error": str(exc)}

    return {"node_id": node.get("id"), "label": label, "type": node_kind or "step", "status": "completed"}


def _run_local_graph(conn: Any, tenant_id: str, graph: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    nodes = graph.get("nodes") or []
    edges = graph.get("edges") or []
    node_map = {str(n.get("id")): n for n in nodes if n.get("id") is not None}
    outgoing: Dict[str, List[Dict[str, Any]]] = {}
    in_degree: Dict[str, int] = {nid: 0 for nid in node_map}

    for e in edges:
        src = str(e.get("source") or "")
        tgt = str(e.get("target") or "")
        if src in node_map and tgt in node_map:
            outgoing.setdefault(src, []).append(e)
            in_degree[tgt] = in_degree.get(tgt, 0) + 1

    queue: List[str] = [nid for nid, deg in in_degree.items() if deg == 0]
    if not queue and nodes:
        first_id = str(nodes[0].get("id"))
        if first_id in node_map:
            queue = [first_id]

    visited = set()
    executed_steps: List[Dict[str, Any]] = []
    max_steps = max(len(node_map) * 3, 20)

    while queue and len(executed_steps) < max_steps:
        curr_id = queue.pop(0)
        if curr_id in visited:
            continue
        visited.add(curr_id)
        node = node_map[curr_id]
        step_res = _execute_workflow_node(conn, tenant_id, node, context)
        executed_steps.append(step_res)

        out_edges = outgoing.get(curr_id, [])
        if step_res.get("type") == "condition" and out_edges:
            chosen = str(step_res.get("branch") or "yes").lower()
            pos_tokens = {"yes", "true", "interested", "qualified", "pass", "match"}
            neg_tokens = {"no", "false", "not_interested", "unqualified", "fail", "else"}
            matched_targets: List[str] = []
            for e in out_edges:
                handle_or_label = str(e.get("sourceHandle") or e.get("label") or "").strip().lower()
                if chosen == "yes" and (handle_or_label in pos_tokens or (not handle_or_label and len(matched_targets) == 0)):
                    matched_targets.append(str(e["target"]))
                elif chosen == "no" and handle_or_label in neg_tokens:
                    matched_targets.append(str(e["target"]))
            for tgt in matched_targets:
                if tgt not in visited:
                    queue.append(tgt)
        else:
            for e in out_edges:
                tgt = str(e["target"])
                if tgt not in visited:
                    queue.append(tgt)

    return {"steps": executed_steps, "visited_node_ids": [s["node_id"] for s in executed_steps]}


def trigger_workflow_execution(
    conn: Any,
    tenant_id: str,
    workflow_id: str,
    trigger_event: str,
    context: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Start a workflow execution.
    Evaluates the React Flow graph + conditional branches locally, and attempts Temporal dispatch
    when TEMPORAL_ADDRESS & temporalio SDK are configured and reachable.
    """
    exec_id = f"wfe_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()
    temporal_wf_id = f"trivaana-{tenant_id}-{exec_id}"
    cur = conn.cursor()

    cur.execute("SELECT * FROM workflows WHERE id = ? AND tenant_id = ?", (workflow_id, tenant_id))
    wf = cur.fetchone()
    if not wf:
        raise ValueError("Workflow not found")

    graph = json.loads(wf["graph_json"] or '{"nodes":[],"edges":[]}')
    mode = "local_durable_outbox"
    status_str = "completed"
    completed_at: Optional[str] = now
    temporal_error: Optional[str] = None

    if settings.has_temporal:
        try:
            from temporalio.client import Client  # type: ignore

            async def _dispatch_temporal():
                client = await Client.connect(settings.TEMPORAL_ADDRESS, namespace=settings.TEMPORAL_NAMESPACE)
                await client.start_workflow(
                    "TrivaanaAutomationWorkflow",
                    {"workflow_id": workflow_id, "tenant_id": tenant_id, "trigger_event": trigger_event, "context": context, "graph": graph},
                    id=temporal_wf_id,
                    task_queue="trivaana-workflows",
                )

            asyncio.run(_dispatch_temporal())
            mode = "temporal"
            status_str = "queued"
            completed_at = None
            executed_steps = []
        except Exception as exc:
            temporal_error = str(exc)

    if mode != "temporal":
        graph_res = _run_local_graph(conn, tenant_id, graph, context or {})
        executed_steps = graph_res["steps"]

    result_payload: Dict[str, Any] = {"mode": mode, "steps": executed_steps}
    if temporal_error:
        result_payload["temporal_fallback_reason"] = temporal_error

    cur.execute(
        """
        INSERT INTO workflow_executions (
            id, workflow_id, tenant_id, trigger_event, temporal_workflow_id,
            status, context_json, result_json, started_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            exec_id,
            workflow_id,
            tenant_id,
            trigger_event,
            temporal_wf_id,
            status_str,
            json.dumps(context),
            json.dumps(result_payload),
            now,
            completed_at,
        ),
    )
    conn.commit()
    return {
        "execution_id": exec_id,
        "temporal_workflow_id": temporal_wf_id,
        "mode": mode,
        "status": status_str,
        "steps_executed": len(executed_steps),
        "steps": executed_steps,
    }

