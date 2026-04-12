from __future__ import annotations

from typing import Any

from django.contrib.auth import authenticate
from django.contrib.auth.models import AbstractBaseUser
from rest_framework import serializers

from .models import Conversation, ConversationKind, Message, User


class UserSerializer(serializers.ModelSerializer):
    """Read representation of a user for nested API output."""

    class Meta:
        model = User
        fields = ["id", "username", "email"]


class UserCreateSerializer(serializers.ModelSerializer):
    """Accept registration fields and persist a user with a hashed password."""

    class Meta:
        model = User
        fields = ["id", "username", "email", "password"]
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data: dict[str, Any]) -> User:
        """Delegate creation to Django's user manager for correct password hashing."""
        return User.objects.create_user(**validated_data)


class UserLoginSerializer(serializers.Serializer):
    """Validate email and password pair for credential-based login flows."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        """Reject the payload when credentials do not match an active user."""
        email = attrs.get("email")
        password = attrs.get("password")
        user = authenticate(email=email, password=password)
        if not user:
            raise serializers.ValidationError("Invalid credentials")
        return attrs


class ConversationSerializer(serializers.ModelSerializer):
    """Full conversation payload including nested participant summaries."""

    participants = UserSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = ["id", "kind", "title", "participants", "created_at", "updated_at"]


class CreateConversationSerializer(serializers.Serializer):
    """Validate the body of a POST request that creates a conversation."""

    kind = serializers.ChoiceField(choices=ConversationKind.choices)
    participants = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )
    title = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        default="",
    )

    def validate_participants(self, value: list[int]) -> list[int]:
        """Ensure participant ids are unique so counts match business rules."""
        if len(set(value)) != len(value):
            raise serializers.ValidationError(
                "Duplicate participant ids are not allowed.",
            )
        return value


class MessageSerializer(serializers.ModelSerializer):
    """Message for read APIs; includes sender, optional participant roll-up."""

    sender = UserSerializer(read_only=True)
    participants = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id",
            "conversation",
            "sender",
            "content",
            "timestamp",
            "participants",
        ]

    def get_participants(self, obj: Message) -> Any:
        """Serialize all users in the parent conversation for client convenience."""
        users = obj.conversation.participants.all()
        return UserSerializer(users, many=True).data



class CreateMessageSerializer(serializers.ModelSerializer):
    """
    Accept ``conversation`` and ``content``; assign ``sender`` from ``request.user``.

    The authenticated user must already belong to the target conversation.
    """

    class Meta:
        model = Message
        fields = ["conversation", "content"]

    def validate_conversation(self, conversation: Conversation) -> Conversation:
        """Verify the request user participates in the chosen conversation."""
        request = self.context.get("request")
        if request is None:
            raise serializers.ValidationError("Authentication required.")
        user: AbstractBaseUser | None = request.user
        if not user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")
        if not conversation.participants.filter(pk=user.pk).exists():
            raise serializers.ValidationError(
                "You are not a participant of this conversation."
            )
        return conversation

    def create(self, validated_data: dict[str, Any]) -> Message:
        """Persist the message with the authenticated user as sender."""
        validated_data.pop("sender", None)
        request = self.context.get("request")
        if request is None:
            raise RuntimeError(
                "CreateMessageSerializer requires 'request' in context "
                "(use get_serializer(..., context={'request': request}) or a generic view).",
            )
        user = request.user
        return Message.objects.create(sender=user, **validated_data)
