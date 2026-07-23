from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.deps import get_current_user
from app.schemas import TagCreate, TagResponse
from app.services import TagService

router = APIRouter(prefix="/api/v1/projects/{project_id}/tags", tags=["tags"])


@router.post("/", response_model=TagResponse)
async def create_tag(
    project_id: str,
    data: TagCreate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = TagService(db)
    return await service.create(data, project_id)


@router.get("/", response_model=list[TagResponse])
async def list_tags(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = TagService(db)
    return await service.list_by_project(project_id)


@router.delete("/{tag_id}")
async def delete_tag(
    project_id: str,
    tag_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = TagService(db)
    deleted = await service.delete(tag_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Tag not found")
    return {"ok": True}
