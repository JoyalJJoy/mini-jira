import base64
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.db import get_db
from app.deps import get_current_user
from app.schemas import ChecklistItemCreate, ChecklistItemUpdate, ChecklistItemResponse, AttachmentResponse, ActivityResponse
from app.models import Task, ChecklistItem, Attachment, Activity, ProjectMember

router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])


# ── Helpers ────────────────────────────────────────────────────────

async def _can_access_task(db: AsyncSession, task_id: str, user_id: str) -> Task | None:
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        return None
    if task.owner_id == user_id:
        return task
    if task.project_id:
        pm = await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == task.project_id,
                ProjectMember.user_id == user_id,
            )
        )
        if pm.scalar_one_or_none():
            return task
    return None


async def _log_activity(db: AsyncSession, task_id: str, user_id: str, action: str, field_name: str | None = None, old_value: str | None = None, new_value: str | None = None):
    act = Activity(task_id=task_id, user_id=user_id, action=action, field_name=field_name, old_value=old_value, new_value=new_value)
    db.add(act)
    await db.flush()


# ── Checklist Items ──────────────────────────────────────────────

@router.get("/{task_id}/checklists", response_model=list[ChecklistItemResponse])
async def list_checklists(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    if not await _can_access_task(db, task_id, current_user):
        raise HTTPException(status_code=404, detail="Task not found")
    result = await db.execute(
        select(ChecklistItem).where(ChecklistItem.task_id == task_id).order_by(ChecklistItem.position)
    )
    return result.scalars().all()


@router.post("/{task_id}/checklists", response_model=ChecklistItemResponse)
async def create_checklist(
    task_id: str,
    data: ChecklistItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    if not await _can_access_task(db, task_id, current_user):
        raise HTTPException(status_code=404, detail="Task not found")
    # Auto-position at end
    result = await db.execute(
        select(ChecklistItem).where(ChecklistItem.task_id == task_id).order_by(ChecklistItem.position.desc()).limit(1)
    )
    last = result.scalar_one_or_none()
    pos = (last.position + 1) if last else 0
    item = ChecklistItem(task_id=task_id, title=data.title, position=pos)
    db.add(item)
    await _log_activity(db, task_id, current_user, "added_checklist", "checklist", new_value=data.title)
    await db.commit()
    await db.refresh(item)
    return item


@router.patch("/{task_id}/checklists/{item_id}", response_model=ChecklistItemResponse)
async def update_checklist(
    task_id: str,
    item_id: str,
    data: ChecklistItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    if not await _can_access_task(db, task_id, current_user):
        raise HTTPException(status_code=404, detail="Task not found")
    result = await db.execute(
        select(ChecklistItem).where(ChecklistItem.id == item_id, ChecklistItem.task_id == task_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    old_done = item.is_done
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    if data.is_done is not None and data.is_done != old_done:
        await _log_activity(db, task_id, current_user, "checked" if data.is_done else "unchecked", "checklist", new_value=item.title)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{task_id}/checklists/{item_id}")
async def delete_checklist(
    task_id: str,
    item_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    if not await _can_access_task(db, task_id, current_user):
        raise HTTPException(status_code=404, detail="Task not found")
    result = await db.execute(
        select(ChecklistItem).where(ChecklistItem.id == item_id, ChecklistItem.task_id == task_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    await db.delete(item)
    await _log_activity(db, task_id, current_user, "removed_checklist", "checklist", old_value=item.title)
    await db.commit()
    return {"ok": True}


# ── Attachments ──────────────────────────────────────────────────

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

@router.get("/{task_id}/attachments", response_model=list[AttachmentResponse])
async def list_attachments(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
    include_data: bool = False,
):
    if not await _can_access_task(db, task_id, current_user):
        raise HTTPException(status_code=404, detail="Task not found")
    result = await db.execute(
        select(Attachment).where(Attachment.task_id == task_id).order_by(Attachment.created_at.desc())
    )
    atts = result.scalars().all()
    if not include_data:
        for a in atts:
            a.file_data = None
    return atts


@router.post("/{task_id}/attachments", response_model=AttachmentResponse)
async def upload_attachment(
    task_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    if not await _can_access_task(db, task_id, current_user):
        raise HTTPException(status_code=404, detail="Task not found")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 5 MB)")

    file_data = base64.b64encode(content).decode("utf-8")
    att = Attachment(
        task_id=task_id,
        author_id=current_user,
        file_name=file.filename or "unnamed",
        file_size=len(content),
        content_type=file.content_type or "application/octet-stream",
        file_data=file_data,
    )
    db.add(att)
    await _log_activity(db, task_id, current_user, "uploaded_attachment", "attachment", new_value=file.filename)
    await db.commit()
    await db.refresh(att)
    return att


@router.delete("/{task_id}/attachments/{att_id}")
async def delete_attachment(
    task_id: str,
    att_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    if not await _can_access_task(db, task_id, current_user):
        raise HTTPException(status_code=404, detail="Task not found")
    result = await db.execute(
        select(Attachment).where(Attachment.id == att_id, Attachment.task_id == task_id)
    )
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    await db.delete(att)
    await _log_activity(db, task_id, current_user, "removed_attachment", "attachment", old_value=att.file_name)
    await db.commit()
    return {"ok": True}


# ── Activity ─────────────────────────────────────────────────────

@router.get("/{task_id}/activity", response_model=list[ActivityResponse])
async def list_activity(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    if not await _can_access_task(db, task_id, current_user):
        raise HTTPException(status_code=404, detail="Task not found")
    result = await db.execute(
        select(Activity).where(Activity.task_id == task_id).order_by(Activity.created_at.desc()).limit(100)
    )
    return result.scalars().all()
