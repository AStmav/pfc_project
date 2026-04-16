from django.db import models

class UserRole(models.TextChoices):
    ADMIN = 'ADMIN', 'Admin'
    MEMBER = 'MEMBER', 'Member'

class ConversationKind(models.TextChoices):
    DIRECT = 'DIRECT', 'Direct (1:1)'
    GROUP = 'GROUP', 'Group'

