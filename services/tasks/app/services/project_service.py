from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate


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
