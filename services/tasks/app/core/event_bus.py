import json
import asyncio
from datetime import datetime, timezone
from typing import Callable, Coroutine, Any

import redis.asyncio as aioredis
from app.core.config import settings

SubscriberFn = Callable[[dict], Coroutine[Any, Any, None]]


class EventBus:
    def __init__(self):
        self._subscribers: dict[str, list[SubscriberFn]] = {}
        self._redis: aioredis.Redis | None = None
        self._pubsub: aioredis.client.PubSub | None = None
        self._listener_task: asyncio.Task | None = None

    async def connect(self):
        url = settings.redis_url
        # Upstash (and most hosted Redis) requires TLS — use rediss:// scheme
        if url.startswith("redis://") and ("upstash.io" in url or "redistls" in url):
            url = url.replace("redis://", "rediss://", 1)
        self._redis = aioredis.from_url(
            url,
            decode_responses=False,
            ssl_cert_reqs=None,  # accept self-signed certs from hosted providers
        )
        self._pubsub = self._redis.pubsub()

    async def disconnect(self):
        if self._listener_task:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
            self._listener_task = None
        if self._pubsub:
            await self._pubsub.close()
        if self._redis:
            await self._redis.close()

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
        if self._redis:
            await self._redis.publish(event_type, json.dumps(event))

    async def start_listener(self):
        if not self._subscribers or not self._pubsub:
            return

        channels = list(self._subscribers.keys())
        await self._pubsub.subscribe(*channels)

        async for message in self._pubsub.listen():
            if message["type"] != "message":
                continue
            channel = message["channel"].decode()
            data = json.loads(message["data"])
            handlers = self._subscribers.get(channel, [])
            for handler in handlers:
                asyncio.create_task(handler(data))

    def start(self):
        self._listener_task = asyncio.create_task(self.start_listener())


event_bus = EventBus()
