from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.db import get_db
from app.deps import get_current_user
from app.schemas import SprintCreate, SprintUpdate, SprintResponse
from app.models import Sprint, Project, ProjectMember, Task

router = APIRouter(prefix="/api/v1/sprints", tags=["sprints"])


async def _is_project_member(db: AsyncSession, project_id: str, user_id: str) -> bool:
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def _get_sprint(db: AsyncSession, sprint_id: str, user_id: str) -> Sprint | None:
    result = await db.execute(select(Sprint).where(Sprint.id == sprint_id))
    sprint = result.scalar_one_or_none()
    if not sprint:
        return None
    if not await _is_project_member(db, sprint.project_id, user_id):
        return None
    return sprint


@router.get("/project/{project_id}", response_model=list[SprintResponse])
async def list_sprints(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    if not await _is_project_member(db, project_id, current_user):
        raise HTTPException(status_code=403, detail="Not a project member")
    result = await db.execute(
        select(Sprint).where(Sprint.project_id == project_id).order_by(Sprint.created_at.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=SprintResponse)
async def create_sprint(
    data: SprintCreate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    if not await _is_project_member(db, data.project_id, current_user):
        raise HTTPException(status_code=403, detail="Not a project member")
    sprint = Sprint(**data.model_dump())
    db.add(sprint)
    await db.commit()
    await db.refresh(sprint)
    return sprint


@router.patch("/{sprint_id}", response_model=SprintResponse)
async def update_sprint(
    sprint_id: str,
    data: SprintUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    sprint = await _get_sprint(db, sprint_id, current_user)
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(sprint, field, value)
    await db.commit()
    await db.refresh(sprint)
    return sprint


@router.post("/{sprint_id}/start", response_model=SprintResponse)
async def start_sprint(
    sprint_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    sprint = await _get_sprint(db, sprint_id, current_user)
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    if sprint.status != "planned":
        raise HTTPException(status_code=400, detail="Only planned sprints can be started")
    sprint.status = "active"
    if not sprint.start_date:
        sprint.start_date = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(sprint)
    return sprint


@router.post("/{sprint_id}/complete", response_model=SprintResponse)
async def complete_sprint(
    sprint_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    sprint = await _get_sprint(db, sprint_id, current_user)
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    if sprint.status != "active":
        raise HTTPException(status_code=400, detail="Only active sprints can be completed")
    sprint.status = "completed"
    if not sprint.end_date:
        sprint.end_date = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(sprint)
    return sprint


@router.delete("/{sprint_id}")
async def delete_sprint(
    sprint_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    sprint = await _get_sprint(db, sprint_id, current_user)
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    # Clear sprint_id on tasks
    await db.execute(update(Task).where(Task.sprint_id == sprint_id).values(sprint_id=None))
    await db.delete(sprint)
    await db.commit()
    return {"ok": True}


@router.post("/{sprint_id}/tasks/{task_id}")
async def add_task_to_sprint(
    sprint_id: str,
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    sprint = await _get_sprint(db, sprint_id, current_user)
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.sprint_id = sprint_id
    await db.commit()
    return {"ok": True}


@router.delete("/{sprint_id}/tasks/{task_id}")
async def remove_task_from_sprint(
    sprint_id: str,
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    sprint = await _get_sprint(db, sprint_id, current_user)
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    result = await db.execute(select(Task).where(Task.id == task_id, Task.sprint_id == sprint_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found in this sprint")
    task.sprint_id = None
    await db.commit()
    return {"ok": True}
