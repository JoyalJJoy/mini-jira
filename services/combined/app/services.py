from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import User, Task, Project, Comment
from app.schemas import UserCreate, TaskCreate, TaskUpdate, ProjectCreate, ProjectUpdate, CommentCreate, CommentUpdate
from app.security import hash_password, verify_password, create_access_token
from app.event_bus import event_bus


# ── User Service ───────────────────────────────────────────────────

class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def signup(self, data: UserCreate) -> User:
        result = await self.db.execute(select(User).where(User.email == data.email))
        if result.scalar_one_or_none():
            raise ValueError("Email already exists")

        user = User(
            email=data.email,
            hashed_password=hash_password(data.password),
            display_name=data.display_name,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def login(self, email: str, password: str) -> str:
        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if not user or not verify_password(password, user.hashed_password):
            raise ValueError("Invalid email or password")

        return create_access_token(user.id)


# ── Task Service ───────────────────────────────────────────────────

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


# ── Project Service ────────────────────────────────────────────────

class ProjectService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: ProjectCreate, user_id: str) -> Project:
        project = Project(**data.model_dump(), owner_id=user_id)
        self.db.add(project)
        await self.db.commit()
        await self.db.refresh(project)
        return project

    async def list_by_user(self, user_id: str) -> list[Project]:
        result = await self.db.execute(
            select(Project).where(Project.owner_id == user_id).order_by(Project.created_at)
        )
        return result.scalars().all()

    async def get(self, project_id: str, user_id: str) -> Project | None:
        result = await self.db.execute(
            select(Project).where(Project.id == project_id, Project.owner_id == user_id)
        )
        return result.scalar_one_or_none()

    async def update(self, project_id: str, data: ProjectUpdate, user_id: str) -> Project | None:
        project = await self.get(project_id, user_id)
        if not project:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(project, field, value)
        await self.db.commit()
        await self.db.refresh(project)
        return project

    async def delete(self, project_id: str, user_id: str) -> bool:
        result = await self.db.execute(
            select(Project).where(Project.id == project_id, Project.owner_id == user_id)
        )
        project = result.scalar_one_or_none()
        if not project:
            return False
        await self.db.delete(project)
        await self.db.commit()
        return True


# ── Comment Service ────────────────────────────────────────────────

class CommentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, task_id: str, data: CommentCreate, author_id: str) -> Comment:
        comment = Comment(task_id=task_id, author_id=author_id, content=data.content)
        self.db.add(comment)
        await self.db.commit()
        await self.db.refresh(comment)
        return comment

    async def list_by_task(self, task_id: str) -> list[Comment]:
        result = await self.db.execute(
            select(Comment).where(Comment.task_id == task_id).order_by(Comment.created_at)
        )
        return result.scalars().all()

    async def get(self, comment_id: str) -> Comment | None:
        result = await self.db.execute(
            select(Comment).where(Comment.id == comment_id)
        )
        return result.scalar_one_or_none()

    async def update(self, comment_id: str, data: CommentUpdate, user_id: str) -> Comment | None:
        comment = await self.get(comment_id)
        if not comment or comment.author_id != user_id:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(comment, field, value)
        await self.db.commit()
        await self.db.refresh(comment)
        return comment

    async def delete(self, comment_id: str, user_id: str) -> bool:
        comment = await self.get(comment_id)
        if not comment or comment.author_id != user_id:
            return False
        await self.db.delete(comment)
        await self.db.commit()
        return True
