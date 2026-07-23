from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskUpdate
from app.core.event_bus import event_bus


class TaskService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: TaskCreate, user_id: str) -> Task:
        task_data = data.model_dump(exclude_unset=True)
        task_data.setdefault("priority", "p2")
        task_data["owner_id"] = user_id
        task = Task(**task_data)
        self.db.add(task)
        await self.db.commit()
        await self.db.refresh(task)
        await event_bus.publish("task.created", {
            "id": task.id,
            "title": task.title,
            "owner_id": task.owner_id,
        })
        return task

    async def list_by_user(self, user_id: str) -> list[Task]:
        result = await self.db.execute(
            select(Task).where(Task.owner_id == user_id).order_by(Task.created_at.desc())
        )
        return result.scalars().all()

    async def list_by_project(self, project_id: str, user_id: str) -> list[Task]:
        result = await self.db.execute(
            select(Task).where(Task.project_id == project_id, Task.owner_id == user_id)
            .order_by(Task.created_at.desc())
        )
        return result.scalars().all()

    async def get(self, task_id: str, user_id: str) -> Task | None:
        result = await self.db.execute(
            select(Task).where(Task.id == task_id, Task.owner_id == user_id)
        )
        return result.scalar_one_or_none()

    async def update(self, task_id: str, data: TaskUpdate, user_id: str) -> Task | None:
        task = await self.get(task_id, user_id)
        if not task:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(task, field, value)
        await self.db.commit()
        await self.db.refresh(task)
        return task

    async def delete(self, task_id: str, user_id: str) -> bool:
        task = await self.get(task_id, user_id)
        if not task:
            return False
        await self.db.delete(task)
        await self.db.commit()
        return True
