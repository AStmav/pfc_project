from __future__ import annotations

import json
import logging
from typing import Any
from urllib.parse import parse_qs

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from .models import Conversation
from .serializers import MessageSerializer, UserSerializer
from .services import MessageServiceError, create_message_for_participant

logger = logging.getLogger(__name__)

User = get_user_model()


class ChatConsumer(AsyncWebsocketConsumer):
    """One WebSocket per browser tab; scoped to a single conversation."""

    async def connect(self) -> None:
        self.user: User | None = None
        self.conversation_id: int | None = None
        self.room_group_name: str | None = None
        self._accepted: bool = False

        query_string = self.scope["query_string"].decode()
        params = parse_qs(query_string)
        raw_token = (params.get("token") or [None])[0]

        if not raw_token:
            await self.close(code=4002)
            return

        try:
            access = AccessToken(raw_token)
            user_id = access["user_id"]
        except TokenError:
            await self.close(code=4001)
            return

        user = await self._get_user(user_id)
        if user is None:
            await self.close(code=4001)
            return

        conv_id = int(self.scope["url_route"]["kwargs"]["conversation_id"])
        allowed = await self._user_participates(user.id, conv_id)
        if not allowed:
            await self.close(code=4003)
            return

        self.user = user
        self.scope["user"] = user
        self.conversation_id = conv_id
        self.room_group_name = f"chat_{conv_id}"

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        self._accepted = True

        user_payload = await self._serialize_user(user)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "online_status",
                "online_users": [user_payload],
                "status": "online",
            },
        )

    async def disconnect(self, close_code: int) -> None:
        if not self.room_group_name:
            return
        if self._accepted and self.user is not None and self.user.is_authenticated:
            user_payload = await self._serialize_user(self.user)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "online_status",
                    "online_users": [user_payload],
                    "status": "offline",
                },
            )
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name,
        )

    async def receive(self, text_data: str) -> None:
        if not self._accepted or self.user is None:
            return

        try:
            payload: dict[str, Any] = json.loads(text_data)
        except json.JSONDecodeError:
            logger.warning("Invalid JSON from websocket client")
            return

        event_type = payload.get("type")

        if event_type == "chat_message":
            content = payload.get("message")
            if not isinstance(content, str):
                await self.send(
                    text_data=json.dumps(
                        {
                            "type": "error",
                            "detail": "Field 'message' must be a string.",
                        },
                    ),
                )
                return
            try:
                message = await self._save_message(content)
            except MessageServiceError as exc:
                await self.send(
                    text_data=json.dumps(
                        {
                            "type": "error",
                            "detail": exc.message,
                            "code": exc.status_code,
                        },
                    ),
                )
                return
            except Exception:
                logger.exception("Failed to save websocket chat message")
                return

            message_payload = await self._serialize_message(message)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message",
                    "payload": message_payload,
                },
            )

        elif event_type == "typing":
            receiver_raw = payload.get("receiver")
            is_typing = bool(payload.get("is_typing", True))
            try:
                receiver_id = int(receiver_raw) if receiver_raw is not None else None
            except (TypeError, ValueError):
                receiver_id = None

            user_payload = await self._serialize_user(self.user)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "typing",
                    "user": user_payload,
                    "receiver": receiver_id,
                    "is_typing": is_typing,
                },
            )


    async def chat_message(self, event: dict[str, Any]) -> None:
        await self.send(
            text_data=json.dumps(
                {
                    "type": "chat_message",
                    "message": event.get("payload"),
                },
            ),
        )

    async def typing(self, event: dict[str, Any]) -> None:
        await self.send(
            text_data=json.dumps(
                {
                    "type": "typing",
                    "user": event.get("user"),
                    "receiver": event.get("receiver"),
                    "is_typing": event.get("is_typing", False),
                },
            ),
        )

    async def online_status(self, event: dict[str, Any]) -> None:
        await self.send(text_data=json.dumps(event))


    @sync_to_async
    def _get_user(self, user_id: Any) -> User | None:
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None

    @sync_to_async
    def _user_participates(self, user_id: int, conversation_id: int) -> bool:
        return Conversation.objects.filter(
            pk=conversation_id,
            participants__pk=user_id,
        ).exists()

    @sync_to_async
    def _save_message(self, content: str):
        assert self.user is not None and self.conversation_id is not None
        return create_message_for_participant(
            conversation_id=self.conversation_id,
            sender=self.user,
            content=content,
        )

    @sync_to_async
    def _serialize_user(self, user: User) -> dict[str, Any]:
        return UserSerializer(user).data

    @sync_to_async
    def _serialize_message(self, message) -> dict[str, Any]:
        return MessageSerializer(message).data
