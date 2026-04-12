"""Domain models for chat users, conversations, and messages."""

from __future__ import annotations

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Prefetch, QuerySet

from .basemodel import BaseModel


class User(AbstractUser):
    """Application user extending Django auth; adds email verification flags."""

    email = models.EmailField(unique=True)
    is_verified = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)
    is_phone_verified = models.BooleanField(default=False)

    def __str__(self) -> str:
        """Return the username for display in admin and debugging."""
        return self.username


class ConversationManager(models.Manager["Conversation"]):
    """Custom manager that prefetches participants to limit query count on lists."""

    def get_queryset(self) -> QuerySet[Conversation]:
        """Build the default queryset with a lightweight participant prefetch."""
        return super().get_queryset().prefetch_related(
            Prefetch(
                "participants",
                queryset=User.objects.only("id", "username"),
            )
        )


class ConversationKind(models.TextChoices):
    """Enumerates conversation types stored in ``Conversation.kind``."""

    DIRECT = "direct", "Direct (1:1)"
    GROUP = "group", "Group"


class Conversation(BaseModel):
    """Thread between users: direct (two participants) or group (named optional title)."""

    kind = models.CharField(
        max_length=16,
        choices=ConversationKind.choices,
        default=ConversationKind.DIRECT,
    )
    title = models.CharField(
        max_length=255,
        blank=True,
        help_text="For group chats; usually empty for direct.",
    )
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="conversations",
    )
    objects = ConversationManager()

    def __str__(self) -> str:
        """Return a short summary listing participant usernames."""
        participant_names = ", ".join(
            user.username for user in self.participants.all()
        )
        return f"Conversation between {participant_names}"


class Message(BaseModel):
    """Single chat message scoped to a conversation and attributed to a sender."""

    conversation = models.ForeignKey(
        Conversation,
        related_name="messages",
        on_delete=models.CASCADE,
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="messages",
        on_delete=models.CASCADE,
    )
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        """Return a truncated preview for admin lists and logs."""
        return f"Message from {self.sender.username} in {self.content[:20]}"
