"""Django admin registration for chat models."""

from django.contrib import admin

from .models import Conversation, Message


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    """List and filter conversations by kind and metadata in the admin site."""

    list_display = ["id", "kind", "title", "created_at", "updated_at"]
    search_fields = ["title", "participants__username"]
    list_filter = ["kind", "created_at", "updated_at"]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    """Browse messages with search across sender and conversation participants."""

    list_display = ["id", "created_at", "updated_at"]
    search_fields = ["sender__username", "conversation__participants__username"]
    list_filter = ["created_at", "updated_at"]
