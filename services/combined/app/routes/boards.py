from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.db import get_db
from app.deps import get_current_user
from app.schemas import BoardCreate, BoardUpdate, BoardResponse, ColumnCreate, ColumnUpdate, ColumnResponse
from app.models import Board, Column, Project, ProjectMember

router = APIRouter(prefix="/api/v1/boards", tags=["boards"])


# ── Helpers ────────────────────────────────────────────────────────

async def _is_project_member(db: AsyncSession, project_id: str, user_id: str) -> bool:
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def _get_board(db: AsyncSession, board_id: str, user_id: str) -> Board | None:
    result = await db.execute(select(Board).where(Board.id == board_id))
    board = result.scalar_one_or_none()
    if not board:
        return None
    if not await _is_project_member(db, board.project_id, user_id):
        return None
    return board


# ── Boards ─────────────────────────────────────────────────────────

@router.get("/project/{project_id}", response_model=list[BoardResponse])
async def list_boards(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    if not await _is_project_member(db, project_id, current_user):
        raise HTTPException(status_code=403, detail="Not a project member")
    result = await db.execute(
        select(Board).where(Board.project_id == project_id).order_by(Board.created_at)
    )
    return result.scalars().all()


@router.post("/", response_model=BoardResponse)
async def create_board(
    data: BoardCreate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    if not await _is_project_member(db, data.project_id, current_user):
        raise HTTPException(status_code=403, detail="Not a project member")
    board = Board(**data.model_dump())
    db.add(board)
    await db.flush()
    # Auto-create default columns
    default_cols = [("To Do", 0), ("In Progress", 1), ("Done", 2)]
    for name, pos in default_cols:
        db.add(Column(board_id=board.id, name=name, position=pos))
    await db.commit()
    await db.refresh(board)
    return board


@router.patch("/{board_id}", response_model=BoardResponse)
async def update_board(
    board_id: str,
    data: BoardUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    board = await _get_board(db, board_id, current_user)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(board, field, value)
    await db.commit()
    await db.refresh(board)
    return board


@router.delete("/{board_id}")
async def delete_board(
    board_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    board = await _get_board(db, board_id, current_user)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    # Cascade delete columns
    await db.execute(delete(Column).where(Column.board_id == board_id))
    await db.delete(board)
    await db.commit()
    return {"ok": True}


# ── Columns ────────────────────────────────────────────────────────

@router.get("/{board_id}/columns", response_model=list[ColumnResponse])
async def list_columns(
    board_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    board = await _get_board(db, board_id, current_user)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    result = await db.execute(
        select(Column).where(Column.board_id == board_id).order_by(Column.position)
    )
    return result.scalars().all()


@router.post("/{board_id}/columns", response_model=ColumnResponse)
async def create_column(
    board_id: str,
    data: ColumnCreate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    board = await _get_board(db, board_id, current_user)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    # Auto-set position to end
    if data.position is None:
        result = await db.execute(
            select(Column).where(Column.board_id == board_id).order_by(Column.position.desc()).limit(1)
        )
        last = result.scalar_one_or_none()
        pos = (last.position + 1) if last else 0
    else:
        pos = data.position
    col = Column(board_id=board_id, name=data.name, position=pos, wip_limit=data.wip_limit)
    db.add(col)
    await db.commit()
    await db.refresh(col)
    return col


@router.patch("/{board_id}/columns/{column_id}", response_model=ColumnResponse)
async def update_column(
    board_id: str,
    column_id: str,
    data: ColumnUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    board = await _get_board(db, board_id, current_user)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    result = await db.execute(
        select(Column).where(Column.id == column_id, Column.board_id == board_id)
    )
    col = result.scalar_one_or_none()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(col, field, value)
    await db.commit()
    await db.refresh(col)
    return col


@router.delete("/{board_id}/columns/{column_id}")
async def delete_column(
    board_id: str,
    column_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    board = await _get_board(db, board_id, current_user)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    result = await db.execute(
        select(Column).where(Column.id == column_id, Column.board_id == board_id)
    )
    col = result.scalar_one_or_none()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")
    await db.delete(col)
    await db.commit()
    return {"ok": True}
