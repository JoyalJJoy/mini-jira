from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate
from app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])

@router.post("/", response_model=TaskResponse)
async def create_task(
    data: TaskCreate,
    db : AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)):
    service = TaskService(db)
    return await service.create(data, current_user)

@router.get("/", response_model=list[TaskResponse])
async def list_tasks(
    project_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)):
    service = TaskService(db)
    if project_id:
        return await service.list_by_project(project_id, current_user)
    return await service.list_by_user(current_user)

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)):
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
    current_user: str = Depends(get_current_user)):
    service = TaskService(db)
    task = await service.update(task_id, data, current_user)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)):
    service = TaskService(db)
    deleted = await service.delete(task_id, current_user)
    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"ok" : True}
