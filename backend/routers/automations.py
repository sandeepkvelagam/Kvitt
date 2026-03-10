"""Automation endpoints: CRUD, templates, triggers, actions, run, replay, health.
Extracted from server.py — pure mechanical move, zero behavior changes."""

from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Depends, Query, Path
from pydantic import BaseModel

from dependencies import User, get_current_user
from db import queries

router = APIRouter(prefix="/api", tags=["automations"])


# ── Pydantic models ──────────────────────────────────────────────

class AutomationCreate(BaseModel):
    name: str
    description: Optional[str] = None
    trigger: Dict[str, Any]
    actions: List[Dict[str, Any]]
    conditions: Optional[Dict[str, Any]] = None
    execution_options: Optional[Dict[str, Any]] = None
    group_id: Optional[str] = None

class AutomationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger: Optional[Dict[str, Any]] = None
    actions: Optional[List[Dict[str, Any]]] = None
    conditions: Optional[Dict[str, Any]] = None
    execution_options: Optional[Dict[str, Any]] = None
    enabled: Optional[bool] = None

class AutomationToggle(BaseModel):
    enabled: bool

# Regex for automation IDs: auto_ + 12 hex chars
AUTOMATION_ID_PATTERN = r"^auto_[a-f0-9]{12}$"


# ── Static /automations/* routes (MUST come before /{automation_id}) ──

@router.get("/automations")
async def list_automations(current_user: User = Depends(get_current_user)):
    """List all automations for the current user."""
    from ai_service.tools.automation_builder import AutomationBuilderTool
    builder = AutomationBuilderTool()
    result = await builder.execute(action="list", user_id=current_user.user_id)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return {"success": True, "data": result.data}

@router.post("/automations")
async def create_automation(data: AutomationCreate, current_user: User = Depends(get_current_user)):
    """Create a new automation."""
    from ai_service.tools.automation_builder import AutomationBuilderTool
    from ai_service.tools.automation_policy import AutomationPolicyTool
    builder = AutomationBuilderTool(policy_tool=AutomationPolicyTool())
    result = await builder.execute(
        action="create",
        user_id=current_user.user_id,
        name=data.name,
        description=data.description,
        trigger=data.trigger,
        actions=data.actions,
        conditions=data.conditions or {},
        execution_options=data.execution_options or {},
        group_id=data.group_id,
    )
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    return {"success": True, "data": result.data, "message": result.message}

@router.get("/automations/templates")
async def get_automation_templates(
    group_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """Get suggested automation templates."""
    from ai_service.tools.automation_builder import AutomationBuilderTool
    builder = AutomationBuilderTool()
    result = await builder.execute(
        action="suggest_templates",
        user_id=current_user.user_id,
        group_id=group_id,
    )
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return {"success": True, "data": result.data}

@router.get("/automations/triggers/available")
async def list_available_triggers(current_user: User = Depends(get_current_user)):
    """List available trigger types."""
    from ai_service.tools.automation_builder import AutomationBuilderTool
    builder = AutomationBuilderTool()
    result = await builder.execute(action="list_triggers", user_id=current_user.user_id)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return {"success": True, "data": result.data}

@router.get("/automations/actions/available")
async def list_available_actions(current_user: User = Depends(get_current_user)):
    """List available action types."""
    from ai_service.tools.automation_builder import AutomationBuilderTool
    builder = AutomationBuilderTool()
    result = await builder.execute(action="list_actions", user_id=current_user.user_id)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    return {"success": True, "data": result.data}

@router.get("/automations/usage/cost-budget")
async def get_cost_budget(current_user: User = Depends(get_current_user)):
    """Get the user's action cost budget usage for today."""
    from ai_service.tools.automation_policy import AutomationPolicyTool
    policy = AutomationPolicyTool()
    result = await policy.execute(action="get_usage_stats", user_id=current_user.user_id)
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    data = result.data or {}
    return {
        "success": True,
        "data": {
            "today_cost_points": data.get("today_cost_points", 0),
            "max_daily_cost_points": data.get("max_daily_cost_points", 100),
            "cost_budget_remaining": data.get("cost_budget_remaining", 100),
            "action_cost_table": data.get("action_cost_table", {}),
            "today_executions": data.get("today_executions", 0),
            "max_daily_executions": data.get("max_daily_executions", 50),
        }
    }


# ── Dynamic /automations/{automation_id} routes ──────────────────

@router.get("/automations/{automation_id}")
async def get_automation(
    automation_id: str = Path(..., pattern=AUTOMATION_ID_PATTERN),
    current_user: User = Depends(get_current_user),
):
    """Get a single automation by ID."""
    from ai_service.tools.automation_builder import AutomationBuilderTool
    builder = AutomationBuilderTool()
    result = await builder.execute(action="get", user_id=current_user.user_id, automation_id=automation_id)
    if not result.success:
        raise HTTPException(status_code=404, detail=result.error)
    return {"success": True, "data": result.data}

@router.put("/automations/{automation_id}")
async def update_automation(
    data: AutomationUpdate,
    automation_id: str = Path(..., pattern=AUTOMATION_ID_PATTERN),
    current_user: User = Depends(get_current_user),
):
    """Update an existing automation."""
    from ai_service.tools.automation_builder import AutomationBuilderTool
    from ai_service.tools.automation_policy import AutomationPolicyTool
    builder = AutomationBuilderTool(policy_tool=AutomationPolicyTool())
    update_kwargs = {k: v for k, v in data.model_dump().items() if v is not None}
    result = await builder.execute(
        action="update",
        user_id=current_user.user_id,
        automation_id=automation_id,
        **update_kwargs,
    )
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    return {"success": True, "data": result.data, "message": result.message}

@router.delete("/automations/{automation_id}")
async def delete_automation(
    automation_id: str = Path(..., pattern=AUTOMATION_ID_PATTERN),
    current_user: User = Depends(get_current_user),
):
    """Delete an automation."""
    from ai_service.tools.automation_builder import AutomationBuilderTool
    builder = AutomationBuilderTool()
    result = await builder.execute(action="delete", user_id=current_user.user_id, automation_id=automation_id)
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    return {"success": True, "message": result.message}

@router.post("/automations/{automation_id}/toggle")
async def toggle_automation(
    data: AutomationToggle,
    automation_id: str = Path(..., pattern=AUTOMATION_ID_PATTERN),
    current_user: User = Depends(get_current_user),
):
    """Set an automation's enabled state. Client sends desired enabled boolean."""
    from ai_service.tools.automation_builder import AutomationBuilderTool
    builder = AutomationBuilderTool()
    result = await builder.execute(
        action="toggle",
        user_id=current_user.user_id,
        automation_id=automation_id,
        enabled=data.enabled,
    )
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    return {"success": True, "data": result.data, "message": result.message}

@router.post("/automations/{automation_id}/run")
async def run_automation(
    automation_id: str = Path(..., pattern=AUTOMATION_ID_PATTERN),
    current_user: User = Depends(get_current_user),
):
    """Manually trigger an automation (dry-run)."""
    from ai_service.tools.automation_runner import AutomationRunnerTool
    from ai_service.tools.automation_policy import AutomationPolicyTool
    runner = AutomationRunnerTool()
    automation = await queries.generic_find_one("user_automations", {"automation_id": automation_id, "user_id": current_user.user_id})
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    result = await runner.execute(
        action="dry_run",
        user_id=current_user.user_id,
        automation_id=automation_id,
        event_data={"source": "manual_trigger"},
    )
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    return {"success": True, "data": result.data, "message": result.message}

@router.get("/automations/{automation_id}/history")
async def get_automation_history(
    automation_id: str = Path(..., pattern=AUTOMATION_ID_PATTERN),
    limit: int = Query(default=20, le=100),
    current_user: User = Depends(get_current_user),
):
    """Get execution history for an automation."""
    runs = await queries.generic_find("automation_runs", {"automation_id": automation_id, "user_id": current_user.user_id}, limit=limit, order_by="started_at DESC")
    return {"success": True, "data": runs}

@router.post("/automations/{automation_id}/replay")
async def replay_automation(
    automation_id: str = Path(..., pattern=AUTOMATION_ID_PATTERN),
    current_user: User = Depends(get_current_user),
):
    """Re-run an automation bypassing dedupe (force replay)."""
    from ai_service.tools.automation_runner import AutomationRunnerTool
    runner = AutomationRunnerTool()
    automation = await queries.generic_find_one("user_automations", {"automation_id": automation_id, "user_id": current_user.user_id})
    if not automation:
        raise HTTPException(status_code=404, detail="Automation not found")
    result = await runner.execute(
        action="run_automation",
        automation_id=automation_id,
        event_data={"source": "manual_replay"},
        force_replay=True,
    )
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    return {"success": True, "data": result.data, "message": result.message}

@router.get("/automations/{automation_id}/health")
async def get_automation_health(
    automation_id: str = Path(..., pattern=AUTOMATION_ID_PATTERN),
    current_user: User = Depends(get_current_user),
):
    """Get the health score for a single automation."""
    from ai_service.tools.automation_builder import AutomationBuilderTool
    builder = AutomationBuilderTool()
    result = await builder.execute(action="get", user_id=current_user.user_id, automation_id=automation_id)
    if not result.success:
        raise HTTPException(status_code=404, detail=result.error)
    return {"success": True, "data": {"health": result.data.get("health")}}
