
from __future__ import annotations

from typing import Sequence

from django.db import transaction
from django.db.models import Count, QuerySet
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied

from .models import Conversation, ConversationKind, Message, User
from .choices import UserRole


def users_share_at_least_one_group(user_a_id: int, user_b_id: int) -> bool:
    """True if both users are participants in the same group conversation."""
    if user_a_id == user_b_id:
        return False
    return (
        Conversation.objects.filter(
            kind=ConversationKind.GROUP,
            participants__id=user_a_id,
        )
        .filter(participants__id=user_b_id)
        .exists()
    )


class ConversationServiceError(Exception):
    """Domain-level failure converted by views into an HTTP error response."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        """Store a client-facing message and suggested HTTP status code."""
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _parse_participant_ids(raw: Sequence[int | str]) -> list[int]:
    """Coerce iterable items to integer primary keys or raise ``ConversationServiceError``."""
    try:
        return [int(x) for x in raw]
    except (TypeError, ValueError) as exc:
        raise ConversationServiceError(
            "Participant ids must be integers.",
        ) from exc


def find_direct_conversation_between(
    user_a_id: int,
    user_b_id: int,
) -> Conversation | None:
    """
    Find a direct thread whose exactly two participants are the given user ids.
    Excludes group threads by requiring ``kind=direct`` and a participant count
    of two.
    """
    if user_a_id == user_b_id:
        return None

    return (
        Conversation.objects.filter(kind=ConversationKind.DIRECT)
        .annotate(participant_count=Count("participants"))
        .filter(participant_count=2)
        .filter(participants__id=user_a_id)
        .filter(participants__id=user_b_id)
        .first()
    )


@transaction.atomic
def create_conversation(
    *,
    actor: User,
    kind: str,
    participant_ids: Sequence[int | str],
    title: str = "",
    reuse_existing_direct: bool = True,
) -> tuple[Conversation, bool]:
    """
    Create a conversation, or return an existing direct thread when allowed.

    Args:
        actor: Authenticated user; always joined to the participant set.
        kind: String "direct" or "group" (see ``ConversationKind`` values).
        participant_ids: Remote user ids; duplicates are rejected upstream.
        title: Optional group title; ignored for direct threads.
        reuse_existing_direct: When True, return an existing 1:1 room instead
            of reporting a conflict.

    Returns:
        Tuple of ``(instance, created)`` where ``created`` is False if a direct
        room was reused.

    Raises:
        ConversationServiceError: On invalid ids, counts, or duplicate direct
            room when reuse is disabled.
    """
    parsed = _parse_participant_ids(participant_ids)
    unique_ids = set(parsed)
    unique_ids.add(int(actor.pk))

    if kind not in (ConversationKind.DIRECT.value, ConversationKind.GROUP.value):
        raise ConversationServiceError("Invalid conversation kind.")

    user_qs = User.objects.filter(id__in=unique_ids)
    users_by_id = {u.pk: u for u in user_qs}
    if len(users_by_id) != len(unique_ids):
        raise ConversationServiceError(
            "One or more participant ids do not exist.",
        )

    if kind == ConversationKind.DIRECT.value:
        if len(unique_ids) != 2:
            raise ConversationServiceError(
                "A direct conversation must include exactly two distinct users.",
            )
        user_a, user_b = sorted(unique_ids)
        existing = find_direct_conversation_between(user_a, user_b)
        if existing is not None:
            if reuse_existing_direct:
                return existing, False
            raise ConversationServiceError(
                "A direct conversation already exists between these users.",
                status_code=409,
            )

        if actor.role != UserRole.ADMIN:
            if not users_share_at_least_one_group(user_a, user_b):
                raise ConversationServiceError(
                    "You can only start a direct chat with someone who shares "
                    "a group conversation with you.",
                    status_code=403,
                )

        conversation = Conversation.objects.create(
            kind=ConversationKind.DIRECT,
            title="",
        )
        conversation.participants.set([users_by_id[user_a], users_by_id[user_b]])
        return conversation, True

    if kind == ConversationKind.GROUP.value:
        if actor.role != UserRole.ADMIN:
            raise ConversationServiceError(
                "Only administrators can create group chats.",
                status_code=403,
            )
        if len(unique_ids) < 2:
            raise ConversationServiceError(
                "A group conversation needs at least two participants.",
            )
        clean_title = (title or "").strip()
        conversation = Conversation.objects.create(
            kind=ConversationKind.GROUP,
            title=clean_title,
        )
        conversation.participants.set([users_by_id[uid] for uid in sorted(unique_ids)])
        return conversation, True


@transaction.atomic
def add_participants_to_group(
    *,
    actor: User,
    conversation_id: int,
    user_ids: Sequence[int | str],
) -> Conversation:
    """
    Add users to an existing **group** conversation.

    Only ``ADMIN`` may call this. Direct (1:1) threads cannot gain members here;
    create a group chat instead.
    """
    if actor.role != UserRole.ADMIN:
        raise ConversationServiceError(
            "Only administrators can add participants to existing conversations.",
            status_code=403,
        )
    parsed = _parse_participant_ids(user_ids)
    unique_ids = list(dict.fromkeys(parsed))
    if not unique_ids:
        raise ConversationServiceError("user_ids must not be empty.")

    conversation = (
        Conversation.objects.filter(pk=conversation_id)
        .prefetch_related("participants")
        .first()
    )
    if conversation is None:
        raise ConversationServiceError(
            "Conversation not found.",
            status_code=404,
        )
    if conversation.kind != ConversationKind.GROUP.value:
        raise ConversationServiceError(
            "Participants can only be added to group conversations.",
            status_code=400,
        )

    users = list(User.objects.filter(pk__in=unique_ids))
    found_ids = {u.pk for u in users}
    if found_ids != set(unique_ids):
        raise ConversationServiceError(
            "One or more user ids do not exist.",
        )

    existing_ids = set(conversation.participants.values_list("pk", flat=True))
    new_users = [u for u in users if u.pk not in existing_ids]
    if not new_users:
        raise ConversationServiceError(
            "All selected users are already in this conversation.",
            status_code=409,
        )

    conversation.participants.add(*new_users)
    return conversation


class MessageServiceError(Exception):
    """Raised when a realtime or API caller cannot create a message in a thread."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def create_message_for_participant(
    *,
    conversation_id: int,
    sender: User,
    content: str,
) -> Message:
    """
    Persist a message if ``sender`` participates in ``conversation_id``.

    Mirrors the intent of ``CreateMessageSerializer`` so HTTP and WebSocket
    paths do not diverge on who may post where.
    """
    conversation = (
        Conversation.objects.filter(pk=conversation_id)
        .first()
    )
    if conversation is None:
        raise MessageServiceError(
            "Conversation not found or you are not a participant.",
            status_code=403,
        )
    if not ConversationAccess.user_can_access_conversation(sender, conversation):
        raise MessageServiceError(
            "You are not a participant of this conversation.",
            status_code=403,
        )
    text = (content or "").strip()
    if not text:
        raise MessageServiceError(
            "Message content cannot be empty.",
            status_code=400,
        )

    return Message.objects.create(
        conversation=conversation,
        sender=sender,
        content=text,
    )

class ConversationAccess:
    """
    Single place for «who may use this conversation» (list messages, post, etc.).

    ADMIN: any existing conversation. MEMBER: only if a participant.
    """

    @staticmethod
    def user_can_access_conversation(user: User, conversation: Conversation) -> bool:
        if user.role == UserRole.ADMIN:
            return True
        return conversation.participants.filter(pk=user.pk).exists()

    @staticmethod
    def get_conversation_for_user(user: User, conversation_id: int) -> Conversation:
        """
        Load conversation: Http404 if missing, PermissionDenied if MEMBER not in room.

        Use from views; serializers should call only ``user_can_access_conversation``.
        """
        conversation = get_object_or_404(Conversation, pk=conversation_id)
        if not ConversationAccess.user_can_access_conversation(user, conversation):
            raise PermissionDenied(
                "You are not a participant of this conversation.",
            )
        return conversation

    @staticmethod
    def messages_queryset_for_user(user: User, conversation_id: int) -> QuerySet[Message]:
        """Messages in this room visible to this user (ADMIN: all; MEMBER: same room + participant)."""
        qs = Message.objects.filter(conversation_id=conversation_id)
        if user.role != UserRole.ADMIN:
            qs = qs.filter(conversation__participants=user)
        return qs.order_by("timestamp")
