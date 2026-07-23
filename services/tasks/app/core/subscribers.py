import logging
from app.core.event_bus import event_bus

logger = logging.getLogger("notifications")


async def on_task_created(event: dict):
    task = event["data"]
    logger.info(
        "📬 Notification: Task '%s' (ID: %s) was created by user %s at %s",
        task["title"],
        task["id"],
        task["owner_id"],
        event["timestamp"],
    )


def register_subscribers():
    event_bus.subscribe("task.created", on_task_created)
