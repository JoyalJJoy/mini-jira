from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.schemas.comment import CommentCreate, CommentResponse, CommentUpdate
from app.services.comment_service import CommentService

router = APIRouter(prefix="/tasks/{task_id}/comments", tags=["comments"])


@router.post("/", response_model=CommentResponse)
async def create_comment(
    task_id: str,
    data: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = CommentService(db)
    return await service.create(task_id, data, current_user)


@router.get("/", response_model=list[CommentResponse])
async def list_comments(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = CommentService(db)
    return await service.list_by_task(task_id)


@router.patch("/{comment_id}", response_model=CommentResponse)
async def update_comment(
    task_id: str,
    comment_id: str,
    data: CommentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = CommentService(db)
    comment = await service.update(comment_id, data, current_user)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found or not yours")
    return comment


@router.delete("/{comment_id}")
async def delete_comment(
    task_id: str,
    comment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    service = CommentService(db)
    deleted = await service.delete(comment_id, current_user)
    if not deleted:
        raise HTTPException(status_code=404, detail="Comment not found or not yours")
    return {"ok": True}
