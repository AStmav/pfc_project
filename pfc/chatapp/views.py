"""HTTP API views for users and conversations."""

from __future__ import annotations

from typing import Any

from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from rest_framework import generics, serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from .models import Conversation, Message, User
from .serializers import (
    ConversationSerializer,
    CreateConversationSerializer,
    UserCreateSerializer,
    UserSerializer,
    MessageSerializer,
    CreateMessageSerializer
)
from .services import ConversationServiceError, create_conversation


class CreateUserView(generics.CreateAPIView):
    """Public endpoint to register a new user account."""

    queryset = User.objects.all()
    serializer_class = UserCreateSerializer


class UserListView(generics.ListAPIView):
    """List users; restricted to authenticated clients."""

    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]


class UserDetailView(generics.RetrieveAPIView):
    """Retrieve a single user by primary key."""

    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]


class ConversationListCreateView(generics.ListCreateAPIView):
    """
    List conversations for the authenticated user or create a new thread.

    GET returns only conversations where the request user is a participant.
    POST validates input via ``CreateConversationSerializer`` and delegates
    persistence rules to ``services.create_conversation``.
    """

    permission_classes = [IsAuthenticated]

    def get_queryset(self) -> QuerySet[Conversation]:
        """Return conversations for the current user without duplicate rows."""
        return (
            Conversation.objects.filter(participants=self.request.user)
            .prefetch_related("participants")
            .distinct()
        )

    def get_serializer_class(self) -> type[serializers.Serializer]:
        """Use write serializer on POST and read serializer on safe methods."""
        if self.request.method == "POST":
            return CreateConversationSerializer
        return ConversationSerializer

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        """Create or reuse a conversation and respond with ``ConversationSerializer``."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            conversation, created = create_conversation(
                actor=request.user,
                kind=serializer.validated_data["kind"],
                participant_ids=serializer.validated_data["participants"],
                title=serializer.validated_data.get("title", ""),
            )
        except ConversationServiceError as exc:
            return Response(
                {"error": exc.message},
                status=exc.status_code,
            )

        out = ConversationSerializer(
            conversation,
            context=self.get_serializer_context(),
        )
        http_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(out.data, status=http_status)


class MessageListCreateView(generics.ListCreateAPIView):
    """
    List or create messages scoped to ``conversation_id`` in the URL.

    GET returns messages for the current user in the specified conversation.
    POST validates input via ``CreateMessageSerializer``, saves via
    ``perform_create`` (conversation from URL), and returns the same JSON
    shape as GET using ``MessageSerializer`` on the new instance.

    The authenticated user must already belong to the target conversation.
    """

    permission_classes = [IsAuthenticated]

    def get_queryset(self) -> QuerySet[Message]:
        """Return messages for the current user in the specified conversation."""
        conversation_id = self.kwargs.get("conversation_id")
        if conversation_id is None:
            return Message.objects.none()
        return (
            Message.objects.filter(
                conversation_id=conversation_id,
                conversation__participants=self.request.user,
            )
            .order_by("timestamp")
        )

    def get_serializer_class(self) -> type[serializers.Serializer]:
        if self.request.method == "POST":
            return CreateMessageSerializer
        return MessageSerializer

    def get_conversation(self, conversation_id: Any) -> Conversation:
        """Load the conversation or 404; forbid access if the user is not a member."""
        conversation = get_object_or_404(Conversation, pk=conversation_id)
        if not conversation.participants.filter(pk=self.request.user.pk).exists():
            raise PermissionDenied(
                "You are not a participant of this conversation.",
            )
        return conversation

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        """Bind ``conversation`` from URL, validate, then persist via ``perform_create``."""
        conversation_id = self.kwargs["conversation_id"]
        if not conversation_id:
            return Response(
                {"error": "Conversation ID is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        self.get_conversation(conversation_id)

        data = request.data.copy()
        data["conversation"] = conversation_id

        write_serializer = self.get_serializer(data=data)
        write_serializer.is_valid(raise_exception=True)
        self.perform_create(write_serializer)

        read_serializer = MessageSerializer(
            write_serializer.instance,
            context=self.get_serializer_context(),
        )
        payload = read_serializer.data

        headers = self.get_success_headers(payload)

        return Response(
            payload,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    def perform_create(self, serializer: serializers.BaseSerializer) -> None:
        """Attach the room from the URL and let the serializer set ``sender``."""
        conversation = self.get_conversation(self.kwargs["conversation_id"])
        serializer.save(conversation=conversation)
