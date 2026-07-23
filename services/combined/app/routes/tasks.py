from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.deps import get_current_user
from app.schemas import TaskCreate, TaskResponse, TaskUpdate
from app.services import TaskService

router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])


@router.post("/", response_model=TaskResponse)
async def create_task(
    data: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = TaskService(db)
    return await service.create(data, current_user)


@router.get("/", response_model=list[TaskResponse])
async def list_tasks(
    project_id: str | None = None,
    search_q: str | None = Query(None, description="Global search across title and description"),
    status: str | None = None,
    assignee_id: str | None = None,
    priority: str | None = None,
    tag_ids: str | None = Query(None, description="Comma-separated tag IDs"),
    sprint_id: str | None = None,
    due_date_from: str | None = None,
    due_date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = TaskService(db)
    tag_ids_list = tag_ids.split(",") if tag_ids else None
    if project_id:
        return await service.list_by_project(project_id, current_user)
    return await service.list_by_user(
        current_user,
        search_q=search_q,
        status=status,
        assignee_id=assignee_id,
        priority=priority,
        tag_ids=tag_ids_list,
        sprint_id=sprint_id,
        due_date_from=due_date_from,
        due_date_to=due_date_to,
        project_id=project_id,
    )


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = TaskService(db)
    task = await service.get(task_id, current_user)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    data: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = TaskService(db)
    task = await service.update(task_id, data, current_user)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = TaskService(db)
    deleted = await service.delete(task_id, current_user)
    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"ok": True}
