import asyncio
import json
import logging
from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse
from app.deps import get_current_user
from app.db import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import ProjectMember
from sqlalchemy import select
from app.event_bus import event_bus, get_subscriber_queue

logger = logging.getLogger("sse")

router = APIRouter(prefix="/api/v1/events", tags=["events"])


@router.get("/")
async def event_stream(
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """SSE endpoint — streams real-time events for the user's projects."""
    # Get the user's project IDs
    result = await db.execute(
        select(ProjectMember.project_id).where(ProjectMember.user_id == current_user)
    )
    project_ids = [row[0] for row in result.fetchall()]

    queue = get_subscriber_queue(current_user)

    async def event_generator():
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30)
                    # Only send events for projects the user belongs to
                    if event.get("project_id") in project_ids or event.get("project_id") is None:
                        yield {
                            "event": event["type"],
                            "data": json.dumps(event["data"]),
                        }
                except asyncio.TimeoutError:
                    yield {"event": "ping", "data": "keepalive"}
        except asyncio.CancelledError:
            pass
        finally:
            event_bus.unsubscribe(current_user)

    return EventSourceResponse(event_generator())
