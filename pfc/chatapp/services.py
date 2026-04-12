"""
Conversation domain service.

Encapsulates creation rules and lookups so HTTP views stay thin. Call these
functions from views, admin hooks, tests, or management commands instead of
duplicating validation in ``CreateAPIView`` subclasses.

Typical POST bodies
-------------------
* Direct: ``{"kind": "direct", "participants": [1, 2]}`` — actor is merged into
  the participant set if omitted.
* Group: ``{"kind": "group", "title": "Optional title", "participants": [...]}``
  — requires at least two distinct users after merging the actor.
"""

from __future__ import annotations

from typing import Sequence

from django.db import transaction
from django.db.models import Count

from .models import Conversation, ConversationKind, User


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

        conversation = Conversation.objects.create(
            kind=ConversationKind.DIRECT,
            title="",
        )
        conversation.participants.set([users_by_id[user_a], users_by_id[user_b]])
        return conversation, True

    if kind == ConversationKind.GROUP.value:
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
