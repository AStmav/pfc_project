"""HTTP API views for users and conversations."""

from __future__ import annotations

from typing import Any

from django.db.models import QuerySet
from rest_framework import generics, serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from .models import Conversation, Message, User
from .serializers import (
    AddParticipantsSerializer,
    ConversationSerializer,
    CreateConversationSerializer,
    UserCreateSerializer,
    UserSerializer,
    MessageSerializer,
    CreateMessageSerializer,
)
from .services import (
    ConversationAccess,
    ConversationServiceError,
    add_participants_to_group,
    create_conversation,
)
from .choices import UserRole, ConversationKind


class CreateUserView(generics.CreateAPIView):
    """Public endpoint to register a new user account."""

    queryset = User.objects.all()
    serializer_class = UserCreateSerializer
    permission_classes = [AllowAny]


class UserListView(generics.ListAPIView):
    """
    List users for the authenticated client.

    * **ADMIN** — all users (directory).
    * **MEMBER** — only users who share at least one **group** conversation with
      the requester (candidates for starting a direct chat under the product rules).
    """

    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self) -> QuerySet[User]:
        user = self.request.user
        if user.role == UserRole.ADMIN:
            return User.objects.all().order_by("username")
        shared_groups = Conversation.objects.filter(
            kind=ConversationKind.GROUP,
            participants=user,
        )
        return (
            User.objects.filter(conversations__in=shared_groups)
            .exclude(pk=user.pk)
            .distinct()
            .order_by("username")
        )


class UserDetailView(generics.RetrieveAPIView):
    """Retrieve a single user by primary key."""

    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]


class CurrentUserView(generics.RetrieveAPIView):
    """Return profile data for the authenticated user."""

    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self) -> User:
        return self.request.user


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
        user = self.request.user
        if user.role == UserRole.ADMIN:
            return Conversation.objects.all()   
        return Conversation.objects.filter(participants=user).prefetch_related("participants").distinct()

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


class ConversationAddParticipantsView(generics.GenericAPIView):
    """
    POST: add users to an existing **group** conversation (admin only).

    Direct threads cannot accept new members via this endpoint.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, conversation_id: int, *args: Any, **kwargs: Any) -> Response:
        serializer = AddParticipantsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            conversation = add_participants_to_group(
                actor=request.user,
                conversation_id=conversation_id,
                user_ids=serializer.validated_data["user_ids"],
            )
        except ConversationServiceError as exc:
            return Response(
                {"error": exc.message},
                status=exc.status_code,
            )
        conversation = Conversation.objects.prefetch_related("participants").get(pk=conversation.pk)
        out = ConversationSerializer(
            conversation,
            context=self.get_serializer_context(),
        )
        return Response(out.data, status=status.HTTP_200_OK)


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
        return ConversationAccess.messages_queryset_for_user(
            self.request.user,
            int(conversation_id),
        )


    def get_serializer_class(self) -> type[serializers.Serializer]:
        if self.request.method == "POST":
            return CreateMessageSerializer
        return MessageSerializer

    def get_conversation(self, conversation_id: Any) -> Conversation:
        """Load the conversation or 404; forbid access if the user is not a member."""
        return ConversationAccess.get_conversation_for_user(
            self.request.user,
            int(conversation_id),
        )

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


class MessageRetrieveDestroyView(generics.RetrieveDestroyAPIView):
    """GET one message or DELETE it; only if the user is in that conversation."""

    permission_classes = [IsAuthenticated]
    serializer_class = MessageSerializer
    lookup_field = "uuid"
    lookup_url_kwarg = "message_uuid"

    def get_queryset(self) -> QuerySet[Message]:
        conversation_id = self.kwargs.get("conversation_id")
        if not conversation_id:
            return Message.objects.none()
        return ConversationAccess.messages_queryset_for_user(
            self.request.user,
            int(conversation_id),
        )
