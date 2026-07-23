from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.comment import Comment
from app.schemas.comment import CommentCreate, CommentUpdate


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
