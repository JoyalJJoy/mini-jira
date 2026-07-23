from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.deps import get_current_user
from app.schemas import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services import ProjectService

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


@router.post("/", response_model=ProjectResponse)
async def create_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = ProjectService(db)
    return await service.create(data, current_user)


@router.get("/", response_model=list[ProjectResponse])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = ProjectService(db)
    return await service.list_by_user(current_user)


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
    return project


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
    return {"ok": True}
