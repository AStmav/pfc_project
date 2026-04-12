"""DRF permission classes for object-level access control."""

from __future__ import annotations

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from .models import Conversation


class IsParticipant(BasePermission):
    """
    Grant access only when the request user is linked on ``obj.participants``.

    Intended for ``Conversation`` instances; attach via
    ``permission_classes`` together with ``get_object`` on detail views.
    """

    message = "You are not a participant in this conversation."

    def has_object_permission(
        self,
        request: Request,
        view: APIView,
        obj: Conversation,
    ) -> bool:
        """Return True if the authenticated user is in the conversation roster."""
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return obj.participants.filter(pk=user.pk).exists()
