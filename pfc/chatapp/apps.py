"""Application configuration for the ``chatapp`` Django app."""

from __future__ import annotations

from typing import ClassVar

from django.apps import AppConfig


class ChatappConfig(AppConfig):
    """Default Django app config hook for models and signals registration."""

    default_auto_field: ClassVar[str] = "django.db.models.BigAutoField"
    name: ClassVar[str] = "chatapp"
