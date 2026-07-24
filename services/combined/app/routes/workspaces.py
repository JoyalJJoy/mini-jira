from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.deps import get_current_user
from app.schemas import (
    WorkspaceCreate, WorkspaceResponse, WorkspaceUpdate,
    WorkspaceMemberResponse, WorkspaceMemberInvite, WorkspaceMemberUpdate,
)
from app.services import WorkspaceService
from app.redis_client import cache_get, cache_set, cache_delete

router = APIRouter(prefix="/api/v1/workspaces", tags=["workspaces"])

CACHE_TTL = 60


def _ws_cache_key(user_id: str) -> str:
    return f"ws:list:{user_id}"


@router.post("/", response_model=WorkspaceResponse)
async def create_workspace(
    data: WorkspaceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = WorkspaceService(db)
    result = await service.create(data, current_user)
    await cache_delete(_ws_cache_key(current_user))
    return result


@router.get("/", response_model=list[WorkspaceResponse])
async def list_workspaces(
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    # Try cache
    cached = await cache_get(_ws_cache_key(current_user))
    if cached is not None:
        return cached

    service = WorkspaceService(db)
    workspaces = await service.list_by_user(current_user)

    # Store in cache (60s TTL)
    ws_list = [
        {
            "id": w.id,
            "name": w.name,
            "description": w.description,
            "owner_id": w.owner_id,
            "created_at": str(w.created_at),
            "updated_at": str(w.updated_at) if hasattr(w, 'updated_at') else None,
        }
        for w in workspaces
    ]
    await cache_set(_ws_cache_key(current_user), ws_list, ttl=CACHE_TTL)

    return ws_list


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = WorkspaceService(db)
    ws = await service.get(workspace_id, current_user)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: str,
    data: WorkspaceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = WorkspaceService(db)
    ws = await service.update(workspace_id, data, current_user)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws


@router.delete("/{workspace_id}")
async def delete_workspace(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = WorkspaceService(db)
    deleted = await service.delete(workspace_id, current_user)
    if not deleted:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return {"ok": True}


# ── Members ────────────────────────────────────────────────────────

@router.get("/{workspace_id}/members", response_model=list[WorkspaceMemberResponse])
async def list_members(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = WorkspaceService(db)
    members = await service.list_members(workspace_id, current_user)
    return members


@router.post("/{workspace_id}/members", response_model=WorkspaceMemberResponse)
async def add_member(
    workspace_id: str,
    data: WorkspaceMemberInvite,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = WorkspaceService(db)
    try:
        member = await service.add_member(workspace_id, data.email, data.role, current_user)
        return member
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{workspace_id}/members/{user_id}", response_model=WorkspaceMemberResponse)
async def change_member_role(
    workspace_id: str,
    user_id: str,
    data: WorkspaceMemberUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = WorkspaceService(db)
    member = await service.change_member_role(workspace_id, user_id, data.role, current_user)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@router.delete("/{workspace_id}/members/{user_id}")
async def remove_member(
    workspace_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = WorkspaceService(db)
    try:
        deleted = await service.remove_member(workspace_id, user_id, current_user)
        if not deleted:
            raise HTTPException(status_code=404, detail="Member not found")
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
