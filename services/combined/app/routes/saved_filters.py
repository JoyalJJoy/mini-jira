import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db import get_db
from app.deps import get_current_user
from app.schemas import SavedFilterCreate, SavedFilterUpdate, SavedFilterResponse
from app.models import SavedFilter

router = APIRouter(prefix="/api/v1/filters", tags=["saved-filters"])


@router.get("/", response_model=list[SavedFilterResponse])
async def list_filters(
    workspace_id: str | None = None,
    project_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    conditions = [SavedFilter.owner_id == current_user]
    if workspace_id:
        conditions.append(SavedFilter.workspace_id == workspace_id)
    if project_id:
        conditions.append(SavedFilter.project_id == project_id)
    result = await db.execute(
        select(SavedFilter).where(*conditions).order_by(SavedFilter.created_at.desc())
    )
    filters = result.scalars().all()
    # Parse criteria JSON string into dict for response
    for f in filters:
        if isinstance(f.criteria, str):
            try:
                f.criteria = json.loads(f.criteria)
            except (json.JSONDecodeError, TypeError):
                f.criteria = {}
    return filters


@router.post("/", response_model=SavedFilterResponse)
async def create_filter(
    data: SavedFilterCreate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    sf = SavedFilter(
        name=data.name,
        owner_id=current_user,
        workspace_id=data.workspace_id,
        project_id=data.project_id,
        criteria=json.dumps(data.criteria),
    )
    db.add(sf)
    await db.commit()
    await db.refresh(sf)
    sf.criteria = data.criteria  # return the dict, not JSON string
    return sf


@router.patch("/{filter_id}", response_model=SavedFilterResponse)
async def update_filter(
    filter_id: str,
    data: SavedFilterUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    result = await db.execute(
        select(SavedFilter).where(SavedFilter.id == filter_id, SavedFilter.owner_id == current_user)
    )
    sf = result.scalar_one_or_none()
    if not sf:
        raise HTTPException(status_code=404, detail="Filter not found")
    if data.name is not None:
        sf.name = data.name
    if data.criteria is not None:
        sf.criteria = json.dumps(data.criteria)
    await db.commit()
    await db.refresh(sf)
    if isinstance(sf.criteria, str):
        try:
            sf.criteria = json.loads(sf.criteria)
        except (json.JSONDecodeError, TypeError):
            sf.criteria = {}
    return sf


@router.delete("/{filter_id}")
async def delete_filter(
    filter_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    result = await db.execute(
        select(SavedFilter).where(SavedFilter.id == filter_id, SavedFilter.owner_id == current_user)
    )
    sf = result.scalar_one_or_none()
    if not sf:
        raise HTTPException(status_code=404, detail="Filter not found")
    await db.delete(sf)
    await db.commit()
    return {"ok": True}
