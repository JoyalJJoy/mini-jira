from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, delete
from app.models import User, Task, TaskTag, Project, ProjectMember, Comment, Tag, Workspace, WorkspaceMember
from app.schemas import UserCreate, TaskCreate, TaskUpdate, ProjectCreate, ProjectUpdate, CommentCreate, CommentUpdate, TagCreate, WorkspaceCreate, WorkspaceUpdate, WorkspaceMemberUpdate
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


# ── helpers: workspace member check ────────────────────────────────

async def _is_workspace_member(db: AsyncSession, workspace_id: str, user_id: str) -> bool:
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def _get_workspace_ids_for_user(db: AsyncSession, user_id: str) -> list[str]:
    result = await db.execute(
        select(WorkspaceMember.workspace_id).where(WorkspaceMember.user_id == user_id)
    )
    return [row[0] for row in result.fetchall()]


# ── Workspace Service ─────────────────────────────────────────────

class WorkspaceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: WorkspaceCreate, user_id: str) -> Workspace:
        ws = Workspace(**data.model_dump(), owner_id=user_id)
        self.db.add(ws)
        await self.db.flush()

        # Auto-add creator as admin
        member = WorkspaceMember(workspace_id=ws.id, user_id=user_id, role="admin")
        self.db.add(member)

        # Auto-create a "General" project in the workspace
        project = Project(name="General", description="Default project", owner_id=user_id, workspace_id=ws.id)
        self.db.add(project)
        await self.db.flush()

        # Auto-add creator as owner member of the project too
        pmember = ProjectMember(project_id=project.id, user_id=user_id, role="owner")
        self.db.add(pmember)

        await self.db.commit()
        await self.db.refresh(ws)
        return ws

    async def list_by_user(self, user_id: str) -> list[Workspace]:
        ws_ids = await _get_workspace_ids_for_user(self.db, user_id)
        if not ws_ids:
            return []
        result = await self.db.execute(
            select(Workspace).where(Workspace.id.in_(ws_ids)).order_by(Workspace.created_at)
        )
        return result.scalars().all()

    async def get(self, workspace_id: str, user_id: str) -> Workspace | None:
        if not await _is_workspace_member(self.db, workspace_id, user_id):
            return None
        result = await self.db.execute(select(Workspace).where(Workspace.id == workspace_id))
        return result.scalar_one_or_none()

    async def _get_if_admin(self, workspace_id: str, user_id: str) -> Workspace | None:
        ws = await self.get(workspace_id, user_id)
        if not ws:
            return None
        # Check role is admin
        result = await self.db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == user_id,
                WorkspaceMember.role == "admin",
            )
        )
        if result.scalar_one_or_none() is None:
            return None
        return ws

    async def update(self, workspace_id: str, data: WorkspaceUpdate, user_id: str) -> Workspace | None:
        ws = await self._get_if_admin(workspace_id, user_id)
        if not ws:
            return None
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(ws, field, value)
        await self.db.commit()
        await self.db.refresh(ws)
        return ws

    async def delete(self, workspace_id: str, user_id: str) -> bool:
        """Only the owner can delete a workspace."""
        result = await self.db.execute(
            select(Workspace).where(Workspace.id == workspace_id, Workspace.owner_id == user_id)
        )
        ws = result.scalar_one_or_none()
        if not ws:
            return False
        # Cascade: delete workspace members, then projects (and their members/tasks/tags/comments)
        await self.db.execute(delete(WorkspaceMember).where(WorkspaceMember.workspace_id == workspace_id))
        # Delete all projects in this workspace (cascades will be handled by app logic)
        proj_result = await self.db.execute(select(Project).where(Project.workspace_id == workspace_id))
        for project in proj_result.scalars().all():
            await self.db.execute(delete(ProjectMember).where(ProjectMember.project_id == project.id))
            await self.db.execute(delete(TaskTag).where(TaskTag.task_id.in_(
                select(Task.id).where(Task.project_id == project.id)
            )))
            await self.db.execute(delete(Comment).where(Comment.task_id.in_(
                select(Task.id).where(Task.project_id == project.id)
            )))
            await self.db.execute(delete(Task).where(Task.project_id == project.id))
            await self.db.execute(delete(Tag).where(Tag.project_id == project.id))
            await self.db.delete(project)
        await self.db.delete(ws)
        await self.db.commit()
        return True

    # ── Member management ──────────────────────────────────────────

    async def add_member(self, workspace_id: str, email: str, role: str, current_user: str) -> WorkspaceMember:
        if not await self._get_if_admin(workspace_id, current_user):
            raise ValueError("Only workspace admins can add members")

        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            raise ValueError(f"User with email '{email}' not found")

        result = await self.db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == user.id,
            )
        )
        if result.scalar_one_or_none():
            raise ValueError("User is already a member of this workspace")

        member = WorkspaceMember(workspace_id=workspace_id, user_id=user.id, role=role)
        self.db.add(member)

        # Also auto-add to all existing projects in this workspace
        proj_result = await self.db.execute(
            select(Project).where(Project.workspace_id == workspace_id)
        )
        for project in proj_result.scalars().all():
            existing = await self.db.execute(
                select(ProjectMember).where(
                    ProjectMember.project_id == project.id,
                    ProjectMember.user_id == user.id,
                )
            )
            if not existing.scalar_one_or_none():
                self.db.add(ProjectMember(project_id=project.id, user_id=user.id, role="member"))

        await self.db.commit()
        await self.db.refresh(member)
        return member

    async def remove_member(self, workspace_id: str, user_id: str, current_user: str) -> bool:
        if not await self._get_if_admin(workspace_id, current_user):
            raise ValueError("Only workspace admins can remove members")

        if user_id == current_user:
            raise ValueError("Cannot remove yourself from the workspace")

        result = await self.db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == user_id,
            )
        )
        member = result.scalar_one_or_none()
        if not member:
            return False

        # Remove from all projects in this workspace too
        proj_ids_result = await self.db.execute(
            select(Project.id).where(Project.workspace_id == workspace_id)
        )
        proj_ids = [row[0] for row in proj_ids_result.fetchall()]
        if proj_ids:
            await self.db.execute(
                delete(ProjectMember).where(
                    ProjectMember.project_id.in_(proj_ids),
                    ProjectMember.user_id == user_id,
                )
            )

        await self.db.delete(member)
        await self.db.commit()
        return True

    async def change_member_role(self, workspace_id: str, user_id: str, role: str, current_user: str) -> WorkspaceMember | None:
        if not await self._get_if_admin(workspace_id, current_user):
            raise ValueError("Only workspace admins can change roles")

        result = await self.db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == user_id,
            )
        )
        member = result.scalar_one_or_none()
        if not member:
            return None
        member.role = role
        await self.db.commit()
        await self.db.refresh(member)
        return member

    async def list_members(self, workspace_id: str, user_id: str) -> list[WorkspaceMember]:
        if not await _is_workspace_member(self.db, workspace_id, user_id):
            return []
        result = await self.db.execute(
            select(WorkspaceMember).where(WorkspaceMember.workspace_id == workspace_id)
        )
        return result.scalars().all()


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

        tag_ids = data.tag_ids or []
        task_data = data.model_dump(exclude_unset=True, exclude={"tag_ids"})
        task_data.setdefault("priority", "p2")
        task_data["owner_id"] = user_id
        task = Task(**task_data)
        self.db.add(task)
        await self.db.flush()

        # Link tags
        for tag_id in tag_ids:
            self.db.add(TaskTag(task_id=task.id, tag_id=tag_id))

        await self.db.commit()
        await self.db.refresh(task)
        await event_bus.publish("task.created", {
            "id": task.id,
            "title": task.title,
            "owner_id": task.owner_id,
            "project_id": task.project_id,
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

        tag_ids = data.tag_ids
        update_data = data.model_dump(exclude_unset=True, exclude={"tag_ids"})

        for field, value in update_data.items():
            setattr(task, field, value)

        # Update tag links if provided
        if tag_ids is not None:
            await self.db.execute(delete(TaskTag).where(TaskTag.task_id == task.id))
            for tag_id in tag_ids:
                self.db.add(TaskTag(task_id=task.id, tag_id=tag_id))

        await self.db.commit()
        await self.db.refresh(task)
        await event_bus.publish("task.updated", {
            "id": task.id,
            "title": task.title,
            "status": task.status,
            "project_id": task.project_id,
        })
        return task

    async def delete(self, task_id: str, user_id: str) -> bool:
        task = await self._can_access_task(task_id, user_id)
        if not task:
            return False
        project_id = task.project_id
        await self.db.execute(delete(TaskTag).where(TaskTag.task_id == task.id))
        await self.db.delete(task)
        await self.db.commit()
        await event_bus.publish("task.deleted", {
            "id": task_id,
            "project_id": project_id,
        })
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

    async def list_by_user(self, user_id: str, workspace_id: str | None = None) -> list[Project]:
        # Projects where user is owner or member
        project_ids = await _get_project_ids_for_user(self.db, user_id)
        if not project_ids:
            return []
        query = select(Project).where(Project.id.in_(project_ids))
        if workspace_id:
            query = query.where(Project.workspace_id == workspace_id)
        result = await self.db.execute(query.order_by(Project.created_at))
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


# ── Tag / Label Service ────────────────────────────────────────────

class TagService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: TagCreate, project_id: str) -> Tag:
        tag = Tag(**data.model_dump(), project_id=project_id)
        self.db.add(tag)
        await self.db.commit()
        await self.db.refresh(tag)
        return tag

    async def list_by_project(self, project_id: str) -> list[Tag]:
        result = await self.db.execute(
            select(Tag).where(Tag.project_id == project_id).order_by(Tag.name)
        )
        return result.scalars().all()

    async def get_task_tags(self, task_id: str) -> list[Tag]:
        result = await self.db.execute(
            select(Tag).join(TaskTag).where(TaskTag.task_id == task_id)
        )
        return result.scalars().all()

    async def delete(self, tag_id: str) -> bool:
        result = await self.db.execute(select(Tag).where(Tag.id == tag_id))
        tag = result.scalar_one_or_none()
        if not tag:
            return False
        await self.db.execute(delete(TaskTag).where(TaskTag.tag_id == tag.id))
        await self.db.delete(tag)
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
        # Look up the task's project for the event
        result = await self.db.execute(select(Task).where(Task.id == task_id))
        task = result.scalar_one_or_none()
        await event_bus.publish("comment.created", {
            "id": comment.id,
            "task_id": task_id,
            "author_id": author_id,
            "content": comment.content,
            "project_id": task.project_id if task else None,
        })
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
