"""
TRIVAANA AI: Role-Based Access Control (RBAC) & Scope Permissions Matrix
Covers Platform/Staff roles and Customer Workspace roles.
"""

from typing import Dict, Iterable, Set

# Customer workspace role hierarchy (ascending privilege)
WORKSPACE_ROLE_HIERARCHY: Dict[str, int] = {
    "owner": 5,
    "customer_admin": 4,
    "admin": 4,
    "customer_manager": 3,
    "manager": 3,
    "operator": 2,
    "customer_agent": 2,
    "agent": 2,
    "viewer": 1,
}

# Internal platform & staff roles
STAFF_ROLES: Set[str] = {
    "platform_owner",
    "super_admin",
    "operations_manager",
    "finance_manager",
    "customer_support",
    "technical_engineer",
    "sales_manager",
    "compliance_officer",
}


def has_workspace_role(user_role: str, allowed_roles: Iterable[str]) -> bool:
    """Evaluate role membership respecting WORKSPACE_ROLE_HIERARCHY."""
    normalized = (user_role or "viewer").lower()
    allowed_set = {r.lower() for r in allowed_roles}
    if normalized in allowed_set:
        return True
    user_level = WORKSPACE_ROLE_HIERARCHY.get(normalized, 0)
    if user_level <= 0:
        return False
    min_required = min((WORKSPACE_ROLE_HIERARCHY.get(r, 99) for r in allowed_set), default=99)
    return user_level >= min_required


def is_staff_or_admin(user: Dict) -> bool:
    if user.get("is_super_admin"):
        return True
    role = (user.get("role") or "").lower()
    staff_role = (user.get("staff_role") or "").lower()
    return role in STAFF_ROLES or staff_role in STAFF_ROLES


def api_key_allows_scope(scopes: Iterable[str], required_scope: str) -> bool:
    scope_set = {str(s).strip().lower() for s in scopes}
    if "*" in scope_set:
        return True
    req = required_scope.strip().lower()
    if req in scope_set:
        return True
    # Prefix match e.g. 'calls:*' allows 'calls:write'
    domain = req.split(":", 1)[0]
    return f"{domain}:*" in scope_set

