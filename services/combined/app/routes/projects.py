from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.deps import get_current_user
from app.schemas import ProjectCreate, ProjectResponse, ProjectUpdate, MemberInvite, ProjectMemberResponse
from app.services import ProjectService
from app.redis_client import cache_get, cache_set, cache_delete

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])

CACHE_TTL = 60


def _proj_cache_key(user_id: str, workspace_id: str | None, include_archived: bool) -> str:
    return f"proj:list:{user_id}:{workspace_id or 'all'}:{int(include_archived)}"


@router.post("/", response_model=ProjectResponse)
async def create_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = ProjectService(db)
    result = await service.create(data, current_user)
    # Invalidate all project list caches for this user
    await cache_delete(f"proj:list:{current_user}:all:0")
    await cache_delete(f"proj:list:{current_user}:all:1")
    if data.workspace_id:
        await cache_delete(f"proj:list:{current_user}:{data.workspace_id}:0")
        await cache_delete(f"proj:list:{current_user}:{data.workspace_id}:1")
    return result


@router.get("/", response_model=list[ProjectResponse])
async def list_projects(
    workspace_id: str | None = Query(None, description="Filter by workspace"),
    include_archived: bool = Query(False, description="Include archived projects"),
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    # Try cache
    cache_key = _proj_cache_key(current_user, workspace_id, include_archived)
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    service = ProjectService(db)
    projects = await service.list_by_user(current_user, workspace_id, include_archived)

    # Store in cache
    proj_list = [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "owner_id": p.owner_id,
            "workspace_id": p.workspace_id,
            "icon": p.icon,
            "color": p.color,
            "is_archived": p.is_archived,
            "created_at": str(p.created_at),
            "updated_at": str(p.updated_at) if hasattr(p, 'updated_at') else None,
        }
        for p in projects
    ]
    await cache_set(cache_key, proj_list, ttl=CACHE_TTL)

    return proj_list


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = ProjectService(db)
    project = await service.get(project_id, current_user)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    data: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = ProjectService(db)
    project = await service.update(project_id, data, current_user)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # Invalidate project list caches
    ws_id = project.workspace_id
    await cache_delete(f"proj:list:{current_user}:all:0")
    await cache_delete(f"proj:list:{current_user}:all:1")
    if ws_id:
        await cache_delete(f"proj:list:{current_user}:{ws_id}:0")
        await cache_delete(f"proj:list:{current_user}:{ws_id}:1")
    return project


@router.get("/{project_id}/members", response_model=list[ProjectMemberResponse])
async def list_members(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = ProjectService(db)
    members = await service.list_members(project_id, current_user)
    return members


@router.post("/{project_id}/members", response_model=ProjectMemberResponse)
async def add_member(
    project_id: str,
    data: MemberInvite,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = ProjectService(db)
    try:
        member = await service.add_member(project_id, data.email, data.role, current_user)
        return member
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{project_id}/members/{user_id}")
async def remove_member(
    project_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = ProjectService(db)
    try:
        deleted = await service.remove_member(project_id, user_id, current_user)
        if not deleted:
            raise HTTPException(status_code=404, detail="Member not found")
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = ProjectService(db)
    deleted = await service.delete(project_id, current_user)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")
    # Invalidate project list caches
    await cache_delete(f"proj:list:{current_user}:all:0")
    await cache_delete(f"proj:list:{current_user}:all:1")
    return {"ok": True}
