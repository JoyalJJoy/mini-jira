"""
Dashboard endpoint — returns all data needed for analytics widgets
in a single request.
"""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from app.db import get_db
from app.deps import get_current_user
from app.models import (
    Task, TaskStatus, Activity, Sprint, SprintStatus,
    ProjectMember, Project, User,
)

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


async def _get_project_ids(db: AsyncSession, user_id: str) -> list[str]:
    result = await db.execute(
        select(ProjectMember.project_id).where(ProjectMember.user_id == user_id)
    )
    return [row[0] for row in result.fetchall()]


async def _get_user_display_map(db: AsyncSession, user_ids: set[str]) -> dict[str, str]:
    """Build a map of user_id -> display_name for the given IDs."""
    if not user_ids:
        return {}
    result = await db.execute(
        select(User).where(User.id.in_(list(user_ids)))
    )
    return {u.id: u.display_name or u.email or u.id[:8] for u in result.scalars().all()}


@router.get("/")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    project_ids = await _get_project_ids(db, current_user)
    now = datetime.now(timezone.utc)

    # ── 1. Tasks assigned to me (not done) ──────────────────────
    my_tasks_query = select(Task).where(
        Task.assignee_id == current_user,
        Task.status != TaskStatus.DONE.value,
    )
    if project_ids:
        my_tasks_query = my_tasks_query.where(
            or_(Task.project_id.in_(project_ids), Task.owner_id == current_user)
        )
    else:
        my_tasks_query = my_tasks_query.where(Task.owner_id == current_user)
    result = await db.execute(
        my_tasks_query.order_by(Task.due_date.asc().nulls_last(), Task.created_at.desc()).limit(10)
    )
    my_tasks = result.scalars().all()

    # ── 2. Overdue tasks (past due_date, not done) ──────────────
    overdue_query = select(Task).where(
        Task.due_date.isnot(None),
        Task.due_date < now,
        Task.status != TaskStatus.DONE.value,
    )
    if project_ids:
        overdue_query = overdue_query.where(
            or_(Task.project_id.in_(project_ids), Task.owner_id == current_user)
        )
    else:
        overdue_query = overdue_query.where(Task.owner_id == current_user)
    result = await db.execute(
        overdue_query.order_by(Task.due_date.asc()).limit(10)
    )
    overdue_tasks = result.scalars().all()

    # ── 3. Recent activity (last 20) ────────────────────────────
    if project_ids:
        tasks_in_projects = await db.execute(
            select(Activity).join(Task, Activity.task_id == Task.id).where(
                Task.project_id.in_(project_ids)
            ).order_by(Activity.created_at.desc()).limit(20)
        )
        activities = tasks_in_projects.scalars().all()
    else:
        result = await db.execute(
            select(Activity).order_by(Activity.created_at.desc()).limit(20)
        )
        activities = result.scalars().all()

    # ── 4. Sprint progress (active sprint across projects) ──────
    active_sprints = []
    if project_ids:
        result = await db.execute(
            select(Sprint).where(
                Sprint.project_id.in_(project_ids),
                Sprint.status == SprintStatus.ACTIVE.value,
            )
        )
        for sprint in result.scalars().all():
            sprint_tasks = await db.execute(
                select(Task).where(Task.sprint_id == sprint.id)
            )
            st = sprint_tasks.scalars().all()
            total = len(st)
            completed = sum(1 for t in st if t.status == TaskStatus.DONE.value)
            active_sprints.append({
                "id": sprint.id,
                "name": sprint.name,
                "project_id": sprint.project_id,
                "goal": sprint.goal,
                "start_date": sprint.start_date.isoformat() if sprint.start_date else None,
                "end_date": sprint.end_date.isoformat() if sprint.end_date else None,
                "total": total,
                "completed": completed,
            })

    # ── 5. Task distribution ────────────────────────────────────
    by_status = {"todo": 0, "in_progress": 0, "done": 0}
    by_priority = {"p0": 0, "p1": 0, "p2": 0, "p3": 0}
    by_type = {}
    by_assignee_raw = {}

    if project_ids:
        all_tasks_result = await db.execute(
            select(Task).where(Task.project_id.in_(project_ids))
        )
        for t in all_tasks_result.scalars().all():
            if t.status in by_status:
                by_status[t.status] += 1
            if t.priority in by_priority:
                by_priority[t.priority] += 1
            by_type[t.issue_type or "task"] = by_type.get(t.issue_type or "task", 0) + 1
            if t.assignee_id:
                by_assignee_raw[t.assignee_id] = by_assignee_raw.get(t.assignee_id, 0) + 1

    # Resolve assignee names for workload
    all_user_ids = {t.assignee_id for t in my_tasks if t.assignee_id} | \
                   {t.assignee_id for t in overdue_tasks if t.assignee_id} | \
                   set(by_assignee_raw.keys())
    user_map = await _get_user_display_map(db, all_user_ids)

    team_workload = [
        {"user_id": uid, "display_name": user_map.get(uid, uid[:8]), "task_count": count}
        for uid, count in sorted(by_assignee_raw.items(), key=lambda x: -x[1])
    ]

    # ── 6. Burndown chart (for first active sprint) ─────────────
    burndown = None
    if active_sprints:
        sprint = active_sprints[0]
        if sprint["start_date"] and sprint["end_date"]:
            sd = datetime.fromisoformat(sprint["start_date"])
            ed = datetime.fromisoformat(sprint["end_date"])
            total_days = max((ed - sd).days, 1)
            sprint_tasks_result = await db.execute(
                select(Task).where(Task.sprint_id == sprint["id"])
            )
            st = sprint_tasks_result.scalars().all()
            total_tasks = len(st)

            # Build actual burndown: for each day, count remaining tasks
            # (tasks not yet done at that point)
            points = []
            for day_offset in range(total_days + 1):
                day = sd + timedelta(days=day_offset)
                remaining = sum(
                    1 for t in st
                    if t.status != TaskStatus.DONE.value
                )
                # We use current remaining for all days (simplified)
                # In a real app, you'd track when each task was marked done
                points.append({
                    "day": day_offset,
                    "date": day.strftime("%Y-%m-%d"),
                    "ideal": total_tasks * (1 - day_offset / total_days) if total_days > 0 else 0,
                    "actual": remaining if day_offset == 0 or day.date() >= now.date() else None,
                })

            # Better: compute actual from activity log
            done_dates = {}
            for t in st:
                if t.status == TaskStatus.DONE.value:
                    # Find when it was marked done from activity log
                    act_result = await db.execute(
                        select(Activity).where(
                            Activity.task_id == t.id,
                            Activity.action == "updated_status",
                            Activity.new_value == "done",
                        ).order_by(Activity.created_at.asc()).limit(1)
                    )
                    act = act_result.scalar_one_or_none()
                    done_dates[t.id] = act.created_at if act else None

            # Recalculate actual with done dates
            for day_offset in range(total_days + 1):
                day = sd + timedelta(days=day_offset)
                remaining = sum(
                    1 for t in st
                    if t.status != TaskStatus.DONE.value or (
                        done_dates.get(t.id) and done_dates[t.id] > day
                    )
                )
                points[day_offset]["actual"] = remaining

            burndown = {
                "start_date": sprint["start_date"],
                "end_date": sprint["end_date"],
                "total_days": total_days,
                "total_tasks": total_tasks,
                "points": points,
            }

    return {
        "my_tasks": [
            {
                "id": t.id,
                "title": t.title,
                "status": t.status,
                "priority": t.priority,
                "project_id": t.project_id,
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "assignee_id": t.assignee_id,
            }
            for t in my_tasks
        ],
        "overdue_tasks": [
            {
                "id": t.id,
                "title": t.title,
                "status": t.status,
                "priority": t.priority,
                "project_id": t.project_id,
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "assignee_id": t.assignee_id,
            }
            for t in overdue_tasks
        ],
        "recent_activity": [
            {
                "id": a.id,
                "task_id": a.task_id,
                "user_id": a.user_id,
                "user_name": user_map.get(a.user_id, a.user_id[:8]),
                "action": a.action,
                "field_name": a.field_name,
                "old_value": a.old_value,
                "new_value": a.new_value,
                "created_at": a.created_at.isoformat(),
            }
            for a in activities
        ],
        "active_sprints": active_sprints,
        "burndown": burndown,
        "task_distribution": {
            "by_status": by_status,
            "by_priority": by_priority,
            "by_type": by_type,
        },
        "team_workload": team_workload,
    }
