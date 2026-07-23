"""In-memory event bus — no Redis needed for single-process deployment."""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Callable, Coroutine, Any

logger = logging.getLogger("events")

SubscriberFn = Callable[[dict], Coroutine[Any, Any, None]]


class EventBus:
    def __init__(self):
        self._subscribers: dict[str, list[SubscriberFn]] = {}

    def subscribe(self, event_type: str, fn: SubscriberFn):
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(fn)

    async def publish(self, event_type: str, data: dict):
        event = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        handlers = self._subscribers.get(event_type, [])
        for handler in handlers:
            asyncio.create_task(handler(event))


event_bus = EventBus()


# ── built-in subscribers ──────────────────────────────────────────

async def on_task_created(event: dict):
    task = event["data"]
    logger.info(
        "Notification: Task '%s' (ID: %s) was created by user %s at %s",
        task["title"],
        task["id"],
        task["owner_id"],
        event["timestamp"],
    )


event_bus.subscribe("task.created", on_task_created)
