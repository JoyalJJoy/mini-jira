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
        self._sse_queues: dict[str, asyncio.Queue] = {}

    def subscribe(self, event_type: str, fn: SubscriberFn):
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(fn)

    def get_sse_queue(self, user_id: str) -> asyncio.Queue:
        """Get or create a queue for a user's SSE connection."""
        if user_id not in self._sse_queues:
            self._sse_queues[user_id] = asyncio.Queue()
        return self._sse_queues[user_id]

    def unsubscribe(self, user_id: str):
        """Remove a user's SSE queue."""
        self._sse_queues.pop(user_id, None)

    async def publish(self, event_type: str, data: dict):
        event = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        # Run subscriber callbacks
        handlers = self._subscribers.get(event_type, [])
        for handler in handlers:
            asyncio.create_task(handler(event))

        # Push to all SSE queues (they filter by project_id on the client side)
        for queue in self._sse_queues.values():
            await queue.put(event)


event_bus = EventBus()


def get_subscriber_queue(user_id: str) -> asyncio.Queue:
    return event_bus.get_sse_queue(user_id)


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
