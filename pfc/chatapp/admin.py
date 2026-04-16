"""Django admin registration for chat models."""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Conversation, Message, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    """Admin for the custom ``AUTH_USER_MODEL`` (not shown until registered here)."""

    list_display = ("username","role", "email", "is_staff", "is_active", "is_verified")
    list_filter = ("is_staff", "is_superuser", "is_active", "is_verified")
    fieldsets = DjangoUserAdmin.fieldsets + (
        (
            "Chat profile",
            {"fields": ("role","is_verified", "is_email_verified", "is_phone_verified")},
        ),
    )


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    """List and filter conversations by kind and metadata in the admin site."""

    list_display = ["id", "kind", "title", "created_at", "updated_at"]
    search_fields = ["title", "participants__username"]
    list_filter = ["kind", "created_at", "updated_at"]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    """Browse messages with search across sender and conversation participants."""

    list_display = ["uuid", "created_at", "updated_at"]
    search_fields = ["sender__username", "conversation__participants__username"]
    list_filter = ["created_at", "updated_at"]
