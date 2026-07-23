from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.models import User, Task, Project, ProjectMember, Comment
from app.schemas import UserCreate, TaskCreate, TaskUpdate, ProjectCreate, ProjectUpdate, CommentCreate, CommentUpdate
from app.security import hash_password, verify_password, create_access_token
from app.event_bus import event_bus


# ── helpers ────────────────────────────────────────────────────────

async def _is_project_member(db: AsyncSession, project_id: str, user_id: str) -> bool:
    """Check if a user is a member of a project."""
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def _get_project_ids_for_user(db: AsyncSession, user_id: str) -> list[str]:
    """Return list of project IDs the user is a member of."""
    result = await db.execute(
        select(ProjectMember.project_id).where(ProjectMember.user_id == user_id)
    )
    return [row[0] for row in result.fetchall()]


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
        # If project_id set, verify user is a project member
        if data.project_id:
            if not await _is_project_member(self.db, data.project_id, user_id):
                raise ValueError("You are not a member of this project")

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

    async def _can_access_task(self, task_id: str, user_id: str) -> Task | None:
        """Return a task if user is owner or a project member."""
        result = await self.db.execute(
            select(Task).where(Task.id == task_id)
        )
        task = result.scalar_one_or_none()
        if not task:
            return None
        # Owner can always access
        if task.owner_id == user_id:
            return task
        # If task has a project, check membership
        if task.project_id:
            if await _is_project_member(self.db, task.project_id, user_id):
                return task
        return None

    async def list_by_user(self, user_id: str) -> list[Task]:
        project_ids = await _get_project_ids_for_user(self.db, user_id)
        if project_ids:
            result = await self.db.execute(
                select(Task)
                .where(or_(Task.owner_id == user_id, Task.project_id.in_(project_ids)))
                .order_by(Task.created_at.desc())
            )
        else:
            result = await self.db.execute(
                select(Task).where(Task.owner_id == user_id).order_by(Task.created_at.desc())
            )
        return result.scalars().all()

    async def list_by_project(self, project_id: str, user_id: str) -> list[Task]:
        if not await _is_project_member(self.db, project_id, user_id):
            return []
        result = await self.db.execute(
            select(Task).where(Task.project_id == project_id)
            .order_by(Task.created_at.desc())
        )
        return result.scalars().all()

    async def get(self, task_id: str, user_id: str) -> Task | None:
        return await self._can_access_task(task_id, user_id)

    async def update(self, task_id: str, data: TaskUpdate, user_id: str) -> Task | None:
        task = await self._can_access_task(task_id, user_id)
        if not task:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(task, field, value)
        await self.db.commit()
        await self.db.refresh(task)
        return task

    async def delete(self, task_id: str, user_id: str) -> bool:
        task = await self._can_access_task(task_id, user_id)
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
        await self.db.flush()

        # Auto-add creator as owner member
        member = ProjectMember(project_id=project.id, user_id=user_id, role="owner")
        self.db.add(member)
        await self.db.commit()
        await self.db.refresh(project)
        return project

    async def list_by_user(self, user_id: str) -> list[Project]:
        # Projects where user is owner or member
        project_ids = await _get_project_ids_for_user(self.db, user_id)
        if not project_ids:
            return []
        result = await self.db.execute(
            select(Project).where(Project.id.in_(project_ids)).order_by(Project.created_at)
        )
        return result.scalars().all()

    async def _get_if_member(self, project_id: str, user_id: str) -> Project | None:
        """Return project only if user is a member."""
        if not await _is_project_member(self.db, project_id, user_id):
            return None
        result = await self.db.execute(select(Project).where(Project.id == project_id))
        return result.scalar_one_or_none()

    async def _get_if_owner(self, project_id: str, user_id: str) -> Project | None:
        """Return project only if user is the owner."""
        result = await self.db.execute(
            select(Project).where(Project.id == project_id, Project.owner_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get(self, project_id: str, user_id: str) -> Project | None:
        return await self._get_if_member(project_id, user_id)

    async def update(self, project_id: str, data: ProjectUpdate, user_id: str) -> Project | None:
        project = await self._get_if_owner(project_id, user_id)
        if not project:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(project, field, value)
        await self.db.commit()
        await self.db.refresh(project)
        return project

    async def delete(self, project_id: str, user_id: str) -> bool:
        project = await self._get_if_owner(project_id, user_id)
        if not project:
            return False
        await self.db.delete(project)
        await self.db.commit()
        return True

    # ── Member management ──────────────────────────────────────────

    async def add_member(self, project_id: str, email: str, role: str, current_user: str) -> ProjectMember:
        """Add a user to a project by email. Only owner can add."""
        if not await self._get_if_owner(project_id, current_user):
            raise ValueError("Only the project owner can add members")

        # Find user by email
        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            raise ValueError(f"User with email '{email}' not found")

        # Check not already a member
        result = await self.db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user.id,
            )
        )
        if result.scalar_one_or_none():
            raise ValueError("User is already a member of this project")

        member = ProjectMember(project_id=project_id, user_id=user.id, role=role)
        self.db.add(member)
        await self.db.commit()
        await self.db.refresh(member)
        return member

    async def remove_member(self, project_id: str, user_id: str, current_user: str) -> bool:
        """Remove a member from a project. Only owner can remove."""
        if not await self._get_if_owner(project_id, current_user):
            raise ValueError("Only the project owner can remove members")

        # Can't remove the owner
        if user_id == current_user:
            raise ValueError("Cannot remove the project owner")

        result = await self.db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id,
            )
        )
        member = result.scalar_one_or_none()
        if not member:
            return False
        await self.db.delete(member)
        await self.db.commit()
        return True

    async def list_members(self, project_id: str, user_id: str) -> list[ProjectMember]:
        """List project members. Any member can view."""
        if not await _is_project_member(self.db, project_id, user_id):
            return []
        result = await self.db.execute(
            select(ProjectMember).where(ProjectMember.project_id == project_id)
        )
        return result.scalars().all()


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
