"""Reusable abstract base with automatic timestamp fields."""

from django.db import models


class BaseModel(models.Model):
    """Abstract parent adding ``created_at`` and ``updated_at`` to concrete models."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
